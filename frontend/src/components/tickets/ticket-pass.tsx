"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { CalendarPlus, Check, Clock3, MapPin } from "lucide-react";
import type { Registration } from "@/types";
import { registrationsApi } from "@/lib/api-client";
import { formatEventDate, locationLabel } from "@/lib/utils";

export function TicketPass({ registration }: { registration: Registration }) {
  const [qrDataUrl, setQrDataUrl] = useState(registration.qrCodeDataUrl || "");
  const cancelled = registration.status === "CANCELLED";
  const past = new Date(registration.event.endsAt).getTime() < Date.now();
  const statusLabel = cancelled
    ? "Cancelled"
    : registration.status === "CHECKED_IN"
      ? "Checked in"
      : past
        ? "Past event"
        : "Confirmed";

  useEffect(() => {
    if (qrDataUrl) return;
    void QRCode.toDataURL(registration.checkInCode, {
      width: 360,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" }
    }).then(setQrDataUrl);
  }, [qrDataUrl, registration.checkInCode]);

  return (
    <article className="interactive-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="relative p-6 sm:p-8">
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />
          <div className="flex items-center justify-between gap-4">
            <span
              className={`rounded-md px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ${
                cancelled
                  ? "bg-red-100 text-red-700"
                  : past
                    ? "bg-ink/[0.07] text-ink/45"
                    : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {statusLabel}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-ink/30">
              {registration.ticketTier.name}
            </span>
          </div>
          <h2 className="balanced mt-7 font-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950">
            {registration.event.title}
          </h2>
          <div className="mt-6 grid gap-3 text-xs font-semibold text-ink/52 sm:grid-cols-2">
            <p className="flex items-center gap-2">
              <Clock3 className="h-3.5 w-3.5 text-coral" />
              {formatEventDate(registration.event.startsAt, {
                timeZone: registration.event.timezone
              })}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-coral" />
              {locationLabel(registration.event)}
            </p>
          </div>
          <div className="mt-8 border-t border-dashed border-ink/15 pt-5">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink/30">Guest</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{registration.attendeeName}</p>
            <p className="mt-1 text-[10px] text-ink/38">{registration.attendeeEmail}</p>
          </div>
          {!cancelled && !past ? (
            <a
              href={registrationsApi.calendarUrl(registration.id)}
              className="focus-ring mt-6 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-[10px] font-semibold shadow-sm transition hover:bg-slate-50"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Add to calendar
            </a>
          ) : null}
        </div>
        <div className="metric-grid relative flex flex-col items-center justify-center border-t border-dashed border-slate-300 bg-slate-50 p-6 md:border-l md:border-t-0">
          <span className="absolute -left-3 -top-3 hidden h-6 w-6 rounded-full border border-ink/12 bg-paper md:block" />
          <span className="absolute -bottom-3 -left-3 hidden h-6 w-6 rounded-full border border-ink/12 bg-paper md:block" />
          {cancelled ? (
            <div className="grid h-[220px] w-[220px] place-items-center rounded-2xl border border-dashed border-red-200 bg-red-50 p-6 text-center">
              <div>
                <p className="text-xs font-semibold text-red-700">Pass inactive</p>
                <p className="mt-2 text-[10px] leading-4 text-red-700/60">
                  This registration was cancelled and cannot be scanned.
                </p>
              </div>
            </div>
          ) : qrDataUrl ? (
            <Image src={qrDataUrl} alt="Check-in QR code" width={220} height={220} unoptimized />
          ) : (
            <div className="skeleton h-[220px] w-[220px] rounded-xl" />
          )}
          {!cancelled ? (
            <>
              <p className="mt-3 font-mono text-[10px] font-bold tracking-[0.16em] text-ink/48">
                {registration.checkInCode}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-[9px] text-ink/32">
                <Check className="h-3 w-3 text-[#167c5a]" />
                {past ? "This event has ended" : "Show this code at the door"}
              </p>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
