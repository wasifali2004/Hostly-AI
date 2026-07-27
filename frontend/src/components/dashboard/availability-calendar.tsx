"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfDay,
  format,
  startOfDay
} from "date-fns";
import { ArrowLeft, CalendarRange, LoaderCircle, RefreshCw } from "lucide-react";
import { venuesApi } from "@/lib/api-client";
import type { AvailabilityResponse, RoomBooking, Venue } from "@/types";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { EmptyState, ErrorState } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";

function inputDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function intersectsDay(booking: RoomBooking, day: Date) {
  return (
    new Date(booking.startsAt).getTime() < endOfDay(day).getTime() &&
    new Date(booking.endsAt).getTime() > startOfDay(day).getTime()
  );
}

export function AvailabilityCalendar({
  organizationId,
  orgSlug
}: {
  organizationId: string;
  orgSlug: string;
}) {
  const toast = useToast();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [from, setFrom] = useState(() => inputDate(new Date()));
  const [to, setTo] = useState(() => inputDate(addDays(new Date(), 6)));
  const [venueId, setVenueId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!from || !to) return;
    const fromDate = startOfDay(new Date(`${from}T00:00:00`));
    const toDate = endOfDay(new Date(`${to}T00:00:00`));
    if (toDate < fromDate) {
      setError("The end date must be on or after the start date.");
      toast.error("Date range is invalid", {
        description: "The end date must be on or after the start date."
      });
      return;
    }
    if (addDays(fromDate, 31) < toDate) {
      setError("Choose a range of 31 days or fewer for a readable calendar.");
      toast.info("Choose a shorter calendar window", {
        description: "Room availability supports a range of up to 31 days."
      });
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [venueItems, result] = await Promise.all([
        venuesApi.list(organizationId),
        venuesApi.availability(organizationId, {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          venueId: venueId || undefined
        })
      ]);
      setVenues(venueItems);
      setAvailability(result);
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Availability could not load.";
      setError(message);
      toast.error("Could not load availability", { description: message });
    } finally {
      setLoading(false);
    }
  }, [from, organizationId, toast, to, venueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = useMemo(() => {
    if (!from || !to) return [];
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    return end >= start ? eachDayOfInterval({ start, end }) : [];
  }, [from, to]);

  const bookings = useMemo(
    () =>
      availability?.rooms
        .flatMap((room) =>
          room.bookings.map((booking) => ({
            ...booking,
            roomId: room.id,
            roomName: room.name,
            venueName: room.venueName
          }))
        )
        .sort(
          (first, second) =>
            new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()
        ) ?? [],
    [availability]
  );

  const base = `/org/${encodeURIComponent(orgSlug)}`;

  return (
    <div className="animate-fade-up">
      <ButtonLink href={`${base}/venues`} variant="ghost" size="sm" className="-ml-3">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to venues
      </ButtonLink>
      <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-700">
            Space schedule
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.035em] text-slate-950">
            Room availability
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            See occupied and available rooms across the selected date window.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <Card className="mt-7 p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Venue">
            <Select value={venueId} onChange={(event) => setVenueId(event.target.value)}>
              <option value="">All venues</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
        </div>
      </Card>

      {error ? (
        <div className="mt-5">
          <ErrorState title="Availability is unavailable" message={error} onRetry={() => void load()} />
        </div>
      ) : null}

      <Card className="mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">
              Calendar grid
            </p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">
              {availability?.rooms.length ?? 0} bookable rooms
            </h3>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-medium text-slate-500">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
              Booked
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm border border-emerald-200 bg-emerald-50" />
              Available
            </span>
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center">
            <div className="text-center text-xs font-medium text-slate-500">
              <LoaderCircle className="mx-auto mb-3 h-5 w-5 animate-spin text-blue-600" />
              Loading room schedules…
            </div>
          </div>
        ) : availability?.rooms.length ? (
          <div className="overflow-x-auto">
            <div
              className="grid min-w-max"
              style={{
                gridTemplateColumns: `13rem repeat(${days.length}, minmax(7.5rem, 1fr))`
              }}
            >
              <div className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-[9px] font-semibold uppercase tracking-[.1em] text-slate-500">
                Room
              </div>
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className="border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-center last:border-r-0"
                >
                  <p className="text-[9px] font-semibold uppercase tracking-[.08em] text-slate-400">
                    {format(day, "EEE")}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    {format(day, "MMM d")}
                  </p>
                </div>
              ))}

              {availability.rooms.map((room) => (
                <div key={room.id} className="contents">
                  <div className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-4">
                    <p className="truncate text-xs font-semibold text-slate-900">{room.name}</p>
                    <p className="mt-1 truncate text-[10px] text-slate-500">{room.venueName}</p>
                    <p className="mt-2 text-[9px] font-medium text-slate-400">
                      Capacity {room.capacity}
                    </p>
                  </div>
                  {days.map((day) => {
                    const dayBookings = room.bookings.filter((booking) =>
                      intersectsDay(booking, day)
                    );
                    return (
                      <div
                        key={`${room.id}-${day.toISOString()}`}
                        className="min-h-24 border-b border-r border-slate-200 p-2 last:border-r-0"
                      >
                        {dayBookings.length ? (
                          <div className="space-y-1.5">
                            {dayBookings.slice(0, 2).map((booking) => (
                              <div
                                key={booking.eventId}
                                className="rounded-md border border-blue-700 bg-blue-600 px-2 py-2 text-white shadow-sm"
                                title={`${booking.title}: ${new Date(
                                  booking.startsAt
                                ).toLocaleString()} – ${new Date(booking.endsAt).toLocaleString()}`}
                              >
                                <p className="line-clamp-2 text-[9px] font-semibold leading-3.5">
                                  {booking.title}
                                </p>
                                <p className="mt-1 text-[8px] text-blue-100">
                                  {new Date(booking.startsAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </p>
                              </div>
                            ))}
                            {dayBookings.length > 2 ? (
                              <p className="px-1 text-[9px] font-medium text-slate-500">
                                +{dayBookings.length - 2} more
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="grid h-full min-h-20 place-items-center rounded-md border border-emerald-100 bg-emerald-50/60 text-[9px] font-medium text-emerald-700">
                            Available
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No rooms in this view"
              message="Add rooms to a venue or choose another venue filter."
              action={
                <ButtonLink href={`${base}/venues`} variant="coral" size="sm">
                  Manage venues
                </ButtonLink>
              }
            />
          </div>
        )}
      </Card>

      {bookings.length ? (
        <Card className="mt-5 overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">
              Scheduled in this window
            </p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">
              {bookings.length} room allocations
            </h3>
          </div>
          <div className="divide-y divide-slate-200">
            {bookings.map((booking) => (
              <div
                key={`${booking.eventId}-${booking.roomId}`}
                className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_13rem_12rem]"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-900">{booking.title}</p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {booking.venueName} · {booking.roomName}
                  </p>
                </div>
                <p className="text-[10px] text-slate-500">
                  {new Date(booking.startsAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short"
                  })}
                </p>
                <p className="text-[10px] text-slate-500">
                  to{" "}
                  {new Date(booking.endsAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short"
                  })}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="mt-5 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
        <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
        The API is the source of truth. Event creation repeats the overlap check before a room
        assignment is saved.
      </div>
    </div>
  );
}
