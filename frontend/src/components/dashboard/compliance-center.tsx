"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  UserRoundX,
  XCircle
} from "lucide-react";
import { complianceApi } from "@/lib/api-client";
import type {
  DataDeletionRequest,
  DeletionRequestResponse,
  DeletionRequestStatus
} from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/form";
import { EmptyState, ErrorState } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { initials } from "@/lib/utils";

const statuses: DeletionRequestStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "COMPLETED"
];

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

export function ComplianceCenter({ organizationId }: { organizationId: string }) {
  const toast = useToast();
  const [response, setResponse] = useState<DeletionRequestResponse | null>(null);
  const [status, setStatus] = useState<DeletionRequestStatus | "">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"json" | "csv" | "">("");
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<DataDeletionRequest | null>(null);
  const [nextStatus, setNextStatus] =
    useState<Exclude<DeletionRequestStatus, "PENDING">>("APPROVED");
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResponse(
        await complianceApi.list(organizationId, {
          status: status || undefined,
          page,
          pageSize: 25
        })
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Deletion requests could not load.";
      setError(message);
      toast.error("Could not load compliance requests", { description: message });
    } finally {
      setLoading(false);
    }
  }, [organizationId, page, status, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = useMemo(() => {
    const total = response?.meta?.total ?? response?.total ?? 0;
    const pageSize = response?.meta?.pageSize ?? response?.pageSize ?? 25;
    return Math.max(1, response?.meta?.totalPages ?? Math.ceil(total / pageSize));
  }, [response]);

  async function download(formatType: "json" | "csv") {
    setExporting(formatType);
    try {
      const result = await complianceApi.export(organizationId, formatType);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        result.filename || `hostly-organization-export.${formatType}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success(`${formatType.toUpperCase()} export downloaded`, {
        description: "The export contains data belonging only to this organization."
      });
    } catch (requestError) {
      toast.error("Export failed", {
        description:
          requestError instanceof Error ? requestError.message : "Could not prepare the export."
      });
    } finally {
      setExporting("");
    }
  }

  function openEditor(request: DataDeletionRequest) {
    setEditor(request);
    setAdminNote(request.adminNote || "");
    setNextStatus(
      request.status === "PENDING"
        ? "APPROVED"
        : request.status === "APPROVED"
          ? "COMPLETED"
          : request.status === "REJECTED"
            ? "REJECTED"
            : "COMPLETED"
    );
  }

  async function updateRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    try {
      await complianceApi.updateRequest(organizationId, editor.id, {
        status: nextStatus,
        adminNote: adminNote.trim() || undefined
      });
      toast.success("Deletion request updated", {
        description: `The request is now ${statusStyles[nextStatus].label.toLowerCase()}.`
      });
      setEditor(null);
      await load();
    } catch (requestError) {
      toast.error("Request update failed", {
        description:
          requestError instanceof Error ? requestError.message : "Could not update this request."
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-700">
          Data governance
        </p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.035em] text-slate-950">
          Compliance center
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Export workspace data and review attendee deletion requests without crossing tenant
          boundaries.
        </p>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Database className="h-5 w-5" />
            </span>
            <span className="rounded bg-slate-100 px-2 py-1 text-[8px] font-semibold uppercase tracking-[.1em] text-slate-500">
              Admin only
            </span>
          </div>
          <h3 className="mt-5 text-sm font-semibold text-slate-950">Organization data export</h3>
          <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">
            Download this organization’s events, registrations, and attendee records for
            portability or internal review.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => void download("csv")}
              disabled={Boolean(exporting)}
            >
              {exporting === "csv" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Export CSV
            </Button>
            <Button
              variant="secondary"
              onClick={() => void download("json")}
              disabled={Boolean(exporting)}
            >
              {exporting === "json" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FileJson className="h-4 w-4" />
              )}
              Export JSON
            </Button>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <h3 className="mt-5 text-sm font-semibold text-slate-950">Safe handling guidance</h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Exports contain personal data. Store them securely, limit access, and remove local
            copies when they are no longer needed.
          </p>
          <div className="mt-5 flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-[10px] leading-5 text-slate-600">
            <Download className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            Generation and authorization happen in the backend. The browser receives only the
            selected organization’s file.
          </div>
        </Card>
      </div>

      {error ? (
        <div className="mt-5">
          <ErrorState title="Compliance requests are unavailable" message={error} onRetry={() => void load()} />
        </div>
      ) : null}

      <Card className="mt-5 overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">
              Attendee requests
            </p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">
              {(response?.total ?? response?.meta?.total ?? 0).toLocaleString()} deletion requests
            </h3>
          </div>
          <div className="flex items-end gap-2">
            <Field label="Status" className="min-w-44">
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as DeletionRequestStatus | "");
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {statusStyles[item].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              {loading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="sr-only">Refresh queue</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center">
            <div className="text-center text-xs font-medium text-slate-500">
              <LoaderCircle className="mx-auto mb-3 h-5 w-5 animate-spin text-blue-600" />
              Loading request queue…
            </div>
          </div>
        ) : response?.items.length ? (
          <div className="divide-y divide-slate-200">
            {response.items.map((request) => {
              const requester = request.requester;
              const style = statusStyles[request.status];
              const StatusIcon = style.icon;
              return (
                <article
                  key={request.id}
                  className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,1fr)_11rem_auto] md:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-[9px] font-semibold text-slate-600">
                      {requester ? initials(requester.name) : <UserRoundX className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {requester?.name || "Attendee"}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-slate-500">
                        {requester?.email ||
                          request.requesterEmail ||
                          `User ${request.requesterId}`}
                      </p>
                      {request.reason ? (
                        <p className="mt-2 text-[10px] leading-4 text-slate-500">
                          “{request.reason}”
                        </p>
                      ) : null}
                      {request.adminNote ? (
                        <p className="mt-2 text-[10px] leading-4 text-slate-400">
                          Admin note: {request.adminNote}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[9px] font-semibold ${style.className}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {style.label}
                    </span>
                    <p
                      className="mt-2 text-[9px] text-slate-400"
                      title={format(new Date(request.createdAt), "PPpp")}
                    >
                      {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEditor(request)}
                    disabled={request.status === "REJECTED" || request.status === "COMPLETED"}
                  >
                    {request.status === "REJECTED" || request.status === "COMPLETED"
                      ? "Closed"
                      : "Review"}
                  </Button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title={status ? "No requests with this status" : "No deletion requests"}
              message="Attendee requests will remain in this queue until an admin reviews them."
            />
          </div>
        )}

        {response?.items.length ? (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
            <p className="text-[10px] text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-1">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                aria-label="Previous request page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                aria-label="Next request page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Dialog
        open={Boolean(editor)}
        title="Review deletion request"
        description="Record the administrative outcome. This queue does not automatically delete data."
        onOpenChange={(open) => {
          if (!open && !saving) setEditor(null);
        }}
      >
        <form onSubmit={updateRequest} className="space-y-4">
          <Field label="Decision">
            <Select
              value={nextStatus}
              onChange={(event) =>
                setNextStatus(
                  event.target.value as Exclude<DeletionRequestStatus, "PENDING">
                )
              }
            >
              <option value="APPROVED">Approve for processing</option>
              <option value="REJECTED">Reject request</option>
              {editor?.status === "APPROVED" ? (
                <option value="COMPLETED">Mark completed</option>
              ) : null}
            </Select>
          </Field>
          <Field label="Admin note" hint="Optional">
            <Textarea
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
              rows={4}
              placeholder="Record verification or processing details…"
            />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditor(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="coral" disabled={saving}>
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Save decision
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
