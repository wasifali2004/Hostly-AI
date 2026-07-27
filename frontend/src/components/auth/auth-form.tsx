"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import type { User } from "@/types";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { signIn, signUp } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSignUp = mode === "sign-up";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      let authenticatedUser: User;
      if (isSignUp) {
        authenticatedUser = await signUp({
          name: name.trim(),
          organizationName: organizationName.trim() || undefined,
          email: email.trim(),
          password
        });
      } else {
        authenticatedUser = await signIn(email.trim(), password);
      }
      const next = searchParams.get("next");
      const managementMembership = authenticatedUser.memberships.find(
        (membership) => membership.role !== "ATTENDEE"
      );
      const fallback = managementMembership
        ? `/org/${encodeURIComponent(managementMembership.organization.slug)}/dashboard`
        : "/dashboard";
      toast.success(isSignUp ? "Workspace ready" : "Welcome back", {
        description: isSignUp
          ? "Your Hostly account has been created."
          : "You are securely signed in."
      });
      router.replace(next?.startsWith("/") ? next : fallback);
      router.refresh();
    } catch (authError) {
      const message =
        authError instanceof Error ? authError.message : "Authentication failed.";
      setError(message);
      toast.error(isSignUp ? "Could not create account" : "Sign in failed", {
        description: message
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      {isSignUp ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name">
            <Input
              value={name}
              onChange={(input) => setName(input.target.value)}
              autoComplete="name"
              placeholder="Maya Chen"
              required
            />
          </Field>
          <Field label="Workspace name" hint="Optional">
            <Input
              value={organizationName}
              onChange={(input) => setOrganizationName(input.target.value)}
              autoComplete="organization"
              placeholder="Fieldwork Co."
            />
          </Field>
        </div>
      ) : null}
      <Field label="Email address">
        <Input
          type="email"
          value={email}
          onChange={(input) => setEmail(input.target.value)}
          autoComplete="email"
          placeholder="maya@company.com"
          required
        />
      </Field>
      <Field label="Password" hint={isSignUp ? "At least 8 characters" : undefined}>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(input) => setPassword(input.target.value)}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={8}
            className="pr-11"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute right-1 top-1 h-9 w-9 text-ink/35 hover:bg-ink/5 hover:text-ink"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </Field>
      {!isSignUp ? (
        <div className="flex justify-end">
          <span className="text-xs font-semibold text-ink/40">Secure account recovery coming soon</span>
        </div>
      ) : (
        <p className="text-[11px] leading-5 text-ink/42">
          By continuing, you agree to keep guest data safe and use Hostly responsibly.
        </p>
      )}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium leading-5 text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="coral"
        className="w-full"
        loading={pending}
        loadingLabel="One moment…"
      >
        {isSignUp ? "Create my workspace" : "Sign in"}
      </Button>
      <p className="pt-2 text-center text-xs text-ink/48">
        {isSignUp ? "Already have a workspace?" : "New to Hostly?"}{" "}
        <Link
          href={isSignUp ? "/login" : "/signup"}
          className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-4"
        >
          {isSignUp ? "Sign in" : "Create one"}
        </Link>
      </p>
    </form>
  );
}
