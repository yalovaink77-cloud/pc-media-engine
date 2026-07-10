import { randomUUID } from 'node:crypto';

import type {
  AppendContentReviewDecisionInput,
  ContentReviewCheckId,
  ContentReviewerIdentity,
  ContentReviewFinding,
  ContentReviewHistoryEvent,
  ContentReviewRepository,
  ContentReviewRequest,
  ContentReviewResult,
  ContentReviewStatus,
  GeneratedContentArtifact,
  GeneratedContentArtifactRepository,
  GeneratedContentStatus,
  GeneratedContentWarning,
  GenerationPolicySnapshot,
  GenerationUsage,
  ProjectScopedPersistenceContext,
} from '@pcme/shared';
import {
  ContentReviewConcurrencyError,
  ContentReviewNotFoundError,
  ContentReviewTransitionError,
  GeneratedContentArtifactDuplicateError,
  GeneratedContentArtifactNotFoundError,
  GeneratedContentArtifactTransitionError,
  validateReviewDecision,
} from '@pcme/shared';
import type {
  ContentReviewDecisionValue,
  ContentReviewEvent,
  ContentReviewRecord,
  ContentReviewWorkflowStatus,
  GeneratedContentArtifactRecord,
  GeneratedContentArtifactStatus,
  PrismaClient,
} from '@prisma/client';
import { Prisma } from '@prisma/client';

import { getPrismaClient } from '../client.js';
import {
  assertPersistableArtifactContent,
  assertPersistableJsonValue,
  assertPersistableText,
  fromDbContentReviewDecision,
  fromDbContentReviewEventType,
  fromDbContentReviewStatus,
  fromDbGeneratedContentArtifactStatus,
  toDbContentReviewDecision,
  toDbContentReviewStatus,
  toDbGeneratedContentArtifactStatus,
} from '../domain/content-workflow-validation.js';
import { requireOrganizationId, requireProjectId } from './scoped-query.js';

const APPROVABLE_ARTIFACT_STATUSES = new Set<GeneratedContentStatus>([
  'generated',
  'generated-with-warnings',
]);
const REJECTABLE_ARTIFACT_STATUSES = new Set<GeneratedContentStatus>([
  'generated',
  'generated-with-warnings',
  'invalid',
]);

function freezeArtifact(artifact: GeneratedContentArtifact): GeneratedContentArtifact {
  return Object.freeze({
    ...artifact,
    warnings: Object.freeze(artifact.warnings.map((warning) => Object.freeze({ ...warning }))),
    usage: artifact.usage ? Object.freeze({ ...artifact.usage }) : undefined,
    policySnapshot: Object.freeze({
      ...artifact.policySnapshot,
      safetyConstraints: Object.freeze([...artifact.policySnapshot.safetyConstraints]),
      affiliateConstraints: Object.freeze([...artifact.policySnapshot.affiliateConstraints]),
      citationRequirements: Object.freeze([...artifact.policySnapshot.citationRequirements]),
      blockedFields: Object.freeze([...artifact.policySnapshot.blockedFields]),
    }),
  });
}

function mapRecordToArtifact(record: GeneratedContentArtifactRecord): GeneratedContentArtifact {
  return freezeArtifact({
    artifactId: record.artifactId,
    jobId: record.jobId,
    requestId: record.requestId,
    sourceId: record.sourceId,
    snapshotId: record.snapshotId,
    providerId: record.providerId,
    model: record.model ?? undefined,
    contentType: record.contentType,
    locale: record.locale,
    tone: record.tone,
    format: record.format,
    content: record.content,
    usage: (record.usage ?? undefined) as GenerationUsage | undefined,
    finishReason: record.finishReason ?? undefined,
    warnings: (record.warnings as unknown as GeneratedContentWarning[]) ?? [],
    policySnapshot: record.policySnapshot as unknown as GenerationPolicySnapshot,
    status: fromDbGeneratedContentArtifactStatus(record.status),
    createdAt: record.createdAt.toISOString(),
  });
}

function mapEventToHistory(event: ContentReviewEvent): ContentReviewHistoryEvent {
  return Object.freeze({
    eventId: event.eventId,
    reviewId: event.reviewId,
    type: fromDbContentReviewEventType(event.eventType),
    status: fromDbContentReviewStatus(event.nextStatus),
    decision: event.decision ? fromDbContentReviewDecision(event.decision) : undefined,
    reviewer: event.reviewer
      ? Object.freeze(event.reviewer as unknown as ContentReviewerIdentity)
      : undefined,
    notes: event.notes ?? undefined,
    findings: event.findings
      ? Object.freeze(
          (event.findings as unknown as ContentReviewFinding[]).map((finding) =>
            Object.freeze(finding),
          ),
        )
      : undefined,
    timestamp: event.createdAt.toISOString(),
  });
}

