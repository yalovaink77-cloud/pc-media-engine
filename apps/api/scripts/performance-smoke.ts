/**
 * Performance toolkit smoke — Sprint 49.
 *
 * Offline validation of performance middleware, metrics fields, pagination
 * helpers, benchmark scripts, and documentation.
 *
 * Run: pnpm performance:smoke
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import type { MetricsSnapshot } from '../src/metrics.js';
import { MetricsService } from '../src/metrics.js';
import { clampLimit, clampOffset, parseStrictLimit } from '../src/pagination.js';

const ROOT = resolve(import.meta.dirname, '../../..');

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

function section(title: string): void {
  console.log(`\n[${title}]`);
}

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.0.0-performance-smoke',
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

const REQUIRED_FILES = [
  'apps/api/scripts/benchmark-api.ts',
  'apps/api/scripts/load-test-light.ts',
  'apps/worker/scripts/throughput-benchmark.ts',
  'apps/dashboard/scripts/render-benchmark.ts',
  'apps/api/src/pagination.ts',
  'apps/api/src/middleware/response-timing.ts',
  'apps/api/src/database-check-cache.ts',
  'apps/dashboard/src/limits.ts',
  'docs/performance/performance-guide.md',
  'docs/sprints/sprint-49-performance-scalability.md',
  'packages/database/prisma/migrations/20260707120000_sprint49_performance_indexes/migration.sql',
];

async function main(): Promise<void> {
  section('Performance assets');
  for (const rel of REQUIRED_FILES) {
    assert(existsSync(resolve(ROOT, rel)), `exists: ${rel}`);
  }

  section('Pagination helpers');
  assert(clampLimit(undefined, 50, 200) === 50, 'clampLimit default');
  assert(clampLimit('999', 50, 200) === 200, 'clampLimit max');
  assert(clampOffset('-1') === 0, 'clampOffset negative');
  assert(parseStrictLimit('10', 200, 50).value === 10, 'parseStrictLimit valid');
  assert(parseStrictLimit('999', 200, 50).error !== undefined, 'parseStrictLimit rejects over max');

  section('Extended metrics');
  {
    const svc = new MetricsService(new Date(Date.now() - 60_000).toISOString());
    svc.inc('processedTotal', 120);
    svc.inc('publishedTotal', 90);
    svc.inc('failuresTotal', 10);
    svc.set('queueWaiting', 3);
    svc.set('queueActive', 2);
    svc.recordResponseTime(42);

    const snap = svc.snapshot();
    assert(snap.apiResponseTimeMs === 42, 'apiResponseTimeMs recorded');
    assert(snap.workerProcessedPerMinute > 0, 'workerProcessedPerMinute > 0');
    assert(
      snap.publishSuccessRate === 90,
      `publishSuccessRate = 90 (got ${snap.publishSuccessRate})`,
    );
    assert(snap.queueDepthTotal === 5, 'queueDepthTotal = waiting + active');
  }

  section('Response timing middleware');
  {
    const svc = new MetricsService();
    const app = buildApp({ config: baseConfig, metricsService: svc });
    try {
      const res = await app.inject({ method: 'GET', url: '/health' });
      assert(res.statusCode === 200, 'GET /health returns 200');
      assert(res.headers['x-response-time-ms'] !== undefined, 'x-response-time-ms header present');
      assert(res.headers['cache-control'] === 'no-store', 'health has no-store cache');
      assert(svc.snapshot().apiResponseTimeMs >= 0, 'metrics records response time');
    } finally {
      await app.close();
    }
  }

  section('Cache headers on version');
  {
    const app = buildApp({ config: baseConfig });
    try {
      const res = await app.inject({ method: 'GET', url: '/version' });
      assert(
        res.headers['cache-control']?.includes('max-age=60') === true,
        'version has short cache',
      );
    } finally {
      await app.close();
    }
  }

  section('GET /metrics extended fields');
  {
    const svc = new MetricsService();
    svc.inc('publishedTotal', 2);
    const app = buildApp({ config: baseConfig, metricsService: svc });
    try {
      const res = await app.inject({ method: 'GET', url: '/metrics' });
      const body = res.json<MetricsSnapshot>();
      assert(typeof body.apiResponseTimeMs === 'number', 'metrics includes apiResponseTimeMs');
      assert(
        typeof body.workerProcessedPerMinute === 'number',
        'metrics includes workerProcessedPerMinute',
      );
      assert(typeof body.publishSuccessRate === 'number', 'metrics includes publishSuccessRate');
      assert(typeof body.queueDepthTotal === 'number', 'metrics includes queueDepthTotal');
      assert(res.headers['cache-control'] === 'no-store', 'metrics has no-store cache');
    } finally {
      await app.close();
    }
  }

  section('Schema index migration');
  {
    const sql = readFileSync(
      resolve(
        ROOT,
        'packages/database/prisma/migrations/20260707120000_sprint49_performance_indexes/migration.sql',
      ),
      'utf8',
    );
    assert(sql.includes('published_content_project_id_published_at_idx'), 'history index defined');
    assert(sql.includes('published_content_status_idx'), 'status index defined');
  }

  section('Offline benchmark scripts');
  {
    execSync('pnpm exec tsx scripts/benchmark-api.ts --offline', {
      cwd: resolve(ROOT, 'apps/api'),
      stdio: 'pipe',
    });
    pass('benchmark-api.ts --offline');

    execSync('pnpm exec tsx scripts/load-test-light.ts --offline', {
      cwd: resolve(ROOT, 'apps/api'),
      stdio: 'pipe',
    });
    pass('load-test-light.ts --offline');

    execSync('pnpm --filter @pcme/worker exec tsx scripts/throughput-benchmark.ts --offline', {
      cwd: ROOT,
      stdio: 'pipe',
    });
    pass('throughput-benchmark.ts --offline');

    execSync('pnpm --filter @pcme/dashboard exec tsx scripts/render-benchmark.ts --offline', {
      cwd: ROOT,
      stdio: 'pipe',
    });
    pass('render-benchmark.ts --offline');
  }

  console.log('\n✅  All performance smoke checks passed.\n');
}

main().catch((err: unknown) => {
  console.error('Performance smoke failed:', err);
  process.exit(1);
});
