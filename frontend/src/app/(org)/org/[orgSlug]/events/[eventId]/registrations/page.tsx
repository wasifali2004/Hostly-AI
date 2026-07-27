"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  DoorOpen,
  Mail,
  Search,
  TicketCheck,
  Users
} from "lucide-react";
import { eventsApi, registrationsApi } from "@/lib/api-client";
import type { EventDetail, Registration } from "@/types";
import { useOrg } from "@/hooks/useOrg";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState, LoadingBlock } from "@/components/ui/status";
import { formatShortDate, percent } from "@/lib/utils";

export default function EventRegistrationsPage() {
  const { orgSlug, eventId } = useParams<{ orgSlug: string; eventId: string }>();
  const { organizationId } = useOrg(orgSlug);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      const [eventData, registrationData] = await Promise.all([
        eventsApi.get(organizationId, eventId),
        registrationsApi.forEvent(organizationId, eventId)
      ]);
      setEvent(eventData);
      setRegistrations(registrationData);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Registrations could not load."
      );
    } finally {
      setLoading(false);
    }
  }, [eventId, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return registrations;
    return registrations.filter(
      (registration) =>
        registration.attendeeName.toLowerCase().includes(needle) ||
        registration.attendeeEmail.toLowerCase().includes(needle) ||
        registration.checkInCode.toLowerCase().includes(needle) ||
        registration.ticketTier.name.toLowerCase().includes(needle)
    );
  }, [query, registrations]);

  if (loading || !organizationId) return <LoadingBlock label="Loading the guest list…" />;
  if (!event) {
    return (
      <ErrorState
        title="The guest list is unavailable"
        message={error}
        onRetry={() => void load()}
      />
    );
  }

  const active = registrations.filter((item) => item.status !== "CANCELLED");
  const checkedIn = registrations.filter((item) => item.status === "CHECKED_IN").length;
  const base = `/org/${encodeURIComponent(orgSlug)}/events`;

  return (
    <div className="animate-reveal">
      <section className="flex flex-col justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7 lg:flex-row lg:items-end">
        <div>
          <Link
            href={base}
            className="inline-flex items-center gap-2 text-[10px] font-bold text-ink/40 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All events
          </Link>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[.12em] text-blue-700">
            Guest operations
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.04em] text-slate-950 sm:text-4xl">{event.title}</h2>
          <p className="mt-3 text-sm text-ink/48">
            {formatShortDate(event.startsAt, event.timezone)} · {active.length} active registrations
          </p>
        </div>
        <ButtonLink href={`${base}/${eventId}/checkin`} variant="coral">
          <DoorOpen className="h-4 w-4" />
          Open check-in
        </ButtonLink>
      </section>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          [Users, "Registered", active.length, "bg-blue-50 text-blue-700"],
          [CheckCircle2, "Checked in", checkedIn, "bg-emerald-50 text-emerald-700"],
          [
            TicketCheck,
            "Arrival rate",
            `${percent(checkedIn, active.length)}%`,
            "bg-indigo-50 text-indigo-700"
          ]
        ].map(([Icon, label, value, tone]) => {
          const StatIcon = Icon as typeof Users;
          return (
            <Card key={String(label)} className="interactive-card relative overflow-hidden p-5">
              <span className={`absolute inset-x-0 top-0 h-0.5 ${String(tone).includes("blue") ? "bg-blue-600" : String(tone).includes("emerald") ? "bg-emerald-500" : "bg-indigo-500"}`} />
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${String(tone)}`}>
                <StatIcon className="h-4 w-4" />
              </span>
              <p className="mt-5 text-3xl font-semibold tracking-[-.04em] text-slate-950">{String(value)}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[.14em] text-ink/35">
                {String(label)}
              </p>
            </Card>
          );
        })}
      </div>

      {error ? (
        <div className="mt-5">
          <ErrorState title="Guest list refresh failed" message={error} onRetry={() => void load()} />
        </div>
      ) : null}

      <Card className="mt-5 overflow-hidden">
        <CardHeader
          eyebrow="Event roster"
          title={`${registrations.length} records`}
          action={
            <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
              <Search className="h-3.5 w-3.5 text-ink/30" />
              <span className="sr-only">Search registrations</span>
              <input
                value={query}
                onChange={(input) => setQuery(input.target.value)}
                placeholder="Name, email, code"
                className="w-36 bg-transparent text-[10px] outline-none sm:w-52"
              />
            </label>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left">
            <thead className="border-b border-ink/10 bg-ink/[.025] text-[9px] font-bold uppercase tracking-[.13em] text-ink/35">
              <tr>
                <th className="px-5 py-3">Attendee</th>
                <th className="px-5 py-3">Ticket tier</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Registered</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {visible.length ? (
                visible.map((registration) => (
                  <tr key={registration.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{registration.attendeeName}</p>
                      <a
                        href={`mailto:${registration.attendeeEmail}`}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-ink/38 hover:text-coral"
                      >
                        <Mail className="h-3 w-3" />
                        {registration.attendeeEmail}
                      </a>
                    </td>
                    <td className="px-5 py-4 font-semibold">{registration.ticketTier.name}</td>
                    <td className="px-5 py-4 font-mono text-[10px] font-bold">
                      {registration.checkInCode}
                    </td>
                    <td className="px-5 py-4 text-ink/50">
                      {new Intl.DateTimeFormat("en", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit"
                      }).format(new Date(registration.createdAt))}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-md px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.1em] ${
                          registration.status === "CHECKED_IN"
                            ? "bg-emerald-100 text-emerald-700"
                            : registration.status === "CANCELLED"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {registration.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-sm text-ink/42">
                    {query ? "No registration matches that search." : "No one has registered yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
