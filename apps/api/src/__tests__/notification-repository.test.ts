/**
 * Notification repository tests — Sprint 47.
 */

import { describe, expect, it } from 'vitest';

import { createInMemoryNotificationRepository } from '../notifications/in-memory-repository.js';
import type { Notification } from '../notifications/types.js';

function sample(overrides: Partial<Notification> = {}): Notification {
  return {
    id: overrides.id ?? 'n-1',
    type: 'publish.completed',
    category: 'publishing',
    severity: 'info',
    title: 'Publish queued',
    message: 'Job accepted',
    read: false,
    createdAt: '2026-07-07T10:00:00.000Z',
    ...overrides,
  };
}

describe('InMemoryNotificationRepository', () => {
  it('lists unread notifications and counts', async () => {
    const repo = createInMemoryNotificationRepository();
    await repo.append(sample({ id: 'a', read: false }));
    await repo.append(sample({ id: 'b', read: true }));
    const unread = await repo.list({ unread: true });
    expect(unread.notifications).toHaveLength(1);
    expect(unread.unreadCount).toBe(1);
  });

  it('marks one and all as read', async () => {
    const repo = createInMemoryNotificationRepository();
    await repo.append(sample({ id: 'a' }));
    await repo.append(sample({ id: 'b' }));
    const one = await repo.markRead('a');
    expect(one?.read).toBe(true);
    const marked = await repo.markAllRead();
    expect(marked).toBe(1);
    expect(await repo.countUnread()).toBe(0);
  });
});
