import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  EventStatus,
  LocationType,
  OrgRole,
  Prisma,
  RegistrationStatus,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/types/auth-user';
import { buildCalendarFile } from '../notifications/ics';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInDto } from './dto/check-in.dto';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RegistrationsQueryDto } from './dto/registrations-query.dto';

const registrationInclude = Prisma.validator<Prisma.RegistrationInclude>()({
  ticketTier: true,
  checkIn: {
    include: {
      checkedInBy: { select: { id: true, name: true } },
    },
  },
  event: {
    include: {
      organization: {
        select: { id: true, name: true, slug: true, logoUrl: true },
      },
      organizer: { select: { id: true, name: true } },
      venue: {
        select: {
          id: true,
          name: true,
          address: true,
          capacity: true,
          imageUrl: true,
        },
      },
      room: {
        select: {
          id: true,
          name: true,
          capacity: true,
          floor: true,
          equipment: true,
          availabilityType: true,
        },
      },
      ticketTiers: {
        orderBy: { sortOrder: 'asc' },
        include: { registrations: { select: { status: true } } },
      },
      registrations: { select: { status: true } },
    },
  },
});

type RegistrationWithRelations = Prisma.RegistrationGetPayload<{
  include: typeof registrationInclude;
}>;

@Injectable()
export class RegistrationsService {
  private readonly apiBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    const configured = config.get('API_URL', 'http://localhost:4100').replace(/\/$/, '');
    this.apiBase = configured.endsWith('/api/v1') ? configured : `${configured}/api/v1`;
  }

  async register(eventId: string, dto: CreateRegistrationDto, user?: AuthUser | null) {
    const attendeeName = (dto.attendeeName ?? dto.fullName)?.trim();
    const attendeeEmail = (dto.attendeeEmail ?? dto.email)?.trim().toLowerCase();
    if (!attendeeName || !attendeeEmail) {
      throw new BadRequestException('attendeeName and attendeeEmail are required');
    }

    const code = `HST-${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;
    const registration = await this.prisma.$transaction(
      async (tx) => {
        // Lock the event first so registrations in different tiers cannot race the
        // event-wide capacity limit.
        await tx.$queryRaw(Prisma.sql`
          SELECT "id"
          FROM "events"
          WHERE "id" = ${eventId}::uuid
          FOR UPDATE
        `);
        await tx.$queryRaw(Prisma.sql`
          SELECT "id"
          FROM "ticket_tiers"
          WHERE "id" = ${dto.ticketTierId}::uuid
            AND "event_id" = ${eventId}::uuid
          FOR UPDATE
        `);

        const tier = await tx.ticketTier.findFirst({
          where: { id: dto.ticketTierId, eventId, isActive: true },
          include: { event: true },
        });
        if (
          !tier ||
          tier.event.deletedAt ||
          tier.event.status !== EventStatus.PUBLISHED
        ) {
          throw new NotFoundException('Event or ticket tier not found');
        }
        const now = new Date();
        if (
          (tier.salesStartAt && tier.salesStartAt > now) ||
          (tier.salesEndAt && tier.salesEndAt < now)
        ) {
          throw new BadRequestException('This ticket tier is not currently on sale');
        }
        if (tier.event.endsAt <= now) {
          throw new BadRequestException('Registration for this event has closed');
        }

        const existing = await tx.registration.findUnique({
          where: { eventId_attendeeEmail: { eventId, attendeeEmail } },
          select: { status: true },
        });
        if (existing && existing.status !== RegistrationStatus.CANCELLED) {
          throw new ConflictException('This email is already registered for the event');
        }

        const activeStatuses = [
          RegistrationStatus.CONFIRMED,
          RegistrationStatus.CHECKED_IN,
        ];
        const [tierRegistrations, eventRegistrations] = await Promise.all([
          tx.registration.count({
            where: { ticketTierId: tier.id, status: { in: activeStatuses } },
          }),
          tx.registration.count({
            where: { eventId, status: { in: activeStatuses } },
          }),
        ]);
        if (tierRegistrations >= tier.capacity) {
          throw new ConflictException('This ticket tier is sold out');
        }
        if (
          tier.event.capacity !== null &&
          eventRegistrations >= tier.event.capacity
        ) {
          throw new ConflictException('This event is at capacity');
        }

        const associatedUserId =
          user && user.email.toLowerCase() === attendeeEmail ? user.id : null;
        if (existing?.status === RegistrationStatus.CANCELLED) {
          return tx.registration.update({
            where: { eventId_attendeeEmail: { eventId, attendeeEmail } },
            data: {
              ticketTierId: tier.id,
              organizationId: tier.organizationId,
              attendeeName,
              attendeeEmail,
              attendeePhone: dto.attendeePhone,
              userId: associatedUserId,
              status: RegistrationStatus.CONFIRMED,
              qrCode: code,
              cancelledAt: null,
              checkedInAt: null,
              checkedInById: null,
            },
            include: registrationInclude,
          });
        }
        return tx.registration.create({
          data: {
            organizationId: tier.organizationId,
            eventId,
            ticketTierId: tier.id,
            userId: associatedUserId,
            attendeeName,
            attendeeEmail,
            attendeePhone: dto.attendeePhone,
            qrCode: code,
          },
          include: registrationInclude,
        });
      },
      {
        // Hosted PostgreSQL poolers can add several seconds of network latency
        // while the event and tier locks are held. Prisma's 5s default closed
        // otherwise valid Supabase transactions before the final insert.
        maxWait: 15_000,
        timeout: 30_000,
      },
    );

    const qrCodeDataUrl = await QRCode.toDataURL(registration.qrCode, {
      width: 480,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    const calendarUrl =
      `${this.apiBase}/registrations/${registration.id}/calendar.ics` +
      `?code=${encodeURIComponent(registration.qrCode)}`;
    const venue =
      registration.event.locationType === LocationType.VIRTUAL
        ? 'Online'
        : [registration.event.venueName, registration.event.addressLine1, registration.event.city]
            .filter(Boolean)
            .join(', ');

    await this.notifications
      .sendRegistrationConfirmation({
        registrationId: registration.id,
        to: registration.attendeeEmail,
        attendeeName: registration.attendeeName,
        eventTitle: registration.event.title,
        startsAt: registration.event.startsAt,
        timezone: registration.event.timezone,
        venue,
        code: registration.qrCode,
        calendarUrl,
      })
      .catch((error: Error) =>
        console.error(`Registration confirmation email failed: ${error.message}`),
      );
    await this.notifications
      .scheduleRegistrationReminder(
        registration.organizationId,
        registration.id,
        registration.event.startsAt,
      )
      .catch((error: Error) =>
        console.error(`Reminder scheduling failed: ${error.message}`),
      );

    return {
      registration: this.present(registration, qrCodeDataUrl),
      qrCodeDataUrl,
      calendarUrl,
    };
  }

  async mine(user: AuthUser) {
    const items = await this.prisma.registration.findMany({
      where: {
        OR: [{ userId: user.id }, { attendeeEmail: user.email.toLowerCase() }],
      },
      orderBy: { createdAt: 'desc' },
      include: registrationInclude,
    });
    return { items: items.map((registration) => this.present(registration)) };
  }

  async findOne(id: string, user: AuthUser) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: registrationInclude,
    });
    if (!registration) throw new NotFoundException('Registration not found');
    const isOwner =
      registration.userId === user.id ||
      registration.attendeeEmail === user.email.toLowerCase();
    const membership = await this.prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: registration.organizationId,
          userId: user.id,
        },
      },
    });
    const isStaff =
      membership?.role === OrgRole.ORG_ADMIN ||
      (membership?.role === OrgRole.ORGANIZER &&
        registration.event.organizerId === user.id);
    if (!isOwner && !isStaff) throw new NotFoundException('Registration not found');
    return this.present(registration);
  }

  async findForEvent(
    organizationId: string,
    eventId: string,
    staffUserId: string,
    query: RegistrationsQueryDto,
  ) {
    await this.assertEventStaff(organizationId, eventId, staffUserId);
    const search = query.search?.trim();
    const where: Prisma.RegistrationWhereInput = {
      organizationId,
      eventId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.ticketTierId ? { ticketTierId: query.ticketTierId } : {}),
      ...(search
        ? {
            OR: [
              { attendeeName: { contains: search, mode: 'insensitive' } },
              { attendeeEmail: { contains: search, mode: 'insensitive' } },
              { qrCode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.registration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: registrationInclude,
      }),
      this.prisma.registration.count({ where }),
    ]);
    return {
      items: items.map((registration) => this.present(registration)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async calendar(id: string, code?: string, user?: AuthUser | null) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: { event: true },
    });
    if (!registration || registration.status === RegistrationStatus.CANCELLED) {
      throw new NotFoundException('Registration not found');
    }
    const ownsRegistration =
      !!user &&
      (registration.userId === user.id ||
        registration.attendeeEmail === user.email.toLowerCase());
    const hasTicketCode =
      !!code &&
      code.trim().toUpperCase() === registration.qrCode.toUpperCase();
    let isStaff = false;
    if (user && !ownsRegistration && !hasTicketCode) {
      const membership = await this.prisma.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: registration.organizationId,
            userId: user.id,
          },
        },
      });
      isStaff =
        membership?.role === OrgRole.ORG_ADMIN ||
        (membership?.role === OrgRole.ORGANIZER &&
          registration.event.organizerId === user.id);
    }
    if (!ownsRegistration && !hasTicketCode && !isStaff) {
      throw new NotFoundException('Registration not found');
    }
    const event = registration.event;
    const location =
      event.locationType === LocationType.VIRTUAL
        ? 'Online'
        : [event.venueName, event.addressLine1, event.city, event.country]
            .filter(Boolean)
            .join(', ');
    return {
      filename: `${event.slug}.ics`,
      content: buildCalendarFile({
        id: event.id,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location,
        url: event.virtualUrl,
      }),
    };
  }

  async checkIn(
    organizationId: string,
    eventId: string,
    staffUserId: string,
    dto: CheckInDto,
  ) {
    await this.assertEventStaff(organizationId, eventId, staffUserId);
    const code = this.normalizeCode(dto.code);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "registrations"
        WHERE "organization_id" = ${organizationId}::uuid
          AND "event_id" = ${eventId}::uuid
          AND UPPER("qr_code") = ${code}
        FOR UPDATE
      `);
      const registration = await tx.registration.findFirst({
        where: {
          organizationId,
          eventId,
          qrCode: { equals: code, mode: 'insensitive' },
        },
        include: registrationInclude,
      });
      if (!registration) throw new NotFoundException('Check-in code is invalid');
      if (registration.status === RegistrationStatus.CANCELLED) {
        throw new BadRequestException('This registration was cancelled');
      }
      if (registration.status === RegistrationStatus.CHECKED_IN) {
        await tx.checkIn.upsert({
          where: { registrationId: registration.id },
          create: {
            organizationId,
            eventId,
            registrationId: registration.id,
            checkedInById: registration.checkedInById ?? staffUserId,
            checkedInAt: registration.checkedInAt ?? new Date(),
            method: 'RECOVERED',
          },
          update: {},
        });
        const recovered = await tx.registration.findUniqueOrThrow({
          where: { id: registration.id },
          include: registrationInclude,
        });
        return {
          registration: this.present(recovered),
          alreadyCheckedIn: true,
        };
      }
      const checkedInAt = new Date();
      await tx.checkIn.create({
        data: {
          organizationId,
          eventId,
          registrationId: registration.id,
          checkedInById: staffUserId,
          checkedInAt,
          method: 'QR_OR_MANUAL',
        },
      });
      const checkedIn = await tx.registration.update({
        where: { id: registration.id },
        data: {
          status: RegistrationStatus.CHECKED_IN,
          checkedInAt,
          checkedInById: staffUserId,
        },
        include: registrationInclude,
      });
      await this.audit.log(
        {
          organizationId,
          actorId: staffUserId,
          action: AuditAction.REGISTRATION_CHECKED_IN,
          entityType: 'registration',
          entityId: checkedIn.id,
          entityLabel: checkedIn.attendeeName,
          metadata: {
            eventId,
            eventTitle: checkedIn.event.title,
            method: 'QR_OR_MANUAL',
          },
        },
        tx,
      );
      return {
        registration: this.present(checkedIn),
        alreadyCheckedIn: false,
      };
    });
  }

  async checkInStats(
    organizationId: string,
    eventId: string,
    staffUserId: string,
  ) {
    const event = await this.assertEventStaff(organizationId, eventId, staffUserId);
    const [registered, checkedIn] = await Promise.all([
      this.prisma.registration.count({
        where: {
          organizationId,
          eventId,
          status: {
            in: [RegistrationStatus.CONFIRMED, RegistrationStatus.CHECKED_IN],
          },
        },
      }),
      this.prisma.registration.count({
        where: { organizationId, eventId, status: RegistrationStatus.CHECKED_IN },
      }),
    ]);
    return {
      eventId,
      registered,
      checkedIn,
      remaining: Math.max(0, (event.capacity ?? registered) - registered),
      checkInRate: registered ? Math.round((checkedIn / registered) * 1000) / 10 : 0,
    };
  }

  private async assertEventStaff(
    organizationId: string,
    eventId: string,
    userId: string,
  ) {
    const [membership, event] = await Promise.all([
      this.prisma.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      }),
      this.prisma.event.findFirst({
        where: { id: eventId, organizationId, deletedAt: null },
      }),
    ]);
    if (!event) throw new NotFoundException('Event not found');
    if (
      membership?.role !== OrgRole.ORG_ADMIN &&
      (membership?.role !== OrgRole.ORGANIZER || event.organizerId !== userId)
    ) {
      throw new ForbiddenException('You cannot check attendees into this event');
    }
    return event;
  }

  private normalizeCode(value: string) {
    const trimmed = value.trim();
    try {
      const parsed = JSON.parse(trimmed) as { code?: string; checkInCode?: string };
      return (parsed.code ?? parsed.checkInCode ?? trimmed).trim().toUpperCase();
    } catch {
      const fromUrl = trimmed.match(/[?&]code=([^&]+)/i)?.[1];
      const candidate = fromUrl ?? trimmed;
      try {
        return decodeURIComponent(candidate).toUpperCase();
      } catch {
        return candidate.toUpperCase();
      }
    }
  }

  private present(registration: RegistrationWithRelations, qrCodeDataUrl?: string) {
    const eventRegistrations = registration.event.registrations;
    const registeredCount = eventRegistrations.filter(
      ({ status }) => status !== RegistrationStatus.CANCELLED,
    ).length;
    const checkedInCount = eventRegistrations.filter(
      ({ status }) => status === RegistrationStatus.CHECKED_IN,
    ).length;
    const event = registration.event;
    return {
      id: registration.id,
      eventId: registration.eventId,
      status: registration.status,
      attendeeName: registration.attendeeName,
      attendeeEmail: registration.attendeeEmail,
      attendeePhone: registration.attendeePhone,
      checkInCode: registration.qrCode,
      qrCode: registration.qrCode,
      ...(qrCodeDataUrl ? { qrCodeDataUrl } : {}),
      checkedInAt: registration.checkedInAt,
      checkIn: registration.checkIn
        ? {
            id: registration.checkIn.id,
            checkedInAt: registration.checkIn.checkedInAt,
            method: registration.checkIn.method,
            checkedInBy: registration.checkIn.checkedInBy,
          }
        : null,
      createdAt: registration.createdAt,
      ticketTier: {
        ...registration.ticketTier,
        registeredCount: registration.event.ticketTiers
          .find(({ id }) => id === registration.ticketTierId)
          ?.registrations.filter(
            ({ status }) => status !== RegistrationStatus.CANCELLED,
          ).length,
      },
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        excerpt:
          event.description.length > 170
            ? `${event.description.slice(0, 167)}…`
            : event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        timezone: event.timezone,
        venueType: event.locationType,
        venueId: event.venueId,
        roomId: event.roomId,
        venueName: event.venueName,
        address: event.addressLine1,
        city: event.city,
        virtualUrl: event.virtualUrl,
        coverImageUrl: event.coverImageUrl,
        category: event.category,
        tags: event.tags,
        venue: event.venue,
        room: event.room,
        status: event.status,
        capacity: event.capacity ?? 0,
        registeredCount,
        checkedInCount,
        organization: event.organization,
      },
    };
  }
}
