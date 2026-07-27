import { clsx, type ClassValue } from "./utils-clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatEventDate(value: string, options?: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...options
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  }
}

export function formatShortDate(value: string, timeZone?: string) {
  try {
    return new Intl.DateTimeFormat("en", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("en", {
      weekday: "short",
      month: "short",
      day: "numeric"
    }).format(new Date(value));
  }
}

function partsRecord(parts: Intl.DateTimeFormatPart[]) {
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

export function isoToZonedLocal(value: string, timeZone = "UTC") {
  try {
    const parts = partsRecord(
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }).formatToParts(new Date(value))
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  } catch {
    return value.slice(0, 16);
  }
}

function timeZoneOffsetAt(instant: Date, timeZone: string) {
  const parts = partsRecord(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(instant)
  );
  const representedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return representedAsUtc - instant.getTime();
}

/**
 * Converts the wall-clock value from a datetime-local input into UTC using the
 * event's chosen IANA timezone rather than the organizer's browser timezone.
 */
export function zonedLocalToIso(localValue: string, timeZone: string) {
  const match = localValue.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!match) return new Date(localValue).toISOString();

  const desiredWallClock = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0)
  );
  try {
    const firstOffset = timeZoneOffsetAt(new Date(desiredWallClock), timeZone);
    let instant = desiredWallClock - firstOffset;
    const correctedOffset = timeZoneOffsetAt(new Date(instant), timeZone);
    if (correctedOffset !== firstOffset) instant = desiredWallClock - correctedOffset;
    return new Date(instant).toISOString();
  } catch {
    return new Date(localValue).toISOString();
  }
}

export function initials(name?: string) {
  return (name || "Hostly User")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function locationLabel(event: {
  venueType: "PHYSICAL" | "VIRTUAL" | "HYBRID";
  venueName?: string | null;
  city?: string | null;
}) {
  if (event.venueType === "VIRTUAL") return "Online";
  const place =
    [event.venueName, event.city].filter(Boolean).join(", ") || "Location to be announced";
  return event.venueType === "HYBRID" ? `${place} + online` : place;
}

export function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

export function eventIsPast(event: { endsAt: string }) {
  return new Date(event.endsAt).getTime() < Date.now();
}
