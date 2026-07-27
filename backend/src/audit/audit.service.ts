import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuditAction, OrgRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityQueryDto } from './dto/activity-query.dto';

type AuditClient = Prisma.TransactionClient | PrismaService;

export interface AuditEntry {
  organizationId: string;
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(entry: AuditEntry, client: AuditClient = this.prisma) {
    return client.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        entityLabel: entry.entityLabel ?? null,
        ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
      },
    });
  }

  async findAll(
    organizationId: string,
    userId: string,
    query: ActivityQueryDto,
  ) {
    await this.requireAdmin(organizationId, userId);
    if (query.from && query.to && query.to < query.from) {
      throw new BadRequestException('to must be on or after from');
    }

    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType
        ? { entityType: { equals: query.entityType, mode: 'insensitive' } }
        : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
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

  private async requireAdmin(organizationId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    if (membership?.role !== OrgRole.ORG_ADMIN) {
      throw new ForbiddenException('Organization admin access is required');
    }
  }
}
