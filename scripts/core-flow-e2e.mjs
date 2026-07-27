import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const artifacts = path.join(root, "artifacts", "core-flow");
const chromePath =
  process.env.HOSTLY_CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = process.env.HOSTLY_APP_URL || "http://localhost:3100";
const suffix = Date.now().toString(36);
const account = {
  name: "Core Flow Verifier",
  organization: `Core Flow ${suffix}`,
  email: `core-flow-${suffix}@hostly.test`,
  password: "CoreFlow123!"
};
const event = {
  title: `Hostly Live Verification ${suffix}`,
  description:
    "A real end-to-end event created through the Hostly organizer interface and stored in Supabase.",
  virtualUrl: "https://meet.example.com/hostly-live-verification",
  tierName: "Verified admission",
  capacity: "64"
};

function localDateTime(daysFromNow, hour) {
  const value = new Date();
  value.setDate(value.getDate() + daysFromNow);
  value.setHours(hour, 0, 0, 0);
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await mkdir(artifacts, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true
});
const context = await browser.newContext({
  baseURL: baseUrl,
  viewport: { width: 1440, height: 960 }
});
const page = await context.newPage();
const browserErrors = [];
const serverErrors = [];

page.on("pageerror", (error) => browserErrors.push(error.message));
page.on("requestfailed", (request) => {
  const detail = request.failure()?.errorText || "failed";
  if (!detail.includes("ERR_ABORTED")) {
    browserErrors.push(`${request.method()} ${request.url()} — ${detail}`);
  }
});
page.on("response", (response) => {
  if (response.status() >= 500) {
    serverErrors.push(`${response.status()} ${response.url()}`);
  }
});

async function jsonApi(pathname) {
  const response = await context.request.get(`${baseUrl}/api/backend${pathname}`);
  assert(response.ok(), `GET ${pathname} failed with ${response.status()}`);
  return response.json();
}

