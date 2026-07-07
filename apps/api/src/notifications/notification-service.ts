/**
 * Notification service — Sprint 47.
 *
 * Fire-and-forget derivation from audit events — failures never propagate.
 */

import type { AuditEvent } from '../audit/types.js';
import { notificationFromAuditEvent } from './from-audit.js';
import { newNotificationId } from './in-memory-repository.js';
import type {
  Notification,
  NotificationInput,
  NotificationListFilters,
  NotificationListResult,
  NotificationRepository,
  NotificationService,
} from './types.js';

export type NotificationServiceDeps = {
  repository: NotificationRepository;
};

export function createNotificationService(deps: NotificationServiceDeps): NotificationService {
  const { repository } = deps;

  function append(input: NotificationInput): void {
    const notification: Notification = {
      id: input.id ?? newNotificationId(),
      type: input.type,
      category: input.category,
      severity: input.severity,
      title: input.title,
      message: input.message,
      read: input.read ?? false,
      correlationId: input.correlationId,
      auditEventId: input.auditEventId,
      metadata: input.metadata,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };

    void repository.append(notification).catch(() => {
      // Swallow — notifications must never block workflows.
    });
  }

  return {
    notifyFromAudit(event: AuditEvent): void {
      try {
        const input = notificationFromAuditEvent(event);
        if (input) append(input);
      } catch {
        // Swallow derivation errors.
      }
    },

    list(filters?: NotificationListFilters): Promise<NotificationListResult> {
      return repository.list(filters);
    },

    getById(id: string): Promise<Notification | null> {
      return repository.findById(id);
    },

    markRead(id: string): Promise<Notification | null> {
      return repository.markRead(id);
    },

    markAllRead(): Promise<number> {
      return repository.markAllRead();
    },

    unreadCount(): Promise<number> {
      return repository.countUnread();
    },
  };
}
