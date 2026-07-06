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
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
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
