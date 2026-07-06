/**
 * Publishing jobs dashboard smoke — Sprint 38.
 */

import { buildDashboardApp } from '../src/app.js';
import type { DashboardApiClient } from '../src/client.js';
import type { JobDetail, JobListResult } from '../src/types.js';

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

const jobList: JobListResult = {
  jobs: [
    {
      id: 'job-smoke-1',
      name: 'publish',
      status: 'failed',
      publisher: 'mock',
      projectId: 'proj-1',
      assetId: 'asset-1',
      title: 'Smoke Article',
      slug: 'smoke-article',
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
    title: 'Smoke Article',
    slug: 'smoke-article',
    projectId: 'proj-1',
    assetId: 'asset-1',
    hasMedia: true,
  },
  queueState: 'failed',
  retryHistory: [
    { attempt: 1, error: 'timeout' },
    { attempt: 2, error: 'publisher down' },
  ],
  queuePaused: false,
  error: { message: 'publisher down', stacktrace: ['Error: down'] },
};

let retriedId = '';

function makeClient(): DashboardApiClient {
  const noop = async () => ({ ok: true, status: 200, message: 'OK' });
  return {
    fetchHealth: async () => null,
    fetchSummary: async () => null,
    fetchRecent: async () => null,
    fetchMetrics: async () => null,
    fetchQueueStatus: async () => null,
    pauseQueue: noop,
    resumeQueue: noop,
    drainQueue: noop,
    retryJob: async (id) => {
      retriedId = id;
      return { ok: true, status: 200, message: `Job ${id} queued for retry` };
    },
    removeJob: noop,
    fetchPublishers: async () => [],
    fetchPublisherDetail: async () => null,
    fetchPublisherHealth: async () => null,
    fetchJobs: async () => jobList,
    fetchJob: async (id) => (id === 'job-smoke-1' ? jobDetail : null),
    fetchAssets: async () => null,
    fetchAsset: async () => null,
  };
}

async function main(): Promise<void> {
  const app = buildDashboardApp({ client: makeClient(), apiKeyConfigured: true });
  await app.ready();

  section('1 · Jobs page');
  {
    const res = await app.inject({ method: 'GET', url: '/jobs' });
    assert(res.statusCode === 200, 'GET /jobs returns 200');
    assert(res.body.includes('data-testid="jobs-table"'), 'jobs table present');
    assert(res.body.includes('data-testid="jobs-filter-form"'), 'filter form present');
    assert(res.body.includes('job-smoke-1'), 'job id in table');
    assert(res.body.includes('href="/jobs/job-smoke-1"'), 'detail link present');
  }

  section('2 · Job detail page');
  {
    const res = await app.inject({ method: 'GET', url: '/jobs/job-smoke-1' });
    assert(res.statusCode === 200, 'detail page returns 200');
    assert(res.body.includes('data-testid="job-detail-section"'), 'detail section present');
    assert(res.body.includes('Retry History'), 'retry history shown');
    assert(res.body.includes('publisher down'), 'error shown');
    assert(res.body.includes('data-testid="job-retry-form"'), 'retry form linked');
    assert(res.body.includes('data-testid="job-remove-form"'), 'remove form linked');
  }

  section('3 · Retry action from detail');
  {
    retriedId = '';
    const res = await app.inject({ method: 'POST', url: '/ops/jobs/job-smoke-1/retry' });
    assert(res.statusCode === 302, 'retry redirects');
    assert(retriedId === 'job-smoke-1', 'retryJob called');
    const page = await app.inject({ method: 'GET', url: res.headers.location ?? '' });
    assert(page.body.includes('queued for retry'), 'flash shows retry result');
  }

  await app.close();
  console.log('\n✅  All publishing jobs dashboard smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
