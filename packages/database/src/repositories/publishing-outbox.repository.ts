import { createHash, randomUUID } from 'node:crypto';

import type {
  AppendPublishingAttemptInput,
  ClaimNextPublishingOutboxInput,
  EnqueuePublishingOutboxInput,
  MarkPublishingOutboxFailedInput,
  MarkPublishingOutboxSucceededInput,
  ProjectScopedPersistenceContext,
  PublishingAttemptDiagnostics,
  PublishingAttemptRecord,
  PublishingHandoffPackagePayload,
  PublishingOutboxRecord,
  PublishingOutboxRepository,
  PublishingOutboxStatus,
} from '@pcme/shared';
import {
  computePublishingRetryAvailableAt,
  PublishingOutboxConcurrencyError,
  PublishingOutboxDuplicateError,
  PublishingOutboxNotFoundError,
  PublishingOutboxTerminalStateError,
} from '@pcme/shared';
import type {
  PrismaClient,
  PublishingHandoffAttemptRecord,
  PublishingHandoffAttemptStatus,
  PublishingHandoffOutboxRecord,
  PublishingHandoffOutboxStatus,
} from '@prisma/client';
import { Prisma } from '@prisma/client';

import { getPrismaClient } from '../client.js';
import {
  assertPersistableHandoffPackagePayload,
  fromDbPublishingAttemptStatus,
  fromDbPublishingOutboxStatus,
  isTerminalPublishingOutboxStatus,
  sanitizePublishingAttemptDiagnostics,
  sanitizePublishingErrorMessage,
  toDbPublishingAttemptStatus,
  toDbPublishingOutboxStatus,
} from '../domain/publishing-outbox-validation.js';
import { requireOrganizationId, requireProjectId } from './scoped-query.js';

const CLAIMABLE_STATUSES: PublishingHandoffOutboxStatus[] = ['pending', 'scheduled', 'failed'];

export function buildDeterministicOutboxId(handoffId: string): string {
  return createHash('sha256').update(JSON.stringify({ handoffId })).digest('hex').slice(0, 32);
}

function mapAttempt(record: PublishingHandoffAttemptRecord): PublishingAttemptRecord {
  return Object.freeze({
    attemptId: record.attemptId,
    outboxId: record.outboxId,
    attemptNumber: record.attemptNumber,
    providerId: record.providerId,
    startedAt: record.startedAt.toISOString(),
    completedAt: record.completedAt?.toISOString(),
    status: fromDbPublishingAttemptStatus(record.status),
    errorCode: record.errorCode ?? undefined,
    retryable: record.retryable ?? undefined,
    diagnostics: record.diagnostics
      ? (record.diagnostics as unknown as PublishingAttemptDiagnostics)
      : undefined,
    remoteContentId: record.remoteContentId ?? undefined,
    remoteUrl: record.remoteUrl ?? undefined,
  });
}

function mapOutbox(record: PublishingHandoffOutboxRecord): PublishingOutboxRecord {
  return Object.freeze({
    outboxId: record.outboxId,
    handoffId: record.handoffId,
    artifactId: record.artifactId,
    reviewId: record.reviewId,
    jobId: record.jobId,
    requestId: record.requestId,
    sourceId: record.sourceId,
    snapshotId: record.snapshotId,
    targetId: record.targetId,
    contentType: record.contentType,
    locale: record.locale,
    format: record.format,
    packagePayload: record.packagePayload as unknown as PublishingHandoffPackagePayload,
    status: fromDbPublishingOutboxStatus(record.status),
    priority: record.priority,
    scheduledAt: record.scheduledAt?.toISOString(),
    availableAt: record.availableAt.toISOString(),
    lockedAt: record.lockedAt?.toISOString(),
    lockedBy: record.lockedBy ?? undefined,
    attemptCount: record.attemptCount,
    maxAttempts: record.maxAttempts,
    lastError: record.lastError ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    completedAt: record.completedAt?.toISOString(),
    version: record.version,
  });
}

async function requireOutbox(
  client: Pick<PrismaClient, 'publishingHandoffOutboxRecord'>,
  projectId: string,
  outboxId: string,
): Promise<PublishingHandoffOutboxRecord> {
  const record = await client.publishingHandoffOutboxRecord.findFirst({
    where: { projectId, outboxId },
  });
  if (!record) {
    throw new PublishingOutboxNotFoundError(outboxId);
  }
  return record;
}

