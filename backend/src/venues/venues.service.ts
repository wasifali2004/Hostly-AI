import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  EventStatus,
  OrgRole,
  Prisma,
  RoomAvailabilityType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';

const venueInclude = Prisma.validator<Prisma.VenueInclude>()({
  rooms: {
    where: { deletedAt: null },
    orderBy: [{ floor: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          events: { where: { deletedAt: null, status: { not: EventStatus.CANCELLED } } },
        },
      },
    },
  },
  _count: {
    select: {
      events: { where: { deletedAt: null, status: { not: EventStatus.CANCELLED } } },
    },
  },
});

@Injectable()
export class VenuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(organizationId: string, userId: string) {
    await this.requireManager(organizationId, userId);
    const items = await this.prisma.venue.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      include: venueInclude,
    });
    return { items };
  }

  async findOne(organizationId: string, venueId: string, userId: string) {
    await this.requireManager(organizationId, userId);
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, organizationId, deletedAt: null },
      include: venueInclude,
    });
    if (!venue) throw new NotFoundException('Venue not found');
    return venue;
  }

  async create(organizationId: string, userId: string, dto: CreateVenueDto) {
    await this.requireManager(organizationId, userId);
    return this.prisma.$transaction(async (tx) => {
      const venue = await tx.venue.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          address: dto.address.trim(),
          capacity: dto.capacity,
          description: dto.description?.trim() || null,
          imageUrl: dto.imageUrl || null,
        },
        include: venueInclude,
      });
      await this.audit.log(
        {
          organizationId,
          actorId: userId,
          action: AuditAction.VENUE_CREATED,
          entityType: 'venue',
          entityId: venue.id,
          entityLabel: venue.name,
        },
        tx,
      );
      return venue;
    });
  }

  async update(
    organizationId: string,
    venueId: string,
    userId: string,
    dto: UpdateVenueDto,
  ) {
    await this.requireManager(organizationId, userId);
    const venue = await this.requireVenue(organizationId, venueId);
    if (dto.capacity !== undefined) {
      const largestRoom = await this.prisma.room.findFirst({
        where: { organizationId, venueId, deletedAt: null },
        orderBy: { capacity: 'desc' },
        select: { capacity: true, name: true },
      });
      if (largestRoom && largestRoom.capacity > dto.capacity) {
        throw new BadRequestException(
          `Venue capacity cannot be lower than room ${largestRoom.name} (${largestRoom.capacity})`,
        );
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.venue.update({
        where: { id: venue.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
          ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() || null }
            : {}),
          ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl || null } : {}),
        },
        include: venueInclude,
      });
      await this.audit.log(
        {
          organizationId,
          actorId: userId,
          action: AuditAction.VENUE_UPDATED,
          entityType: 'venue',
          entityId: updated.id,
          entityLabel: updated.name,
        },
        tx,
      );
      return updated;
    });
  }

  async remove(organizationId: string, venueId: string, userId: string) {
    await this.requireManager(organizationId, userId);
    const venue = await this.requireVenue(organizationId, venueId);
    const futureBooking = await this.prisma.event.findFirst({
      where: {
        organizationId,
        venueId,
        deletedAt: null,
        status: { not: EventStatus.CANCELLED },
        endsAt: { gt: new Date() },
      },
      select: { id: true, title: true },
    });
    if (futureBooking) {
      throw new ConflictException(
        `Venue cannot be deleted while ${futureBooking.title} is scheduled there`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const deletedAt = new Date();
      await tx.room.updateMany({
        where: { organizationId, venueId, deletedAt: null },
        data: { deletedAt },
      });
      await tx.venue.update({ where: { id: venueId }, data: { deletedAt } });
      await this.audit.log(
        {
          organizationId,
          actorId: userId,
          action: AuditAction.VENUE_DELETED,
          entityType: 'venue',
          entityId: venue.id,
          entityLabel: venue.name,
        },
        tx,
      );
    });
  }

  async createRoom(
    organizationId: string,
    venueId: string,
    userId: string,
    dto: CreateRoomDto,
  ) {
    await this.requireManager(organizationId, userId);
    const venue = await this.requireVenue(organizationId, venueId);
    if (dto.capacity > venue.capacity) {
      throw new BadRequestException('Room capacity cannot exceed venue capacity');
    }
    await this.ensureRoomNameAvailable(organizationId, venueId, dto.name);
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.create({
        data: {
          organizationId,
          venueId,
          name: dto.name.trim(),
          capacity: dto.capacity,
          floor: dto.floor?.trim() || null,
          equipment: this.cleanEquipment(dto.equipment),
          availabilityType:
            dto.availabilityType ?? RoomAvailabilityType.PER_EVENT,
        },
      });
      await this.audit.log(
        {
          organizationId,
          actorId: userId,
          action: AuditAction.ROOM_CREATED,
          entityType: 'room',
          entityId: room.id,
          entityLabel: room.name,
          metadata: { venueId, venueName: venue.name },
        },
        tx,
      );
      return room;
    });
  }

  async updateRoom(
    organizationId: string,
    venueId: string,
    roomId: string,
    userId: string,
    dto: UpdateRoomDto,
  ) {
    await this.requireManager(organizationId, userId);
    const [venue, room] = await Promise.all([
      this.requireVenue(organizationId, venueId),
      this.requireRoom(organizationId, venueId, roomId),
    ]);
    if (dto.capacity !== undefined && dto.capacity > venue.capacity) {
      throw new BadRequestException('Room capacity cannot exceed venue capacity');
    }
    if (dto.capacity !== undefined) {
      const oversizedEvent = await this.prisma.event.findFirst({
        where: {
          organizationId,
          roomId,
          deletedAt: null,
          status: { not: EventStatus.CANCELLED },
          endsAt: { gt: new Date() },
          capacity: { gt: dto.capacity },
        },
        select: { title: true, capacity: true },
      });
      if (oversizedEvent) {
        throw new BadRequestException(
          `Capacity cannot be lower than ${oversizedEvent.title} (${oversizedEvent.capacity})`,
        );
      }
    }
    if (dto.name && dto.name.trim().toLowerCase() !== room.name.toLowerCase()) {
      await this.ensureRoomNameAvailable(
        organizationId,
        venueId,
        dto.name,
        roomId,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.room.update({
        where: { id: roomId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
          ...(dto.floor !== undefined ? { floor: dto.floor.trim() || null } : {}),
          ...(dto.equipment !== undefined
            ? { equipment: this.cleanEquipment(dto.equipment) }
            : {}),
          ...(dto.availabilityType !== undefined
            ? { availabilityType: dto.availabilityType }
            : {}),
        },
      });
      await this.audit.log(
        {
          organizationId,
          actorId: userId,
          action: AuditAction.ROOM_UPDATED,
          entityType: 'room',
          entityId: updated.id,
          entityLabel: updated.name,
          metadata: { venueId, venueName: venue.name },
        },
        tx,
      );
      return updated;
    });
  }

  async removeRoom(
    organizationId: string,
    venueId: string,
    roomId: string,
    userId: string,
  ) {
    await this.requireManager(organizationId, userId);
    const room = await this.requireRoom(organizationId, venueId, roomId);
    const futureBooking = await this.prisma.event.findFirst({
      where: {
        organizationId,
        roomId,
        deletedAt: null,
        status: { not: EventStatus.CANCELLED },
        endsAt: { gt: new Date() },
      },
      select: { title: true },
    });
    if (futureBooking) {
      throw new ConflictException(
        `Room cannot be deleted while ${futureBooking.title} is scheduled there`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.room.update({ where: { id: roomId }, data: { deletedAt: new Date() } });
      await this.audit.log(
        {
          organizationId,
          actorId: userId,
          action: AuditAction.ROOM_DELETED,
          entityType: 'room',
          entityId: room.id,
          entityLabel: room.name,
          metadata: { venueId },
        },
        tx,
      );
    });
  }

  async availability(
    organizationId: string,
    userId: string,
    query: AvailabilityQueryDto,
  ) {
    await this.requireManager(organizationId, userId);
    if (query.to <= query.from) {
      throw new BadRequestException('to must be after from');
    }
    if (query.to.getTime() - query.from.getTime() > 366 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('Availability range cannot exceed 366 days');
    }
    const rooms = await this.prisma.room.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(query.venueId ? { venueId: query.venueId } : {}),
        ...(query.roomId ? { id: query.roomId } : {}),
        venue: { deletedAt: null },
      },
      orderBy: [{ venue: { name: 'asc' } }, { name: 'asc' }],
      include: {
        venue: { select: { id: true, name: true } },
        events: {
          where: {
            organizationId,
            deletedAt: null,
            status: { not: EventStatus.CANCELLED },
            startsAt: { lt: query.to },
            endsAt: { gt: query.from },
          },
          orderBy: { startsAt: 'asc' },
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            status: true,
          },
        },
      },
    });
    return {
      from: query.from,
      to: query.to,
      rooms: rooms.map(({ events, venue, ...room }) => ({
        ...room,
        venueId: venue.id,
        venueName: venue.name,
        bookings: events.map((event) => ({
          eventId: event.id,
          title: event.title,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          status: event.status,
        })),
      })),
    };
  }

  async validateAndLockRoom(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      venueId: string;
      roomId: string;
      startsAt: Date;
      endsAt: Date;
      capacity: number;
      excludeEventId?: string;
    },
  ) {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "rooms"
      WHERE "id" = ${input.roomId}::uuid
        AND "organization_id" = ${input.organizationId}::uuid
        AND "venue_id" = ${input.venueId}::uuid
        AND "deleted_at" IS NULL
      FOR UPDATE
    `);
    if (!locked.length) {
      throw new BadRequestException(
        'Selected room does not belong to this organization and venue',
      );
    }
    const room = await tx.room.findUniqueOrThrow({
      where: { id: input.roomId },
      include: { venue: { select: { id: true, name: true, address: true } } },
    });
    const venue = await tx.venue.findFirst({
      where: {
        id: input.venueId,
        organizationId: input.organizationId,
        deletedAt: null,
      },
      select: { id: true, name: true, address: true },
    });
    if (!venue) throw new BadRequestException('Selected venue is unavailable');
    if (room.capacity < input.capacity) {
      throw new BadRequestException(
        `Event capacity exceeds ${room.name} capacity of ${room.capacity}`,
      );
    }
    const conflict = await tx.event.findFirst({
      where: {
        organizationId: input.organizationId,
        roomId: input.roomId,
        deletedAt: null,
        status: { not: EventStatus.CANCELLED },
        startsAt: { lt: input.endsAt },
        endsAt: { gt: input.startsAt },
        ...(input.excludeEventId ? { id: { not: input.excludeEventId } } : {}),
      },
      select: { id: true, title: true, startsAt: true, endsAt: true },
    });
    if (conflict) {
      throw new ConflictException({
        code: 'ROOM_BOOKING_CONFLICT',
        message: 'Room is already booked for an overlapping event',
        details: {
          roomId: room.id,
          roomName: room.name,
          conflictingEvent: conflict,
        },
      });
    }
    return { room, venue };
  }

  private async requireManager(organizationId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    if (
      membership?.role !== OrgRole.ORG_ADMIN &&
      membership?.role !== OrgRole.ORGANIZER
    ) {
      throw new ForbiddenException('Venue management access is required');
    }
    return membership;
  }

  private async requireVenue(organizationId: string, venueId: string) {
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, organizationId, deletedAt: null },
    });
    if (!venue) throw new NotFoundException('Venue not found');
    return venue;
  }

  private async requireRoom(
    organizationId: string,
    venueId: string,
    roomId: string,
  ) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, venueId, organizationId, deletedAt: null },
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  private async ensureRoomNameAvailable(
    organizationId: string,
    venueId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.room.findFirst({
      where: {
        organizationId,
        venueId,
        deletedAt: null,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A room with this name already exists in the venue');
    }
  }

  private cleanEquipment(equipment: string[]) {
    return [
      ...new Set(equipment.map((item) => item.trim()).filter(Boolean)),
    ];
  }
}
