/**
 * Activity API route tests — Sprint 46.
 */

import { describe, expect, it, vi } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import { createAuditService } from '../audit/audit-service.js';
import { createInMemoryAuditRepository } from '../audit/in-memory-repository.js';
import type { AuthConfig } from '../auth/config.js';
import { signJwt } from '../auth/jwt.js';
import type { QueueService } from '../queue/queue-service.js';

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.46.0-test',
  databaseUrl: undefined,
  storageLocalRoot: '',
  defaultOrgId: '',
  defaultProjectId: 'proj-abc',
  defaultProjectSlug: 'piercingconnect',
  redisUrl: undefined,
  autoEnqueueProcessing: false,
  publisherDriver: 'mock',
  autoEnqueuePublishing: false,
  publishingMaxRetries: 3,
  publishingBackoffMs: 5000,
  aiMetadataProvider: 'none',
};

const JWT_SECRET = 'activity-test-secret-at-least-32-chars!';

const authConfig: AuthConfig = {
  enabled: true,
  jwtEnabled: true,
  jwtSecret: JWT_SECRET,
  jwtExpiresInSeconds: 3600,
  apiKeyEnabled: true,
  apiKeys: ['activity-admin-key'],
  apiKeyRoles: {},
  defaultJwtRole: 'operator',
  defaultApiKeyRole: 'admin',
};

function makeQueueService(): QueueService {
  return {
    getStatus: vi.fn().mockResolvedValue({
      paused: false,
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
    }),
    pause: vi.fn(),
    resume: vi.fn(),
    drain: vi.fn(),
    retryJob: vi.fn(),
    removeJob: vi.fn(),
    listJobs: vi.fn().mockResolvedValue({ jobs: [], total: 0, limit: 50, offset: 0 }),
    getJob: vi.fn(),
  };
}

function buildTestApp() {
  const repository = createInMemoryAuditRepository();
  const auditService = createAuditService({ repository });
  const app = buildApp({
    config: baseConfig,
    authConfig,
    queueService: makeQueueService(),
    auditService,
  });
  return { app, auditService };
}

describe('GET /activity', () => {
  it('returns 401 without auth when enabled', async () => {
    const { app } = buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/activity' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('lists recorded events with filters', async () => {
    const { app, auditService } = buildTestApp();
    auditService.record({
      type: 'queue.pause',
      severity: 'info',
      actor: { type: 'user', id: 'admin' },
      target: { type: 'queue', id: 'publishing' },
    });
    auditService.record({
      type: 'auth.rbac_denied',
      severity: 'warn',
      actor: { type: 'user', id: 'viewer' },
    });
    await new Promise((r) => setTimeout(r, 10));

    const res = await app.inject({
      method: 'GET',
      url: '/activity?type=queue.pause',
      headers: { 'x-api-key': 'activity-admin-key' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { events: { type: string }[]; total: number };
    expect(body.total).toBe(1);
    expect(body.events[0]?.type).toBe('queue.pause');
    await app.close();
  });
});

describe('GET /activity/:id', () => {
  it('returns complete event by id', async () => {
    const { app, auditService } = buildTestApp();
    auditService.record({
      type: 'system.startup',
      severity: 'info',
      actor: { type: 'system', id: 'api' },
      correlationId: 'startup-corr-test',
      metadata: { version: '0.46.0' },
    });
    await new Promise((r) => setTimeout(r, 10));

    const list = await app.inject({
      method: 'GET',
      url: '/activity?type=system.startup',
      headers: { 'x-api-key': 'activity-admin-key' },
    });
    const eventId = (list.json() as { events: { id: string }[] }).events[0]?.id;
    expect(eventId).toBeTruthy();

    const detail = await app.inject({
      method: 'GET',
      url: `/activity/${eventId}`,
      headers: { 'x-api-key': 'activity-admin-key' },
    });
    expect(detail.statusCode).toBe(200);
    const body = detail.json() as { type: string; correlationId: string };
    expect(body.type).toBe('system.startup');
    expect(body.correlationId).toBe('startup-corr-test');
    await app.close();
  });

  it('returns 404 for unknown id', async () => {
    const { app } = buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/activity/missing-id',
      headers: { 'x-api-key': 'activity-admin-key' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('audit integration', () => {
  it('records queue pause and rbac denied events', async () => {
    const { app } = buildTestApp();
    const token = signJwt({ sub: 'viewer', role: 'viewer' }, JWT_SECRET, 3600);

    await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { authorization: `Bearer ${token}` },
    });
    await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { 'x-api-key': 'activity-admin-key' },
    });
    await new Promise((r) => setTimeout(r, 15));

    const res = await app.inject({
      method: 'GET',
      url: '/activity',
      headers: { 'x-api-key': 'activity-admin-key' },
    });
    const body = res.json() as { events: { type: string }[] };
    const types = body.events.map((e) => e.type);
    expect(types).toContain('auth.rbac_denied');
    expect(types).toContain('queue.pause');
    await app.close();
  });
});
