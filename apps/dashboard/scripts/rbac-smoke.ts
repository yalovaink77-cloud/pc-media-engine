/**
 * RBAC dashboard smoke — Sprint 45.
 */

import { buildDashboardApp } from '../src/app.js';
import type { DashboardApiClient } from '../src/client.js';
import { createDashboardRbac } from '../src/rbac.js';

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

function makeClient(): DashboardApiClient {
  const noop = async () => ({ ok: true, status: 200, message: 'OK' });
  const nullFn = async () => null;
  return {
    fetchHealth: nullFn,
    fetchSummary: nullFn,
    fetchRecent: nullFn,
    fetchMetrics: nullFn,
    fetchQueueStatus: nullFn,
    pauseQueue: noop,
    resumeQueue: noop,
    drainQueue: noop,
    retryJob: noop,
    removeJob: noop,
    fetchPublishers: async () => [],
    fetchPublisherDetail: nullFn,
    fetchPublisherHealth: nullFn,
    fetchJobs: async () => ({ jobs: [], total: 0, limit: 50, offset: 0 }),
    fetchJob: nullFn,
    fetchAssets: nullFn,
    fetchAsset: nullFn,
    fetchComposerAssets: nullFn,
    fetchComposerAsset: nullFn,
    validateComposer: nullFn,
    publishComposer: nullFn,
    bulkPublishComposer: nullFn,
    fetchCalendarEvents: nullFn,
    fetchCalendarTimeline: nullFn,
    fetchProviderConfigs: nullFn,
    fetchProviderConfig: nullFn,
    validateProviderConfig: nullFn,
    updateProviderConfig: async () => ({ ok: true, status: 200, detail: null, validation: null }),
  };
}

function rbac(role: 'admin' | 'operator' | 'publisher' | 'viewer', enabled = true) {
  return createDashboardRbac(role, enabled);
}

async function main(): Promise<void> {
  section('Auth disabled');
  {
    const app = buildDashboardApp({
      client: makeClient(),
      logLevel: 'silent',
      rbac: { enabled: false, role: 'viewer', can: () => true },
    });
    const res = await app.inject({ method: 'GET', url: '/' });
    assert(res.statusCode === 200, 'dashboard loads');
    assert(res.body.includes('form-pause'), 'queue ops visible when RBAC off');
    await app.close();
  }

  section('Admin');
  {
    const app = buildDashboardApp({
      client: makeClient(),
      logLevel: 'silent',
      rbac: rbac('admin'),
    });
    const res = await app.inject({ method: 'GET', url: '/' });
    assert(res.body.includes('form-pause'), 'admin sees queue ops');
    assert(res.body.includes('Bulk Publish'), 'admin sees bulk publish nav');
    await app.close();
  }

  section('Operator');
  {
    const app = buildDashboardApp({
      client: makeClient(),
      logLevel: 'silent',
      rbac: rbac('operator'),
    });
    const res = await app.inject({ method: 'GET', url: '/' });
    assert(res.body.includes('form-pause'), 'operator sees queue ops');
    assert(!res.body.includes('Bulk Publish'), 'operator hides bulk publish nav');
    await app.close();
  }

  section('Publisher');
  {
    const app = buildDashboardApp({
      client: makeClient(),
      logLevel: 'silent',
      rbac: rbac('publisher'),
    });
    const res = await app.inject({ method: 'GET', url: '/' });
    assert(res.body.includes('queue-ops-denied'), 'publisher denied queue ops');
    assert(res.body.includes('Composer'), 'publisher sees composer nav');
    await app.close();
  }

  section('Viewer');
  {
    const app = buildDashboardApp({
      client: makeClient(),
      logLevel: 'silent',
      rbac: rbac('viewer'),
    });
    const res = await app.inject({ method: 'GET', url: '/' });
    assert(res.body.includes('queue-ops-denied'), 'viewer denied queue ops');
    assert(!res.body.includes('href="/composer"'), 'viewer hides composer nav');
    const denied = await app.inject({ method: 'POST', url: '/ops/queue/pause' });
    assert(denied.statusCode === 302, 'viewer ops redirect');
    assert(denied.headers.location?.includes('flashType=err'), 'permission denied flash');
    await app.close();
  }

  console.log('\n✅  All RBAC dashboard smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
