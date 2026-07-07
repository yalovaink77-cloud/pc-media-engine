-- Sprint 49 — performance indexes for publishing history and dashboard summary queries.
-- Safe additive indexes; no data or schema shape changes.

CREATE INDEX IF NOT EXISTS "published_content_project_id_published_at_idx"
  ON "published_content" ("project_id", "published_at" DESC);

CREATE INDEX IF NOT EXISTS "published_content_status_idx"
  ON "published_content" ("status");
