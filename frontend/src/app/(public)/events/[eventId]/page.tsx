import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Clock3,
  MapPin,
  Radio,
  Users
} from "lucide-react";
import { API_URL, ApiError, publicApi } from "@/lib/api-client";
import { formatEventDate, locationLabel, percent } from "@/lib/utils";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { RegistrationPanel } from "@/components/public/registration-panel";
import { ShareButton } from "@/components/public/share-button";

type Params = Promise<{ eventId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { eventId } = await params;
  try {
    const event = await publicApi.event(eventId);
    const description = event.excerpt || event.description.slice(0, 155);
    return {
      title: event.title,
      description,
      openGraph: {
        type: "article",
        title: event.title,
        description,
        images: event.coverImageUrl ? [{ url: event.coverImageUrl }] : []
      }
    };
  } catch {
    return { title: "Event" };
  }
}

export default async function EventPage({ params }: { params: Params }) {
  const { eventId } = await params;
  let event;
  try {
    event = await publicApi.event(eventId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const capacityFill = percent(event.registeredCount, event.capacity);
  const calendarUrl = `${API_URL}/public/events/${encodeURIComponent(event.slug)}/calendar.ics`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    startDate: event.startsAt,
    endDate: event.endsAt,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode:
      event.venueType === "VIRTUAL"
        ? "https://schema.org/OnlineEventAttendanceMode"
        : event.venueType === "HYBRID"
          ? "https://schema.org/MixedEventAttendanceMode"
          : "https://schema.org/OfflineEventAttendanceMode",
    image: event.coverImageUrl ? [event.coverImageUrl] : undefined,
    location:
      event.venueType === "VIRTUAL"
        ? { "@type": "VirtualLocation", url: `${appUrl}/events/${event.slug}` }
        : {
            "@type": "Place",
            name: event.venueName,
            address: {
              "@type": "PostalAddress",
              streetAddress: event.address,
              addressLocality: event.city
            }
          },
    organizer: {
      "@type": "Organization",
      name: event.organization.name
    }
  };

  return (
    <main className="min-h-screen bg-paper pb-16 lg:pb-0">
      <SiteHeader dark />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c")
        }}
      />

      <section className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="page-shell py-6">
          <Link
            href="/events"
            className="focus-ring inline-flex items-center gap-2 rounded-md text-xs font-medium text-white/55 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to discovery
          </Link>
        </div>
        <div className="page-shell grid items-center gap-10 pb-12 lg:grid-cols-[.82fr_1.18fr] lg:pb-14">
          <div className="relative z-10 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-blue-400/30 bg-blue-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300">
                {event.category}
              </span>
              {event.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-white/15 px-2.5 py-1 text-[10px] font-medium text-white/55"
                >
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="balanced mt-6 font-display text-[clamp(2.6rem,5vw,4.8rem)] font-semibold leading-[1.04] tracking-[-0.045em]">
              {event.title}
            </h1>
            <p className="mt-7 max-w-xl text-sm leading-7 text-white/58 sm:text-base">
              {event.excerpt || event.description}
            </p>
            <div className="mt-8 flex items-center gap-3 border-t border-white/10 pt-6 text-xs text-white/55">
              <div className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/10 font-semibold text-white">
                {event.organization.name.charAt(0)}
              </div>
              <span>
                Presented by{" "}
                <Link
                  href={`/org/${encodeURIComponent(event.organization.slug)}`}
                  className="font-semibold text-white/90 underline decoration-white/25 underline-offset-4 hover:text-white"
                >
                  {event.organization.name}
                </Link>
              </span>
            </div>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-white/15 bg-white/5 shadow-lift">
            {event.coverImageUrl ? (
              <Image
                src={event.coverImageUrl}
                alt={`${event.title} cover`}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 55vw"
                className="object-cover"
              />
            ) : (
              <div className="paper-grid absolute inset-0 bg-slate-800" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-midnight/35 to-transparent" />
          </div>
        </div>
      </section>

      <section className="page-shell grid gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:py-16">
        <div>
          <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
            <div className="p-5 transition-colors hover:bg-slate-50">
              <CalendarDays className="h-4 w-4 text-coral" />
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Date
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">
                {formatEventDate(event.startsAt, {
                  timeZone: event.timezone,
                  weekday: "short",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: undefined,
                  minute: undefined
                })}
              </p>
            </div>
            <div className="p-5 transition-colors hover:bg-slate-50">
              <Clock3 className="h-4 w-4 text-coral" />
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Time
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">
                {formatEventDate(event.startsAt, {
                  timeZone: event.timezone,
                  year: undefined,
                  month: undefined,
                  day: undefined,
                  hour: "numeric",
                  minute: "2-digit"
                })}
              </p>
            </div>
            <div className="p-5 transition-colors hover:bg-slate-50">
              {event.venueType === "VIRTUAL" ? (
                <Radio className="h-4 w-4 text-coral" />
              ) : (
                <MapPin className="h-4 w-4 text-coral" />
              )}
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Place
              </p>
              <p className="mt-1.5 truncate text-sm font-semibold text-slate-900">{locationLabel(event)}</p>
            </div>
          </div>

          <div className="mt-12 grid gap-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-[9rem_1fr] sm:p-8">
            <h2 className="font-display text-2xl font-semibold text-slate-950">About</h2>
            <div className="prose-event whitespace-pre-line text-sm leading-7 text-ink/65">
              {event.description}
            </div>
          </div>

          {event.ticketTiers?.length ? (
            <div className="mt-5 grid gap-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-[9rem_1fr] sm:p-8">
              <h2 className="font-display text-2xl font-semibold text-slate-950">Tickets</h2>
              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70">
                {event.ticketTiers.map((tier) => {
                  const remaining = tier.remaining ?? Math.max(0, tier.capacity - (tier.registeredCount || 0));
                  return (
                    <div key={tier.id || tier.name} className="flex items-center justify-between gap-5 p-5">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{tier.name}</p>
                        {tier.description ? (
                          <p className="mt-1 text-xs leading-5 text-ink/50">{tier.description}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-[11px] font-bold text-ink/42">
                        {remaining > 0 ? `${remaining} left` : "Sold out"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-12 flex flex-wrap gap-3 border-t border-ink/12 pt-8">
            <a
              href={calendarUrl}
              className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Add to calendar
            </a>
            <ShareButton title={event.title} />
            <span className="inline-flex h-10 items-center gap-2 px-2 text-xs font-semibold text-ink/42">
              <Users className="h-3.5 w-3.5" />
              {capacityFill}% of places reserved
            </span>
          </div>
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <RegistrationPanel event={event} />
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
