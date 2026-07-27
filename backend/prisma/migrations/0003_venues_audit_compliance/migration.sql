-- Venue and room allocation, audit history, and basic data portability.
CREATE TYPE "room_availability_type" AS ENUM ('HOURLY', 'PER_EVENT');
CREATE TYPE "audit_action" AS ENUM (
  'EVENT_CREATED',
  'EVENT_UPDATED',
  'EVENT_DELETED',
  'VENUE_CREATED',
  'VENUE_UPDATED',
  'VENUE_DELETED',
  'ROOM_CREATED',
  'ROOM_UPDATED',
  'ROOM_DELETED',
  'MEMBER_ROLE_CHANGED',
  'REGISTRATION_CHECKED_IN'
);
CREATE TYPE "data_deletion_status" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'COMPLETED'
);

CREATE TABLE "venues" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "address" VARCHAR(500) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "description" TEXT,
  "image_url" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "venues_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "venues_capacity_positive" CHECK ("capacity" > 0)
);

CREATE UNIQUE INDEX "uq_venues_id_organization"
  ON "venues"("id", "organization_id");
CREATE INDEX "idx_venues_organization_active"
  ON "venues"("organization_id", "deleted_at", "name");
ALTER TABLE "venues"
  ADD CONSTRAINT "venues_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "rooms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "venue_id" UUID NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "floor" VARCHAR(80),
  "equipment" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "availability_type" "room_availability_type" NOT NULL DEFAULT 'PER_EVENT',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "rooms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rooms_capacity_positive" CHECK ("capacity" > 0)
);

CREATE UNIQUE INDEX "uq_rooms_id_venue_organization"
  ON "rooms"("id", "venue_id", "organization_id");
CREATE INDEX "idx_rooms_venue_active"
  ON "rooms"("organization_id", "venue_id", "deleted_at", "name");
ALTER TABLE "rooms"
  ADD CONSTRAINT "rooms_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rooms"
  ADD CONSTRAINT "rooms_venue_tenant_fkey"
  FOREIGN KEY ("venue_id", "organization_id")
  REFERENCES "venues"("id", "organization_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events" ADD COLUMN "venue_id" UUID;
ALTER TABLE "events" ADD COLUMN "room_id" UUID;
CREATE INDEX "idx_events_room_schedule"
  ON "events"("organization_id", "room_id", "starts_at", "ends_at");
ALTER TABLE "events"
  ADD CONSTRAINT "events_venue_tenant_fkey"
  FOREIGN KEY ("venue_id", "organization_id")
  REFERENCES "venues"("id", "organization_id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "events"
  ADD CONSTRAINT "events_room_tenant_fkey"
  FOREIGN KEY ("room_id", "venue_id", "organization_id")
  REFERENCES "rooms"("id", "venue_id", "organization_id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "events"
  ADD CONSTRAINT "events_venue_room_pair_check"
  CHECK (
    ("venue_id" IS NULL AND "room_id" IS NULL)
    OR ("venue_id" IS NOT NULL AND "room_id" IS NOT NULL)
  );

-- The service locks the selected room and checks overlap before writing. This
-- exclusion constraint is a second barrier for writes outside the application.
CREATE EXTENSION IF NOT EXISTS "btree_gist";
ALTER TABLE "events"
  ADD CONSTRAINT "events_room_time_no_overlap"
  EXCLUDE USING gist (
    "room_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE (
    "room_id" IS NOT NULL
    AND "deleted_at" IS NULL
    AND "status" <> 'CANCELLED'::"event_status"
  );

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "actor_id" UUID,
  "action" "audit_action" NOT NULL,
  "entity_type" VARCHAR(80) NOT NULL,
  "entity_id" UUID,
  "entity_label" VARCHAR(240),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_audit_logs_organization_time"
  ON "audit_logs"("organization_id", "created_at");
CREATE INDEX "idx_audit_logs_organization_action"
  ON "audit_logs"("organization_id", "action", "created_at");
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs"("actor_id");
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "data_deletion_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "requester_id" UUID NOT NULL,
  "requester_email" VARCHAR(320) NOT NULL,
  "status" "data_deletion_status" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "admin_note" TEXT,
  "processed_by_id" UUID,
  "processed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_deletion_requests_organization_status"
  ON "data_deletion_requests"("organization_id", "status", "created_at");
CREATE INDEX "idx_deletion_requests_requester"
  ON "data_deletion_requests"("requester_id", "created_at");
ALTER TABLE "data_deletion_requests"
  ADD CONSTRAINT "data_deletion_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_deletion_requests"
  ADD CONSTRAINT "data_deletion_requests_requester_id_fkey"
  FOREIGN KEY ("requester_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_deletion_requests"
  ADD CONSTRAINT "data_deletion_requests_processed_by_id_fkey"
  FOREIGN KEY ("processed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
