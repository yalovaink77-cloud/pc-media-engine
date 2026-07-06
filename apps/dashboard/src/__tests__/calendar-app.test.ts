import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardApp } from '../app.js';
import type { DashboardApiClient } from '../client.js';
import type { CalendarEventsResult, CalendarTimelineResult } from '../types.js';

const future = '2026-08-15T14:00:00.000Z';

const events: CalendarEventsResult = {
  events: [
    {
      id: 'job-1',
      jobId: 'job-1',
      assetId: 'asset-001',
      projectId: 'proj-abc',
      publisher: 'wordpress',
      title: 'Scheduled Post',
      slug: 'scheduled-post',
      scheduledFor: future,
      status: 'delayed',
      retryCount: 0,
      maxAttempts: 4,
    },
  ],
  count: 1,
  start: '2026-08-01T00:00:00.000Z',
  end: '2026-08-31T23:59:59.999Z',
};

const timeline: CalendarTimelineResult = {
  entries: [
    {
      id: 'job-1',
      timestamp: future,
      type: 'scheduled',
      assetId: 'asset-001',
      publisher: 'wordpress',
      title: 'Scheduled Post',
      slug: 'scheduled-post',
      jobId: 'job-1',
      scheduledFor: future,
      retryCount: 0,
    },
    {
      id: 'history-1',
      timestamp: '2026-08-01T10:00:00.000Z',
      type: 'published',
      publisher: 'wordpress',
      title: 'published-post',
      slug: 'published-post',
    },
  ],
  count: 2,
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
    fetchProviderConfigs: async () => null,
    fetchProviderConfig: async () => null,
    validateProviderConfig: async () => null,
    updateProviderConfig: async () => ({ ok: false, status: 0, detail: null, validation: null }),
  };
}

let app: ReturnType<typeof buildDashboardApp>;

afterEach(async () => {
  await app.close();
});

describe('GET /calendar', () => {
  beforeEach(() => {
    app = buildDashboardApp({
      client: makeClient(),
      logLevel: 'silent',
      apiBaseUrl: 'http://api.test',
    });
  });

  it('renders calendar with view tabs', async () => {
    const res = await app.inject({ method: 'GET', url: '/calendar' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('data-testid="calendar-section"');
    expect(res.body).toContain('data-testid="calendar-view-month"');
    expect(res.body).toContain('data-testid="calendar-view-timeline"');
  });

  it('renders timeline view', async () => {
    const res = await app.inject({ method: 'GET', url: '/calendar?view=timeline' });
    expect(res.body).toContain('data-testid="calendar-timeline-view"');
    expect(res.body).toContain('data-testid="timeline-entry-job-1"');
  });

  it('shows event detail when eventId provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/calendar?eventId=job-1&start=${encodeURIComponent(events.start)}&end=${encodeURIComponent(events.end)}`,
    });
    expect(res.body).toContain('data-testid="calendar-event-detail"');
    expect(res.body).toContain('Scheduled Post');
  });
});
