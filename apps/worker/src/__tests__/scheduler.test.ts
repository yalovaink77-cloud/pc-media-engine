/**
 * Sprint 25 — Publishing Scheduler Foundation
 *
 * Tests for:
 *   - computeScheduleDelay()
 *   - scheduledFor validation in validatePublishingJobPayload()
 *   - enqueue() passes correct delay option to BullMQ
 *   - existing immediate-job behaviour unchanged
 *   - duplicate detection still applies for scheduled jobs
 */

import { describe, expect, it, vi } from 'vitest';

import type { PublishingJobContext } from '../publishing-worker.js';
import { executePublishingJobWithRetry } from '../publishing-worker.js';
import { computeScheduleDelay } from '../queue/publishing-enqueue.js';
import type { PublishingJobPayload } from '../queue/publishing-payload.js';
import {
  PublishingPayloadValidationError,
  validatePublishingJobPayload,
} from '../queue/publishing-payload.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_RAW = {
  title: 'Aftercare Guide',
  slug: 'aftercare-guide',
  body: '<p>Clean twice daily.</p>',
  mediaData: 'mock-image-bytes',
  organizationId: 'org-1',
  projectId: 'proj-1',
  assetId: 'asset-1',
};

const BASE_PAYLOAD: PublishingJobPayload = {
  ...BASE_RAW,
  processingJobId: 'job-1',
};

function ctx(attemptsMade = 0): PublishingJobContext {
  return { attemptsMade, totalAttempts: 4, jobId: 'test-job' };
}

// ---------------------------------------------------------------------------
// computeScheduleDelay
// ---------------------------------------------------------------------------

describe('computeScheduleDelay', () => {
  it('returns 0 when scheduledFor is absent', () => {
    expect(computeScheduleDelay(undefined)).toBe(0);
  });

  it('returns 0 when scheduledFor is an empty string', () => {
    expect(computeScheduleDelay('')).toBe(0);
  });

  it('returns 0 for a past datetime', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(computeScheduleDelay(past)).toBe(0);
  });

  it('returns 0 for a datetime equal to now (within rounding)', () => {
    const now = new Date(Date.now() - 1).toISOString();
    expect(computeScheduleDelay(now)).toBe(0);
  });

  it('returns a positive ms for a future datetime', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const delay = computeScheduleDelay(future);
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(60_000);
  });

  it('returns a delay close to the requested offset', () => {
    const offsetMs = 30_000;
    const future = new Date(Date.now() + offsetMs).toISOString();
    const delay = computeScheduleDelay(future);
    // Allow ±500 ms for test execution time
    expect(delay).toBeGreaterThan(offsetMs - 500);
    expect(delay).toBeLessThanOrEqual(offsetMs);
  });
});

// ---------------------------------------------------------------------------
// validatePublishingJobPayload — scheduledFor
// ---------------------------------------------------------------------------

