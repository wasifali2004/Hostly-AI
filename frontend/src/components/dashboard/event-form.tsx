"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Plus,
  Radio,
  Save,
  Ticket,
  Trash2,
  UploadCloud
} from "lucide-react";
import { ApiError, eventsApi, venuesApi } from "@/lib/api-client";
import type { EventDetail, EventFormValues, Venue, VenueType } from "@/types";
import { useAuth } from "@/providers/auth-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { TagInput } from "@/components/dashboard/tag-input";
import { isoToZonedLocal, zonedLocalToIso } from "@/lib/utils";

const defaultStart = new Date(Date.now() + 7 * 86_400_000);
defaultStart.setMinutes(0, 0, 0);
const defaultEnd = new Date(defaultStart.getTime() + 3 * 3_600_000);

function initialValues(event?: EventDetail): EventFormValues {
  const timeZone =
    event?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return {
    title: event?.title || "",
    description: event?.description || "",
    startsAt: isoToZonedLocal(event?.startsAt || defaultStart.toISOString(), timeZone),
    endsAt: isoToZonedLocal(event?.endsAt || defaultEnd.toISOString(), timeZone),
    timezone: timeZone,
    venueType: event?.venueType || "PHYSICAL",
    venueName: event?.venueName || "",
    address: event?.address || "",
    city: event?.city || "",
    virtualUrl: event?.virtualUrl || "",
    venueId: event?.venueId || event?.venue?.id || "",
    roomId: event?.roomId || event?.room?.id || "",
    capacity: event?.capacity || 100,
    coverImageUrl: event?.coverImageUrl || "",
    category: event?.category || "Business",
    tags: event?.tags || [],
    ticketTiers: event?.ticketTiers?.length
      ? event.ticketTiers.map((tier) => ({
          id: tier.id,
          name: tier.name,
          description: tier.description || "",
          capacity: tier.capacity
        }))
      : [{ name: "General admission", description: "", capacity: 100 }]
  };
}

