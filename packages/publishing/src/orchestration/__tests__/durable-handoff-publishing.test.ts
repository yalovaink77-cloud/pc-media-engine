import type { ProjectScopedPersistenceContext } from '@pcme/shared';
import { describe, expect, it } from 'vitest';

import { createPublishingEnqueueService } from '../../enqueue/publishing-enqueue.service.js';
import { FakePublishingTargetAdapter } from '../../handoff/fake-adapter.js';
import type { PublishingHandoffPackage } from '../../handoff/types.js';
import {
  createPublishingWorker,
  InMemoryPublishingIdempotencyRepository,
  InMemoryPublishingOutboxRepository,
} from '../../worker/index.js';
import { executeDurablePublishingHandoffCycle } from '../durable-handoff-publishing.js';

const CONTEXT: ProjectScopedPersistenceContext = Object.freeze({
  organizationId: 'org-integration',
  projectId: 'proj-integration',
});

describe('executeDurablePublishingHandoffCycle', () => {
  it('executes approved handoff → enqueue → worker runOnce', async () => {
    const outboxRepository = new InMemoryPublishingOutboxRepository();
    const idempotencyRepository = new InMemoryPublishingIdempotencyRepository();
    const enqueueService = createPublishingEnqueueService({ context: CONTEXT, outboxRepository });
    const worker = createPublishingWorker({
      context: CONTEXT,
      outboxRepository,
      idempotencyRepository,
      adapters: [new FakePublishingTargetAdapter()],
      workerId: 'integration-worker',
    });

    const handoff: PublishingHandoffPackage = Object.freeze({
      handoffId: 'handoff-integration-cycle',
      artifactId: 'artifact-1',
      reviewId: 'review-1',
      jobId: 'job-1',
      requestId: 'request-1',
      sourceId: 'source-1',
      snapshotId: 'snapshot-1',
      contentType: 'product-review',
      locale: 'en',
      format: 'markdown',
      content: '# Integration\n\nApproved handoff body.',
      target: Object.freeze({
        targetId: 'fake',
        platform: 'fake-platform',
        supportedFormats: Object.freeze(['markdown']),
      }),
      publishingMetadata: Object.freeze({
        title: 'Integration',
        slug: 'integration',
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
        reviewId: 'review-1',
        status: 'approved' as const,
        decision: 'approve' as const,
        reviewerId: 'reviewer-1',
        findingCount: 0,
      }),
      warnings: Object.freeze([]),
      status: 'ready' as const,
      createdAt: '2026-07-11T00:00:00.000Z',
    });

    const cycle = await executeDurablePublishingHandoffCycle({
      context: CONTEXT,
      handoff,
      enqueueService,
      worker,
      now: new Date('2026-07-11T00:00:00.000Z'),
    });

    expect(cycle.enqueue.status).toBe('created');
    expect(cycle.worker.executionStatus).toBe('succeeded');
    expect(cycle.worker.publishResultStatus).toBe('succeeded');

    const attempts = await outboxRepository.listAttempts(CONTEXT, cycle.enqueue.outboxId!);
    expect(attempts).toHaveLength(1);
  });
});
