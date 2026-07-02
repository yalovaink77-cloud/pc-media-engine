-- Sprint 6: Schema Corrections
-- Addresses architecture review findings before the local smoke sprint.
--
-- Changes:
--   1. assets.ingestion_job_id       — FK lineage from Asset → IngestionJob
--   2. processing_artifacts.storage_key — real key set by worker (null until then)
--   3. processing_job_attempts        — retry history per canonical ProcessingJob

-- ============================================================
-- 1. Asset → IngestionJob lineage
-- ============================================================
ALTER TABLE "assets" ADD COLUMN "ingestion_job_id" TEXT;

ALTER TABLE "assets"
  ADD CONSTRAINT "assets_ingestion_job_id_fkey"
  FOREIGN KEY ("ingestion_job_id")
  REFERENCES "ingestion_jobs"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "assets_ingestion_job_id_idx" ON "assets"("ingestion_job_id");

-- ============================================================
-- 2. ProcessingArtifact: add storage_key (real key set by worker)
-- ============================================================
ALTER TABLE "processing_artifacts" ADD COLUMN "storage_key" TEXT;

-- ============================================================
-- 3. ProcessingJobAttempt: retry history table
--    ProcessingJob keeps its @@unique([assetId, processingType]) unchanged.
--    Each retry is a new row here, not a new ProcessingJob.
-- ============================================================
CREATE TABLE "processing_job_attempts" (
  "id"               TEXT         NOT NULL,
  "organization_id"  TEXT         NOT NULL,
  "project_id"       TEXT         NOT NULL,
  "processing_job_id" TEXT        NOT NULL,
  "attempt_number"   INTEGER      NOT NULL,
  "status"           "ProcessingStatus" NOT NULL DEFAULT 'pending',
  "started_at"       TIMESTAMP(3),
  "completed_at"     TIMESTAMP(3),
  "failure_reason"   TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "processing_job_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "processing_job_attempts_processing_job_id_attempt_number_key"
  ON "processing_job_attempts"("processing_job_id", "attempt_number");

CREATE INDEX "processing_job_attempts_processing_job_id_idx"
  ON "processing_job_attempts"("processing_job_id");

CREATE INDEX "processing_job_attempts_project_id_idx"
  ON "processing_job_attempts"("project_id");

ALTER TABLE "processing_job_attempts"
  ADD CONSTRAINT "processing_job_attempts_processing_job_id_fkey"
  FOREIGN KEY ("processing_job_id")
  REFERENCES "processing_jobs"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
