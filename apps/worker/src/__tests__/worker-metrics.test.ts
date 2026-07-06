import { describe, expect, it } from 'vitest';

import { WorkerMetricsService } from '../metrics.js';
import type { PublishingProcessorDeps } from '../processors/publishing.processor.js';
import { processPublishingJob } from '../processors/publishing.processor.js';
import { computeScheduleDelay } from '../queue/publishing-enqueue.js';
import type { PublishingJobPayload } from '../queue/publishing-payload.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePayload(overrides: Partial<PublishingJobPayload> = {}): PublishingJobPayload {
  return {
    slug: 'test-article',
    title: 'Test Article',
    body: '<p>Test body.</p>',
    projectId: 'proj-abc',
    // Required by toPublishingRequest / resolveMediaBuffer
    mediaData: 'bW9jay1pbWFnZS1ieXRlcw==',
    mediaMimeType: 'image/jpeg',
    mediaFilename: 'test.jpg',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// WorkerMetricsService unit tests
// ---------------------------------------------------------------------------

describe('WorkerMetricsService', () => {
  it('starts with all counters at zero', () => {
    const svc = new WorkerMetricsService();
    const snap = svc.snapshot();
    expect(snap.processedTotal).toBe(0);
    expect(snap.publishedTotal).toBe(0);
    expect(snap.retriesTotal).toBe(0);
    expect(snap.failuresTotal).toBe(0);
    expect(snap.duplicateSkipsTotal).toBe(0);
    expect(snap.schedulerJobsTotal).toBe(0);
  });

  it('increments counters correctly', () => {
    const svc = new WorkerMetricsService();
    svc.inc('publishedTotal');
    svc.inc('publishedTotal');
    svc.inc('retriesTotal');
    expect(svc.snapshot().publishedTotal).toBe(2);
    expect(svc.snapshot().retriesTotal).toBe(1);
  });

  it('snapshot is a copy', () => {
    const svc = new WorkerMetricsService();
    svc.inc('processedTotal');
    const snap = svc.snapshot() as { processedTotal: number };
    snap.processedTotal = 999;
    expect(svc.snapshot().processedTotal).toBe(1);
  });

  it('reset clears all counters', () => {
    const svc = new WorkerMetricsService();
    svc.inc('publishedTotal', 5);
    svc.reset();
    expect(svc.snapshot().publishedTotal).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Processor metrics instrumentation
// ---------------------------------------------------------------------------

describe('processPublishingJob — metrics integration', () => {
  it('increments publishedTotal on success', async () => {
    const svc = new WorkerMetricsService();
    const deps: PublishingProcessorDeps = {
      metricsService: svc,
      createOrchestrator: () =>
        ({
          publish: async () => ({
            success: true,
            media: { externalId: 'media-1', url: 'https://example.com/media/1' },
            post: { externalId: 'post-1', url: 'https://example.com/posts/1' },
          }),
        }) as never,
    };
    await processPublishingJob(makePayload(), deps);
    expect(svc.snapshot().publishedTotal).toBe(1);
    expect(svc.snapshot().processedTotal).toBe(1);
  });

  it('increments failuresTotal on failure (not skipped)', async () => {
    const svc = new WorkerMetricsService();
    const deps: PublishingProcessorDeps = {
      metricsService: svc,
      createOrchestrator: () =>
        ({
          publish: async () => ({
            success: false,
            message: 'Upstream error',
          }),
        }) as never,
    };
    await processPublishingJob(makePayload(), deps);
    expect(svc.snapshot().failuresTotal).toBe(1);
    expect(svc.snapshot().publishedTotal).toBe(0);
    expect(svc.snapshot().processedTotal).toBe(1);
  });

  it('increments duplicateSkipsTotal when duplicate detected', async () => {
    const svc = new WorkerMetricsService();
    const mockRepo = {
      findDuplicate: async () => ({ id: 'existing-rec' }),
      create: async () => ({ id: 'new-rec' }),
    };
    const deps: PublishingProcessorDeps = {
      metricsService: svc,
      publishedContentRepo: mockRepo as never,
    };
    await processPublishingJob(makePayload({ slug: 'duplicate-slug' }), deps);
    expect(svc.snapshot().duplicateSkipsTotal).toBe(1);
    expect(svc.snapshot().publishedTotal).toBe(0);
    expect(svc.snapshot().processedTotal).toBe(0);
  });

  it('does not increment any counter when metricsService is absent', async () => {
    const deps: PublishingProcessorDeps = {
      createOrchestrator: () =>
        ({
          publish: async () => ({ success: true }),
        }) as never,
    };
    // Should not throw.
    await expect(processPublishingJob(makePayload(), deps)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Scheduler counter (computeScheduleDelay used as proxy)
// ---------------------------------------------------------------------------

describe('scheduler counter — delay detection', () => {
  it('computeScheduleDelay returns 0 for absent scheduledFor', () => {
    expect(computeScheduleDelay(undefined)).toBe(0);
  });

  it('computeScheduleDelay returns 0 for past datetime', () => {
    expect(computeScheduleDelay('2020-01-01T00:00:00.000Z')).toBe(0);
  });

  it('computeScheduleDelay returns positive ms for future datetime', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(computeScheduleDelay(future)).toBeGreaterThan(0);
  });
});
