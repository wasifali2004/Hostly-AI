# Hostly AI frontend

Hostly’s frontend is a Next.js 15 App Router application for public discovery, attendee
passes, and organization operations. The browser never connects directly to PostgreSQL,
Redis, Resend, storage, or Gemini: all state and business decisions come from the NestJS
API through `src/lib/api-client.ts`.

## Run locally

From the repository root:

```bash
npm install
npm run dev --workspace frontend
```

Copy `.env.example` to `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4100/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3100
```

The API URL includes Nest’s global `/api/v1` prefix and must not end in `/`. The local
web server defaults to port `3100`; set `HOSTLY_FRONTEND_PORT` to override it and keep
`NEXT_PUBLIC_APP_URL` aligned.

Browser requests go through `/api/backend/[...path]`. This same-origin proxy forwards
JWT cookies and upstream `Set-Cookie` headers, so Next middleware and browser requests
share one session boundary even when Nest is deployed on another host.

## Route map

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Modernist product landing page and live featured events | Public |
| `/events` | Search, category, date, and location discovery | Public |
| `/events/[eventId]` | Server-rendered event detail and registration | Public |
| `/org/[orgSlug]` | Public organization profile and published events | Public |
| `/login`, `/signup` | Cookie-backed authentication | Public |
| `/dashboard` | Attendee tickets and managed-workspace shortcuts | Authenticated |
| `/dashboard/privacy` | Attendee deletion-request controls | Authenticated |
| `/org/[orgSlug]/dashboard` | Organization analytics overview | Admin/organizer |
| `/org/[orgSlug]/events` | Event lifecycle management | Admin/organizer |
| `/org/[orgSlug]/events/new` | Event and ticket-tier builder | Admin/organizer |
| `/org/[orgSlug]/events/[eventId]/edit` | Organization-scoped event editor | Admin/organizer |
| `/org/[orgSlug]/events/[eventId]/registrations` | Searchable guest roster | Admin/organizer |
| `/org/[orgSlug]/events/[eventId]/checkin` | Mobile QR/manual check-in | Admin/organizer |
| `/org/[orgSlug]/venues` | Venue and room management | Admin/organizer |
| `/org/[orgSlug]/venues/availability` | Visual room availability calendar | Admin/organizer |
| `/org/[orgSlug]/activity` | Filterable organization audit history | Org admin |
| `/org/[orgSlug]/compliance` | Data export and deletion-request queue | Org admin |
| `/org/[orgSlug]/members` | Add, invite, re-role, and remove members | Org admin |
| `/org/[orgSlug]/settings` | Organization identity and profile | Org admin |
| `/invitations/[token]` | Accept an organization invitation | Authenticated |

`src/middleware.ts` performs a fast cookie-presence check for `/dashboard` and nested
organization operations. The public `/org/[orgSlug]` profile is explicitly excluded.
`AuthProvider` verifies the session with `GET /auth/me`, and `useOrg` resolves the URL slug
to the user’s matching membership. Nest guards and organization-scoped database queries
remain the authorization source of truth.

## Source structure

```text
src/
  app/
    (public)/           Landing, discovery, event, and organization pages
    (auth)/             Login and signup
    (dashboard)/        Attendee dashboard
    (org)/              Slug-scoped organizer/admin operations
  components/
    ai/                 Grounded organization assistant and confirmation cards
    auth/               Authentication form
    dashboard/          Analytics, editor, venue, activity, compliance, and scanner views
    org/                Role-aware organization shell
    public/             Event discovery and registration UI
    tickets/            Attendee QR pass
    ui/                 Button, Card, Dialog, toast, combobox, form, and state primitives
  hooks/                useAuth and useOrg
  lib/
    api-client.ts       Typed methods for every Nest endpoint
    api-server.ts       Server-only cookie-forwarding helper
    utils.ts            Date, timezone, and presentation helpers
  providers/            Verified session and active membership state
  types/                API contracts shared by pages and components
```

Public event pages use server rendering and one-minute revalidation. Authenticated views
use uncached requests and include credentials so Nest’s HTTP-only access and refresh
cookies are sent automatically. A concurrent 401 refresh is deduplicated and the original
request is replayed once.

The organization shell exposes the assistant only to management members; the backend
role guard remains the authorization source of truth.

## Adding a feature

1. Add its contract under `src/types`.
2. Add a typed domain method in `src/lib/api-client.ts`.
3. Put reusable UI in the matching component feature folder.
4. Add the page under the appropriate route group, reading every dynamic URL parameter.
5. Include loading, empty, and error states.
6. Mirror UI role checks with a real Nest guard and tenant-scoped service query.

## Verification

```bash
npm run typecheck --workspace frontend
npm run build --workspace frontend
```

Camera scanning requires HTTPS or localhost and browser `BarcodeDetector` support. Manual
entry remains available everywhere. Event dates are edited in an IANA timezone and sent to
the API as UTC instants.
