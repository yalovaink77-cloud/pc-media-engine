-- Sprint 36: durable generated content artifact and human review persistence

CREATE TYPE "GeneratedContentArtifactStatus" AS ENUM (
  'generated',
  'generated_with_warnings',
  'invalid',
  'rejected',
  'approved'
);

CREATE TYPE "ContentReviewWorkflowStatus" AS ENUM (
  'pending_review',
  'approved',
  'approved_with_notes',
  'changes_requested',
  'rejected',
  'expired'
);

CREATE TYPE "ContentReviewEventType" AS ENUM (
  'created',
  'decision_submitted',
  'reopened'
);

CREATE TYPE "ContentReviewDecisionValue" AS ENUM (
  'approve',
  'approve_with_notes',
  'request_changes',
  'reject'
);

CREATE TABLE "generated_content_artifacts" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "artifact_id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "snapshot_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "model" TEXT,
  "content_type" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "tone" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" "GeneratedContentArtifactStatus" NOT NULL,
  "usage" JSONB,
  "finish_reason" TEXT,
  "warnings" JSONB NOT NULL DEFAULT '[]',
  "policy_snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "generated_content_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_reviews" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "review_id" TEXT NOT NULL,
  "artifact_id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "status" "ContentReviewWorkflowStatus" NOT NULL,
  "artifact_status" "GeneratedContentArtifactStatus" NOT NULL,
  "policy_snapshot" JSONB NOT NULL,
  "warnings" JSONB NOT NULL DEFAULT '[]',
  "required_checks" JSONB NOT NULL DEFAULT '[]',
  "version" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "content_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_review_events" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "review_id" TEXT NOT NULL,
  "event_type" "ContentReviewEventType" NOT NULL,
  "previous_status" "ContentReviewWorkflowStatus",
  "next_status" "ContentReviewWorkflowStatus" NOT NULL,
  "decision" "ContentReviewDecisionValue",
  "reviewer" JSONB,
  "notes" TEXT,
  "findings" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "content_review_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "generated_content_artifacts_project_id_artifact_id_key"
  ON "generated_content_artifacts"("project_id", "artifact_id");
CREATE INDEX "generated_content_artifacts_project_id_idx"
  ON "generated_content_artifacts"("project_id");
CREATE INDEX "generated_content_artifacts_organization_id_idx"
  ON "generated_content_artifacts"("organization_id");
CREATE INDEX "generated_content_artifacts_project_id_job_id_idx"
  ON "generated_content_artifacts"("project_id", "job_id");

CREATE UNIQUE INDEX "content_reviews_project_id_review_id_key"
  ON "content_reviews"("project_id", "review_id");
CREATE INDEX "content_reviews_project_id_idx"
  ON "content_reviews"("project_id");
CREATE INDEX "content_reviews_organization_id_idx"
  ON "content_reviews"("organization_id");
CREATE INDEX "content_reviews_project_id_artifact_id_idx"
  ON "content_reviews"("project_id", "artifact_id");

CREATE UNIQUE INDEX "content_review_events_project_id_event_id_key"
  ON "content_review_events"("project_id", "event_id");
CREATE INDEX "content_review_events_project_id_review_id_created_at_idx"
  ON "content_review_events"("project_id", "review_id", "created_at");

ALTER TABLE "generated_content_artifacts"
  ADD CONSTRAINT "generated_content_artifacts_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_reviews"
  ADD CONSTRAINT "content_reviews_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_reviews"
  ADD CONSTRAINT "content_reviews_project_id_artifact_id_fkey"
  FOREIGN KEY ("project_id", "artifact_id")
  REFERENCES "generated_content_artifacts"("project_id", "artifact_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "content_review_events"
  ADD CONSTRAINT "content_review_events_project_id_review_id_fkey"
  FOREIGN KEY ("project_id", "review_id")
  REFERENCES "content_reviews"("project_id", "review_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
