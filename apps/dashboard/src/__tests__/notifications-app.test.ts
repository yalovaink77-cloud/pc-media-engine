/**
 * Notifications dashboard app tests — Sprint 47.
 */

import { describe, expect, it } from 'vitest';

import { buildDashboardApp } from '../app.js';
import type { DashboardApiClient } from '../client.js';
import type { NotificationListResult } from '../types.js';

const notifications: NotificationListResult = {
  notifications: [
    {
      id: 'n-1',
      type: 'publish.failed',
      category: 'publishing',
      severity: 'error',
      title: 'Publish failed',
      message: 'Network error',
      read: false,
      correlationId: 'req-9',
      createdAt: '2026-07-07T10:00:00.000Z',
    },
  ],
  total: 1,
  unreadCount: 1,
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
    fetchActivity: async () => null,
    fetchActivityEvent: async () => null,
    fetchNotifications: async () => notifications,
    markNotificationRead: async () => ({ ok: true, status: 200 }),
    markAllNotificationsRead: async () => ({ ok: true, status: 200, marked: 1 }),
  };
}

describe('GET /notifications', () => {
  it('renders notification center page', async () => {
    const app = buildDashboardApp({ client: makeClient(), logLevel: 'silent' });
    const res = await app.inject({ method: 'GET', url: '/notifications' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('data-testid="notifications-section"');
    expect(res.body).toContain('publish.failed');
    expect(res.body).toContain('data-testid="notification-unread-badge"');
    await app.close();
  });
});

describe('POST /ops/notifications/read-all', () => {
  it('redirects with flash after mark all read', async () => {
    const app = buildDashboardApp({ client: makeClient(), logLevel: 'silent' });
    const res = await app.inject({ method: 'POST', url: '/ops/notifications/read-all' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('/notifications');
    await app.close();
  });
});
