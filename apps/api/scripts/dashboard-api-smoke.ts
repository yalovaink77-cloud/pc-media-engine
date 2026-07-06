/**
 * Offline smoke test for the Dashboard API (Sprint 27).
 *
 * Builds the Fastify app with in-memory mocks and exercises all three
 * dashboard endpoints via fastify.inject() — no network, no database required.
 *
 * Run with:  pnpm dashboard-api:smoke
 */
import type { PublishedContent } from '@pcme/database';

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import type { DashboardDataProvider } from '../src/routes/dashboard.js';

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
    assetId: `asset-${id}`,
    slug: `slug-${id}`,
    publisher: 'mock',
    externalId: `ext-${id}`,
    url: `https://example.com/posts/${id}`,
    status: 'published' as PublishedContent['status'],
    publishedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as PublishedContent;
}

const allRecords: PublishedContent[] = [
  ...Array.from({ length: 8 }, (_, i) => makeRecord(`pub-${String(i + 1).padStart(2, '0')}`)),
  makeRecord('draft-01', { status: 'draft' as PublishedContent['status'] }),
  makeRecord('fail-01', { status: 'failed' as PublishedContent['status'] }),
];

function makeMockRepo(): DashboardDataProvider {
  return {
    async getSummaryStats() {
      return {
        totalPublished: 8,
        totalDrafts: 1,
        totalFailed: 1,
        latestPublishedAt: NOW,
        publishers: [{ publisher: 'mock', count: 10 }],
      };
    },
    async findRecent(limit) {
      return allRecords.slice(0, limit);
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
  const app = buildApp({ config: baseConfig, dashboardRepo: makeMockRepo() });

  try {
    // -----------------------------------------------------------------------
    console.log('\n[1] GET /dashboard/health');
    {
      const res = await app.inject({ method: 'GET', url: '/dashboard/health' });
      assert(res.statusCode === 200, 'status 200');
      const body = res.json<{
        status: string;
        database: string;
        publishing: {
          publisherDriver: string;
          queueEnabled: boolean;
          retryConfig: { maxRetries: number; backoffMs: number };
        };
        version: string;
        env: string;
      }>();
      assert(body.status === 'ok', 'body.status == ok');
      assert(body.database === 'skipped', `database = skipped (got ${body.database})`);
      assert(body.publishing.publisherDriver === 'mock', `publisherDriver = mock`);
      assert(body.publishing.queueEnabled === false, 'queueEnabled = false');
      assert(body.publishing.retryConfig.maxRetries === 3, 'retryConfig.maxRetries = 3');
      assert(body.publishing.retryConfig.backoffMs === 5000, 'retryConfig.backoffMs = 5000');
      assert(body.version === '0.0.0-smoke', 'version = 0.0.0-smoke');
      assert(body.env === 'test', 'env = test');
    }

    // -----------------------------------------------------------------------
    console.log('\n[2] GET /dashboard/summary');
    {
      const res = await app.inject({ method: 'GET', url: '/dashboard/summary' });
      assert(res.statusCode === 200, 'status 200');
      const body = res.json<{
        totalPublished: number;
        totalDrafts: number;
        totalFailed: number;
        latestPublishedAt: string | null;
        publishers: Array<{ publisher: string; count: number }>;
        duplicateDetectionEnabled: boolean;
        schedulerEnabled: boolean;
        retryEnabled: boolean;
        aiProvider: string;
        publisherDriver: string;
      }>();
      assert(body.totalPublished === 8, `totalPublished = 8 (got ${body.totalPublished})`);
      assert(body.totalDrafts === 1, `totalDrafts = 1 (got ${body.totalDrafts})`);
      assert(body.totalFailed === 1, `totalFailed = 1 (got ${body.totalFailed})`);
      assert(typeof body.latestPublishedAt === 'string', 'latestPublishedAt is string');
      assert(body.publishers.length === 1, `publishers.length = 1 (got ${body.publishers.length})`);
      assert(body.publishers[0]?.publisher === 'mock', 'publishers[0].publisher = mock');
      assert(body.publishers[0]?.count === 10, `publishers[0].count = 10`);
      assert(body.duplicateDetectionEnabled === true, 'duplicateDetectionEnabled = true');
      assert(body.schedulerEnabled === true, 'schedulerEnabled = true');
      assert(body.retryEnabled === true, 'retryEnabled = true');
      assert(body.aiProvider === 'none', 'aiProvider = none');
      assert(body.publisherDriver === 'mock', 'publisherDriver = mock');
    }

    // -----------------------------------------------------------------------
    console.log('\n[3] GET /dashboard/recent (default limit 10)');
    {
      const res = await app.inject({ method: 'GET', url: '/dashboard/recent' });
      assert(res.statusCode === 200, 'status 200');
      const body = res.json<{ items: unknown[]; count: number }>();
      assert(body.count === 10, `count = 10 (got ${body.count})`);
      assert(Array.isArray(body.items), 'items is array');
    }

    // -----------------------------------------------------------------------
    console.log('\n[4] GET /dashboard/recent?limit=5');
    {
      const res = await app.inject({ method: 'GET', url: '/dashboard/recent?limit=5' });
      assert(res.statusCode === 200, 'status 200');
      const body = res.json<{ items: unknown[]; count: number }>();
      assert(body.count === 5, `count = 5 (got ${body.count})`);
    }

    // -----------------------------------------------------------------------
    console.log('\n[5] GET /dashboard/recent?limit=51 (limit validation)');
    {
      const res = await app.inject({ method: 'GET', url: '/dashboard/recent?limit=51' });
      assert(res.statusCode === 400, `status 400 (got ${res.statusCode})`);
      const body = res.json<{ error: string }>();
      assert(typeof body.error === 'string', 'error field present');
    }

    // -----------------------------------------------------------------------
    console.log('\n[6] GET /dashboard/summary — 503 when no repo');
    {
      const noRepoApp = buildApp({ config: baseConfig });
      const res = await noRepoApp.inject({ method: 'GET', url: '/dashboard/summary' });
      assert(res.statusCode === 503, `status 503 (got ${res.statusCode})`);
      await noRepoApp.close();
    }

    // -----------------------------------------------------------------------
    console.log('\n[7] GET /dashboard/recent — 503 when no repo');
    {
      const noRepoApp = buildApp({ config: baseConfig });
      const res = await noRepoApp.inject({ method: 'GET', url: '/dashboard/recent' });
      assert(res.statusCode === 503, `status 503 (got ${res.statusCode})`);
      await noRepoApp.close();
    }

    // -----------------------------------------------------------------------
    console.log('\n[8] GET /dashboard/health — works without repo (config-only)');
    {
      const noRepoApp = buildApp({ config: baseConfig });
      const res = await noRepoApp.inject({ method: 'GET', url: '/dashboard/health' });
      assert(res.statusCode === 200, `status 200 (got ${res.statusCode})`);
      await noRepoApp.close();
    }

    console.log('\n✅  All dashboard-api smoke checks passed.\n');
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error('Smoke failed:', err);
  process.exit(1);
});
