import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataDeletionStatus,
  OrgRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeletionRequestDto } from './dto/create-deletion-request.dto';
import { DeletionRequestsQueryDto } from './dto/deletion-requests-query.dto';
import { ExportFormat } from './dto/export-query.dto';
import { ProcessDeletionRequestDto } from './dto/process-deletion-request.dto';

const deletionRequestInclude =
  Prisma.validator<Prisma.DataDeletionRequestInclude>()({
    requester: { select: { id: true, name: true, email: true } },
    processedBy: { select: { id: true, name: true, email: true } },
  });

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async export(
    organizationId: string,
    userId: string,
    format: ExportFormat,
  ) {
    await this.requireAdmin(organizationId, userId);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        venues: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            address: true,
            capacity: true,
            description: true,
            imageUrl: true,
            deletedAt: true,
            rooms: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                name: true,
                capacity: true,
                floor: true,
                equipment: true,
                availabilityType: true,
                deletedAt: true,
              },
            },
          },
        },
        events: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            status: true,
            startsAt: true,
            endsAt: true,
            timezone: true,
            locationType: true,
            venueId: true,
            roomId: true,
            venueName: true,
            addressLine1: true,
            city: true,
            region: true,
            postalCode: true,
            country: true,
            virtualUrl: true,
            capacity: true,
            category: true,
            tags: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            ticketTiers: {
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                name: true,
                description: true,
                capacity: true,
                priceCents: true,
                currency: true,
                isActive: true,
              },
            },
            registrations: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                ticketTierId: true,
                userId: true,
                attendeeName: true,
                attendeeEmail: true,
                attendeePhone: true,
                status: true,
                checkedInAt: true,
                cancelledAt: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    const exportedAt = new Date().toISOString();
    const filename = `${organization.slug}-data-${exportedAt.slice(0, 10)}.${format}`;
    if (format === ExportFormat.CSV) {
      return {
        filename,
        contentType: 'text/csv; charset=utf-8',
        content: this.toCsv(organization),
      };
    }
    return {
      filename,
      contentType: 'application/json; charset=utf-8',
      content: JSON.stringify({ exportedAt, organization }, null, 2),
    };
  }

  async createDeletionRequest(
    organizationId: string,
    userId: string,
    dto: CreateDeletionRequestDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const [membership, registration] = await Promise.all([
      this.prisma.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
        select: { id: true },
      }),
      this.prisma.registration.findFirst({
        where: {
          organizationId,
          OR: [{ userId }, { attendeeEmail: user.email }],
        },
        select: { id: true },
      }),
    ]);
    if (!membership && !registration) {
      throw new NotFoundException('No data was found for you in this organization');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ locked: number }>>(Prisma.sql`
        SELECT 1::int AS "locked"
        FROM pg_advisory_xact_lock(
          hashtextextended(${`${organizationId}:${userId}`}, 0)
        )
      `);
      const existing = await tx.dataDeletionRequest.findFirst({
        where: {
          organizationId,
          requesterId: userId,
          status: {
            in: [DataDeletionStatus.PENDING, DataDeletionStatus.APPROVED],
          },
        },
        include: deletionRequestInclude,
      });
      if (existing) {
        throw new ConflictException(
          'You already have an active data deletion request for this organization',
        );
      }
      return tx.dataDeletionRequest.create({
        data: {
          organizationId,
          requesterId: userId,
          requesterEmail: user.email,
          reason: dto.reason?.trim() || null,
        },
        include: deletionRequestInclude,
      });
    });
  }

  async mine(organizationId: string, userId: string) {
    const items = await this.prisma.dataDeletionRequest.findMany({
      where: { organizationId, requesterId: userId },
      orderBy: { createdAt: 'desc' },
      include: deletionRequestInclude,
    });
    return { items };
  }

  async deletionRequests(
    organizationId: string,
    userId: string,
    query: DeletionRequestsQueryDto,
  ) {
    await this.requireAdmin(organizationId, userId);
    const where: Prisma.DataDeletionRequestWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dataDeletionRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: deletionRequestInclude,
      }),
      this.prisma.dataDeletionRequest.count({ where }),
    ]);
    return {
      items,
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

  async processDeletionRequest(
    organizationId: string,
    requestId: string,
    userId: string,
    dto: ProcessDeletionRequestDto,
  ) {
    await this.requireAdmin(organizationId, userId);
    const request = await this.prisma.dataDeletionRequest.findFirst({
      where: { id: requestId, organizationId },
    });
    if (!request) throw new NotFoundException('Data deletion request not found');
    if (
      request.status === DataDeletionStatus.REJECTED ||
      request.status === DataDeletionStatus.COMPLETED
    ) {
      throw new ConflictException('This data deletion request is already closed');
    }
    if (
      dto.status === DataDeletionStatus.COMPLETED &&
      request.status !== DataDeletionStatus.APPROVED
    ) {
      throw new ConflictException(
        'Approve the data deletion request before marking it completed',
      );
    }
    return this.prisma.dataDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: dto.status,
        adminNote: dto.adminNote?.trim() || null,
        processedById: userId,
        processedAt: new Date(),
      },
      include: deletionRequestInclude,
    });
  }

  private async requireAdmin(organizationId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    if (membership?.role !== OrgRole.ORG_ADMIN) {
      throw new ForbiddenException('Organization admin access is required');
    }
  }

  private toCsv(organization: {
    id: string;
    name: string;
    events: Array<{
      id: string;
      title: string;
      status: string;
      startsAt: Date;
      endsAt: Date;
      venueId: string | null;
      roomId: string | null;
      registrations: Array<{
        id: string;
        ticketTierId: string;
        userId: string | null;
        attendeeName: string;
        attendeeEmail: string;
        attendeePhone: string | null;
        status: string;
        checkedInAt: Date | null;
        createdAt: Date;
      }>;
    }>;
  }) {
    const headings = [
      'organization_id',
      'organization_name',
      'event_id',
      'event_title',
      'event_status',
      'event_starts_at',
      'event_ends_at',
      'venue_id',
      'room_id',
      'registration_id',
      'ticket_tier_id',
      'user_id',
      'attendee_name',
      'attendee_email',
      'attendee_phone',
      'registration_status',
      'registered_at',
      'checked_in_at',
    ];
    const rows: unknown[][] = [headings];
    for (const event of organization.events) {
      const registrations = event.registrations.length
        ? event.registrations
        : [null];
      for (const registration of registrations) {
        rows.push([
          organization.id,
          organization.name,
          event.id,
          event.title,
          event.status,
          event.startsAt,
          event.endsAt,
          event.venueId,
          event.roomId,
          registration?.id,
          registration?.ticketTierId,
          registration?.userId,
          registration?.attendeeName,
          registration?.attendeeEmail,
          registration?.attendeePhone,
          registration?.status,
          registration?.createdAt,
          registration?.checkedInAt,
        ]);
      }
    }
    return `\uFEFF${rows
      .map((row) => row.map((value) => this.csvCell(value)).join(','))
      .join('\r\n')}\r\n`;
  }

  private csvCell(value: unknown) {
    if (value === null || value === undefined) return '';
    const text = value instanceof Date ? value.toISOString() : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  }
}
