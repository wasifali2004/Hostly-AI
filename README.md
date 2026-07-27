# Hostly AI

Hostly AI is a full-stack, multi-tenant event orchestration platform. Organizations get isolated workspaces for their members, events, ticket inventory, registrations, door check-in, and analytics. Attendees get public discovery, guest or account registration, QR passes, and calendar downloads.

The repository is an npm workspace monorepo:

```text
frontend/  Next.js App Router, TypeScript, Tailwind CSS, Recharts
backend/   NestJS, TypeScript, Prisma, PostgreSQL, BullMQ, Resend
```

The frontend only talks to the NestJS API. PostgreSQL, Redis, Resend, object-storage credentials, JWT signing, QR generation, and all tenant authorization remain inside the backend.

## Architecture

```text
Browser
  |
  +-- Next.js :3100
        |
        +-- same-origin /api/backend proxy --> NestJS /api/v1 :4100
                                               |
                       +-----------------------+----------------------+
                       |                       |                      |
               Supabase PostgreSQL       Upstash Redis        Resend / Storage
                  Prisma models       cache + optional queue  optional adapters
```

- Access and rotating refresh JWTs are sent in HTTP-only cookies.
- Browser API traffic uses a same-origin Next.js proxy so those cookies remain
  visible to Next middleware even when the frontend and API use different hosts.
- Nest guards enforce authenticated access and per-organization roles.
- Service queries include `organizationId`; composite tenant foreign keys prevent cross-organization event, venue, room, tier, registration, and check-in relationships.
- Organizers can manage only events they own. Organization admins can manage the entire workspace.
- Venue rooms are locked transactionally before assignment, while PostgreSQL also rejects overlapping time ranges for the same room.
- Public event search uses a weighted PostgreSQL `tsvector` with a GIN index.
- Registration locks event and ticket-tier rows before checking capacity.
- Every accepted check-in creates a first-class `CheckIn` audit record.
- Organization activity logs capture event, venue, room, membership, and check-in changes with actor and timestamp.
- Organization exports and attendee deletion-request queues provide practical data-portability foundations.
- Public event reads use Upstash's HTTPS REST API as a short read-through cache when its REST credentials are configured.
- Reminder jobs use BullMQ when a native hosted `REDIS_URL` is configured and a PostgreSQL-backed scheduled fallback otherwise.
- The organization assistant grounds answers in tenant-scoped Prisma aggregates,
  uses Gemini for language/extraction, and requires a signed confirmation before writes.

The three-paragraph, randomly selected Modernist landing-page brief is in [DESIGN_PROMPT.md](DESIGN_PROMPT.md).

## Hosted-service setup

Requirements: Node.js 20+, npm, a Supabase PostgreSQL project, and Upstash Redis credentials. Docker is not used.

1. Install dependencies.

   ```bash
   npm install
   ```

2. Copy `backend/.env.example` to `backend/.env` and provide:

   - Supabase pooled `DATABASE_URL`
   - Supabase direct `DIRECT_URL`
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
   - independent JWT secrets
   - optional Supabase Storage, Gemini, Resend, and native Redis credentials

3. Validate the hosted configuration and deploy committed migrations.

   ```bash
   npm run setup
   ```

4. Start Hostly.

   ```bash
   npm run dev
   ```

The guarded development command rejects localhost infrastructure URLs, validates paired Upstash credentials, checks the Prisma client, deploys migrations through `DIRECT_URL`, and launches both applications. It never starts Docker and never seeds a hosted database automatically.

Use `npm run dev:apps` only when the hosted database has already been migrated. Open `http://localhost:3100`; the API health response is at `http://localhost:4100/api/v1/health`.

`npm run db:seed` intentionally creates no users or events. Use the signup and
event-creation screens so development data exercises the real authorization and
validation paths.

Without a `RESEND_API_KEY`, transactional email is a development no-op and the QR pass is still returned to the browser. Add a Resend free-tier key and verified `EMAIL_FROM` to deliver confirmation and reminder messages. Without Supabase Storage credentials, event images are saved to `backend/uploads`; these local uploads are intended only as a development fallback.

