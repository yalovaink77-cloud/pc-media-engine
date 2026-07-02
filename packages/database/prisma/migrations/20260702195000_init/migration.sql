-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ContentState" AS ENUM ('idea', 'researching', 'drafted', 'reviewing', 'approved', 'published', 'refresh_needed', 'archived');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('guide', 'faq', 'aftercare_card', 'printable', 'affiliate_section', 'bmc_block', 'social_post', 'newsletter', 'video_script');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('processing', 'ready');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "OutboxAction" AS ENUM ('create', 'update');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "state" "ContentState" NOT NULL DEFAULT 'idea',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_versions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "block_schema_version" INTEGER NOT NULL DEFAULT 1,
    "body" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "focus_keyword" TEXT,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "slug" TEXT,
    "schema" JSONB,
    "content_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_provider" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "alt_text" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "usage_rights" TEXT,
    "source" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'processing',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing_outbox_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "content_version_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "action" "OutboxAction" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "last_attempt_at" TIMESTAMP(3),
    "next_retry_at" TIMESTAMP(3),
    "provider_response" JSONB,
    "error_log" TEXT,
    "external_id" TEXT,
    "published_url" TEXT,
    "created_by" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publishing_outbox_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "content_version_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publish_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "content_item_id" TEXT,
    "task" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AiJobStatus" NOT NULL DEFAULT 'pending',
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "duration_ms" INTEGER,
    "error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "actor" JSONB NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "content_item_id" TEXT,
    "published_url" TEXT,
    "metrics" JSONB,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organization_id_slug_key" ON "projects"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "content_items_project_id_idx" ON "content_items"("project_id");

-- CreateIndex
CREATE INDEX "content_items_organization_id_idx" ON "content_items"("organization_id");

-- CreateIndex
CREATE INDEX "content_items_project_id_state_idx" ON "content_items"("project_id", "state");

-- CreateIndex
CREATE INDEX "content_items_project_id_deleted_at_idx" ON "content_items"("project_id", "deleted_at");

-- CreateIndex
CREATE INDEX "content_versions_content_item_id_idx" ON "content_versions"("content_item_id");

-- CreateIndex
CREATE INDEX "content_versions_project_id_idx" ON "content_versions"("project_id");

-- CreateIndex
CREATE INDEX "seo_profiles_content_item_id_idx" ON "seo_profiles"("content_item_id");

-- CreateIndex
CREATE INDEX "seo_profiles_project_id_idx" ON "seo_profiles"("project_id");

-- CreateIndex
CREATE INDEX "assets_project_id_idx" ON "assets"("project_id");

-- CreateIndex
CREATE INDEX "assets_organization_id_idx" ON "assets"("organization_id");

-- CreateIndex
CREATE INDEX "assets_project_id_deleted_at_idx" ON "assets"("project_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "publishing_outbox_entries_idempotency_key_key" ON "publishing_outbox_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "publishing_outbox_entries_project_id_status_idx" ON "publishing_outbox_entries"("project_id", "status");

-- CreateIndex
CREATE INDEX "publishing_outbox_entries_content_item_id_idx" ON "publishing_outbox_entries"("content_item_id");

-- CreateIndex
CREATE INDEX "publish_records_project_id_idx" ON "publish_records"("project_id");

-- CreateIndex
CREATE INDEX "publish_records_content_item_id_idx" ON "publish_records"("content_item_id");

-- CreateIndex
CREATE INDEX "publish_records_project_id_channel_idx" ON "publish_records"("project_id", "channel");

-- CreateIndex
CREATE INDEX "ai_jobs_project_id_idx" ON "ai_jobs"("project_id");

-- CreateIndex
CREATE INDEX "ai_jobs_project_id_created_at_idx" ON "ai_jobs"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_entries_project_id_created_at_idx" ON "audit_log_entries"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_entries_entity_type_entity_id_idx" ON "audit_log_entries"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "analytics_snapshots_project_id_captured_at_idx" ON "analytics_snapshots"("project_id", "captured_at");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_profiles" ADD CONSTRAINT "seo_profiles_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_outbox_entries" ADD CONSTRAINT "publishing_outbox_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_outbox_entries" ADD CONSTRAINT "publishing_outbox_entries_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_outbox_entries" ADD CONSTRAINT "publishing_outbox_entries_content_version_id_fkey" FOREIGN KEY ("content_version_id") REFERENCES "content_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_records" ADD CONSTRAINT "publish_records_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_records" ADD CONSTRAINT "publish_records_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_records" ADD CONSTRAINT "publish_records_content_version_id_fkey" FOREIGN KEY ("content_version_id") REFERENCES "content_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

