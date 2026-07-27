import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrgRole, Prisma, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(organizationId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (
      membership?.role !== OrgRole.ORG_ADMIN &&
      membership?.role !== OrgRole.ORGANIZER
    ) {
      throw new ForbiddenException('Management access is required');
    }

    const eventWhere: Prisma.EventWhereInput = {
      organizationId,
      deletedAt: null,
      ...(membership.role === OrgRole.ORGANIZER ? { organizerId: userId } : {}),
    };
    const events = await this.prisma.event.findMany({
      where: eventWhere,
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        status: true,
        capacity: true,
        ticketTiers: { select: { capacity: true } },
        registrations: {
          select: { status: true, createdAt: true },
        },
      },
    });

    const active = events.flatMap(({ registrations }) =>
      registrations.filter(({ status }) => status !== RegistrationStatus.CANCELLED),
    );
    const checkedIn = active.filter(
      ({ status }) => status === RegistrationStatus.CHECKED_IN,
    ).length;
    const now = new Date();

    const trendStart = new Date();
    trendStart.setUTCHours(0, 0, 0, 0);
    trendStart.setUTCDate(trendStart.getUTCDate() - 13);
    const buckets = new Map<string, number>();
    for (let index = 0; index < 14; index += 1) {
      const date = new Date(trendStart);
      date.setUTCDate(date.getUTCDate() + index);
      buckets.set(date.toISOString().slice(0, 10), 0);
    }
    for (const registration of active) {
      const key = registration.createdAt.toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return {
      summary: {
        totalEvents: events.length,
        upcomingEvents: events.filter(({ endsAt }) => endsAt >= now).length,
        totalRegistrations: active.length,
        checkInRate: active.length
          ? Math.round((checkedIn / active.length) * 1000) / 10
          : 0,
      },
      events: events.map((event) => {
        const registrations = event.registrations.filter(
          ({ status }) => status !== RegistrationStatus.CANCELLED,
        ).length;
        const eventCheckedIn = event.registrations.filter(
          ({ status }) => status === RegistrationStatus.CHECKED_IN,
        ).length;
        const capacity =
          event.capacity ??
          event.ticketTiers.reduce((sum, tier) => sum + tier.capacity, 0);
        return {
          id: event.id,
          title: event.title,
          startsAt: event.startsAt,
          status: event.status,
          registrations,
          checkedIn: eventCheckedIn,
          capacity,
          checkInRate: registrations
            ? Math.round((eventCheckedIn / registrations) * 1000) / 10
            : 0,
          fillRate: capacity
            ? Math.round((registrations / capacity) * 1000) / 10
            : 0,
        };
      }),
      registrationTrend: [...buckets.entries()].map(([date, registrations]) => ({
        date: new Date(`${date}T00:00:00.000Z`).toISOString(),
        registrations,
      })),
    };
  }
}
