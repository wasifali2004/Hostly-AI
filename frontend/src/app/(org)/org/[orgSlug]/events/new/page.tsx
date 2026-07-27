"use client";

import { useParams } from "next/navigation";
import { EventForm } from "@/components/dashboard/event-form";
import { LoadingBlock } from "@/components/ui/status";
import { useOrg } from "@/hooks/useOrg";

export default function NewOrganizationEventPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organizationId } = useOrg(orgSlug);

  if (!organizationId) return <LoadingBlock label="Preparing the event builder…" />;

  return (
    <EventForm
      organizationId={organizationId}
      orgSlug={orgSlug}
    />
  );
}
