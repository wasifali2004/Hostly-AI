import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MapPin, Radio } from "lucide-react";
import type { EventSummary } from "@/types";
import { formatShortDate, locationLabel, percent } from "@/lib/utils";

const accentColors = [
  "bg-butter text-ink",
  "bg-lavender text-ink",
  "bg-ink text-white",
  "bg-coral/15 text-ink",
];

export function EventCard({
  event,
  priority = false,
  featured = false,
  index = 0
}: {
  event: EventSummary;
  priority?: boolean;
  featured?: boolean;
  index?: number;
}) {
  const fill = percent(event.registeredCount, event.capacity);
  const accentClass = accentColors[index % accentColors.length];

  return (
    <article
      className={[
        "group interactive-card overflow-hidden rounded-[1.5rem] border border-ink/8 bg-white shadow-card",
        featured ? "md:grid md:grid-cols-[1.25fr_1fr]" : ""
      ].join(" ")}
    >
      {/* Cover image */}
      <Link
        href={`/events/${event.id}`}
        className={[
          "relative block overflow-hidden",
          featured ? "aspect-[16/11] md:aspect-auto md:min-h-[27rem]" : "aspect-[4/3]"
        ].join(" ")}
      >
        {event.coverImageUrl ? (
          <Image
            src={event.coverImageUrl}
            alt=""
            fill
            priority={priority}
            sizes={
              featured
                ? "(max-width: 768px) 100vw, 58vw"
                : "(max-width: 768px) 100vw, 33vw"
            }
            className="object-cover transition duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="dot-grid-ink absolute inset-0 bg-fog" />
        )}

        {/* Category pill */}
        <span className="pill-chip absolute left-4 top-4 border-white/60 bg-white/90 backdrop-blur text-ink/75 shadow-sm">
          {event.category}
        </span>
      </Link>

      {/* Card body */}
      <div className={["flex flex-col p-5", featured ? "md:p-7" : ""].join(" ")}>
        {/* Date + fill row */}
        <div className="flex items-center justify-between gap-3">
          <span className={["rounded-full px-3 py-1 text-[10px] font-extrabold", accentClass].join(" ")}>
            {formatShortDate(event.startsAt, event.timezone)}
          </span>
          <span className="text-[10px] font-bold text-ink/35">{fill}% reserved</span>
        </div>

        {/* Title */}
        <h3
          className={[
            "balanced mt-3 font-display leading-tight tracking-[-0.025em] text-ink",
            featured ? "text-3xl sm:text-4xl" : "text-xl"
          ].join(" ")}
        >
          <Link href={`/events/${event.id}`} className="focus-ring rounded">
            {event.title}
          </Link>
        </h3>

        {/* Excerpt */}
        <p
          className={[
            "mt-3 line-clamp-2 leading-6 text-ink/50",
            featured ? "text-sm" : "text-[13px]"
          ].join(" ")}
        >
          {event.excerpt || event.description}
        </p>

        {/* Footer row */}
        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ink/50">
            {event.venueType === "VIRTUAL" ? (
              <Radio className="h-3.5 w-3.5 shrink-0 text-coral" />
            ) : (
              <MapPin className="h-3.5 w-3.5 shrink-0 text-coral" />
            )}
            <span className="truncate">{locationLabel(event)}</span>
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink/10 bg-fog text-ink/50 transition duration-200 group-hover:border-ink group-hover:bg-ink group-hover:text-white">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </article>
  );
}
