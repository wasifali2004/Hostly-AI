const API_URL = (process.env.API_URL || "http://localhost:4100/api/v1").replace(
  /\/$/,
  ""
);

class CookieSession {
  #cookies = new Map();

  async request(path, options = {}) {
    const headers = new Headers(options.headers);
    if (this.#cookies.size) {
      headers.set(
        "Cookie",
        [...this.#cookies].map(([name, value]) => `${name}=${value}`).join("; ")
      );
    }
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [response.headers.get("set-cookie")].filter(Boolean);

    for (const value of setCookies) {
      const [pair] = value.split(";");
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator).trim();
      const cookieValue = pair.slice(separator + 1).trim();
      if (cookieValue) this.#cookies.set(name, cookieValue);
      else this.#cookies.delete(name);
    }

    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    if (!response.ok) {
      const error = new Error(
        `${options.method || "GET"} ${path} failed (${response.status}): ${JSON.stringify(body)}`
      );
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function run() {
  const suffix = Date.now().toString(36);
  const admin = new CookieSession();
  const guest = new CookieSession();
  const attendee = new CookieSession();
  const organizer = new CookieSession();
  const outsider = new CookieSession();

  const signup = await admin.request("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      name: "Smoke Test Admin",
      email: `admin-${suffix}@smoke.hostly.local`,
      password: "SmokeTest123!",
      organizationName: `Smoke Org ${suffix}`
    })
  });
  assert(signup.user?.id, "signup returns a user");

  const organizations = await admin.request("/organizations");
  const organization = (organizations.items || organizations)[0];
  assert(organization?.id, "signup creates an organization membership");
  assert(organization?.slug, "organization has a public slug");

  const bySlug = await admin.request(
    `/organizations/by-slug/${organization.slug}`
  );
  assert(
    bySlug.id === organization.id,
    "an authenticated member can resolve the organization by slug"
  );

  const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  const venue = await admin.request(
    `/organizations/${organization.id}/venues`,
    {
      method: "POST",
      body: JSON.stringify({
        name: `Smoke Operations Center ${suffix}`,
        address: "100 Verification Way, Test City",
        capacity: 80,
        description: "A smoke-test venue for tenant-safe room allocation."
      })
    }
  );
  assert(venue.id, "venue is created");

  const room = await admin.request(
    `/organizations/${organization.id}/venues/${venue.id}/rooms`,
    {
      method: "POST",
      body: JSON.stringify({
        name: "Main Briefing Room",
        capacity: 24,
        floor: "Level 2",
        equipment: ["Projector", "PA system"],
        availabilityType: "HOURLY"
      })
    }
  );
  assert(room.id, "room is created");

