"use client";

import { useParams } from "next/navigation";
import { AvailabilityCalendar } from "@/components/dashboard/availability-calendar";
import { LoadingBlock } from "@/components/ui/status";
import { useOrg } from "@/hooks/useOrg";

export default function VenueAvailabilityPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organizationId } = useOrg(orgSlug);

  if (!organizationId) return <LoadingBlock label="Preparing the room calendar…" />;

  return <AvailabilityCalendar organizationId={organizationId} orgSlug={orgSlug} />;
}
