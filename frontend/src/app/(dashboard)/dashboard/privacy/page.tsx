"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  Send,
  ShieldCheck,
  UserRoundX,
  XCircle
} from "lucide-react";
import { complianceApi, registrationsApi } from "@/lib/api-client";
import type { DataDeletionRequest, DeletionRequestStatus } from "@/types";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/form";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";

const statusStyles: Record<
  DeletionRequestStatus,
  { label: string; className: string; icon: typeof Clock3 }
> = {
  PENDING: {
    label: "Pending review",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Clock3
  },
  APPROVED: {
    label: "Approved",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: ShieldCheck
  },
  REJECTED: {
    label: "Rejected",
    className: "border-red-200 bg-red-50 text-red-700",
    icon: XCircle
  },
  COMPLETED: {
    label: "Completed",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2
  }
};

export default function PrivacyRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [registeredOrganizations, setRegisteredOrganizations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const organizations = useMemo(() => {
    const choices = new Map<string, { id: string; name: string }>();
    for (const membership of user?.memberships ?? []) {
      choices.set(membership.organizationId, {
        id: membership.organizationId,
        name: membership.organization.name
      });
    }
    for (const organization of registeredOrganizations) {
      choices.set(organization.id, organization);
    }
    return [...choices.values()].sort((first, second) =>
      first.name.localeCompare(second.name)
    );
  }, [registeredOrganizations, user?.memberships]);
  const [organizationId, setOrganizationId] = useState("");
  const [requests, setRequests] = useState<DataDeletionRequest[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setOrganizationsLoading(authLoading);
      return;
    }
    let active = true;
    setOrganizationsLoading(true);
    registrationsApi
      .mine()
      .then((registrations) => {
        if (!active) return;
        const choices = new Map<string, { id: string; name: string }>();
        for (const registration of registrations) {
          choices.set(registration.event.organization.id, {
            id: registration.event.organization.id,
            name: registration.event.organization.name
          });
        }
        setRegisteredOrganizations([...choices.values()]);
      })
      .catch((requestError) => {
        if (!active) return;
        toast.error("Could not check registered organizations", {
          description:
            requestError instanceof Error
              ? requestError.message
              : "Some privacy options may be unavailable."
        });
      })
      .finally(() => {
        if (active) setOrganizationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authLoading, toast, user]);

  useEffect(() => {
    if (!organizationId && organizations[0]) setOrganizationId(organizations[0].id);
  }, [organizationId, organizations]);

  const load = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setRequests(await complianceApi.mine(organizationId));
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Your requests could not load.";
      setError(message);
      toast.error("Could not load privacy requests", { description: message });
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitRequest() {
    if (!organizationId) return;
    setSubmitting(true);
    try {
      await complianceApi.requestDeletion(organizationId, reason);
      setReason("");
      setConfirmOpen(false);
      toast.success("Deletion request submitted", {
        description: "An organization admin can now review the request."
      });
      await load();
    } catch (requestError) {
      toast.error("Could not submit the request", {
        description:
          requestError instanceof Error ? requestError.message : "Please try again."
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || organizationsLoading) {
    return <LoadingBlock label="Opening privacy controls…" />;
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="border-b border-slate-200 bg-white">
        <div className="page-shell py-10 sm:py-12">
          <ButtonLink href="/dashboard" variant="ghost" size="sm" className="-ml-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to your events
          </ButtonLink>
          <div className="mt-4 flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-700">
                Privacy controls
              </p>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-.035em] text-slate-950 sm:text-4xl">
                Your data requests
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Ask an organization to review deletion of the attendee data it holds about you.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell py-10 sm:py-12">
        {!organizations.length ? (
          <EmptyState
            title="No organization data is linked yet"
            message="When you join an organization or register for one of its events, eligible privacy controls appear here."
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <aside>
              <Card className="p-5">
                <UserRoundX className="h-5 w-5 text-blue-700" />
                <h2 className="mt-4 text-sm font-semibold text-slate-950">
                  Request data deletion
                </h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  This creates a review request. It does not immediately delete tickets, records,
                  or legally required data.
                </p>
                <div className="mt-5 space-y-4">
                  <Field label="Organization">
                    <Select
                      value={organizationId}
                      onChange={(event) => setOrganizationId(event.target.value)}
                    >
                      {organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Reason" hint="Optional">
                    <Textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      rows={4}
                      maxLength={1_000}
                      placeholder="Add context that may help the admin review your request…"
                    />
                  </Field>
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={() => setConfirmOpen(true)}
                    disabled={submitting || !organizationId}
                  >
                    <Send className="h-4 w-4" />
                    Submit request
                  </Button>
                </div>
              </Card>
            </aside>

            <div>
              {error ? (
                <ErrorState title="Privacy history is unavailable" message={error} onRetry={() => void load()} />
              ) : loading ? (
                <LoadingBlock label="Loading your requests…" />
              ) : requests.length ? (
                <Card className="overflow-hidden">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">
                      Request history
                    </p>
                    <h2 className="mt-1 text-sm font-semibold text-slate-900">
                      {requests.length} requests for this organization
                    </h2>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {requests.map((request) => {
                      const style = statusStyles[request.status];
                      const Icon = style.icon;
                      return (
                        <article key={request.id} className="px-5 py-5">
                          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                            <div>
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[9px] font-semibold ${style.className}`}
                              >
                                <Icon className="h-3 w-3" />
                                {style.label}
                              </span>
                              {request.reason ? (
                                <p className="mt-3 text-xs leading-5 text-slate-600">
                                  “{request.reason}”
                                </p>
                              ) : (
                                <p className="mt-3 text-xs text-slate-400">
                                  No reason was provided.
                                </p>
                              )}
                              {request.adminNote ? (
                                <p className="mt-2 rounded-lg bg-slate-50 p-3 text-[10px] leading-5 text-slate-600">
                                  Admin note: {request.adminNote}
                                </p>
                              ) : null}
                            </div>
                            <div className="shrink-0 sm:text-right">
                              <p className="text-[10px] font-medium text-slate-600">
                                {format(new Date(request.createdAt), "MMM d, yyyy")}
                              </p>
                              <p
                                className="mt-1 text-[9px] text-slate-400"
                                title={format(new Date(request.createdAt), "PPpp")}
                              >
                                {formatDistanceToNow(new Date(request.createdAt), {
                                  addSuffix: true
                                })}
                              </p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </Card>
              ) : (
                <EmptyState
                  title="No requests for this organization"
                  message="Submitted deletion requests and their review status will appear here."
                />
              )}
            </div>
          </div>
        )}
      </section>
      <SiteFooter />

      <ConfirmDialog
        open={confirmOpen}
        title="Submit this deletion request?"
        description="The organization will receive your request for review. This does not immediately remove data or cancel registrations."
        confirmLabel="Submit request"
        loading={submitting}
        onConfirm={submitRequest}
        onOpenChange={setConfirmOpen}
      />
    </main>
  );
}
