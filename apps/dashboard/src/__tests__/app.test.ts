import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardApp } from '../app.js';
import type { DashboardApiClient } from '../client.js';
import type {
  DashboardHealthData,
  DashboardRecentData,
  DashboardSummaryData,
  QueueActionResult,
} from '../types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW_ISO = '2024-06-01T12:00:00.000Z';

const healthFixture: DashboardHealthData = {
  status: 'ok',
  database: 'ok',
  publishing: {
    publisherDriver: 'mock',
    queueEnabled: false,
    retryConfig: { maxRetries: 3, backoffMs: 5000 },
  },
  version: '0.0.0-test',
  env: 'test',
};

const summaryFixture: DashboardSummaryData = {
  totalPublished: 10,
  totalDrafts: 1,
  totalFailed: 0,
  latestPublishedAt: NOW_ISO,
  publishers: [{ publisher: 'mock', count: 11 }],
  duplicateDetectionEnabled: true,
  schedulerEnabled: true,
  retryEnabled: true,
  aiProvider: 'none',
  publisherDriver: 'mock',
};

const recentFixture: DashboardRecentData = {
  items: [
    {
      id: 'rec-001',
      projectId: 'proj-abc',
      assetId: 'asset-xyz',
      publisher: 'mock',
      externalId: 'ext-1',
      url: 'https://example.com/posts/first',
      status: 'published',
      publishedAt: NOW_ISO,
      createdAt: NOW_ISO,
    },
  ],
  count: 1,
};

const metricsFixture = {
  uploadsTotal: 5,
  processedTotal: 4,
  publishedTotal: 3,
  retriesTotal: 1,
  failuresTotal: 0,
  duplicateSkipsTotal: 0,
  schedulerJobsTotal: 1,
  queueWaiting: 0,
  queueActive: 0,
  queueCompleted: 3,
  queueFailed: 0,
  collectedAt: NOW_ISO,
};

const queueFixture = {
  paused: false,
  waiting: 1,
  active: 0,
  delayed: 0,
  completed: 5,
  failed: 0,
};

const okAction = async (): Promise<QueueActionResult> => ({
  ok: true,
  status: 200,
  message: 'OK',
});

function makeFullClient(overrides: Partial<DashboardApiClient> = {}): DashboardApiClient {
  return {
    fetchHealth: async () => healthFixture,
    fetchSummary: async () => summaryFixture,
    fetchRecent: async () => recentFixture,
    fetchMetrics: async () => metricsFixture,
    fetchQueueStatus: async () => queueFixture,
    pauseQueue: okAction,
    resumeQueue: okAction,
    drainQueue: okAction,
    retryJob: async (jobId) => ({ ok: true, status: 200, message: `Retried ${jobId}` }),
    removeJob: async (jobId) => ({ ok: true, status: 200, message: `Removed ${jobId}` }),
    fetchPublishers: async () => [],
    fetchPublisherDetail: async () => null,
    fetchPublisherHealth: async () => null,
    fetchJobs: async () => ({ jobs: [], total: 0, limit: 50, offset: 0 }),
    fetchJob: async () => null,
    fetchAssets: async () => ({ assets: [], total: 0, limit: 50, offset: 0 }),
    fetchAsset: async () => null,
    fetchComposerAssets: async () => null,
    fetchComposerAsset: async () => null,
    validateComposer: async () => null,
    publishComposer: async () => null,
    bulkPublishComposer: async () => null,
    fetchCalendarEvents: async () => null,
    fetchCalendarTimeline: async () => null,
    fetchProviderConfigs: async () => null,
    fetchProviderConfig: async () => null,
    validateProviderConfig: async () => null,
    updateProviderConfig: async () => ({ ok: false, status: 0, detail: null, validation: null }),
    fetchActivity: async () => null,
    fetchActivityEvent: async () => null,
    ...overrides,
  };
}

