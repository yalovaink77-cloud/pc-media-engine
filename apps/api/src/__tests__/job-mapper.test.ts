import { describe, expect, it } from 'vitest';

import { mapJobToDetail, mapJobToListItem, sanitizePayload } from '../queue/job-mapper.js';

describe('sanitizePayload', () => {
  it('strips media blobs from payload', () => {
    const summary = sanitizePayload({
      title: 'Hello',
      slug: 'hello',
      mediaBuffer: 'base64data',
      projectId: 'p1',
    });
    expect(summary.hasMedia).toBe(true);
    expect(summary.title).toBe('Hello');
    expect(summary.projectId).toBe('p1');
    expect(summary).not.toHaveProperty('mediaBuffer');
  });
});

describe('mapJobToListItem', () => {
  it('maps BullMQ job fields', async () => {
    const job = {
      id: 'job-42',
      name: 'publish',
      data: { title: 'Post', slug: 'post', projectId: 'proj-1' },
      opts: { attempts: 4 },
      attemptsMade: 2,
      timestamp: Date.parse('2024-06-01T10:00:00.000Z'),
      processedOn: Date.parse('2024-06-01T10:01:00.000Z'),
      finishedOn: undefined,
    };

    const item = await mapJobToListItem(job as never, 'failed', 'mock');
    expect(item.id).toBe('job-42');
    expect(item.publisher).toBe('mock');
    expect(item.retryCount).toBe(2);
    expect(item.maxAttempts).toBe(4);
    expect(item.status).toBe('failed');
  });
});

describe('mapJobToDetail', () => {
  it('includes error and retry history', async () => {
    const job = {
      id: 'job-99',
      name: 'publish',
      data: { title: 'Fail', slug: 'fail', mediaData: 'x' },
      opts: { attempts: 3 },
      attemptsMade: 2,
      timestamp: Date.parse('2024-06-01T10:00:00.000Z'),
      failedReason: 'Connection timeout',
      stacktrace: ['Error: timeout', 'Error: refused'],
      delay: 0,
    };

    const detail = await mapJobToDetail(job as never, 'failed', 'wordpress', false);
    expect(detail.error?.message).toBe('Connection timeout');
    expect(detail.retryHistory.length).toBeGreaterThan(0);
    expect(detail.queuePaused).toBe(false);
    expect(detail.payload.hasMedia).toBe(true);
  });
});
