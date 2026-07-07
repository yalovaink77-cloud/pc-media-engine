/**
 * Audit repository tests — Sprint 46.
 */

import { describe, expect, it } from 'vitest';

import { createInMemoryAuditRepository } from '../audit/in-memory-repository.js';
import type { AuditEvent } from '../audit/types.js';

function sampleEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: overrides.id ?? 'evt-1',
    type: 'queue.pause',
    category: 'queue',
    severity: 'info',
    actor: { type: 'user', id: 'admin', role: 'admin' },
    target: { type: 'queue', id: 'publishing' },
    correlationId: 'corr-1',
    metadata: { test: true },
    timestamp: '2026-07-06T10:00:00.000Z',
    ...overrides,
  };
}

describe('InMemoryAuditRepository', () => {
  it('appends and lists events newest first', async () => {
    const repo = createInMemoryAuditRepository();
    await repo.append(sampleEvent({ id: 'a', timestamp: '2026-07-06T09:00:00.000Z' }));
    await repo.append(sampleEvent({ id: 'b', timestamp: '2026-07-06T11:00:00.000Z' }));
    const result = await repo.list();
    expect(result.events.map((e) => e.id)).toEqual(['b', 'a']);
    expect(result.total).toBe(2);
  });

  it('filters by type, actor, and target', async () => {
    const repo = createInMemoryAuditRepository();
    await repo.append(sampleEvent({ id: 'a', type: 'queue.pause' }));
    await repo.append(
      sampleEvent({
        id: 'b',
        type: 'auth.rbac_denied',
        actor: { type: 'user', id: 'viewer-1', role: 'viewer' },
        target: { type: 'permission', id: 'queue:write' },
      }),
    );
    const byType = await repo.list({ type: 'auth.rbac_denied' });
    expect(byType.events).toHaveLength(1);
    expect(byType.events[0]?.id).toBe('b');

    const byActor = await repo.list({ actor: 'viewer' });
    expect(byActor.events).toHaveLength(1);

    const byTarget = await repo.list({ target: 'queue:write' });
    expect(byTarget.events).toHaveLength(1);
  });

  it('finds event by id', async () => {
    const repo = createInMemoryAuditRepository();
    await repo.append(sampleEvent({ id: 'find-me' }));
    const found = await repo.findById('find-me');
    expect(found?.type).toBe('queue.pause');
    expect(await repo.findById('missing')).toBeNull();
  });
});
