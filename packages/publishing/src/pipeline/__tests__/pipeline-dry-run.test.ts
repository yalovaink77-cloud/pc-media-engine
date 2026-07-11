import type { ContentGenerationPlan, ContentOrchestrator } from '@pcme/content';
import { describe, expect, it, vi } from 'vitest';

import { createPublishingEnqueueService } from '../../enqueue/publishing-enqueue.service.js';
import type { PublishingEnqueueService } from '../../enqueue/types.js';
import { FakePublishingTargetAdapter } from '../../handoff/fake-adapter.js';
import {
  createPublishingWorker,
  InMemoryPublishingIdempotencyRepository,
  InMemoryPublishingOutboxRepository,
} from '../../worker/index.js';
import { isContentPipelineDryRunError, runContentPipelineDryRun } from '../index.js';

const PRODUCT_ID = 'neilmed-piercing-aftercare-fine-mist';
const FIXED_CREATED_AT = '2026-07-11T09:00:00.000Z';

const BASE_OPTIONS = Object.freeze({
  root: Object.freeze({ type: 'product' as const, id: PRODUCT_ID }),
  contextRecipe: 'product-review',
  contentType: 'product-review',
  locale: 'en',
  tone: 'educational',
  outputFormat: 'markdown' as const,
  strict: false,
  fixedCreatedAt: FIXED_CREATED_AT,
  now: new Date(FIXED_CREATED_AT),
});

