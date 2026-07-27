"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  FileEdit,
  History,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCog
} from "lucide-react";
import { activityApi } from "@/lib/api-client";
import type { AuditAction, AuditLogEntry, AuditLogResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { EmptyState, ErrorState } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { initials } from "@/lib/utils";

const actions: Array<{ value: AuditAction; label: string }> = [
  { value: "EVENT_CREATED", label: "Event created" },
  { value: "EVENT_UPDATED", label: "Event updated" },
  { value: "EVENT_DELETED", label: "Event deleted" },
  { value: "VENUE_CREATED", label: "Venue created" },
  { value: "VENUE_UPDATED", label: "Venue updated" },
  { value: "VENUE_DELETED", label: "Venue deleted" },
  { value: "ROOM_CREATED", label: "Room created" },
  { value: "ROOM_UPDATED", label: "Room updated" },
  { value: "ROOM_DELETED", label: "Room deleted" },
  { value: "MEMBER_ROLE_CHANGED", label: "Member role changed" },
  { value: "REGISTRATION_CHECKED_IN", label: "Registration checked in" }
];

const entityTypes = ["EVENT", "VENUE", "ROOM", "MEMBERSHIP", "REGISTRATION"];

function actionLabel(action: AuditAction) {
  return actions.find((item) => item.value === action)?.label || action.replaceAll("_", " ");
}

function actionStyle(action: AuditAction) {
  if (action.endsWith("_DELETED")) {
    return { icon: Trash2, tone: "bg-red-50 text-red-700" };
  }
  if (action === "MEMBER_ROLE_CHANGED") {
    return { icon: UserCog, tone: "bg-amber-50 text-amber-700" };
  }
  if (action === "REGISTRATION_CHECKED_IN") {
    return { icon: DoorOpen, tone: "bg-emerald-50 text-emerald-700" };
  }
  if (action.endsWith("_CREATED")) {
    return { icon: CalendarCheck, tone: "bg-blue-50 text-blue-700" };
  }
  return { icon: FileEdit, tone: "bg-indigo-50 text-indigo-700" };
}

function metadataEntries(entry: AuditLogEntry) {
  return Object.entries(entry.metadata ?? {}).filter(
    ([, value]) =>
      value !== null &&
      value !== undefined &&
      (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean")
  );
}

export function ActivityLog({ organizationId }: { organizationId: string }) {
  const toast = useToast();
  const [response, setResponse] = useState<AuditLogResponse | null>(null);
  const [action, setAction] = useState<AuditAction | "">("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResponse(
        await activityApi.list(organizationId, {
          action: action || undefined,
          entityType: entityType || undefined,
          from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
          to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
          page,
          pageSize: 25
        })
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Activity could not load.";
      setError(message);
      toast.error("Could not load activity", { description: message });
    } finally {
      setLoading(false);
    }
  }, [action, entityType, from, organizationId, page, toast, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = useMemo(() => {
    const total = response?.meta?.total ?? response?.total ?? 0;
    const pageSize = response?.meta?.pageSize ?? response?.pageSize ?? 25;
    return Math.max(1, response?.meta?.totalPages ?? Math.ceil(total / pageSize));
  }, [response]);

  const activeFilters = Boolean(action || entityType || from || to);

  function clearFilters() {
    setAction("");
    setEntityType("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-700">
            Admin controls
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.035em] text-slate-950">
            Activity log
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            A tenant-scoped history of high-impact changes, access updates, and check-ins.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <Card className="mt-7 p-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_.8fr_.8fr_auto] xl:items-end">
          <Field label="Action">
            <Select
              value={action}
              onChange={(event) => {
                setAction(event.target.value as AuditAction | "");
                setPage(1);
              }}
            >
              <option value="">All actions</option>
              {actions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Affected record">
            <Select
              value={entityType}
              onChange={(event) => {
                setEntityType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All record types</option>
              {entityTypes.map((entity) => (
                <option key={entity} value={entity}>
                  {entity.charAt(0) + entity.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Button
            variant="ghost"
            className="xl:mb-0"
            disabled={!activeFilters}
            onClick={clearFilters}
          >
            Clear
          </Button>
        </div>
      </Card>

      <div className="mt-5 flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600 shadow-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
        Activity records can be viewed only by organization admins. They are created by backend
        services at the point each protected action succeeds.
      </div>

      {error ? (
        <div className="mt-5">
          <ErrorState title="The activity log is unavailable" message={error} onRetry={() => void load()} />
        </div>
      ) : null}

      <Card className="mt-5 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">
              Recorded actions
            </p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">
              {(response?.total ?? response?.meta?.total ?? 0).toLocaleString()} entries
            </h3>
          </div>
          <History className="h-5 w-5 text-slate-300" />
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center">
            <div className="text-center text-xs font-medium text-slate-500">
              <LoaderCircle className="mx-auto mb-3 h-5 w-5 animate-spin text-blue-600" />
              Reading audit history…
            </div>
          </div>
        ) : response?.items.length ? (
          <div className="divide-y divide-slate-200">
            {response.items.map((entry) => {
              const { icon: Icon, tone } = actionStyle(entry.action);
              const details = metadataEntries(entry);
              return (
                <article
                  key={entry.id}
                  className="grid gap-4 px-5 py-5 sm:grid-cols-[2.5rem_minmax(0,1fr)_11rem]"
                >
                  <span className={`grid h-10 w-10 place-items-center rounded-lg ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs font-semibold text-slate-900">
                        {actionLabel(entry.action)}
                      </h4>
                      <span className="rounded bg-slate-100 px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[.08em] text-slate-500">
                        {entry.entityType}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {entry.entityLabel || entry.entityId || "Affected record"}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-[8px] font-semibold text-slate-600">
                        {entry.actor ? initials(entry.actor.name) : "SYS"}
                      </span>
                      <p className="text-[10px] text-slate-500">
                        {entry.actor ? (
                          <>
                            <span className="font-semibold text-slate-700">{entry.actor.name}</span>
                            {" · "}
                            {entry.actor.email}
                          </>
                        ) : (
                          "System action"
                        )}
                      </p>
                    </div>
                    {details.length ? (
                      <details className="mt-3 text-[10px] text-slate-500">
                        <summary className="cursor-pointer font-semibold text-blue-700">
                          View recorded details
                        </summary>
                        <dl className="mt-2 grid gap-x-6 gap-y-1.5 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
                          {details.map(([key, value]) => (
                            <div key={key} className="flex justify-between gap-3">
                              <dt className="text-slate-400">{key.replaceAll("_", " ")}</dt>
                              <dd className="truncate font-medium text-slate-700">{String(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    ) : null}
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[10px] font-medium text-slate-600">
                      {format(new Date(entry.createdAt), "MMM d, yyyy")}
                    </p>
                    <p
                      className="mt-1 text-[9px] text-slate-400"
                      title={format(new Date(entry.createdAt), "PPpp")}
                    >
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title={activeFilters ? "No actions match these filters" : "No recorded actions yet"}
              message={
                activeFilters
                  ? "Clear one or more filters to broaden the history."
                  : "New event, venue, membership, and check-in actions will appear here."
              }
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
                aria-label="Previous activity page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                aria-label="Next activity page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
