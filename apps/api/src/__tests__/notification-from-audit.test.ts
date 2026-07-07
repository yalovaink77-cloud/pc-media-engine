/**
 * Notification from-audit mapping tests — Sprint 47.
 */

import { describe, expect, it } from 'vitest';

import type { AuditEvent } from '../audit/types.js';
import {
  notificationFromAuditEvent,
  resetAuthFailureTracker,
} from '../notifications/from-audit.js';

function event(type: AuditEvent['type'], extra: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'e1',
    type,
    category: 'system',
    severity: 'info',
    actor: { type: 'system', id: 'api' },
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

describe('notificationFromAuditEvent', () => {
  it('maps provider unhealthy health checks', () => {
    const n = notificationFromAuditEvent(
      event('provider.health_check', {
        metadata: { healthy: false, message: 'timeout' },
        target: { type: 'publisher', id: 'wordpress' },
      }),
    );
    expect(n?.type).toBe('provider.unhealthy');
  });

  it('maps publish failed and retry exhausted', () => {
    const failed = notificationFromAuditEvent(
      event('publishing.failed', { metadata: { reason: 'network error' }, severity: 'error' }),
    );
    expect(failed?.type).toBe('publish.failed');

    const exhausted = notificationFromAuditEvent(
      event('publishing.failed', { metadata: { reason: 'retry exhausted', retryExhausted: true } }),
    );
    expect(exhausted?.type).toBe('queue.retry_exhausted');
  });

  it('maps rbac denied', () => {
    const n = notificationFromAuditEvent(
      event('auth.rbac_denied', { metadata: { permission: 'queue:write', role: 'viewer' } }),
    );
    expect(n?.type).toBe('security.rbac_denied');
  });

  it('ignores non-notifiable events', () => {
    expect(notificationFromAuditEvent(event('auth.api_key_authenticated'))).toBeNull();
  });

  it('tracks repeated auth failures', () => {
    resetAuthFailureTracker();
    const actor = { type: 'anonymous' as const, id: 'attacker' };
    expect(notificationFromAuditEvent(event('auth.login_failure', { actor }))).toBeNull();
    expect(notificationFromAuditEvent(event('auth.login_failure', { actor }))).toBeNull();
    const third = notificationFromAuditEvent(event('auth.login_failure', { actor }));
    expect(third?.type).toBe('security.auth_failures');
  });
});
