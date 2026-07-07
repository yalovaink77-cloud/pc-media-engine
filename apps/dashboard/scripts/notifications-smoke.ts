/**
 * Notifications dashboard smoke — Sprint 47.
 */

import type { DashboardApiClient } from '../client.js';
import { buildDashboardApp } from '../src/app.js';
import type { NotificationListResult } from '../types.js';

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

const notifications: NotificationListResult = {
  notifications: [
    {
      id: 'n-smoke-1',
      type: 'security.rbac_denied',
      category: 'security',
      severity: 'warn',
      title: 'Access denied',
      message: 'RBAC denied queue:write',
      read: false,
      correlationId: 'corr-smoke',
      createdAt: new Date().toISOString(),
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

async function main(): Promise<void> {
  section('Notification Center');
  {
    const app = buildDashboardApp({ client: makeClient(), logLevel: 'silent' });
    const res = await app.inject({ method: 'GET', url: '/notifications' });
    assert(res.statusCode === 200, 'notifications page loads');
    assert(res.body.includes('data-testid="notifications-section"'), 'section rendered');
    assert(res.body.includes('data-testid="notification-bell"'), 'bell indicator');
    assert(res.body.includes('data-testid="notification-unread-badge"'), 'unread badge');
    assert(res.body.includes('security.rbac_denied'), 'security notification listed');
    await app.close();
  }

  section('Notification detail');
  {
    const app = buildDashboardApp({ client: makeClient(), logLevel: 'silent' });
    const res = await app.inject({
      method: 'GET',
      url: '/notifications?notificationId=n-smoke-1',
    });
    assert(res.body.includes('data-testid="notification-detail"'), 'detail rendered');
    assert(res.body.includes('data-testid="notification-correlation"'), 'correlation shown');
    await app.close();
  }

  section('Mark read');
  {
    const app = buildDashboardApp({ client: makeClient(), logLevel: 'silent' });
    const res = await app.inject({ method: 'POST', url: '/ops/notifications/read-all' });
    assert(res.statusCode === 302, 'mark all read redirects');
    await app.close();
  }

  console.log('\n✅  All notifications dashboard smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