function mapReviewRequest(review: ContentReviewRecord): ContentReviewRequest {
  return Object.freeze({
    reviewId: review.reviewId,
    artifactId: review.artifactId,
    jobId: review.jobId,
    contentType: review.contentType,
    locale: review.locale,
    artifactStatus: fromDbGeneratedContentArtifactStatus(review.artifactStatus),
    policySnapshot: review.policySnapshot as unknown as GenerationPolicySnapshot,
    warnings: Object.freeze(
      (review.warnings as unknown as GeneratedContentWarning[]).map((warning) =>
        Object.freeze(warning),
      ),
    ),
    requiredChecks: Object.freeze(
      (review.requiredChecks as unknown as ContentReviewCheckId[]).slice(),
    ),
    status: fromDbContentReviewStatus(review.status),
    createdAt: review.createdAt.toISOString(),
    expiresAt: review.expiresAt.toISOString(),
  });
}

function buildReviewResult(
  review: ContentReviewRecord,
  events: ContentReviewEvent[],
): ContentReviewResult {
  const history = Object.freeze(events.map((event) => mapEventToHistory(event)));
  const latestDecisionEvent = [...events]
    .reverse()
    .find((event) => event.eventType === 'decision_submitted');

  return Object.freeze({
    review: mapReviewRequest(review),
    history,
    latestDecision: latestDecisionEvent?.decision
      ? fromDbContentReviewDecision(latestDecisionEvent.decision)
      : undefined,
    reviewer: latestDecisionEvent?.reviewer
      ? Object.freeze(latestDecisionEvent.reviewer as unknown as ContentReviewerIdentity)
      : undefined,
    findings: Object.freeze(
      latestDecisionEvent?.findings
        ? (latestDecisionEvent.findings as unknown as ContentReviewFinding[]).map((finding) =>
            Object.freeze(finding),
          )
        : [],
    ),
  });
}

function assertArtifactTransition(
  artifactId: string,
  fromStatus: GeneratedContentStatus,
  toStatus: GeneratedContentStatus,
): void {
  if (fromStatus === toStatus) {
    return;
  }

  if (toStatus === 'approved' && APPROVABLE_ARTIFACT_STATUSES.has(fromStatus)) {
    return;
  }

  if (toStatus === 'rejected' && REJECTABLE_ARTIFACT_STATUSES.has(fromStatus)) {
    return;
  }

  throw new GeneratedContentArtifactTransitionError({ artifactId, fromStatus, toStatus });
}

function prepareArtifactPersistenceData(
  context: ProjectScopedPersistenceContext,
  artifact: GeneratedContentArtifact,
): Prisma.GeneratedContentArtifactRecordCreateInput {
  assertPersistableArtifactContent(artifact.content);
  for (const warning of artifact.warnings) {
    assertPersistableText(warning.message, 'artifact.warnings.message');
  }
  if (artifact.usage) {
    assertPersistableJsonValue(artifact.usage, 'usage');
  }

  return {
    organizationId: requireOrganizationId(context.organizationId),
    project: { connect: { id: requireProjectId(context.projectId) } },
    artifactId: artifact.artifactId,
    jobId: artifact.jobId,
    requestId: artifact.requestId,
    sourceId: artifact.sourceId,
    snapshotId: artifact.snapshotId,
    providerId: artifact.providerId,
    model: artifact.model,
    contentType: artifact.contentType,
    locale: artifact.locale,
    tone: artifact.tone,
    format: artifact.format,
    content: artifact.content,
    status: toDbGeneratedContentArtifactStatus(artifact.status) as GeneratedContentArtifactStatus,
    usage: artifact.usage as Prisma.InputJsonValue | undefined,
    finishReason: artifact.finishReason,
    warnings: artifact.warnings as unknown as Prisma.InputJsonValue,
    policySnapshot: artifact.policySnapshot as unknown as Prisma.InputJsonValue,
    createdAt: new Date(artifact.createdAt),
  };
}

