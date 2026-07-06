/**
 * Offline smoke test for the Dashboard Web UI (Sprint 28).
 *
 * Builds the Fastify dashboard app with a static fixture client and checks
 * the HTML output via fastify.inject() — no network, no API server required.
 *
 * Run with:  pnpm --filter @pcme/dashboard smoke
 */
import { buildDashboardApp } from '../src/app.js';
import type { DashboardApiClient } from '../src/client.js';
import type {
  DashboardHealthData,
  DashboardRecentData,
  DashboardSummaryData,
} from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
}

function fail(label: string, detail?: unknown): never {
  console.error(`  ✗ ${label}`, detail ?? '');
  process.exit(1);
}

function assert(condition: boolean, label: string, detail?: unknown): void {
  if (!condition) fail(label, detail);
  pass(label);
}

// ---------------------------------------------------------------------------
// Fixture client
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
  version: '0.0.0-smoke',
  env: 'test',
};

const summaryFixture: DashboardSummaryData = {
  totalPublished: 42,
  totalDrafts: 3,
  totalFailed: 1,
  latestPublishedAt: NOW_ISO,
  publishers: [
    { publisher: 'mock', count: 30 },
    { publisher: 'wordpress', count: 16 },
  ],
  duplicateDetectionEnabled: true,
  schedulerEnabled: true,
  retryEnabled: true,
  aiProvider: 'openrouter',
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
      url: 'https://example.com/posts/first-article',
      status: 'published',
      publishedAt: NOW_ISO,
      createdAt: NOW_ISO,
    },
    {
      id: 'rec-002',
      projectId: 'proj-abc',
      assetId: 'asset-def',
      publisher: 'wordpress',
      externalId: 'ext-2',
      url: 'https://example.com/posts/second-article',
      status: 'published',
      publishedAt: NOW_ISO,
      createdAt: NOW_ISO,
    },
  ],
  count: 2,
};

const metricsFixture = {
  uploadsTotal: 15,
  processedTotal: 12,
  publishedTotal: 10,
  retriesTotal: 2,
  failuresTotal: 1,
  duplicateSkipsTotal: 3,
  schedulerJobsTotal: 4,
  queueWaiting: 0,
  queueActive: 1,
  queueCompleted: 10,
  queueFailed: 1,
  collectedAt: new Date().toISOString(),
};

function makeFixtureClient(): DashboardApiClient {
  const noop = async () => ({ ok: true, status: 200, message: 'OK' });
  return {
    fetchHealth: async () => healthFixture,
    fetchSummary: async () => summaryFixture,
    fetchRecent: async () => recentFixture,
    fetchMetrics: async () => metricsFixture,
    fetchQueueStatus: async () => null,
    pauseQueue: noop,
    resumeQueue: noop,
    drainQueue: noop,
    retryJob: noop,
    removeJob: noop,
    fetchPublishers: async () => [],
    fetchPublisherDetail: async () => null,
    fetchPublisherHealth: async () => null,
    fetchJobs: async () => [],
    fetchJob: async () => null,
  };
}

