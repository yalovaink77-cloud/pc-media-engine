-- Sprint 4: ingestion domain foundation

CREATE TYPE "IngestionSourceType" AS ENUM (
  'local_folder',
  'http_url',
  'youtube',
  'rss',
  's3_placeholder',
  'manual'
);

CREATE TYPE "IngestionStatus" AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'canceled'
);

CREATE TABLE "ingestion_sources" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "source_type" "IngestionSourceType" NOT NULL,
  "source_uri" TEXT NOT NULL,
  "source_label" TEXT,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB NOT NULL DEFAULT '{}',
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ingestion_sources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ingestion_sources_project_id_source_type_source_uri_key"
  ON "ingestion_sources"("project_id", "source_type", "source_uri");
CREATE INDEX "ingestion_sources_project_id_idx" ON "ingestion_sources"("project_id");
CREATE INDEX "ingestion_sources_organization_id_idx" ON "ingestion_sources"("organization_id");
CREATE INDEX "ingestion_sources_project_id_deleted_at_idx"
  ON "ingestion_sources"("project_id", "deleted_at");
CREATE INDEX "ingestion_sources_project_id_source_type_idx"
  ON "ingestion_sources"("project_id", "source_type");

ALTER TABLE "ingestion_sources"
  ADD CONSTRAINT "ingestion_sources_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ingestion_jobs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "ingestion_source_id" TEXT,
  "status" "IngestionStatus" NOT NULL DEFAULT 'pending',
  "source_type" "IngestionSourceType" NOT NULL,
  "source_uri" TEXT NOT NULL,
  "source_identifier" TEXT,
  "discovered_asset_count" INTEGER NOT NULL DEFAULT 0,
  "imported_asset_count" INTEGER NOT NULL DEFAULT 0,
  "failure_reason" TEXT,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ingestion_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ingestion_jobs_project_id_idx" ON "ingestion_jobs"("project_id");
CREATE INDEX "ingestion_jobs_organization_id_idx" ON "ingestion_jobs"("organization_id");
CREATE INDEX "ingestion_jobs_project_id_status_idx" ON "ingestion_jobs"("project_id", "status");
CREATE INDEX "ingestion_jobs_ingestion_source_id_idx" ON "ingestion_jobs"("ingestion_source_id");
CREATE INDEX "ingestion_jobs_project_id_created_at_idx" ON "ingestion_jobs"("project_id", "created_at");

ALTER TABLE "ingestion_jobs"
  ADD CONSTRAINT "ingestion_jobs_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ingestion_jobs"
  ADD CONSTRAINT "ingestion_jobs_ingestion_source_id_fkey"
  FOREIGN KEY ("ingestion_source_id") REFERENCES "ingestion_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
