import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventStatus,
  LocationType,
  OrgRole,
  RegistrationStatus,
} from '@prisma/client';
import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { EventsService } from '../events/events.service';
import { CreateEventDto } from '../events/dto/create-event.dto';
import { PrismaService } from '../prisma/prisma.service';

type GroundedEvent = {
  id: string;
  title: string;
  status: EventStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: number;
  registrations: number;
  checkedIn: number;
  fillRate: number;
  checkInRate: number;
  venue: string | null;
  room: string | null;
};

type AssistantContext = {
  organization: { id: string; name: string };
  role: OrgRole;
  events: GroundedEvent[];
  rooms: Array<{
    id: string;
    venueId: string;
    name: string;
    venue: string;
    capacity: number;
  }>;
  roomBookings: Array<{
    roomId: string;
    startsAt: string;
    endsAt: string;
  }>;
};

type CreateEventInput = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueType: LocationType;
  venueId?: string;
  roomId?: string;
  venueName?: string;
  address?: string;
  virtualUrl?: string;
  capacity: number;
  category: string;
  tags: string[];
  ticketTiers: Array<{
    name: string;
    description?: string;
    capacity: number;
  }>;
};

type SignedProposal = {
  id: string;
  organizationId: string;
  userId: string;
  expiresAt: number;
  kind: 'CREATE_EVENT';
  input: CreateEventInput;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
};

