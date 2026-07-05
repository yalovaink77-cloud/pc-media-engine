-- Sprint 22: publishing history for asset pipeline

CREATE TYPE "PublishedContentStatus" AS ENUM (
  'draft',
  'published',
  'failed'
);

CREATE TABLE "published_content" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id"      TEXT NOT NULL,
  "asset_id"        TEXT NOT NULL,
  "publisher"       TEXT NOT NULL,
  "external_id"     TEXT NOT NULL,
  "url"             TEXT NOT NULL,
  "status"          "PublishedContentStatus" NOT NULL,
  "published_at"    TIMESTAMP(3) NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "published_content_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "published_content_asset_id_idx" ON "published_content"("asset_id");
CREATE INDEX "published_content_project_id_idx" ON "published_content"("project_id");
CREATE INDEX "published_content_publisher_idx" ON "published_content"("publisher");
CREATE INDEX "published_content_published_at_idx" ON "published_content"("published_at");
CREATE INDEX "published_content_project_id_asset_id_idx" ON "published_content"("project_id", "asset_id");
CREATE INDEX "published_content_publisher_external_id_idx" ON "published_content"("publisher", "external_id");

ALTER TABLE "published_content"
  ADD CONSTRAINT "published_content_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "published_content"
  ADD CONSTRAINT "published_content_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "assets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
