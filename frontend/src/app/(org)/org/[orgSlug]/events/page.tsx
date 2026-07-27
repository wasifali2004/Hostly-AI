"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CalendarDays,
  DoorOpen,
  Edit3,
  Eye,
  EyeOff,
  LayoutGrid,
  ListFilter,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  Users
} from "lucide-react";
import { eventsApi } from "@/lib/api-client";
import type { EventStatus, EventSummary } from "@/types";
import { useOrg } from "@/hooks/useOrg";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/status";
import { EventStatusBadge } from "@/components/dashboard/event-status";
import { formatShortDate, percent } from "@/lib/utils";

const filters: Array<{ label: string; value: "" | EventStatus }> = [
  { label: "All events", value: "" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Drafts", value: "DRAFT" },
  { label: "Cancelled", value: "CANCELLED" }
];

export default function OrganizationEventsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organizationId } = useOrg(orgSlug);
  const toast = useToast();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [status, setStatus] = useState<"" | EventStatus>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [removeTarget, setRemoveTarget] = useState<EventSummary | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      const result = await eventsApi.list(organizationId, {
        status: status || undefined,
        search: search.trim() || undefined,
        page: 1,
        pageSize: 100
      });
      setEvents(result.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Events could not load.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function togglePublish(event: EventSummary) {
    if (!organizationId) return;
    setBusyId(event.id);
    try {
      await eventsApi.publish(organizationId, event.id, event.status !== "PUBLISHED");
      await load();
      toast.success(event.status === "PUBLISHED" ? "Event unpublished" : "Event published", {
        description:
          event.status === "PUBLISHED"
            ? `${event.title} is no longer visible in the public directory.`
            : `${event.title} is now live and open for discovery.`
      });
    } catch (requestError) {
      toast.error("Event status could not change", {
        description: requestError instanceof Error ? requestError.message : "Please try again."
      });
    } finally {
      setBusyId("");
    }
  }

  async function remove() {
    if (!organizationId || !removeTarget) return;
    setBusyId(removeTarget.id);
    try {
      await eventsApi.remove(organizationId, removeTarget.id);
      const removedTitle = removeTarget.title;
      setRemoveTarget(null);
      await load();
      toast.success("Event deleted", { description: `${removedTitle} was removed from this workspace.` });
    } catch (requestError) {
      toast.error("Event could not be deleted", {
        description: requestError instanceof Error ? requestError.message : "Please try again."
      });
    } finally {
      setBusyId("");
    }
  }

  const base = `/org/${encodeURIComponent(orgSlug)}`;
  const totalRegistrations = events.reduce((total, event) => total + event.registeredCount, 0);
  const totalCapacity = events.reduce((total, event) => total + event.capacity, 0);

  return (
    <div className="animate-reveal">
      <section className="flex flex-col justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7 lg:flex-row lg:items-end">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-blue-700">Event portfolio</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.04em] text-slate-950 sm:text-4xl">Events</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
            Create the public experience, watch demand, manage guests, and prepare the door team.
          </p>
        </div>
        <ButtonLink href={`${base}/events/new`} variant="coral">
          <Plus className="h-4 w-4" />
          Create event
        </ButtonLink>
      </section>

      {!loading && !error && events.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            [LayoutGrid, "Events in view", String(events.length), "Across the selected filter"],
            [Users, "Registrations", String(totalRegistrations), "Confirmed audience"],
            [CalendarDays, "Capacity fill", `${percent(totalRegistrations, totalCapacity)}%`, `${totalCapacity} places available`]
          ].map(([Icon, label, value, helper]) => {
            const MetricIcon = Icon as typeof LayoutGrid;
            return (
              <div key={String(label)} className="workspace-panel flex items-center gap-4 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                  <MetricIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[.12em] text-slate-400">{String(label)}</p>
                  <p className="mt-0.5 text-lg font-semibold tracking-tight text-slate-950">{String(value)}</p>
                  <p className="truncate text-[9px] text-slate-400">{String(helper)}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <section className="workspace-panel mt-4 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:flex-row sm:items-center">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-lg bg-slate-50 px-3 ring-1 ring-inset ring-slate-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
            <Search className="h-4 w-4 text-slate-400" />
            <span className="sr-only">Search workspace events</span>
            <input
              value={search}
              onChange={(input) => setSearch(input.target.value)}
              placeholder="Search title, category, or venue"
              className="w-full bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
          <div className="flex items-center gap-1 overflow-x-auto">
            <ListFilter className="mx-2 hidden h-4 w-4 text-slate-400 sm:block" />
            {filters.map((filter) => (
              <Button
                key={filter.label}
                size="sm"
                variant={status === filter.value ? "primary" : "ghost"}
                onClick={() => setStatus(filter.value)}
                className="h-9 shrink-0 px-3 text-[10px]"
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="p-5">
            <ErrorState title="Event operations paused" message={error} onRetry={() => void load()} />
          </div>
        ) : loading ? (
          <div className="p-5"><LoadingBlock label="Loading workspace events…" /></div>
        ) : events.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={search || status ? "No events match this view" : "Create the first event"}
              message={search || status ? "Try another search or status." : "Your event calendar begins with a title, time, place, and ticket tier."}
              action={!search && !status ? <ButtonLink href={`${base}/events/new`} variant="coral" size="sm">Create event</ButtonLink> : undefined}
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-200/80">
            {events.map((event) => {
              const busy = busyId === event.id;
              const fill = percent(event.registeredCount, event.capacity);
              return (
                <article
                  key={event.id}
                  className={`group grid gap-4 p-4 transition-colors hover:bg-slate-50/70 sm:p-5 lg:grid-cols-[8rem_minmax(0,1fr)_12rem_auto] lg:items-center ${busy ? "pointer-events-none opacity-55" : ""}`}
                >
                  <Link href={`${base}/events/${event.id}/registrations`} className="relative aspect-[16/10] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    {event.coverImageUrl ? (
                      <Image src={event.coverImageUrl} alt="" fill sizes="160px" className="object-cover transition-transform duration-500 group-hover:scale-[1.025]" />
                    ) : (
                      <div className="paper-grid absolute inset-0" />
                    )}
                    <span className="absolute bottom-2 left-2 rounded-md bg-slate-950/80 px-2 py-1 text-[8px] font-semibold text-white backdrop-blur">
                      {event.category}
                    </span>
                  </Link>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <EventStatusBadge status={event.status} />
                      <span className="text-[9px] text-slate-400">{formatShortDate(event.startsAt, event.timezone)}</span>
                    </div>
                    <Link href={`${base}/events/${event.id}/registrations`} className="mt-2 block truncate font-display text-lg font-semibold tracking-[-.02em] text-slate-950 hover:text-blue-700">
                      {event.title}
                    </Link>
                    <p className="mt-1 truncate text-[10px] text-slate-400">
                      {event.venue?.name || event.venueName || (event.venueType === "VIRTUAL" ? "Virtual event" : "Venue not assigned")}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-end justify-between gap-3">
                      <span className="text-[9px] font-medium text-slate-400">Registration fill</span>
                      <span className="text-xs font-semibold text-slate-700">{fill}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${fill}%` }} />
                    </div>
                    <p className="mt-1.5 text-[9px] text-slate-400">{event.registeredCount} of {event.capacity} reserved</p>
                  </div>

                  <div className="flex items-center gap-1 lg:justify-end">
                    <ActionLink href={`${base}/events/${event.id}/registrations`} label={`Registrations for ${event.title}`}><Users className="h-4 w-4" /></ActionLink>
                    <ActionLink href={`${base}/events/${event.id}/checkin`} label={`Open check-in for ${event.title}`}><DoorOpen className="h-4 w-4" /></ActionLink>
                    <ActionLink href={`${base}/events/${event.id}/edit`} label={`Edit ${event.title}`}><Edit3 className="h-4 w-4" /></ActionLink>
                    <Button type="button" size="icon" variant="ghost" onClick={() => void togglePublish(event)} aria-label={event.status === "PUBLISHED" ? "Unpublish event" : "Publish event"}>
                      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : event.status === "PUBLISHED" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setRemoveTarget(event)} className="text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${event.title}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove this event?"
        description={removeTarget ? `${removeTarget.title} will leave the workspace calendar and its public page will no longer be available.` : undefined}
        confirmLabel="Delete event"
        cancelLabel="Keep event"
        destructive
        loading={Boolean(busyId)}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
        onConfirm={remove}
      />
    </div>
  );
}

function ActionLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900" aria-label={label} title={label}>
      {children}
    </Link>
  );
}