function makeErrorClient(): DashboardApiClient {
  const fail = async () => ({ ok: false, status: 401, message: 'Unauthorized' });
  return {
    fetchHealth: async () => null,
    fetchSummary: async () => null,
    fetchRecent: async () => null,
    fetchMetrics: async () => null,
    fetchQueueStatus: async () => null,
    pauseQueue: fail,
    resumeQueue: fail,
    drainQueue: fail,
    retryJob: fail,
    removeJob: fail,
    fetchPublishers: async () => null,
    fetchPublisherDetail: async () => null,
    fetchPublisherHealth: async () => null,
    fetchJobs: async () => null,
    fetchJob: async () => null,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // -----------------------------------------------------------------------
  console.log('\n[1] GET / — full data');
  {
    const app = buildDashboardApp({ client: makeFixtureClient(), logLevel: 'silent' });
    try {
      const res = await app.inject({ method: 'GET', url: '/' });
      assert(res.statusCode === 200, `status 200 (got ${res.statusCode})`);
      assert(
        res.headers['content-type']?.includes('text/html') === true,
        'content-type: text/html',
      );
      assert(res.headers['cache-control'] === 'no-store', 'cache-control: no-store');
      assert(res.body.includes('<!DOCTYPE html>'), 'is valid HTML document');
      assert(res.body.includes('PC Media Engine'), 'includes app title');
    } finally {
      await app.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[2] Summary cards rendered');
  {
    const app = buildDashboardApp({ client: makeFixtureClient(), logLevel: 'silent' });
    try {
      const res = await app.inject({ method: 'GET', url: '/' });
      assert(res.body.includes('data-testid="summary-cards"'), 'summary cards present');
      assert(res.body.includes('>42<'), 'totalPublished = 42');
      assert(res.body.includes('>3<'), 'totalDrafts = 3');
      assert(res.body.includes('>1<'), 'totalFailed = 1');
    } finally {
      await app.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[3] Health section rendered');
  {
    const app = buildDashboardApp({ client: makeFixtureClient(), logLevel: 'silent' });
    try {
      const res = await app.inject({ method: 'GET', url: '/' });
      assert(res.body.includes('data-testid="health-cards"'), 'health cards present');
      assert(res.body.includes('0.0.0-smoke'), 'version present');
    } finally {
      await app.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[4] Publisher breakdown rendered');
  {
    const app = buildDashboardApp({ client: makeFixtureClient(), logLevel: 'silent' });
    try {
      const res = await app.inject({ method: 'GET', url: '/' });
      assert(res.body.includes('data-testid="publisher-table"'), 'publisher table present');
      assert(res.body.includes('wordpress'), 'wordpress publisher listed');
      assert(res.body.includes('>30<'), 'mock count = 30');
      assert(res.body.includes('>16<'), 'wordpress count = 16');
    } finally {
      await app.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[5] Recent items rendered');
  {
    const app = buildDashboardApp({ client: makeFixtureClient(), logLevel: 'silent' });
    try {
      const res = await app.inject({ method: 'GET', url: '/' });
      assert(res.body.includes('data-testid="recent-table"'), 'recent table present');
      assert(res.body.includes('first-article'), 'first article URL present');
      assert(res.body.includes('second-article'), 'second article URL present');
      const rows = res.body.match(/data-testid="recent-row"/g);
      assert((rows?.length ?? 0) === 2, `2 recent rows (got ${rows?.length ?? 0})`);
    } finally {
      await app.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[6] Empty recent list');
  {
    const client: DashboardApiClient = {
      ...makeFixtureClient(),
      fetchRecent: async () => ({ items: [], count: 0 }),
      fetchMetrics: async () => metricsFixture,
    };
    const app = buildDashboardApp({ client, logLevel: 'silent' });
    try {
      const res = await app.inject({ method: 'GET', url: '/' });
      assert(res.body.includes('data-testid="recent-empty"'), 'empty message present');
      assert(res.body.includes('No published content yet'), 'empty text correct');
    } finally {
      await app.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[7] API error state (all endpoints down)');
  {
    const app = buildDashboardApp({ client: makeErrorClient(), logLevel: 'silent' });
    try {
      const res = await app.inject({ method: 'GET', url: '/' });
      assert(res.statusCode === 200, 'still returns 200 when API is down');
      assert(res.body.includes('data-testid="error-banner"'), 'error banner shown');
      assert(res.body.includes('Health data unavailable'), 'health unavailable message');
      assert(res.body.includes('Summary data unavailable'), 'summary unavailable message');
      assert(res.body.includes('Recent data unavailable'), 'recent unavailable message');
    } finally {
      await app.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[8] Capabilities flags shown as yes');
  {
    const app = buildDashboardApp({ client: makeFixtureClient(), logLevel: 'silent' });
    try {
      const res = await app.inject({ method: 'GET', url: '/' });
      assert(res.body.includes('data-testid="capabilities-cards"'), 'capabilities section present');
      const yesBadges = res.body.match(/badge ok">yes<\/span>/g);
      assert((yesBadges?.length ?? 0) >= 3, `≥3 "yes" badges (got ${yesBadges?.length ?? 0})`);
    } finally {
      await app.close();
    }
  }

  console.log('\n✅  All dashboard-ui smoke checks passed.\n');
}

main().catch((err: unknown) => {
  console.error('Smoke failed:', err);
  process.exit(1);
});