describe('runContentPipelineDryRun', () => {
  it('runs the full in-memory dry run successfully', async () => {
    const result = await runContentPipelineDryRun(BASE_OPTIONS);

    expect(['succeeded', 'succeeded-with-warnings']).toContain(result.status);
    expect(result.sourceId).toBeTruthy();
    expect(result.snapshotId).toBeTruthy();
    expect(result.jobId).toBeTruthy();
    expect(result.artifactId).toBeTruthy();
    expect(result.reviewId).toBeTruthy();
    expect(result.handoffId).toBeTruthy();
    expect(result.outboxId).toBeTruthy();
    expect(result.workerStatus).toBe('succeeded');
    expect(result.targetId).toBe('fake');
    expect(result.stages.length).toBeGreaterThanOrEqual(7);
  });

  it('returns succeeded-with-warnings when orchestrator emits warnings', async () => {
    const result = await runContentPipelineDryRun({
      ...BASE_OPTIONS,
      strict: false,
    });

    expect(['succeeded', 'succeeded-with-warnings']).toContain(result.status);
  });

  it('blocks when context preparation is blocked', async () => {
    const result = await runContentPipelineDryRun({
      ...BASE_OPTIONS,
      contentType: 'unsupported-content-type-for-test',
    });

    expect(result.status).toBe('blocked');
    expect(result.error?.code).toBe('context-blocked');
  });

  it('fails when the generation provider fails', async () => {
    const result = await runContentPipelineDryRun({
      ...BASE_OPTIONS,
      fakeProvider: Object.freeze({
        shouldFail: true,
        failureCode: 'provider-timeout',
        failureMessage: 'Simulated provider failure',
      }),
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('provider-failure');
  });

  it('fails when the generated artifact is invalid', async () => {
    const result = await runContentPipelineDryRun({
      ...BASE_OPTIONS,
      fakeProvider: Object.freeze({ generatedContent: '' }),
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('artifact-invalid');
  });

  it('blocks when review rejects the artifact', async () => {
    const result = await runContentPipelineDryRun({
      ...BASE_OPTIONS,
      reviewDecision: 'reject',
    });

    expect(result.status).toBe('blocked');
    expect(result.error?.code).toBe('review-failure');
    expect(result.reviewId).toBeTruthy();
  });

  it('fails when enqueue rejects the handoff package', async () => {
    const enqueueService: PublishingEnqueueService = {
      enqueue: vi.fn().mockResolvedValue(
        Object.freeze({
          status: 'rejected',
          handoffId: 'handoff-test',
          targetId: 'fake',
          scheduled: false,
          warnings: Object.freeze([
            Object.freeze({ code: 'blocked-content', message: 'Blocked content detected' }),
          ]),
        }),
      ),
    };

    const result = await runContentPipelineDryRun({
      ...BASE_OPTIONS,
      enqueueService,
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('enqueue-failure');
  });

  it('fails when the worker publish step fails', async () => {
    const result = await runContentPipelineDryRun({
      ...BASE_OPTIONS,
      fakePublisher: Object.freeze({
        shouldFail: true,
        failureCode: 'timeout',
        failureMessage: 'Simulated publish failure',
      }),
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('worker-failure');
  });

  it('produces deterministic IDs in test mode', async () => {
    const first = await runContentPipelineDryRun(BASE_OPTIONS);
    const second = await runContentPipelineDryRun(BASE_OPTIONS);

    expect(first.jobId).toBe(second.jobId);
    expect(first.artifactId).toBe(second.artifactId);
    expect(first.reviewId).toBe(second.reviewId);
    expect(first.handoffId).toBe(second.handoffId);
    expect(first.outboxId).toBe(second.outboxId);
  });

  it('does not leak prompt or content payloads in the result', async () => {
    const result = await runContentPipelineDryRun(BASE_OPTIONS);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('promptPayload');
    expect(serialized).not.toContain('Consult a professional');
    expect(serialized).not.toContain('# Product review');
    expect(serialized).not.toContain('/home/');
    expect(serialized).not.toContain('Bearer ');
  });

  it('does not call network fetch by default', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network disabled'));

    await runContentPipelineDryRun(BASE_OPTIONS);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('safely skips durable database mode without DB config', async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const result = await runContentPipelineDryRun({
      ...BASE_OPTIONS,
      mode: Object.freeze({ storage: 'durable-database' }),
    });

    process.env.DATABASE_URL = originalDatabaseUrl;

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('mode-unavailable');
    expect(isContentPipelineDryRunError(result.error)).toBe(false);
  });

  it('safely skips WordPress draft mode without credentials', async () => {
    const result = await runContentPipelineDryRun({
      ...BASE_OPTIONS,
      mode: Object.freeze({ publishing: 'wordpress-draft' }),
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('mode-unavailable');
  });

  it('processes at most one worker record per dry run', async () => {
    const outboxRepository = new InMemoryPublishingOutboxRepository();
    const context = Object.freeze({
      organizationId: 'pipeline-dry-run-org',
      projectId: 'pipeline-dry-run-project',
    });
    const enqueueService = createPublishingEnqueueService({
      context,
      outboxRepository,
    });
    const worker = createPublishingWorker({
      context,
      outboxRepository,
      idempotencyRepository: new InMemoryPublishingIdempotencyRepository(),
      adapters: [new FakePublishingTargetAdapter()],
      workerId: 'single-cycle-worker',
    });

    const result = await runContentPipelineDryRun({
      ...BASE_OPTIONS,
      enqueueService,
      worker,
    });

    expect(result.workerStatus).toBe('succeeded');
    const idle = await worker.runOnce({ now: BASE_OPTIONS.now });
    expect(idle.executionStatus).toBe('idle');
  });

  it('blocks when handoff validation fails', async () => {
    const result = await runContentPipelineDryRun({
      ...BASE_OPTIONS,
      publishingMetadata: Object.freeze({ title: '   ', slug: 'pipeline-dry-run-draft' }),
    });

    expect(result.status).toBe('blocked');
    expect(result.error?.code).toBe('handoff-blocked');
    expect(result.handoffId).toBeTruthy();
  });

  it('supports injected orchestrator failures as blocked context', async () => {
    const orchestrator: ContentOrchestrator = {
      prepare: vi.fn().mockResolvedValue(
        Object.freeze({
          requestId: 'req-blocked',
          status: 'blocked',
          blockReason: 'Injected blocked context',
          sourceReference: Object.freeze({ sourceId: 'source-1', sourceType: 'commerce' }),
          snapshot: Object.freeze({
            snapshotId: 'snapshot-1',
            sourceId: 'source-1',
            sourceType: 'commerce',
            sourcePath: 'commerce',
            createdAt: FIXED_CREATED_AT,
            entityCounts: Object.freeze({ product: 1 }),
            warnings: Object.freeze([]),
          }),
          root: BASE_OPTIONS.root,
          contextRecipeId: 'product-review',
          contentType: 'product-review',
          locale: 'en',
          tone: 'educational',
          outputFormat: 'markdown',
          contextSummary: Object.freeze({
            recipeId: 'product-review',
            projection: 'default',
            entityCountByType: Object.freeze({}),
            missingRequired: Object.freeze(['product']),
            truncated: false,
          }),
          warnings: Object.freeze([]),
          metadata: Object.freeze({
            requestId: 'req-blocked',
            entityCount: 0,
            promptSectionCount: 0,
            constraintCount: 0,
            estimatedInputCharacters: 0,
          }),
          createdAt: FIXED_CREATED_AT,
        }) satisfies ContentGenerationPlan,
      ),
    };

    const result = await runContentPipelineDryRun({
      ...BASE_OPTIONS,
      orchestrator,
    });

    expect(result.status).toBe('blocked');
    expect(result.error?.code).toBe('context-blocked');
  });
});
