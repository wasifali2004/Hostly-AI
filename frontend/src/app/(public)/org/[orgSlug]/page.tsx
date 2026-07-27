import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarRange, Users } from "lucide-react";
import { ApiError, publicApi } from "@/lib/api-client";
import { EventCard } from "@/components/public/event-card";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { EmptyState } from "@/components/ui/status";

type Params = Promise<{ orgSlug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { orgSlug } = await params;
  try {
    const { organization } = await publicApi.organization(orgSlug);
    return {
      title: organization.name,
      description:
        organization.description ||
        `Discover published events from ${organization.name} on Hostly.`
    };
  } catch {
    return { title: "Organization" };
  }
}

export default async function PublicOrganizationPage({ params }: { params: Params }) {
  const { orgSlug } = await params;
  let profile;
  try {
    profile = await publicApi.organization(orgSlug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const { organization, events, totalEvents } = profile;

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="border-b border-slate-200 bg-white">
        <div className="page-shell py-10 sm:py-14">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All events
          </Link>
          <div className="mt-10 grid items-end gap-8 lg:grid-cols-[1fr_auto]">
            <div className="flex items-start gap-5">
              {organization.logoUrl ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <Image
                    src={organization.logoUrl}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-blue-700 bg-blue-600 font-display text-2xl font-semibold text-white shadow-sm">
                  {organization.name.charAt(0)}
                </span>
              )}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-700">
                  Organization
                </p>
                <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-[-.04em] sm:text-5xl">
                  {organization.name}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                  {organization.description ||
                    "Independent gatherings, thoughtfully produced and clearly hosted."}
                </p>
              </div>
            </div>
            <div className="flex gap-8 border-t border-ink/12 pt-5 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <div>
                <CalendarRange className="h-4 w-4 text-coral" />
                <p className="mt-3 text-2xl font-semibold text-slate-950">{totalEvents}</p>
                <p className="text-[9px] font-medium uppercase tracking-[.1em] text-slate-500">
                  Published
                </p>
              </div>
              {organization._count?.memberships !== undefined ? (
                <div>
                  <Users className="h-4 w-4 text-emerald-700" />
                  <p className="mt-3 text-2xl font-semibold text-slate-950">
                    {organization._count.memberships}
                  </p>
                  <p className="text-[9px] font-medium uppercase tracking-[.1em] text-slate-500">
                    Team
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell py-14 sm:py-20">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-700">
              Upcoming events
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-slate-950">Published events</h2>
          </div>
          <Link href="/events" className="hidden items-center gap-2 text-xs font-bold sm:flex">
            Explore Hostly
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {events.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No published events yet"
            message={`${organization.name} has not added an upcoming event to its public calendar.`}
          />
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
