/**
 * Audit service — Sprint 46.
 *
 * Fire-and-forget recording — failures never propagate to callers.
 */

import { newAuditEventId } from './in-memory-repository.js';
import type {
  AuditEvent,
  AuditEventInput,
  AuditListFilters,
  AuditListResult,
  AuditRepository,
  AuditService,
} from './types.js';
import { AUDIT_EVENT_CATEGORIES } from './types.js';

export type AuditServiceDeps = {
  repository: AuditRepository;
};

export function createAuditService(deps: AuditServiceDeps): AuditService {
  const { repository } = deps;

  function record(input: AuditEventInput): void {
    const event: AuditEvent = {
      id: input.id ?? newAuditEventId(),
      type: input.type,
      category: input.category ?? AUDIT_EVENT_CATEGORIES[input.type],
      severity: input.severity,
      actor: input.actor ?? { type: 'system', id: 'unknown' },
      target: input.target,
      correlationId: input.correlationId,
      metadata: input.metadata,
      timestamp: input.timestamp ?? new Date().toISOString(),
    };

    void repository.append(event).catch(() => {
      // Swallow — audit must never block or fail the main workflow.
    });
  }

  return {
    record,
    list(filters?: AuditListFilters): Promise<AuditListResult> {
      return repository.list(filters);
    },
    getById(id: string): Promise<AuditEvent | null> {
      return repository.findById(id);
    },
  };
}
