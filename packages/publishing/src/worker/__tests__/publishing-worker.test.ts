import type { PublishingHandoffPackagePayload } from '@pcme/shared';
import { describe, expect, it, vi } from 'vitest';

import { FakePublishingTargetAdapter } from '../../handoff/fake-adapter.js';
import type { PublishingTargetAdapter } from '../../handoff/types.js';
import {
  buildPublishingWorkerRequestHash,
  createPublishingWorker,
  InMemoryPublishingIdempotencyRepository,
  InMemoryPublishingOutboxRepository,
} from '../index.js';

const CONTEXT = Object.freeze({
  organizationId: 'org-1',
  projectId: 'proj-1',
});

const NOW = new Date('2026-07-11T00:00:00.000Z');

function buildPackage(
  overrides?: Partial<PublishingHandoffPackagePayload>,
): PublishingHandoffPackagePayload {
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
    createdAt: NOW.toISOString(),
    ...overrides,
  });
}

function createHarness(
  adapters: readonly PublishingTargetAdapter[] = [new FakePublishingTargetAdapter()],
) {
  const outboxRepository = new InMemoryPublishingOutboxRepository();
  const idempotencyRepository = new InMemoryPublishingIdempotencyRepository();
  const worker = createPublishingWorker({
    context: CONTEXT,
    outboxRepository,
    idempotencyRepository,
    adapters,
    workerId: 'worker-1',
    leaseDurationMs: 60_000,
  });
  return { outboxRepository, idempotencyRepository, worker };
}