## Frontend routes

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | One-page Hostly landing experience | Public |
| `/events` | Search and filter published events | Public |
| `/events/[eventId]` | SEO event detail and registration | Public |
| `/org/[orgSlug]` | Public organization profile | Public |
| `/login`, `/signup` | JWT cookie-backed account entry | Public |
| `/dashboard` | An attendee's registrations and passes | Authenticated |
| `/dashboard/privacy` | Submit and track attendee data-deletion requests | Authenticated |
| `/org/[orgSlug]/dashboard` | Organization analytics | Admin or organizer |
| `/org/[orgSlug]/events` | Manage scoped events | Admin or organizer |
| `/org/[orgSlug]/events/new` | Create an event and tiers | Admin or organizer |
| `/org/[orgSlug]/events/[eventId]/edit` | Edit, publish, or delete an event | Owning organizer or admin |
| `/org/[orgSlug]/events/[eventId]/registrations` | Search the event guest list | Owning organizer or admin |
| `/org/[orgSlug]/events/[eventId]/checkin` | Mobile QR/manual check-in and live counts | Owning organizer or admin |
| `/org/[orgSlug]/venues` | Manage venues and their rooms | Admin or organizer |
| `/org/[orgSlug]/venues/availability` | Visual room availability calendar | Admin or organizer |
| `/org/[orgSlug]/activity` | Filtered organization activity history | Admin |
| `/org/[orgSlug]/compliance` | Data export and deletion-request queue | Admin |
| `/org/[orgSlug]/members` | Add, invite, re-role, and remove members | Admin |
| `/org/[orgSlug]/settings` | Update organization identity | Admin |

All dynamic pages use their URL `eventId` or `orgSlug` to request live API data. Public pages are server-rendered; forms, charts, QR scanning, and authenticated management are focused client components.

## Useful commands

```bash
npm run dev          # validate hosted services, migrate, then start both apps
npm run setup        # validate hosted services and deploy migrations
npm run dev:apps     # start both apps without hosted-service validation
npm run build        # production builds for both workspaces
npm run lint         # lint both workspaces
npm run db:generate  # generate the Prisma client
npm run db:migrate   # create/apply development migrations
npm run db:seed      # explicitly seed deterministic demonstration data
npm run smoke        # end-to-end API workflow and tenant-boundary checks
npm run routes:check # verify every required frontend URL against running apps
```

`npm run dev` and `npm run setup` apply committed migrations with `prisma migrate deploy`; they never run a destructive development migration against Supabase.

### PostgreSQL connection errors

`P1001` now means the configured Supabase endpoint could not be reached. Confirm that `DATABASE_URL` uses the pooled runtime endpoint, `DIRECT_URL` uses the direct endpoint, the password is URL-encoded, and the Supabase project is active. The hosted bootstrap refuses `localhost` database and Redis URLs.

Local web/API process defaults remain `3100` and `4100`. Override the API with `PORT`, `API_URL`, and `FRONTEND_URL` in `backend/.env`; override the web port with `HOSTLY_FRONTEND_PORT` and keep `NEXT_PUBLIC_APP_URL` aligned.

## Free-tier configuration

| Concern | Free-tier option | Environment |
| --- | --- | --- |
| PostgreSQL | Supabase | `DATABASE_URL`, `DIRECT_URL` |
| Public cache | Upstash Redis REST | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| BullMQ reminders (optional) | Upstash native Redis | `REDIS_URL` |
| Email | Resend | `RESEND_API_KEY`, `EMAIL_FROM` |
| Event images | Supabase Storage | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` |
| Grounded organization assistant | Gemini | `GEMINI_API_KEY`, optional `GEMINI_MODEL` |

Never place provider secrets in `frontend` or in a committed environment file. If a credential has ever appeared in a committed/example file, rotate it at the provider.

## Adding a feature

Backend features follow the existing module pattern: create a domain module, controller, service, and validated DTOs; put business logic in the service; use Prisma only behind the backend; and include `organizationId` in every tenant-owned lookup or mutation. Add a migration for data changes and extend the smoke test for the new boundary.

Frontend features live in the closest route group and domain component directory. Add DTO-matching contracts in `frontend/src/types`, add typed requests in `frontend/src/lib/api-client.ts`, use server components for public read paths, and keep browser-only behavior in small client components.

Roadmap seams are intentionally preserved for a Nest WebSocket gateway, waitlist
promotion, post-event AI reports, stronger public throttling, and broader Redis
invalidation. They are not presented as partially working Phase 1 features.

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for implementation details.