export class PrismaGeneratedContentArtifactRepository implements GeneratedContentArtifactRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  async save(
    context: ProjectScopedPersistenceContext,
    artifact: GeneratedContentArtifact,
  ): Promise<GeneratedContentArtifact> {
    try {
      const record = await this.client.generatedContentArtifactRecord.create({
        data: prepareArtifactPersistenceData(context, artifact),
      });
      return mapRecordToArtifact(record);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new GeneratedContentArtifactDuplicateError(artifact.artifactId);
      }
      throw error;
    }
  }

  async getById(
    context: ProjectScopedPersistenceContext,
    artifactId: string,
  ): Promise<GeneratedContentArtifact | undefined> {
    const record = await this.client.generatedContentArtifactRecord.findFirst({
      where: {
        projectId: requireProjectId(context.projectId),
        artifactId,
      },
    });

    return record ? mapRecordToArtifact(record) : undefined;
  }

  async listByJobId(
    context: ProjectScopedPersistenceContext,
    jobId: string,
  ): Promise<readonly GeneratedContentArtifact[]> {
    const records = await this.client.generatedContentArtifactRecord.findMany({
      where: {
        projectId: requireProjectId(context.projectId),
        jobId,
      },
      orderBy: { createdAt: 'asc' },
    });

    return Object.freeze(records.map((record) => mapRecordToArtifact(record)));
  }

  async updateStatus(
    context: ProjectScopedPersistenceContext,
    artifactId: string,
    status: GeneratedContentStatus,
  ): Promise<GeneratedContentArtifact> {
    const existing = await this.client.generatedContentArtifactRecord.findFirst({
      where: {
        projectId: requireProjectId(context.projectId),
        artifactId,
      },
    });

    if (!existing) {
      throw new GeneratedContentArtifactNotFoundError(artifactId);
    }

    const currentStatus = fromDbGeneratedContentArtifactStatus(existing.status);
    assertArtifactTransition(artifactId, currentStatus, status);

    const record = await this.client.generatedContentArtifactRecord.update({
      where: { id: existing.id },
      data: {
        status: toDbGeneratedContentArtifactStatus(status) as GeneratedContentArtifactStatus,
      },
    });

    return mapRecordToArtifact(record);
  }
}

