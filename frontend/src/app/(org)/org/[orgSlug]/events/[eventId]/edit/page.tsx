"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { eventsApi } from "@/lib/api-client";
import type { EventDetail } from "@/types";
import { useOrg } from "@/hooks/useOrg";
import { EventForm } from "@/components/dashboard/event-form";
import { ErrorState, LoadingBlock } from "@/components/ui/status";

export default function EditOrganizationEventPage() {
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

  if (loading || !organizationId) return <LoadingBlock label="Opening the event…" />;
  if (!event) {
    return (
      <ErrorState title="This event is unavailable" message={error} onRetry={() => void load()} />
    );
  }

  return (
    <EventForm
      event={event}
      organizationId={organizationId}
      orgSlug={orgSlug}
    />
  );
}
