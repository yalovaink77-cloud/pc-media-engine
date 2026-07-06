import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardApp } from '../app.js';
import type { DashboardApiClient } from '../client.js';
import type { DashboardHealthData, DashboardRecentData, DashboardSummaryData } from '../types.js';

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

function makeFullClient(overrides: Partial<DashboardApiClient> = {}): DashboardApiClient {
  return {
    fetchHealth: async () => healthFixture,
    fetchSummary: async () => summaryFixture,
    fetchRecent: async () => recentFixture,
    fetchMetrics: async () => metricsFixture,
    ...overrides,
  };
}

function makeErrorClient(): DashboardApiClient {
  return {
    fetchHealth: async () => null,
    fetchSummary: async () => null,
    fetchRecent: async () => null,
    fetchMetrics: async () => null,
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
