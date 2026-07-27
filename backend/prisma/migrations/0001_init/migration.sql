-- Hostly AI Phase 1
-- PostgreSQL is the source of truth for tenant boundaries: every organization-owned
-- child carries organization_id, and composite foreign keys prevent cross-tenant links.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "org_role" AS ENUM ('ORG_ADMIN', 'ORGANIZER', 'ATTENDEE');
CREATE TYPE "invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
CREATE TYPE "event_status" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');
CREATE TYPE "location_type" AS ENUM ('PHYSICAL', 'VIRTUAL', 'HYBRID');
CREATE TYPE "registration_status" AS ENUM ('CONFIRMED', 'CANCELLED', 'CHECKED_IN');
CREATE TYPE "reminder_status" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "avatar_url" TEXT,
    "email_verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_users_email" UNIQUE ("email")
);

CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "replaced_by_token_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_refresh_tokens_token_hash" UNIQUE ("token_hash"),
    CONSTRAINT "uq_refresh_tokens_replaced_by" UNIQUE ("replaced_by_token_id")
);

CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_organizations_slug" UNIQUE ("slug")
);

CREATE TABLE "memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "org_role" NOT NULL DEFAULT 'ATTENDEE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_memberships_organization_user" UNIQUE ("organization_id", "user_id")
);

CREATE TABLE "invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "role" "org_role" NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "status" "invitation_status" NOT NULL DEFAULT 'PENDING',
    "invited_by_id" UUID NOT NULL,
    "accepted_by_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_invitations_token_hash" UNIQUE ("token_hash")
);

CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "organizer_id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "event_status" NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'UTC',
    "location_type" "location_type" NOT NULL,
    "venue_name" VARCHAR(180),
    "address_line_1" VARCHAR(500),
    "address_line_2" VARCHAR(500),
    "city" VARCHAR(120),
    "region" VARCHAR(120),
    "postal_code" VARCHAR(32),
    "country" VARCHAR(2),
    "virtual_url" TEXT,
    "capacity" INTEGER,
    "cover_image_url" TEXT,
    "category" VARCHAR(80) NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),
    "search_vector" TSVECTOR,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_events_slug" UNIQUE ("slug"),
    CONSTRAINT "uq_events_organization_slug" UNIQUE ("organization_id", "slug"),
    CONSTRAINT "uq_events_id_organization" UNIQUE ("id", "organization_id"),
    CONSTRAINT "ck_events_end_after_start" CHECK ("ends_at" > "starts_at"),
    CONSTRAINT "ck_events_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0)
);

CREATE TABLE "ticket_tiers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL,
    "price_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "sales_start_at" TIMESTAMPTZ(3),
    "sales_end_at" TIMESTAMPTZ(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_tiers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_ticket_tiers_organization_event_name" UNIQUE ("organization_id", "event_id", "name"),
    CONSTRAINT "uq_ticket_tiers_id_event_organization" UNIQUE ("id", "event_id", "organization_id"),
    CONSTRAINT "ck_ticket_tiers_capacity_positive" CHECK ("capacity" > 0),
    CONSTRAINT "ck_ticket_tiers_price_nonnegative" CHECK ("price_cents" >= 0),
    CONSTRAINT "ck_ticket_tiers_sales_window" CHECK (
        "sales_start_at" IS NULL OR "sales_end_at" IS NULL OR "sales_end_at" > "sales_start_at"
    )
);

CREATE TABLE "registrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "ticket_tier_id" UUID NOT NULL,
    "user_id" UUID,
    "attendee_name" VARCHAR(120) NOT NULL,
    "attendee_email" VARCHAR(320) NOT NULL,
    "attendee_phone" VARCHAR(40),
    "status" "registration_status" NOT NULL DEFAULT 'CONFIRMED',
    "qr_code" VARCHAR(128) NOT NULL,
    "checked_in_at" TIMESTAMPTZ(3),
    "checked_in_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_registrations_qr_code" UNIQUE ("qr_code"),
    CONSTRAINT "uq_registrations_event_attendee_email" UNIQUE ("event_id", "attendee_email"),
    CONSTRAINT "uq_registrations_id_organization" UNIQUE ("id", "organization_id"),
    CONSTRAINT "ck_registrations_check_in_consistent" CHECK (
        ("status" = 'CHECKED_IN' AND "checked_in_at" IS NOT NULL)
        OR ("status" <> 'CHECKED_IN' AND "checked_in_at" IS NULL)
    ),
    CONSTRAINT "ck_registrations_cancelled_consistent" CHECK (
        ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL)
        OR ("status" <> 'CANCELLED' AND "cancelled_at" IS NULL)
    )
);

CREATE TABLE "reminder_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "queue_job_id" VARCHAR(128),
    "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
    "status" "reminder_status" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" VARCHAR(255),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_reminder_jobs_registration" UNIQUE ("registration_id"),
    CONSTRAINT "uq_reminder_jobs_queue_job" UNIQUE ("queue_job_id"),
    CONSTRAINT "ck_reminder_jobs_attempts_nonnegative" CHECK ("attempts" >= 0)
);

CREATE INDEX "idx_refresh_tokens_user_expires"
    ON "refresh_tokens" ("user_id", "expires_at");

CREATE INDEX "idx_organizations_created_by"
    ON "organizations" ("created_by_id");

