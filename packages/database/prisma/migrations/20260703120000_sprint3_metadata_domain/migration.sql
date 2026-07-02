-- Sprint 3: metadata domain foundation

-- Replace AssetStatus enum to add pending/failed.
-- PostgreSQL forbids ADD VALUE and using the new value in the same transaction
-- (Prisma migrate deploy runs each migration in one transaction).
ALTER TYPE "AssetStatus" RENAME TO "AssetStatus_old";

CREATE TYPE "AssetStatus" AS ENUM (
  'pending',
  'processing',
  'ready',
  'failed'
);

ALTER TABLE "assets" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "assets" ALTER COLUMN "status" TYPE "AssetStatus" USING (
  "status"::text::"AssetStatus"
);

ALTER TABLE "assets" ALTER COLUMN "status" SET DEFAULT 'pending'::"AssetStatus";

DROP TYPE "AssetStatus_old";

-- Media source provenance
CREATE TYPE "MediaSourceType" AS ENUM (
  'upload',
  'external_url',
  'ai_generated',
  'stock',
  'import',
  'unknown'
);

-- Asset metadata columns
ALTER TABLE "assets" ADD COLUMN "original_filename" TEXT;
ALTER TABLE "assets" ADD COLUMN "checksum_algorithm" TEXT NOT NULL DEFAULT 'sha256';

UPDATE "assets" SET "original_filename" = "filename" WHERE "original_filename" IS NULL;

ALTER TABLE "assets" ALTER COLUMN "original_filename" SET NOT NULL;
ALTER TABLE "assets" DROP COLUMN IF EXISTS "source";

CREATE UNIQUE INDEX "assets_project_id_storage_key_key" ON "assets"("project_id", "storage_key");
CREATE INDEX "assets_project_id_status_idx" ON "assets"("project_id", "status");
CREATE INDEX "assets_project_id_mime_type_idx" ON "assets"("project_id", "mime_type");

-- Media source records (provenance facts, not processing)
CREATE TABLE "media_sources" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "source_type" "MediaSourceType" NOT NULL,
  "source_url" TEXT,
  "source_label" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "media_sources_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_sources_asset_id_idx" ON "media_sources"("asset_id");
CREATE INDEX "media_sources_project_id_idx" ON "media_sources"("project_id");
CREATE INDEX "media_sources_project_id_source_type_idx" ON "media_sources"("project_id", "source_type");

ALTER TABLE "media_sources"
  ADD CONSTRAINT "media_sources_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Extensible metadata key-value records per asset
CREATE TABLE "metadata_records" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "namespace" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "metadata_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "metadata_records_asset_id_namespace_key_key"
  ON "metadata_records"("asset_id", "namespace", "key");
CREATE INDEX "metadata_records_project_id_idx" ON "metadata_records"("project_id");
CREATE INDEX "metadata_records_asset_id_namespace_idx"
  ON "metadata_records"("asset_id", "namespace");

ALTER TABLE "metadata_records"
  ADD CONSTRAINT "metadata_records_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
