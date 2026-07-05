-- Sprint 23: add slug to published_content for duplicate detection
ALTER TABLE "published_content" ADD COLUMN "slug" TEXT NOT NULL DEFAULT '';

-- Create composite index for duplicate lookups: (project_id, publisher, slug)
CREATE INDEX "published_content_project_id_publisher_slug_idx"
    ON "published_content"("project_id", "publisher", "slug");