CREATE INDEX "idx_memberships_organization_role"
    ON "memberships" ("organization_id", "role");
CREATE INDEX "idx_memberships_user"
    ON "memberships" ("user_id");

CREATE INDEX "idx_invitations_organization_status"
    ON "invitations" ("organization_id", "status");
CREATE INDEX "idx_invitations_email_status"
    ON "invitations" ("email", "status");
CREATE INDEX "idx_invitations_expires"
    ON "invitations" ("expires_at");

CREATE INDEX "idx_events_organization_status_starts"
    ON "events" ("organization_id", "status", "starts_at");
CREATE INDEX "idx_events_organizer_status"
    ON "events" ("organizer_id", "status");
CREATE INDEX "idx_events_status_starts"
    ON "events" ("status", "starts_at");
CREATE INDEX "idx_events_category"
    ON "events" ("category");
CREATE INDEX "idx_events_city"
    ON "events" ("city");
CREATE INDEX "idx_events_public_upcoming"
    ON "events" ("starts_at")
    WHERE "status" = 'PUBLISHED' AND "deleted_at" IS NULL;
CREATE INDEX "idx_events_tags_gin"
    ON "events" USING GIN ("tags");

CREATE INDEX "idx_ticket_tiers_organization_event_active"
    ON "ticket_tiers" ("organization_id", "event_id", "is_active");

CREATE INDEX "idx_registrations_organization_event_status"
    ON "registrations" ("organization_id", "event_id", "status");
CREATE INDEX "idx_registrations_event_tier_status"
    ON "registrations" ("organization_id", "event_id", "ticket_tier_id", "status");
CREATE INDEX "idx_registrations_user_created"
    ON "registrations" ("user_id", "created_at");
CREATE INDEX "idx_registrations_checked_in"
    ON "registrations" ("checked_in_at");

CREATE INDEX "idx_reminder_jobs_status_scheduled"
    ON "reminder_jobs" ("status", "scheduled_for");
CREATE INDEX "idx_reminder_jobs_organization"
    ON "reminder_jobs" ("organization_id");

ALTER TABLE "refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_replaced_by_token_id_fkey"
    FOREIGN KEY ("replaced_by_token_id") REFERENCES "refresh_tokens" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organizations"
    ADD CONSTRAINT "organizations_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "memberships"
    ADD CONSTRAINT "memberships_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memberships"
    ADD CONSTRAINT "memberships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invitations"
    ADD CONSTRAINT "invitations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitations"
    ADD CONSTRAINT "invitations_invited_by_id_fkey"
    FOREIGN KEY ("invited_by_id") REFERENCES "users" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invitations"
    ADD CONSTRAINT "invitations_accepted_by_id_fkey"
    FOREIGN KEY ("accepted_by_id") REFERENCES "users" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "events"
    ADD CONSTRAINT "events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events"
    ADD CONSTRAINT "events_organizer_id_fkey"
    FOREIGN KEY ("organizer_id") REFERENCES "users" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_tiers"
    ADD CONSTRAINT "ticket_tiers_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_tiers"
    ADD CONSTRAINT "ticket_tiers_event_tenant_fkey"
    FOREIGN KEY ("event_id", "organization_id")
    REFERENCES "events" ("id", "organization_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "registrations"
    ADD CONSTRAINT "registrations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registrations"
    ADD CONSTRAINT "registrations_event_tenant_fkey"
    FOREIGN KEY ("event_id", "organization_id")
    REFERENCES "events" ("id", "organization_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registrations"
    ADD CONSTRAINT "registrations_ticket_tier_tenant_fkey"
    FOREIGN KEY ("ticket_tier_id", "event_id", "organization_id")
    REFERENCES "ticket_tiers" ("id", "event_id", "organization_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registrations"
    ADD CONSTRAINT "registrations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "registrations"
    ADD CONSTRAINT "registrations_checked_in_by_id_fkey"
    FOREIGN KEY ("checked_in_by_id") REFERENCES "users" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reminder_jobs"
    ADD CONSTRAINT "reminder_jobs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reminder_jobs"
    ADD CONSTRAINT "reminder_jobs_registration_tenant_fkey"
    FOREIGN KEY ("registration_id", "organization_id")
    REFERENCES "registrations" ("id", "organization_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- PostgreSQL-native event discovery. The trigger keeps the weighted document current
-- while the GIN index makes websearch_to_tsquery/plainto_tsquery searches inexpensive.
CREATE OR REPLACE FUNCTION "hostly_events_search_vector_update"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."search_vector" :=
        setweight(to_tsvector('english', COALESCE(NEW."title", '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW."category", '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW."tags", ' '), '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW."description", '')), 'C') ||
        setweight(
            to_tsvector(
                'english',
                concat_ws(
                    ' ',
                    COALESCE(NEW."venue_name", ''),
                    COALESCE(NEW."city", ''),
                    COALESCE(NEW."region", ''),
                    COALESCE(NEW."country", '')
                )
            ),
            'D'
        );
    RETURN NEW;
END;
$$;

CREATE TRIGGER "events_search_vector_trigger"
BEFORE INSERT OR UPDATE OF
    "title", "description", "category", "tags", "venue_name", "city", "region", "country"
ON "events"
FOR EACH ROW
EXECUTE FUNCTION "hostly_events_search_vector_update"();

CREATE INDEX "idx_events_search_vector_gin"
    ON "events" USING GIN ("search_vector");
