/**
 * Notifications API route tests — Sprint 47.
 */

import { describe, expect, it, vi } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import { createAuditService } from '../audit/audit-service.js';
import { createInMemoryAuditRepository } from '../audit/in-memory-repository.js';
import type { AuthConfig } from '../auth/config.js';
import { createInMemoryNotificationRepository } from '../notifications/in-memory-repository.js';
import { createNotificationService } from '../notifications/notification-service.js';
import { createNotifyingAuditRepository } from '../notifications/notifying-audit-repository.js';
import type { QueueService } from '../queue/queue-service.js';

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.47.0-test',
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

const authConfig: AuthConfig = {
  enabled: true,
  jwtEnabled: false,
  jwtSecret: '',
  jwtExpiresInSeconds: 3600,
  apiKeyEnabled: true,
  apiKeys: ['notify-admin-key'],
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
  const notificationService = createNotificationService({
    repository: createInMemoryNotificationRepository(),
  });
  const auditService = createAuditService({
    repository: createNotifyingAuditRepository(
      createInMemoryAuditRepository(),
      notificationService,
    ),
  });
  const app = buildApp({
    config: baseConfig,
    authConfig,
    queueService: makeQueueService(),
    auditService,
    notificationService,
  });
  return { app, notificationService };
}

describe('GET /notifications', () => {
  it('returns 401 without auth when enabled', async () => {
    const { app } = buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/notifications' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('lists notifications derived from queue pause', async () => {
    const { app } = buildTestApp();
    await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { 'x-api-key': 'notify-admin-key' },
    });
    await new Promise((r) => setTimeout(r, 15));

    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { 'x-api-key': 'notify-admin-key' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { notifications: { type: string }[]; unreadCount: number };
    expect(body.notifications.some((n) => n.type === 'queue.paused')).toBe(true);
    expect(body.unreadCount).toBeGreaterThan(0);
    await app.close();
  });
});

describe('POST /notifications/:id/read', () => {
  it('marks notification as read', async () => {
    const { app } = buildTestApp();
    await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { 'x-api-key': 'notify-admin-key' },
    });
    await new Promise((r) => setTimeout(r, 15));

    const list = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { 'x-api-key': 'notify-admin-key' },
    });
    const id = (list.json() as { notifications: { id: string }[] }).notifications[0]?.id;
    expect(id).toBeTruthy();

    const read = await app.inject({
      method: 'POST',
      url: `/notifications/${id}/read`,
      headers: { 'x-api-key': 'notify-admin-key' },
    });
    expect(read.statusCode).toBe(200);
    const updated = read.json() as { notification: { read: boolean } };
    expect(updated.notification.read).toBe(true);
    await app.close();
  });
});

describe('POST /notifications/read-all', () => {
  it('marks all notifications read', async () => {
    const { app } = buildTestApp();
    await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { 'x-api-key': 'notify-admin-key' },
    });
    await app.inject({
      method: 'POST',
      url: '/queue/resume',
      headers: { 'x-api-key': 'notify-admin-key' },
    });
    await new Promise((r) => setTimeout(r, 15));

    const res = await app.inject({
      method: 'POST',
      url: '/notifications/read-all',
      headers: { 'x-api-key': 'notify-admin-key' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { marked: number };
    expect(body.marked).toBeGreaterThan(0);

    const list = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { 'x-api-key': 'notify-admin-key' },
    });
    expect((list.json() as { unreadCount: number }).unreadCount).toBe(0);
    await app.close();
  });
});
