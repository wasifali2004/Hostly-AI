import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="paper-grid grid min-h-screen place-items-center bg-paper px-4">
      <div className="max-w-xl text-center">
        <Logo />
        <p className="mt-12 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">
          404 · No guest list here
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-[-0.04em] text-slate-950">
          This room doesn’t exist.
        </h1>
        <p className="mt-5 text-sm leading-6 text-ink/55">
          The event may have moved, ended, or returned to draft.
        </p>
        <Link
          href="/"
          className="focus-ring mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Browse events
        </Link>
      </div>
    </main>
  );
}
