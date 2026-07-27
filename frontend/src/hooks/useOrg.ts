"use client";

import { useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";

export function useOrg(orgSlug?: string) {
  const auth = useAuth();
  const membership = useMemo(
    () =>
      orgSlug
        ? auth.user?.memberships.find(
            (item) => item.organization.slug === orgSlug
          ) ?? null
        : auth.selectedMembership,
    [auth.selectedMembership, auth.user?.memberships, orgSlug]
  );

  useEffect(() => {
    if (
      membership &&
      auth.selectedMembership?.organizationId !== membership.organizationId
    ) {
      auth.setSelectedOrganization(membership.organizationId);
    }
  }, [auth, membership]);

  return {
    organization: membership?.organization ?? null,
    organizationId: membership?.organizationId ?? null,
    role: membership?.role ?? null,
    membership,
    loading: auth.loading,
    canManage: membership?.role === "ORG_ADMIN" || membership?.role === "ORGANIZER",
    isAdmin: membership?.role === "ORG_ADMIN"
  };
}
