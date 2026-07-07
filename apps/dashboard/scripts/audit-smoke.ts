/**
 * Activity dashboard smoke — Sprint 46.
 */

import { buildDashboardApp } from '../src/app.js';
import type { DashboardApiClient } from '../src/client.js';
import type { ActivityEvent, ActivityListResult } from '../src/types.js';

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
}
function fail(label: string): never {
  console.error(`  ✗ ${label}`);
  process.exit(1);
}
function assert(cond: boolean, label: string): void {
  if (!cond) fail(label);
  pass(label);
}
function section(title: string): void {
  console.log(`\n[${title}]`);
}

const events: ActivityListResult = {
  events: [
    {
      id: 'evt-smoke-1',
      type: 'queue.pause',
      category: 'queue',
      severity: 'info',
      actor: { type: 'user', id: 'admin', role: 'admin' },
      target: { type: 'queue', id: 'publishing' },
      correlationId: 'corr-smoke',
      metadata: { smoke: true },
      timestamp: new Date().toISOString(),
    },
    {
      id: 'evt-smoke-2',
      type: 'auth.rbac_denied',
      category: 'auth',
      severity: 'warn',
      actor: { type: 'user', id: 'viewer', role: 'viewer' },
      metadata: { permission: 'queue:write' },
      timestamp: new Date().toISOString(),
    },
  ],
  total: 2,
  limit: 50,
};

function makeClient(): DashboardApiClient {
  return {
    fetchHealth: async () => null,
    fetchSummary: async () => null,
    fetchRecent: async () => null,
    fetchMetrics: async () => null,
    fetchQueueStatus: async () => null,
    pauseQueue: async () => ({ ok: true, status: 200, message: 'ok' }),
    resumeQueue: async () => ({ ok: true, status: 200, message: 'ok' }),
    drainQueue: async () => ({ ok: true, status: 200, message: 'ok' }),
    retryJob: async () => ({ ok: true, status: 200, message: 'ok' }),
    removeJob: async () => ({ ok: true, status: 200, message: 'ok' }),
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
    updateProviderConfig: async () => ({
      ok: false,
      status: 400,
      detail: null,
      validation: null,
    }),
    fetchActivity: async () => events,
    fetchActivityEvent: async (id: string): Promise<ActivityEvent | null> =>
      events.events.find((e) => e.id === id) ?? null,
  };
}

async function main(): Promise<void> {
  section('Activity Center page');
  {
    const app = buildDashboardApp({ client: makeClient(), logLevel: 'silent' });
    const res = await app.inject({ method: 'GET', url: '/activity' });
    assert(res.statusCode === 200, 'activity page loads');
    assert(res.body.includes('data-testid="activity-section"'), 'activity section rendered');
    assert(res.body.includes('data-testid="activity-timeline"'), 'timeline rendered');
    assert(res.body.includes('data-testid="activity-filters"'), 'filters rendered');
    assert(res.body.includes('queue.pause'), 'queue event in timeline');
    assert(res.body.includes('href="/activity"'), 'activity nav link');
    await app.close();
  }

  section('Event detail');
  {
    const app = buildDashboardApp({ client: makeClient(), logLevel: 'silent' });
    const res = await app.inject({ method: 'GET', url: '/activity?eventId=evt-smoke-1' });
    assert(res.body.includes('data-testid="activity-event-detail"'), 'event detail rendered');
    assert(res.body.includes('data-testid="activity-correlation"'), 'correlation id shown');
    assert(res.body.includes('corr-smoke'), 'correlation value present');
    assert(res.body.includes('data-testid="activity-metadata"'), 'metadata JSON viewer');
    await app.close();
  }

  console.log('\n✅  All audit dashboard smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
