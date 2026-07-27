"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import {
  CalendarPlus,
  Check,
  LoaderCircle,
  LockKeyhole,
  Ticket,
  X
} from "lucide-react";
import { publicApi } from "@/lib/api-client";
import type { EventDetail, RegistrationResult } from "@/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { formatEventDate } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

export function RegistrationPanel({ event }: { event: EventDetail }) {
  const { user } = useAuth();
  const toast = useToast();
  const availableTiers = useMemo(
    () => (event.ticketTiers || []).filter((tier) => (tier.remaining ?? tier.capacity) > 0),
    [event.ticketTiers]
  );
  const [tierId, setTierId] = useState(availableTiers[0]?.id || "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const soldOut = availableTiers.length === 0;

  useEffect(() => {
    if (!user) return;
    setName((current) => current || user.name);
    setEmail((current) => current || user.email);
  }, [user]);

  useEffect(() => {
    if (!result) return;
    if (result.qrCodeDataUrl || result.registration.qrCodeDataUrl) {
      setQrDataUrl(result.qrCodeDataUrl || result.registration.qrCodeDataUrl || "");
      return;
    }
    void QRCode.toDataURL(result.registration.checkInCode, {
      width: 360,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" }
    }).then(setQrDataUrl);
  }, [result]);

  async function submit(eventSubmit: React.FormEvent) {
    eventSubmit.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await publicApi.register(event.id, {
        ticketTierId: tierId,
        attendeeName: name.trim(),
        attendeeEmail: email.trim(),
        marketingConsent
      });
      setResult(response);
      setMobileOpen(true);
      toast.success("Registration confirmed", {
        description: `Your ticket for ${event.title} is ready.`
      });
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Registration failed.";
      setError(message);
      toast.error("Registration could not be completed", { description: message });
    } finally {
      setPending(false);
    }
  }

  const content = result ? (
    <div className="text-center" aria-live="polite">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-8 ring-emerald-50/40">
        <Check className="h-5 w-5" strokeWidth={3} />
      </div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
        Registration confirmed
      </p>
      <h2 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-[-.03em]">Your place is confirmed</h2>
      <p className="mx-auto mt-3 max-w-xs text-xs leading-5 text-ink/55">
        We sent the details to {result.registration.attendeeEmail}. Show this code at the door.
      </p>
      {qrDataUrl ? (
        <div className="mx-auto mt-5 w-48 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <Image src={qrDataUrl} alt="Your check-in QR code" width={360} height={360} unoptimized />
        </div>
      ) : (
        <div className="mx-auto mt-5 h-48 w-48 animate-pulse rounded-2xl bg-ink/5" />
      )}
      <p className="mt-3 font-mono text-xs font-bold tracking-[0.16em]">
        {result.registration.checkInCode}
      </p>
      {result.calendarUrl ? (
        <a
          href={result.calendarUrl}
          className="focus-ring mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-xs font-semibold hover:bg-slate-50"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Add to calendar
        </a>
      ) : null}
    </div>
  ) : (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700">
        Reserve your place
        </p>
        {!soldOut ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[8px] font-semibold uppercase tracking-wider text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Open
          </span>
        ) : null}
      </div>
      <h2 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-[-.03em]">
        {soldOut ? "Registration is full" : "Register for this event"}
      </h2>
      <p className="mt-3 text-xs leading-5 text-ink/55">
        {formatEventDate(event.startsAt, {
          timeZone: event.timezone,
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          year: undefined
        })}
      </p>
      {soldOut ? (
        <div className="mt-6 rounded-xl bg-ink/[0.05] p-4 text-sm leading-6 text-ink/60">
          Every ticket tier is currently at capacity.
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4 border-t border-slate-200 pt-5">
          <Field label="Ticket">
            <Select value={tierId} onChange={(input) => setTierId(input.target.value)} required>
              {availableTiers.map((tier) => (
                <option key={tier.id || tier.name} value={tier.id}>
                  {tier.name} · {tier.remaining ?? tier.capacity} remaining
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Your name">
            <Input
              value={name}
              onChange={(input) => setName(input.target.value)}
              autoComplete="name"
              placeholder="Maya Chen"
              required
            />
          </Field>
          <Field label="Email address">
            <Input
              type="email"
              value={email}
              onChange={(input) => setEmail(input.target.value)}
              autoComplete="email"
              placeholder="maya@example.com"
              required
            />
          </Field>
          {!user ? (
            <p className="text-[10px] leading-4 text-ink/40">
              Checking out as a guest.{" "}
              <a href="/login" className="font-bold text-ink underline underline-offset-3">
                Sign in
              </a>{" "}
              to keep all your tickets together.
            </p>
          ) : null}
          <label className="flex cursor-pointer gap-3 text-[11px] leading-5 text-ink/50">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(input) => setMarketingConsent(input.target.checked)}
            className="mt-1 h-3.5 w-3.5 rounded accent-blue-600"
            />
            Send me occasional updates from {event.organization.name}. Registration emails are
            always sent.
          </label>
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="coral" className="w-full" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
            {pending ? "Registering…" : "Complete registration"}
          </Button>
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-ink/40">
            <LockKeyhole className="h-3 w-3" />
            Your information is sent securely
          </div>
        </form>
      )}
    </>
  );

  return (
    <>
      <aside className="interactive-card hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card lg:block">
        <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />
        <div className="p-6">{content}</div>
      </aside>
      {!mobileOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-12px_30px_rgba(15,23,42,.08)] backdrop-blur-xl lg:hidden">
          <Button
            variant="coral"
            className="w-full"
            disabled={!result && soldOut}
            onClick={() => setMobileOpen(true)}
          >
            <Ticket className="h-4 w-4" />
            {result ? "View your pass" : soldOut ? "Sold out" : "Register now"}
          </Button>
        </div>
      ) : null}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/45 p-3 backdrop-blur-md lg:hidden">
          <div className="mx-auto mt-8 max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift">
            <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />
            <div className="p-6">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Close"
              onClick={() => setMobileOpen(false)}
              className="ml-auto"
            >
              <X className="h-4 w-4" />
            </Button>
            {content}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
