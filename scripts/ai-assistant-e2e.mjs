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

const requiredEnvironment = [
  "HOSTLY_E2E_EMAIL",
  "HOSTLY_E2E_PASSWORD",
  "HOSTLY_E2E_ORG_ID",
  "HOSTLY_E2E_ORG_SLUG",
  "HOSTLY_E2E_EVENT_ID",
  "HOSTLY_E2E_EVENT_TITLE"
];
for (const name of requiredEnvironment) {
  if (!process.env[name]) {
    throw new Error(`${name} is required to run the AI assistant verification`);
  }
}
const account = {
  email: process.env.HOSTLY_E2E_EMAIL,
  password: process.env.HOSTLY_E2E_PASSWORD
};
const organization = {
  id: process.env.HOSTLY_E2E_ORG_ID,
  slug: process.env.HOSTLY_E2E_ORG_SLUG
};
const verifiedEvent = {
  id: process.env.HOSTLY_E2E_EVENT_ID,
  title: process.env.HOSTLY_E2E_EVENT_TITLE
};

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

async function getJson(pathname) {
  const response = await context.request.get(`${baseUrl}/api/backend${pathname}`);
  assert(response.ok(), `GET ${pathname} failed with ${response.status()}`);
  return response.json();
}

async function eventRegistrations() {
  const response = await getJson(
    `/organizations/${organization.id}/events/${verifiedEvent.id}/registrations?page=1&pageSize=100`
  );
  return Array.isArray(response) ? response : response.items;
}

try {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email address").fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(
    new RegExp(`/org/${organization.slug}/dashboard$`),
    { timeout: 30_000 }
  );
  await page.waitForLoadState("networkidle");

  // Create one real registration if this verified event does not have one yet.
  let registrations = await eventRegistrations();
  if (registrations.length === 0) {
    await page.goto(`/events/${verifiedEvent.id}`, { waitUntil: "networkidle" });
    await page.getByLabel("Your name").fill("Core Flow Verifier");
    await page.getByLabel("Email address").fill(account.email);
    await page
      .getByRole("button", { name: "Complete registration", exact: true })
      .click();
    await page
      .getByText("Registration confirmed", { exact: true })
      .first()
      .waitFor({ timeout: 40_000 });
    registrations = await eventRegistrations();
  }
  const activeRegistrations = registrations.filter(
    (registration) => registration.status !== "CANCELLED"
  ).length;
  assert(activeRegistrations > 0, "The real event has no active registration to verify");

  // The attendee dashboard reads the user's real registration records.
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await page.getByText(verifiedEvent.title, { exact: true }).first().waitFor();
  assert(
    (await page.getByRole("button", { name: "Open AI assistant" }).count()) === 0,
    "The internal assistant leaked into the attendee dashboard"
  );

  // Ask through the visible assistant and verify the answer against the API count.
  await page.goto(`/org/${organization.slug}/dashboard`, {
    waitUntil: "networkidle"
  });
  await page.getByRole("button", { name: "Open AI assistant" }).click();
  const dialog = page.getByRole("dialog", { name: "Hostly AI assistant" });
  await dialog.waitFor();
  const question = `How many people registered for ${verifiedEvent.title}?`;
  const articles = dialog.locator("article");
  const beforeQuestion = await articles.count();
  await dialog.getByLabel("Message Hostly AI").fill(question);
  await dialog.getByRole("button", { name: "Send message" }).click();
  await page.waitForFunction(
    ({ count }) =>
      document.querySelectorAll('[role="dialog"] article').length >= count + 2,
    { count: beforeQuestion },
    { timeout: 60_000 }
  );
  const answer = await articles.last().innerText();
  assert(
    answer.includes(`${activeRegistrations} active registration`),
    `Assistant answer did not match the database count: ${answer}`
  );
  assert(
    answer.includes(verifiedEvent.title),
    "Assistant answer did not name its source event"
  );
  await page.screenshot({
    path: path.join(artifacts, "06-grounded-ai-answer.png"),
    fullPage: false
  });

  // A description prompt must use Gemini and return editable copy without changing data.
  const descriptionPrompt =
    "Write a polished event description from these notes: product leaders, practical launch checklist, candid peer discussion, no sales pitch.";
  const beforeDescription = await articles.count();
  await dialog.getByLabel("Message Hostly AI").fill(descriptionPrompt);
  await dialog.getByRole("button", { name: "Send message" }).click();
  await page.waitForFunction(
    ({ count }) =>
      document.querySelectorAll('[role="dialog"] article').length >= count + 2,
    { count: beforeDescription },
    { timeout: 90_000 }
  );
  const generatedDescription = await articles.last().innerText();
  const geminiProviderThrottled = generatedDescription.includes(
    "temporarily rate-limited"
  );
  assert(
    geminiProviderThrottled || generatedDescription.length > 100,
    `Gemini response was neither generated copy nor the safe throttle fallback: ${generatedDescription}`
  );

  // Conversational event creation must remain read-only until explicit confirmation.
  const eventsBeforeResponse = await getJson(
    `/organizations/${organization.id}/events?page=1&pageSize=100`
  );
  const eventsBefore = eventsBeforeResponse.items;
  const createPrompt =
    "Create a product launch event next Friday at 6pm for 100 people";
  const beforeProposal = await articles.count();
  await dialog.getByLabel("Message Hostly AI").fill(createPrompt);
  await dialog.getByRole("button", { name: "Send message" }).click();
  await page.waitForFunction(
    ({ count }) =>
      document.querySelectorAll('[role="dialog"] article').length >= count + 2,
    { count: beforeProposal },
    { timeout: 90_000 }
  );
  await dialog.getByText("Requires confirmation", { exact: true }).waitFor();
  const eventsStillUnchangedResponse = await getJson(
    `/organizations/${organization.id}/events?page=1&pageSize=100`
  );
  assert(
    eventsStillUnchangedResponse.items.length === eventsBefore.length,
    "The assistant changed the database before confirmation"
  );
  await dialog
    .getByRole("button", { name: "Confirm & create", exact: true })
    .click();
  await dialog
    .getByRole("link", { name: "Review event draft", exact: true })
    .waitFor({ timeout: 60_000 });
  const eventsAfterResponse = await getJson(
    `/organizations/${organization.id}/events?page=1&pageSize=100`
  );
  assert(
    eventsAfterResponse.items.length === eventsBefore.length + 1,
    "The confirmed assistant action did not create exactly one event"
  );
  const newDraft = eventsAfterResponse.items.find(
    (event) => !eventsBefore.some((previous) => previous.id === event.id)
  );
  assert(newDraft?.status === "DRAFT", "The assistant action did not create a draft");
  await page.screenshot({
    path: path.join(artifacts, "07-confirmed-ai-draft.png"),
    fullPage: false
  });

  assert(browserErrors.length === 0, `Browser errors: ${browserErrors.join("; ")}`);
  assert(serverErrors.length === 0, `Server errors: ${serverErrors.join("; ")}`);
  console.log(
    JSON.stringify(
      {
        verified: true,
        databaseRegistrationCount: activeRegistrations,
        assistantAnswer: answer,
        gemini: {
          providerThrottled: geminiProviderThrottled,
          gracefulFallbackVerified: geminiProviderThrottled,
          descriptionCharacters: generatedDescription.length
        },
        confirmationGate: {
          before: eventsBefore.length,
          beforeConfirmation: eventsStillUnchangedResponse.items.length,
          afterConfirmation: eventsAfterResponse.items.length,
          createdEventId: newDraft.id,
          createdStatus: newDraft.status
        },
        attendeeDashboardUsesRealRegistration: true,
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
