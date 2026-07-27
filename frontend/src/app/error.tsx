"use client";

import { useEffect } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4">
      <div className="max-w-lg text-center">
        <Logo />
        <p className="mt-10 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">
          Something went off-script
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-slate-950">Something went wrong.</h1>
        <p className="mt-4 text-sm leading-6 text-ink/55">
          An unexpected error interrupted this page. Your data has not been changed.
        </p>
        <Button onClick={reset} className="mt-7">
          Try again
        </Button>
      </div>
    </main>
  );
}