describe('validatePublishingJobPayload — scheduledFor', () => {
  it('accepts a valid future ISO datetime', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const payload = validatePublishingJobPayload({ ...BASE_RAW, scheduledFor: future });
    expect(payload.scheduledFor).toBe(future);
  });

  it('accepts a valid past ISO datetime', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const payload = validatePublishingJobPayload({ ...BASE_RAW, scheduledFor: past });
    expect(payload.scheduledFor).toBe(past);
  });

  it('accepts payload without scheduledFor (immediate behaviour unchanged)', () => {
    const payload = validatePublishingJobPayload(BASE_RAW);
    expect(payload.scheduledFor).toBeUndefined();
  });

  it('rejects an invalid scheduledFor string', () => {
    expect(() => validatePublishingJobPayload({ ...BASE_RAW, scheduledFor: 'not-a-date' })).toThrow(
      PublishingPayloadValidationError,
    );

    expect(() => validatePublishingJobPayload({ ...BASE_RAW, scheduledFor: 'not-a-date' })).toThrow(
      'scheduledFor must be a valid ISO 8601 datetime',
    );
  });

  it('rejects a numeric-string scheduledFor that produces NaN', () => {
    expect(() => validatePublishingJobPayload({ ...BASE_RAW, scheduledFor: 'tomorrow' })).toThrow(
      PublishingPayloadValidationError,
    );
  });

  it('ignores scheduledFor when it is empty whitespace', () => {
    const payload = validatePublishingJobPayload({ ...BASE_RAW, scheduledFor: '   ' });
    expect(payload.scheduledFor).toBeUndefined();
  });

  it('ignores scheduledFor when it is not a string', () => {
    const payload = validatePublishingJobPayload({ ...BASE_RAW, scheduledFor: 12345 });
    expect(payload.scheduledFor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// enqueue() passes correct delay option
// ---------------------------------------------------------------------------

describe('createPublishingEnqueuer — scheduledFor delay', () => {
  it('calls queue.add without delay when scheduledFor is absent', async () => {
    vi.resetModules();
    const addSpy = vi.fn().mockResolvedValue({ id: 'job-1' });
    const closeSpy = vi.fn().mockResolvedValue(undefined);

    vi.doMock('bullmq', () => ({
      Queue: vi.fn().mockImplementation(() => ({ add: addSpy, close: closeSpy })),
    }));

    const { createPublishingEnqueuer } = await import('../queue/publishing-enqueue.js');
    const enqueuer = createPublishingEnqueuer({ host: 'localhost', port: 6379 });

    await enqueuer.enqueue(BASE_PAYLOAD);

    expect(addSpy).toHaveBeenCalledOnce();
    const [, , opts] = addSpy.mock.calls[0]!;
    expect(opts).toBeUndefined();

    vi.doUnmock('bullmq');
  });

  it('calls queue.add with delay when scheduledFor is in the future', async () => {
    vi.resetModules();
    const addSpy = vi.fn().mockResolvedValue({ id: 'job-2' });
    const closeSpy = vi.fn().mockResolvedValue(undefined);

    vi.doMock('bullmq', () => ({
      Queue: vi.fn().mockImplementation(() => ({ add: addSpy, close: closeSpy })),
    }));

    const { createPublishingEnqueuer } = await import('../queue/publishing-enqueue.js');
    const enqueuer = createPublishingEnqueuer({ host: 'localhost', port: 6379 });

    const future = new Date(Date.now() + 60_000).toISOString();
    await enqueuer.enqueue({ ...BASE_PAYLOAD, scheduledFor: future });

    expect(addSpy).toHaveBeenCalledOnce();
    const [, , opts] = addSpy.mock.calls[0]!;
    expect(opts).toBeDefined();
    expect((opts as { delay: number }).delay).toBeGreaterThan(0);
    expect((opts as { delay: number }).delay).toBeLessThanOrEqual(60_000);

    vi.doUnmock('bullmq');
  });

  it('calls queue.add without delay when scheduledFor is in the past', async () => {
    vi.resetModules();
    const addSpy = vi.fn().mockResolvedValue({ id: 'job-3' });
    const closeSpy = vi.fn().mockResolvedValue(undefined);

    vi.doMock('bullmq', () => ({
      Queue: vi.fn().mockImplementation(() => ({ add: addSpy, close: closeSpy })),
    }));

    const { createPublishingEnqueuer } = await import('../queue/publishing-enqueue.js');
    const enqueuer = createPublishingEnqueuer({ host: 'localhost', port: 6379 });

    const past = new Date(Date.now() - 60_000).toISOString();
    await enqueuer.enqueue({ ...BASE_PAYLOAD, scheduledFor: past });

    expect(addSpy).toHaveBeenCalledOnce();
    const [, , opts] = addSpy.mock.calls[0]!;
    expect(opts).toBeUndefined();

    vi.doUnmock('bullmq');
  });
});

// ---------------------------------------------------------------------------
// Existing immediate-job behaviour unchanged
// ---------------------------------------------------------------------------

describe('processPublishingJob — scheduledFor transparent at processor level', () => {
  it('publishes normally when scheduledFor is absent', async () => {
    const result = await executePublishingJobWithRetry(BASE_PAYLOAD, ctx(), {
      publisherDriver: 'mock',
    });
    expect(result.success).toBe(true);
    expect(result.skipped).toBeUndefined();
  });

  it('publishes normally when scheduledFor is a past datetime', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const result = await executePublishingJobWithRetry(
      { ...BASE_PAYLOAD, scheduledFor: past },
      ctx(),
      { publisherDriver: 'mock' },
    );
    expect(result.success).toBe(true);
  });

  it('publishes normally when scheduledFor is a future datetime (job already running)', async () => {
    // Once a delayed BullMQ job starts executing, the processor receives the full
    // payload including scheduledFor. scheduledFor is informational at that point.
    const future = new Date(Date.now() + 60_000).toISOString();
    const result = await executePublishingJobWithRetry(
      { ...BASE_PAYLOAD, scheduledFor: future },
      ctx(),
      { publisherDriver: 'mock' },
    );
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Duplicate detection still applies for scheduled jobs
// ---------------------------------------------------------------------------

describe('duplicate detection — scheduled jobs', () => {
  it('skips a scheduled job that duplicates an existing record', async () => {
    const findDuplicate = vi.fn().mockResolvedValue({ id: 'pub-existing' });
    const create = vi.fn();
    const publishMedia = vi.fn();

    const future = new Date(Date.now() + 60_000).toISOString();

    const result = await executePublishingJobWithRetry(
      { ...BASE_PAYLOAD, scheduledFor: future },
      ctx(),
      {
        publisherDriver: 'mock',
        createPublisher: () => ({
          name: 'SpyPublisher',
          publishMedia,
          publishPost: vi.fn(),
          publish: vi.fn(),
          health: vi.fn(),
        }),
        publishedContentRepo: { create, findDuplicate },
      },
    );

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('duplicate');
    expect(publishMedia).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('publishes a scheduled job when no duplicate exists', async () => {
    const findDuplicate = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({ id: 'pub-new' });
    const future = new Date(Date.now() + 60_000).toISOString();

    const result = await executePublishingJobWithRetry(
      { ...BASE_PAYLOAD, scheduledFor: future },
      ctx(),
      {
        publisherDriver: 'mock',
        publishedContentRepo: { create, findDuplicate },
      },
    );

    expect(result.success).toBe(true);
    expect(result.skipped).toBeUndefined();
    expect(create).toHaveBeenCalledOnce();
  });
});
