# Hostly AI API

NestJS is the system of record for Hostly AI. The Next.js application never talks to
PostgreSQL, Redis, Resend, or object storage directly; it calls this API at `/api/v1`.

`prisma/schema.prisma` is the migration-enabled canonical schema used by the Prisma
CLI. `src/prisma/schema.prisma` is a synchronized, complete source-layout mirror so
the domain model is discoverable alongside `PrismaService`. Update both copies when
the model changes. `npm run prisma:validate:source` validates the source-layout copy,
and `npm run build` regenerates the client from the canonical schema before compiling.

## Architecture

Each domain is a conventional Nest module:

- `auth` issues short-lived access tokens and rotating refresh tokens in HTTP-only cookies.
- `organizations` owns workspaces, memberships, roles, and email invitations.
- `events` owns event lifecycle, ticket tiers, public discovery, and calendar feeds.
- `registrations` owns transactional inventory, guest/account registration, QR codes, and
  idempotent check-in.
- `analytics` performs tenant-scoped event and registration aggregations.
- `ai-assistant` builds PII-free, tenant-scoped event and room context, answers
  exact operational questions, calls Gemini for copy and intent extraction, and
  signs confirmation-gated event proposals.
- `venues` owns organization venues, rooms, availability reads, and conflict-free
  event allocation.
- `audit` records actor-aware event, venue, room, membership, and check-in activity.
- `compliance` provides organization exports and the attendee deletion-request queue.
- `notifications` sends Resend email and schedules reminders. BullMQ is used when
  a native hosted `REDIS_URL` is set; a database-backed cron worker remains active
  when only Upstash REST credentials are available.
- `common/cache` uses Upstash's HTTPS REST API for public read-through caching,
  with native Redis remaining available as an optional secondary transport.
- `uploads` sends cover images to a public Supabase Storage bucket when configured, and
  otherwise stores them in `backend/uploads` for local development.
- `prisma` is the only database access layer.

Tenant IDs are carried through event, tier, registration, check-in, and reminder records. Composite
foreign keys make mismatched tenant/event/ticket IDs invalid at the database layer, while
guards and service queries enforce the same boundary before a mutation is attempted.

## Hosted-service setup

From the repository root, install dependencies, configure `backend/.env` with
Supabase and Upstash credentials, and run the guarded bootstrap:

```bash
npm install
npm run dev
```

`npm run dev` validates that database and Redis URLs do not point to localhost,
checks paired Upstash REST credentials, prepares Prisma, deploys committed migrations
through `DIRECT_URL`, and starts both applications. Docker is not used and hosted
databases are never seeded automatically. Run `npm run setup` to validate and migrate
without launching the applications. Run `npm run dev:apps` only after infrastructure
has already been prepared.

The frontend runs at
`http://localhost:3100`; this API runs at `http://localhost:4100/api/v1`.

`npm run db:seed` intentionally creates no demo events or accounts. Create data
through the application so it passes the same guards and service validation used
in production.

## Environment

All variables are documented in `.env.example`.

- `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` are required.
- `DATABASE_URL` is the Supabase pooled runtime URL; `DIRECT_URL` is the direct
  connection used by Prisma migrations.
- `RESEND_API_KEY` is optional locally. Without it, email delivery is logged as a
  development no-op; registrations still succeed.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` enable public-page caching.
- `REDIS_URL` is optional and must be a native hosted `redis://` or `rediss://`
  connection string when used. Without it, due reminders are claimed from PostgreSQL
  every minute.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET` are optional.
  The configured bucket must allow public reads for event cover URLs.
- `GEMINI_API_KEY` enables the organization assistant. `GEMINI_MODEL` optionally
  overrides the stable default (`gemini-2.5-flash`). Provider throttling returns
  a safe, non-mutating fallback instead of breaking the chat UI.

Prisma `P1001` now indicates that the configured Supabase endpoint is unreachable.
Confirm both connection URLs, URL-encode special password characters, and verify that
the Supabase project is active. The bootstrap intentionally rejects localhost URLs.

## API overview

All JSON endpoints are under `/api/v1`.

| Domain | Routes |
| --- | --- |
| Auth | `POST /auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`; `GET /auth/me` |
| Organizations | `GET/POST /organizations`; `GET/PATCH /organizations/:orgId`; `GET /organizations/by-slug/:slug`; direct member and invitation routes |
| Public organizations | `GET /public/organizations/:orgSlug` with published events |
| Event management | `GET/POST /organizations/:orgId/events`; `GET/PATCH/DELETE .../:eventId`; publish/unpublish |
| Discovery | `GET /public/events`; `GET /public/events/:slugOrId`; `GET .../:slug/calendar.ics` |
| Registration | `POST /public/events/:eventId/registrations`; `GET /registrations/mine`; `GET /registrations/:id`; tenant-scoped event registration listing |
| Check-in | `POST /organizations/:orgId/events/:eventId/check-in`; `GET .../check-in/stats` |
| Analytics | `GET /organizations/:orgId/analytics/overview` |
| AI assistant | `GET .../:orgId/ai-assistant/insights`; `POST .../chat`, `/descriptions`, and `/actions/confirm` |
| Venues | `GET/POST /organizations/:orgId/venues`; venue and nested room `GET/PATCH/DELETE`; availability calendar |
| Activity | `GET /organizations/:orgId/activity` with action, entity, actor, and date filters |
| Compliance | `GET /organizations/:orgId/compliance/export`; create/list/process deletion requests |
| Upload | `POST /uploads/event-cover` as `multipart/form-data` field `file` |

Public event search accepts `search` (or `q`), `category`, `dateFrom`, `dateTo`,
`location`, `page`, and `pageSize`. Search uses a weighted PostgreSQL `tsvector` maintained
by the initial migration and indexed with GIN.

Successful signup/login/refresh responses set `access_token` and `refresh_token` cookies.
Browser calls must use `credentials: "include"`. API errors have one shape:

```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Human-readable message",
  "path": "/api/v1/...",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## Role rules

- `ORG_ADMIN` manages the workspace, all members, and all events.
- `ORGANIZER` can create events and can read/change/check in only events they own.
- `ORG_ADMIN` and `ORGANIZER` can manage organization venues and rooms.
- `ATTENDEE` has no management access.

A single user can have a different role in every organization. Never add an unscoped
`findUnique` mutation to a tenant-owned domain: first resolve membership and include
`organizationId` in the lookup (or use an existing `require*` helper).

## Adding a feature

1. Add Prisma models or fields and create a named migration.
2. Create a domain module with controller, service, and `dto/` directory.
3. Put validation/routing in the controller and business rules in the service.
4. Apply `@OrgRoles(...)` for organization routes and still scope every service query by
   `organizationId`; guards do not replace tenant-aware queries.
5. Export only services another module truly needs.
6. Add a smoke or unit test and run `npm run build --workspace backend`.

Roadmap integrations should be added as new modules: a Nest gateway for live
inventory, a waitlist domain around registration cancellation, and post-event AI
reporting. The current event, registration, and assistant services expose clean
boundaries for those additions without moving business logic into controllers.
