"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Check, ImageIcon, Save, Settings2 } from "lucide-react";
import { organizationsApi } from "@/lib/api-client";
import type { Organization } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ErrorState, LoadingBlock } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";

export default function OrganizationSettingsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organizationId, isAdmin } = useOrg(orgSlug);
  const { reload } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!organizationId || !isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const data = await organizationsApi.getBySlug(orgSlug);
      setOrganization(data);
      setName(data.name);
      setDescription(data.description || "");
      setLogoUrl(data.logoUrl || "");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Organization could not load."
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin, orgSlug, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const updated = await organizationsApi.update(organizationId, {
        name: name.trim(),
        description: description.trim(),
        logoUrl: logoUrl.trim()
      });
      setOrganization(updated);
      await reload();
      setSaved(true);
      toast.success("Workspace settings saved", {
        description: "Your organization profile is up to date."
      });
      if (updated.slug && updated.slug !== orgSlug) {
        router.replace(`/org/${encodeURIComponent(updated.slug)}/settings`);
      }
      router.refresh();
    } catch (requestError) {
      toast.error("Changes could not be saved", {
        description:
          requestError instanceof Error ? requestError.message : "Please try again."
      });
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <ErrorState
        title="Admin access is required"
        message="Only organization admins can change workspace settings."
      />
    );
  }
  if (loading || !organizationId) return <LoadingBlock label="Loading workspace settings…" />;
  if (!organization) {
    return (
      <ErrorState title="Settings are unavailable" message={error} onRetry={() => void load()} />
    );
  }

  return (
    <div className="animate-reveal">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-blue-700">
          Organization identity
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.04em] text-slate-950 sm:text-4xl">Organization settings</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          These details identify your workspace and introduce the organization on its public
          event profile.
        </p>
      </section>

      {error ? (
        <div className="mt-6">
          <ErrorState title="Settings action failed" message={error} />
        </div>
      ) : null}

      <form onSubmit={save} className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <Card className="overflow-hidden">
          <CardHeader
            eyebrow="Public details"
            title="Workspace profile"
            action={<span className="rounded-md bg-blue-50 px-2.5 py-1.5 text-[9px] font-semibold text-blue-700">Visible publicly</span>}
          />
          <div className="space-y-5 p-5 sm:p-6">
            <Field label="Organization name">
              <Input
                value={name}
                onChange={(input) => {
                  setName(input.target.value);
                  setSaved(false);
                }}
                minLength={2}
                maxLength={120}
                required
              />
            </Field>
            <Field
              label="Description"
              hint="Shown on your public profile"
            >
              <Textarea
                value={description}
                onChange={(input) => {
                  setDescription(input.target.value);
                  setSaved(false);
                }}
                rows={7}
                maxLength={2000}
                placeholder="What does your organization gather people to do?"
              />
            </Field>
            <Field label="Public profile">
              <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-500">
                /org/{organization.slug}
              </div>
            </Field>
          </div>
        </Card>

        <aside className="space-y-5">
          <Card className="interactive-card p-5">
            <div className="flex items-center gap-3">
              <ImageIcon className="h-4 w-4 text-coral" />
              <h3 className="text-sm font-semibold text-slate-900">Organization mark</h3>
            </div>
            <div className="relative mx-auto mt-5 h-32 w-32 overflow-hidden rounded-2xl border border-ink/10 bg-[#f5f2eb]">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="Organization logo preview"
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center font-display text-5xl text-ink/25">
                  {name.charAt(0) || "H"}
                </div>
              )}
            </div>
            <Field label="Hosted image URL" className="mt-5">
              <Input
                type="url"
                value={logoUrl}
                onChange={(input) => {
                  setLogoUrl(input.target.value);
                  setSaved(false);
                }}
                placeholder="https://…"
              />
            </Field>
          </Card>

          <section className="metric-grid rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white">
            <Settings2 className="h-5 w-5 text-sage" />
            <p className="mt-4 text-xs font-semibold text-white">Tenant-safe identity</p>
            <p className="mt-2 text-[10px] leading-5 text-white/45">
              Updating this profile never changes another organization you belong to.
            </p>
          </section>

          <Button
            type="submit"
            variant="coral"
            className="w-full"
            loading={saving}
            loadingLabel="Saving changes…"
          >
            {saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saved ? "Saved" : "Save changes"}
          </Button>
        </aside>
      </form>
    </div>
  );
}