export class PrismaPublishingOutboxRepository implements PublishingOutboxRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  async enqueue(
    context: ProjectScopedPersistenceContext,
    input: EnqueuePublishingOutboxInput,
  ): Promise<PublishingOutboxRecord> {
    assertPersistableHandoffPackagePayload(input.package);

    const projectId = requireProjectId(context.projectId);
    const organizationId = requireOrganizationId(context.organizationId);
    const outboxId = buildDeterministicOutboxId(input.package.handoffId);
    const now = new Date();
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
    const availableAt = input.availableAt ? new Date(input.availableAt) : (scheduledAt ?? now);
    const status: PublishingOutboxStatus =
      scheduledAt && scheduledAt.getTime() > now.getTime() ? 'scheduled' : 'pending';

    try {
      const record = await this.client.publishingHandoffOutboxRecord.create({
        data: {
          organizationId,
          projectId,
          outboxId,
          handoffId: input.package.handoffId,
          artifactId: input.package.artifactId,
          reviewId: input.package.reviewId,
          jobId: input.package.jobId,
          requestId: input.package.requestId,
          sourceId: input.package.sourceId,
          snapshotId: input.package.snapshotId,
          targetId: input.package.target.targetId,
          contentType: input.package.contentType,
          locale: input.package.locale,
          format: input.package.format,
          packagePayload: input.package as unknown as Prisma.InputJsonValue,
          status: toDbPublishingOutboxStatus(status),
          priority: input.priority ?? 0,
          scheduledAt,
          availableAt,
          maxAttempts: input.maxAttempts ?? 5,
        },
      });

      return mapOutbox(record);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new PublishingOutboxDuplicateError(input.package.handoffId);
      }
      throw error;
    }
  }

  async getById(
    context: ProjectScopedPersistenceContext,
    outboxId: string,
  ): Promise<PublishingOutboxRecord | undefined> {
    const record = await this.client.publishingHandoffOutboxRecord.findFirst({
      where: {
        projectId: requireProjectId(context.projectId),
        outboxId,
      },
    });
    return record ? mapOutbox(record) : undefined;
  }

  async getByHandoffId(
    context: ProjectScopedPersistenceContext,
    handoffId: string,
  ): Promise<PublishingOutboxRecord | undefined> {
    const record = await this.client.publishingHandoffOutboxRecord.findFirst({
      where: {
        projectId: requireProjectId(context.projectId),
        handoffId,
      },
    });
    return record ? mapOutbox(record) : undefined;
  }

  async claimNext(
    context: ProjectScopedPersistenceContext,
    input: ClaimNextPublishingOutboxInput,
  ): Promise<PublishingOutboxRecord | undefined> {
    const projectId = requireProjectId(context.projectId);
    const now = input.now ?? new Date();

    return this.client.$transaction(async (tx) => {
      const candidate = await tx.publishingHandoffOutboxRecord.findFirst({
        where: {
          projectId,
          status: { in: CLAIMABLE_STATUSES },
          availableAt: { lte: now },
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
          lockedAt: null,
        },
        orderBy: [{ priority: 'desc' }, { availableAt: 'asc' }],
      });

      if (!candidate) {
        return undefined;
      }

      const updated = await tx.publishingHandoffOutboxRecord.updateMany({
        where: {
          id: candidate.id,
          version: candidate.version,
          status: candidate.status,
          lockedAt: null,
        },
        data: {
          status: 'processing',
          lockedAt: now,
          lockedBy: input.workerId,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        return undefined;
      }

      const record = await tx.publishingHandoffOutboxRecord.findFirstOrThrow({
        where: { id: candidate.id },
      });
      return mapOutbox(record);
    });
  }

  async markSucceeded(
    context: ProjectScopedPersistenceContext,
    input: MarkPublishingOutboxSucceededInput,
  ): Promise<PublishingOutboxRecord> {
    const projectId = requireProjectId(context.projectId);
    const organizationId = requireOrganizationId(context.organizationId);
    const now = input.now ?? new Date();

    return this.client.$transaction(async (tx) => {
      const existing = await requireOutbox(tx, projectId, input.outboxId);
      if (isTerminalPublishingOutboxStatus(existing.status)) {
        throw new PublishingOutboxTerminalStateError(input.outboxId, existing.status);
      }

      const updated = await tx.publishingHandoffOutboxRecord.updateMany({
        where: {
          projectId,
          outboxId: input.outboxId,
          version: input.expectedVersion,
        },
        data: {
          status: 'succeeded',
          lockedAt: null,
          lockedBy: null,
          completedAt: now,
          lastError: null,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new PublishingOutboxConcurrencyError(input.outboxId, input.expectedVersion);
      }

      await tx.publishingHandoffAttemptRecord.create({
        data: {
          organizationId,
          projectId,
          attemptId: randomUUID(),
          outboxId: input.outboxId,
          attemptNumber: input.attempt.attemptNumber,
          providerId: input.attempt.providerId,
          status: toDbPublishingAttemptStatus(input.attempt.status),
          errorCode: input.attempt.errorCode,
          retryable: input.attempt.retryable,
          diagnostics: sanitizePublishingAttemptDiagnostics(input.attempt.diagnostics) as
            Prisma.InputJsonValue | undefined,
          remoteContentId: input.attempt.remoteContentId,
          remoteUrl: input.attempt.remoteUrl,
          startedAt: new Date(input.attempt.startedAt),
          completedAt: input.attempt.completedAt ? new Date(input.attempt.completedAt) : now,
        },
      });

      const record = await tx.publishingHandoffOutboxRecord.findFirstOrThrow({
        where: { projectId, outboxId: input.outboxId },
      });
      return mapOutbox(record);
    });
  }

  async markFailed(
    context: ProjectScopedPersistenceContext,
    input: MarkPublishingOutboxFailedInput,
  ): Promise<PublishingOutboxRecord> {
    const projectId = requireProjectId(context.projectId);
    const organizationId = requireOrganizationId(context.organizationId);
    const now = input.now ?? new Date();

    return this.client.$transaction(async (tx) => {
      const existing = await requireOutbox(tx, projectId, input.outboxId);
      if (isTerminalPublishingOutboxStatus(existing.status)) {
        throw new PublishingOutboxTerminalStateError(input.outboxId, existing.status);
      }

      const nextAttemptCount = existing.attemptCount + 1;
      const shouldRetry = input.retryable && nextAttemptCount < existing.maxAttempts;
      const nextAvailableAt = shouldRetry
        ? computePublishingRetryAvailableAt({ attemptCount: nextAttemptCount, now })
        : now;

      const updated = await tx.publishingHandoffOutboxRecord.updateMany({
        where: {
          projectId,
          outboxId: input.outboxId,
          version: input.expectedVersion,
        },
        data: {
          status: shouldRetry ? 'failed' : 'dead_letter',
          attemptCount: nextAttemptCount,
          availableAt: nextAvailableAt,
          lockedAt: null,
          lockedBy: null,
          lastError: sanitizePublishingErrorMessage(input.message),
          completedAt: shouldRetry ? null : now,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new PublishingOutboxConcurrencyError(input.outboxId, input.expectedVersion);
      }

      await tx.publishingHandoffAttemptRecord.create({
        data: {
          organizationId,
          projectId,
          attemptId: randomUUID(),
          outboxId: input.outboxId,
          attemptNumber: input.attempt.attemptNumber,
          providerId: input.attempt.providerId,
          status: toDbPublishingAttemptStatus(input.attempt.status),
          errorCode: input.errorCode,
          retryable: input.retryable,
          diagnostics: sanitizePublishingAttemptDiagnostics(input.attempt.diagnostics) as
            Prisma.InputJsonValue | undefined,
          remoteContentId: input.attempt.remoteContentId,
          remoteUrl: input.attempt.remoteUrl,
          startedAt: new Date(input.attempt.startedAt),
          completedAt: input.attempt.completedAt ? new Date(input.attempt.completedAt) : now,
        },
      });

      const record = await tx.publishingHandoffOutboxRecord.findFirstOrThrow({
        where: { projectId, outboxId: input.outboxId },
      });
      return mapOutbox(record);
    });
  }

  async moveToDeadLetter(
    context: ProjectScopedPersistenceContext,
    input: {
      outboxId: string;
      expectedVersion: number;
      message: string;
      attempt: AppendPublishingAttemptInput['attempt'];
      now?: Date;
    },
  ): Promise<PublishingOutboxRecord> {
    const projectId = requireProjectId(context.projectId);
    const organizationId = requireOrganizationId(context.organizationId);
    const now = input.now ?? new Date();

    return this.client.$transaction(async (tx) => {
      const updated = await tx.publishingHandoffOutboxRecord.updateMany({
        where: {
          projectId,
          outboxId: input.outboxId,
          version: input.expectedVersion,
        },
        data: {
          status: 'dead_letter',
          lockedAt: null,
          lockedBy: null,
          completedAt: now,
          lastError: sanitizePublishingErrorMessage(input.message),
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new PublishingOutboxConcurrencyError(input.outboxId, input.expectedVersion);
      }

      await tx.publishingHandoffAttemptRecord.create({
        data: {
          organizationId,
          projectId,
          attemptId: randomUUID(),
          outboxId: input.outboxId,
          attemptNumber: input.attempt.attemptNumber,
          providerId: input.attempt.providerId,
          status: toDbPublishingAttemptStatus(input.attempt.status),
          errorCode: input.attempt.errorCode,
          retryable: input.attempt.retryable,
          diagnostics: sanitizePublishingAttemptDiagnostics(input.attempt.diagnostics) as
            Prisma.InputJsonValue | undefined,
          startedAt: new Date(input.attempt.startedAt),
          completedAt: input.attempt.completedAt ? new Date(input.attempt.completedAt) : now,
        },
      });

      const record = await tx.publishingHandoffOutboxRecord.findFirstOrThrow({
        where: { projectId, outboxId: input.outboxId },
      });
      return mapOutbox(record);
    });
  }

  async cancel(
    context: ProjectScopedPersistenceContext,
    input: { outboxId: string; expectedVersion: number; now?: Date },
  ): Promise<PublishingOutboxRecord> {
    const projectId = requireProjectId(context.projectId);
    const now = input.now ?? new Date();

    const updated = await this.client.publishingHandoffOutboxRecord.updateMany({
      where: {
        projectId,
        outboxId: input.outboxId,
        version: input.expectedVersion,
      },
      data: {
        status: 'cancelled',
        lockedAt: null,
        lockedBy: null,
        completedAt: now,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new PublishingOutboxConcurrencyError(input.outboxId, input.expectedVersion);
    }

    const record = await this.client.publishingHandoffOutboxRecord.findFirstOrThrow({
      where: { projectId, outboxId: input.outboxId },
    });
    return mapOutbox(record);
  }

  async listAttempts(
    context: ProjectScopedPersistenceContext,
    outboxId: string,
  ): Promise<readonly PublishingAttemptRecord[]> {
    const records = await this.client.publishingHandoffAttemptRecord.findMany({
      where: {
        projectId: requireProjectId(context.projectId),
        outboxId,
      },
      orderBy: { attemptNumber: 'asc' },
    });

    return Object.freeze(records.map((record) => mapAttempt(record)));
  }

  async appendAttempt(
    context: ProjectScopedPersistenceContext,
    input: AppendPublishingAttemptInput,
  ): Promise<PublishingAttemptRecord> {
    const projectId = requireProjectId(context.projectId);
    const organizationId = requireOrganizationId(context.organizationId);

    const record = await this.client.publishingHandoffAttemptRecord.create({
      data: {
        organizationId,
        projectId,
        attemptId: randomUUID(),
        outboxId: input.outboxId,
        attemptNumber: input.attempt.attemptNumber,
        providerId: input.attempt.providerId,
        status: toDbPublishingAttemptStatus(input.attempt.status) as PublishingHandoffAttemptStatus,
        errorCode: input.attempt.errorCode,
        retryable: input.attempt.retryable,
        diagnostics: sanitizePublishingAttemptDiagnostics(input.attempt.diagnostics) as
          Prisma.InputJsonValue | undefined,
        remoteContentId: input.attempt.remoteContentId,
        remoteUrl: input.attempt.remoteUrl,
        startedAt: new Date(input.attempt.startedAt),
        completedAt: input.attempt.completedAt ? new Date(input.attempt.completedAt) : undefined,
      },
    });

    return mapAttempt(record);
  }
}
