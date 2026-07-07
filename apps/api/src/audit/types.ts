/**
 * Audit log types — Sprint 46.
 */

export type AuditEventCategory =
  'auth' | 'publishing' | 'queue' | 'provider' | 'composer' | 'system';

export type AuditEventSeverity = 'info' | 'warn' | 'error' | 'critical';

export type AuditEventType =
  | 'auth.login_success'
  | 'auth.login_failure'
  | 'auth.api_key_authenticated'
  | 'auth.rbac_denied'
  | 'publishing.requested'
  | 'publishing.queued'
  | 'publishing.completed'
  | 'publishing.failed'
  | 'publishing.duplicate_skipped'
  | 'queue.pause'
  | 'queue.resume'
  | 'queue.drain'
  | 'queue.retry'
  | 'queue.remove'
  | 'provider.config_updated'
  | 'provider.validation'
  | 'provider.health_check'
  | 'composer.validation'
  | 'composer.publish'
  | 'composer.bulk_publish'
  | 'composer.schedule'
  | 'system.startup'
  | 'system.shutdown'
  | 'system.fatal_error';

export type AuditActor = {
  type: 'user' | 'system' | 'anonymous';
  id: string;
  role?: string;
};

export type AuditTarget = {
  type: string;
  id: string;
};

export type AuditEvent = {
  id: string;
  type: AuditEventType;
  category: AuditEventCategory;
  severity: AuditEventSeverity;
  actor: AuditActor;
  target?: AuditTarget;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
};

export type AuditEventInput = Omit<AuditEvent, 'id' | 'timestamp' | 'category' | 'actor'> & {
  id?: string;
  timestamp?: string;
  category?: AuditEventCategory;
  actor?: AuditActor;
};

export type AuditListFilters = {
  type?: string;
  actor?: string;
  target?: string;
  start?: string;
  end?: string;
  limit?: number;
};

export type AuditListResult = {
  events: AuditEvent[];
  total: number;
  limit: number;
};

export type AuditRepository = {
  append(event: AuditEvent): Promise<void>;
  list(filters?: AuditListFilters): Promise<AuditListResult>;
  findById(id: string): Promise<AuditEvent | null>;
};

export type AuditService = {
  record(input: AuditEventInput): void;
  list(filters?: AuditListFilters): Promise<AuditListResult>;
  getById(id: string): Promise<AuditEvent | null>;
};

export const AUDIT_EVENT_CATEGORIES: Record<AuditEventType, AuditEventCategory> = {
  'auth.login_success': 'auth',
  'auth.login_failure': 'auth',
  'auth.api_key_authenticated': 'auth',
  'auth.rbac_denied': 'auth',
  'publishing.requested': 'publishing',
  'publishing.queued': 'publishing',
  'publishing.completed': 'publishing',
  'publishing.failed': 'publishing',
  'publishing.duplicate_skipped': 'publishing',
  'queue.pause': 'queue',
  'queue.resume': 'queue',
  'queue.drain': 'queue',
  'queue.retry': 'queue',
  'queue.remove': 'queue',
  'provider.config_updated': 'provider',
  'provider.validation': 'provider',
  'provider.health_check': 'provider',
  'composer.validation': 'composer',
  'composer.publish': 'composer',
  'composer.bulk_publish': 'composer',
  'composer.schedule': 'composer',
  'system.startup': 'system',
  'system.shutdown': 'system',
  'system.fatal_error': 'system',
};

export const DEFAULT_AUDIT_LIMIT = 50;
export const MAX_AUDIT_LIMIT = 200;
