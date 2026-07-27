import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CirclePlay,
  MapPin,
  Mic2,
  QrCode,
  ScanLine,
  Sparkles,
  Ticket,
  Users
} from "lucide-react";
import { publicApi } from "@/lib/api-client";
import type { EventSummary } from "@/types";
import { EventCard } from "@/components/public/event-card";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { ButtonLink } from "@/components/ui/button";
import { percent } from "@/lib/utils";

const trusted = ["NORTHSTAR", "SUMMIT", "FIELDWORK", "ATLAS", "MERIDIAN", "KINSHIP"];

const testimonials = [
  {
    quote:
      "Hostly turned our arrival desk from a spreadsheet scramble into a calm, professional guest flow.",
    name: "Maya Chen",
    role: "Community Director",
    tag: "98% check-in rate",
    tagColor: "bg-butter text-ink"
  },
  {
    quote:
      "The room booking checks saved us from double-booking a keynote hall two days before launch.",
    name: "Omar Malik",
    role: "Conference Producer",
    tag: "42 sessions managed",
    tagColor: "bg-lavender text-ink"
  },
  {
    quote:
      "We can see ticket demand, team tasks, and door status without asking five people for updates.",
    name: "Ari Stone",
    role: "Events Lead",
    tag: "10k tickets tracked",
    tagColor: "bg-ink text-white"
  }
];

/* ─── Hero Collage ──────────────────────────────────────────────────── */

