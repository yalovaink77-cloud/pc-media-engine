/**
 * Dashboard operations UI smoke — Sprint 36.
 *
 * Offline — uses mocked DashboardApiClient via fastify.inject().
 *
 * Run: pnpm dashboard-ops:smoke
 */

import { buildDashboardApp } from '../src/app.js';
import type { DashboardApiClient } from '../src/client.js';
import type {
  DashboardHealthData,
  DashboardRecentData,
  DashboardSummaryData,
  QueueActionResult,
} from '../src/types.js';

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
}
function fail(label: string, detail?: unknown): never {
  console.error(`  ✗ ${label}`, detail ?? '');
  process.exit(1);
}
function assert(cond: boolean, label: string, detail?: unknown): void {
  if (!cond) fail(label, detail);
  pass(label);
}
function section(title: string): void {
  console.log(`\n[${title}]`);
}

const NOW_ISO = '2024-06-01T12:00:00.000Z';

const healthFixture: DashboardHealthData = {
  status: 'ok',
  database: 'ok',
  publishing: {
    publisherDriver: 'mock',
    queueEnabled: true,
    retryConfig: { maxRetries: 3, backoffMs: 5000 },
  },
  version: '0.0.0-smoke',
  env: 'test',
};

const summaryFixture: DashboardSummaryData = {
  totalPublished: 10,
  totalDrafts: 2,
  totalFailed: 1,
  latestPublishedAt: NOW_ISO,
  publishers: [{ publisher: 'mock', count: 10 }],
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
      projectId: 'p1',
      assetId: 'a1',
      publisher: 'mock',
      externalId: 'e1',
      url: 'https://example.com/post',
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
  queueWaiting: 2,
  queueActive: 0,
  queueCompleted: 10,
  queueFailed: 1,
  collectedAt: NOW_ISO,
};

const queueFixture = {
  paused: false,
  waiting: 2,
  active: 0,
  delayed: 0,
  completed: 10,
  failed: 1,
};

let pauseCalled = false;
let resumeCalled = false;
let drainCalled = false;
let retryJobId = '';
let removeJobId = '';

function makeOpsClient(unauthorized = false): DashboardApiClient {
  const unauthorizedResult = async (): Promise<QueueActionResult> => ({
    ok: false,
    status: 401,
    message: 'Unauthorized — configure DASHBOARD_API_KEY to match a value in PCME_API_KEYS',
  });

  return {
    fetchHealth: async () => healthFixture,
    fetchSummary: async () => summaryFixture,
    fetchRecent: async () => recentFixture,
    fetchMetrics: async () => metricsFixture,
    fetchQueueStatus: async () => queueFixture,
    pauseQueue: async () => {
      pauseCalled = true;
      return unauthorized
        ? unauthorizedResult()
        : { ok: true, status: 200, message: 'Queue paused' };
    },
    resumeQueue: async () => {
      resumeCalled = true;
      return unauthorized
        ? unauthorizedResult()
        : { ok: true, status: 200, message: 'Queue resumed' };
    },
    drainQueue: async () => {
      drainCalled = true;
      return unauthorized
        ? unauthorizedResult()
        : { ok: true, status: 200, message: 'Queue drained' };
    },
    retryJob: async (jobId) => {
      retryJobId = jobId;
      return unauthorized
        ? unauthorizedResult()
        : { ok: true, status: 200, message: `Job ${jobId} queued for retry` };
    },
    removeJob: async (jobId) => {
      removeJobId = jobId;
      return unauthorized
        ? unauthorizedResult()
        : { ok: true, status: 200, message: `Job ${jobId} removed` };
    },
    fetchPublishers: async () => [],
    fetchPublisherDetail: async () => null,
    fetchPublisherHealth: async () => null,
    fetchJobs: async () => null,
    fetchJob: async () => null,
  };
}

