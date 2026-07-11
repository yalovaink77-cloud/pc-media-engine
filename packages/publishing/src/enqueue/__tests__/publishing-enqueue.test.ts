import { PublishingOutboxDuplicateError } from '@pcme/shared';
import { describe, expect, it } from 'vitest';

import type { PublishingHandoffPackage } from '../../handoff/types.js';
import { InMemoryPublishingOutboxRepository } from '../../worker/in-memory-outbox.repository.js';
import {
  createPublishingEnqueueService,
  PublishingEnqueueNotReadyError,
  PublishingEnqueuePayloadConflictError,
  toPublishingHandoffPackagePayload,
} from '../index.js';

const CONTEXT = Object.freeze({
  organizationId: 'org-1',
  projectId: 'proj-1',
});

const NOW = '2026-07-11T00:00:00.000Z';

function buildHandoff(overrides?: Partial<PublishingHandoffPackage>): PublishingHandoffPackage {
  return Object.freeze({
    handoffId: 'handoff-001',
    artifactId: 'artifact-001',
    reviewId: 'review-001',
    jobId: 'job-001',
    requestId: 'request-001',
    sourceId: 'source-001',
    snapshotId: 'snapshot-001',
    contentType: 'product-review',
    locale: 'en',
    format: 'markdown',
    content: '# Title\n\nBody text.',
    target: Object.freeze({
      targetId: 'fake',
      platform: 'fake-platform',
      supportedFormats: Object.freeze(['markdown', 'plain-text']),
    }),
    publishingMetadata: Object.freeze({
      title: 'Title',
      slug: 'title',
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
      reviewId: 'review-001',
      status: 'approved' as const,
      decision: 'approve' as const,
      reviewerId: 'reviewer-1',
      findingCount: 0,
    }),
    warnings: Object.freeze([]),
    status: 'ready' as const,
    createdAt: NOW,
    ...overrides,
  });
}

describe('createPublishingEnqueueService', () => {
  it('enqueues a ready handoff package', async () => {
    const outboxRepository = new InMemoryPublishingOutboxRepository();
    const service = createPublishingEnqueueService({ context: CONTEXT, outboxRepository });
    const handoff = buildHandoff();

    const result = await service.enqueue(handoff, { priority: 3, maxAttempts: 7 });

    expect(result.status).toBe('created');
    expect(result.outboxId).toBeDefined();
    expect(result.targetId).toBe('fake');
    expect(result.priority).toBe(3);
    expect(result.maxAttempts).toBe(7);
    expect(result.requestHash).toHaveLength(32);
  });

  it('rejects non-ready handoffs', async () => {
    const service = createPublishingEnqueueService({
      context: CONTEXT,
      outboxRepository: new InMemoryPublishingOutboxRepository(),
    });

    await expect(service.enqueue(buildHandoff({ status: 'blocked' }))).rejects.toBeInstanceOf(
      PublishingEnqueueNotReadyError,
    );
  });

  it('returns idempotent existing records for matching payloads', async () => {
    const outboxRepository = new InMemoryPublishingOutboxRepository();
    const service = createPublishingEnqueueService({ context: CONTEXT, outboxRepository });
    const handoff = buildHandoff();

    const first = await service.enqueue(handoff);
    const second = await service.enqueue(handoff);

    expect(first.status).toBe('created');
    expect(second.status).toBe('existing');
    expect(second.outboxId).toBe(first.outboxId);
  });

  it('rejects conflicting payloads for the same handoff ID', async () => {
    const outboxRepository = new InMemoryPublishingOutboxRepository();
    const service = createPublishingEnqueueService({ context: CONTEXT, outboxRepository });
    const handoff = buildHandoff();

    await service.enqueue(handoff);
    await expect(
      service.enqueue(buildHandoff({ content: '# Changed content\n\nDifferent body.' })),
    ).rejects.toBeInstanceOf(PublishingEnqueuePayloadConflictError);
  });

  it('preserves scheduled metadata', async () => {
    const outboxRepository = new InMemoryPublishingOutboxRepository();
    const service = createPublishingEnqueueService({ context: CONTEXT, outboxRepository });
    const scheduledAt = '2026-12-01T10:00:00.000Z';

    const result = await service.enqueue(buildHandoff(), {
      scheduledAt,
      availableAt: scheduledAt,
    });

    expect(result.scheduled).toBe(true);
    expect(result.outbox?.scheduledAt).toBe(scheduledAt);
  });

  it('stores sanitized payload content', async () => {
    const outboxRepository = new InMemoryPublishingOutboxRepository();
    const service = createPublishingEnqueueService({ context: CONTEXT, outboxRepository });
    const handoff = buildHandoff({ content: 'safe-content-only' });

    const result = await service.enqueue(handoff);
    const stored = await outboxRepository.getById(CONTEXT, result.outboxId!);

    expect(stored?.packagePayload.content).toBe('safe-content-only');
    expect(stored?.packagePayload).toEqual(toPublishingHandoffPackagePayload(handoff));
  });

  it('rejects blocked content before persistence', async () => {
    const service = createPublishingEnqueueService({
      context: CONTEXT,
      outboxRepository: new InMemoryPublishingOutboxRepository(),
    });

    const result = await service.enqueue(
      buildHandoff({ content: 'template_path=/home/user/secret.yaml' }),
    );

    expect(result.status).toBe('rejected');
    expect(result.outboxId).toBeUndefined();
  });

  it('handles repository duplicate races via idempotent lookup', async () => {
    const outboxRepository = new InMemoryPublishingOutboxRepository();
    const originalEnqueue = outboxRepository.enqueue.bind(outboxRepository);
    outboxRepository.enqueue = async (context, input) => {
      await originalEnqueue(context, input);
      throw new PublishingOutboxDuplicateError(input.package.handoffId);
    };

    const service = createPublishingEnqueueService({ context: CONTEXT, outboxRepository });
    const handoff = buildHandoff();
    const result = await service.enqueue(handoff);

    expect(result.status).toBe('existing');
  });
});
