import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import { publicApi } from "@/lib/api-client";
import { EventCard } from "@/components/public/event-card";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { ErrorState, EmptyState } from "@/components/ui/status";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search : "";
  const category = typeof params.category === "string" ? params.category : "";
  const city = typeof params.location === "string" ? params.location : "";
  const dateFrom = typeof params.dateFrom === "string" ? params.dateFrom : "";
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);
  const apiLocation = city.trim().toLowerCase() === "online" ? "VIRTUAL" : city;

  let data = null;
  let error = "";
  try {
    data = await publicApi.events({
      search,
      category,
      location: apiLocation,
      dateFrom,
      dateTo,
      page,
      pageSize: 12
    });
  } catch (requestError) {
    error = requestError instanceof Error ? requestError.message : "Events are unavailable.";
  }

  const events = data?.items || [];
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / 12));
  const pageHref = (nextPage: number) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === "string" && key !== "page" && value) query.set(key, value);
    });
    query.set("page", String(nextPage));
    return `/events?${query.toString()}#results`;
  };

  const categories = data?.facets?.categories || [
    "Business",
    "Community",
    "Design",
    "Technology",
    "Climate"
  ];

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />

      {/* ── Hero header ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-midnight text-white">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-100" />
        <div className="page-shell relative z-10 py-16 sm:py-20">
          <p className="eyebrow text-butter/80">Event directory</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_.5fr] lg:items-end">
            <h1 className="max-w-4xl font-display text-4xl leading-[0.93] tracking-[-0.04em] sm:text-6xl">
              Discover events worth showing up for.
            </h1>
            <p className="max-w-xl text-sm leading-7 text-white/55">
              Search public events from verified organizations. Filter by topic, date, format,
              or location and register directly with the host.
            </p>
          </div>

          {/* Quick category pill chips */}
          <div className="mt-8 flex flex-wrap gap-2">
            <a
              href="/events"
              className={`filter-chip ${!category ? "filter-chip-active" : "border-white/20 bg-white/10 text-white/65 hover:border-white/40 hover:text-white"}`}
            >
              All
            </a>
            {categories.map((cat) => (
              <a
                key={cat}
                href={`/events?category=${encodeURIComponent(cat)}`}
                className={`filter-chip ${
                  category === cat
                    ? "filter-chip-active"
                    : "border-white/20 bg-white/10 text-white/65 hover:border-white/40 hover:text-white"
                }`}
              >
                {cat}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Filter & results ─────────────────────────────────────── */}
      <section id="results" className="page-shell scroll-mt-4 py-10 sm:py-14">

        {/* Search form */}
        <form
          method="get"
          className="grid gap-3 rounded-[1.75rem] border border-ink/8 bg-white p-5 shadow-card sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1.5fr)_1fr_1fr_1fr_1fr_auto]"
        >
          {/* Search input */}
          <label className="flex h-12 items-center gap-3 rounded-full border border-ink/12 bg-fog px-4 focus-within:border-ink/35 focus-within:bg-white focus-within:ring-0 transition-colors">
            <Search className="h-4 w-4 shrink-0 text-ink/35" />
            <span className="sr-only">Search events</span>
            <input
              name="search"
              defaultValue={search}
              placeholder="Search events or organizers"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink/35"
            />
          </label>

          {/* Location input */}
          <label className="flex h-12 items-center gap-3 rounded-full border border-ink/12 bg-fog px-4 focus-within:border-ink/35 focus-within:bg-white transition-colors">
            <MapPin className="h-4 w-4 shrink-0 text-ink/35" />
            <span className="sr-only">Location</span>
            <input
              type="text"
              name="location"
              defaultValue={city}
              placeholder="City or online"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink/35"
              list="event-cities"
            />
            <datalist id="event-cities">
              {(data?.facets?.cities || []).map((item) => (
                <option key={item} value={item} />
              ))}
              <option value="online" />
            </datalist>
          </label>

          {/* Category select */}
          <div className="relative">
            <SlidersHorizontal
              className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink/35"
              aria-hidden="true"
            />
            <Select
              name="category"
              defaultValue={category}
              aria-label="Category"
              className="h-12 rounded-full border-ink/12 bg-fog pl-11 text-sm hover:border-ink/25"
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </div>

          {/* Date from */}
          <label className="flex h-12 items-center gap-3 rounded-full border border-ink/12 bg-fog px-4 focus-within:border-ink/35 focus-within:bg-white transition-colors">
            <CalendarDays className="h-4 w-4 shrink-0 text-ink/35" />
            <span className="sr-only">Earliest date</span>
            <input
              type="date"
              name="dateFrom"
              defaultValue={dateFrom}
              className="w-full bg-transparent text-sm text-ink outline-none"
            />
          </label>

          {/* Date to */}
          <label className="flex h-12 items-center gap-3 rounded-full border border-ink/12 bg-fog px-4 focus-within:border-ink/35 focus-within:bg-white transition-colors">
            <CalendarDays className="h-4 w-4 shrink-0 text-ink/35" />
            <span className="sr-only">Latest date</span>
            <input
              type="date"
              name="dateTo"
              defaultValue={dateTo}
              min={dateFrom || undefined}
              className="w-full bg-transparent text-sm text-ink outline-none"
            />
          </label>

          <Button type="submit" variant="primary" className="h-12 px-6">
            <Search className="h-3.5 w-3.5" />
            Search
          </Button>
        </form>

        {/* Results header */}
        <div className="mb-8 mt-10 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl tracking-[-0.03em] text-ink">
              Upcoming events
            </h2>
            {data ? (
              <p className="mt-1 text-sm font-semibold text-ink/45">
                {data.total} {data.total === 1 ? "event" : "events"} found
              </p>
            ) : null}
          </div>
          {/* Active filters as pills */}
          {(search || category || city) ? (
            <div className="hidden items-center gap-2 sm:flex">
              {search && <span className="filter-chip filter-chip-active">{search}</span>}
              {category && <span className="filter-chip filter-chip-active">{category}</span>}
              {city && <span className="filter-chip filter-chip-active">{city}</span>}
              <a href="/events" className="filter-chip">Clear all</a>
            </div>
          ) : null}
        </div>

        {/* Events grid */}
        {error ? (
          <ErrorState
            title="The event directory is unavailable"
            message={`${error} Check that the backend is running and NEXT_PUBLIC_API_URL is correct.`}
          />
        ) : events.length === 0 ? (
          <EmptyState
            title="No events match these filters"
            message="Try a broader phrase, a different date range, or remove one of the filters."
          />
        ) : (
          <div className="space-y-8">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event, i) => (
                <EventCard key={event.id} event={event} priority={i < 3} index={i} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 ? (
              <nav
                className="flex items-center justify-between border-t border-ink/8 pt-8"
                aria-label="Event results pages"
              >
                {page > 1 ? (
                  <a
                    href={pageHref(page - 1)}
                    className="focus-ring inline-flex h-11 items-center gap-2 rounded-full border border-ink/15 bg-white px-5 text-sm font-bold text-ink hover:border-ink/30 hover:shadow-sm transition-all"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Previous
                  </a>
                ) : (
                  <span />
                )}
                <span className="text-xs font-bold text-ink/40">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages ? (
                  <a
                    href={pageHref(page + 1)}
                    className="focus-ring inline-flex h-11 items-center gap-2 rounded-full border border-ink bg-ink px-5 text-sm font-bold text-white hover:bg-black transition-colors"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </div>
        )}
      </section>

      {/* ── Organizer CTA — amber block ──────────────────────────── */}
      <section className="relative overflow-hidden bg-butter">
        <div className="dot-grid-ink pointer-events-none absolute inset-0 opacity-[0.06]" />
        <div className="page-shell relative z-10 grid gap-8 py-16 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="eyebrow text-ink/50">Organizing an event?</p>
            <h2 className="mt-3 font-display text-3xl leading-[0.93] tracking-[-0.035em] text-ink sm:text-4xl">
              Publish, register, and operate it with Hostly AI.
            </h2>
          </div>
          <a
            href="/signup"
            className="button-polish focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-full border border-ink bg-ink px-6 text-sm font-bold text-white transition-[box-shadow,transform] hover:bg-black"
          >
            <Sparkles className="h-4 w-4" />
            Create a workspace
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
