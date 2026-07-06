/**
 * Sprint 43 — Publishing Calendar dashboard smoke (offline).
 */

import { buildDashboardApp } from '../src/app.js';
import type { DashboardApiClient } from '../src/client.js';
import type { CalendarEventsResult, CalendarTimelineResult } from '../src/types.js';

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

const future = '2026-09-01T12:00:00.000Z';

const events: CalendarEventsResult = {
  events: [
    {
      id: 'job-1',
      jobId: 'job-1',
      assetId: 'asset-1',
      publisher: 'wordpress',
      title: 'Calendar Post',
      slug: 'calendar-post',
      scheduledFor: future,
      status: 'delayed',
      retryCount: 0,
      maxAttempts: 4,
    },
  ],
  count: 1,
  start: '2026-09-01T00:00:00.000Z',
  end: '2026-09-30T23:59:59.999Z',
};

const timeline: CalendarTimelineResult = {
  entries: [
    {
      id: 'e1',
      timestamp: '2026-09-01T08:00:00.000Z',
      type: 'queued',
      publisher: 'wordpress',
      title: 'A',
      slug: 'a',
    },
    {
      id: 'e2',
      timestamp: future,
      type: 'scheduled',
      publisher: 'wordpress',
      title: 'Calendar Post',
      slug: 'calendar-post',
      jobId: 'job-1',
    },
    {
      id: 'e3',
      timestamp: '2026-09-02T10:00:00.000Z',
      type: 'published',
      publisher: 'ghost',
      title: 'Done',
      slug: 'done',
    },
  ],
  count: 3,
};

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
    retryJob: noop,
    removeJob: noop,
    fetchPublishers: async () => [],
    fetchPublisherDetail: async () => null,
    fetchPublisherHealth: async () => null,
    fetchJobs: async () => ({ jobs: [], total: 0, limit: 50, offset: 0 }),
    fetchJob: async () => null,
    fetchAssets: async () => null,
    fetchAsset: async () => null,
    fetchComposerAssets: async () => null,
    fetchComposerAsset: async () => null,
    validateComposer: async () => null,
    publishComposer: async () => null,
    bulkPublishComposer: async () => null,
    fetchCalendarEvents: async () => events,
    fetchCalendarTimeline: async () => timeline,
  };
}

async function main(): Promise<void> {
  const app = buildDashboardApp({ client: makeClient(), apiBaseUrl: 'http://api.test' });
  await app.ready();

  section('1 · Calendar page');
  {
    const res = await app.inject({ method: 'GET', url: '/calendar' });
    assert(res.statusCode === 200, 'GET /calendar returns 200');
    assert(res.body.includes('data-testid="calendar-section"'), 'calendar section');
    assert(res.body.includes('data-testid="calendar-view-month"'), 'month tab');
    assert(res.body.includes('data-testid="calendar-month-view"'), 'month view');
    assert(res.body.includes('href="/calendar"'), 'nav link');
  }

  section('2 · List view');
  {
    const res = await app.inject({ method: 'GET', url: '/calendar?view=list' });
    assert(res.body.includes('data-testid="calendar-list-view"'), 'list view');
    assert(res.body.includes('data-testid="calendar-event-row-job-1"'), 'event row');
  }

  section('3 · Timeline view');
  {
    const res = await app.inject({ method: 'GET', url: '/calendar?view=timeline' });
    assert(res.body.includes('data-testid="calendar-timeline-view"'), 'timeline view');
    assert(res.body.includes('data-testid="timeline-entry-e2"'), 'scheduled entry');
  }

  section('4 · Event detail');
  {
    const res = await app.inject({
      method: 'GET',
      url: `/calendar?eventId=job-1&start=${encodeURIComponent(events.start)}&end=${encodeURIComponent(events.end)}`,
    });
    assert(res.body.includes('data-testid="calendar-event-detail"'), 'event detail');
    assert(res.body.includes('Calendar Post'), 'event title shown');
  }

  await app.close();
  console.log('\n✅  All publishing calendar dashboard smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
