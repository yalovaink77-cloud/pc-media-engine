import type { ContentGenerationPlan } from '@pcme/content';
import type {
  ContentReviewerIdentity,
  ContentReviewFinding,
  ContentRevisionRequest,
  EditorialFinding,
  EditorialIntelligenceProfile,
  EditorialIntelligenceReport,
  GeneratedContentArtifact,
  RevisionComparisonSummary,
} from '@pcme/shared';

import type { GeneratedContentArtifactStore } from '../artifact/store.js';
import { InMemoryGeneratedContentArtifactStore } from '../artifact/store.js';
import type { EditorialIntelligenceOrchestrator } from '../editorial-intelligence/orchestrator.js';
import { createEditorialIntelligenceOrchestrator } from '../editorial-intelligence/orchestrator.js';
import { createContentReviewRequest } from '../review/create-request.js';
import { InMemoryContentReviewStore } from '../review/store.js';
import type { SubmitContentReviewDecisionInput } from '../review/types.js';
import {
  assertRevisionCountWithinLimit,
  buildRevisionRequestFromReport,
  compareRevisionReports,
  createRevisionArtifact,
  createRevisionGenerationJob,
  DEFAULT_MAX_REVISION_COUNT,
} from '../revision/index.js';
import { runGenerationJob } from '../run.js';
import type { GenerationProviderAdapter } from '../types.js';
import type { EditorialLoopReviewStore } from './types.js';

export interface PrepareInitialReviewInput {
  readonly artifact: GeneratedContentArtifact;
  readonly profile: EditorialIntelligenceProfile;
  readonly analyzedAt?: string;
  readonly createdAt?: string;
}

export interface PrepareInitialReviewResult {
  readonly artifact: GeneratedContentArtifact;
  readonly report: EditorialIntelligenceReport;
  readonly review: ReturnType<typeof createContentReviewRequest>;
}

export interface RequestRevisionInput {
  readonly reviewId: string;
  readonly priorArtifact: GeneratedContentArtifact;
  readonly report: EditorialIntelligenceReport;
  readonly reviewer: ContentReviewerIdentity;
  readonly sourceSnapshotId: string;
  readonly selectedFindingIds?: readonly string[];
  readonly humanNotes?: string;
  readonly notes?: string;
  readonly createdAt?: string;
}

export interface RequestRevisionResult {
  readonly revisionRequest: ContentRevisionRequest;
  readonly reviewResult: ReturnType<EditorialLoopReviewStore['submitDecision']>;
}

export interface RunRevisionInput {
  readonly plan: ContentGenerationPlan;
  readonly priorArtifact: GeneratedContentArtifact;
  readonly revisionRequest: ContentRevisionRequest;
  readonly provider: GenerationProviderAdapter;
}

export interface RunRevisionResult {
  readonly artifact: GeneratedContentArtifact;
  readonly jobId: string;
}

export interface ReanalyzeRevisionInput {
  readonly artifact: GeneratedContentArtifact;
  readonly profile: EditorialIntelligenceProfile;
  readonly priorReport: EditorialIntelligenceReport;
  readonly analyzedAt?: string;
}

export interface ReanalyzeRevisionResult {
  readonly report: EditorialIntelligenceReport;
  readonly comparison: RevisionComparisonSummary;
}

export interface EditorialLoopService {
  prepareInitialReview(input: PrepareInitialReviewInput): PrepareInitialReviewResult;
  requestRevision(input: RequestRevisionInput): RequestRevisionResult;
  runRevision(input: RunRevisionInput): Promise<RunRevisionResult>;
  reanalyzeRevision(input: ReanalyzeRevisionInput): ReanalyzeRevisionResult;
  reopenReviewAfterRevision(input: {
    readonly reviewId: string;
    readonly activeArtifact: GeneratedContentArtifact;
    readonly report: EditorialIntelligenceReport;
    readonly timestamp?: string;
  }): ReturnType<EditorialLoopReviewStore['completeRevision']>;
  submitHumanDecision(
    input: SubmitContentReviewDecisionInput & {
      readonly editorialFindings?: readonly EditorialFinding[];
    },
    nowMs?: number,
  ): ReturnType<EditorialLoopReviewStore['submitDecision']>;
}

export interface EditorialLoopServiceOptions {
  readonly orchestrator?: EditorialIntelligenceOrchestrator;
  readonly reviewStore?: EditorialLoopReviewStore;
  readonly artifactStore?: GeneratedContentArtifactStore;
  readonly maxRevisionCount?: number;
}

function mapEditorialFindingsToReviewFindings(
  findings: readonly EditorialFinding[],
): readonly ContentReviewFinding[] {
  return Object.freeze(
    findings.map((finding) =>
      Object.freeze({
        id: finding.id,
        checkId: finding.checkId,
        code: finding.code,
        message: finding.reason,
        severity: finding.severity,
        resolved: false,
      }),
    ),
  );
}

