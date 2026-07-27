import {
  BadRequestException,
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
import { isUUID } from 'class-validator';
import { createHash } from 'node:crypto';
import { PublicCacheService } from '../common/cache/public-cache.service';
import { AuditService } from '../audit/audit.service';
import { buildCalendarFile } from '../notifications/ics';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { VenuesService } from '../venues/venues.service';
import { uniqueSlug } from '../common/utils/slug';
import { CreateEventDto } from './dto/create-event.dto';
import {
  ManagementEventsQueryDto,
  PublicEventsQueryDto,
} from './dto/events-query.dto';
import { TicketTierDto } from './dto/ticket-tier.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const eventInclude = Prisma.validator<Prisma.EventInclude>()({
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
});

type EventWithRelations = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

@Injectable()
export class EventsService {
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly cache: PublicCacheService,
    private readonly venues: VenuesService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:3100').split(',')[0];
  }

  async create(organizationId: string, userId: string, dto: CreateEventDto) {
    this.validateEvent(dto, false);
    const [membership, organization] = await Promise.all([
      this.membership(organizationId, userId),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { slug: true },
      }),
    ]);
    if (!organization) throw new NotFoundException('Organization not found');
    if (
      membership.role !== OrgRole.ORG_ADMIN &&
      membership.role !== OrgRole.ORGANIZER
    ) {
      throw new ForbiddenException('Management access is required');
    }

    const event = await this.prisma.$transaction(async (tx) => {
      const allocation =
        dto.venueId && dto.roomId
          ? await this.venues.validateAndLockRoom(tx, {
              organizationId,
              venueId: dto.venueId,
              roomId: dto.roomId,
              startsAt: dto.startsAt,
              endsAt: dto.endsAt,
              capacity: dto.capacity,
            })
          : null;
      const created = await tx.event.create({
        data: {
          organizationId,
          organizerId: userId,
          slug: uniqueSlug(`${dto.title}-${organization.slug}`, 180),
          ...this.eventData(dto),
          ...(allocation
            ? {
                venueName: allocation.venue.name,
                addressLine1: allocation.venue.address,
              }
            : {}),
        },
      });
      await tx.ticketTier.createMany({
        data: dto.ticketTiers.map((tier, index) => ({
          organizationId,
          eventId: created.id,
          name: tier.name.trim(),
          description: tier.description?.trim(),
          capacity: tier.capacity,
          priceCents: tier.priceCents ?? 0,
          currency: (tier.currency ?? 'USD').toUpperCase(),
          isActive: tier.isActive ?? true,
          sortOrder: index,
        })),
      });
      await this.audit.log(
        {
          organizationId,
          actorId: userId,
          action: AuditAction.EVENT_CREATED,
          entityType: 'event',
          entityId: created.id,
          entityLabel: created.title,
          metadata: {
            status: created.status,
            venueId: created.venueId,
            roomId: created.roomId,
          },
        },
        tx,
      );
      return tx.event.findUniqueOrThrow({
        where: { id: created.id },
        include: eventInclude,
      });
    });
    return this.present(event);
  }

  async findManagement(
    organizationId: string,
    userId: string,
    query: ManagementEventsQueryDto,
  ) {
    const membership = await this.membership(organizationId, userId);
    if (
      membership.role !== OrgRole.ORG_ADMIN &&
      membership.role !== OrgRole.ORGANIZER
    ) {
      throw new ForbiddenException('Management access is required');
    }
    const where: Prisma.EventWhereInput = {
      organizationId,
      deletedAt: null,
      ...(membership.role === OrgRole.ORGANIZER ? { organizerId: userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { category: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [events, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: eventInclude,
      }),
      this.prisma.event.count({ where }),
    ]);
    return {
      items: events.map((event) => this.present(event)),
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

  async findManagementOne(organizationId: string, eventId: string, userId: string) {
    const event = await this.requireManageable(organizationId, eventId, userId);
    return this.present(event);
  }

  async update(
    organizationId: string,
    eventId: string,
    userId: string,
    dto: UpdateEventDto,
  ) {
    const existing = await this.requireManageable(organizationId, eventId, userId);
    const requestedLocationType =
      dto.venueType ?? dto.locationType ?? existing.locationType;
    const next = {
      title: dto.title ?? existing.title,
      description: dto.description ?? existing.description,
      startsAt: dto.startsAt ?? existing.startsAt,
      endsAt: dto.endsAt ?? existing.endsAt,
      timezone: dto.timezone ?? existing.timezone,
      venueType: requestedLocationType,
      venueName: dto.venueName ?? existing.venueName ?? undefined,
      address: dto.address ?? dto.addressLine1 ?? existing.addressLine1 ?? undefined,
      city: dto.city ?? existing.city ?? undefined,
      region: dto.region ?? existing.region ?? undefined,
      postalCode: dto.postalCode ?? existing.postalCode ?? undefined,
      country: dto.country ?? existing.country ?? undefined,
      venueId:
        requestedLocationType === LocationType.VIRTUAL
          ? undefined
          : dto.venueId ?? existing.venueId ?? undefined,
      roomId:
        requestedLocationType === LocationType.VIRTUAL
          ? undefined
          : dto.roomId ?? existing.roomId ?? undefined,
      virtualUrl: dto.virtualUrl ?? existing.virtualUrl ?? undefined,
      coverImageUrl: dto.coverImageUrl ?? existing.coverImageUrl ?? undefined,
      capacity: dto.capacity ?? existing.capacity ?? 0,
      category: dto.category ?? existing.category,
      tags: dto.tags ?? existing.tags,
      ticketTiers:
        dto.ticketTiers ??
        existing.ticketTiers
          .filter((tier) => tier.isActive)
          .map((tier) => ({
            id: tier.id,
            name: tier.name,
            capacity: tier.capacity,
          })),
    } as CreateEventDto;
    this.validateEvent(next, existing.status === EventStatus.PUBLISHED);

    const activeRegistrations = existing.registrations.filter(
      ({ status }) => status !== RegistrationStatus.CANCELLED,
    ).length;
    if ((dto.capacity ?? existing.capacity ?? 0) < activeRegistrations) {
      throw new BadRequestException(
        `Capacity cannot be lower than ${activeRegistrations} active registrations`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const nextLocationType =
        dto.venueType ?? dto.locationType ?? existing.locationType;
      const nextVenueId =
        nextLocationType === LocationType.VIRTUAL
          ? undefined
          : dto.venueId ?? existing.venueId ?? undefined;
      const nextRoomId =
        nextLocationType === LocationType.VIRTUAL
          ? undefined
          : dto.roomId ?? existing.roomId ?? undefined;
      const allocation =
        nextVenueId && nextRoomId
          ? await this.venues.validateAndLockRoom(tx, {
              organizationId,
              venueId: nextVenueId,
              roomId: nextRoomId,
              startsAt: dto.startsAt ?? existing.startsAt,
              endsAt: dto.endsAt ?? existing.endsAt,
              capacity: dto.capacity ?? existing.capacity ?? 0,
              excludeEventId: eventId,
            })
          : null;
      if (dto.ticketTiers) {
        await this.updateTiers(tx, existing, dto.ticketTiers);
      }
      const updated = await tx.event.update({
        where: { id: eventId },
        data: {
          ...this.eventData(dto),
          ...(allocation
            ? {
                venueName: allocation.venue.name,
                addressLine1: allocation.venue.address,
              }
            : {}),
        },
      });
      await this.audit.log(
        {
          organizationId,
          actorId: userId,
          action: AuditAction.EVENT_UPDATED,
          entityType: 'event',
          entityId: updated.id,
          entityLabel: updated.title,
          metadata: {
            status: updated.status,
            venueId: updated.venueId,
            roomId: updated.roomId,
          },
        },
        tx,
      );
    });
    if (dto.startsAt) {
      const registrations = await this.prisma.registration.findMany({
        where: {
          organizationId,
          eventId,
          status: RegistrationStatus.CONFIRMED,
        },
        select: { id: true },
      });
      await Promise.allSettled(
        registrations.map(({ id }) =>
          this.notifications.scheduleRegistrationReminder(
            organizationId,
            id,
            dto.startsAt!,
          ),
        ),
      );
    }
    await this.invalidatePublicEvent(existing.id, existing.slug);
    return this.findManagementOne(organizationId, eventId, userId);
  }

  async publish(organizationId: string, eventId: string, userId: string) {
    const event = await this.requireManageable(organizationId, eventId, userId);
    this.validateEvent(
      {
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        timezone: event.timezone,
        venueType: event.locationType,
        venueId: event.venueId ?? undefined,
        roomId: event.roomId ?? undefined,
        venueName: event.venueName ?? undefined,
        address: event.addressLine1 ?? undefined,
        virtualUrl: event.virtualUrl ?? undefined,
        capacity:
          event.capacity ??
          event.ticketTiers.reduce((sum, tier) => sum + tier.capacity, 0),
        category: event.category,
        tags: event.tags,
        ticketTiers: event.ticketTiers.map((tier) => ({
          id: tier.id,
          name: tier.name,
          description: tier.description ?? undefined,
          capacity: tier.capacity,
          priceCents: tier.priceCents,
          currency: tier.currency,
          isActive: tier.isActive,
        })),
      },
      true,
    );
    if (!event.ticketTiers.some((tier) => tier.isActive)) {
      throw new BadRequestException('Add at least one active ticket tier before publishing');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.event.update({
        where: { id: eventId },
        data: { status: EventStatus.PUBLISHED, publishedAt: new Date() },
        include: eventInclude,
      });
      await this.audit.log(
        {
          organizationId,
          actorId: userId,
          action: AuditAction.EVENT_UPDATED,
          entityType: 'event',
          entityId: changed.id,
          entityLabel: changed.title,
          metadata: { status: EventStatus.PUBLISHED },
        },
        tx,
      );
      return changed;
    });
    await this.invalidatePublicEvent(updated.id, updated.slug);
    return this.present(updated);
  }

  async unpublish(organizationId: string, eventId: string, userId: string) {
    await this.requireManageable(organizationId, eventId, userId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.event.update({
        where: { id: eventId },
        data: { status: EventStatus.DRAFT, publishedAt: null },
        include: eventInclude,
      });
      await this.audit.log(
        {
          organizationId,
          actorId: userId,
          action: AuditAction.EVENT_UPDATED,
          entityType: 'event',
          entityId: changed.id,
          entityLabel: changed.title,
          metadata: { status: EventStatus.DRAFT },
        },
        tx,
      );
      return changed;
    });
    await this.invalidatePublicEvent(updated.id, updated.slug);
    return this.present(updated);
  }

  async remove(organizationId: string, eventId: string, userId: string) {
    const existing = await this.requireManageable(organizationId, eventId, userId);
    const removed = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.event.update({
        where: { id: eventId },
        data: { status: EventStatus.CANCELLED, deletedAt: new Date() },
      });
      await this.audit.log(
        {
          organizationId,
          actorId: userId,
          action: AuditAction.EVENT_DELETED,
          entityType: 'event',
          entityId: deleted.id,
          entityLabel: existing.title,
        },
        tx,
      );
      return deleted;
    });
    await this.invalidatePublicEvent(removed.id, removed.slug);
  }

  async findPublic(query: PublicEventsQueryDto) {
    const version = await this.cache.version('events');
    const signature = createHash('sha256')
      .update(
        JSON.stringify({
          search: query.search ?? query.q ?? null,
          category: query.category ?? null,
          dateFrom: query.dateFrom?.toISOString() ?? null,
          dateTo: query.dateTo?.toISOString() ?? null,
          location: query.location ?? null,
          page: query.page,
          pageSize: query.pageSize,
        }),
      )
      .digest('hex');
    return this.cache.remember(
      `events:list:${version}:${signature}`,
      60,
      () => this.findPublicUncached(query),
    );
  }

  private async findPublicUncached(query: PublicEventsQueryDto) {
    const search = (query.search ?? query.q)?.trim();
    let matchedIds: string[] | undefined;
    if (search) {
      const matches = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "events"
        WHERE "search_vector" @@ websearch_to_tsquery('english', ${search})
          AND "status" = 'PUBLISHED'::"event_status"
          AND "deleted_at" IS NULL
        ORDER BY ts_rank("search_vector", websearch_to_tsquery('english', ${search})) DESC
        LIMIT 2000
      `);
      matchedIds = matches.map(({ id }) => id);
    }

    const where: Prisma.EventWhereInput = {
      status: EventStatus.PUBLISHED,
      deletedAt: null,
      ...(matchedIds ? { id: { in: matchedIds } } : {}),
      ...(query.category
        ? { category: { equals: query.category, mode: 'insensitive' } }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            startsAt: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : { endsAt: { gte: new Date() } }),
      ...(query.location
        ? {
            OR: [
              { city: { contains: query.location, mode: 'insensitive' } },
              { region: { contains: query.location, mode: 'insensitive' } },
              { country: { contains: query.location, mode: 'insensitive' } },
              { venueName: { contains: query.location, mode: 'insensitive' } },
              { addressLine1: { contains: query.location, mode: 'insensitive' } },
              ...(['VIRTUAL', 'ONLINE'].includes(query.location.toUpperCase())
                ? [{ locationType: LocationType.VIRTUAL }]
                : []),
            ],
          }
        : {}),
    };
    const [events, total, categories, cities] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        orderBy: [{ startsAt: 'asc' }, { publishedAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: eventInclude,
      }),
      this.prisma.event.count({ where }),
      this.prisma.event.groupBy({
        by: ['category'],
        where: { status: EventStatus.PUBLISHED, deletedAt: null },
        orderBy: { category: 'asc' },
      }),
      this.prisma.event.groupBy({
        by: ['city'],
        where: {
          status: EventStatus.PUBLISHED,
          deletedAt: null,
          city: { not: null },
        },
        orderBy: { city: 'asc' },
      }),
    ]);
    return {
      items: events.map((event) => this.present(event, true)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
      facets: {
        categories: categories.map(({ category }) => category),
        cities: cities.flatMap(({ city }) => (city ? [city] : [])),
      },
    };
  }

  async findPublicOne(identifier: string) {
    return this.cache.remember(
      `events:detail:${identifier}`,
      60,
      () => this.findPublicOneUncached(identifier),
    );
  }

  private async findPublicOneUncached(identifier: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        ...(isUUID(identifier)
          ? { OR: [{ id: identifier }, { slug: identifier }] }
          : { slug: identifier }),
      },
      include: eventInclude,
    });
    if (
      !event ||
      event.deletedAt ||
      event.status !== EventStatus.PUBLISHED
    ) {
      throw new NotFoundException('Event not found');
    }
    return this.present(event, true);
  }

  async calendar(slug: string) {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event || event.deletedAt || event.status !== EventStatus.PUBLISHED) {
      throw new NotFoundException('Event not found');
    }
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
        url: `${this.frontendUrl}/events/${event.slug}`,
      }),
    };
  }

  private validateEvent(dto: CreateEventDto, requireLocationDetails: boolean) {
    const locationType = dto.venueType ?? dto.locationType;
    if (!locationType) throw new BadRequestException('venueType is required');
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: dto.timezone }).format(dto.startsAt);
    } catch {
      throw new BadRequestException('timezone must be a valid IANA time zone');
    }
    if (dto.endsAt <= dto.startsAt) {
      throw new BadRequestException('Event end time must be after its start time');
    }
    if (!dto.ticketTiers?.length) {
      throw new BadRequestException('At least one ticket tier is required');
    }
    const names = dto.ticketTiers.map(({ name }) => name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      throw new BadRequestException('Ticket tier names must be unique');
    }
    const tierCapacity = dto.ticketTiers
      .filter((tier) => tier.isActive !== false)
      .reduce((sum, tier) => sum + tier.capacity, 0);
    if (tierCapacity > dto.capacity) {
      throw new BadRequestException(
        'Combined ticket tier capacity cannot exceed event capacity',
      );
    }
    if (
      requireLocationDetails &&
      (locationType === LocationType.VIRTUAL ||
        locationType === LocationType.HYBRID) &&
      !dto.virtualUrl
    ) {
      throw new BadRequestException('A virtual URL is required for virtual events');
    }
    if (
      requireLocationDetails &&
      (locationType === LocationType.PHYSICAL ||
        locationType === LocationType.HYBRID) &&
      (!dto.venueId || !dto.roomId)
    ) {
      throw new BadRequestException(
        'A venue and room are required for in-person events',
      );
    }
    if (
      locationType === LocationType.VIRTUAL &&
      (dto.venueId || dto.roomId)
    ) {
      throw new BadRequestException(
        'Virtual events cannot reserve a venue or room',
      );
    }
  }

  private eventData(dto: CreateEventDto): Omit<Prisma.EventUncheckedCreateInput, 'organizationId' | 'organizerId' | 'slug'>;
  private eventData(dto: UpdateEventDto): Prisma.EventUncheckedUpdateInput;
  private eventData(
    dto: CreateEventDto | UpdateEventDto,
  ):
    | Omit<
        Prisma.EventUncheckedCreateInput,
        'organizationId' | 'organizerId' | 'slug'
      >
    | Prisma.EventUncheckedUpdateInput {
    const locationType = dto.venueType ?? dto.locationType;
    return {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description.trim() }
        : {}),
      ...(dto.startsAt !== undefined ? { startsAt: dto.startsAt } : {}),
      ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt } : {}),
      ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      ...(locationType !== undefined ? { locationType } : {}),
      ...(locationType === LocationType.VIRTUAL
        ? { venueId: null, roomId: null }
        : {
            ...(dto.venueId !== undefined ? { venueId: dto.venueId } : {}),
            ...(dto.roomId !== undefined ? { roomId: dto.roomId } : {}),
          }),
      ...(dto.venueName !== undefined ? { venueName: dto.venueName || null } : {}),
      ...(dto.address !== undefined || dto.addressLine1 !== undefined
        ? { addressLine1: dto.address ?? dto.addressLine1 ?? null }
        : {}),
      ...(dto.city !== undefined ? { city: dto.city || null } : {}),
      ...(dto.region !== undefined ? { region: dto.region || null } : {}),
      ...(dto.postalCode !== undefined
        ? { postalCode: dto.postalCode || null }
        : {}),
      ...(dto.country !== undefined
        ? { country: dto.country?.toUpperCase() || null }
        : {}),
      ...(dto.virtualUrl !== undefined
        ? { virtualUrl: dto.virtualUrl || null }
        : {}),
      ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
      ...(dto.coverImageUrl !== undefined
        ? { coverImageUrl: dto.coverImageUrl || null }
        : {}),
      ...(dto.category !== undefined ? { category: dto.category.trim() } : {}),
      ...(dto.tags !== undefined
        ? { tags: [...new Set(dto.tags.map((tag) => tag.trim()).filter(Boolean))] }
        : {}),
    } as
      | Omit<
          Prisma.EventUncheckedCreateInput,
          'organizationId' | 'organizerId' | 'slug'
        >
      | Prisma.EventUncheckedUpdateInput;
  }

  private async updateTiers(
    tx: Prisma.TransactionClient,
    event: EventWithRelations,
    tiers: TicketTierDto[],
  ) {
    const submittedIds = new Set(tiers.flatMap(({ id }) => (id ? [id] : [])));
    for (const [index, tier] of tiers.entries()) {
      if (tier.id) {
        const current = event.ticketTiers.find(({ id }) => id === tier.id);
        if (!current) throw new BadRequestException('A ticket tier does not belong to this event');
        const registrations = current.registrations.filter(
          ({ status }) => status !== RegistrationStatus.CANCELLED,
        ).length;
        if (tier.capacity < registrations) {
          throw new BadRequestException(
            `${current.name} capacity cannot be lower than ${registrations}`,
          );
        }
        await tx.ticketTier.update({
          where: { id: tier.id },
          data: {
            name: tier.name.trim(),
            description: tier.description?.trim() || null,
            capacity: tier.capacity,
            priceCents: tier.priceCents ?? current.priceCents,
            currency: (tier.currency ?? current.currency).toUpperCase(),
            isActive: tier.isActive ?? true,
            sortOrder: index,
          },
        });
      } else {
        await tx.ticketTier.create({
          data: {
            organizationId: event.organizationId,
            eventId: event.id,
            name: tier.name.trim(),
            description: tier.description?.trim(),
            capacity: tier.capacity,
            priceCents: tier.priceCents ?? 0,
            currency: (tier.currency ?? 'USD').toUpperCase(),
            isActive: tier.isActive ?? true,
            sortOrder: index,
          },
        });
      }
    }
    for (const old of event.ticketTiers.filter(({ id }) => !submittedIds.has(id))) {
      const hasRegistrations = old.registrations.some(
        ({ status }) => status !== RegistrationStatus.CANCELLED,
      );
      if (hasRegistrations) {
        await tx.ticketTier.update({ where: { id: old.id }, data: { isActive: false } });
      } else {
        await tx.ticketTier.delete({ where: { id: old.id } });
      }
    }
  }

  private async requireManageable(
    organizationId: string,
    eventId: string,
    userId: string,
  ): Promise<EventWithRelations> {
    const [membership, event] = await Promise.all([
      this.membership(organizationId, userId),
      this.prisma.event.findFirst({
        where: { id: eventId, organizationId, deletedAt: null },
        include: eventInclude,
      }),
    ]);
    if (!event) throw new NotFoundException('Event not found');
    if (
      membership.role !== OrgRole.ORG_ADMIN &&
      (membership.role !== OrgRole.ORGANIZER || event.organizerId !== userId)
    ) {
      throw new ForbiddenException('Organizers can only manage their own events');
    }
    return event;
  }

  private async membership(organizationId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) throw new ForbiddenException('Organization membership is required');
    return membership;
  }

  private async invalidatePublicEvent(eventId: string, slug: string) {
    await this.cache.invalidate(
      'events',
      `events:detail:${eventId}`,
      `events:detail:${slug}`,
    );
  }

  private present(event: EventWithRelations, publicView = false) {
    const registeredCount = event.registrations.filter(
      ({ status }) => status !== RegistrationStatus.CANCELLED,
    ).length;
    const checkedInCount = event.registrations.filter(
      ({ status }) => status === RegistrationStatus.CHECKED_IN,
    ).length;
    const {
      registrations: _registrations,
      locationType,
      addressLine1,
      virtualUrl,
      ...rest
    } = event;
    return {
      ...rest,
      description: event.description,
      excerpt:
        event.description.length > 170
          ? `${event.description.slice(0, 167)}…`
          : event.description,
      venueType: locationType,
      locationType,
      address: addressLine1,
      addressLine1,
      ...(!publicView ? { virtualUrl } : {}),
      capacity:
        event.capacity ??
        event.ticketTiers.reduce((sum, tier) => sum + tier.capacity, 0),
      registeredCount,
      checkedInCount,
      ticketTiers: event.ticketTiers
        .filter((tier) => !publicView || tier.isActive)
        .map(({ registrations, ...tier }) => {
          const tierRegistered = registrations.filter(
            ({ status }) => status !== RegistrationStatus.CANCELLED,
          ).length;
          return {
            ...tier,
            registeredCount: tierRegistered,
            remaining: Math.max(0, tier.capacity - tierRegistered),
            priceLabel:
              tier.priceCents === 0
                ? 'Free'
                : new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: tier.currency,
                  }).format(tier.priceCents / 100),
          };
        }),
    };
  }
}
