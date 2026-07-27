"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CalendarPlus,
  CircleGauge,
  DoorOpen,
  MapPinned,
  MoreHorizontal,
  Sparkles,
  TicketCheck,
  TrendingUp,
  Users
} from "lucide-react";
import { analyticsApi, eventsApi } from "@/lib/api-client";
import type { AnalyticsOverview, EventSummary } from "@/types";
import { useOrg } from "@/hooks/useOrg";
import { RegistrationChart } from "@/components/dashboard/analytics-chart";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState, LoadingBlock } from "@/components/ui/status";
import { formatShortDate, percent } from "@/lib/utils";

const stats = [
  {
    key: "totalRegistrations",
    label: "Attendees",
    helper: "Confirmed across every event",
    icon: TicketCheck,
    tone: "bg-lavender text-ink",
    accent: "bg-lavender"
  },
  {
    key: "revenue",
    label: "Revenue",
    helper: "Payments not connected yet",
    icon: TrendingUp,
    tone: "bg-butter text-ink",
    accent: "bg-butter"
  },
  {
    key: "upcomingEvents",
    label: "Upcoming events",
    helper: "Currently on the calendar",
    icon: CalendarClock,
    tone: "bg-emerald-100 text-emerald-800",
    accent: "bg-emerald-500"
  },
  {
    key: "checkInRate",
    label: "Check-in rate",
    helper: "Attendance conversion",
    icon: CircleGauge,
    tone: "bg-indigo-50 text-indigo-700",
    accent: "bg-indigo-500"
  }
] as const;

