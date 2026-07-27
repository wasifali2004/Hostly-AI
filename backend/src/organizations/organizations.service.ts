import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  EventStatus,
  InvitationStatus,
  OrgRole,
  Prisma,
  RegistrationStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { uniqueSlug } from '../common/utils/slug';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    return this.prisma.organization.create({
      data: {
        name: dto.name.trim(),
        slug: uniqueSlug(dto.name, 120),
        description: dto.description?.trim(),
        createdById: userId,
        memberships: { create: { userId, role: OrgRole.ORG_ADMIN } },
      },
      include: {
        memberships: { where: { userId }, select: { role: true } },
        _count: { select: { events: true, memberships: true } },
      },
    });
  }

  async findAll(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        organization: {
          include: { _count: { select: { events: true, memberships: true } } },
        },
      },
    });
    return {
      items: memberships.map(({ organization, role }) => ({
        ...organization,
        currentRole: role,
      })),
    };
  }

  async findOne(organizationId: string, userId: string) {
    const membership = await this.requireMembership(organizationId, userId);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { _count: { select: { events: true, memberships: true } } },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return { ...organization, currentRole: membership.role };
  }

  async findOneBySlug(slug: string, userId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { slug: slug.trim().toLowerCase() },
      include: { _count: { select: { events: true, memberships: true } } },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    const membership = await this.requireMembership(organization.id, userId);
    return { ...organization, currentRole: membership.role };
  }

  async findPublicBySlug(slug: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { slug: slug.trim().toLowerCase() },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        createdAt: true,
        events: {
          where: {
            status: EventStatus.PUBLISHED,
            deletedAt: null,
          },
          orderBy: [{ startsAt: 'asc' }, { publishedAt: 'desc' }],
          select: {
            id: true,
            slug: true,
            title: true,
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
            country: true,
            capacity: true,
            coverImageUrl: true,
            category: true,
            tags: true,
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
            organizer: { select: { id: true, name: true } },
            ticketTiers: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                name: true,
                description: true,
                capacity: true,
                priceCents: true,
                currency: true,
                registrations: { select: { status: true } },
              },
            },
            registrations: { select: { status: true } },
          },
        },
      },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    const { events, ...publicOrganization } = organization;
    const publicEvents = events.map((event) => {
        const registeredCount = event.registrations.filter(
          ({ status }) => status !== RegistrationStatus.CANCELLED,
        ).length;
        const { registrations: _registrations, locationType, addressLine1, ...rest } =
          event;
        return {
          ...rest,
          organization: {
            id: publicOrganization.id,
            name: publicOrganization.name,
            slug: publicOrganization.slug,
            description: publicOrganization.description,
            logoUrl: publicOrganization.logoUrl,
          },
          excerpt:
            event.description.length > 170
              ? `${event.description.slice(0, 167)}…`
              : event.description,
          venueType: locationType,
          locationType,
          address: addressLine1,
          addressLine1,
          registeredCount,
          checkedInCount: event.registrations.filter(
            ({ status }) => status === RegistrationStatus.CHECKED_IN,
          ).length,
          capacity:
            event.capacity ??
            event.ticketTiers.reduce((sum, tier) => sum + tier.capacity, 0),
          ticketTiers: event.ticketTiers.map(
            ({ registrations, ...tier }) => {
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
            },
          ),
        };
      });
    return {
      organization: publicOrganization,
      events: publicEvents,
      totalEvents: publicEvents.length,
    };
  }

  async update(
    organizationId: string,
    actingUserId: string,
    dto: UpdateOrganizationDto,
  ) {
    await this.requireRole(organizationId, actingUserId, [OrgRole.ORG_ADMIN]);
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
      },
    });
  }

  async members(organizationId: string, userId: string) {
    await this.requireRole(organizationId, userId, [OrgRole.ORG_ADMIN]);
    const items = await this.prisma.membership.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
        },
      },
    });
    return {
      items: items.map(({ createdAt, ...membership }) => ({
        ...membership,
        createdAt,
        joinedAt: createdAt,
      })),
    };
  }

  async addMember(
    organizationId: string,
    actingUserId: string,
    dto: AddMemberDto,
  ) {
    await this.requireRole(organizationId, actingUserId, [OrgRole.ORG_ADMIN]);
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
    });
    if (!user) {
      throw new NotFoundException(
        'No Hostly account exists for this email; send an invitation instead',
      );
    }
    const existing = await this.prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
    });
    if (existing) throw new ConflictException('This person is already a member');
    const membership = await this.prisma.membership.create({
      data: { organizationId, userId: user.id, role: dto.role },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
        },
      },
    });
    return { ...membership, joinedAt: membership.createdAt };
  }

  async invite(
    organizationId: string,
    invitedById: string,
    dto: CreateInvitationDto,
  ) {
    await this.requireRole(organizationId, invitedById, [OrgRole.ORG_ADMIN]);
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      const membership = await this.prisma.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId: existingUser.id } },
      });
      if (membership) throw new ConflictException('This person is already a member');
    }

    await this.prisma.invitation.updateMany({
      where: { organizationId, email, status: InvitationStatus.PENDING },
      data: { status: InvitationStatus.REVOKED },
    });

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId,
        email,
        role: dto.role,
        tokenHash,
        invitedById,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      include: {
        organization: { select: { id: true, name: true } },
        invitedBy: { select: { name: true } },
      },
    });

    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3100').split(',')[0];
    const acceptUrl = `${frontendUrl}/invitations/${token}`;
    await this.notifications.sendOrganizationInvitation({
      to: email,
      organizationName: invitation.organization.name,
      inviterName: invitation.invitedBy.name,
      role: invitation.role,
      acceptUrl,
    });

    const publicInvitation = {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      organization: invitation.organization,
    };
    return {
      ...publicInvitation,
      invitation: publicInvitation,
      ...(this.config.get('NODE_ENV', 'development') !== 'production'
        ? { token, acceptUrl }
        : {}),
    };
  }

  async acceptInvitation(token: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { organization: true },
    });
    if (
      !invitation ||
      invitation.status !== InvitationStatus.PENDING ||
      invitation.expiresAt <= new Date()
    ) {
      throw new NotFoundException('Invitation is invalid or has expired');
    }
    if (invitation.email !== user.email.toLowerCase()) {
      throw new ForbiddenException('Sign in with the email address that was invited');
    }

    await this.prisma.$transaction([
      this.prisma.membership.upsert({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId,
          },
        },
        create: {
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role,
        },
        update: { role: invitation.role },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedById: userId,
        },
      }),
    ]);
    return {
      organization: invitation.organization,
      role: invitation.role,
      accepted: true,
    };
  }

  async updateMember(
    organizationId: string,
    memberId: string,
    actingUserId: string,
    dto: UpdateMemberDto,
  ) {
    await this.requireRole(organizationId, actingUserId, [OrgRole.ORG_ADMIN]);
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockOrganization(tx, organizationId);
      const target = await tx.membership.findFirst({
        where: { id: memberId, organizationId },
      });
      if (!target) throw new NotFoundException('Member not found');
      if (target.role === OrgRole.ORG_ADMIN && dto.role !== OrgRole.ORG_ADMIN) {
        await this.ensureAnotherAdmin(tx, organizationId, target.userId);
      }
      const membership = await tx.membership.update({
        where: { id: memberId },
        data: { role: dto.role },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              createdAt: true,
            },
          },
        },
      });
      if (target.role !== dto.role) {
        await this.audit.log(
          {
            organizationId,
            actorId: actingUserId,
            action: AuditAction.MEMBER_ROLE_CHANGED,
            entityType: 'membership',
            entityId: membership.id,
            entityLabel: membership.user.email,
            metadata: {
              memberUserId: membership.userId,
              previousRole: target.role,
              newRole: dto.role,
            },
          },
          tx,
        );
      }
      return membership;
    });
    return { ...updated, joinedAt: updated.createdAt };
  }

  async removeMember(
    organizationId: string,
    memberId: string,
    actingUserId: string,
  ) {
    await this.requireRole(organizationId, actingUserId, [OrgRole.ORG_ADMIN]);
    await this.prisma.$transaction(async (tx) => {
      await this.lockOrganization(tx, organizationId);
      const target = await tx.membership.findFirst({
        where: { id: memberId, organizationId },
      });
      if (!target) throw new NotFoundException('Member not found');
      if (target.role === OrgRole.ORG_ADMIN) {
        await this.ensureAnotherAdmin(tx, organizationId, target.userId);
      }
      await tx.membership.delete({ where: { id: memberId } });
    });
  }

  private async requireMembership(organizationId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) throw new NotFoundException('Organization not found');
    return membership;
  }

  private async requireRole(
    organizationId: string,
    userId: string,
    roles: OrgRole[],
  ) {
    const membership = await this.requireMembership(organizationId, userId);
    if (!roles.includes(membership.role)) {
      throw new ForbiddenException('You do not have permission in this organization');
    }
    return membership;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async lockOrganization(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ) {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM "organizations"
      WHERE "id" = ${organizationId}::uuid
      FOR UPDATE
    `);
  }

  private async ensureAnotherAdmin(
    tx: Prisma.TransactionClient,
    organizationId: string,
    excludedUserId: string,
  ) {
    const anotherAdmin = await tx.membership.findFirst({
      where: {
        organizationId,
        role: OrgRole.ORG_ADMIN,
        userId: { not: excludedUserId },
      },
      select: { id: true },
    });
    if (!anotherAdmin) {
      throw new ConflictException('The organization must keep at least one admin');
    }
  }
}
