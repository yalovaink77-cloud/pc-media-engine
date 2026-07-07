/**
 * Audit / Activity API smoke — Sprint 46.
 */

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import { createAuditService } from '../src/audit/audit-service.js';
import { systemActor } from '../src/audit/helpers.js';
import { createInMemoryAuditRepository } from '../src/audit/in-memory-repository.js';
import type { AuthConfig } from '../src/auth/config.js';
import { signJwt } from '../src/auth/jwt.js';
import type { ContentComposerService } from '../src/composer/types.js';
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
  version: '0.46.0-smoke',
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

const JWT_SECRET = 'audit-smoke-secret-at-least-32-chars!!';

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
      skipped: [{ publisherId: 'ghost', reason: 'Duplicate slug' }],
      failures: [],
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
    checkHealth: async () => ({ healthy: true, latency: 12, message: 'ok' }),
  };
}

function providerConfigService(): ProviderConfigService {
  return {
    listConfigs: () => ({ providers: [], count: 0 }),
    getConfig: () => null,
    validateConfig: () => ({ valid: true, errors: [], warnings: [] }),
    updateConfig: () => null,
  };
}

async function listTypes(app: ReturnType<typeof buildApp>): Promise<string[]> {
  const res = await app.inject({
    method: 'GET',
    url: '/activity',
    headers: { 'x-api-key': 'smoke-admin-key' },
  });
  const body = res.json() as { events: { type: string }[] };
  return body.events.map((e) => e.type);
}

async function main(): Promise<void> {
  const repository = createInMemoryAuditRepository();
  const auditService = createAuditService({ repository });

  section('Startup events');
  {
    auditService.record({
      type: 'system.startup',
      severity: 'info',
      actor: systemActor(),
      metadata: { version: baseConfig.version },
    });
    pass('startup event recorded');
  }

  section('Publish events');
  {
    const app = buildApp({
      config: baseConfig,
      authConfig,
      composerService: composerService(),
      publishingEnqueuer: { enqueue: async () => 'job-1', close: async () => {} },
      auditService,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/composer/publish',
      headers: { authorization: `Bearer ${token('publisher')}` },
      payload: { assetId: 'asset-1', publisherIds: ['wordpress', 'ghost'] },
    });
    assert(res.statusCode === 202, 'publish accepted');
    await new Promise((r) => setTimeout(r, 15));
    const types = await listTypes(app);
    assert(types.includes('composer.publish'), 'composer.publish recorded');
    assert(types.includes('publishing.queued'), 'publishing.queued recorded');
    assert(types.includes('publishing.duplicate_skipped'), 'duplicate skipped recorded');
    await app.close();
  }

  section('Queue events');
  {
    const app = buildApp({
      config: baseConfig,
      authConfig,
      queueService: queueService(),
      auditService,
    });
    await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { 'x-api-key': 'smoke-admin-key' },
    });
    await new Promise((r) => setTimeout(r, 15));
    const types = await listTypes(app);
    assert(types.includes('queue.pause'), 'queue.pause recorded');
    await app.close();
  }

  section('Provider events');
  {
    const app = buildApp({
      config: baseConfig,
      authConfig,
      publisherService: publisherService(),
      providerConfigService: providerConfigService(),
      auditService,
    });
    await app.inject({
      method: 'GET',
      url: '/publishers/wordpress/health',
      headers: { 'x-api-key': 'smoke-admin-key' },
    });
    await new Promise((r) => setTimeout(r, 15));
    const types = await listTypes(app);
    assert(types.includes('provider.health_check'), 'provider.health_check recorded');
    await app.close();
  }

  section('RBAC events');
  {
    const app = buildApp({
      config: baseConfig,
      authConfig,
      queueService: queueService(),
      auditService,
    });
    await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { authorization: `Bearer ${token('viewer')}` },
    });
    await new Promise((r) => setTimeout(r, 15));
    const types = await listTypes(app);
    assert(types.includes('auth.rbac_denied'), 'auth.rbac_denied recorded');
    await app.close();
  }

  section('Activity API');
  {
    const app = buildApp({
      config: baseConfig,
      authConfig,
      auditService,
    });
    const list = await app.inject({
      method: 'GET',
      url: '/activity?type=system.startup',
      headers: { 'x-api-key': 'smoke-admin-key' },
    });
    assert(list.statusCode === 200, 'GET /activity returns 200');
    const events = list.json() as { events: { id: string }[] };
    const id = events.events[0]?.id;
    assert(Boolean(id), 'startup event listed');
    const detail = await app.inject({
      method: 'GET',
      url: `/activity/${id}`,
      headers: { 'x-api-key': 'smoke-admin-key' },
    });
    assert(detail.statusCode === 200, 'GET /activity/:id returns event');
    await app.close();
  }

  console.log('\n✅  All audit API smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
