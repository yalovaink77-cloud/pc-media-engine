/**
 * Audit service tests — Sprint 46.
 */

import { describe, expect, it, vi } from 'vitest';

import { createAuditService } from '../audit/audit-service.js';
import type { AuditEvent, AuditRepository } from '../audit/types.js';

describe('AuditService', () => {
  it('records events fire-and-forget without throwing on repository failure', async () => {
    const repo: AuditRepository = {
      append: vi.fn().mockRejectedValue(new Error('disk full')),
      list: vi.fn().mockResolvedValue({ events: [], total: 0, limit: 50 }),
      findById: vi.fn().mockResolvedValue(null),
    };
    const service = createAuditService({ repository: repo });
    expect(() =>
      service.record({
        type: 'queue.pause',
        severity: 'info',
        actor: { type: 'user', id: 'op' },
      }),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.append).toHaveBeenCalled();
  });

  it('delegates list and getById to repository', async () => {
    const event: AuditEvent = {
      id: 'e1',
      type: 'system.startup',
      category: 'system',
      severity: 'info',
      actor: { type: 'system', id: 'api' },
      timestamp: new Date().toISOString(),
    };
    const repo: AuditRepository = {
      append: vi.fn(),
      list: vi.fn().mockResolvedValue({ events: [event], total: 1, limit: 50 }),
      findById: vi.fn().mockResolvedValue(event),
    };
    const service = createAuditService({ repository: repo });
    const list = await service.list({ type: 'system.startup' });
    expect(list.events).toHaveLength(1);
    const found = await service.getById('e1');
    expect(found?.id).toBe('e1');
  });
});
