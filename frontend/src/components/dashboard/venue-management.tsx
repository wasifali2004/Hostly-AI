"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarRange,
  Edit3,
  Layers3,
  LoaderCircle,
  MapPin,
  Plus,
  Trash2,
  Users
} from "lucide-react";
import { venuesApi } from "@/lib/api-client";
import type {
  Room,
  RoomAvailabilityType,
  RoomInput,
  Venue,
  VenueInput
} from "@/types";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Dialog, DialogFooter } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { TagInput } from "@/components/dashboard/tag-input";

const emptyVenue: VenueInput = {
  name: "",
  address: "",
  capacity: 100,
  description: "",
  imageUrl: ""
};

const emptyRoom: RoomInput = {
  name: "",
  capacity: 50,
  floor: "",
  equipment: [],
  availabilityType: "PER_EVENT"
};

type DeleteTarget =
  | { type: "venue"; venue: Venue }
  | { type: "room"; venue: Venue; room: Room };

export function VenueManagement({
  organizationId,
  orgSlug
}: {
  organizationId: string;
  orgSlug: string;
}) {
  const toast = useToast();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [venueEditor, setVenueEditor] = useState<Venue | "new" | null>(null);
  const [venueDraft, setVenueDraft] = useState<VenueInput>(emptyVenue);
  const [roomEditor, setRoomEditor] = useState<{ venue: Venue; room?: Room } | null>(null);
  const [roomDraft, setRoomDraft] = useState<RoomInput>(emptyRoom);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setVenues(await venuesApi.list(organizationId));
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Venues could not load.";
      setError(message);
      toast.error("Could not load venues", { description: message });
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalRooms = useMemo(
    () => venues.reduce((total, venue) => total + venue.rooms.length, 0),
    [venues]
  );

  function openVenue(venue?: Venue) {
    setError("");
    setVenueEditor(venue ?? "new");
    setVenueDraft(
      venue
        ? {
            name: venue.name,
            address: venue.address,
            capacity: venue.capacity,
            description: venue.description || "",
            imageUrl: venue.imageUrl || ""
          }
        : emptyVenue
    );
  }

  function openRoom(venue: Venue, room?: Room) {
    setError("");
    setRoomEditor({ venue, room });
    setRoomDraft(
      room
        ? {
            name: room.name,
            capacity: room.capacity,
            floor: room.floor || "",
            equipment: room.equipment,
            availabilityType: room.availabilityType
          }
        : emptyRoom
    );
  }

  async function saveVenue(event: React.FormEvent) {
    event.preventDefault();
    if (!venueDraft.name.trim() || !venueDraft.address.trim() || venueDraft.capacity < 1) {
      setError("Venue name, address, and a valid capacity are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload: VenueInput = {
        ...venueDraft,
        name: venueDraft.name.trim(),
        address: venueDraft.address.trim(),
        capacity: Number(venueDraft.capacity),
        description: venueDraft.description?.trim() || undefined,
        imageUrl: venueDraft.imageUrl?.trim() || undefined
      };
      if (venueEditor === "new") {
        await venuesApi.create(organizationId, payload);
        setNotice(`${payload.name} was added.`);
        toast.success("Venue added", { description: `${payload.name} is ready for rooms.` });
      } else if (venueEditor) {
        await venuesApi.update(organizationId, venueEditor.id, payload);
        setNotice(`${payload.name} was updated.`);
        toast.success("Venue updated", { description: `${payload.name} is up to date.` });
      }
      setVenueEditor(null);
      await load();
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Venue could not be saved.";
      setError(message);
      toast.error("Venue could not be saved", { description: message });
    } finally {
      setBusy(false);
    }
  }

  async function saveRoom(event: React.FormEvent) {
    event.preventDefault();
    if (!roomEditor) return;
    if (!roomDraft.name.trim() || roomDraft.capacity < 1) {
      setError("Room name and a valid capacity are required.");
      return;
    }
    setBusy(true);
    setError("");
    const payload: RoomInput = {
      ...roomDraft,
      name: roomDraft.name.trim(),
      capacity: Number(roomDraft.capacity),
      floor: roomDraft.floor?.trim() || undefined,
      equipment: roomDraft.equipment
    };
    try {
      if (roomEditor.room) {
        await venuesApi.updateRoom(
          organizationId,
          roomEditor.venue.id,
          roomEditor.room.id,
          payload
        );
        setNotice(`${payload.name} was updated.`);
        toast.success("Room updated", { description: `${payload.name} is up to date.` });
      } else {
        await venuesApi.createRoom(organizationId, roomEditor.venue.id, payload);
        setNotice(`${payload.name} was added to ${roomEditor.venue.name}.`);
        toast.success("Room added", {
          description: `${payload.name} is now bookable at ${roomEditor.venue.name}.`
        });
      }
      setRoomEditor(null);
      await load();
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Room could not be saved.";
      setError(message);
      toast.error("Room could not be saved", { description: message });
    } finally {
      setBusy(false);
    }
  }

  async function removeTarget() {
    if (!deleteTarget) return;
    setBusy(true);
    setError("");
    try {
      if (deleteTarget.type === "venue") {
        await venuesApi.remove(organizationId, deleteTarget.venue.id);
        setNotice(`${deleteTarget.venue.name} was removed.`);
        toast.success("Venue removed", { description: deleteTarget.venue.name });
      } else {
        await venuesApi.removeRoom(
          organizationId,
          deleteTarget.venue.id,
          deleteTarget.room.id
        );
        setNotice(`${deleteTarget.room.name} was removed.`);
        toast.success("Room removed", { description: deleteTarget.room.name });
      }
      setDeleteTarget(null);
      await load();
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "The resource could not be removed.";
      setError(message);
      toast.error("Could not remove this space", { description: message });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading venues and rooms…" />;

  const base = `/org/${encodeURIComponent(orgSlug)}`;

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-700">
            Space operations
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.035em] text-slate-950">
            Venues & rooms
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Keep bookable spaces, capacity, and room equipment organized for every event.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`${base}/venues/availability`} variant="secondary">
            <CalendarRange className="h-4 w-4" />
            Availability
          </ButtonLink>
          <Button variant="coral" onClick={() => openVenue()}>
            <Plus className="h-4 w-4" />
            Add venue
          </Button>
        </div>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Venues", value: venues.length, icon: Building2 },
          { label: "Rooms", value: totalRooms, icon: Layers3 },
          {
            label: "Combined room capacity",
            value: venues.reduce(
              (total, venue) =>
                total + venue.rooms.reduce((roomTotal, room) => roomTotal + room.capacity, 0),
              0
            ),
            icon: Users
          }
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-700">
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-[-.03em] text-slate-950">
              {value.toLocaleString()}
            </p>
          </Card>
        ))}
      </div>

      {notice ? (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mt-5">
          <ErrorState title="Space operation failed" message={error} onRetry={() => void load()} />
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {venues.length === 0 ? (
          <EmptyState
            title="Add the first venue"
            message="Create a venue, then add its individual rooms so organizers can allocate a conflict-free space."
            action={
              <Button variant="coral" size="sm" onClick={() => openVenue()}>
                Add venue
              </Button>
            }
          />
        ) : (
          venues.map((venue) => (
            <Card key={venue.id} className="overflow-hidden">
              <div className="grid md:grid-cols-[13rem_minmax(0,1fr)]">
                <div
                  className="min-h-40 bg-slate-100 bg-cover bg-center"
                  style={
                    venue.imageUrl
                      ? { backgroundImage: `url("${venue.imageUrl.replace(/"/g, "%22")}")` }
                      : undefined
                  }
                >
                  {!venue.imageUrl ? (
                    <div className="grid h-full min-h-40 place-items-center text-slate-300">
                      <Building2 className="h-10 w-10" />
                    </div>
                  ) : null}
                </div>
                <div className="min-w-0 p-5 sm:p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-slate-950">{venue.name}</h3>
                      <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-slate-500">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {venue.address}
                      </p>
                      {venue.description ? (
                        <p className="mt-3 max-w-3xl text-xs leading-5 text-slate-500">
                          {venue.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openVenue(venue)}>
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setDeleteTarget({ type: "venue", venue })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
                    <div className="flex gap-5 text-[10px] font-medium text-slate-500">
                      <span>{venue.capacity.toLocaleString()} venue capacity</span>
                      <span>{venue.rooms.length} rooms</span>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => openRoom(venue)}>
                      <Plus className="h-3.5 w-3.5" />
                      Add room
                    </Button>
                  </div>
                </div>
              </div>

              {venue.rooms.length ? (
                <div className="overflow-x-auto border-t border-slate-200">
                  <table className="w-full min-w-[42rem] text-left">
                    <thead className="bg-slate-50 text-[9px] font-semibold uppercase tracking-[.1em] text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Room</th>
                        <th className="px-5 py-3">Capacity</th>
                        <th className="px-5 py-3">Floor</th>
                        <th className="px-5 py-3">Equipment</th>
                        <th className="px-5 py-3">Booking</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {venue.rooms.map((room) => (
                        <tr key={room.id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-4 font-semibold text-slate-900">{room.name}</td>
                          <td className="px-5 py-4 text-slate-600">{room.capacity}</td>
                          <td className="px-5 py-4 text-slate-600">{room.floor || "—"}</td>
                          <td className="max-w-xs px-5 py-4 text-slate-600">
                            {room.equipment.length ? room.equipment.join(", ") : "None listed"}
                          </td>
                          <td className="px-5 py-4 text-slate-600">
                            {room.availabilityType === "HOURLY" ? "Hourly" : "Per event"}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openRoom(venue, room)}>
                                <Edit3 className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => setDeleteTarget({ type: "room", venue, room })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border-t border-slate-200 px-5 py-5 text-xs text-slate-500">
                  No rooms yet. Add the first bookable space in this venue.
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      <Dialog
        open={Boolean(venueEditor)}
        title={venueEditor === "new" ? "Add venue" : "Edit venue"}
        description="Venue details are available only inside this organization."
        onOpenChange={(open) => {
          if (!open && !busy) setVenueEditor(null);
        }}
        className="max-w-lg"
      >
        <form onSubmit={saveVenue} className="space-y-4">
          <Field label="Venue name">
            <Input
              value={venueDraft.name}
              onChange={(event) =>
                setVenueDraft((current) => ({ ...current, name: event.target.value }))
              }
              required
            />
          </Field>
          <Field label="Address">
            <Input
              value={venueDraft.address}
              onChange={(event) =>
                setVenueDraft((current) => ({ ...current, address: event.target.value }))
              }
              required
            />
          </Field>
          <Field label="Total capacity">
            <Input
              type="number"
              min={1}
              value={venueDraft.capacity}
              onChange={(event) =>
                setVenueDraft((current) => ({
                  ...current,
                  capacity: Number(event.target.value)
                }))
              }
              required
            />
          </Field>
          <Field label="Description" hint="Optional">
            <Textarea
              value={venueDraft.description}
              onChange={(event) =>
                setVenueDraft((current) => ({ ...current, description: event.target.value }))
              }
              rows={3}
            />
          </Field>
          <Field label="Image URL" hint="Optional">
            <Input
              type="url"
              value={venueDraft.imageUrl}
              onChange={(event) =>
                setVenueDraft((current) => ({ ...current, imageUrl: event.target.value }))
              }
              placeholder="https://…"
            />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setVenueEditor(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="coral" disabled={busy}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Save venue
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(roomEditor)}
        title={roomEditor?.room ? "Edit room" : "Add room"}
        description={
          roomEditor ? `Configure a bookable space inside ${roomEditor.venue.name}.` : undefined
        }
        onOpenChange={(open) => {
          if (!open && !busy) setRoomEditor(null);
        }}
        className="max-w-lg"
      >
        <form onSubmit={saveRoom} className="space-y-4">
          <Field label="Room name">
            <Input
              value={roomDraft.name}
              onChange={(event) =>
                setRoomDraft((current) => ({ ...current, name: event.target.value }))
              }
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Capacity">
              <Input
                type="number"
                min={1}
                value={roomDraft.capacity}
                onChange={(event) =>
                  setRoomDraft((current) => ({
                    ...current,
                    capacity: Number(event.target.value)
                  }))
                }
                required
              />
            </Field>
            <Field label="Floor" hint="Optional">
              <Input
                value={roomDraft.floor}
                onChange={(event) =>
                  setRoomDraft((current) => ({ ...current, floor: event.target.value }))
                }
                placeholder="Level 2"
              />
            </Field>
          </div>
          <Field label="Equipment & amenities" hint="Press Enter to add">
            <TagInput
              value={roomDraft.equipment}
              onChange={(equipment) =>
                setRoomDraft((current) => ({ ...current, equipment }))
              }
              placeholder="Add equipment or an amenity"
              suggestions={[
                "Projector",
                "PA system",
                "Video conferencing",
                "Accessible stage",
                "Whiteboard"
              ]}
            />
          </Field>
          <Field label="Availability model">
            <Select
              value={roomDraft.availabilityType}
              onChange={(event) =>
                setRoomDraft((current) => ({
                  ...current,
                  availabilityType: event.target.value as RoomAvailabilityType
                }))
              }
            >
              <option value="PER_EVENT">Per event</option>
              <option value="HOURLY">Hourly</option>
            </Select>
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRoomEditor(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="coral" disabled={busy}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Save room
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.type === "room" ? "room" : "venue"}?`}
        description={
          deleteTarget?.type === "venue"
            ? `${deleteTarget.venue.name} and its room configuration will be removed.`
            : deleteTarget
              ? `${deleteTarget.room.name} will no longer be available for event allocation.`
              : undefined
        }
        confirmLabel="Delete"
        cancelLabel="Keep it"
        destructive
        loading={busy}
        onConfirm={removeTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
