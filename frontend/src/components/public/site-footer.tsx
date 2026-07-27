import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarRange,
  CheckCircle2,
  ScanLine,
  ShieldCheck,
  TicketCheck
} from "lucide-react";
import { Logo } from "@/components/brand/logo";

const productLinks = [
  { href: "/events", label: "Discover events" },
  { href: "/dashboard", label: "My tickets" },
  { href: "/signup", label: "Organizer workspace" },
  { href: "/login", label: "Sign in" }
];

const capabilityLinks = [
  { href: "/#platform", label: "Event operations" },
  { href: "/#platform", label: "Venue allocation" },
  { href: "/#platform", label: "Registration analytics" },
  { href: "/#platform", label: "Mobile check-in" }
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/8 bg-midnight text-white">
      {/* Dot-grid texture overlay */}
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-100" />

      <div className="page-shell relative z-10">
        {/* Closing CTA block */}
        <div className="py-20 text-center lg:py-28">
          <div className="flex justify-center">
            <Logo inverse />
          </div>

          {/* Bold closing headline */}
          <h2 className="balanced mx-auto mt-10 max-w-5xl font-display text-5xl leading-[0.92] tracking-[-0.04em] sm:text-7xl lg:text-8xl">
            Make every event feel beautifully under control.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-white/50">
            Plan, publish, register, allocate, and check in from one secure workspace built for the whole event team.
          </p>

          {/* CTA pill button */}
          <div className="mt-10 flex justify-center">
            <Link
              href="/signup"
              className="button-polish focus-ring inline-flex h-14 items-center gap-2.5 rounded-full border border-white bg-white px-8 text-sm font-bold text-ink transition-[background-color,box-shadow,transform] hover:bg-white/90"
            >
              Start Planning
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Stat pills row */}
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {["10k+ tickets processed", "98% check-in rate", "Zero missed scans"].map((item) => (
              <span key={item} className="pill-chip border-white/15 bg-white/8 text-white/65">
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Feature tags + link columns */}
        <div className="grid gap-10 border-y border-white/10 py-12 lg:grid-cols-[1fr_.85fr]">
          {/* Feature tags */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              Built for event teams
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Workspaces", "Ticket tiers", "Room booking", "QR check-in", "Audit logs", "Seat maps"].map((item) => (
                <span key={item} className="pill-chip border-white/10 bg-white/8 text-white/65">
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                Product
              </p>
              <nav className="mt-5 grid gap-3.5 text-xs text-white/55">
                {productLinks.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                Capabilities
              </p>
              <nav className="mt-5 grid gap-3.5 text-xs text-white/55">
                {capabilityLinks.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                Built for
              </p>
              <div className="mt-5 grid gap-3.5 text-xs text-white/55">
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-butter" />
                  Organizations
                </span>
                <span className="inline-flex items-center gap-2">
                  <CalendarRange className="h-3.5 w-3.5 text-butter" />
                  Organizers
                </span>
                <span className="inline-flex items-center gap-2">
                  <TicketCheck className="h-3.5 w-3.5 text-butter" />
                  Attendees
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Status strip */}
        <div className="grid gap-4 py-6 text-[10px] text-white/35 sm:grid-cols-3">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.4)]" />
            All systems operational
          </span>
          <span className="inline-flex items-center gap-2 sm:justify-center">
            <ShieldCheck className="h-3.5 w-3.5 text-lavender" />
            Tenant-isolated by design
          </span>
          <span className="inline-flex items-center gap-2 sm:justify-end">
            <ScanLine className="h-3.5 w-3.5 text-butter" />
            Mobile-ready check-in
          </span>
        </div>

        {/* Legal bottom bar */}
        <div className="flex flex-col gap-3 border-t border-white/8 py-6 text-[10px] text-white/30 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Hostly AI. Event operations, unified.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/dashboard/privacy" className="hover:text-white">
              Privacy requests
            </Link>
            <Link href="/events" className="hover:text-white">
              Public directory
            </Link>
            <span>Free-tier friendly</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
