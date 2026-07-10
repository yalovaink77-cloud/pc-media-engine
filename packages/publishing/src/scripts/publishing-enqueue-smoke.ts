/**
 * Publishing enqueue smoke script.
 *
 * enqueue one fake ready handoff using in-memory dependencies
 *
 * Run: pnpm publishing-enqueue:smoke
 */

import { createPublishingEnqueueService } from '../enqueue/index.js';
import type { PublishingHandoffPackage } from '../handoff/types.js';
import { InMemoryPublishingOutboxRepository } from '../worker/in-memory-outbox.repository.js';

const CONTEXT = Object.freeze({
  organizationId: 'smoke-org',
  projectId: 'smoke-project',
});

const HANDOFF: PublishingHandoffPackage = Object.freeze({
  handoffId: 'handoff-enqueue-smoke',
  artifactId: 'artifact-enqueue-smoke',
  reviewId: 'review-enqueue-smoke',
  jobId: 'job-enqueue-smoke',
  requestId: 'request-enqueue-smoke',
  sourceId: 'source-enqueue-smoke',
  snapshotId: 'snapshot-enqueue-smoke',
  contentType: 'product-review',
  locale: 'en',
  format: 'markdown',
  content: '# Enqueue smoke\n\nOffline enqueue smoke content.',
  target: Object.freeze({
    targetId: 'fake',
    platform: 'fake-platform',
    supportedFormats: Object.freeze(['markdown', 'plain-text']),
  }),
  publishingMetadata: Object.freeze({
    title: 'Enqueue Smoke Draft',
    slug: 'enqueue-smoke-draft',
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
    reviewId: 'review-enqueue-smoke',
    status: 'approved' as const,
    decision: 'approve' as const,
    reviewerId: 'smoke-reviewer',
    findingCount: 0,
  }),
  warnings: Object.freeze([]),
  status: 'ready' as const,
  createdAt: '2026-07-11T00:00:00.000Z',
});

async function main(): Promise<void> {
  const outboxRepository = new InMemoryPublishingOutboxRepository();
  const enqueueService = createPublishingEnqueueService({
    context: CONTEXT,
    outboxRepository,
    defaultMaxAttempts: 5,
  });

  const result = await enqueueService.enqueue(HANDOFF, { priority: 2 });
  const stored = await outboxRepository.getById(CONTEXT, result.outboxId!);

  console.log(`outbox ID: ${result.outboxId}`);
  console.log(`enqueue status: ${result.status}`);
  console.log(`target ID: ${result.targetId}`);
  console.log(`priority: ${result.priority}`);
  console.log(`max attempts: ${result.maxAttempts}`);
  console.log(`scheduled flag: ${result.scheduled}`);
  console.log(`payload stored: ${stored?.packagePayload.handoffId === HANDOFF.handoffId}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
