/**
 * Audit repository wrapper that derives notifications — Sprint 47.
 */

import type {
  AuditEvent,
  AuditListFilters,
  AuditListResult,
  AuditRepository,
} from '../audit/types.js';
import type { NotificationService } from './types.js';

export function createNotifyingAuditRepository(
  inner: AuditRepository,
  notificationService: NotificationService,
): AuditRepository {
  return {
    async append(event: AuditEvent): Promise<void> {
      await inner.append(event);
      notificationService.notifyFromAudit(event);
    },
    list(filters?: AuditListFilters): Promise<AuditListResult> {
      return inner.list(filters);
    },
    findById(id: string): Promise<AuditEvent | null> {
      return inner.findById(id);
    },
  };
}
