"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { eventsApi } from "@/lib/api-client";
import type { EventDetail } from "@/types";
import { useOrg } from "@/hooks/useOrg";
import { CheckInScanner } from "@/components/dashboard/check-in-scanner";
import { ErrorState, LoadingBlock } from "@/components/ui/status";
import { formatShortDate, locationLabel } from "@/lib/utils";

export default function EventCheckInPage() {
  const { orgSlug, eventId } = useParams<{ orgSlug: string; eventId: string }>();
  const { organizationId } = useOrg(orgSlug);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      setEvent(await eventsApi.get(organizationId, eventId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Event could not load.");
    } finally {
      setLoading(false);
    }
  }, [eventId, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !organizationId) return <LoadingBlock label="Preparing the door…" />;
  if (!event) {
    return (
      <ErrorState
        title="Check-in is unavailable"
        message={error}
        onRetry={() => void load()}
      />
    );
  }

  const eventBase = `/org/${encodeURIComponent(orgSlug)}/events/${encodeURIComponent(eventId)}`;

  return (
    <div className="animate-fade-up">
      <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <Link
            href={`${eventBase}/registrations`}
            className="inline-flex items-center gap-2 text-[10px] font-bold text-ink/40 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Guest list
          </Link>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[.12em] text-blue-700">
            Mobile door station
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.035em] text-slate-950">{event.title}</h2>
          <p className="mt-3 text-sm text-ink/48">
            {formatShortDate(event.startsAt, event.timezone)} · {locationLabel(event)}
          </p>
        </div>
        <Link
          href={`${eventBase}/registrations`}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Users className="h-3.5 w-3.5" />
          View guest list
        </Link>
      </div>
      <CheckInScanner event={event} organizationId={organizationId} />
    </div>
  );
}
