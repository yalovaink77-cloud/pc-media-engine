import { createHash, randomUUID } from 'node:crypto';

import type {
  AppendPublishingAttemptInput,
  ClaimNextPublishingOutboxInput,
  EnqueuePublishingOutboxInput,
  MarkPublishingOutboxFailedInput,
  MarkPublishingOutboxSucceededInput,
  ProjectScopedPersistenceContext,
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

const CLAIMABLE_STATUSES: PublishingOutboxStatus[] = ['pending', 'scheduled', 'failed'];

function buildDeterministicOutboxId(handoffId: string): string {
  return createHash('sha256').update(JSON.stringify({ handoffId })).digest('hex').slice(0, 32);
}

function isTerminalStatus(status: PublishingOutboxStatus): boolean {
  return status === 'succeeded' || status === 'dead-letter' || status === 'cancelled';
}

interface StoredOutboxRecord {
  record: PublishingOutboxRecord;
  organizationId: string;
}

/** In-memory publishing outbox repository for offline tests and smoke runs. */
export class InMemoryPublishingOutboxRepository implements PublishingOutboxRepository {
  private readonly records = new Map<string, StoredOutboxRecord>();
  private readonly attempts = new Map<string, PublishingAttemptRecord[]>();
  private readonly handoffIndex = new Map<string, string>();

  async enqueue(
    context: ProjectScopedPersistenceContext,
    input: EnqueuePublishingOutboxInput,
  ): Promise<PublishingOutboxRecord> {
    const outboxId = buildDeterministicOutboxId(input.package.handoffId);
    const key = this.scopedKey(context.projectId, outboxId);

    if (this.handoffIndex.has(this.scopedHandoffKey(context.projectId, input.package.handoffId))) {
      throw new PublishingOutboxDuplicateError(input.package.handoffId);
    }

    const now = new Date();
    const scheduledAt = input.scheduledAt;
    const availableAt = input.availableAt ?? scheduledAt ?? now.toISOString();
    const status: PublishingOutboxStatus =
      scheduledAt && new Date(scheduledAt).getTime() > now.getTime() ? 'scheduled' : 'pending';

    const record: PublishingOutboxRecord = Object.freeze({
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
      packagePayload: Object.freeze(
        structuredClone(input.package),
      ) as PublishingHandoffPackagePayload,
      status,
      priority: input.priority ?? 0,
      scheduledAt,
      availableAt,
      lockedAt: undefined,
      lockedBy: undefined,
      attemptCount: 0,
      maxAttempts: input.maxAttempts ?? 5,
      lastError: undefined,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      completedAt: undefined,
      version: 1,
    });

    this.records.set(key, { record, organizationId: context.organizationId });
    this.handoffIndex.set(
      this.scopedHandoffKey(context.projectId, input.package.handoffId),
      outboxId,
    );
    this.attempts.set(key, []);
    return record;
  }

  async getById(
    context: ProjectScopedPersistenceContext,
    outboxId: string,
  ): Promise<PublishingOutboxRecord | undefined> {
    return this.records.get(this.scopedKey(context.projectId, outboxId))?.record;
  }

  async getByHandoffId(
    context: ProjectScopedPersistenceContext,
    handoffId: string,
  ): Promise<PublishingOutboxRecord | undefined> {
    const outboxId = this.handoffIndex.get(this.scopedHandoffKey(context.projectId, handoffId));
    return outboxId ? this.getById(context, outboxId) : undefined;
  }

  async claimNext(
    context: ProjectScopedPersistenceContext,
    input: ClaimNextPublishingOutboxInput,
  ): Promise<PublishingOutboxRecord | undefined> {
    const now = input.now ?? new Date();
    const candidates = [...this.records.entries()]
      .filter(([key]) => key.startsWith(`${context.projectId}:`))
      .map(([, stored]) => stored.record)
      .filter((record) => CLAIMABLE_STATUSES.includes(record.status))
      .filter((record) => new Date(record.availableAt).getTime() <= now.getTime())
      .filter(
        (record) => !record.scheduledAt || new Date(record.scheduledAt).getTime() <= now.getTime(),
      )
      .filter((record) => !record.lockedAt)
      .sort((left, right) => {
        if (left.priority !== right.priority) {
          return right.priority - left.priority;
        }
        return new Date(left.availableAt).getTime() - new Date(right.availableAt).getTime();
      });

    for (const candidate of candidates) {
      const key = this.scopedKey(context.projectId, candidate.outboxId);
      const stored = this.records.get(key);
      if (!stored || stored.record.version !== candidate.version || stored.record.lockedAt) {
        continue;
      }

      const updated: PublishingOutboxRecord = Object.freeze({
        ...stored.record,
        status: 'processing',
        lockedAt: now.toISOString(),
        lockedBy: input.workerId,
        version: stored.record.version + 1,
        updatedAt: now.toISOString(),
      });
      this.records.set(key, { ...stored, record: updated });
      return updated;
    }

    return undefined;
  }

  async markSucceeded(
    context: ProjectScopedPersistenceContext,
    input: MarkPublishingOutboxSucceededInput,
  ): Promise<PublishingOutboxRecord> {
    const key = this.scopedKey(context.projectId, input.outboxId);
    const stored = this.requireStored(context.projectId, input.outboxId);
    if (isTerminalStatus(stored.record.status)) {
      throw new PublishingOutboxTerminalStateError(input.outboxId, stored.record.status);
    }
    if (stored.record.version !== input.expectedVersion) {
      throw new PublishingOutboxConcurrencyError(input.outboxId, input.expectedVersion);
    }

    const now = (input.now ?? new Date()).toISOString();
    const updated: PublishingOutboxRecord = Object.freeze({
      ...stored.record,
      status: 'succeeded',
      lockedAt: undefined,
      lockedBy: undefined,
      completedAt: now,
      lastError: undefined,
      version: stored.record.version + 1,
      updatedAt: now,
    });
    this.records.set(key, { ...stored, record: updated });
    this.appendAttemptInternal(key, input.outboxId, input.attempt, now);
    return updated;
  }

  async markFailed(
    context: ProjectScopedPersistenceContext,
    input: MarkPublishingOutboxFailedInput,
  ): Promise<PublishingOutboxRecord> {
    const key = this.scopedKey(context.projectId, input.outboxId);
    const stored = this.requireStored(context.projectId, input.outboxId);
    if (isTerminalStatus(stored.record.status)) {
      throw new PublishingOutboxTerminalStateError(input.outboxId, stored.record.status);
    }
    if (stored.record.version !== input.expectedVersion) {
      throw new PublishingOutboxConcurrencyError(input.outboxId, input.expectedVersion);
    }

    const nowDate = input.now ?? new Date();
    const now = nowDate.toISOString();
    const nextAttemptCount = stored.record.attemptCount + 1;
    const shouldRetry = input.retryable && nextAttemptCount < stored.record.maxAttempts;
    const nextAvailableAt = shouldRetry
      ? computePublishingRetryAvailableAt({
          attemptCount: nextAttemptCount,
          now: nowDate,
        }).toISOString()
      : now;

    const updated: PublishingOutboxRecord = Object.freeze({
      ...stored.record,
      status: shouldRetry ? 'failed' : 'dead-letter',
      attemptCount: nextAttemptCount,
      availableAt: nextAvailableAt,
      lockedAt: undefined,
      lockedBy: undefined,
      lastError: input.message,
      completedAt: shouldRetry ? undefined : now,
      version: stored.record.version + 1,
      updatedAt: now,
    });
    this.records.set(key, { ...stored, record: updated });
    this.appendAttemptInternal(key, input.outboxId, input.attempt, now);
    return updated;
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
    const key = this.scopedKey(context.projectId, input.outboxId);
    const stored = this.requireStored(context.projectId, input.outboxId);
    if (stored.record.version !== input.expectedVersion) {
      throw new PublishingOutboxConcurrencyError(input.outboxId, input.expectedVersion);
    }

    const now = (input.now ?? new Date()).toISOString();
    const updated: PublishingOutboxRecord = Object.freeze({
      ...stored.record,
      status: 'dead-letter',
      lockedAt: undefined,
      lockedBy: undefined,
      lastError: input.message,
      completedAt: now,
      version: stored.record.version + 1,
      updatedAt: now,
    });
    this.records.set(key, { ...stored, record: updated });
    this.appendAttemptInternal(key, input.outboxId, input.attempt, now);
    return updated;
  }

  async cancel(
    context: ProjectScopedPersistenceContext,
    input: { outboxId: string; expectedVersion: number; now?: Date },
  ): Promise<PublishingOutboxRecord> {
    const key = this.scopedKey(context.projectId, input.outboxId);
    const stored = this.requireStored(context.projectId, input.outboxId);
    if (stored.record.version !== input.expectedVersion) {
      throw new PublishingOutboxConcurrencyError(input.outboxId, input.expectedVersion);
    }

    const now = (input.now ?? new Date()).toISOString();
    const updated: PublishingOutboxRecord = Object.freeze({
      ...stored.record,
      status: 'cancelled',
      lockedAt: undefined,
      lockedBy: undefined,
      completedAt: now,
      version: stored.record.version + 1,
      updatedAt: now,
    });
    this.records.set(key, { ...stored, record: updated });
    return updated;
  }

  async listAttempts(
    context: ProjectScopedPersistenceContext,
    outboxId: string,
  ): Promise<readonly PublishingAttemptRecord[]> {
    return [...(this.attempts.get(this.scopedKey(context.projectId, outboxId)) ?? [])];
  }

  async appendAttempt(
    context: ProjectScopedPersistenceContext,
    input: AppendPublishingAttemptInput,
  ): Promise<PublishingAttemptRecord> {
    const key = this.scopedKey(context.projectId, input.outboxId);
    this.requireStored(context.projectId, input.outboxId);
    return this.appendAttemptInternal(key, input.outboxId, input.attempt, new Date().toISOString());
  }

  private appendAttemptInternal(
    key: string,
    outboxId: string,
    attempt: AppendPublishingAttemptInput['attempt'],
    completedAtFallback: string,
  ): PublishingAttemptRecord {
    const record: PublishingAttemptRecord = Object.freeze({
      attemptId: randomUUID(),
      outboxId,
      attemptNumber: attempt.attemptNumber,
      providerId: attempt.providerId,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt ?? completedAtFallback,
      status: attempt.status,
      errorCode: attempt.errorCode,
      retryable: attempt.retryable,
      diagnostics: attempt.diagnostics,
      remoteContentId: attempt.remoteContentId,
      remoteUrl: attempt.remoteUrl,
    });
    const history = this.attempts.get(key) ?? [];
    history.push(record);
    this.attempts.set(key, history);
    return record;
  }

  private requireStored(projectId: string, outboxId: string): StoredOutboxRecord {
    const stored = this.records.get(this.scopedKey(projectId, outboxId));
    if (!stored) {
      throw new PublishingOutboxNotFoundError(outboxId);
    }
    return stored;
  }

  private scopedKey(projectId: string, outboxId: string): string {
    return `${projectId}:${outboxId}`;
  }

  private scopedHandoffKey(projectId: string, handoffId: string): string {
    return `${projectId}:${handoffId}`;
  }
}

export { buildDeterministicOutboxId };
