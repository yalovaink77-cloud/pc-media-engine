/**
 * Notification service tests — Sprint 47.
 */

import { describe, expect, it, vi } from 'vitest';

import type { AuditEvent } from '../audit/types.js';
import { resetAuthFailureTracker } from '../notifications/from-audit.js';
import { createNotificationService } from '../notifications/notification-service.js';
import type { NotificationRepository } from '../notifications/types.js';

const auditEvent = (type: AuditEvent['type'], extra: Partial<AuditEvent> = {}): AuditEvent => ({
  id: 'evt-1',
  type,
  category: 'publishing',
  severity: 'info',
  actor: { type: 'user', id: 'u1' },
  timestamp: new Date().toISOString(),
  ...extra,
});

describe('NotificationService', () => {
  it('derives publish.completed from publishing.queued audit event', async () => {
    const repo: NotificationRepository = {
      append: vi.fn(),
      list: vi.fn().mockResolvedValue({ notifications: [], total: 0, unreadCount: 0, limit: 50 }),
      findById: vi.fn(),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
      countUnread: vi.fn(),
    };
    const service = createNotificationService({ repository: repo });
    service.notifyFromAudit(
      auditEvent('publishing.queued', { target: { type: 'publisher', id: 'wordpress' } }),
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.append).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'publish.completed', read: false }),
    );
  });

  it('notifyFromAudit swallows repository errors', async () => {
    const repo: NotificationRepository = {
      append: vi.fn().mockRejectedValue(new Error('fail')),
      list: vi.fn(),
      findById: vi.fn(),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
      countUnread: vi.fn(),
    };
    const service = createNotificationService({ repository: repo });
    expect(() => service.notifyFromAudit(auditEvent('queue.pause'))).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
  });

  it('emits repeated auth failure notification after threshold', async () => {
    resetAuthFailureTracker();
    const repo: NotificationRepository = {
      append: vi.fn(),
      list: vi.fn(),
      findById: vi.fn(),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
      countUnread: vi.fn(),
    };
    const service = createNotificationService({ repository: repo });
    for (let i = 0; i < 3; i++) {
      service.notifyFromAudit(
        auditEvent('auth.login_failure', { actor: { type: 'anonymous', id: 'x' } }),
      );
    }
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.append).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'security.auth_failures' }),
    );
  });
});
