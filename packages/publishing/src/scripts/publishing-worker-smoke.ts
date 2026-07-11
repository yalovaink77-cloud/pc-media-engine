/**
 * Publishing worker smoke script.
 *
 * enqueue one fake draft handoff → execute one worker cycle
 *
 * Run: pnpm publishing-worker:smoke
 */

import type { PublishingHandoffPackagePayload } from '@pcme/shared';

import { FakePublishingTargetAdapter } from '../handoff/fake-adapter.js';
import {
  createPublishingWorker,
  InMemoryPublishingIdempotencyRepository,
  InMemoryPublishingOutboxRepository,
} from '../worker/index.js';

const CONTEXT = Object.freeze({
  organizationId: 'smoke-org',
  projectId: 'smoke-project',
});

const NOW = new Date('2026-07-11T00:00:00.000Z');

const PACKAGE: PublishingHandoffPackagePayload = Object.freeze({
  handoffId: 'handoff-smoke-001',
  artifactId: 'artifact-smoke-001',
  reviewId: 'review-smoke-001',
  jobId: 'job-smoke-001',
  requestId: 'request-smoke-001',
  sourceId: 'source-smoke-001',
  snapshotId: 'snapshot-smoke-001',
  contentType: 'product-review',
  locale: 'en',
  format: 'markdown',
  content: '# Smoke draft\n\nOffline worker smoke content.',
  target: Object.freeze({
    targetId: 'fake',
    platform: 'fake-platform',
    supportedFormats: Object.freeze(['markdown', 'plain-text']),
  }),
  publishingMetadata: Object.freeze({
    title: 'Worker Smoke Draft',
    slug: 'worker-smoke-draft',
    publishStatus: 'draft' as const,
  }),
  policySnapshot: Object.freeze({
    safetyConstraints: Object.freeze([]),
    affiliateConstraints: Object.freeze([]),
    citationRequirements: Object.freeze([]),
    blockedFields: Object.freeze([]),
    strictMode: false,
    contextComplete: true,
    warningCount: 0,
  }),
  reviewSummary: Object.freeze({
    reviewId: 'review-smoke-001',
    status: 'approved' as const,
    decision: 'approve' as const,
    reviewerId: 'smoke-reviewer',
    findingCount: 0,
  }),
  warnings: Object.freeze([]),
  status: 'ready' as const,
  createdAt: NOW.toISOString(),
});

async function main(): Promise<void> {
  const outboxRepository = new InMemoryPublishingOutboxRepository();
  const idempotencyRepository = new InMemoryPublishingIdempotencyRepository();
  const worker = createPublishingWorker({
    context: CONTEXT,
    outboxRepository,
    idempotencyRepository,
    adapters: [new FakePublishingTargetAdapter()],
    workerId: 'publishing-worker-smoke',
    leaseDurationMs: 60_000,
  });

  const enqueued = await outboxRepository.enqueue(CONTEXT, {
    package: PACKAGE,
    availableAt: NOW.toISOString(),
  });
  const result = await worker.runOnce({ now: NOW });

  console.log(`worker ID: ${result.workerId}`);
  console.log(`outbox ID: ${result.outboxId ?? enqueued.outboxId}`);
  console.log(`execution status: ${result.executionStatus}`);
  console.log(`attempt number: ${result.attemptNumber ?? 0}`);
  console.log(`target ID: ${result.targetId ?? PACKAGE.target.targetId}`);
  console.log(`publish result status: ${result.publishResultStatus ?? 'none'}`);
  console.log(`remote content ID: ${result.remoteContentId ?? 'none'}`);
  console.log(`retry scheduled: ${result.retryScheduled === true}`);
  console.log(`dead-letter status: ${result.deadLetter === true}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