  const updatedVenue = await admin.request(
    `/organizations/${organization.id}/venues/${venue.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ description: "Updated smoke-test venue." })
    }
  );
  assert(
    updatedVenue.description === "Updated smoke-test venue.",
    "venue is updated"
  );
  const updatedRoom = await admin.request(
    `/organizations/${organization.id}/venues/${venue.id}/rooms/${room.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        floor: "Level 3",
        equipment: ["Projector", "PA system", "Camera"]
      })
    }
  );
  assert(updatedRoom.floor === "Level 3", "room is updated");

  const venueList = await admin.request(
    `/organizations/${organization.id}/venues`
  );
  assert(
    venueList.items?.some(
      (item) =>
        item.id === venue.id && item.rooms?.some((space) => space.id === room.id)
    ),
    "venue list returns tenant-scoped rooms"
  );

  const createdEvent = await admin.request(
    `/organizations/${organization.id}/events`,
    {
      method: "POST",
      body: JSON.stringify({
        title: `Hostly Smoke Event ${suffix}`,
        description:
          "An end-to-end smoke event proving tenant scoping, inventory, registration, and check-in.",
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        timezone: "UTC",
        venueType: "PHYSICAL",
        venueId: venue.id,
        roomId: room.id,
        city: "Test City",
        capacity: 12,
        category: "Technology",
        tags: ["smoke-test", "hostly"],
        ticketTiers: [
          { name: "General", description: "General admission", capacity: 10 },
          { name: "VIP", description: "Front-row access", capacity: 2 }
        ]
      })
    }
  );
  assert(createdEvent.id, "event is created");
  assert(createdEvent.ticketTiers?.length === 2, "ticket tiers are created atomically");
  assert(
    createdEvent.venue?.id === venue.id && createdEvent.room?.id === room.id,
    "event response includes its allocated venue and room"
  );

  let overlapStatus;
  let overlapCode;
  try {
    await admin.request(`/organizations/${organization.id}/events`, {
      method: "POST",
      body: JSON.stringify({
        title: `Overlapping Smoke Event ${suffix}`,
        description:
          "This event deliberately overlaps the first booking and must be rejected.",
        startsAt: new Date(startsAt.getTime() + 30 * 60 * 1000).toISOString(),
        endsAt: new Date(endsAt.getTime() + 30 * 60 * 1000).toISOString(),
        timezone: "UTC",
        venueType: "PHYSICAL",
        venueId: venue.id,
        roomId: room.id,
        capacity: 10,
        category: "Technology",
        tags: ["smoke-test", "overlap"],
        ticketTiers: [{ name: "General", capacity: 10 }]
      })
    });
  } catch (error) {
    overlapStatus = error.status;
    overlapCode = error.body?.code;
  }
  assert(
    overlapStatus === 409 && overlapCode === "ROOM_BOOKING_CONFLICT",
    "overlapping room booking is rejected with a stable 409 error"
  );

  const availability = await admin.request(
    `/organizations/${organization.id}/venues/availability?from=${encodeURIComponent(
      new Date(startsAt.getTime() - 60 * 60 * 1000).toISOString()
    )}&to=${encodeURIComponent(
      new Date(endsAt.getTime() + 60 * 60 * 1000).toISOString()
    )}&roomId=${room.id}`
  );
  assert(
    availability.rooms?.[0]?.bookings?.some(
      (booking) => booking.eventId === createdEvent.id
    ),
    "availability calendar contains the room booking"
  );

  const published = await admin.request(
    `/organizations/${organization.id}/events/${createdEvent.id}/publish`,
    { method: "POST" }
  );
  assert(published.status === "PUBLISHED", "event can be published");

  const publicEvent = await guest.request(`/public/events/${published.slug}`);
  assert(publicEvent.id === createdEvent.id, "published event is publicly discoverable");
  const publicEventById = await guest.request(`/public/events/${published.id}`);
  assert(
    publicEventById.slug === published.slug,
    "public event detail resolves the dynamic event ID"
  );

  const searchResults = await guest.request(
    `/public/events?search=${encodeURIComponent(`Hostly Smoke Event ${suffix}`)}`
  );
  assert(
    searchResults.items?.some((event) => event.id === createdEvent.id),
    "Postgres full-text discovery returns the published event"
  );

  const publicOrganization = await guest.request(
    `/public/organizations/${organization.slug}`
  );
  assert(
    publicOrganization.organization?.id === organization.id &&
      publicOrganization.events?.some((event) => event.id === createdEvent.id),
    "public organization profile contains its published event"
  );

  const attendeeEmail = `attendee-${suffix}@smoke.hostly.local`;
  await attendee.request("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      name: "Smoke Test Attendee",
      email: attendeeEmail,
      password: "SmokeTest123!"
    })
  });
  let attendeeVenueStatus;
  try {
    await attendee.request(`/organizations/${organization.id}/venues`);
  } catch (error) {
    attendeeVenueStatus = error.status;
  }
  assert(
    attendeeVenueStatus === 403,
    "attendees cannot access venue and room management"
  );
  const registrationResponse = await attendee.request(
    `/public/events/${createdEvent.id}/registrations`,
    {
      method: "POST",
      body: JSON.stringify({
        ticketTierId: publicEvent.ticketTiers[0].id,
        attendeeName: "Smoke Test Attendee",
        attendeeEmail
      })
    }
  );
  const registration = registrationResponse.registration || registrationResponse;
  const checkInCode = registration.checkInCode || registration.qrCode;
  assert(checkInCode, "registration returns a QR/check-in code");
  assert(
    registrationResponse.qrCodeDataUrl?.startsWith("data:image/png"),
    "registration returns a generated QR image"
  );

  const myRegistrations = await attendee.request("/registrations/mine");
  assert(
    (myRegistrations.items || myRegistrations).some(
      (item) => item.id === registration.id
    ),
    "account-linked registration appears in the attendee dashboard feed"
  );

  const eventRegistrations = await admin.request(
    `/organizations/${organization.id}/events/${createdEvent.id}/registrations`
  );
  assert(
    eventRegistrations.items?.some((item) => item.id === registration.id),
    "event staff can list registrations for the tenant-scoped event"
  );

  const calendar = await attendee.request(
    `/registrations/${registration.id}/calendar.ics`
  );
  assert(
    typeof calendar === "string" &&
      calendar.includes("BEGIN:VCALENDAR") &&
      calendar.includes("BEGIN:VEVENT"),
    "registration calendar endpoint returns a valid ICS document"
  );

  const checkIn = await admin.request(
    `/organizations/${organization.id}/events/${createdEvent.id}/check-in`,
    {
      method: "POST",
      body: JSON.stringify({ code: checkInCode })
    }
  );
  assert(checkIn.registration?.checkedInAt, "registration is checked in");

  const repeatedCheckIn = await admin.request(
    `/organizations/${organization.id}/events/${createdEvent.id}/check-in`,
    {
      method: "POST",
      body: JSON.stringify({ code: checkInCode })
    }
  );
  assert(repeatedCheckIn.alreadyCheckedIn === true, "check-in is idempotent");
  assert(
    repeatedCheckIn.registration?.checkIn?.id,
    "check-in creates a durable audit record"
  );

  const stats = await admin.request(
    `/organizations/${organization.id}/events/${createdEvent.id}/check-in/stats`
  );
  assert(stats.registered === 1 && stats.checkedIn === 1, "live stats reflect check-in");

  const activity = await admin.request(
    `/organizations/${organization.id}/activity?pageSize=100`
  );
  assert(
    activity.items?.some(
      (entry) =>
        entry.action === "REGISTRATION_CHECKED_IN" &&
        entry.entityId === registration.id
    ) &&
      activity.items?.some(
        (entry) =>
          entry.action === "EVENT_CREATED" && entry.entityId === createdEvent.id
      ) &&
      activity.items?.some(
        (entry) => entry.action === "VENUE_CREATED" && entry.entityId === venue.id
      ),
    "activity log records event, venue, and check-in actions"
  );

  const jsonExport = await admin.request(
    `/organizations/${organization.id}/compliance/export?format=json`
  );
  assert(
    jsonExport.organization?.id === organization.id &&
      jsonExport.organization?.events?.some(
        (event) => event.id === createdEvent.id
      ),
    "organization JSON export contains tenant-scoped event data"
  );
  const csvExport = await admin.request(
    `/organizations/${organization.id}/compliance/export?format=csv`
  );
  assert(
    typeof csvExport === "string" &&
      csvExport.includes(attendeeEmail) &&
      csvExport.includes(createdEvent.title),
    "organization CSV export contains registration data"
  );

  const deletionRequest = await attendee.request(
    `/organizations/${organization.id}/compliance/deletion-requests`,
    {
      method: "POST",
      body: JSON.stringify({ reason: "Smoke-test portability request" })
    }
  );
  assert(
    deletionRequest.status === "PENDING",
    "attendee can queue a deletion request for their own data"
  );
  const mine = await attendee.request(
    `/organizations/${organization.id}/compliance/deletion-requests/mine`
  );
  assert(
    mine.items?.some((item) => item.id === deletionRequest.id),
    "attendee can view their own deletion request"
  );
  const requestQueue = await admin.request(
    `/organizations/${organization.id}/compliance/deletion-requests`
  );
  assert(
    requestQueue.items?.some((item) => item.id === deletionRequest.id),
    "organization admin can view the deletion request queue"
  );
  const approvedRequest = await admin.request(
    `/organizations/${organization.id}/compliance/deletion-requests/${deletionRequest.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "APPROVED",
        adminNote: "Identity verified by smoke test"
      })
    }
  );
  assert(
    approvedRequest.status === "APPROVED",
    "organization admin can approve a deletion request"
  );
  const completedRequest = await admin.request(
    `/organizations/${organization.id}/compliance/deletion-requests/${deletionRequest.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "COMPLETED" })
    }
  );
  assert(
    completedRequest.status === "COMPLETED",
    "organization admin can close an approved deletion request"
  );

  const analytics = await admin.request(
    `/organizations/${organization.id}/analytics/overview`
  );
  assert(analytics.summary?.totalRegistrations >= 1, "analytics includes registrations");

  await outsider.request("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      name: "Tenant Boundary User",
      email: `outsider-${suffix}@smoke.hostly.local`,
      password: "SmokeTest123!",
      organizationName: `Other Org ${suffix}`
    })
  });
  let tenantIsolationStatus;
  try {
    await outsider.request(`/organizations/${organization.id}/events`);
  } catch (error) {
    tenantIsolationStatus = error.status;
  }
  assert(
    tenantIsolationStatus === 403 || tenantIsolationStatus === 404,
    "a user from another tenant cannot read organization events"
  );

  const organizerEmail = `organizer-${suffix}@smoke.hostly.local`;
  await organizer.request("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      name: "Smoke Test Organizer",
      email: organizerEmail,
      password: "SmokeTest123!"
    })
  });
  const addedMember = await admin.request(
    `/organizations/${organization.id}/members`,
    {
      method: "POST",
      body: JSON.stringify({
        email: organizerEmail,
        role: "ORGANIZER"
      })
    }
  );
  assert(
    addedMember.role === "ORGANIZER",
    "an organization admin can add a member with a scoped role"
  );

  const organizerEvents = await organizer.request(
    `/organizations/${organization.id}/events`
  );
  assert(
    !organizerEvents.items?.some((event) => event.id === createdEvent.id),
    "organizers cannot read events owned by another organizer"
  );

  let organizerEventStatus;
  try {
    await organizer.request(
      `/organizations/${organization.id}/events/${createdEvent.id}`
    );
  } catch (error) {
    organizerEventStatus = error.status;
  }
  assert(
    organizerEventStatus === 403 || organizerEventStatus === 404,
    "organizers cannot access another organizer's event by ID"
  );

  const members = await admin.request(
    `/organizations/${organization.id}/members`
  );
  const organizerMembership = members.items?.find(
    (membership) => membership.user?.email === organizerEmail
  );
  assert(organizerMembership?.id, "organizer membership can be resolved");
  await admin.request(
    `/organizations/${organization.id}/members/${organizerMembership.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ role: "ATTENDEE" })
    }
  );
  const roleActivity = await admin.request(
    `/organizations/${organization.id}/activity?action=MEMBER_ROLE_CHANGED`
  );
  assert(
    roleActivity.items?.some(
      (entry) => entry.entityId === organizerMembership.id
    ),
    "member role changes are written to the activity log"
  );

  await admin.request(
    `/organizations/${organization.id}/events/${createdEvent.id}`,
    { method: "DELETE" }
  );
  await admin.request(
    `/organizations/${organization.id}/venues/${venue.id}/rooms/${room.id}`,
    { method: "DELETE" }
  );
  await admin.request(`/organizations/${organization.id}/venues/${venue.id}`, {
    method: "DELETE"
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        organizationId: organization.id,
        eventId: createdEvent.id,
        registrationId: registration.id,
        checks: [
          "authentication",
          "organization creation",
          "venue and room CRUD",
          "availability calendar",
          "overlapping room conflict",
          "attendee venue RBAC denial",
          "event and ticket tiers",
          "publication and public read",
          "public organization profile",
          "Postgres full-text discovery",
          "account-linked registration and QR generation",
          "registration list and calendar export",
          "idempotent check-in",
          "durable check-in audit",
          "organization activity log",
          "JSON and CSV data export",
          "attendee deletion request workflow",
          "analytics",
          "tenant isolation",
          "member role assignment",
          "organizer ownership isolation"
        ]
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