@Injectable()
export class AiAssistantService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly confirmationSecret: string;
  private readonly consumedProposals = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    config: ConfigService,
  ) {
    this.apiKey = config.get<string>('GEMINI_API_KEY')?.trim() || '';
    this.model =
      config.get<string>('GEMINI_MODEL')?.trim() || 'gemini-2.5-flash';
    this.confirmationSecret =
      config.get<string>('JWT_ACCESS_SECRET') || 'hostly-development-secret';
  }

  async insights(organizationId: string, userId: string) {
    const context = await this.context(organizationId, userId);
    const insights = this.buildInsights(context);
    return {
      generatedAt: new Date().toISOString(),
      insights,
      summary: {
        events: context.events.length,
        registrations: context.events.reduce(
          (sum, event) => sum + event.registrations,
          0,
        ),
        rooms: context.rooms.length,
      },
    };
  }

  async chat(organizationId: string, userId: string, rawMessage: string) {
    const message = rawMessage.trim();
    const context = await this.context(organizationId, userId);

    if (this.looksLikeCreateRequest(message)) {
      const proposal = await this.createProposal(
        organizationId,
        userId,
        message,
        context,
      );
      return {
        message:
          'I prepared a draft from your request. Review the details below; nothing will be created until you confirm.',
        sources: ['organization settings', 'managed venues and rooms'],
        proposal,
        grounded: true,
      };
    }

    if (this.looksLikeDescriptionRequest(message)) {
      try {
        const description = await this.callGemini(
          [
            'Write a polished event description from the organizer request below.',
            'Use only details explicitly supplied by the organizer.',
            'Do not invent speakers, sponsors, dates, venues, pricing, or outcomes.',
            'Return two or three compact paragraphs with no markdown heading.',
            `ORGANIZER REQUEST:\n${message}`,
          ].join('\n\n'),
        );
        return {
          message: description,
          sources: ['organizer-provided notes'],
          grounded: true,
          generatedDescription: description,
        };
      } catch {
        return {
          message:
            'Gemini is temporarily rate-limited, so I could not generate the description. Your event data and existing descriptions were not changed.',
          sources: [],
          grounded: true,
          degraded: true,
        };
      }
    }

    const exactAnswer = this.deterministicAnswer(message, context);
    if (exactAnswer) return exactAnswer;

    const facts = {
      organization: context.organization,
      events: context.events,
      rooms: context.rooms,
      roomBookings: context.roomBookings,
    };
    try {
      const answer = await this.callGemini(
        [
          'You are Hostly AI, an internal event operations assistant.',
          'Answer only from the FACTS JSON supplied by the server.',
          'Never infer missing registrations, room availability, dates, or rates.',
          'If the facts do not answer the question, say exactly what information is missing.',
          'Be concise and mention the event or room names used.',
          `FACTS JSON:\n${JSON.stringify(facts)}`,
          `ORGANIZER QUESTION:\n${message}`,
        ].join('\n\n'),
      );
      return {
        message: answer,
        sources: context.events.map((event) => ({
          type: 'event',
          id: event.id,
          label: event.title,
        })),
        grounded: true,
      };
    } catch {
      return {
        message:
          'Gemini is temporarily unavailable, but your workspace is still connected. I can answer exact registration, capacity, check-in, and dated room-availability questions from the database.',
        sources: [],
        grounded: true,
        degraded: true,
      };
    }
  }

  async generateDescription(
    organizationId: string,
    userId: string,
    title: string,
    bullets: string,
  ) {
    await this.context(organizationId, userId);
    try {
      const description = await this.callGemini(
        [
          'Write a polished event description using only the supplied title and notes.',
          'Do not invent speakers, sponsors, promises, pricing, dates, or locations.',
          'Use two or three compact paragraphs and no markdown heading.',
          `TITLE: ${title.trim()}`,
          `NOTES:\n${bullets.trim()}`,
        ].join('\n\n'),
      );
      return { description, generated: true };
    } catch {
      return {
        description: `${title.trim()} brings attendees together around ${bullets
          .trim()
          .replace(/\n+/g, ' ')
          .replace(/^[-•]\s*/g, '')}. Review the details and join us for a focused, practical session.`,
        generated: false,
        degraded: true,
      };
    }
  }

  async confirmAction(
    organizationId: string,
    userId: string,
    confirmationToken: string,
  ) {
    const proposal = this.verifyProposal(confirmationToken);
    if (
      proposal.organizationId !== organizationId ||
      proposal.userId !== userId
    ) {
      throw new ForbiddenException(
        'This proposal belongs to another user or workspace',
      );
    }
    if (proposal.expiresAt < Date.now()) {
      throw new BadRequestException(
        'This proposal expired. Ask the assistant to prepare it again.',
      );
    }
    if (this.consumedProposals.has(proposal.id)) {
      throw new BadRequestException('This proposal has already been confirmed');
    }

    this.validateCreateInput(proposal.input);
    this.consumedProposals.add(proposal.id);
    try {
      const created = await this.events.create(
        organizationId,
        userId,
        this.toCreateEventDto(proposal.input),
      );
      return {
        message: `${created.title} was created as a draft.`,
        event: created,
      };
    } catch (error) {
      this.consumedProposals.delete(proposal.id);
      throw error;
    }
  }

  private async context(
    organizationId: string,
    userId: string,
  ): Promise<AssistantContext> {
    const membership = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: {
        role: true,
        organization: { select: { id: true, name: true } },
      },
    });
    if (
      !membership ||
      (membership.role !== OrgRole.ORG_ADMIN &&
        membership.role !== OrgRole.ORGANIZER)
    ) {
      throw new ForbiddenException('Management access is required');
    }

    const visibleEventWhere = {
      organizationId,
      deletedAt: null,
      ...(membership.role === OrgRole.ORGANIZER
        ? { organizerId: userId }
        : {}),
    };
    const [events, rooms, roomBookings] = await Promise.all([
      this.prisma.event.findMany({
        where: visibleEventWhere,
        orderBy: { startsAt: 'asc' },
        take: 100,
        select: {
          id: true,
          title: true,
          status: true,
          startsAt: true,
          endsAt: true,
          timezone: true,
          capacity: true,
          venue: { select: { name: true } },
          room: { select: { name: true } },
          ticketTiers: { select: { capacity: true } },
          registrations: { select: { status: true } },
        },
      }),
      this.prisma.room.findMany({
        where: {
          organizationId,
          deletedAt: null,
          venue: { deletedAt: null },
        },
        orderBy: [{ venue: { name: 'asc' } }, { name: 'asc' }],
        select: {
          id: true,
          venueId: true,
          name: true,
          capacity: true,
          venue: { select: { name: true } },
        },
      }),
      this.prisma.event.findMany({
        where: {
          organizationId,
          deletedAt: null,
          status: { not: EventStatus.CANCELLED },
          roomId: { not: null },
        },
        select: { roomId: true, startsAt: true, endsAt: true },
      }),
    ]);

    return {
      organization: membership.organization,
      role: membership.role,
      events: events.map((event) => {
        const registrations = event.registrations.filter(
          ({ status }) => status !== RegistrationStatus.CANCELLED,
        );
        const checkedIn = registrations.filter(
          ({ status }) => status === RegistrationStatus.CHECKED_IN,
        ).length;
        const capacity =
          event.capacity ??
          event.ticketTiers.reduce((sum, tier) => sum + tier.capacity, 0);
        return {
          id: event.id,
          title: event.title,
          status: event.status,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          timezone: event.timezone,
          capacity,
          registrations: registrations.length,
          checkedIn,
          fillRate: this.rate(registrations.length, capacity),
          checkInRate: this.rate(checkedIn, registrations.length),
          venue: event.venue?.name ?? null,
          room: event.room?.name ?? null,
        };
      }),
      rooms: rooms.map((room) => ({
        id: room.id,
        venueId: room.venueId,
        name: room.name,
        venue: room.venue.name,
        capacity: room.capacity,
      })),
      roomBookings: roomBookings.flatMap((booking) =>
        booking.roomId
          ? [
              {
                roomId: booking.roomId,
                startsAt: booking.startsAt.toISOString(),
                endsAt: booking.endsAt.toISOString(),
              },
            ]
          : [],
      ),
    };
  }

  private deterministicAnswer(message: string, context: AssistantContext) {
    const lower = message.toLowerCase();
    const referenced = this.findReferencedEvent(lower, context.events);

    if (referenced && /(registr|attendee|people|guest)/i.test(message)) {
      return {
        message: `${referenced.title} has ${referenced.registrations} active ${
          referenced.registrations === 1 ? 'registration' : 'registrations'
        } out of ${referenced.capacity} places (${referenced.fillRate}% full).`,
        sources: [
          { type: 'event', id: referenced.id, label: referenced.title },
        ],
        grounded: true,
        facts: {
          registrations: referenced.registrations,
          capacity: referenced.capacity,
          fillRate: referenced.fillRate,
        },
      };
    }

    if (referenced && /check.?in|arrival/i.test(message)) {
      return {
        message: `${referenced.title} has ${referenced.checkedIn} checked in from ${referenced.registrations} active registrations, a ${referenced.checkInRate}% check-in rate.`,
        sources: [
          { type: 'event', id: referenced.id, label: referenced.title },
        ],
        grounded: true,
        facts: {
          checkedIn: referenced.checkedIn,
          registrations: referenced.registrations,
          checkInRate: referenced.checkInRate,
        },
      };
    }

    const requestedDay = this.extractDate(message);
    if (requestedDay && /room|venue|space|free|available/i.test(message)) {
      const dayStart = new Date(`${requestedDay}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + 86_400_000);
      const busyRoomIds = new Set(
        context.roomBookings
          .filter(
            (booking) =>
              new Date(booking.startsAt) < dayEnd &&
              new Date(booking.endsAt) > dayStart,
          )
          .map((booking) => booking.roomId),
      );
      const available = context.rooms.filter(
        (room) => !busyRoomIds.has(room.id),
      );
      const messageText = available.length
        ? `Available on ${requestedDay}: ${available
            .map(
              (room) =>
                `${room.venue} — ${room.name} (${room.capacity} people)`,
            )
            .join('; ')}.`
        : context.rooms.length
          ? `No managed room is free on ${requestedDay}.`
          : 'This workspace does not have any managed rooms yet.';
      return {
        message: messageText,
        sources: available.map((room) => ({
          type: 'room',
          id: room.id,
          label: `${room.venue} — ${room.name}`,
        })),
        grounded: true,
      };
    }

    return null;
  }

  private buildInsights(context: AssistantContext): string[] {
    const now = Date.now();
    const weekEnd = now + 7 * 86_400_000;
    const lowRegistration = context.events.filter((event) => {
      const startsAt = new Date(event.startsAt).getTime();
      return (
        event.status === EventStatus.PUBLISHED &&
        startsAt >= now &&
        startsAt <= weekEnd &&
        event.fillRate < 25
      );
    });
    const upcoming = context.events.filter(
      (event) => new Date(event.startsAt).getTime() >= now,
    );
    const insights: string[] = [];
    if (lowRegistration.length) {
      insights.push(
        `${lowRegistration.length} event${
          lowRegistration.length === 1 ? '' : 's'
        } this week ${
          lowRegistration.length === 1 ? 'is' : 'are'
        } below 25% registration: ${lowRegistration
          .map((event) => event.title)
          .join(', ')}.`,
      );
    }
    if (upcoming.length) {
      const next = upcoming[0];
      insights.push(
        `Next up: ${next.title} has ${next.registrations}/${next.capacity} places reserved.`,
      );
    }
    if (!context.rooms.length) {
      insights.push(
        'No managed rooms exist yet; add a venue and room to enable availability checks.',
      );
    }
    if (!insights.length) {
      insights.push(
        'Your event schedule has no immediate registration or room-allocation alerts.',
      );
    }
    return insights.slice(0, 3);
  }

  private async createProposal(
    organizationId: string,
    userId: string,
    request: string,
    context: AssistantContext,
  ) {
    const input = await this.extractCreateInput(request, context);
    this.validateCreateInput(input);
    const signed: SignedProposal = {
      id: randomUUID(),
      organizationId,
      userId,
      expiresAt: Date.now() + 10 * 60_000,
      kind: 'CREATE_EVENT',
      input,
    };
    return {
      kind: signed.kind,
      confirmationToken: this.signProposal(signed),
      expiresAt: new Date(signed.expiresAt).toISOString(),
      event: input,
    };
  }

  private async extractCreateInput(
    request: string,
    context: AssistantContext,
  ): Promise<CreateEventInput> {
    try {
      const raw = await this.callGemini(
        [
          'Extract a draft event from the organizer request.',
          `Current UTC time: ${new Date().toISOString()}.`,
          'Resolve relative dates into ISO 8601 UTC timestamps.',
          'Use a two-hour duration when no end time is given.',
          'Do not invent a physical room. Use VIRTUAL unless the request names one of the managed rooms.',
          `Managed rooms: ${JSON.stringify(context.rooms)}.`,
          'Return JSON only with title, description, startsAt, endsAt, timezone, venueType, capacity, category, tags.',
          'venueType must be PHYSICAL or VIRTUAL. tags must be an array of short strings.',
          `REQUEST: ${request}`,
        ].join('\n\n'),
        true,
      );
      const parsed = JSON.parse(raw) as Partial<CreateEventInput>;
      const capacity = this.safeCapacity(parsed.capacity);
      const room = this.findNamedRoom(request, context);
      const startsAt = this.safeFutureDate(parsed.startsAt);
      const endsAt = this.safeEndDate(parsed.endsAt, startsAt);
      return {
        title: this.safeTitle(parsed.title, request),
        description: this.safeDescription(parsed.description, request),
        startsAt,
        endsAt,
        timezone: parsed.timezone?.trim() || 'UTC',
        venueType: room ? LocationType.PHYSICAL : LocationType.VIRTUAL,
        ...(room
          ? {
              venueId: room.venueId,
              roomId: room.id,
              venueName: room.venue,
            }
          : {}),
        capacity,
        category: this.safeCategory(parsed.category),
        tags: this.safeTags(parsed.tags),
        ticketTiers: [
          {
            name: 'General admission',
            description: 'Standard event admission',
            capacity,
          },
        ],
      };
    } catch {
      return this.fallbackCreateInput(request);
    }
  }

  private fallbackCreateInput(request: string): CreateEventInput {
    const capacityMatch = request.match(
      /(?:for|capacity(?:\s+of)?)\s+(\d{1,6})\s*(?:people|guests|attendees)?/i,
    );
    const capacity = this.safeCapacity(
      capacityMatch ? Number(capacityMatch[1]) : 100,
    );
    const startsAt = this.relativeStart(request);
    const endsAt = new Date(
      new Date(startsAt).getTime() + 2 * 3_600_000,
    ).toISOString();
    const title =
      request
        .match(
          /(?:create|schedule|plan|set up)\s+(?:an?\s+)?(.+?)(?:\s+(?:next|on|at|for)\b|$)/i,
        )?.[1]
        ?.replace(/\bevent\b/i, '')
        .trim() || 'New event';
    return {
      title: this.safeTitle(title, request),
      description: this.safeDescription(undefined, request),
      startsAt,
      endsAt,
      timezone: 'UTC',
      venueType: LocationType.VIRTUAL,
      capacity,
      category: 'Business',
      tags: ['AI-assisted'],
      ticketTiers: [
        {
          name: 'General admission',
          description: 'Standard event admission',
          capacity,
        },
      ],
    };
  }

  private findNamedRoom(request: string, context: AssistantContext) {
    const lower = request.toLowerCase();
    return context.rooms.find(
      (room) =>
        lower.includes(room.name.toLowerCase()) &&
        lower.includes(room.venue.toLowerCase()),
    );
  }

  private validateCreateInput(input: CreateEventInput) {
    if (!input.title || input.title.length < 3 || input.title.length > 160) {
      throw new BadRequestException('The proposed event title is invalid');
    }
    if (!input.description || input.description.length < 10) {
      throw new BadRequestException('The proposed description is invalid');
    }
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      throw new BadRequestException('The proposed event schedule is invalid');
    }
    if (
      !Number.isInteger(input.capacity) ||
      input.capacity < 1 ||
      input.capacity > 1_000_000
    ) {
      throw new BadRequestException('The proposed capacity is invalid');
    }
  }

  private toCreateEventDto(input: CreateEventInput): CreateEventDto {
    return {
      title: input.title,
      description: input.description,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      timezone: input.timezone,
      venueType: input.venueType,
      venueId: input.venueId,
      roomId: input.roomId,
      venueName: input.venueName,
      address: input.address,
      virtualUrl: input.virtualUrl,
      capacity: input.capacity,
      category: input.category,
      tags: input.tags,
      ticketTiers: input.ticketTiers,
    };
  }

  private signProposal(proposal: SignedProposal) {
    const payload = Buffer.from(JSON.stringify(proposal)).toString('base64url');
    const signature = createHmac('sha256', this.confirmationSecret)
      .update(payload)
      .digest('base64url');
    return `${payload}.${signature}`;
  }

  private verifyProposal(token: string): SignedProposal {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) {
      throw new BadRequestException('The confirmation token is invalid');
    }
    const expected = createHmac('sha256', this.confirmationSecret)
      .update(payload)
      .digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(signature, 'base64url');
    } catch {
      throw new BadRequestException('The confirmation token is invalid');
    }
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new BadRequestException('The confirmation token is invalid');
    }
    try {
      const proposal = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as SignedProposal;
      if (proposal.kind !== 'CREATE_EVENT' || !proposal.input) {
        throw new Error('Invalid proposal');
      }
      return proposal;
    } catch {
      throw new BadRequestException('The confirmation token is invalid');
    }
  }

  private async callGemini(prompt: string, json = false): Promise<string> {
    if (!this.apiKey) throw new Error('Gemini is not configured');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        this.model,
      )}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          ...(json
            ? { generationConfig: { responseMimeType: 'application/json' } }
            : {}),
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );
    const payload = (await response.json()) as GeminiResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message || `Gemini HTTP ${response.status}`);
    }
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();
    if (!text) throw new Error('Gemini returned no text');
    return text;
  }

  private findReferencedEvent(message: string, events: GroundedEvent[]) {
    const exact = [...events]
      .sort((left, right) => right.title.length - left.title.length)
      .find((event) => message.includes(event.title.toLowerCase()));
    if (exact) return exact;
    const words = new Set(
      message
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 3),
    );
    return events
      .map((event) => ({
        event,
        score: event.title
          .toLowerCase()
          .split(/\s+/)
          .filter((word) => words.has(word.replace(/[^a-z0-9]/g, ''))).length,
      }))
      .sort((left, right) => right.score - left.score)
      .find((candidate) => candidate.score >= 2)?.event;
  }

  private extractDate(message: string): string | null {
    const isoDate = message.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
    if (isoDate && !Number.isNaN(new Date(`${isoDate}T00:00:00Z`).getTime())) {
      return isoDate;
    }
    const now = new Date();
    if (/\btomorrow\b/i.test(message)) {
      now.setUTCDate(now.getUTCDate() + 1);
      return now.toISOString().slice(0, 10);
    }
    if (/\btoday\b/i.test(message)) return now.toISOString().slice(0, 10);
    return null;
  }

  private relativeStart(request: string) {
    const date = new Date();
    date.setUTCMinutes(0, 0, 0);
    if (/next friday/i.test(request)) {
      const days = ((5 - date.getUTCDay() + 7) % 7) || 7;
      date.setUTCDate(date.getUTCDate() + days);
    } else if (/tomorrow/i.test(request)) {
      date.setUTCDate(date.getUTCDate() + 1);
    } else {
      date.setUTCDate(date.getUTCDate() + 7);
    }
    const time = request.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (time) {
      let hour = Number(time[1]);
      const suffix = time[3]?.toLowerCase();
      if (suffix === 'pm' && hour < 12) hour += 12;
      if (suffix === 'am' && hour === 12) hour = 0;
      date.setUTCHours(hour, Number(time[2] || 0), 0, 0);
    } else {
      date.setUTCHours(18, 0, 0, 0);
    }
    return date.toISOString();
  }

  private safeFutureDate(value?: string) {
    const parsed = value ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) && parsed > new Date()
      ? parsed.toISOString()
      : this.relativeStart('');
  }

  private safeEndDate(value: string | undefined, startsAt: string) {
    const parsed = value ? new Date(value) : null;
    return parsed &&
      !Number.isNaN(parsed.getTime()) &&
      parsed > new Date(startsAt)
      ? parsed.toISOString()
      : new Date(new Date(startsAt).getTime() + 2 * 3_600_000).toISOString();
  }

  private safeCapacity(value?: number) {
    const capacity = Number(value);
    return Number.isInteger(capacity) && capacity > 0 && capacity <= 1_000_000
      ? capacity
      : 100;
  }

  private safeTitle(value: string | undefined, request: string) {
    const title = value?.trim() || request.trim().slice(0, 120);
    return title.length >= 3 ? title.slice(0, 160) : 'New event';
  }

  private safeDescription(value: string | undefined, request: string) {
    const description = value?.trim();
    if (description && description.length >= 10) return description.slice(0, 20_000);
    return `A new event prepared from this organizer request: ${request.trim()}`.slice(
      0,
      20_000,
    );
  }

  private safeCategory(value?: string) {
    const category = value?.trim() || 'Business';
    return category.slice(0, 80);
  }

  private safeTags(value?: string[]) {
    if (!Array.isArray(value)) return ['AI-assisted'];
    return value
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => tag.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 10);
  }

  private looksLikeCreateRequest(message: string) {
    return (
      /\b(create|schedule|plan|set up|organize)\b/i.test(message) &&
      /\b(event|launch|workshop|conference|meetup|session|summit)\b/i.test(
        message,
      )
    );
  }

  private looksLikeDescriptionRequest(message: string) {
    return (
      /\b(description|event copy|write|rewrite|polish)\b/i.test(message) &&
      !/\b(how many|registration|check.?in|room|available)\b/i.test(message)
    );
  }

  private rate(numerator: number, denominator: number) {
    return denominator
      ? Math.round((numerator / denominator) * 1_000) / 10
      : 0;
  }
}
