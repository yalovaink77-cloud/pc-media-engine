/**
 * Notifications dashboard renderer tests — Sprint 47.
 */

import { describe, expect, it } from 'vitest';

import { renderNotificationsPage } from '../renderer.js';

const sample = {
  id: 'n-1',
  type: 'queue.paused',
  category: 'queue',
  severity: 'info' as const,
  title: 'Queue paused',
  message: 'Publishing queue was paused',
  read: false,
  correlationId: 'corr-1',
  createdAt: '2026-07-07T10:00:00.000Z',
};

describe('renderNotificationsPage', () => {
  it('renders notification list with severity and unread badges', () => {
    const html = renderNotificationsPage({
      notifications: { notifications: [sample], total: 1, unreadCount: 1, limit: 50 },
      selectedNotification: null,
      showUnreadOnly: false,
      fetchedAt: 'now',
      errors: [],
    });
    expect(html).toContain('data-testid="notifications-section"');
    expect(html).toContain('data-testid="notifications-list"');
    expect(html).toContain('data-testid="notification-row-n-1"');
    expect(html).toContain('queue.paused');
  });

  it('renders notification detail with correlation id', () => {
    const html = renderNotificationsPage({
      notifications: { notifications: [sample], total: 1, unreadCount: 1, limit: 50 },
      selectedNotification: sample,
      showUnreadOnly: false,
      fetchedAt: 'now',
      errors: [],
    });
    expect(html).toContain('data-testid="notification-detail"');
    expect(html).toContain('data-testid="notification-correlation"');
    expect(html).toContain('corr-1');
  });

  it('includes notification bell nav link', () => {
    const html = renderNotificationsPage({
      notifications: { notifications: [], total: 0, unreadCount: 0, limit: 50 },
      selectedNotification: null,
      showUnreadOnly: false,
      fetchedAt: 'now',
      errors: [],
    });
    expect(html).toContain('data-testid="notification-bell"');
    expect(html).toContain('href="/notifications"');
  });
});