async function main(): Promise<void> {
  section('1 · Operations panel renders');
  {
    const app = buildDashboardApp({ client: makeOpsClient(), logLevel: 'silent' });
    try {
      const res = await app.inject({ method: 'GET', url: '/' });
      assert(res.statusCode === 200, 'GET / returns 200');
      assert(res.body.includes('data-testid="queue-operations-panel"'), 'operations panel present');
      assert(res.body.includes('data-testid="form-pause"'), 'pause form present');
      assert(res.body.includes('data-testid="form-resume"'), 'resume form present');
      assert(res.body.includes('data-testid="form-drain"'), 'drain form present');
      assert(res.body.includes('data-testid="form-retry"'), 'retry form present');
      assert(res.body.includes('data-testid="form-remove"'), 'remove form present');
    } finally {
      await app.close();
    }
  }

  section('2 · Pause action');
  {
    pauseCalled = false;
    const app = buildDashboardApp({ client: makeOpsClient(), logLevel: 'silent' });
    try {
      const res = await app.inject({ method: 'POST', url: '/ops/queue/pause' });
      assert(res.statusCode === 302, 'pause redirects');
      assert(pauseCalled, 'pauseQueue called');
      assert(String(res.headers.location).includes('flashType=ok'), 'success flash');
    } finally {
      await app.close();
    }
  }

  section('3 · Resume action');
  {
    resumeCalled = false;
    const app = buildDashboardApp({ client: makeOpsClient(), logLevel: 'silent' });
    try {
      const res = await app.inject({ method: 'POST', url: '/ops/queue/resume' });
      assert(res.statusCode === 302, 'resume redirects');
      assert(resumeCalled, 'resumeQueue called');
    } finally {
      await app.close();
    }
  }

  section('4 · Drain action');
  {
    drainCalled = false;
    const app = buildDashboardApp({ client: makeOpsClient(), logLevel: 'silent' });
    try {
      const res = await app.inject({ method: 'POST', url: '/ops/queue/drain' });
      assert(res.statusCode === 302, 'drain redirects');
      assert(drainCalled, 'drainQueue called');
    } finally {
      await app.close();
    }
  }

  section('5 · Retry form');
  {
    retryJobId = '';
    const app = buildDashboardApp({ client: makeOpsClient(), logLevel: 'silent' });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/ops/queue/retry',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'jobId=failed-job-7',
      });
      assert(res.statusCode === 302, 'retry redirects');
      assert(retryJobId === 'failed-job-7', `retryJob called with id (got ${retryJobId})`);
    } finally {
      await app.close();
    }
  }

  section('6 · Remove form');
  {
    removeJobId = '';
    const app = buildDashboardApp({ client: makeOpsClient(), logLevel: 'silent' });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/ops/queue/remove',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'jobId=stale-job-3',
      });
      assert(res.statusCode === 302, 'remove redirects');
      assert(removeJobId === 'stale-job-3', `removeJob called with id (got ${removeJobId})`);
    } finally {
      await app.close();
    }
  }

  section('7 · Unauthorized error display');
  {
    const app = buildDashboardApp({ client: makeOpsClient(true), logLevel: 'silent' });
    try {
      const action = await app.inject({ method: 'POST', url: '/ops/queue/pause' });
      assert(action.statusCode === 302, 'unauthorized still redirects (no crash)');
      const page = await app.inject({ method: 'GET', url: action.headers.location ?? '/' });
      assert(page.statusCode === 200, 'page renders after unauthorized action');
      assert(page.body.includes('data-testid="flash-banner"'), 'flash banner shown');
      assert(page.body.includes('Unauthorized'), 'unauthorized message displayed');
      assert(page.body.includes('DASHBOARD_API_KEY'), 'mentions API key config');
    } finally {
      await app.close();
    }
  }

  console.log('\n✅  All dashboard operations smoke checks passed.\n');
}

main().catch((err: unknown) => {
  console.error('Dashboard ops smoke failed:', err);
  process.exit(1);
});
