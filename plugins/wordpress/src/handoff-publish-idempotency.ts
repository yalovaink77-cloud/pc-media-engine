import { createHash } from 'node:crypto';

import type { PublishingHandoffPublishResult } from '@pcme/publishing';
import type {
  ProjectScopedPersistenceContext,
  PublishingIdempotencyRepository,
} from '@pcme/shared';
import { buildPublishingIdempotencyKey } from '@pcme/shared';

import { InMemoryWordPressHandoffIdempotencyStore } from './handoff-idempotency.js';

/** Optional persistent idempotency configuration for handoff publishing. */
export interface PersistentHandoffIdempotencyOptions {
  readonly repository: PublishingIdempotencyRepository;
  readonly context: ProjectScopedPersistenceContext;
  readonly requestHash?: string;
}

/** Build a stable request hash for a handoff publish attempt. */
export function buildHandoffPublishRequestHash(input: {
  handoffId: string;
  targetId: string;
  contentLength: number;
  slug: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32);
}

function toPublishResult(record: {
  remoteContentId?: string;
  remoteUrl?: string;
  targetId: string;
}): PublishingHandoffPublishResult {
  return Object.freeze({
    success: true,
    targetId: record.targetId,
    externalId: record.remoteContentId,
    url: record.remoteUrl,
  });
}

/** Coordinates in-memory and optional persistent idempotency for handoff publishes. */
export class HandoffPublishIdempotencyGuard {
  private readonly memoryStore: InMemoryWordPressHandoffIdempotencyStore;

  constructor(
    memoryStore: InMemoryWordPressHandoffIdempotencyStore = new InMemoryWordPressHandoffIdempotencyStore(),
    private readonly persistent?: PersistentHandoffIdempotencyOptions,
  ) {
    this.memoryStore = memoryStore;
  }

  async getCachedResult(
    handoffId: string,
    targetId: string,
  ): Promise<PublishingHandoffPublishResult | undefined> {
    const cached = this.memoryStore.get(handoffId);
    if (cached) {
      return cached;
    }

    if (!this.persistent) {
      return undefined;
    }

    const key = buildPublishingIdempotencyKey(targetId, handoffId);
    const record = await this.persistent.repository.get(this.persistent.context, key);
    if (record?.status === 'completed') {
      const result = toPublishResult({ ...record, targetId });
      this.memoryStore.save(handoffId, result);
      return result;
    }

    return undefined;
  }

  async reserve(
    handoffId: string,
    targetId: string,
    requestHash: string,
  ): Promise<'proceed' | PublishingHandoffPublishResult> {
    if (this.memoryStore.has(handoffId)) {
      return this.memoryStore.get(handoffId)!;
    }

    if (!this.persistent) {
      return 'proceed';
    }

    const reservation = await this.persistent.repository.reserve(this.persistent.context, {
      targetId,
      handoffId,
      requestHash,
    });

    if (reservation.action === 'return-existing') {
      const result = toPublishResult({ ...reservation.record, targetId });
      this.memoryStore.save(handoffId, result);
      return result;
    }

    if (reservation.action === 'blocked') {
      const cached = await this.getCachedResult(handoffId, targetId);
      if (cached) {
        return cached;
      }
      return Object.freeze({
        success: false,
        targetId,
        error: Object.freeze({
          code: 'idempotency-blocked',
          message: reservation.reason,
        }),
      });
    }

    return 'proceed';
  }

  async saveResult(
    handoffId: string,
    targetId: string,
    requestHash: string,
    result: PublishingHandoffPublishResult,
  ): Promise<void> {
    if (result.success) {
      this.memoryStore.save(handoffId, result);
    }

    if (!this.persistent) {
      return;
    }

    const key = buildPublishingIdempotencyKey(targetId, handoffId);
    if (result.success) {
      await this.persistent.repository.markCompleted(this.persistent.context, {
        idempotencyKey: key,
        remoteContentId: result.externalId,
        remoteUrl: result.url,
      });
      return;
    }

    const retryable =
      result.error?.code !== 'validation' && result.error?.code !== 'idempotency-blocked';
    await this.persistent.repository.markFailed(this.persistent.context, {
      idempotencyKey: key,
      retryable,
    });
  }

  buildRequestHash(pkg: {
    handoffId: string;
    target: { targetId: string };
    content: string;
    publishingMetadata: { slug: string };
  }): string {
    return (
      this.persistent?.requestHash ??
      buildHandoffPublishRequestHash({
        handoffId: pkg.handoffId,
        targetId: pkg.target.targetId,
        contentLength: pkg.content.length,
        slug: pkg.publishingMetadata.slug,
      })
    );
  }
}
