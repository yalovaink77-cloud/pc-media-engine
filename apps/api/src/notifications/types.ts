/**
 * Notification types — Sprint 47.
 */

export type NotificationSeverity = 'info' | 'warn' | 'error' | 'critical';

export type NotificationType =
  | 'publish.completed'
  | 'publish.failed'
  | 'publish.duplicate_skipped'
  | 'queue.retry_exhausted'
  | 'queue.paused'
  | 'queue.resumed'
  | 'provider.unhealthy'
  | 'provider.config_invalid'
  | 'system.startup'
  | 'system.shutdown'
  | 'system.fatal_error'
  | 'security.auth_failures'
  | 'security.rbac_denied';

export type NotificationCategory = 'publishing' | 'queue' | 'provider' | 'system' | 'security';

export type Notification = {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  read: boolean;
  correlationId?: string;
  auditEventId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type NotificationInput = Omit<Notification, 'id' | 'read' | 'createdAt'> & {
  id?: string;
  read?: boolean;
  createdAt?: string;
};

export type NotificationListFilters = {
  unread?: boolean;
  severity?: NotificationSeverity;
  limit?: number;
};

export type NotificationListResult = {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  limit: number;
};

export type NotificationRepository = {
  append(notification: Notification): Promise<void>;
  list(filters?: NotificationListFilters): Promise<NotificationListResult>;
  findById(id: string): Promise<Notification | null>;
  markRead(id: string): Promise<Notification | null>;
  markAllRead(): Promise<number>;
  countUnread(): Promise<number>;
};

export type NotificationService = {
  notifyFromAudit(event: import('../audit/types.js').AuditEvent): void;
  list(filters?: NotificationListFilters): Promise<NotificationListResult>;
  getById(id: string): Promise<Notification | null>;
  markRead(id: string): Promise<Notification | null>;
  markAllRead(): Promise<number>;
  unreadCount(): Promise<number>;
};

export const DEFAULT_NOTIFICATION_LIMIT = 50;
export const MAX_NOTIFICATION_LIMIT = 200;