export function EventForm({
  event,
  organizationId,
  orgSlug
}: {
  event?: EventDetail;
  organizationId?: string;
  orgSlug?: string;
}) {
  const { selectedMembership } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState(() => initialValues(event));
  const [pending, setPending] = useState<"draft" | "publish" | "upload" | "">("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const targetOrganizationId = organizationId || selectedMembership?.organizationId;
  const selectedVenue = useMemo(
    () => venues.find((venue) => venue.id === values.venueId) ?? null,
    [values.venueId, venues]
  );
  const selectedRoom = useMemo(
    () => selectedVenue?.rooms.find((room) => room.id === values.roomId) ?? null,
    [selectedVenue, values.roomId]
  );
  const totalTierCapacity = useMemo(
    () => values.ticketTiers.reduce((sum, tier) => sum + Number(tier.capacity || 0), 0),
    [values.ticketTiers]
  );

  useEffect(() => {
    if (!targetOrganizationId) return;
    let active = true;
    setVenuesLoading(true);
    venuesApi
      .list(targetOrganizationId)
      .then((items) => {
        if (active) setVenues(items);
      })
      .catch((requestError) => {
        if (!active) return;
        const message =
          requestError instanceof Error ? requestError.message : "Venues could not load.";
        setError(message);
        toast.error("Could not load venues", { description: message });
      })
      .finally(() => {
        if (active) setVenuesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [targetOrganizationId, toast]);

  function setField<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function updateTier(
    index: number,
    key: "name" | "description" | "capacity",
    value: string | number
  ) {
    setValues((current) => ({
      ...current,
      ticketTiers: current.ticketTiers.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, [key]: value } : tier
      )
    }));
    setSaved(false);
  }

  function addTier() {
    setValues((current) => ({
      ...current,
      ticketTiers: [
        ...current.ticketTiers,
        { name: `Ticket tier ${current.ticketTiers.length + 1}`, description: "", capacity: 50 }
      ]
    }));
  }

  function removeTier(index: number) {
    if (values.ticketTiers.length === 1) return;
    setValues((current) => ({
      ...current,
      ticketTiers: current.ticketTiers.filter((_, tierIndex) => tierIndex !== index)
    }));
  }

  async function uploadCover(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      toast.error("Unsupported cover image", {
        description: "Choose a JPG, PNG, WebP, or GIF image."
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Cover images must be smaller than 5 MB.");
      toast.error("Cover image is too large", {
        description: "Choose an image smaller than 5 MB."
      });
      return;
    }
    setPending("upload");
    setError("");
    try {
      const result = await eventsApi.uploadCover(file);
      setField("coverImageUrl", result.url);
      toast.success("Cover image uploaded");
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? `${uploadError.message} You can paste a hosted image URL instead.`
          : "Image upload failed.";
      setError(message);
      toast.error("Image upload failed", { description: message });
    } finally {
      setPending("");
    }
  }

  async function save(publish: boolean) {
    if (!targetOrganizationId) return;
    setError("");
    if (!values.title.trim() || values.title.trim().length < 3) {
      setError("Give the event a title of at least 3 characters.");
      toast.error("Event title is incomplete", {
        description: "Give the event a title of at least 3 characters."
      });
      return;
    }
    if (values.description.trim().length < 20) {
      setError("Add a little more detail—the description needs at least 20 characters.");
      toast.error("Description is too short", {
        description: "Add at least 20 characters so attendees know what to expect."
      });
      return;
    }
    try {
      new Intl.DateTimeFormat("en", { timeZone: values.timezone }).format();
    } catch {
      setError("Use a valid IANA timezone, such as America/New_York or Asia/Karachi.");
      toast.error("Timezone is invalid", {
        description: "Use an IANA timezone such as America/New_York or Asia/Karachi."
      });
      return;
    }
    if (
      new Date(zonedLocalToIso(values.endsAt, values.timezone)).getTime() <=
      new Date(zonedLocalToIso(values.startsAt, values.timezone)).getTime()
    ) {
      setError("The end time needs to be after the start time.");
      toast.error("Schedule is invalid", {
        description: "The event end time must be after its start time."
      });
      return;
    }
    if (!values.ticketTiers.every((tier) => tier.name.trim() && Number(tier.capacity) > 0)) {
      setError("Every ticket tier needs a name and a capacity greater than zero.");
      toast.error("Ticket tiers need attention", {
        description: "Every tier needs a name and a capacity greater than zero."
      });
      return;
    }
    const physicalEvent =
      values.venueType === "PHYSICAL" || values.venueType === "HYBRID";
    if (physicalEvent && (!values.venueId || !values.roomId)) {
      const message = "Choose both a managed venue and room for an in-person event.";
      setError(message);
      toast.error("Room allocation is required", { description: message });
      return;
    }
    if (physicalEvent && selectedRoom && totalTierCapacity > selectedRoom.capacity) {
      const message = `${selectedRoom.name} holds ${selectedRoom.capacity} people, but the ticket tiers total ${totalTierCapacity}.`;
      setError(message);
      toast.error("Room capacity is too small", { description: message });
      return;
    }

    setPending(publish ? "publish" : "draft");
    try {
      const payload: EventFormValues = {
        ...values,
        title: values.title.trim(),
        description: values.description.trim(),
        startsAt: zonedLocalToIso(values.startsAt, values.timezone),
        endsAt: zonedLocalToIso(values.endsAt, values.timezone),
        capacity: totalTierCapacity,
        venueId: physicalEvent ? values.venueId : undefined,
        roomId: physicalEvent ? values.roomId : undefined,
        venueName: physicalEvent ? selectedVenue?.name || values.venueName : undefined,
        address: physicalEvent ? selectedVenue?.address || values.address : undefined,
        tags: values.tags,
        ticketTiers: values.ticketTiers.map((tier) => ({
          ...tier,
          name: tier.name.trim(),
          description: tier.description?.trim(),
          capacity: Number(tier.capacity)
        }))
      };
      const savedEvent = event
        ? await eventsApi.update(targetOrganizationId, event.id, payload)
        : await eventsApi.create(targetOrganizationId, payload);
      if (publish && savedEvent.status !== "PUBLISHED") {
        await eventsApi.publish(targetOrganizationId, savedEvent.id, true);
      }
      setSaved(true);
      toast.success(
        publish
          ? event
            ? "Event changes published"
            : "Event published"
          : event
            ? "Event changes saved"
            : "Event draft created",
        selectedRoom
          ? {
              description: `${selectedVenue?.name} · ${selectedRoom.name} is reserved for this schedule.`
            }
          : undefined
      );
      if (!event || publish) {
        router.push(
          orgSlug ? `/org/${encodeURIComponent(orgSlug)}/events` : "/dashboard"
        );
        router.refresh();
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Could not save this event.";
      setError(message);
      if (
        (requestError instanceof ApiError && requestError.status === 409) ||
        message.toLowerCase().includes("already booked") ||
        message.toLowerCase().includes("overlap")
      ) {
        toast.error("This room is already booked", {
          description:
            "Another event overlaps this date and time. Choose another room or adjust the schedule."
        });
      } else {
        toast.error("Event could not be saved", { description: message });
      }
    } finally {
      setPending("");
    }
  }

  const showsPhysical = values.venueType === "PHYSICAL" || values.venueType === "HYBRID";
  const showsVirtual = values.venueType === "VIRTUAL" || values.venueType === "HYBRID";

  return (
    <div className="animate-reveal">
      <section className="flex flex-col justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7 lg:flex-row lg:items-end">
        <div>
          <ButtonLink
            href={orgSlug ? `/org/${encodeURIComponent(orgSlug)}/events` : "/dashboard"}
            variant="ghost"
            size="sm"
            className="-ml-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to events
          </ButtonLink>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[.15em] text-blue-700">
            Event workspace
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            {event ? "Edit event" : "Create event"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink/48">
            {event
              ? "Changes stay private until you publish them."
              : "Start with what guests need to know. You can keep it in draft."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => void save(false)}
            disabled={Boolean(pending)}
          >
            {pending === "draft" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saved ? "Saved" : "Save draft"}
          </Button>
          <Button variant="coral" onClick={() => void save(true)} disabled={Boolean(pending)}>
            {pending === "publish" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {event?.status === "PUBLISHED" ? "Save & publish" : "Publish event"}
          </Button>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium leading-5 text-red-700"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <section className="workspace-panel overflow-hidden p-5 sm:p-6">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Event details</h3>
                <p className="mt-0.5 text-[10px] text-ink/38">Title, story, and schedule</p>
              </div>
            </div>
            <div className="mt-5 space-y-5">
              <Field label="Event title" hint={`${values.title.length}/100`}>
                <Input
                  value={values.title}
                  onChange={(input) => setField("title", input.target.value)}
                  maxLength={100}
                  placeholder="The Future of Considered Products"
                  className="h-13 text-base font-semibold"
                />
              </Field>
              <Field label="Description" hint="Plain text">
                <Textarea
                  value={values.description}
                  onChange={(input) => setField("description", input.target.value)}
                  rows={7}
                  placeholder="Tell guests what they will experience, who it is for, and what they should bring…"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Starts">
                  <Input
                    type="datetime-local"
                    value={values.startsAt}
                    onChange={(input) => setField("startsAt", input.target.value)}
                  />
                </Field>
                <Field label="Ends">
                  <Input
                    type="datetime-local"
                    value={values.endsAt}
                    onChange={(input) => setField("endsAt", input.target.value)}
                  />
                </Field>
              </div>
              <Field label="Timezone">
                <Input
                  value={values.timezone}
                  onChange={(input) => setField("timezone", input.target.value)}
                  placeholder="America/New_York"
                />
              </Field>
            </div>
          </section>

          <section className="workspace-panel overflow-hidden p-5 sm:p-6">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Location</h3>
                <p className="mt-0.5 text-[10px] text-ink/38">In person, online, or both</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {(
                [
                  ["PHYSICAL", MapPin, "In person"],
                  ["VIRTUAL", Radio, "Online"],
                  ["HYBRID", Radio, "Hybrid"]
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setField("venueType", value as VenueType)}
                  className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border text-[10px] font-bold transition ${
                    values.venueType === value
                      ? "border-ink bg-ink text-white"
                      : "border-ink/10 bg-ink/[0.02] text-ink/50 hover:border-ink/25"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-5 space-y-4">
              {showsPhysical ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Managed venue">
                      <Select
                        value={values.venueId || ""}
                        disabled={venuesLoading}
                        onChange={(input) => {
                          const nextVenue = venues.find(
                            (venue) => venue.id === input.target.value
                          );
                          setValues((current) => ({
                            ...current,
                            venueId: input.target.value,
                            roomId: "",
                            venueName: nextVenue?.name || "",
                            address: nextVenue?.address || ""
                          }));
                          setSaved(false);
                        }}
                      >
                        <option value="">
                          {venuesLoading ? "Loading venues…" : "Choose a venue"}
                        </option>
                        {venues.map((venue) => (
                          <option key={venue.id} value={venue.id}>
                            {venue.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      label="Room or space"
                      hint={
                        selectedRoom
                          ? `${selectedRoom.capacity} capacity`
                          : selectedVenue
                            ? `${selectedVenue.rooms.length} available`
                            : undefined
                      }
                    >
                      <Select
                        value={values.roomId || ""}
                        disabled={!selectedVenue || venuesLoading}
                        onChange={(input) => setField("roomId", input.target.value)}
                      >
                        <option value="">
                          {selectedVenue ? "Choose a room" : "Choose a venue first"}
                        </option>
                        {selectedVenue?.rooms.map((room) => (
                          <option
                            key={room.id}
                            value={room.id}
                            disabled={room.capacity < totalTierCapacity}
                          >
                            {room.name} · {room.capacity} people
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  {selectedVenue ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-medium text-slate-700">
                        {selectedVenue.address}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[10px] text-slate-500">
                          {selectedRoom
                            ? `${selectedRoom.name}${
                                selectedRoom.floor ? ` · ${selectedRoom.floor}` : ""
                              } · ${
                                selectedRoom.equipment.length
                                  ? selectedRoom.equipment.join(", ")
                                  : "No equipment listed"
                              }`
                            : "Select a room to reserve this space."}
                        </p>
                        {orgSlug ? (
                          <ButtonLink
                            href={`/org/${encodeURIComponent(orgSlug)}/venues/availability`}
                            variant="ghost"
                            size="sm"
                          >
                            Check availability
                          </ButtonLink>
                        ) : null}
                      </div>
                    </div>
                  ) : venues.length === 0 && !venuesLoading ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                      No managed venues exist yet.
                      {orgSlug ? (
                        <ButtonLink
                          href={`/org/${encodeURIComponent(orgSlug)}/venues`}
                          variant="ghost"
                          size="sm"
                          className="ml-1 h-auto px-1 text-amber-900 underline"
                        >
                          Add a venue and room
                        </ButtonLink>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
              {showsVirtual ? (
                <Field label="Virtual event link" hint="Only registered guests receive this">
                  <Input
                    type="url"
                    value={values.virtualUrl}
                    onChange={(input) => setField("virtualUrl", input.target.value)}
                    placeholder="https://meet.example.com/your-event"
                  />
                </Field>
              ) : null}
            </div>
          </section>

          <section className="workspace-panel overflow-hidden p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-700">
                  <Ticket className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Ticket tiers</h3>
                  <p className="mt-0.5 text-[10px] text-ink/38">
                    {totalTierCapacity} total places
                  </p>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={addTier}>
                <Plus className="h-3.5 w-3.5" />
                Add tier
              </Button>
            </div>
            <div className="mt-5 space-y-3">
              {values.ticketTiers.map((tier, index) => (
                <div key={tier.id || index} className="interactive-card rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(10rem,1fr)_7rem_2.5rem]">
                    <Field label={`Tier ${index + 1} name`}>
                      <Input
                        value={tier.name}
                        onChange={(input) => updateTier(index, "name", input.target.value)}
                        placeholder="General admission"
                      />
                    </Field>
                    <Field label="Capacity">
                      <Input
                        type="number"
                        min={1}
                        value={tier.capacity}
                        onChange={(input) =>
                          updateTier(index, "capacity", Number(input.target.value))
                        }
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={() => removeTier(index)}
                      disabled={values.ticketTiers.length === 1}
                      aria-label={`Remove ${tier.name}`}
                      className="mt-7 grid h-10 w-10 place-items-center rounded-lg text-ink/30 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Field label="Short description" hint="Optional" className="mt-3">
                    <Input
                      value={tier.description}
                      onChange={(input) => updateTier(index, "description", input.target.value)}
                      placeholder="Includes the morning workshop"
                    />
                  </Field>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="workspace-panel p-5">
            <div className="flex items-center gap-3">
              <ImagePlus className="h-4 w-4 text-coral" />
              <h3 className="text-sm font-semibold text-slate-900">Cover image</h3>
            </div>
            <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-xl border border-dashed border-ink/18 bg-[#f5f2eb]">
              {values.coverImageUrl ? (
                <Image
                  src={values.coverImageUrl}
                  alt="Event cover preview"
                  fill
                  sizes="320px"
                  className="object-cover"
                />
              ) : (
                <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center p-5 text-center">
                  <UploadCloud className="h-6 w-6 text-ink/30" />
                  <span className="mt-3 text-xs font-bold text-ink/55">Upload a cover</span>
                  <span className="mt-1 text-[9px] leading-4 text-ink/35">
                    JPG, PNG, WebP, or GIF · up to 5 MB
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    onChange={(input) => void uploadCover(input.target.files?.[0])}
                  />
                </label>
              )}
              {pending === "upload" ? (
                <div className="absolute inset-0 grid place-items-center bg-white/80 backdrop-blur-sm">
                  <LoaderCircle className="h-5 w-5 animate-spin text-coral" />
                </div>
              ) : null}
            </div>
            {values.coverImageUrl ? (
              <label className="mt-3 block cursor-pointer text-center text-[10px] font-bold text-coral">
                Replace image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(input) => void uploadCover(input.target.files?.[0])}
                />
              </label>
            ) : null}
            <Field label="Or paste an image URL" className="mt-4">
              <Input
                type="url"
                value={values.coverImageUrl}
                onChange={(input) => setField("coverImageUrl", input.target.value)}
                placeholder="https://…"
              />
            </Field>
          </section>

          <section className="workspace-panel p-5">
            <h3 className="text-sm font-semibold text-slate-900">Discovery</h3>
            <p className="mt-1 text-[10px] leading-4 text-ink/38">
              Help the right people find this event.
            </p>
            <div className="mt-4 space-y-4">
              <Field label="Category">
                <Select
                  value={values.category}
                  onChange={(input) => setField("category", input.target.value)}
                >
                  {["Business", "Community", "Design", "Technology", "Climate", "Arts", "Wellness", "Education"].map(
                    (category) => (
                      <option key={category}>{category}</option>
                    )
                  )}
                </Select>
              </Field>
              <Field label="Tags" hint="Press Enter to add">
                <TagInput
                  value={values.tags}
                  onChange={(next) => setField("tags", next)}
                  placeholder="Add a discovery tag"
                  suggestions={[
                    "Leadership",
                    "Networking",
                    "Workshop",
                    "Innovation",
                    "Community"
                  ]}
                />
              </Field>
            </div>
          </section>

          <section className="metric-grid rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-blue-300">
              Before publishing
            </p>
            <ul className="mt-4 space-y-3 text-[10px] leading-4 text-white/48">
              {[
                "Confirm the date and timezone",
                "Check every tier capacity",
                "Use a wide, high-resolution cover",
                "Review the public description"
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-sage" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
