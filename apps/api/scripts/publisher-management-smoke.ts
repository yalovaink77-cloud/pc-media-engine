/**
 * Publisher management API smoke — Sprint 37.
 *
 * Offline — uses mocked PublisherManagementService via fastify.inject().
 *
 * Run: pnpm --filter @pcme/api publisher-management:smoke
 */

import type { PublisherCapabilities } from '@pcme/publisher-sdk';

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import type { PublisherManagementService } from '../src/publishers/types.js';

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
}
function fail(label: string, detail?: unknown): never {
  console.error(`  ✗ ${label}`, detail ?? '');
  process.exit(1);
}
function assert(cond: boolean, label: string, detail?: unknown): void {
  if (!cond) fail(label, detail);
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
  version: '0.0.0-smoke',
  databaseUrl: undefined,
  storageLocalRoot: '',
  defaultOrgId: '',
  defaultProjectId: '',
  defaultProjectSlug: 'piercingconnect',
  redisUrl: undefined,
  autoEnqueueProcessing: false,
  publisherDriver: 'mock',
  autoEnqueuePublishing: false,
  publishingMaxRetries: 3,
  publishingBackoffMs: 5000,
  aiMetadataProvider: 'none',
};

const capabilities: PublisherCapabilities = {
  mediaUpload: true,
  postCreation: true,
  drafts: true,
  tags: true,
  categories: true,
  featuredImages: true,
  scheduling: false,
  update: false,
  delete: false,
};

function makeMockService(): PublisherManagementService {
  return {
    listPublishers: () => [
      {
        id: 'wordpress',
        displayName: 'WordPress',
        version: '1.0.0',
        enabled: true,
        capabilities,
        supportsHealthCheck: true,
      },
      {
        id: 'ghost',
        displayName: 'Ghost',
        version: '1.0.0',
        enabled: false,
        capabilities: { ...capabilities, categories: false },
        supportsHealthCheck: true,
      },
    ],
    getPublisher: (id) => {
      if (id === 'wordpress') {
        return {
          id: 'wordpress',
          displayName: 'WordPress',
          version: '1.0.0',
          description: 'WordPress REST API publisher',
          enabled: true,
          capabilities,
          supportsHealthCheck: true,
          configurationRequirements: [
            { envVar: 'WORDPRESS_URL', required: true, description: 'Site URL' },
          ],
        };
      }
      if (id === 'ghost') {
        return {
          id: 'ghost',
          displayName: 'Ghost',
          version: '1.0.0',
          description: 'Ghost Admin API publisher',
          enabled: false,
          capabilities: { ...capabilities, categories: false },
          supportsHealthCheck: true,
          configurationRequirements: [
            { envVar: 'GHOST_URL', required: true, description: 'Site URL' },
          ],
        };
      }
      return null;
    },
    checkHealth: async (id) => {
      if (id === 'wordpress') {
        return { healthy: true, latency: 42, message: 'Authenticated as admin' };
      }
      if (id === 'ghost') {
        return {
          healthy: false,
          latency: 0,
          message: 'Provider is disabled — required configuration is missing',
        };
      }
      return { healthy: false, latency: 0, message: 'Not found' };
    },
  };
}

async function main(): Promise<void> {
  const app = buildApp({
    config: baseConfig,
    publisherService: makeMockService(),
  });
  await app.ready();

  section('1 · List publishers');
  {
    const res = await app.inject({ method: 'GET', url: '/publishers' });
    assert(res.statusCode === 200, 'GET /publishers returns 200');
    const body = res.json() as { publishers: Array<{ id: string }>; count: number };
    assert(body.count === 2, 'returns two providers');
    assert(
      body.publishers.some((p) => p.id === 'wordpress'),
      'includes wordpress',
    );
    assert(
      body.publishers.some((p) => p.id === 'ghost'),
      'includes ghost',
    );
  }

  section('2 · Publisher detail');
  {
    const res = await app.inject({ method: 'GET', url: '/publishers/wordpress' });
    assert(res.statusCode === 200, 'GET /publishers/wordpress returns 200');
    const body = res.json() as { configurationRequirements: unknown[] };
    assert(body.configurationRequirements.length > 0, 'includes config requirements');
  }

  section('3 · Unknown publisher');
  {
    const res = await app.inject({ method: 'GET', url: '/publishers/unknown' });
    assert(res.statusCode === 404, 'returns 404 for unknown provider');
  }

  section('4 · Health check — healthy');
  {
    const res = await app.inject({ method: 'GET', url: '/publishers/wordpress/health' });
    assert(res.statusCode === 200, 'GET /publishers/wordpress/health returns 200');
    const body = res.json() as { healthy: boolean; latency: number; message: string };
    assert(body.healthy === true, 'wordpress is healthy');
    assert(body.latency === 42, 'latency reported');
  }

  section('5 · Health check — unavailable');
  {
    const res = await app.inject({ method: 'GET', url: '/publishers/ghost/health' });
    assert(res.statusCode === 200, 'health endpoint returns 200 even when unhealthy');
    const body = res.json() as { healthy: boolean; message: string };
    assert(body.healthy === false, 'ghost is unhealthy');
    assert(body.message.includes('configuration'), 'explains missing config');
  }

  await app.close();
  console.log('\n✅  All publisher management API smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
