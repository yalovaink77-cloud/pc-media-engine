/**
 * Derive notifications from audit events — Sprint 47.
 */

import type { AuditEvent } from '../audit/types.js';
import type {
  NotificationCategory,
  NotificationInput,
  NotificationSeverity,
  NotificationType,
} from './types.js';

const AUTH_FAILURE_THRESHOLD = 3;
const authFailureCounts = new Map<string, { count: number; lastAt: number }>();
const AUTH_FAILURE_WINDOW_MS = 5 * 60 * 1000;

function categoryFor(type: NotificationType): NotificationCategory {
  if (type.startsWith('publish.')) return 'publishing';
  if (type.startsWith('queue.')) return 'queue';
  if (type.startsWith('provider.')) return 'provider';
  if (type.startsWith('system.')) return 'system';
  return 'security';
}

function buildInput(
  type: NotificationType,
  severity: NotificationSeverity,
  title: string,
  message: string,
  event: AuditEvent,
): NotificationInput {
  return {
    type,
    category: categoryFor(type),
    severity,
    title,
    message,
    correlationId: event.correlationId,
    auditEventId: event.id,
    metadata: event.metadata,
    createdAt: event.timestamp,
  };
}

function trackAuthFailure(event: AuditEvent): NotificationInput | null {
  const actorId = event.actor.id;
  const now = Date.now();
  const entry = authFailureCounts.get(actorId);
  if (!entry || now - entry.lastAt > AUTH_FAILURE_WINDOW_MS) {
    authFailureCounts.set(actorId, { count: 1, lastAt: now });
    return null;
  }
  entry.count += 1;
  entry.lastAt = now;
  if (entry.count < AUTH_FAILURE_THRESHOLD) return null;
  authFailureCounts.delete(actorId);
  return buildInput(
    'security.auth_failures',
    'warn',
    'Repeated authentication failures',
    `${AUTH_FAILURE_THRESHOLD} failed auth attempts from ${actorId}`,
    event,
  );
}

export function notificationFromAuditEvent(event: AuditEvent): NotificationInput | null {
  switch (event.type) {
    case 'publishing.queued':
      return buildInput(
        'publish.completed',
        'info',
        'Publish queued',
        event.target
          ? `Publishing to ${event.target.id} was accepted`
          : 'Publish job accepted into queue',
        event,
      );
    case 'publishing.failed': {
      const reason = String(event.metadata?.reason ?? 'unknown');
      if (/retry.*exhaust/i.test(reason) || event.metadata?.retryExhausted === true) {
        return buildInput('queue.retry_exhausted', 'error', 'Retry exhausted', reason, event);
      }
      return buildInput('publish.failed', 'error', 'Publish failed', reason, event);
    }
    case 'publishing.duplicate_skipped':
      return buildInput(
        'publish.duplicate_skipped',
        'warn',
        'Duplicate skipped',
        event.target
          ? `Skipped duplicate for ${event.target.id}: ${String(event.metadata?.reason ?? '')}`
          : 'Duplicate publish skipped',
        event,
      );
    case 'queue.pause':
      return buildInput(
        'queue.paused',
        'info',
        'Queue paused',
        'Publishing queue was paused',
        event,
      );
    case 'queue.resume':
      return buildInput(
        'queue.resumed',
        'info',
        'Queue resumed',
        'Publishing queue was resumed',
        event,
      );
    case 'provider.health_check':
      if (event.metadata?.healthy === false) {
        return buildInput(
          'provider.unhealthy',
          'warn',
          'Provider unhealthy',
          String(
            event.metadata?.message ?? `Provider ${event.target?.id ?? 'unknown'} is unhealthy`,
          ),
          event,
        );
      }
      return null;
    case 'provider.validation':
      if (event.metadata?.valid === false) {
        return buildInput(
          'provider.config_invalid',
          'warn',
          'Provider configuration invalid',
          `Validation failed for ${event.target?.id ?? 'provider'}`,
          event,
        );
      }
      return null;
    case 'provider.config_updated':
      if (event.metadata?.success === false) {
        return buildInput(
          'provider.config_invalid',
          'warn',
          'Provider configuration invalid',
          `Configuration update failed for ${event.target?.id ?? 'provider'}`,
          event,
        );
      }
      return null;
    case 'system.startup':
      return buildInput('system.startup', 'info', 'System startup', 'API process started', event);
    case 'system.shutdown':
      return buildInput(
        'system.shutdown',
        'info',
        'System shutdown',
        'API process shutting down',
        event,
      );
    case 'system.fatal_error':
      return buildInput(
        'system.fatal_error',
        'critical',
        'Fatal system error',
        String(event.metadata?.message ?? 'A fatal error occurred'),
        event,
      );
    case 'auth.rbac_denied':
      return buildInput(
        'security.rbac_denied',
        'warn',
        'Access denied',
        `RBAC denied ${String(event.metadata?.permission ?? 'permission')} for role ${String(event.metadata?.role ?? 'unknown')}`,
        event,
      );
    case 'auth.login_failure':
      return trackAuthFailure(event);
    default:
      return null;
  }
}

/** Reset auth failure tracker — for tests only. */
export function resetAuthFailureTracker(): void {
  authFailureCounts.clear();
}
