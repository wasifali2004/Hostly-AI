"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  Compass,
  LockKeyhole,
  Ticket,
  TicketCheck
} from "lucide-react";
import type { Registration } from "@/types";
import { registrationsApi } from "@/lib/api-client";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { TicketPass } from "@/components/tickets/ticket-pass";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/status";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export default function AttendeeDashboardPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"upcoming" | "past" | "cancelled">("upcoming");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTickets(await registrationsApi.mine());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Tickets could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const now = Date.now();
  const visibleTickets = tickets.filter((ticket) => {
    if (view === "cancelled") return ticket.status === "CANCELLED";
    if (ticket.status === "CANCELLED") return false;
    const isPast = new Date(ticket.event.endsAt).getTime() < now;
    return view === "past" ? isPast : !isPast;
  });

  const firstName = user?.name?.split(" ")[0];

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />

      {/* ── Hero banner ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-midnight text-white">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-100" />
        <div className="page-shell relative z-10 flex flex-col justify-between gap-8 py-14 sm:flex-row sm:items-end sm:py-18">
          <div>
            <p className="eyebrow text-butter/80">Your event wallet</p>
            <h1 className="mt-3 font-display text-4xl leading-[0.93] tracking-[-0.04em] sm:text-5xl">
              Welcome back{firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/50">
              Your upcoming plans, check-in credentials, and event history—kept together and
              ready at the door.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/events" variant="amber" size="sm">
              <Compass className="h-3.5 w-3.5" />
              Discover events
            </ButtonLink>
            <ButtonLink
              href="/dashboard/privacy"
              variant="secondary"
              size="sm"
              className="border-white/15 bg-white/8 text-white hover:bg-white/12 hover:text-white"
            >
              <LockKeyhole className="h-3.5 w-3.5" />
              Privacy
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ── Main content ─────────────────────────────────────────── */}
      <section className="page-shell min-h-[28rem] py-10 sm:py-14">

        {/* Stat cards */}
        {!loading && !error ? (
          <div className="mb-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: TicketCheck,
                label: "All passes",
                value: tickets.length,
                color: "bg-butter",
                iconColor: "text-ink"
              },
              {
                icon: CalendarCheck2,
                label: "Upcoming",
                value: tickets.filter(
                  (t) => t.status !== "CANCELLED" && new Date(t.event.endsAt).getTime() >= now
                ).length,
                color: "bg-lavender",
                iconColor: "text-ink"
              },
              {
                icon: Building2,
                label: "Workspaces",
                value:
                  user?.memberships.filter((m) => m.role !== "ATTENDEE").length || 0,
                color: "bg-ink",
                iconColor: "text-white"
              }
            ].map(({ icon: Icon, label, value, color, iconColor }) => (
              <div
                key={label}
                className="editorial-card flex items-center gap-5 p-6"
              >
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${color} ${iconColor}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-3xl tracking-tight">{String(value)}</p>
                  <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/40">
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Workspace cards */}
        {user?.memberships.some((m) => m.role !== "ATTENDEE") ? (
          <div className="mb-10 rounded-[1.75rem] border border-ink/8 bg-white p-6 shadow-card sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <p className="eyebrow text-ink/40">Workspaces you manage</p>
              <span className="pill-chip bg-fog">Organizer access</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {user.memberships
                .filter((m) => m.role !== "ATTENDEE")
                .map((membership) => (
                  <Card
                    key={membership.organizationId}
                    className="interactive-card group p-5"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-butter text-ink">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <h2 className="mt-5 text-sm font-extrabold text-ink">
                      {membership.organization.name}
                    </h2>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-ink/40">
                      {membership.role.replace("_", " ")}
                    </p>
                    <Link
                      href={`/org/${encodeURIComponent(membership.organization.slug)}/dashboard`}
                      className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-ink hover:underline"
                    >
                      Manage workspace
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Card>
                ))}
            </div>
          </div>
        ) : null}

        {/* Tab filter pills */}
        {!loading && !error && tickets.length ? (
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex gap-1.5 overflow-x-auto rounded-full border border-ink/10 bg-white p-1.5 shadow-sm">
              {(["upcoming", "past", "cancelled"] as const).map((item) => {
                const count = tickets.filter((t) => {
                  if (item === "cancelled") return t.status === "CANCELLED";
                  if (t.status === "CANCELLED") return false;
                  const isPast = new Date(t.event.endsAt).getTime() < now;
                  return item === "past" ? isPast : !isPast;
                }).length;
                return (
                  <Button
                    key={item}
                    type="button"
                    size="sm"
                    variant={view === item ? "primary" : "ghost"}
                    onClick={() => setView(item)}
                    className="h-9 shrink-0 px-4 text-[11px] capitalize"
                  >
                    {item}{" "}
                    <span className="ml-1 opacity-50">{count}</span>
                  </Button>
                );
              })}
            </div>
            <p className="hidden text-[10px] text-ink/35 sm:block">
              Passes update automatically after registration
            </p>
          </div>
        ) : null}

        {/* Ticket list / states */}
        {loading ? (
          <LoadingBlock label="Finding your passes…" />
        ) : error ? (
          <ErrorState
            title="Your tickets are unavailable"
            message={error}
            onRetry={() => void load()}
          />
        ) : tickets.length === 0 ? (
          <EmptyState
            title="No tickets yet"
            message="When you register with this account, your confirmed passes appear here."
            action={
              <ButtonLink href="/events" variant="primary" size="sm">
                <Ticket className="h-3.5 w-3.5" />
                Discover events
              </ButtonLink>
            }
          />
        ) : visibleTickets.length === 0 ? (
          <EmptyState
            title={`No ${view} tickets`}
            message={
              view === "upcoming"
                ? "Browse the calendar and reserve a place in your next room."
                : `You do not have any ${view} registrations.`
            }
            action={
              view === "upcoming" ? (
                <ButtonLink href="/events" variant="primary" size="sm">
                  Discover events
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-5">
            {visibleTickets.map((ticket) => (
              <TicketPass key={ticket.id} registration={ticket} />
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
