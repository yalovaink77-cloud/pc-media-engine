/**
 * Notifications API smoke — Sprint 47.
 */

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import { createAuditService } from '../src/audit/audit-service.js';
import { createInMemoryAuditRepository } from '../src/audit/in-memory-repository.js';
import type { AuthConfig } from '../src/auth/config.js';
import { signJwt } from '../src/auth/jwt.js';
import type { ContentComposerService } from '../src/composer/types.js';
import { createInMemoryNotificationRepository } from '../src/notifications/in-memory-repository.js';
import { createNotificationService } from '../src/notifications/notification-service.js';
import { createNotifyingAuditRepository } from '../src/notifications/notifying-audit-repository.js';
import type { ProviderConfigService } from '../src/providers/types.js';
import type { PublisherManagementService } from '../src/publishers/types.js';
import type { QueueService } from '../src/queue/queue-service.js';

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
}
function fail(label: string): never {
  console.error(`  ✗ ${label}`);
  process.exit(1);
}
function assert(cond: boolean, label: string): void {
  if (!cond) fail(label);
  pass(label);
}
function section(title: string): void {
  console.log(`\n[${title}]`);
}

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.47.0-smoke',
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

const JWT_SECRET = 'notifications-smoke-secret-at-least-32!!';

const authConfig: AuthConfig = {
  enabled: true,
  jwtEnabled: true,
  jwtSecret: JWT_SECRET,
  jwtExpiresInSeconds: 3600,
  apiKeyEnabled: true,
  apiKeys: ['smoke-admin-key'],
  apiKeyRoles: {},
  defaultJwtRole: 'publisher',
  defaultApiKeyRole: 'admin',
};

function token(role: string): string {
  return signJwt({ sub: 'smoke', role }, JWT_SECRET, 3600);
}

function buildSmokeApp(extra: Partial<AppOptions> = {}) {
  const notificationService = createNotificationService({
    repository: createInMemoryNotificationRepository(),
  });
  const auditService = createAuditService({
    repository: createNotifyingAuditRepository(
      createInMemoryAuditRepository(),
      notificationService,
    ),
  });
  return buildApp({
    config: baseConfig,
    authConfig,
    auditService,
    notificationService,
    ...extra,
  });
}

function queueService(): QueueService {
  const noop = async () => undefined;
  return {
    getStatus: async () => ({
      paused: false,
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
    }),
    pause: noop,
    resume: noop,
    drain: noop,
    retryJob: noop,
    removeJob: noop,
    listJobs: async () => ({ jobs: [], total: 0, limit: 50, offset: 0 }),
    getJob: async () => {
      throw new Error('not found');
    },
  };
}

function composerService(): ContentComposerService {
  return {
    listEligibleAssets: async () => ({ assets: [], total: 0, limit: 50, offset: 0 }),
    getComposerAsset: async () => null,
    validate: async () => ({ ready: true, messages: [], warnings: [] }),
    publish: async () => ({
      assetId: 'asset-1',
      accepted: [{ publisherId: 'wordpress', jobId: 'job-1' }],
      skipped: [],
      failures: [{ publisherId: 'ghost', reason: 'Publisher unavailable' }],
    }),
    bulkPublish: async () => ({
      accepted: [],
      skipped: [],
      failures: [],
      summary: { assets: 0, publishers: 0, pairs: 0, accepted: 0, skipped: 0, failures: 0 },
    }),
    schedule: async () => ({
      assetId: 'asset-1',
      scheduledFor: '2026-08-01T10:00:00.000Z',
      accepted: [],
      skipped: [],
      failures: [],
    }),
  };
}

function publisherService(): PublisherManagementService {
  const item = {
    id: 'wordpress',
    displayName: 'WordPress',
    version: '1',
    enabled: true,
    capabilities: {} as never,
    supportsHealthCheck: true,
  };
  return {
    listPublishers: () => [item],
    getPublisher: (id) => (id === 'wordpress' ? item : null),
    checkHealth: async () => ({ healthy: false, latency: 99, message: 'connection refused' }),
  };
}

function providerConfigService(): ProviderConfigService {
  return {
    listConfigs: () => ({ providers: [], count: 0 }),
    getConfig: () => null,
    validateConfig: () => ({ valid: false, errors: ['missing key'], warnings: [] }),
    updateConfig: () => null,
  };
}

async function listTypes(app: ReturnType<typeof buildApp>): Promise<string[]> {
  const res = await app.inject({
    method: 'GET',
    url: '/notifications',
    headers: { 'x-api-key': 'smoke-admin-key' },
  });
  const body = res.json() as { notifications: { type: string }[] };
  return body.notifications.map((n) => n.type);
}

async function main(): Promise<void> {
  section('Publish success');
  {
    const app = buildSmokeApp({
      composerService: composerService(),
      publishingEnqueuer: { enqueue: async () => 'job-1', close: async () => {} },
    });
    await app.inject({
      method: 'POST',
      url: '/composer/publish',
      headers: { authorization: `Bearer ${token('publisher')}` },
      payload: { assetId: 'asset-1', publisherIds: ['wordpress', 'ghost'] },
    });
    await new Promise((r) => setTimeout(r, 15));
    const types = await listTypes(app);
    assert(types.includes('publish.completed'), 'publish success notification');
    assert(types.includes('publish.failed'), 'publish failure notification');
    await app.close();
  }

  section('Queue events');
  {
    const app = buildSmokeApp({ queueService: queueService() });
    await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { 'x-api-key': 'smoke-admin-key' },
    });
    await new Promise((r) => setTimeout(r, 15));
    const types = await listTypes(app);
    assert(types.includes('queue.paused'), 'queue paused notification');
    await app.close();
  }

  section('Provider events');
  {
    const app = buildSmokeApp({
      publisherService: publisherService(),
      providerConfigService: providerConfigService(),
    });
    await app.inject({
      method: 'GET',
      url: '/publishers/wordpress/health',
      headers: { 'x-api-key': 'smoke-admin-key' },
    });
    await new Promise((r) => setTimeout(r, 15));
    const types = await listTypes(app);
    assert(types.includes('provider.unhealthy'), 'provider unhealthy notification');
    await app.close();
  }

  section('Security events');
  {
    const app = buildSmokeApp({ queueService: queueService() });
    await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { authorization: `Bearer ${token('viewer')}` },
    });
    await new Promise((r) => setTimeout(r, 15));
    const types = await listTypes(app);
    assert(types.includes('security.rbac_denied'), 'rbac denied notification');
    await app.close();
  }

  section('Mark read');
  {
    const app = buildSmokeApp({ queueService: queueService() });
    await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { 'x-api-key': 'smoke-admin-key' },
    });
    await new Promise((r) => setTimeout(r, 15));
    const list = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { 'x-api-key': 'smoke-admin-key' },
    });
    const id = (list.json() as { notifications: { id: string }[] }).notifications[0]?.id;
    assert(Boolean(id), 'notification listed');
    const read = await app.inject({
      method: 'POST',
      url: `/notifications/${id}/read`,
      headers: { 'x-api-key': 'smoke-admin-key' },
    });
    assert(read.statusCode === 200, 'mark read succeeds');
    const allRead = await app.inject({
      method: 'POST',
      url: '/notifications/read-all',
      headers: { 'x-api-key': 'smoke-admin-key' },
    });
    assert(allRead.statusCode === 200, 'read-all succeeds');
    await app.close();
  }

  console.log('\n✅  All notifications API smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
