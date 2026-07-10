import type {
  ContentReviewDecision,
  ContentReviewerIdentity,
  ContentReviewFinding,
  ContentReviewHistoryEvent,
  ContentReviewRequest,
  ContentReviewResult,
  GeneratedContentArtifact,
  GeneratedContentStatus,
} from './index.js';

/** Project scope required for durable content workflow persistence. */
export interface ProjectScopedPersistenceContext {
  readonly organizationId: string;
  readonly projectId: string;
}

/** Input for appending a review decision with optimistic concurrency control. */
export interface AppendContentReviewDecisionInput {
  readonly reviewId: string;
  readonly decision: ContentReviewDecision;
  readonly reviewer: ContentReviewerIdentity;
  readonly notes?: string;
  readonly findings?: readonly ContentReviewFinding[];
  readonly expectedVersion: number;
  readonly nowMs?: number;
}

/** Generic persistence contract for generated content artifacts. */
export interface GeneratedContentArtifactRepository {
  save(
    context: ProjectScopedPersistenceContext,
    artifact: GeneratedContentArtifact,
  ): Promise<GeneratedContentArtifact>;
  getById(
    context: ProjectScopedPersistenceContext,
    artifactId: string,
  ): Promise<GeneratedContentArtifact | undefined>;
  listByJobId(
    context: ProjectScopedPersistenceContext,
    jobId: string,
  ): Promise<readonly GeneratedContentArtifact[]>;
  updateStatus(
    context: ProjectScopedPersistenceContext,
    artifactId: string,
    status: GeneratedContentStatus,
  ): Promise<GeneratedContentArtifact>;
}

/** Generic persistence contract for human content reviews and append-only history. */
export interface ContentReviewRepository {
  create(
    context: ProjectScopedPersistenceContext,
    review: ContentReviewRequest,
  ): Promise<ContentReviewResult>;
  getById(
    context: ProjectScopedPersistenceContext,
    reviewId: string,
  ): Promise<ContentReviewResult | undefined>;
  listByArtifactId(
    context: ProjectScopedPersistenceContext,
    artifactId: string,
  ): Promise<readonly ContentReviewResult[]>;
  appendDecision(
    context: ProjectScopedPersistenceContext,
    input: AppendContentReviewDecisionInput,
  ): Promise<ContentReviewResult>;
  reopenAfterRevision(
    context: ProjectScopedPersistenceContext,
    reviewId: string,
    options?: { expectedVersion?: number; timestamp?: string },
  ): Promise<ContentReviewResult>;
  listHistory(
    context: ProjectScopedPersistenceContext,
    reviewId: string,
  ): Promise<readonly ContentReviewHistoryEvent[]>;
}
