import { setPrismaClientForTests } from '@pcme/database';
import {
  createPublishingEnqueueService,
  createPublishingWorker,
  executeDurablePublishingHandoffCycle,
  FakePublishingTargetAdapter,
  InMemoryPublishingIdempotencyRepository,
  InMemoryPublishingOutboxRepository,
} from '@pcme/publishing';
import { describe, expect, it, vi } from 'vitest';

import { createDurablePublishingWorker } from '../durable-publishing/bootstrap.js';
import { loadDurablePublishingWorkerConfig } from '../durable-publishing/config.js';

const CONTEXT = Object.freeze({
  organizationId: 'org-worker',
  projectId: 'proj-worker',
});

describe('loadDurablePublishingWorkerConfig', () => {
  it('returns null without database configuration', () => {
    expect(
      loadDurablePublishingWorkerConfig({
        DATABASE_URL: '',
        PCME_DEFAULT_ORG_ID: 'org',
        PCME_DEFAULT_PROJECT_ID: 'proj',
      }),
    ).toBeNull();
  });

  it('returns null without org/project scope', () => {
    expect(
      loadDurablePublishingWorkerConfig({
        DATABASE_URL: 'postgresql://localhost:5432/pcme',
      }),
    ).toBeNull();
  });

  it('loads worker configuration when required env vars are present', () => {
    const config = loadDurablePublishingWorkerConfig({
      DATABASE_URL: 'postgresql://localhost:5432/pcme',
      PCME_DEFAULT_ORG_ID: 'org-1',
      PCME_DEFAULT_PROJECT_ID: 'proj-1',
      PCME_DURABLE_PUBLISHING_WORKER_ID: 'worker-test',
    });

    expect(config?.workerId).toBe('worker-test');
    expect(config?.registerWordPress).toBe(false);
  });
});

describe('createDurablePublishingWorker', () => {
  it('wires Prisma repositories and fake adapter by default', () => {
    const mockClient = {
      publishingHandoffOutboxRecord: {},
      publishingIdempotencyRecord: {},
      $transaction: vi.fn(),
    } as never;

    process.env.DATABASE_URL = 'postgresql://localhost:5432/pcme-test';
    setPrismaClientForTests(mockClient);

    const worker = createDurablePublishingWorker({
      databaseUrl: 'postgresql://localhost:5432/pcme',
      organizationId: 'org-1',
      projectId: 'proj-1',
      workerId: 'worker-test',
      leaseDurationMs: 60_000,
      defaultMaxAttempts: 5,
      registerWordPress: false,
    });

    expect(worker.workerId).toBe('worker-test');
    setPrismaClientForTests(undefined);
  });
});

describe('durable publishing orchestration', () => {
  it('runs enqueue → runOnce and processes at most one record', async () => {
    const outboxRepository = new InMemoryPublishingOutboxRepository();
    const idempotencyRepository = new InMemoryPublishingIdempotencyRepository();
    const enqueueService = createPublishingEnqueueService({
      context: CONTEXT,
      outboxRepository,
      defaultMaxAttempts: 5,
    });
    const worker = createPublishingWorker({
      context: CONTEXT,
      outboxRepository,
      idempotencyRepository,
      adapters: [new FakePublishingTargetAdapter()],
      workerId: 'worker-orchestration',
    });

    const handoff = Object.freeze({
      handoffId: 'handoff-orchestration',
      artifactId: 'artifact-1',
      reviewId: 'review-1',
      jobId: 'job-1',
      requestId: 'request-1',
      sourceId: 'source-1',
      snapshotId: 'snapshot-1',
      contentType: 'product-review',
      locale: 'en',
      format: 'markdown',
      content: '# Orchestration\n\nBody',
      target: Object.freeze({
        targetId: 'fake',
        platform: 'fake-platform',
        supportedFormats: Object.freeze(['markdown']),
      }),
      publishingMetadata: Object.freeze({
        title: 'Orchestration',
        slug: 'orchestration',
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

    const idle = await worker.runOnce({ now: new Date('2026-07-11T00:00:01.000Z') });
    expect(idle.executionStatus).toBe('idle');
  });

  it('fails safely when no adapter is registered for the target', async () => {
    const now = new Date('2026-07-11T00:00:00.000Z');
    const outboxRepository = new InMemoryPublishingOutboxRepository();
    const enqueueService = createPublishingEnqueueService({ context: CONTEXT, outboxRepository });
    const worker = createPublishingWorker({
      context: CONTEXT,
      outboxRepository,
      idempotencyRepository: new InMemoryPublishingIdempotencyRepository(),
      adapters: [],
      workerId: 'worker-no-adapter',
    });

    await enqueueService.enqueue(
      Object.freeze({
        handoffId: 'handoff-missing-adapter',
        artifactId: 'artifact-1',
        reviewId: 'review-1',
        jobId: 'job-1',
        requestId: 'request-1',
        sourceId: 'source-1',
        snapshotId: 'snapshot-1',
        contentType: 'product-review',
        locale: 'en',
        format: 'markdown',
        content: '# Missing adapter',
        target: Object.freeze({
          targetId: 'fake',
          platform: 'fake-platform',
          supportedFormats: Object.freeze(['markdown']),
        }),
        publishingMetadata: Object.freeze({
          title: 'Missing adapter',
          slug: 'missing-adapter',
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
      }),
      { now },
    );

    const result = await worker.runOnce({ now });
    expect(result.executionStatus).toBe('failed-terminal');
  });

  it('keeps WordPress registration disabled by default', () => {
    const config = loadDurablePublishingWorkerConfig({
      DATABASE_URL: 'postgresql://localhost:5432/pcme',
      PCME_DEFAULT_ORG_ID: 'org-1',
      PCME_DEFAULT_PROJECT_ID: 'proj-1',
      WORDPRESS_URL: 'https://wp.example.com',
      WORDPRESS_USERNAME: 'editor',
      WORDPRESS_APP_PASSWORD: 'secret',
    });

    expect(config?.registerWordPress).toBe(false);
  });
});
