-- Sprint 5: processing intent and artifact domain
--
-- All enums are brand-new CREATE TYPE statements.
-- No ADD VALUE on existing enums — PostgreSQL-safe within a single transaction.

CREATE TYPE "ProcessingType" AS ENUM (
  'metadata_extract',
  'thumbnail',
  'waveform',
  'transcript',
  'preview',
  'ai_analysis'
);

CREATE TYPE "ProcessingStatus" AS ENUM (
  'pending',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE "ArtifactType" AS ENUM (
  'thumbnail',
  'transcript',
  'waveform',
  'preview',
  'metadata'
);

-- ProcessingJob: tracks intent to process an asset
CREATE TABLE "processing_jobs" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id"      TEXT NOT NULL,
  "asset_id"        TEXT NOT NULL,
  "processing_type" "ProcessingType" NOT NULL,
  "status"          "ProcessingStatus" NOT NULL DEFAULT 'pending',
  "priority"        INTEGER NOT NULL DEFAULT 0,
  "retry_count"     INTEGER NOT NULL DEFAULT 0,
  "requested_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at"      TIMESTAMP(3),
  "completed_at"    TIMESTAMP(3),
  "failure_reason"  TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "processing_jobs_asset_id_processing_type_key"
  ON "processing_jobs"("asset_id", "processing_type");

CREATE INDEX "processing_jobs_project_id_idx"       ON "processing_jobs"("project_id");
CREATE INDEX "processing_jobs_organization_id_idx"  ON "processing_jobs"("organization_id");
CREATE INDEX "processing_jobs_asset_id_idx"         ON "processing_jobs"("asset_id");
CREATE INDEX "processing_jobs_project_id_status_idx"
  ON "processing_jobs"("project_id", "status");
CREATE INDEX "processing_jobs_project_id_type_idx"
  ON "processing_jobs"("project_id", "processing_type");
CREATE INDEX "processing_jobs_status_priority_idx"
  ON "processing_jobs"("status", "priority");

ALTER TABLE "processing_jobs"
  ADD CONSTRAINT "processing_jobs_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "processing_jobs"
  ADD CONSTRAINT "processing_jobs_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "assets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ProcessingArtifact: declared output of a processing job
CREATE TABLE "processing_artifacts" (
  "id"                     TEXT NOT NULL,
  "organization_id"        TEXT NOT NULL,
  "project_id"             TEXT NOT NULL,
  "processing_job_id"      TEXT NOT NULL,
  "asset_id"               TEXT NOT NULL,
  "artifact_type"          "ArtifactType" NOT NULL,
  "mime_type"              TEXT NOT NULL,
  "storage_key_placeholder" TEXT NOT NULL,
  "checksum"               TEXT,
  "size_bytes"             INTEGER,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "processing_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "processing_artifacts_job_id_artifact_type_key"
  ON "processing_artifacts"("processing_job_id", "artifact_type");

CREATE INDEX "processing_artifacts_processing_job_id_idx" ON "processing_artifacts"("processing_job_id");
CREATE INDEX "processing_artifacts_asset_id_idx"          ON "processing_artifacts"("asset_id");
CREATE INDEX "processing_artifacts_project_id_idx"        ON "processing_artifacts"("project_id");

ALTER TABLE "processing_artifacts"
  ADD CONSTRAINT "processing_artifacts_processing_job_id_fkey"
  FOREIGN KEY ("processing_job_id") REFERENCES "processing_jobs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
