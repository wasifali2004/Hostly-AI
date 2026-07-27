# Hostly AI verification

## Completed checks

- [x] Random style selection produced `Modernist`.
- [x] `DESIGN_PROMPT.md` contains exactly three paragraphs.
- [x] The previously missing `braces/lib/stringify.js` dependency resolves from the installed workspace.
- [x] `npm run build` passes for the full monorepo.
- [x] Prisma Client generation passes during the backend prebuild.
- [x] NestJS production compilation passes.
- [x] Next.js production compilation, lint/type validation, page-data collection, and static generation pass.
- [x] The compiled Next app manifest contains every one of the 20 required routes.
- [x] All dynamic page sources consume `orgSlug` and/or `eventId` and use the typed API layer.
- [x] No runtime demo-data fallback or obsolete duplicate route remains.
- [x] Canonical and `src/prisma` schemas are semantically synchronized.
- [x] Independent backend audit covered schema relations, migrations, CheckIn backfill, seed data, controller route precedence, generated Prisma types, and tenant-scoped queries.
- [x] Previously exposed values were removed from `.env.example`; the repository scan no longer finds them.
- [x] `scripts/smoke.mjs` parses and covers auth, organization creation/lookup, event/tier CRUD, publication, public discovery, full-text search, public org profile, account registration, QR output, registration roster, ICS, idempotent check-in, CheckIn audit, analytics, member roles, organizer ownership, and tenant isolation.
- [x] `scripts/route-check.mjs` parses and enumerates all required public, attendee, and organization pages.
- [x] Docker Compose, local PostgreSQL/Redis bootstrap scripts, and local-infrastructure npm commands were removed.
- [x] The configured Supabase pooled and direct connection URLs pass hosted-only validation.
- [x] All three Prisma migrations were successfully applied to the configured Supabase database.
- [x] `npm run setup` validates hosted credentials, prepares Prisma, and deploys migrations without Docker or automatic seed data.
- [x] The configured Upstash REST credentials pass a temporary write/read/delete probe.
- [x] Backend TypeScript validation and the updated Prisma service lint check pass.
- [x] The professional UI redesign compiled successfully across all 20 routes.
- [x] The final landing-page preview change compiled successfully in the latest Next.js production build.
- [x] The final root-level `npm run build` completes successfully for both NestJS and Next.js.
- [x] Backend builds skip redundant Prisma Client regeneration while still regenerating automatically after a schema change, preventing the Windows query-engine lock.
- [x] Frontend ESLint is configured non-interactively for the App Router and finishes with zero warnings or errors.
- [x] Backend ESLint finishes with zero warnings or errors.
- [x] Local defaults were moved to frontend port `3100` and API port `4100` because Windows reserves the ranges containing `3000` and `4000` on this machine.
- [x] The root `npm run dev` command rejects localhost infrastructure, validates Supabase and Upstash configuration, applies migrations through `DIRECT_URL`, and launches both applications without Docker.
- [x] Venue and room CRUD, the 31-day availability view, event room assignment, capacity checks, and overlapping-room rejection are implemented and live-tested.
- [x] Organization activity filters, JSON/CSV compliance export, attendee deletion requests, and the admin processing queue are implemented and live-tested.
- [x] Auth and check-in actions provide global success/error toast feedback; destructive actions use accessible confirmation dialogs.
- [x] Native selects, browser `alert()`, and browser `confirm()` are absent from the frontend source.
- [x] The unique Hostly doorway/orchestration mark, custom wordmark, favicon, and web manifest compile and render correctly.
- [x] `npm run smoke` passes all 21 live end-to-end checks, including tenant isolation and room-conflict protection.
- [x] `npm run routes:check` reports HTTP 200/PASS for all 20 required pages.
- [x] The landing page was visually inspected at desktop and narrow responsive widths; both primary CTAs remain above the fold.
- [x] The desktop authentication layout was visually inspected at 1440×900; the full form and complete feature panel fit without scrolling.
- [x] The NestJS production API starts against Supabase with no local database or Redis process and returns HTTP 200 for health and public-event reads.

Start the complete local stack with:

```powershell
npm run dev
```

Then open `http://localhost:3100`. The API health endpoint is `http://localhost:4100/api/v1/health`.

The smoke suite creates and mutates data. Run it only against a disposable Supabase
project:

```powershell
npm run smoke
npm run routes:check
```

The demonstration accounts are created only when `npm run db:seed` is explicitly run.
