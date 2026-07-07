/**
 * In-memory audit repository — Sprint 46.
 */

import { randomUUID } from 'node:crypto';

import type { AuditEvent, AuditListFilters, AuditListResult, AuditRepository } from './types.js';
import { DEFAULT_AUDIT_LIMIT, MAX_AUDIT_LIMIT } from './types.js';

export function createInMemoryAuditRepository(): AuditRepository {
  const events: AuditEvent[] = [];

  return {
    async append(event: AuditEvent): Promise<void> {
      events.push(event);
    },

    async list(filters: AuditListFilters = {}): Promise<AuditListResult> {
      const limit = Math.min(Math.max(filters.limit ?? DEFAULT_AUDIT_LIMIT, 1), MAX_AUDIT_LIMIT);
      let filtered = [...events];

      if (filters.type) {
        filtered = filtered.filter((e) => e.type === filters.type);
      }
      if (filters.actor) {
        const actor = filters.actor.toLowerCase();
        filtered = filtered.filter((e) => e.actor.id.toLowerCase().includes(actor));
      }
      if (filters.target) {
        const target = filters.target.toLowerCase();
        filtered = filtered.filter(
          (e) =>
            e.target?.id.toLowerCase().includes(target) ||
            e.target?.type.toLowerCase().includes(target),
        );
      }
      if (filters.start) {
        const startMs = Date.parse(filters.start);
        if (!Number.isNaN(startMs)) {
          filtered = filtered.filter((e) => Date.parse(e.timestamp) >= startMs);
        }
      }
      if (filters.end) {
        const endMs = Date.parse(filters.end);
        if (!Number.isNaN(endMs)) {
          filtered = filtered.filter((e) => Date.parse(e.timestamp) <= endMs);
        }
      }

      filtered.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
      const total = filtered.length;
      const page = filtered.slice(0, limit);

      return { events: page, total, limit };
    },

    async findById(id: string): Promise<AuditEvent | null> {
      return events.find((e) => e.id === id) ?? null;
    },
  };
}

export function newAuditEventId(): string {
  return randomUUID();
}
