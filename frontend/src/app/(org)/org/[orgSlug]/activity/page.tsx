"use client";

import { useParams } from "next/navigation";
import { ActivityLog } from "@/components/dashboard/activity-log";
import { ErrorState, LoadingBlock } from "@/components/ui/status";
import { useOrg } from "@/hooks/useOrg";

export default function OrganizationActivityPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organizationId, isAdmin, loading } = useOrg(orgSlug);

  if (loading) return <LoadingBlock label="Checking admin access…" />;
  if (!isAdmin) {
    return (
      <ErrorState
        title="Admin access is required"
        message="The organization activity log is available only to organization admins."
      />
    );
  }
  if (!organizationId) return <LoadingBlock label="Opening the activity log…" />;

  return <ActivityLog organizationId={organizationId} />;
}
