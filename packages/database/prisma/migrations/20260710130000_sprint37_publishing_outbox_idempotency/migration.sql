-- Sprint 37: durable publishing handoff outbox and idempotency

CREATE TYPE "PublishingHandoffOutboxStatus" AS ENUM (
  'pending',
  'scheduled',
  'processing',
  'succeeded',
  'failed',
  'dead_letter',
  'cancelled'
);

CREATE TYPE "PublishingHandoffAttemptStatus" AS ENUM (
  'started',
  'succeeded',
  'failed'
);

CREATE TYPE "PublishingIdempotencyStatus" AS ENUM (
  'reserved',
  'completed',
  'failed',
  'expired'
);

CREATE TABLE "publishing_outbox_records" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "outbox_id" TEXT NOT NULL,
  "handoff_id" TEXT NOT NULL,
  "artifact_id" TEXT NOT NULL,
  "review_id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "snapshot_id" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "package_payload" JSONB NOT NULL,
  "status" "PublishingHandoffOutboxStatus" NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "scheduled_at" TIMESTAMP(3),
  "available_at" TIMESTAMP(3) NOT NULL,
  "locked_at" TIMESTAMP(3),
  "locked_by" TEXT,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "last_error" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "publishing_outbox_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "publishing_attempt_records" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "attempt_id" TEXT NOT NULL,
  "outbox_id" TEXT NOT NULL,
  "attempt_number" INTEGER NOT NULL,
  "provider_id" TEXT NOT NULL,
  "status" "PublishingHandoffAttemptStatus" NOT NULL,
  "error_code" TEXT,
  "retryable" BOOLEAN,
  "diagnostics" JSONB,
  "remote_content_id" TEXT,
  "remote_url" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "publishing_attempt_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "publishing_idempotency_records" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "handoff_id" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "status" "PublishingIdempotencyStatus" NOT NULL,
  "remote_content_id" TEXT,
  "remote_url" TEXT,
  "first_seen_at" TIMESTAMP(3) NOT NULL,
  "last_seen_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "publishing_idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "publishing_outbox_records_project_id_outbox_id_key"
  ON "publishing_outbox_records"("project_id", "outbox_id");
CREATE UNIQUE INDEX "publishing_outbox_records_project_id_handoff_id_key"
  ON "publishing_outbox_records"("project_id", "handoff_id");
CREATE INDEX "publishing_outbox_records_project_id_status_available_at_idx"
  ON "publishing_outbox_records"("project_id", "status", "available_at");
CREATE INDEX "publishing_outbox_records_project_id_scheduled_at_idx"
  ON "publishing_outbox_records"("project_id", "scheduled_at");
CREATE INDEX "publishing_outbox_records_organization_id_idx"
  ON "publishing_outbox_records"("organization_id");

CREATE UNIQUE INDEX "publishing_attempt_records_project_id_attempt_id_key"
  ON "publishing_attempt_records"("project_id", "attempt_id");
CREATE UNIQUE INDEX "publishing_attempt_records_project_id_outbox_id_attempt_number_key"
  ON "publishing_attempt_records"("project_id", "outbox_id", "attempt_number");
CREATE INDEX "publishing_attempt_records_project_id_outbox_id_started_at_idx"
  ON "publishing_attempt_records"("project_id", "outbox_id", "started_at");

CREATE UNIQUE INDEX "publishing_idempotency_records_project_id_idempotency_key_key"
  ON "publishing_idempotency_records"("project_id", "idempotency_key");
CREATE INDEX "publishing_idempotency_records_project_id_target_id_handoff_id_idx"
  ON "publishing_idempotency_records"("project_id", "target_id", "handoff_id");
CREATE INDEX "publishing_idempotency_records_project_id_status_expires_at_idx"
  ON "publishing_idempotency_records"("project_id", "status", "expires_at");

ALTER TABLE "publishing_outbox_records"
  ADD CONSTRAINT "publishing_outbox_records_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "publishing_attempt_records"
  ADD CONSTRAINT "publishing_attempt_records_project_id_outbox_id_fkey"
  FOREIGN KEY ("project_id", "outbox_id")
  REFERENCES "publishing_outbox_records"("project_id", "outbox_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "publishing_idempotency_records"
  ADD CONSTRAINT "publishing_idempotency_records_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
