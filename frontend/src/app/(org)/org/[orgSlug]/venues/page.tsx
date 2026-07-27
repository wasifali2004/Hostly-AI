"use client";

import { useParams } from "next/navigation";
import { VenueManagement } from "@/components/dashboard/venue-management";
import { LoadingBlock } from "@/components/ui/status";
import { useOrg } from "@/hooks/useOrg";

export default function OrganizationVenuesPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organizationId } = useOrg(orgSlug);

  if (!organizationId) return <LoadingBlock label="Preparing space operations…" />;

  return <VenueManagement organizationId={organizationId} orgSlug={orgSlug} />;
}