function makeErrorClient(): DashboardApiClient {
  const failAction = async (): Promise<QueueActionResult> => ({
    ok: false,
    status: 401,
    message: 'Unauthorized — configure DASHBOARD_API_KEY',
  });
  return {
    fetchHealth: async () => null,
    fetchSummary: async () => null,
    fetchRecent: async () => null,
    fetchMetrics: async () => null,
    fetchQueueStatus: async () => null,
    pauseQueue: failAction,
    resumeQueue: failAction,
    drainQueue: failAction,
    retryJob: failAction,
    removeJob: failAction,
    fetchPublishers: async () => null,
    fetchPublisherDetail: async () => null,
    fetchPublisherHealth: async () => null,
    fetchJobs: async () => null,
    fetchJob: async () => null,
    fetchAssets: async () => null,
    fetchAsset: async () => null,
    fetchComposerAssets: async () => null,
    fetchComposerAsset: async () => null,
    validateComposer: async () => null,
    publishComposer: async () => null,
    bulkPublishComposer: async () => null,
    fetchCalendarEvents: async () => null,
    fetchCalendarTimeline: async () => null,
    fetchProviderConfigs: async () => null,
    fetchProviderConfig: async () => null,
    validateProviderConfig: async () => null,
    updateProviderConfig: async () => ({ ok: false, status: 0, detail: null, validation: null }),
    fetchActivity: async () => null,
    fetchActivityEvent: async () => null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let app: ReturnType<typeof buildDashboardApp>;

afterEach(async () => {
  await app.close();
});

describe('GET /', () => {
  beforeEach(() => {
    app = buildDashboardApp({ client: makeFullClient(), logLevel: 'silent' });
  });

  it('returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
  });

  it('returns HTML content-type', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('response body is a complete HTML document', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.body).toContain('<!DOCTYPE html>');
    expect(res.body).toContain('</html>');
  });

  it('includes summary statistics in the page', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.body).toContain('>10<');
  });

  it('includes recent item URL in the page', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.body).toContain('https://example.com/posts/first');
  });

  it('includes health publisher driver', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.body).toContain('mock');
  });

  it('sets cache-control: no-store', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('GET / — API error state', () => {
  beforeEach(() => {
    app = buildDashboardApp({ client: makeErrorClient(), logLevel: 'silent' });
  });

  it('still returns 200 (page renders even with API down)', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
  });

  it('shows error banner when all API calls fail', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.body).toContain('data-testid="error-banner"');
  });

  it('shows unavailable messages for each section', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.body).toContain('Health data unavailable');
    expect(res.body).toContain('Summary data unavailable');
    expect(res.body).toContain('Recent data unavailable');
  });
});

describe('GET / — empty recent list', () => {
  beforeEach(() => {
    app = buildDashboardApp({
      client: makeFullClient({ fetchRecent: async () => ({ items: [], count: 0 }) }),
      logLevel: 'silent',
    });
  });

  it('shows empty message when no recent items', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.body).toContain('No published content yet');
  });
});

describe('GET / — partial API failure', () => {
  it('renders page with available data when only summary fails', async () => {
    app = buildDashboardApp({
      client: makeFullClient({ fetchSummary: async () => null, fetchMetrics: async () => null }),
      logLevel: 'silent',
    });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('data-testid="health-cards"');
    expect(res.body).toContain('data-testid="summary-unavailable"');
    expect(res.body).toContain('data-testid="recent-table"');
  });
});

describe('GET / — operations panel', () => {
  beforeEach(() => {
    app = buildDashboardApp({ client: makeFullClient(), logLevel: 'silent' });
  });

  it('renders queue operations panel', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.body).toContain('data-testid="queue-operations-panel"');
  });
});

describe('POST /ops/queue/* — queue actions', () => {
  it('pause redirects with success flash', async () => {
    app = buildDashboardApp({
      client: makeFullClient({
        pauseQueue: async () => ({ ok: true, status: 200, message: 'Queue paused' }),
      }),
      logLevel: 'silent',
    });
    const res = await app.inject({ method: 'POST', url: '/ops/queue/pause' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('flash=Queue%20paused');
    expect(res.headers.location).toContain('flashType=ok');
  });

  it('resume redirects with success flash', async () => {
    app = buildDashboardApp({
      client: makeFullClient({
        resumeQueue: async () => ({ ok: true, status: 200, message: 'Queue resumed' }),
      }),
      logLevel: 'silent',
    });
    const res = await app.inject({ method: 'POST', url: '/ops/queue/resume' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('flashType=ok');
  });

  it('drain redirects with success flash', async () => {
    app = buildDashboardApp({
      client: makeFullClient({
        drainQueue: async () => ({ ok: true, status: 200, message: 'Queue drained' }),
      }),
      logLevel: 'silent',
    });
    const res = await app.inject({ method: 'POST', url: '/ops/queue/drain' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('flashType=ok');
  });

  it('retry job redirects with job id in flash', async () => {
    app = buildDashboardApp({ client: makeFullClient(), logLevel: 'silent' });
    const res = await app.inject({
      method: 'POST',
      url: '/ops/queue/retry',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'jobId=job-42',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('job-42');
  });

  it('remove job redirects on success', async () => {
    app = buildDashboardApp({ client: makeFullClient(), logLevel: 'silent' });
    const res = await app.inject({
      method: 'POST',
      url: '/ops/queue/remove',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'jobId=job-99',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('flashType=ok');
  });

  it('retry without job id shows validation error flash', async () => {
    app = buildDashboardApp({ client: makeFullClient(), logLevel: 'silent' });
    const res = await app.inject({
      method: 'POST',
      url: '/ops/queue/retry',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: '',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('flashType=err');
  });
});

describe('POST /ops/queue/* — unauthorized', () => {
  it('pause shows unauthorized flash when API returns 401', async () => {
    app = buildDashboardApp({ client: makeErrorClient(), logLevel: 'silent' });
    const res = await app.inject({ method: 'POST', url: '/ops/queue/pause' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('flashType=err');

    const page = await app.inject({
      method: 'GET',
      url: res.headers.location ?? '/',
    });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('Unauthorized');
    expect(page.body).toContain('data-testid="flash-banner"');
  });
});