/** Create a generic editorial revision loop service. */
export function createEditorialLoopService(
  options: EditorialLoopServiceOptions = {},
): EditorialLoopService {
  const orchestrator = options.orchestrator ?? createEditorialIntelligenceOrchestrator();
  const reviewStore = options.reviewStore ?? new InMemoryContentReviewStore();
  const artifactStore = options.artifactStore ?? new InMemoryGeneratedContentArtifactStore();
  const maxRevisionCount = options.maxRevisionCount ?? DEFAULT_MAX_REVISION_COUNT;

  const service: EditorialLoopService = {
    prepareInitialReview(input: PrepareInitialReviewInput) {
      artifactStore.save(input.artifact);
      const analyzedAt = input.analyzedAt ?? new Date().toISOString();
      const report = orchestrator.analyze({
        artifact: input.artifact,
        profile: input.profile,
        analyzedAt,
      });
      const review = createContentReviewRequest(input.artifact, {
        createdAt: input.createdAt,
        editorialReport: report,
      });
      reviewStore.create(review);

      return Object.freeze({
        artifact: input.artifact,
        report,
        review,
      });
    },

    requestRevision(input: RequestRevisionInput) {
      const revisionRequest = buildRevisionRequestFromReport({
        reviewId: input.reviewId,
        priorArtifact: input.priorArtifact,
        report: input.report,
        reviewer: input.reviewer,
        sourceSnapshotId: input.sourceSnapshotId,
        selectedFindingIds: input.selectedFindingIds,
        humanNotes: input.humanNotes,
        createdAt: input.createdAt,
      });

      const reviewResult = reviewStore.submitDecision({
        reviewId: input.reviewId,
        decision: 'request-changes',
        reviewer: input.reviewer,
        notes: input.notes ?? input.humanNotes,
        findings: mapEditorialFindingsToReviewFindings(input.report.findings),
      });

      return Object.freeze({ revisionRequest, reviewResult });
    },

    async runRevision(input: RunRevisionInput) {
      assertRevisionCountWithinLimit(input.priorArtifact, maxRevisionCount);
      reviewStore.beginRevision({
        reviewId: input.revisionRequest.reviewId,
        revisionRequestId: input.revisionRequest.revisionRequestId,
      });

      const job = createRevisionGenerationJob({
        plan: input.plan,
        priorArtifact: input.priorArtifact,
        revisionRequest: input.revisionRequest,
      });
      const generation = await runGenerationJob(job, input.provider);
      if (generation.status !== 'succeeded' || !generation.response) {
        throw new Error(generation.error?.message ?? 'Revision generation failed');
      }

      const artifact = createRevisionArtifact({
        job,
        priorArtifact: input.priorArtifact,
        revisionRequest: input.revisionRequest,
        providerResponse: generation.response,
      });
      artifactStore.save(artifact);

      return Object.freeze({
        artifact,
        jobId: job.jobId,
      });
    },

    reanalyzeRevision(input: ReanalyzeRevisionInput) {
      const analyzedAt = input.analyzedAt ?? new Date().toISOString();
      const report = orchestrator.analyze({
        artifact: input.artifact,
        profile: input.profile,
        analyzedAt,
      });
      const comparison = compareRevisionReports({
        priorReport: input.priorReport,
        nextReport: report,
      });

      return Object.freeze({ report, comparison });
    },

    reopenReviewAfterRevision(input: {
      readonly reviewId: string;
      readonly activeArtifact: GeneratedContentArtifact;
      readonly report: EditorialIntelligenceReport;
      readonly timestamp?: string;
    }) {
      return reviewStore.completeRevision({
        reviewId: input.reviewId,
        activeArtifactId: input.activeArtifact.artifactId,
        editorialReport: input.report,
        timestamp: input.timestamp,
      });
    },

    submitHumanDecision(
      input: SubmitContentReviewDecisionInput & {
        readonly editorialFindings?: readonly EditorialFinding[];
      },
      nowMs?: number,
    ) {
      const findings =
        input.findings ??
        (input.editorialFindings
          ? mapEditorialFindingsToReviewFindings(input.editorialFindings)
          : undefined);

      if (
        (input.decision === 'approve' || input.decision === 'approve-with-notes') &&
        findings?.some((finding) => finding.severity === 'high' && finding.resolved !== true)
      ) {
        throw new Error('High-severity unresolved findings block approval');
      }

      return reviewStore.submitDecision(
        Object.freeze({
          reviewId: input.reviewId,
          decision: input.decision,
          reviewer: input.reviewer,
          notes: input.notes,
          findings,
        }),
        nowMs,
      );
    },
  };

  return Object.freeze(service);
}

export type { EditorialLoopReviewStore } from './types.js';
