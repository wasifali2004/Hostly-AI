"use client";

import { useParams } from "next/navigation";
import { ComplianceCenter } from "@/components/dashboard/compliance-center";
import { ErrorState, LoadingBlock } from "@/components/ui/status";
import { useOrg } from "@/hooks/useOrg";

export default function OrganizationCompliancePage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organizationId, isAdmin, loading } = useOrg(orgSlug);

  if (loading) return <LoadingBlock label="Checking admin access…" />;
  if (!isAdmin) {
    return (
      <ErrorState
        title="Admin access is required"
        message="Organization exports and deletion request reviews are available only to admins."
      />
    );
  }
  if (!organizationId) return <LoadingBlock label="Opening the compliance center…" />;

  return <ComplianceCenter organizationId={organizationId} />;
}
