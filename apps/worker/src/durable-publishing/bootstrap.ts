import {
  getPrismaClient,
  PrismaPublishingIdempotencyRepository,
  PrismaPublishingOutboxRepository,
} from '@pcme/database';
import {
  createWordPressPublishingTargetAdapter,
  hasWordPressHandoffCredentials,
} from '@pcme/plugin-wordpress';
import {
  createPublishingTargetAdapterRegistry,
  createPublishingWorker,
  FakePublishingTargetAdapter,
  type PublishingTargetAdapter,
  type PublishingWorker,
} from '@pcme/publishing';

import type { DurablePublishingWorkerConfig } from './config.js';

/** Bootstrap a durable publishing worker with Prisma repositories and target adapters. */
export function createDurablePublishingWorker(
  config: DurablePublishingWorkerConfig,
): PublishingWorker {
  const client = getPrismaClient();
  const outboxRepository = new PrismaPublishingOutboxRepository(client);
  const idempotencyRepository = new PrismaPublishingIdempotencyRepository(client);
  const adapters: PublishingTargetAdapter[] = [new FakePublishingTargetAdapter()];

  if (config.registerWordPress && hasWordPressHandoffCredentials(process.env)) {
    adapters.push(createWordPressPublishingTargetAdapter(process.env, { forceDraft: true }));
  }

  return createPublishingWorker({
    context: Object.freeze({
      organizationId: config.organizationId,
      projectId: config.projectId,
    }),
    outboxRepository,
    idempotencyRepository,
    adapters: createPublishingTargetAdapterRegistry(adapters),
    workerId: config.workerId,
    leaseDurationMs: config.leaseDurationMs,
  });
}

/** Redact worker log fields to safe identifiers and status values only. */
export function formatDurablePublishingWorkerLog(result: {
  workerId: string;
  executionStatus: string;
  outboxId?: string;
  handoffId?: string;
  targetId?: string;
  attemptNumber?: number;
  publishResultStatus?: string;
  remoteContentId?: string;
  retryScheduled?: boolean;
  deadLetter?: boolean;
}): string {
  return [
    `workerId=${result.workerId}`,
    `executionStatus=${result.executionStatus}`,
    result.outboxId ? `outboxId=${result.outboxId}` : undefined,
    result.handoffId ? `handoffId=${result.handoffId}` : undefined,
    result.targetId ? `targetId=${result.targetId}` : undefined,
    result.attemptNumber !== undefined ? `attemptNumber=${result.attemptNumber}` : undefined,
    result.publishResultStatus ? `publishResultStatus=${result.publishResultStatus}` : undefined,
    result.remoteContentId ? `remoteContentId=${result.remoteContentId}` : undefined,
    result.retryScheduled !== undefined ? `retryScheduled=${result.retryScheduled}` : undefined,
    result.deadLetter !== undefined ? `deadLetter=${result.deadLetter}` : undefined,
  ]
    .filter(Boolean)
    .join(' ');
}
