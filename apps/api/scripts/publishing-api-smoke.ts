/**
 * Offline smoke test for the Publishing Management API (Sprint 26).
 *
 * Builds the Fastify app with in-memory mocks and exercises all three
 * publishing endpoints via fastify.inject() — no network, no database required.
 *
 * Run with:  pnpm publishing-api:smoke
 */
import type { PublishedContent } from '@pcme/database';

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import type { PublishedContentFinder } from '../src/routes/publishing.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
}

function fail(label: string, detail?: unknown): never {
  console.error(`  ✗ ${label}`, detail ?? '');
  process.exit(1);
}

function assert(condition: boolean, label: string, detail?: unknown): void {
  if (!condition) fail(label, detail);
  pass(label);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2024-06-01T12:00:00.000Z');

function makeRecord(id: string, overrides: Partial<PublishedContent> = {}): PublishedContent {
  return {
    id,
    organizationId: 'org-001',
    projectId: 'proj-abc',
    assetId: 'asset-xyz',
    slug: `article-${id}`,
    publisher: 'mock',
    externalId: `ext-${id}`,
    url: `https://example.com/posts/${id}`,
    status: 'PUBLISHED' as PublishedContent['status'],
    publishedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as PublishedContent;
}

const sampleRecords: PublishedContent[] = [
  makeRecord('rec-001', { projectId: 'proj-abc', publisher: 'mock' }),
  makeRecord('rec-002', { projectId: 'proj-abc', publisher: 'wordpress' }),
  makeRecord('rec-003', { projectId: 'proj-xyz', publisher: 'mock' }),
];

function makeMockRepo(records: PublishedContent[]): PublishedContentFinder {
  return {
    async findHistory(opts) {
      let results = [...records];
      if (opts.projectId) results = results.filter((r) => r.projectId === opts.projectId);
      if (opts.assetId) results = results.filter((r) => r.assetId === opts.assetId);
      if (opts.publisher) results = results.filter((r) => r.publisher === opts.publisher);
      return results.slice(0, opts.limit);
    },
    async findById(id) {
      return records.find((r) => r.id === id) ?? null;
    },
  };
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const app = buildApp({ config: baseConfig, publishedContentRepo: makeMockRepo(sampleRecords) });

  try {
    // -----------------------------------------------------------------------
    console.log('\n[1] GET /publishing/health');
    {
      const res = await app.inject({ method: 'GET', url: '/publishing/health' });
      assert(res.statusCode === 200, 'status 200');
      const body = res.json<{
        status: string;
        publisherDriver: string;
        queueEnabled: boolean;
        retryConfig: { maxRetries: number; backoffMs: number };
        schedulerEnabled: boolean;
        duplicateDetectionEnabled: boolean;
        aiMetadataProvider: string;
        workerVersion: string;
      }>();
      assert(body.status === 'ok', 'body.status == ok');
      assert(
        body.publisherDriver === 'mock',
        `publisherDriver = mock (got ${body.publisherDriver})`,
      );
      assert(body.queueEnabled === false, 'queueEnabled = false');
      assert(body.retryConfig.maxRetries === 3, 'retryConfig.maxRetries = 3');
      assert(body.retryConfig.backoffMs === 5000, 'retryConfig.backoffMs = 5000');
      assert(body.schedulerEnabled === true, 'schedulerEnabled = true');
      assert(body.duplicateDetectionEnabled === true, 'duplicateDetectionEnabled = true');
      assert(body.aiMetadataProvider === 'none', 'aiMetadataProvider = none');
      assert(body.workerVersion === '0.0.0-smoke', 'workerVersion = 0.0.0-smoke');
    }

    // -----------------------------------------------------------------------
    console.log('\n[2] GET /publishing/history (all records)');
    {
      const res = await app.inject({ method: 'GET', url: '/publishing/history' });
      assert(res.statusCode === 200, 'status 200');
      const body = res.json<{ items: unknown[]; count: number }>();
      assert(body.count === 3, `count = 3 (got ${body.count})`);
      assert(Array.isArray(body.items), 'items is array');
    }

    // -----------------------------------------------------------------------
    console.log('\n[3] GET /publishing/history?projectId=proj-abc (filtering)');
    {
      const res = await app.inject({
        method: 'GET',
        url: '/publishing/history?projectId=proj-abc',
      });
      assert(res.statusCode === 200, 'status 200');
      const body = res.json<{ items: Array<{ projectId: string }>; count: number }>();
      assert(body.count === 2, `count = 2 (got ${body.count})`);
      assert(
        body.items.every((i) => i.projectId === 'proj-abc'),
        'all items have projectId = proj-abc',
      );
    }

    // -----------------------------------------------------------------------
    console.log('\n[4] GET /publishing/history?publisher=wordpress (filtering)');
    {
      const res = await app.inject({
        method: 'GET',
        url: '/publishing/history?publisher=wordpress',
      });
      assert(res.statusCode === 200, 'status 200');
      const body = res.json<{ items: Array<{ publisher: string }>; count: number }>();
      assert(body.count === 1, `count = 1 (got ${body.count})`);
      assert(body.items[0].publisher === 'wordpress', 'publisher = wordpress');
    }

    // -----------------------------------------------------------------------
    console.log('\n[5] GET /publishing/history?limit=1 (limit)');
    {
      const res = await app.inject({ method: 'GET', url: '/publishing/history?limit=1' });
      assert(res.statusCode === 200, 'status 200');
      const body = res.json<{ items: unknown[]; count: number }>();
      assert(body.count === 1, `count = 1 (got ${body.count})`);
    }

    // -----------------------------------------------------------------------
    console.log('\n[6] GET /publishing/history?limit=201 (limit validation)');
    {
      const res = await app.inject({ method: 'GET', url: '/publishing/history?limit=201' });
      assert(res.statusCode === 400, `status 400 (got ${res.statusCode})`);
      const body = res.json<{ error: string }>();
      assert(typeof body.error === 'string', 'error field present');
    }

    // -----------------------------------------------------------------------
    console.log('\n[7] GET /publishing/rec-001 (single record)');
    {
      const res = await app.inject({ method: 'GET', url: '/publishing/rec-001' });
      assert(res.statusCode === 200, 'status 200');
      const body = res.json<{ id: string; projectId: string; publisher: string }>();
      assert(body.id === 'rec-001', `id = rec-001 (got ${body.id})`);
      assert(typeof body.projectId === 'string', 'projectId is string');
      assert(typeof body.publisher === 'string', 'publisher is string');
    }

    // -----------------------------------------------------------------------
    console.log('\n[8] GET /publishing/unknown-xyz (404)');
    {
      const res = await app.inject({ method: 'GET', url: '/publishing/unknown-xyz' });
      assert(res.statusCode === 404, `status 404 (got ${res.statusCode})`);
      const body = res.json<{ error: string }>();
      assert(body.error.includes('unknown-xyz'), 'error mentions the id');
    }

    console.log('\n✅  All publishing-api smoke checks passed.\n');
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error('Smoke failed:', err);
  process.exit(1);
});