try {
  // 1. Sign up as a new user and create the organization through the real UI.
  await page.goto("/signup", { waitUntil: "networkidle" });
  await page.getByLabel("Your name").fill(account.name);
  await page.getByLabel("Workspace name").fill(account.organization);
  await page.getByLabel("Email address").fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await page.waitForURL(/\/org\/[^/]+\/dashboard/, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");

  const dashboardUrl = page.url();
  const dashboardPath = new URL(dashboardUrl).pathname;
  const orgSlug = dashboardPath.split("/")[2];
  await page.getByText(account.organization, { exact: true }).first().waitFor();
  await page.getByText("All events", { exact: true }).waitFor();
  await page.getByText("Registrations", { exact: true }).waitFor();
  await page.screenshot({
    path: path.join(artifacts, "01-org-dashboard.png"),
    fullPage: false
  });

  // Session cookies must be HTTP-only and visible on the frontend origin.
  const cookiesAfterSignup = (await context.cookies()).filter((cookie) =>
    ["access_token", "refresh_token"].includes(cookie.name)
  );
  assert(cookiesAfterSignup.length === 2, "Access and refresh cookies were not both issued");
  assert(
    cookiesAfterSignup.every(
      (cookie) => cookie.domain === "localhost" && cookie.httpOnly && cookie.path === "/"
    ),
    "Session cookies are not scoped securely to the frontend origin"
  );

  // 2–4. Navigate through Workspace, open the event creator, and publish real input.
  await page.getByRole("link", { name: "Events", exact: true }).click();
  await page.waitForURL(new RegExp(`/org/${orgSlug}/events$`));
  await page.getByRole("link", { name: "Create event", exact: true }).click();
  await page.waitForURL(new RegExp(`/org/${orgSlug}/events/new$`));
  await page.getByLabel("Event title").fill(event.title);
  await page.getByRole("textbox", { name: /^Description/ }).fill(event.description);
  await page.getByLabel("Starts").fill(localDateTime(21, 18));
  await page.getByLabel("Ends").fill(localDateTime(21, 21));
  await page.getByRole("button", { name: "Online", exact: true }).click();
  await page.getByLabel("Virtual event link").fill(event.virtualUrl);
  await page.getByLabel("Tier 1 name").fill(event.tierName);
  await page.getByLabel("Capacity").fill(event.capacity);
  await page.getByRole("button", { name: "Publish event", exact: true }).click();
  await page.waitForURL(new RegExp(`/org/${orgSlug}/events$`), { timeout: 30_000 });
  await page.getByText(event.title, { exact: true }).waitFor({ timeout: 20_000 });
  await page.screenshot({
    path: path.join(artifacts, "02-real-event-list.png"),
    fullPage: false
  });

  // Confirm the event exists in the authenticated API response, not just the DOM.
  const organizationsResponse = await jsonApi("/organizations");
  const organizations = Array.isArray(organizationsResponse)
    ? organizationsResponse
    : organizationsResponse.items;
  const organization = organizations.find((item) => item.slug === orgSlug);
  assert(organization, "The newly created organization was not returned by the API");
  const workspaceEventsResponse = await jsonApi(
    `/organizations/${organization.id}/events?page=1&pageSize=100`
  );
  const workspaceEvent = workspaceEventsResponse.items.find(
    (item) => item.title === event.title
  );
  assert(workspaceEvent, "The new event was not saved in the database");
  assert(workspaceEvent.status === "PUBLISHED", "The new event was not published");
  assert(
    workspaceEvent.capacity === Number(event.capacity),
    "The database event capacity does not match the UI input"
  );

  // 5–6. Discover the event publicly, click its real ID link, and inspect its data.
  await page.goto(`/events?search=${encodeURIComponent(event.title)}`, {
    waitUntil: "networkidle"
  });
  const eventLink = page.getByRole("link", { name: event.title, exact: true });
  await eventLink.waitFor({ timeout: 20_000 });
  await eventLink.click();
  await page.waitForURL(`/events/${workspaceEvent.id}`, { timeout: 20_000 });
  await page.getByRole("heading", { name: event.title, exact: true }).waitFor();
  await page.getByText(event.description, { exact: true }).last().waitFor();
  await page
    .getByRole("button", { name: "Complete registration", exact: true })
    .waitFor();
  await page.screenshot({
    path: path.join(artifacts, "03-real-event-detail.png"),
    fullPage: false
  });

  // 7. Refresh both a public page and protected workspace route without losing auth.
  await page.reload({ waitUntil: "networkidle" });
  assert(
    new URL(page.url()).pathname === `/events/${workspaceEvent.id}`,
    "Refreshing the public event changed its route"
  );
  await page.goto(dashboardPath, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  assert(
    new URL(page.url()).pathname === dashboardPath,
    "Refreshing a protected workspace route logged the user out"
  );
  await page.getByText(event.title, { exact: true }).first().waitFor({ timeout: 20_000 });
  await page.screenshot({
    path: path.join(artifacts, "04-session-refresh.png"),
    fullPage: false
  });

  // 8. Log out, log back in, and confirm the same persisted organization/event data.
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/, { timeout: 20_000 });
  assert(
    (await context.cookies()).filter((cookie) =>
      ["access_token", "refresh_token"].includes(cookie.name)
    ).length === 0,
    "Logout did not clear the session cookies"
  );
  await page.getByLabel("Email address").fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(new RegExp(`/org/${orgSlug}/dashboard$`), { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await page.getByText(event.title, { exact: true }).first().waitFor({ timeout: 20_000 });
  await page.screenshot({
    path: path.join(artifacts, "05-login-restored-data.png"),
    fullPage: false
  });

  assert(browserErrors.length === 0, `Browser errors: ${browserErrors.join("; ")}`);
  assert(serverErrors.length === 0, `Server errors: ${serverErrors.join("; ")}`);

  console.log(
    JSON.stringify(
      {
        verified: true,
        account: {
          name: account.name,
          organization: account.organization,
          email: account.email
        },
        organization: {
          id: organization.id,
          slug: organization.slug
        },
        event: {
          id: workspaceEvent.id,
          title: workspaceEvent.title,
          status: workspaceEvent.status,
          capacity: workspaceEvent.capacity
        },
        checks: [
          "signup",
          "organization creation",
          "real org dashboard",
          "event creation and publish",
          "workspace event list",
          "public event detail by database ID",
          "refresh persistence",
          "logout and login data restoration"
        ],
        browserErrors,
        serverErrors
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
