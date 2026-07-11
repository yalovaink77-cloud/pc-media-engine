import type {
  ProjectScopedPersistenceContext,
  PublishingIdempotencyRecord,
  PublishingIdempotencyRepository,
  PublishingIdempotencyReserveResult,
  ReservePublishingIdempotencyInput,
} from '@pcme/shared';
import {
  buildPublishingIdempotencyKey,
  PublishingIdempotencyConflictError,
  PublishingIdempotencyNotFoundError,
} from '@pcme/shared';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredIdempotencyRecord extends PublishingIdempotencyRecord {
  readonly organizationId: string;
  readonly projectId: string;
}

/** In-memory idempotency repository for offline tests and smoke runs. */
export class InMemoryPublishingIdempotencyRepository implements PublishingIdempotencyRepository {
  private readonly records = new Map<string, StoredIdempotencyRecord>();

  async reserve(
    context: ProjectScopedPersistenceContext,
    input: ReservePublishingIdempotencyInput,
  ): Promise<PublishingIdempotencyReserveResult> {
    const idempotencyKey = buildPublishingIdempotencyKey(input.targetId, input.handoffId);
    const key = this.scopedKey(context.projectId, idempotencyKey);
    const now = input.now ?? new Date();
    const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
    const existing = this.records.get(key);

    if (existing) {
      if (existing.requestHash !== input.requestHash) {
        throw new PublishingIdempotencyConflictError(idempotencyKey);
      }

      if (existing.status === 'completed') {
        return Object.freeze({
          action: 'return-existing' as const,
          record: this.toPublicRecord(existing),
        });
      }

      if (existing.status === 'reserved') {
        if (existing.expiresAt && new Date(existing.expiresAt).getTime() <= now.getTime()) {
          this.records.set(key, {
            ...existing,
            status: 'reserved',
            lastSeenAt: now.toISOString(),
            expiresAt,
          });
          return Object.freeze({ action: 'proceed' as const });
        }

        return Object.freeze({
          action: 'blocked' as const,
          reason: 'Publish reservation already in progress',
        });
      }

      if (existing.status === 'failed' || existing.status === 'expired') {
        this.records.set(key, {
          ...existing,
          status: 'reserved',
          lastSeenAt: now.toISOString(),
          expiresAt,
        });
        return Object.freeze({ action: 'proceed' as const });
      }
    }

    const created: StoredIdempotencyRecord = Object.freeze({
      organizationId: context.organizationId,
      projectId: context.projectId,
      idempotencyKey,
      targetId: input.targetId,
      handoffId: input.handoffId,
      requestHash: input.requestHash,
      status: 'reserved',
      firstSeenAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt,
    });
    this.records.set(key, created);
    return Object.freeze({ action: 'proceed' as const });
  }

  async get(
    context: ProjectScopedPersistenceContext,
    idempotencyKey: string,
  ): Promise<PublishingIdempotencyRecord | undefined> {
    const record = this.records.get(this.scopedKey(context.projectId, idempotencyKey));
    return record ? this.toPublicRecord(record) : undefined;
  }

  async markCompleted(
    context: ProjectScopedPersistenceContext,
    input: {
      idempotencyKey: string;
      remoteContentId?: string;
      remoteUrl?: string;
      now?: Date;
    },
  ): Promise<PublishingIdempotencyRecord> {
    const key = this.scopedKey(context.projectId, input.idempotencyKey);
    const existing = this.records.get(key);
    if (!existing) {
      throw new PublishingIdempotencyNotFoundError(input.idempotencyKey);
    }

    const now = (input.now ?? new Date()).toISOString();
    const updated: StoredIdempotencyRecord = Object.freeze({
      ...existing,
      status: 'completed',
      remoteContentId: input.remoteContentId,
      remoteUrl: input.remoteUrl,
      completedAt: now,
      lastSeenAt: now,
    });
    this.records.set(key, updated);
    return this.toPublicRecord(updated);
  }

  async markFailed(
    context: ProjectScopedPersistenceContext,
    input: { idempotencyKey: string; retryable: boolean; now?: Date },
  ): Promise<PublishingIdempotencyRecord> {
    const key = this.scopedKey(context.projectId, input.idempotencyKey);
    const existing = this.records.get(key);
    if (!existing) {
      throw new PublishingIdempotencyNotFoundError(input.idempotencyKey);
    }

    const now = (input.now ?? new Date()).toISOString();
    const updated: StoredIdempotencyRecord = Object.freeze({
      ...existing,
      status: input.retryable ? 'failed' : 'completed',
      lastSeenAt: now,
    });
    this.records.set(key, updated);
    return this.toPublicRecord(updated);
  }

  async releaseExpired(
    context: ProjectScopedPersistenceContext,
    now: Date = new Date(),
  ): Promise<number> {
    let released = 0;
    for (const [key, record] of this.records.entries()) {
      if (record.projectId !== context.projectId || record.status !== 'reserved') {
        continue;
      }
      if (record.expiresAt && new Date(record.expiresAt).getTime() <= now.getTime()) {
        this.records.set(key, { ...record, status: 'expired', lastSeenAt: now.toISOString() });
        released += 1;
      }
    }
    return released;
  }

  private toPublicRecord(record: StoredIdempotencyRecord): PublishingIdempotencyRecord {
    return Object.freeze({
      idempotencyKey: record.idempotencyKey,
      targetId: record.targetId,
      handoffId: record.handoffId,
      requestHash: record.requestHash,
      status: record.status,
      remoteContentId: record.remoteContentId,
      remoteUrl: record.remoteUrl,
      firstSeenAt: record.firstSeenAt,
      lastSeenAt: record.lastSeenAt,
      completedAt: record.completedAt,
      expiresAt: record.expiresAt,
    });
  }

  private scopedKey(projectId: string, idempotencyKey: string): string {
    return `${projectId}:${idempotencyKey}`;
  }
}

export { buildPublishingIdempotencyKey };
