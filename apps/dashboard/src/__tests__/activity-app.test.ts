/**
 * Activity dashboard app tests — Sprint 46.
 */

import { describe, expect, it } from 'vitest';

import { buildDashboardApp } from '../app.js';
import type { DashboardApiClient } from '../client.js';
import type { ActivityEvent, ActivityListResult } from '../types.js';

const events: ActivityListResult = {
  events: [
    {
      id: 'evt-1',
      type: 'composer.publish',
      category: 'composer',
      severity: 'info',
      actor: { type: 'user', id: 'publisher', role: 'publisher' },
      target: { type: 'asset', id: 'asset-1' },
      correlationId: 'req-1',
      metadata: { accepted: 1 },
      timestamp: '2026-07-06T12:00:00.000Z',
    },
  ],
  total: 1,
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

describe('GET /activity', () => {
  it('renders activity center page', async () => {
    const app = buildDashboardApp({ client: makeClient(), logLevel: 'silent' });
    const res = await app.inject({ method: 'GET', url: '/activity' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('data-testid="activity-section"');
    expect(res.body).toContain('composer.publish');
    await app.close();
  });

  it('renders event detail when eventId provided', async () => {
    const app = buildDashboardApp({ client: makeClient(), logLevel: 'silent' });
    const res = await app.inject({ method: 'GET', url: '/activity?eventId=evt-1' });
    expect(res.body).toContain('data-testid="activity-event-detail"');
    expect(res.body).toContain('req-1');
    await app.close();
  });
});
