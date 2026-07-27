import Link from "next/link";
import { ArrowLeft, CalendarDays, QrCode, Ticket, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-svh bg-fog lg:grid lg:h-svh lg:grid-cols-[minmax(28rem,.85fr)_1.15fr] lg:overflow-hidden">

      {/* ── LEFT: Form panel ─────────────────────────────────────── */}
      <section className="relative flex min-h-svh flex-col px-5 py-5 sm:px-10 sm:py-7 lg:min-h-0 lg:px-12">
        {/* Subtle grid texture */}
        <div className="dot-grid-ink pointer-events-none absolute inset-0 opacity-60" />

        <div className="relative z-10 flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="focus-ring inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2 text-[11px] font-bold text-ink/50 shadow-sm transition hover:border-ink/20 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Hostly
          </Link>
        </div>

        {/* Mobile banner */}
        <div className="relative z-10 mt-5 overflow-hidden rounded-[1.5rem] bg-lavender px-5 py-4 text-ink shadow-card lg:hidden">
          <div className="paper-grid absolute inset-0 opacity-[.08]" />
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-ink/45">
                Event operations platform
              </p>
              <p className="mt-1.5 max-w-xs text-sm font-extrabold leading-5">
                Plan the room, invite the crowd, scan the door.
              </p>
            </div>
            <div className="hidden shrink-0 gap-1.5 sm:flex">
              {["Plan", "Invite", "Welcome"].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-[9px] font-bold text-ink/65"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Form card */}
        <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 items-center py-7 sm:py-9 lg:min-h-0 lg:py-4">
          <div className="w-full rounded-[2rem] border border-ink/10 bg-white p-6 shadow-deep sm:p-9">
            {children}
          </div>
        </div>

        <p className="relative z-10 hidden text-[10px] font-bold uppercase tracking-[0.1em] text-ink/30 sm:block">
          Secure sessions — Organization-scoped access
        </p>
      </section>

      {/* ── RIGHT: Collage panel ──────────────────────────────────── */}
      <aside className="relative hidden h-svh overflow-hidden bg-butter lg:flex lg:flex-col lg:justify-between xl:p-14">
        {/* Texture */}
        <div className="paper-grid absolute inset-0 opacity-[.1]" />

        {/* Top label */}
        <p className="relative z-10 p-10 text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink/50 xl:p-0">
          Event operations platform
        </p>

        {/* Big quote */}
        <div className="relative z-10 max-w-2xl px-10 xl:px-0">
          <blockquote className="balanced font-display text-[3.5rem] leading-[0.93] tracking-[-0.04em]">
            Your event desk,{" "}
            <span className="relative">
              minus
              <span className="absolute -bottom-1 left-0 h-2 w-full rounded-full bg-ink/15" />
            </span>{" "}
            the desk panic.
          </blockquote>
          <p className="mt-6 max-w-md text-base font-semibold leading-7 text-ink/60">
            Manage teams, room schedules, guest lists, ticket tiers, and check-in with
            connected workspace data.
          </p>

          {/* Scattered collage */}
          <div className="relative mt-12 min-h-[26rem]">
            {/* Guest pass card */}
            <div className="editorial-card absolute left-0 top-4 w-58 -rotate-[5deg] p-5">
              <Ticket className="h-7 w-7" />
              <p className="mt-10 font-display text-3xl leading-none">Guest pass</p>
              <span className="mt-5 inline-flex rounded-full bg-ink px-4 py-2 text-xs font-bold text-white">
                VIP A12
              </span>
            </div>

            {/* QR scan card */}
            <div className="editorial-card absolute right-4 top-0 w-52 rotate-[4deg] bg-ink p-5 text-white">
              <QrCode className="h-16 w-16" />
              <p className="mt-8 font-display text-2xl leading-none">Scan ready</p>
              <p className="mt-1 text-xs text-white/45">842 processed tonight</p>
            </div>

            {/* Attendance card */}
            <div className="editorial-card absolute bottom-4 left-16 w-72 rotate-[3deg] bg-lavender p-5">
              <Users className="h-6 w-6" />
              <p className="mt-5 text-xs font-extrabold uppercase text-ink/45">Live attendance</p>
              <p className="mt-1 font-display text-5xl leading-none">842</p>
            </div>

            {/* Time card */}
            <div className="editorial-card absolute bottom-16 right-0 w-48 -rotate-[4deg] p-4">
              <CalendarDays className="h-5 w-5 text-coral" />
              <p className="mt-4 text-sm font-extrabold">Friday 6:00 PM</p>
              <span className="mt-2 inline-flex rounded-full bg-butter px-3 py-1 text-[10px] font-extrabold">
                Doors open
              </span>
            </div>
          </div>
        </div>

        {/* Bottom logo mark */}
        <div className="relative z-10 px-10 pb-10 xl:px-0 xl:pb-0">
          <Logo compact />
        </div>
      </aside>
    </main>
  );
}
