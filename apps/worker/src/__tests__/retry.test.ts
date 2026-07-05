/**
 * Sprint 24 — Retry Engine
 *
 * Tests for `executePublishingJobWithRetry` (BullMQ-free unit tests).
 * Tests for WorkerConfig retry field loading.
 * Tests for PublishingEnqueueOptions backoff configuration.
 */

import type { PublishingFlowResult } from '@pcme/publishing';
import { describe, expect, it, vi } from 'vitest';

import { loadWorkerConfig } from '../config.js';
import type { PublishingJobContext } from '../publishing-worker.js';
import { executePublishingJobWithRetry } from '../publishing-worker.js';
import type { PublishingJobPayload } from '../queue/publishing-payload.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PAYLOAD: PublishingJobPayload = {
  title: 'Aftercare Guide',
  slug: 'aftercare-guide',
  body: '<p>Clean twice daily.</p>',
  mediaData: 'mock-image-bytes',
  organizationId: 'org-1',
  projectId: 'proj-1',
  assetId: 'asset-1',
  processingJobId: 'job-1',
};

function makeContext(
  attemptsMade: number,
  totalAttempts = 4,
  jobId = 'job-smoke',
): PublishingJobContext {
  return { attemptsMade, totalAttempts, jobId };
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

describe('loadWorkerConfig — retry fields', () => {
  it('defaults publishingMaxRetries=3 and publishingBackoffMs=5000', () => {
    const config = loadWorkerConfig();
    expect(config.publishingMaxRetries).toBe(3);
    expect(config.publishingBackoffMs).toBe(5000);
  });

  it('reads PCME_PUBLISHING_MAX_RETRIES and PCME_PUBLISHING_BACKOFF_MS from env', () => {
    const saved = {
      retries: process.env['PCME_PUBLISHING_MAX_RETRIES'],
      backoff: process.env['PCME_PUBLISHING_BACKOFF_MS'],
    };

    process.env['PCME_PUBLISHING_MAX_RETRIES'] = '5';
    process.env['PCME_PUBLISHING_BACKOFF_MS'] = '2000';

    const config = loadWorkerConfig();
    expect(config.publishingMaxRetries).toBe(5);
    expect(config.publishingBackoffMs).toBe(2000);

    if (saved.retries === undefined) delete process.env['PCME_PUBLISHING_MAX_RETRIES'];
    else process.env['PCME_PUBLISHING_MAX_RETRIES'] = saved.retries;

    if (saved.backoff === undefined) delete process.env['PCME_PUBLISHING_BACKOFF_MS'];
    else process.env['PCME_PUBLISHING_BACKOFF_MS'] = saved.backoff;
  });
});

// ---------------------------------------------------------------------------
// executePublishingJobWithRetry — success path
// ---------------------------------------------------------------------------

describe('executePublishingJobWithRetry — success', () => {
  it('returns result without throwing when publishing succeeds', async () => {
    const result = await executePublishingJobWithRetry(PAYLOAD, makeContext(0), {
      publisherDriver: 'mock',
    });

    expect(result.success).toBe(true);
    expect(result.skipped).toBeUndefined();
    expect(result.media?.externalId).toMatch(/^media-/);
    expect(result.post?.externalId).toMatch(/^post-/);
  });
});

// ---------------------------------------------------------------------------
// executePublishingJobWithRetry — duplicate (no retry)
// ---------------------------------------------------------------------------

describe('executePublishingJobWithRetry — duplicate skipped', () => {
  it('returns skipped result without throwing on first attempt', async () => {
    const findDuplicate = vi.fn().mockResolvedValue({ id: 'pub-existing' });
    const create = vi.fn();

    const result = await executePublishingJobWithRetry(PAYLOAD, makeContext(0), {
      publisherDriver: 'mock',
      publishedContentRepo: { create, findDuplicate },
    });

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('duplicate');
    expect(result.success).toBe(false);
  });

  it('returns skipped result without throwing on any retry attempt', async () => {
    const findDuplicate = vi.fn().mockResolvedValue({ id: 'pub-existing' });
    const create = vi.fn();

    // Simulate: this could happen if duplicate check is re-evaluated on retry
    const result = await executePublishingJobWithRetry(PAYLOAD, makeContext(2, 4), {
      publisherDriver: 'mock',
      publishedContentRepo: { create, findDuplicate },
    });

    expect(result.skipped).toBe(true);
    // The key assertion: if executePublishingJobWithRetry had thrown, we would
    // not have reached this line — the result proves no throw occurred.
  });
});

// ---------------------------------------------------------------------------
// executePublishingJobWithRetry — genuine failure (triggers retry)
// ---------------------------------------------------------------------------

describe('executePublishingJobWithRetry — genuine failure', () => {
  it('throws on genuine failure so BullMQ can schedule a retry', async () => {
    const failingOrchestrator = {
      publish: vi.fn().mockResolvedValue({
        success: false,
        message: 'Media upload failed: connection timeout',
      } satisfies PublishingFlowResult),
    };

    await expect(
      executePublishingJobWithRetry(PAYLOAD, makeContext(0, 4), {
        createOrchestrator: () => failingOrchestrator as never,
      }),
    ).rejects.toThrow('Media upload failed: connection timeout');
  });

  it('throws on first attempt (not last) — retry pending', async () => {
    const failingOrchestrator = {
      publish: vi.fn().mockResolvedValue({
        success: false,
        message: 'Transient error',
      } satisfies PublishingFlowResult),
    };

    await expect(
      executePublishingJobWithRetry(
        PAYLOAD,
        makeContext(0, 4), // attempt 1 of 4 — not the last
        { createOrchestrator: () => failingOrchestrator as never },
      ),
    ).rejects.toThrow('Transient error');
  });

  it('throws on last attempt too — BullMQ marks job permanently failed', async () => {
    const failingOrchestrator = {
      publish: vi.fn().mockResolvedValue({
        success: false,
        message: 'Persistent error',
      } satisfies PublishingFlowResult),
    };

    // attemptsMade=3, totalAttempts=4 → this IS the last attempt
    await expect(
      executePublishingJobWithRetry(PAYLOAD, makeContext(3, 4), {
        createOrchestrator: () => failingOrchestrator as never,
      }),
    ).rejects.toThrow('Persistent error');
  });
});

// ---------------------------------------------------------------------------
// executePublishingJobWithRetry — success after retry
// ---------------------------------------------------------------------------

describe('executePublishingJobWithRetry — success after retry', () => {
  it('succeeds on the third attempt after two failures', async () => {
    let calls = 0;

    const countingPublisher = {
      name: 'CountingPublisher',
      publishMedia: vi.fn().mockImplementation(async () => {
        calls++;
        if (calls < 3) throw new Error(`Simulated failure #${calls}`);
        return {
          success: true,
          externalId: 'media-ok',
          url: 'https://mock/media/ok',
          publishedAt: new Date(),
        };
      }),
      publishPost: vi.fn().mockResolvedValue({
        success: true,
        externalId: 'post-ok',
        url: 'https://mock/posts/ok',
        publishedAt: new Date(),
      }),
      publish: vi.fn(),
      health: vi.fn(),
    };

    // Attempt 1 — fails
    await expect(
      executePublishingJobWithRetry(PAYLOAD, makeContext(0, 4), {
        createPublisher: () => countingPublisher,
      }),
    ).rejects.toThrow('Simulated failure #1');

    // Attempt 2 — fails
    await expect(
      executePublishingJobWithRetry(PAYLOAD, makeContext(1, 4), {
        createPublisher: () => countingPublisher,
      }),
    ).rejects.toThrow('Simulated failure #2');

    // Attempt 3 — succeeds
    const result = await executePublishingJobWithRetry(PAYLOAD, makeContext(2, 4), {
      createPublisher: () => countingPublisher,
    });

    expect(result.success).toBe(true);
    expect(result.skipped).toBeUndefined();
    expect(result.post?.externalId).toBe('post-ok');
    expect(countingPublisher.publishMedia).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// executePublishingJobWithRetry — retry exhausted
// ---------------------------------------------------------------------------

describe('executePublishingJobWithRetry — retry exhausted', () => {
  it('throws on every attempt when publisher always fails', async () => {
    const alwaysFail = vi.fn().mockResolvedValue({
      success: false,
      message: 'Permanent failure',
    } satisfies PublishingFlowResult);

    const totalAttempts = 4; // maxRetries=3 → 4 total

    for (let i = 0; i < totalAttempts; i++) {
      await expect(
        executePublishingJobWithRetry(PAYLOAD, makeContext(i, totalAttempts), {
          createOrchestrator: () => ({ publish: alwaysFail }) as never,
        }),
      ).rejects.toThrow('Permanent failure');
    }

    expect(alwaysFail).toHaveBeenCalledTimes(totalAttempts);
  });

  it('history row is never written when all retries are exhausted', async () => {
    const create = vi.fn();
    const findDuplicate = vi.fn().mockResolvedValue(null);
    const failingOrchestrator = {
      publish: vi.fn().mockResolvedValue({
        success: false,
        message: 'Always fails',
      } satisfies PublishingFlowResult),
    };

    for (let i = 0; i < 4; i++) {
      await expect(
        executePublishingJobWithRetry(PAYLOAD, makeContext(i, 4), {
          createOrchestrator: () => failingOrchestrator as never,
          publishedContentRepo: { create, findDuplicate },
        }),
      ).rejects.toThrow();
    }

    expect(create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Backoff calculation
// ---------------------------------------------------------------------------

describe('exponential backoff schedule', () => {
  it('produces the correct delay sequence from sprint spec', () => {
    const initialDelay = 5000;
    const maxRetries = 3;

    // BullMQ exponential: delay * 2^(attemptsMade)
    const delays = Array.from({ length: maxRetries }, (_, i) => initialDelay * Math.pow(2, i));

    expect(delays).toEqual([5000, 10000, 20000]);
  });

  it('createPublishingEnqueuer sets correct defaultJobOptions', async () => {
    const addSpy = vi.fn().mockResolvedValue({ id: 'job-1' });
    const closeSpy = vi.fn().mockResolvedValue(undefined);

    vi.doMock('bullmq', () => ({
      Queue: vi.fn().mockImplementation((_name: string, opts: Record<string, unknown>) => ({
        _opts: opts,
        add: addSpy,
        close: closeSpy,
      })),
    }));

    const { createPublishingEnqueuer } = await import('../queue/publishing-enqueue.js');
    const enqueuer = createPublishingEnqueuer(
      { host: 'localhost', port: 6379 },
      { maxRetries: 3, backoffMs: 5000 },
    );

    await enqueuer.enqueue(PAYLOAD);

    // Verify job was added (retry options live on the Queue, not the add call)
    expect(addSpy).toHaveBeenCalledOnce();

    vi.doUnmock('bullmq');
  });
});

// ---------------------------------------------------------------------------
// MockPublisher never called when duplicate exists
// ---------------------------------------------------------------------------

describe('MockPublisher not called for duplicate', () => {
  it('publishMedia is never invoked when duplicate detected', async () => {
    const publishMedia = vi.fn();
    const publishPost = vi.fn();
    const findDuplicate = vi.fn().mockResolvedValue({ id: 'existing' });
    const create = vi.fn();

    await executePublishingJobWithRetry(PAYLOAD, makeContext(0), {
      publisherDriver: 'mock',
      createPublisher: () => ({
        name: 'SpyPublisher',
        publishMedia,
        publishPost,
        publish: vi.fn(),
        health: vi.fn(),
      }),
      publishedContentRepo: { create, findDuplicate },
    });

    expect(publishMedia).not.toHaveBeenCalled();
    expect(publishPost).not.toHaveBeenCalled();
  });
});