describe('createPublishingWorker', () => {
  it('returns idle when no records are available', async () => {
    const { worker } = createHarness();
    const result = await worker.runOnce({ now: NOW });
    expect(result.executionStatus).toBe('idle');
    expect(result.outboxId).toBeUndefined();
  });

  it('executes a successful runOnce cycle', async () => {
    const { outboxRepository, idempotencyRepository, worker } = createHarness();
    const pkg = buildPackage();
    await outboxRepository.enqueue(CONTEXT, { package: pkg, availableAt: NOW.toISOString() });

    const result = await worker.runOnce({ now: NOW });

    expect(result.executionStatus).toBe('succeeded');
    expect(result.publishResultStatus).toBe('succeeded');
    expect(result.attemptNumber).toBe(1);
    expect(result.remoteContentId).toContain('fake-');

    const outbox = await outboxRepository.getByHandoffId(CONTEXT, pkg.handoffId);
    expect(outbox?.status).toBe('succeeded');
    expect(outbox?.lockedAt).toBeUndefined();

    const idempotency = await idempotencyRepository.get(CONTEXT, 'fake:handoff-001');
    expect(idempotency?.status).toBe('completed');
  });

  it('fails safely for unknown target adapters', async () => {
    const { outboxRepository, worker } = createHarness();
    await outboxRepository.enqueue(CONTEXT, {
      package: buildPackage({
        target: Object.freeze({
          targetId: 'missing-target',
          platform: 'missing',
          supportedFormats: Object.freeze(['markdown']),
        }),
      }),
      availableAt: NOW.toISOString(),
    });

    const result = await worker.runOnce({ now: NOW });

    expect(result.executionStatus).toBe('failed-terminal');
    expect(result.publishResultStatus).toBe('failed');
    expect(result.retryScheduled).toBe(false);
  });

  it('schedules retryable publish failures', async () => {
    const { outboxRepository, worker } = createHarness([
      new FakePublishingTargetAdapter({
        shouldFail: true,
        failureCode: 'timeout',
        failureMessage: 'Simulated timeout',
      }),
    ]);
    await outboxRepository.enqueue(CONTEXT, {
      package: buildPackage(),
      availableAt: NOW.toISOString(),
    });

    const result = await worker.runOnce({ now: NOW });

    expect(result.executionStatus).toBe('failed-retryable');
    expect(result.retryScheduled).toBe(true);
    expect(result.deadLetter).toBe(false);

    const outbox = await outboxRepository.getByHandoffId(CONTEXT, 'handoff-001');
    expect(outbox?.status).toBe('failed');
    expect(outbox?.lockedAt).toBeUndefined();
    expect(new Date(outbox!.availableAt).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('marks non-retryable publish failures as terminal', async () => {
    const { outboxRepository, worker } = createHarness([
      new FakePublishingTargetAdapter({
        shouldFail: true,
        failureCode: 'validation',
        failureMessage: 'Invalid payload',
      }),
    ]);
    await outboxRepository.enqueue(CONTEXT, {
      package: buildPackage(),
      availableAt: NOW.toISOString(),
    });

    const result = await worker.runOnce({ now: NOW });

    expect(result.executionStatus).toBe('dead-letter');
    expect(result.deadLetter).toBe(true);
    expect(result.retryScheduled).toBe(false);
  });

  it('moves exhausted retryable failures to dead-letter', async () => {
    const { outboxRepository, worker } = createHarness([
      new FakePublishingTargetAdapter({
        shouldFail: true,
        failureCode: 'timeout',
      }),
    ]);
    const enqueued = await outboxRepository.enqueue(CONTEXT, {
      package: buildPackage(),
      availableAt: NOW.toISOString(),
      maxAttempts: 1,
    });

    const result = await worker.runOnce({ now: NOW });
    const outbox = await outboxRepository.getById(CONTEXT, enqueued.outboxId);

    expect(result.executionStatus).toBe('dead-letter');
    expect(outbox?.status).toBe('dead-letter');
  });

  it('skips remote publish when idempotency is already completed', async () => {
    const adapter = new FakePublishingTargetAdapter();
    const publishSpy = vi.spyOn(adapter, 'publish');
    const { outboxRepository, idempotencyRepository, worker } = createHarness([adapter]);
    const pkg = buildPackage();

    await idempotencyRepository.reserve(CONTEXT, {
      targetId: 'fake',
      handoffId: pkg.handoffId,
      requestHash: buildPublishingWorkerRequestHash(pkg),
      now: NOW,
    });
    await idempotencyRepository.markCompleted(CONTEXT, {
      idempotencyKey: 'fake:handoff-001',
      remoteContentId: 'cached-123',
      remoteUrl: 'https://fake.example.com/cached',
      now: NOW,
    });
    await outboxRepository.enqueue(CONTEXT, { package: pkg, availableAt: NOW.toISOString() });

    const result = await worker.runOnce({ now: NOW });

    expect(result.executionStatus).toBe('succeeded');
    expect(result.publishResultStatus).toBe('skipped');
    expect(result.remoteContentId).toBe('cached-123');
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it('prevents concurrent workers from claiming the same record', async () => {
    const { outboxRepository } = createHarness();
    await outboxRepository.enqueue(CONTEXT, {
      package: buildPackage(),
      availableAt: NOW.toISOString(),
    });

    const workerA = createPublishingWorker({
      context: CONTEXT,
      outboxRepository,
      idempotencyRepository: new InMemoryPublishingIdempotencyRepository(),
      adapters: [new FakePublishingTargetAdapter()],
      workerId: 'worker-a',
    });
    const workerB = createPublishingWorker({
      context: CONTEXT,
      outboxRepository,
      idempotencyRepository: new InMemoryPublishingIdempotencyRepository(),
      adapters: [new FakePublishingTargetAdapter()],
      workerId: 'worker-b',
    });

    const [first, second] = await Promise.all([
      workerA.runOnce({ now: NOW }),
      workerB.runOnce({ now: NOW }),
    ]);

    const statuses = [first.executionStatus, second.executionStatus].sort();
    expect(statuses).toEqual(['idle', 'succeeded']);
  });

  it('appends attempt history for each execution', async () => {
    const { outboxRepository, worker } = createHarness([
      new FakePublishingTargetAdapter({ shouldFail: true, failureCode: 'timeout' }),
    ]);
    const enqueued = await outboxRepository.enqueue(CONTEXT, {
      package: buildPackage(),
      availableAt: NOW.toISOString(),
    });

    await worker.runOnce({ now: NOW });
    const attempts = await outboxRepository.listAttempts(CONTEXT, enqueued.outboxId);

    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.status).toBe('failed');
    expect(attempts[0]?.errorCode).toBe('timeout');
  });

  it('fails validation before publish for blocked handoffs', async () => {
    const { outboxRepository, worker } = createHarness();
    await outboxRepository.enqueue(CONTEXT, {
      package: buildPackage({ status: 'blocked' }),
      availableAt: NOW.toISOString(),
    });

    const result = await worker.runOnce({ now: NOW });

    expect(result.executionStatus).toBe('dead-letter');
    expect(result.publishResultStatus).toBe('failed');
  });

  it('returns deterministic execution results for the same inputs', async () => {
    const { outboxRepository, worker } = createHarness();
    await outboxRepository.enqueue(CONTEXT, {
      package: buildPackage({ handoffId: 'handoff-deterministic' }),
      availableAt: NOW.toISOString(),
    });

    const first = await worker.runOnce({ now: NOW });
    expect(first.executionStatus).toBe('succeeded');

    await outboxRepository.enqueue(CONTEXT, {
      package: buildPackage({ handoffId: 'handoff-deterministic-2' }),
      availableAt: NOW.toISOString(),
    });
    const second = await worker.runOnce({ now: NOW });

    expect(second.executionStatus).toBe('succeeded');
    expect(second.remoteContentId).toContain('fake-handoff-det');
  });

  it('keeps stored package payload immutable after execution', async () => {
    const { outboxRepository, worker } = createHarness();
    const pkg = buildPackage({ content: 'immutable-content-value' });
    const enqueued = await outboxRepository.enqueue(CONTEXT, {
      package: pkg,
      availableAt: NOW.toISOString(),
    });

    await worker.runOnce({ now: NOW });
    const stored = await outboxRepository.getById(CONTEXT, enqueued.outboxId);

    expect(stored?.packagePayload.content).toBe('immutable-content-value');
    expect(stored?.packagePayload).toEqual(enqueued.packagePayload);
  });

  it('handles adapter validation failure without calling publish', async () => {
    const adapter: PublishingTargetAdapter = {
      targetId: 'fake',
      capabilities: new FakePublishingTargetAdapter().capabilities,
      validate: () =>
        Object.freeze({
          valid: false,
          status: 'blocked',
          errors: Object.freeze([
            Object.freeze({
              code: 'validation',
              message: 'Blocked by adapter validation',
              severity: 'error' as const,
            }),
          ]),
          warnings: Object.freeze([]),
        }),
      publish: vi.fn(),
    };
    const { outboxRepository, worker } = createHarness([adapter]);
    await outboxRepository.enqueue(CONTEXT, {
      package: buildPackage(),
      availableAt: NOW.toISOString(),
    });

    const result = await worker.runOnce({ now: NOW });

    expect(result.executionStatus).toBe('dead-letter');
    expect(adapter.publish).not.toHaveBeenCalled();
  });
});

describe('publishing worker integration flow', () => {
  it('runs enqueue → claim → publish → attempt history → succeeded outbox → completed idempotency', async () => {
    const outboxRepository = new InMemoryPublishingOutboxRepository();
    const idempotencyRepository = new InMemoryPublishingIdempotencyRepository();
    const worker = createPublishingWorker({
      context: CONTEXT,
      outboxRepository,
      idempotencyRepository,
      adapters: [new FakePublishingTargetAdapter()],
      workerId: 'integration-worker',
    });
    const pkg = buildPackage({ handoffId: 'handoff-integration' });

    const enqueued = await outboxRepository.enqueue(CONTEXT, {
      package: pkg,
      availableAt: NOW.toISOString(),
    });
    expect(enqueued.status).toBe('pending');

    const result = await worker.runOnce({ now: NOW });
    expect(result.executionStatus).toBe('succeeded');

    const outbox = await outboxRepository.getById(CONTEXT, enqueued.outboxId);
    expect(outbox?.status).toBe('succeeded');
    expect(outbox?.lockedAt).toBeUndefined();

    const attempts = await outboxRepository.listAttempts(CONTEXT, enqueued.outboxId);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.status).toBe('succeeded');

    const idempotency = await idempotencyRepository.get(CONTEXT, 'fake:handoff-integration');
    expect(idempotency?.status).toBe('completed');
    expect(idempotency?.remoteContentId).toBe(result.remoteContentId);
  });
});
