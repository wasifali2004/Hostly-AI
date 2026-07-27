"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Check, LoaderCircle, ShieldCheck, UsersRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { organizationsApi } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";

export default function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const toast = useToast();
  const {
    user,
    loading,
    reload,
    setSelectedOrganization
  } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [acceptedName, setAcceptedName] = useState("");

  const returnPath = `/invitations/${encodeURIComponent(token)}`;

  async function accept() {
    setPending(true);
    setError("");
    try {
      const result = await organizationsApi.acceptInvitation(token);
      setAcceptedName(result.organization.name);
      setSelectedOrganization(result.organization.id);
      await reload();
      toast.success("Invitation accepted", {
        description: `You now have access to ${result.organization.name}.`
      });
      window.setTimeout(() => {
        router.replace("/dashboard");
        router.refresh();
      }, 900);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "This invitation could not be accepted.";
      setError(message);
      toast.error("Invitation could not be accepted", { description: message });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="paper-grid grid min-h-screen place-items-center bg-paper p-4">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-7 text-center shadow-lift sm:p-10">
        <Logo />
        {acceptedName ? (
          <>
            <span className="mx-auto mt-10 grid h-12 w-12 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
              <Check className="h-6 w-6" strokeWidth={3} />
            </span>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
              Invitation accepted
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-slate-950">Welcome to {acceptedName}.</h1>
            <p className="mt-4 text-sm leading-6 text-ink/50">Opening your new workspace…</p>
          </>
        ) : (
          <>
            <span className="mx-auto mt-10 grid h-12 w-12 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <UsersRound className="h-5 w-5" />
            </span>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">
              Workspace invitation
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-slate-950">You’re invited to the team.</h1>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-ink/52">
              Accept with the email address that received this invitation. Your role applies
              only inside this organization.
            </p>

            {loading ? (
              <div className="mt-7 flex items-center justify-center gap-2 text-xs font-semibold text-ink/42">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Checking your session…
              </div>
            ) : user ? (
              <div className="mt-7">
                <div className="rounded-xl border border-ink/10 bg-ink/[0.025] p-4 text-left">
                  <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-ink/32">
                    Signed in as
                  </p>
                  <p className="mt-1.5 text-xs font-extrabold">{user.name}</p>
                  <p className="mt-1 text-[10px] text-ink/42">{user.email}</p>
                </div>
                {error ? (
                  <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium leading-5 text-red-700">
                    {error}
                  </p>
                ) : null}
                <Button
                  variant="coral"
                  className="mt-4 w-full"
                  onClick={() => void accept()}
                  loading={pending}
                  loadingLabel="Accepting invitation…"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Accept invitation
                </Button>
              </div>
            ) : (
              <div className="mt-7 grid gap-2 sm:grid-cols-2">
                <ButtonLink
                  href={`/signup?next=${encodeURIComponent(returnPath)}`}
                  variant="coral"
                  className="text-xs"
                >
                  Create account
                  <ArrowRight className="h-3.5 w-3.5" />
                </ButtonLink>
                <ButtonLink
                  href={`/login?next=${encodeURIComponent(returnPath)}`}
                  variant="secondary"
                  className="text-xs"
                >
                  Sign in
                </ButtonLink>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
