-- Check-ins are first-class audit records. The legacy registration columns stay
-- in place for API compatibility, while this table becomes the durable audit log.

ALTER TABLE "registrations"
    ADD CONSTRAINT "uq_registrations_id_event_organization"
    UNIQUE ("id", "event_id", "organization_id");

ALTER TABLE "reminder_jobs"
    ADD CONSTRAINT "uq_reminder_jobs_registration_tenant"
    UNIQUE ("registration_id", "organization_id");

CREATE TABLE "check_ins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "checked_in_by_id" UUID,
    "checked_in_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" VARCHAR(24) NOT NULL DEFAULT 'QR',

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_check_ins_registration" UNIQUE ("registration_id"),
    CONSTRAINT "uq_check_ins_registration_tenant"
        UNIQUE ("registration_id", "event_id", "organization_id")
);

CREATE INDEX "idx_check_ins_organization_event_time"
    ON "check_ins" ("organization_id", "event_id", "checked_in_at");
CREATE INDEX "idx_check_ins_checked_in_by"
    ON "check_ins" ("checked_in_by_id");

ALTER TABLE "check_ins"
    ADD CONSTRAINT "check_ins_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "check_ins"
    ADD CONSTRAINT "check_ins_event_tenant_fkey"
    FOREIGN KEY ("event_id", "organization_id")
    REFERENCES "events" ("id", "organization_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "check_ins"
    ADD CONSTRAINT "check_ins_registration_tenant_fkey"
    FOREIGN KEY ("registration_id", "event_id", "organization_id")
    REFERENCES "registrations" ("id", "event_id", "organization_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "check_ins"
    ADD CONSTRAINT "check_ins_checked_in_by_id_fkey"
    FOREIGN KEY ("checked_in_by_id") REFERENCES "users" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "check_ins" (
    "organization_id",
    "event_id",
    "registration_id",
    "checked_in_by_id",
    "checked_in_at",
    "method"
)
SELECT
    "organization_id",
    "event_id",
    "id",
    "checked_in_by_id",
    "checked_in_at",
    'MIGRATED'
FROM "registrations"
WHERE "status" = 'CHECKED_IN'
  AND "checked_in_at" IS NOT NULL
ON CONFLICT ("registration_id") DO NOTHING;
