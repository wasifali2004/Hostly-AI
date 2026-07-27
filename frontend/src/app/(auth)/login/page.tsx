import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="w-full">
      <p className="eyebrow text-ink/45">
        Welcome back
      </p>
      <h1 className="mt-3 font-display text-4xl leading-none text-ink">Sign in to Hostly AI</h1>
      <p className="mt-3 text-sm font-semibold leading-6 text-ink/50">
        Access your events, registrations, and organization workspace.
      </p>
      <Suspense>
        <AuthForm mode="sign-in" />
      </Suspense>
    </div>
  );
}