export class PrismaContentReviewRepository implements ContentReviewRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  async create(
    context: ProjectScopedPersistenceContext,
    review: ContentReviewRequest,
  ): Promise<ContentReviewResult> {
    for (const warning of review.warnings) {
      assertPersistableText(warning.message, 'review.warnings.message');
    }

    const projectId = requireProjectId(context.projectId);
    const organizationId = requireOrganizationId(context.organizationId);

    return this.client.$transaction(async (tx) => {
      const createdReview = await tx.contentReviewRecord.create({
        data: {
          organizationId,
          projectId,
          reviewId: review.reviewId,
          artifactId: review.artifactId,
          jobId: review.jobId,
          contentType: review.contentType,
          locale: review.locale,
          status: toDbContentReviewStatus(review.status) as ContentReviewWorkflowStatus,
          artifactStatus: toDbGeneratedContentArtifactStatus(
            review.artifactStatus,
          ) as GeneratedContentArtifactStatus,
          policySnapshot: review.policySnapshot as unknown as Prisma.InputJsonValue,
          warnings: review.warnings as unknown as Prisma.InputJsonValue,
          requiredChecks: review.requiredChecks as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(review.expiresAt),
          createdAt: new Date(review.createdAt),
        },
      });

      const createdEvent = await tx.contentReviewEvent.create({
        data: {
          organizationId,
          projectId,
          eventId: randomUUID(),
          reviewId: review.reviewId,
          eventType: 'created',
          previousStatus: null,
          nextStatus: toDbContentReviewStatus(review.status) as ContentReviewWorkflowStatus,
          createdAt: new Date(review.createdAt),
        },
      });

      return buildReviewResult(createdReview, [createdEvent]);
    });
  }

  async getById(
    context: ProjectScopedPersistenceContext,
    reviewId: string,
  ): Promise<ContentReviewResult | undefined> {
    const review = await this.client.contentReviewRecord.findFirst({
      where: {
        projectId: requireProjectId(context.projectId),
        reviewId,
      },
    });

    if (!review) {
      return undefined;
    }

    const events = await this.client.contentReviewEvent.findMany({
      where: {
        projectId: requireProjectId(context.projectId),
        reviewId,
      },
      orderBy: { createdAt: 'asc' },
    });

    return buildReviewResult(review, events);
  }

  async listByArtifactId(
    context: ProjectScopedPersistenceContext,
    artifactId: string,
  ): Promise<readonly ContentReviewResult[]> {
    const reviews = await this.client.contentReviewRecord.findMany({
      where: {
        projectId: requireProjectId(context.projectId),
        artifactId,
      },
      orderBy: { createdAt: 'asc' },
    });

    const results = await Promise.all(
      reviews.map(async (review) => {
        const events = await this.client.contentReviewEvent.findMany({
          where: {
            projectId: requireProjectId(context.projectId),
            reviewId: review.reviewId,
          },
          orderBy: { createdAt: 'asc' },
        });
        return buildReviewResult(review, events);
      }),
    );

    return Object.freeze(results);
  }

  async appendDecision(
    context: ProjectScopedPersistenceContext,
    input: AppendContentReviewDecisionInput,
  ): Promise<ContentReviewResult> {
    const projectId = requireProjectId(context.projectId);
    const organizationId = requireOrganizationId(context.organizationId);

    return this.client.$transaction(async (tx) => {
      const review = await tx.contentReviewRecord.findFirst({
        where: { projectId, reviewId: input.reviewId },
      });

      if (!review) {
        throw new ContentReviewNotFoundError(input.reviewId);
      }

      const reviewRequest = mapReviewRequest(review);
      const nextStatus = validateReviewDecision({
        review: reviewRequest,
        decision: input.decision,
        reviewer: input.reviewer,
        findings: input.findings,
        nowMs: input.nowMs,
      });
      const previousStatus = fromDbContentReviewStatus(review.status);
      const findings = Object.freeze(
        (input.findings ?? []).map((finding) => Object.freeze(finding)),
      );

      if (input.findings) {
        assertPersistableJsonValue(input.findings, 'findings');
      }
      if (input.notes) {
        assertPersistableJsonValue(input.notes, 'notes');
      }

      const updated = await tx.contentReviewRecord.updateMany({
        where: {
          projectId,
          reviewId: input.reviewId,
          version: input.expectedVersion,
        },
        data: {
          status: toDbContentReviewStatus(nextStatus) as ContentReviewWorkflowStatus,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new ContentReviewConcurrencyError(input.reviewId, input.expectedVersion);
      }

      const createdEvent = await tx.contentReviewEvent.create({
        data: {
          organizationId,
          projectId,
          eventId: randomUUID(),
          reviewId: input.reviewId,
          eventType: 'decision_submitted',
          previousStatus: toDbContentReviewStatus(previousStatus) as ContentReviewWorkflowStatus,
          nextStatus: toDbContentReviewStatus(nextStatus) as ContentReviewWorkflowStatus,
          decision: toDbContentReviewDecision(input.decision) as ContentReviewDecisionValue,
          reviewer: input.reviewer as unknown as Prisma.InputJsonValue,
          notes: input.notes,
          findings: findings as unknown as Prisma.InputJsonValue,
          createdAt: new Date(input.nowMs ?? Date.now()),
        },
      });

      const refreshedReview = await tx.contentReviewRecord.findFirstOrThrow({
        where: { projectId, reviewId: input.reviewId },
      });
      const events = await tx.contentReviewEvent.findMany({
        where: { projectId, reviewId: input.reviewId },
        orderBy: { createdAt: 'asc' },
      });

      if (!events.some((event) => event.id === createdEvent.id)) {
        events.push(createdEvent);
      }

      return buildReviewResult(refreshedReview, events);
    });
  }

  async reopenAfterRevision(
    context: ProjectScopedPersistenceContext,
    reviewId: string,
    options?: { expectedVersion?: number; timestamp?: string },
  ): Promise<ContentReviewResult> {
    const projectId = requireProjectId(context.projectId);
    const organizationId = requireOrganizationId(context.organizationId);

    return this.client.$transaction(async (tx) => {
      const review = await tx.contentReviewRecord.findFirst({
        where: { projectId, reviewId },
      });

      if (!review) {
        throw new ContentReviewNotFoundError(reviewId);
      }

      const currentStatus = fromDbContentReviewStatus(review.status);
      if (currentStatus !== 'changes-requested') {
        throw new ContentReviewTransitionError(reviewId, currentStatus, 'pending-review');
      }

      const expectedVersion = options?.expectedVersion ?? review.version;
      const nextStatus: ContentReviewStatus = 'pending-review';
      const timestamp = options?.timestamp ?? new Date().toISOString();

      const updated = await tx.contentReviewRecord.updateMany({
        where: {
          projectId,
          reviewId,
          version: expectedVersion,
        },
        data: {
          status: toDbContentReviewStatus(nextStatus) as ContentReviewWorkflowStatus,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new ContentReviewConcurrencyError(reviewId, expectedVersion);
      }

      await tx.contentReviewEvent.create({
        data: {
          organizationId,
          projectId,
          eventId: randomUUID(),
          reviewId,
          eventType: 'reopened',
          previousStatus: toDbContentReviewStatus(currentStatus) as ContentReviewWorkflowStatus,
          nextStatus: toDbContentReviewStatus(nextStatus) as ContentReviewWorkflowStatus,
          createdAt: new Date(timestamp),
        },
      });

      const refreshedReview = await tx.contentReviewRecord.findFirstOrThrow({
        where: { projectId, reviewId },
      });
      const events = await tx.contentReviewEvent.findMany({
        where: { projectId, reviewId },
        orderBy: { createdAt: 'asc' },
      });

      return buildReviewResult(refreshedReview, events);
    });
  }

  async listHistory(
    context: ProjectScopedPersistenceContext,
    reviewId: string,
  ): Promise<readonly ContentReviewHistoryEvent[]> {
    const events = await this.client.contentReviewEvent.findMany({
      where: {
        projectId: requireProjectId(context.projectId),
        reviewId,
      },
      orderBy: { createdAt: 'asc' },
    });

    return Object.freeze(events.map((event) => mapEventToHistory(event)));
  }
}
