import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardApp } from '../app.js';
import type { DashboardApiClient } from '../client.js';
import type { JobDetail, JobListResult, QueueActionResult } from '../types.js';

const jobList: JobListResult = {
  jobs: [
    {
      id: 'job-001',
      name: 'publish',
      status: 'failed',
      publisher: 'mock',
      projectId: 'proj-abc',
      assetId: 'asset-xyz',
      title: 'Test Article',
      slug: 'test-article',
      retryCount: 2,
      maxAttempts: 4,
      createdAt: '2024-06-01T10:00:00.000Z',
      updatedAt: '2024-06-01T10:05:00.000Z',
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

const jobDetail: JobDetail = {
  ...jobList.jobs[0]!,
  payload: {
    title: 'Test Article',
    slug: 'test-article',
    projectId: 'proj-abc',
    assetId: 'asset-xyz',
    hasMedia: true,
  },
  queueState: 'failed',
  retryHistory: [{ attempt: 1, error: 'timeout' }],
  queuePaused: false,
  error: { message: 'Failed to publish' },
};

function makeMockClient(): DashboardApiClient {
  const noop = async (): Promise<QueueActionResult> => ({ ok: true, status: 200, message: 'OK' });
  return {
    fetchHealth: async () => null,
    fetchSummary: async () => null,
    fetchRecent: async () => null,
    fetchMetrics: async () => null,
    fetchQueueStatus: async () => null,
    pauseQueue: noop,
    resumeQueue: noop,
    drainQueue: noop,
    retryJob: async (id) => ({ ok: true, status: 200, message: `Retried ${id}` }),
    removeJob: async (id) => ({ ok: true, status: 200, message: `Removed ${id}` }),
    fetchPublishers: async () => [],
    fetchPublisherDetail: async () => null,
    fetchPublisherHealth: async () => null,
    fetchJobs: async () => jobList,
    fetchJob: async (id) => (id === 'job-001' ? jobDetail : null),
    fetchAssets: async () => ({ assets: [], total: 0, limit: 50, offset: 0 }),
    fetchAsset: async () => null,
  };
}

describe('GET /jobs', () => {
  let app: ReturnType<typeof buildDashboardApp>;

  beforeEach(async () => {
    app = buildDashboardApp({ client: makeMockClient(), apiKeyConfigured: true });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('renders jobs page', async () => {
    const res = await app.inject({ method: 'GET', url: '/jobs' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Publishing Jobs');
    expect(res.body).toContain('data-testid="jobs-table"');
  });
});

describe('GET /jobs/:id', () => {
  let app: ReturnType<typeof buildDashboardApp>;

  beforeEach(async () => {
    app = buildDashboardApp({ client: makeMockClient(), apiKeyConfigured: true });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('renders job detail page', async () => {
    const res = await app.inject({ method: 'GET', url: '/jobs/job-001' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('data-testid="job-detail-section"');
    expect(res.body).toContain('data-testid="job-retry-form"');
  });
});

describe('POST /ops/jobs/:id/retry', () => {
  let app: ReturnType<typeof buildDashboardApp>;

  beforeEach(async () => {
    app = buildDashboardApp({ client: makeMockClient(), apiKeyConfigured: true });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('redirects with flash to job detail', async () => {
    const res = await app.inject({ method: 'POST', url: '/ops/jobs/job-001/retry' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('/jobs/job-001?flash=');
    const page = await app.inject({ method: 'GET', url: res.headers.location ?? '' });
    expect(page.body).toContain('Retried job-001');
  });
});