export default function OrganizationDashboardPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organizationId, organization } = useOrg(orgSlug);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      const [overview, eventPage] = await Promise.all([
        analyticsApi.overview(organizationId),
        eventsApi.list(organizationId, { page: 1, pageSize: 5 })
      ]);
      setAnalytics(overview);
      setEvents(eventPage.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const operationalInsight = useMemo(() => {
    if (!analytics?.events.length) return "Create your first event to begin building operational insight.";
    const lowestFill = [...analytics.events]
      .filter((event) => event.capacity > 0)
      .sort(
        (left, right) =>
          (left.fillRate ?? percent(left.registrations, left.capacity)) -
          (right.fillRate ?? percent(right.registrations, right.capacity))
      )[0];
    if (!lowestFill) return "Your current event program is ready for registrations.";
    return `${lowestFill.title} is at ${lowestFill.fillRate ?? percent(lowestFill.registrations, lowestFill.capacity)}% capacity and has the most room to grow.`;
  }, [analytics]);

  if (loading || !organizationId) return <LoadingBlock label="Calculating your overview…" />;
  if (!analytics) {
    return (
      <ErrorState
        title="The workspace overview is unavailable"
        message={error}
        onRetry={() => void load()}
      />
    );
  }

  const base = `/org/${encodeURIComponent(orgSlug)}`;

  return (
    <div className="animate-reveal">
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-card">
        <div className="metric-grid grid gap-8 p-6 sm:p-8 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-blue-300">
              Operations command center
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.04em] sm:text-4xl">
              Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {organization?.name}.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
              Your live view of event demand, attendance, spaces, and the next actions that need attention.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`${base}/venues/availability`} variant="inverse" size="sm">
              <MapPinned className="h-3.5 w-3.5" />
              Room calendar
            </ButtonLink>
            <ButtonLink href={`${base}/events/new`} variant="coral" size="sm">
              <CalendarPlus className="h-3.5 w-3.5" />
              Create event
            </ButtonLink>
          </div>
        </div>
        <div className="grid border-t border-white/10 sm:grid-cols-3 sm:divide-x sm:divide-white/10">
          {[
            ["Next 30 days", `${analytics.summary.upcomingEvents} live dates`],
            ["Current audience", `${analytics.summary.totalRegistrations} registrations`],
            ["Arrival performance", `${analytics.summary.checkInRate}% checked in`]
          ].map(([label, value]) => (
            <div key={label} className="border-b border-white/10 px-6 py-4 last:border-b-0 sm:border-b-0 sm:px-8">
              <p className="text-[9px] font-semibold uppercase tracking-[.13em] text-white/30">{label}</p>
              <p className="mt-1.5 text-xs font-semibold text-white/80">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ key, label, helper, icon: Icon, tone, accent }) => {
          const value = analytics.summary[key];
          return (
            <Card key={key} className="interactive-card relative overflow-hidden p-5">
              <span className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold text-slate-600">{label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-.045em] text-slate-950">
                    {value}{key === "checkInRate" ? "%" : ""}
                  </p>
                </div>
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-4 text-[10px] text-slate-400">{helper}</p>
            </Card>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden">
          <CardHeader
            eyebrow="Last 14 days"
            title="Registration momentum"
            action={
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-[9px] font-semibold text-emerald-700">
                <TrendingUp className="h-3 w-3" /> Live data
              </span>
            }
          />
          <div className="h-80 p-4 sm:p-6">
            <RegistrationChart data={analytics.registrationTrend} />
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <CardHeader
              eyebrow="Operational focus"
              title="What needs attention"
              action={<Sparkles className="h-4 w-4 text-blue-600" />}
            />
            <div className="p-5">
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                <p className="text-xs font-semibold leading-5 text-slate-900">{operationalInsight}</p>
                <p className="mt-2 text-[10px] leading-5 text-slate-500">
                  Based only on your current workspace analytics.
                </p>
              </div>
              <Link href={`${base}/events`} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-blue-700">
                Review event performance <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-slate-400">Quick actions</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                [CalendarPlus, "New event", `${base}/events/new`],
                [Building2, "Add venue", `${base}/venues`],
                [Users, "Manage team", `${base}/members`],
                [DoorOpen, "Open check-in", `${base}/events`]
              ].map(([Icon, label, href]) => {
                const ActionIcon = Icon as typeof CalendarPlus;
                return (
                  <Link key={String(label)} href={String(href)} className="interactive-card rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] font-semibold text-slate-700">
                    <ActionIcon className="mb-3 h-4 w-4 text-blue-600" />
                    {String(label)}
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[.78fr_1.22fr]">
        <Card className="overflow-hidden">
          <CardHeader
            eyebrow="Calendar"
            title="Next on the schedule"
            action={<Link href={`${base}/events`} className="text-[10px] font-semibold text-blue-700">View all</Link>}
          />
          <div className="divide-y divide-slate-200/80">
            {events.length ? (
              events.map((event) => (
                <Link
                  key={event.id}
                  href={`${base}/events/${event.id}/registrations`}
                  className="group grid grid-cols-[3.2rem_1fr_auto] items-center gap-3 p-4 transition-colors hover:bg-slate-50"
                >
                  <span className="grid h-12 place-items-center rounded-lg border border-slate-200 bg-white text-center">
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-blue-700">
                      {new Intl.DateTimeFormat("en", { month: "short", timeZone: event.timezone }).format(new Date(event.startsAt))}
                    </span>
                    <span className="-mt-3 block text-lg font-semibold text-slate-950">
                      {new Intl.DateTimeFormat("en", { day: "numeric", timeZone: event.timezone }).format(new Date(event.startsAt))}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-slate-900">{event.title}</span>
                    <span className="mt-1 block truncate text-[9px] text-slate-400">{event.category} · {event.status.toLowerCase()}</span>
                  </span>
                  <ChevronMetric value={`${event.registeredCount}/${event.capacity}`} />
                </Link>
              ))
            ) : (
              <div className="p-6">
                <p className="text-sm leading-6 text-slate-500">Your event calendar is ready for its first date.</p>
                <ButtonLink href={`${base}/events/new`} variant="secondary" size="sm" className="mt-4">Create event</ButtonLink>
              </div>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader eyebrow="Event comparison" title="Capacity and attendance" />
          {analytics.events.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-[9px] font-semibold uppercase tracking-[.1em] text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Event</th>
                    <th className="px-5 py-3.5">Registered</th>
                    <th className="px-5 py-3.5">Capacity fill</th>
                    <th className="px-5 py-3.5">Checked in</th>
                    <th className="px-5 py-3.5" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 text-xs">
                  {analytics.events.map((event) => {
                    const fill = event.fillRate ?? percent(event.registrations, event.capacity);
                    return (
                      <tr key={event.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-5 py-4">
                          <p className="max-w-[14rem] truncate font-semibold text-slate-900">{event.title}</p>
                          <p className="mt-1 text-[9px] text-slate-400">{formatShortDate(event.startsAt)}</p>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-700">{event.registrations}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-blue-600" style={{ width: `${fill}%` }} />
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500">{fill}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {event.checkedIn}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link href={`${base}/events/${event.id}/registrations`} className="inline-grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label={`Open ${event.title}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-6 text-sm text-slate-500">Performance appears here after you publish an event.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function ChevronMetric({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[9px] font-semibold text-slate-400">
      {value}
      <ArrowRight className="h-3.5 w-3.5 transition-colors group-hover:text-blue-600" />
    </span>
  );
}
