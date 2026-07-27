"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  LoaderCircle,
  MailPlus,
  ShieldCheck,
  Trash2,
  UserPlus
} from "lucide-react";
import { organizationsApi } from "@/lib/api-client";
import type { OrganizationMember, OrgRole } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ErrorState, LoadingBlock } from "@/components/ui/status";
import { initials } from "@/lib/utils";

const roleLabels: Record<OrgRole, string> = {
  ORG_ADMIN: "Org admin",
  ORGANIZER: "Organizer",
  ATTENDEE: "Attendee"
};

export default function OrganizationMembersPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organizationId, organization, isAdmin } = useOrg(orgSlug);
  const { user } = useAuth();
  const toast = useToast();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("ORGANIZER");
  const [entryMode, setEntryMode] = useState<"invite" | "add">("invite");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [removeTarget, setRemoveTarget] = useState<OrganizationMember | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !isAdmin) return;
    setLoading(true);
    setError("");
    try {
      setMembers(await organizationsApi.members(organizationId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Members could not load.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    setSubmitting(true);
    try {
      if (entryMode === "invite") {
        await organizationsApi.invite(organizationId, { email: email.trim(), role });
        toast.success("Invitation sent", {
          description: `${email.trim()} can now accept the ${roleLabels[role]} role.`
        });
      } else {
        await organizationsApi.addMember(organizationId, { email: email.trim(), role });
        toast.success("Member added", {
          description: `${email.trim()} now has ${roleLabels[role]} access.`
        });
        await load();
      }
      setEmail("");
    } catch (requestError) {
      toast.error(entryMode === "invite" ? "Invitation could not be sent" : "Member could not be added", {
        description:
          requestError instanceof Error ? requestError.message : "Please try again."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(member: OrganizationMember, nextRole: OrgRole) {
    if (!organizationId) return;
    setBusyId(member.id);
    try {
      const updated = await organizationsApi.updateMember(organizationId, member.id, nextRole);
      setMembers((current) =>
        current.map((item) => (item.id === member.id ? { ...item, ...updated } : item))
      );
      toast.success("Role updated", {
        description: `${member.user.name} is now an ${roleLabels[nextRole]}.`
      });
    } catch (requestError) {
      toast.error("Role could not be changed", {
        description:
          requestError instanceof Error ? requestError.message : "Please try again."
      });
    } finally {
      setBusyId("");
    }
  }

  async function remove() {
    if (!organizationId || !removeTarget) return;
    setBusyId(removeTarget.id);
    try {
      await organizationsApi.removeMember(organizationId, removeTarget.id);
      const removedName = removeTarget.user.name;
      setMembers((current) => current.filter((member) => member.id !== removeTarget.id));
      setRemoveTarget(null);
      toast.success("Member removed", {
        description: `${removedName} no longer has access to this workspace.`
      });
    } catch (requestError) {
      toast.error("Member could not be removed", {
        description:
          requestError instanceof Error ? requestError.message : "Please try again."
      });
    } finally {
      setBusyId("");
    }
  }

  if (!isAdmin) {
    return (
      <ErrorState
        title="Admin access is required"
        message="Only organization admins can view and change workspace membership."
      />
    );
  }
  if (loading || !organizationId) return <LoadingBlock label="Loading the team…" />;

  return (
    <div className="animate-fade-up">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-700">
          Workspace access
        </p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.035em] text-slate-950">Members</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Roles are scoped to {organization?.name}. A person can have a different role in
          another organization.
        </p>
      </div>

      {error ? (
        <div className="mt-6">
          <ErrorState title="Membership action failed" message={error} onRetry={() => void load()} />
        </div>
      ) : null}

      <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="overflow-hidden">
          <CardHeader eyebrow="Current access" title={`${members.length} team members`} />
          <div className="divide-y divide-ink/10">
            {members.map((member) => {
              const self = member.user.id === user?.id;
              const busy = busyId === member.id;
              return (
                <div
                  key={member.id}
                  className={`grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_10rem_2.5rem] sm:items-center ${
                    busy ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-[10px] font-semibold text-slate-700">
                      {initials(member.user.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {member.user.name}
                        {self ? <span className="ml-2 text-[9px] text-ink/30">You</span> : null}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-ink/40">{member.user.email}</p>
                    </div>
                  </div>
                  <Select
                    value={member.role}
                    disabled={self}
                    onChange={(input) =>
                      void changeRole(member, input.target.value as OrgRole)
                    }
                    className="h-9 text-[10px] font-bold"
                    aria-label={`Role for ${member.user.name}`}
                  >
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={self}
                    onClick={() => setRemoveTarget(member)}
                    className="text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-20"
                    aria-label={`Remove ${member.user.name}`}
                  >
                    {busy ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>

        <aside className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700">
                {entryMode === "invite" ? (
                  <MailPlus className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Add a teammate</h3>
                <p className="mt-0.5 text-[10px] text-ink/38">Choose the right entry path</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-ink/[.05] p-1">
              {([
                ["invite", "Send invite"],
                ["add", "Existing user"]
              ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={entryMode === value ? "secondary" : "ghost"}
                  onClick={() => setEntryMode(value)}
                  className="h-8 px-2 text-[9px]"
                >
                  {label}
                </Button>
              ))}
            </div>
            <form onSubmit={submit} className="mt-5 space-y-4">
              <Field label="Email address">
                <Input
                  type="email"
                  value={email}
                  onChange={(input) => setEmail(input.target.value)}
                  placeholder="teammate@company.com"
                  required
                />
              </Field>
              <Field label="Workspace role">
                <Select value={role} onChange={(input) => setRole(input.target.value as OrgRole)}>
                  <option value="ORGANIZER">Organizer</option>
                  <option value="ORG_ADMIN">Org admin</option>
                  <option value="ATTENDEE">Attendee</option>
                </Select>
              </Field>
              <Button
                type="submit"
                variant="coral"
                className="w-full"
                loading={submitting}
                loadingLabel={entryMode === "invite" ? "Sending invitation…" : "Adding member…"}
              >
                {entryMode === "invite" ? (
                  <MailPlus className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {entryMode === "invite" ? "Send invitation" : "Add existing user"}
              </Button>
            </form>
          </Card>

          <section className="rounded-2xl bg-midnight p-5 text-white">
            <ShieldCheck className="h-5 w-5 text-sage" />
            <h3 className="mt-4 font-display text-2xl">Roles stay local.</h3>
            <div className="mt-5 space-y-4">
              {Object.entries(roleLabels).map(([key, label]) => (
                <div key={key}>
                  <p className="text-[10px] font-bold text-white/72">{label}</p>
                  <p className="mt-1 text-[9px] leading-4 text-white/34">
                    {key === "ORG_ADMIN"
                      ? "All events, membership, and organization settings."
                      : key === "ORGANIZER"
                        ? "Creates and manages their own events and doors."
                        : "Discovers and registers without management access."}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove this teammate?"
        description={
          removeTarget
            ? `${removeTarget.user.name} will immediately lose access to this workspace.`
            : undefined
        }
        confirmLabel="Remove access"
        cancelLabel="Keep member"
        destructive
        loading={Boolean(busyId)}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        onConfirm={remove}
      />
    </div>
  );
}