function HeroCollage({
  registrations,
  capacity,
  eventCount
}: {
  registrations: number;
  capacity: number;
  eventCount: number;
}) {
  const fill = percent(registrations, capacity);

  return (
    <div className="relative mx-auto min-h-[34rem] w-full max-w-[38rem] sm:min-h-[40rem]">

      {/* Ticket card — top left, tilted left */}
      <div className="editorial-card absolute left-2 top-8 w-64 -rotate-[5deg] p-5 sm:left-6">
        <div className="flex items-center justify-between">
          <span className="pill-chip bg-butter">VIP ticket</span>
          <Ticket className="h-5 w-5 text-ink/45" />
        </div>
        <h3 className="mt-8 font-display text-3xl leading-none text-ink">Opening Night</h3>
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-dashed border-ink/15 pt-4">
          {["A1", "A2", "A3"].map((seat) => (
            <span
              key={seat}
              className="rounded-full bg-ink px-3 py-2 text-center text-[10px] font-extrabold text-white"
            >
              {seat}
            </span>
          ))}
        </div>
      </div>

      {/* QR scan card — top right, tilted right */}
      <div className="editorial-card absolute right-0 top-2 w-52 rotate-[5deg] bg-ink p-5 text-white sm:right-4">
        <QrCode className="h-16 w-16" />
        <p className="mt-6 text-[11px] font-extrabold uppercase text-white/40">Door scan</p>
        <p className="mt-1 font-display text-2xl leading-none">842 checked in</p>
      </div>

      {/* Live attendee card — mid left, tilted right */}
      <div className="editorial-card absolute bottom-20 left-0 w-56 rotate-[3deg] bg-lavender p-5 sm:left-8">
        <p className="text-[11px] font-extrabold uppercase text-ink/50">Live audience</p>
        <p className="mt-2 font-display text-5xl leading-none">{registrations || 184}</p>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/60">
          <div className="h-full rounded-full bg-ink" style={{ width: `${fill || 72}%` }} />
        </div>
        <p className="mt-2 text-xs font-bold text-ink/55">{fill || 72}% capacity fill</p>
      </div>

      {/* Speaker card — bottom right, tilted left */}
      <div className="editorial-card absolute bottom-6 right-1 w-72 -rotate-[3deg] p-5 sm:right-2">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-butter">
            <Mic2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-extrabold uppercase text-ink/40">Speaker card</p>
            <h3 className="font-display text-xl leading-none">Nadia Rivers</h3>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-ink/8 bg-fog p-3">
          <p className="text-xs font-bold text-ink/50">Main stage — 6:30 PM</p>
        </div>
      </div>

      {/* Seating map — center, hidden on small */}
      <div className="editorial-card absolute left-16 top-52 hidden w-72 rotate-[2deg] p-5 sm:block">
        <p className="text-[11px] font-extrabold uppercase text-ink/40">Seating map</p>
        <div className="mt-4 grid grid-cols-8 gap-1.5">
          {Array.from({ length: 32 }, (_, i) => (
            <span
              key={i}
              className={`aspect-square rounded-md ${
                [3, 9, 10, 18, 26].includes(i) ? "bg-coral" : "bg-fog"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Live events badge */}
      <div className="absolute right-20 top-48 hidden -rotate-[5deg] rounded-full border border-ink bg-butter px-5 py-3 text-xs font-extrabold shadow-float sm:inline-flex">
        {eventCount || 3} live events
      </div>
    </div>
  );
}

/* ─── App Tree Mockup ───────────────────────────────────────────────── */

function AppTreeMockup() {
  const rows: [string, string, string][] = [
    ["Agenda", "4 blocks", "bg-butter"],
    ["Sessions", "18 rooms", "bg-lavender"],
    ["Speakers", "32 guests", "bg-emerald-200"],
    ["Sponsors", "12 partners", "bg-orange-200"]
  ];

  return (
    <div className="editorial-card rotate-[2deg] p-5 transition-transform duration-300 hover:rotate-0">
      <div className="rounded-[1.5rem] border border-ink/10 bg-fog p-4">
        <div className="flex items-center justify-between">
          <span className="pill-chip bg-white">Program tree</span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live
          </span>
        </div>
        <div className="mt-5 space-y-3">
          {rows.map(([label, meta, color], i) => (
            <div key={label} className="rounded-2xl border border-ink/8 bg-white p-3">
              <div className="flex items-center gap-3">
                <span className={`h-9 w-9 rounded-full ${color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-ink">{label}</p>
                  <p className="text-xs font-semibold text-ink/45">{meta}</p>
                </div>
                <span className="text-xs font-bold text-ink/30">0{i + 1}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Dashboard Preview ─────────────────────────────────────────────── */

function DashboardPreview() {
  return (
    <div className="editorial-card relative overflow-hidden rounded-[2rem] bg-midnight p-4 text-white sm:p-6">
      <div className="grid min-h-[30rem] gap-4 rounded-[1.5rem] bg-[#0d1526] p-4 lg:grid-cols-[14rem_1fr]">
        {/* Sidebar */}
        <aside className="hidden rounded-[1.25rem] bg-white/5 p-4 lg:block">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-butter/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-butter" />
            </div>
            <span className="font-display text-lg text-white">Hostly</span>
          </div>
          <div className="mt-8 space-y-1.5">
            {["Overview", "Events", "Attendees", "Rooms", "Reports"].map((item, i) => (
              <span
                key={item}
                className={`block rounded-full px-4 py-2.5 text-sm font-bold transition-colors ${
                  i === 0
                    ? "bg-butter text-ink"
                    : "text-white/50 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item}
              </span>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <div className="rounded-[1.25rem] bg-paper p-5 text-ink">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow text-ink/40">Tonight</p>
              <h3 className="mt-1 font-display text-3xl">Launch Summit</h3>
            </div>
            <span className="pill-chip bg-lavender">842 inside</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Attendees", value: "1,204", color: "bg-butter/40" },
              { label: "Revenue", value: "$18.6k", color: "bg-lavender/40" },
              { label: "Check-ins", value: "92%", color: "bg-emerald-100" }
            ].map((item) => (
              <div key={item.label} className={`rounded-[1.25rem] ${item.color} p-5`}>
                <p className="text-xs font-extrabold uppercase text-ink/50">{item.label}</p>
                <p className="mt-4 font-display text-3xl">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-[1.25rem] bg-white p-5">
            <p className="text-xs font-bold uppercase text-ink/40">Registrations this week</p>
            <div className="mt-4 flex h-28 items-end gap-1.5">
              {[28, 36, 52, 44, 67, 76, 64, 88, 94].map((h, i) => (
                <span
                  key={i}
                  className={`flex-1 rounded-t-xl ${i === 8 ? "bg-ink" : "bg-butter"}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Play button */}
      <button
        className="button-polish focus-ring absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white bg-white text-ink shadow-deep"
        aria-label="Play product demo"
      >
        <CirclePlay className="h-9 w-9" />
      </button>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default async function LandingPage() {
  let featured: EventSummary[] = [];
  try {
    featured = (await publicApi.events({ page: 1, pageSize: 3 })).items;
  } catch {
    featured = [];
  }

  const registrations = featured.reduce((t, e) => t + e.registeredCount, 0);
  const capacity = featured.reduce((t, e) => t + e.capacity, 0);

  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteHeader floating />

      {/* ── 1. HERO ─────────────────────────────────────────────────── */}
      <section className="overflow-hidden bg-paper">
        <div className="page-shell grid min-h-[calc(100svh-4.25rem)] items-center gap-12 py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(30rem,1.05fr)] lg:py-20">
          {/* Left: copy */}
          <div className="relative z-10">
            {/* Eyebrow chips */}
            <div className="mb-6 flex flex-wrap gap-2">
              <span className="pill-chip bg-white">
                <Sparkles className="h-3.5 w-3.5 text-butter" />
                Event planning that feels lighter
              </span>
              <span className="pill-chip bg-butter">No card required</span>
            </div>

            {/* Main headline */}
            <h1 className="balanced font-display text-[3.5rem] leading-[0.91] tracking-[-0.04em] text-ink sm:text-7xl lg:text-[5.5rem]">
              Effortless event planning for busy teams.
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-8 text-ink/55">
              Build the page, sell the seat, assign the room, welcome the guest, and read the
              room from one lively workspace.
            </p>

            {/* CTA buttons */}
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/signup" size="lg">
                Start Planning
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="#demo" variant="secondary" size="lg">
                <CirclePlay className="h-4 w-4" />
                See Live Demo
              </ButtonLink>
            </div>

            {/* Stat pills */}
            <div className="mt-8 flex flex-wrap gap-2">
              {["10k tickets sold", "98% check-in rate", "24/7 event pages"].map((item) => (
                <span key={item} className="stat-pill">
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right: collage */}
          <HeroCollage
            registrations={registrations}
            capacity={capacity}
            eventCount={featured.length}
          />
        </div>
      </section>

      {/* ── 2. FEATURE STRIP ────────────────────────────────────────── */}
      <section className="border-y border-ink/8 bg-white">
        <div className="page-shell grid gap-6 py-8 sm:grid-cols-3">
          {[
            [CalendarDays, "Plan", "Build rooms, tiers, and agendas."],
            [QrCode, "Check in", "Scan every guest with confidence."],
            [Users, "Understand", "Track demand as it happens."]
          ].map(([Icon, title, copy]) => {
            const ItemIcon = Icon as typeof CalendarDays;
            return (
              <div key={String(title)} className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-butter">
                  <ItemIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-xl">{String(title)}</p>
                  <p className="text-sm font-semibold text-ink/45">{String(copy)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 3. DEMO PREVIEW ─────────────────────────────────────────── */}
      <section id="demo" className="section-shell bg-paper">
        <div className="page-shell">
          <div className="mb-10 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="eyebrow text-ink/40">See it in action</p>
              <h2 className="mt-3 max-w-3xl font-display text-5xl leading-[0.93] tracking-[-0.04em] sm:text-6xl">
                A control room with a friendly face.
              </h2>
            </div>
            <span className="pill-chip bg-white">Live dashboard preview</span>
          </div>
          <DashboardPreview />
        </div>
      </section>

      {/* ── 4. HOW IT WORKS ─────────────────────────────────────────── */}
      <section id="how-it-works" className="section-shell bg-white">
        <div className="page-shell">
          <div className="grid gap-10 rounded-[2rem] border border-ink/8 bg-paper p-6 shadow-card lg:grid-cols-[0.9fr_1.1fr] lg:p-12">
            <div>
              <p className="eyebrow text-ink/40">How it works</p>
              <h2 className="mt-4 font-display text-5xl leading-[0.93] tracking-[-0.04em] sm:text-6xl">
                From first idea to full room.
              </h2>
              {/* Underline accent */}
              <div className="mt-5 h-2 w-28 rounded-full bg-butter" />
              <div className="mt-8 grid gap-4">
                {[
                  "Create a branded event page",
                  "Assign rooms, tiers, staff, and capacity",
                  "Watch registrations and scan guests at the door"
                ].map((item) => (
                  <p key={item} className="flex items-start gap-3 text-lg font-bold">
                    <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-butter">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                    {item}
                  </p>
                ))}
              </div>
            </div>
            <AppTreeMockup />
          </div>
        </div>
      </section>

      {/* ── 5. AMBER COLOR BLOCK ─────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-butter">
        <div className="dot-grid-ink pointer-events-none absolute inset-0 opacity-[0.06]" />
        <div className="page-shell relative z-10 grid gap-10 py-24 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <span className="pill-chip border-ink/15 bg-white">For operators</span>
            <h2 className="mt-6 max-w-4xl font-display text-5xl leading-[0.91] tracking-[-0.04em] sm:text-7xl">
              Every room, guest, and ticket stays on beat.
            </h2>
            <ButtonLink href="/signup" className="mt-10">
              Build your first event
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
          <div className="mascot mascot-amber" aria-hidden="true" />
        </div>
      </section>

      {/* ── 6. LAVENDER COLOR BLOCK ──────────────────────────────────── */}
      <section className="relative overflow-hidden bg-lavender">
        <div className="dot-grid-ink pointer-events-none absolute inset-0 opacity-[0.06]" />
        <div className="page-shell relative z-10 grid gap-10 py-24 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="mascot mascot-lavender order-2 lg:order-1" aria-hidden="true" />
          <div className="order-1 lg:order-2">
            <span className="pill-chip border-ink/15 bg-white">For organizers</span>
            <h2 className="mt-6 max-w-4xl font-display text-5xl leading-[0.91] tracking-[-0.04em] sm:text-7xl">
              Make the public page feel as prepared as your team.
            </h2>
            <ButtonLink href="/events" className="mt-10">
              Explore events
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ── 7. TRUSTED BRANDS ────────────────────────────────────────── */}
      <section className="border-y border-ink/8 bg-white">
        <div className="page-shell py-12">
          <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink/35">
            Trusted by teams planning rooms, stages, workshops, and launch nights
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {trusted.map((name) => (
              <span
                key={name}
                className="flex items-center justify-center rounded-full border border-ink/8 bg-fog px-4 py-3 font-display text-lg text-ink/25 grayscale"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. TESTIMONIALS ──────────────────────────────────────────── */}
      <section className="section-shell bg-paper">
        <div className="page-shell">
          <div className="mb-12 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="eyebrow text-ink/40">Organizer notes</p>
              <h2 className="mt-3 max-w-3xl font-display text-5xl leading-[0.93] tracking-[-0.04em] sm:text-6xl">
                Calm teams, packed rooms, better nights.
              </h2>
            </div>
            <span className="pill-chip bg-white">Real workflows, cleaner feel</span>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {testimonials.map((item, i) => (
              <article
                key={item.name}
                className={`editorial-card p-7 ${i === 1 ? "lg:mt-10" : ""}`}
              >
                <span className={`pill-chip ${item.tagColor}`}>{item.tag}</span>
                <p className="mt-8 text-xl font-bold leading-8 text-ink">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <div className="mt-8 border-t border-ink/8 pt-5">
                  <p className="font-display text-xl">{item.name}</p>
                  <p className="mt-0.5 text-sm font-semibold text-ink/45">{item.role}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9. FEATURED EVENTS ───────────────────────────────────────── */}
      {featured.length ? (
        <section className="section-shell bg-white">
          <div className="page-shell">
            <div className="mb-10 flex items-end justify-between gap-6">
              <div>
                <p className="eyebrow text-ink/40">Now accepting registrations</p>
                <h2 className="mt-3 font-display text-5xl leading-none tracking-[-0.04em] text-ink">
                  Upcoming events
                </h2>
              </div>
              <Link
                href="/events"
                className="hidden items-center gap-2 text-sm font-extrabold text-ink hover:underline sm:flex"
              >
                Browse the directory <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {featured.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── 10. DARK CTA FOOTER ──────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-midnight text-white">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-100" />
        <div className="page-shell relative z-10 py-24 text-center">
          <span className="pill-chip border-white/15 bg-white/8 text-white/70">
            Your next event can feel this organized
          </span>
          <h2 className="balanced mx-auto mt-8 max-w-5xl font-display text-5xl leading-[0.92] tracking-[-0.04em] sm:text-7xl">
            Give the guest list a home before the doors open.
          </h2>
          <div className="mt-10 flex justify-center">
            <ButtonLink href="/signup" variant="inverse" size="lg">
              Start Planning
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </div>
          {/* Mini stat pills */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {["Free to start", "No setup fees", "Cancel any time"].map((item) => (
              <span key={item} className="pill-chip border-white/15 bg-white/8 text-white/60">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
