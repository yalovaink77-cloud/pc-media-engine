/**
 * RBAC API smoke — Sprint 45.
 */

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import type { AuthConfig } from '../src/auth/config.js';
import { signJwt } from '../src/auth/jwt.js';
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
  version: '0.45.0-smoke',
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

const JWT_SECRET = 'rbac-smoke-secret-at-least-32-chars!!';

const authConfig: AuthConfig = {
  enabled: true,
  jwtEnabled: true,
  jwtSecret: JWT_SECRET,
  jwtExpiresInSeconds: 3600,
  apiKeyEnabled: true,
  apiKeys: ['smoke-admin-key', 'smoke-viewer-key'],
  apiKeyRoles: { 'smoke-viewer-key': 'viewer' },
  defaultJwtRole: 'operator',
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

async function main(): Promise<void> {
  section('Auth disabled');
  {
    const app = buildApp({
      config: baseConfig,
      authConfig: { ...authConfig, enabled: false },
      queueService: queueService(),
    });
    const res = await app.inject({ method: 'POST', url: '/queue/pause' });
    assert(res.statusCode === 200, 'auth disabled allows queue pause');
    await app.close();
  }

  section('Admin');
  {
    const app = buildApp({ config: baseConfig, authConfig, queueService: queueService() });
    const res = await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { authorization: `Bearer ${token('admin')}` },
    });
    assert(res.statusCode === 200, 'admin can pause queue');
    await app.close();
  }

  section('Operator');
  {
    const app = buildApp({ config: baseConfig, authConfig, queueService: queueService() });
    const res = await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { authorization: `Bearer ${token('operator')}` },
    });
    assert(res.statusCode === 200, 'operator can pause queue');
    await app.close();
  }

  section('Publisher');
  {
    const app = buildApp({
      config: baseConfig,
      authConfig,
      composerService: {
        listEligibleAssets: async () => ({ assets: [], total: 0, limit: 50, offset: 0 }),
        getComposerAsset: async () => null,
        validate: async () => ({ ready: true, messages: [], warnings: [] }),
        publish: async () => ({ assetId: 'a', accepted: [], skipped: [], failures: [] }),
        bulkPublish: async () => ({
          accepted: [],
          skipped: [],
          failures: [],
          summary: { assets: 0, publishers: 0, pairs: 0, accepted: 0, skipped: 0, failures: 0 },
        }),
        schedule: async () => ({
          assetId: 'a',
          scheduledFor: '',
          accepted: [],
          skipped: [],
          failures: [],
        }),
      },
      publishingEnqueuer: { enqueue: async () => 'job-1', close: async () => {} },
    });
    const ok = await app.inject({
      method: 'POST',
      url: '/composer/publish',
      headers: { authorization: `Bearer ${token('publisher')}` },
      payload: { assetId: 'asset-1', publisherIds: ['wordpress'] },
    });
    assert(ok.statusCode === 202, 'publisher can publish');
    const denied = await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { authorization: `Bearer ${token('publisher')}` },
    });
    assert(denied.statusCode === 403, 'publisher denied queue write');
    await app.close();
  }

  section('Viewer');
  {
    const app = buildApp({ config: baseConfig, authConfig, queueService: queueService() });
    const jobs = await app.inject({
      method: 'GET',
      url: '/jobs',
      headers: { 'x-api-key': 'smoke-viewer-key' },
    });
    assert(jobs.statusCode === 200, 'viewer can read jobs');
    const denied = await app.inject({
      method: 'POST',
      url: '/queue/pause',
      headers: { 'x-api-key': 'smoke-viewer-key' },
    });
    assert(denied.statusCode === 403, 'viewer denied queue write');
    await app.close();
  }

  console.log('\n✅  All RBAC API smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
