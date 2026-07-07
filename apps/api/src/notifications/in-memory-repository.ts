/**
 * In-memory notification repository — Sprint 47.
 */

import { randomUUID } from 'node:crypto';

import type {
  Notification,
  NotificationListFilters,
  NotificationListResult,
  NotificationRepository,
} from './types.js';
import { DEFAULT_NOTIFICATION_LIMIT, MAX_NOTIFICATION_LIMIT } from './types.js';

export function createInMemoryNotificationRepository(): NotificationRepository {
  const notifications: Notification[] = [];

  return {
    async append(notification: Notification): Promise<void> {
      notifications.push(notification);
    },

    async list(filters: NotificationListFilters = {}): Promise<NotificationListResult> {
      const limit = Math.min(
        Math.max(filters.limit ?? DEFAULT_NOTIFICATION_LIMIT, 1),
        MAX_NOTIFICATION_LIMIT,
      );
      let filtered = [...notifications];

      if (filters.unread === true) {
        filtered = filtered.filter((n) => !n.read);
      } else if (filters.unread === false) {
        filtered = filtered.filter((n) => n.read);
      }
      if (filters.severity) {
        filtered = filtered.filter((n) => n.severity === filters.severity);
      }

      filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const unreadCount = notifications.filter((n) => !n.read).length;
      const total = filtered.length;
      const page = filtered.slice(0, limit);

      return { notifications: page, total, unreadCount, limit };
    },

    async findById(id: string): Promise<Notification | null> {
      return notifications.find((n) => n.id === id) ?? null;
    },

    async markRead(id: string): Promise<Notification | null> {
      const item = notifications.find((n) => n.id === id);
      if (!item) return null;
      item.read = true;
      return item;
    },

    async markAllRead(): Promise<number> {
      let count = 0;
      for (const n of notifications) {
        if (!n.read) {
          n.read = true;
          count += 1;
        }
      }
      return count;
    },

    async countUnread(): Promise<number> {
      return notifications.filter((n) => !n.read).length;
    },
  };
}

export function newNotificationId(): string {
  return randomUUID();
}
