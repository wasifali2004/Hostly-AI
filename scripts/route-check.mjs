const API_URL = (process.env.API_URL || "http://localhost:4100/api/v1").replace(
  /\/$/,
  ""
);
const FRONTEND_URL = (
  process.env.FRONTEND_URL || "http://localhost:3100"
).replace(/\/$/, "");

class Session {
  #cookies = new Map();

  get cookieHeader() {
    return [...this.#cookies]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  async api(path, options = {}) {
    const headers = new Headers(options.headers);
    if (this.cookieHeader) headers.set("Cookie", this.cookieHeader);
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      redirect: "manual"
    });
    this.#captureCookies(response);
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    if (!response.ok) {
      throw new Error(
        `${options.method || "GET"} ${path} failed (${response.status}): ${JSON.stringify(body)}`
      );
    }
    return body;
  }

  #captureCookies(response) {
    const values =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [response.headers.get("set-cookie")].filter(Boolean);
    for (const value of values) {
      const [pair] = value.split(";");
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator).trim();
      const cookieValue = pair.slice(separator + 1).trim();
      if (cookieValue) this.#cookies.set(name, cookieValue);
      else this.#cookies.delete(name);
    }
  }
}

async function login(email) {
  const session = new Session();
  await session.api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: "HostlyDemo123!" })
  });
  return session;
}

async function inspectRoute(route) {
  const response = await fetch(`${FRONTEND_URL}${route.path}`, {
    headers: route.session?.cookieHeader
      ? { Cookie: route.session.cookieHeader }
      : undefined,
    redirect: "manual"
  });
  const html = await response.text();
  const location = response.headers.get("location");
  const ok =
    response.status === 200 &&
    !/Internal Server Error|Application error: a server-side exception/i.test(
      html
    );
  return {
    ...route,
    ok,
    status: response.status,
    location,
    bytes: Buffer.byteLength(html)
  };
}

async function run() {
  const [admin, attendee] = await Promise.all([
    login("admin@northstar.demo"),
    login("attendee@northstar.demo")
  ]);
  const organizations = await admin.api("/organizations");
  const organization = (organizations.items || organizations)[0];
  if (!organization?.id || !organization.slug) {
    throw new Error("The seed organization was not found");
  }
  const eventPage = await admin.api(
    `/organizations/${organization.id}/events?pageSize=100`
  );
  const event =
    eventPage.items.find((item) => item.status === "PUBLISHED") ||
    eventPage.items[0];
  if (!event?.id) throw new Error("The seed event was not found");

  const org = `/org/${encodeURIComponent(organization.slug)}`;
  const eventPath = `${org}/events/${encodeURIComponent(event.id)}`;
  const routes = [
    { label: "landing", path: "/" },
    { label: "event discovery", path: "/events" },
    { label: "event detail", path: `/events/${encodeURIComponent(event.id)}` },
    { label: "public organization", path: org },
    { label: "login", path: "/login" },
    { label: "signup", path: "/signup" },
    { label: "attendee dashboard", path: "/dashboard", session: attendee },
    { label: "attendee privacy", path: "/dashboard/privacy", session: attendee },
    { label: "organization dashboard", path: `${org}/dashboard`, session: admin },
    { label: "organization events", path: `${org}/events`, session: admin },
    { label: "new event", path: `${org}/events/new`, session: admin },
    { label: "edit event", path: `${eventPath}/edit`, session: admin },
    {
      label: "event registrations",
      path: `${eventPath}/registrations`,
      session: admin
    },
    { label: "event check-in", path: `${eventPath}/checkin`, session: admin },
    { label: "organization venues", path: `${org}/venues`, session: admin },
    {
      label: "room availability",
      path: `${org}/venues/availability`,
      session: admin
    },
    { label: "activity log", path: `${org}/activity`, session: admin },
    { label: "compliance center", path: `${org}/compliance`, session: admin },
    { label: "organization members", path: `${org}/members`, session: admin },
    { label: "organization settings", path: `${org}/settings`, session: admin }
  ];

  const results = [];
  for (const route of routes) {
    results.push(await inspectRoute(route));
  }

  console.table(
    results.map(({ label, path, status, bytes, ok, location }) => ({
      route: label,
      path,
      status,
      bytes,
      result: ok ? "PASS" : "FAIL",
      redirect: location || ""
    }))
  );
  const failures = results.filter((result) => !result.ok);
  if (failures.length) {
    throw new Error(
      `${failures.length} frontend route(s) failed: ${failures
        .map(({ path, status, location }) =>
          `${path} (${status}${location ? ` -> ${location}` : ""})`
        )
        .join(", ")}`
    );
  }
  console.log(`All ${results.length} required Hostly routes returned healthy pages.`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
