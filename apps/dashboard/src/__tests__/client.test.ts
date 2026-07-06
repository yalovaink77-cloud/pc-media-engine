/**
 * Dashboard API client tests — Sprint 36 queue operations.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDashboardApiClient } from '../client.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createDashboardApiClient — queue operations', () => {
  it('pauseQueue calls POST /queue/pause with API key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, message: 'Queue paused' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const client = createDashboardApiClient('http://api.test', 'test-key');
    const result = await client.pauseQueue();

    expect(result.ok).toBe(true);
    expect(result.message).toBe('Queue paused');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/queue/pause',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'test-key' }),
      }),
    );
  });

  it('resumeQueue calls POST /queue/resume', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, message: 'Queue resumed' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const client = createDashboardApiClient('http://api.test');
    const result = await client.resumeQueue();
    expect(result.ok).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/queue/resume');
  });

  it('drainQueue calls POST /queue/drain', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, message: 'Queue drained' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const client = createDashboardApiClient('http://api.test');
    const result = await client.drainQueue();
    expect(result.ok).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/queue/drain');
  });

  it('retryJob calls POST /queue/jobs/:id/retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: 'Job job-1 queued for retry' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createDashboardApiClient('http://api.test');
    const result = await client.retryJob('job-1');
    expect(result.ok).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/queue/jobs/job-1/retry');
  });

  it('removeJob calls DELETE /queue/jobs/:id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: 'Job job-2 removed' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createDashboardApiClient('http://api.test');
    const result = await client.removeJob('job-2');
    expect(result.ok).toBe(true);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/queue/jobs/job-2');
  });

  it('maps 401 to clear unauthorized message', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createDashboardApiClient('http://api.test');
    const result = await client.pauseQueue();
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.message).toContain('DASHBOARD_API_KEY');
  });

  it('handles network errors gracefully', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);

    const client = createDashboardApiClient('http://api.test');
    const result = await client.drainQueue();
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.message).toContain('fetch failed');
  });
});

describe('createDashboardApiClient — publisher management', () => {
  it('fetchPublishers calls GET /publishers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          publishers: [
            { id: 'wordpress', displayName: 'WordPress', version: '1.0.0', enabled: true },
          ],
          count: 1,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createDashboardApiClient('http://api.test');
    const publishers = await client.fetchPublishers();
    expect(publishers).toHaveLength(1);
    expect(publishers?.[0]?.id).toBe('wordpress');
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://api.test/publishers');
  });

  it('fetchPublisherDetail calls GET /publishers/:id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'ghost', displayName: 'Ghost' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const client = createDashboardApiClient('http://api.test');
    const detail = await client.fetchPublisherDetail('ghost');
    expect(detail?.id).toBe('ghost');
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://api.test/publishers/ghost');
  });

  it('fetchPublisherHealth calls GET /publishers/:id/health', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ healthy: true, latency: 30, message: 'Connected' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createDashboardApiClient('http://api.test');
    const health = await client.fetchPublisherHealth('wordpress');
    expect(health?.healthy).toBe(true);
    expect(health?.latency).toBe(30);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'http://api.test/publishers/wordpress/health',
    );
  });

  it('returns null when publisher endpoints fail', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('error', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createDashboardApiClient('http://api.test');
    expect(await client.fetchPublishers()).toBeNull();
    expect(await client.fetchPublisherDetail('x')).toBeNull();
    expect(await client.fetchPublisherHealth('x')).toBeNull();
  });
});

describe('createDashboardApiClient — publishing jobs', () => {
  it('fetchJobs calls GET /jobs with filters', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ jobs: [], total: 0, limit: 10, offset: 0 }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const client = createDashboardApiClient('http://api.test', 'key');
    await client.fetchJobs({ status: 'failed', limit: 10 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'http://api.test/jobs?status=failed&limit=10',
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers?.['x-api-key']).toBe('key');
  });

  it('fetchJob calls GET /jobs/:id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'job-1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createDashboardApiClient('http://api.test');
    await client.fetchJob('job-1');
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://api.test/jobs/job-1');
  });
});
