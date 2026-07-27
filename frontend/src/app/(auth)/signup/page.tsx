import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Create a workspace" };

export default function SignupPage() {
  return (
    <div className="w-full">
      <p className="eyebrow text-ink/45">
        Create an organization workspace
      </p>
      <h1 className="mt-3 font-display text-4xl leading-none text-ink">Get started with Hostly AI</h1>
      <p className="mt-3 text-sm font-semibold leading-6 text-ink/50">
        Create your account and an isolated workspace for your organization.
      </p>
      <Suspense>
        <AuthForm mode="sign-up" />
      </Suspense>
    </div>
  );
}
