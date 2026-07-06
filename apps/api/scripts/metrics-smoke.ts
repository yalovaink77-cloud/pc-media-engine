/**
 * Offline smoke test for Sprint 29 — Observability & Metrics.
 *
 * Tests MetricsService counters and the GET /metrics endpoint
 * via fastify.inject() — no network, no database, no Redis required.
 *
 * Run with:  pnpm metrics:smoke
 */
import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import type { MetricsSnapshot } from '../src/metrics.js';
import { MetricsService } from '../src/metrics.js';

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

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.0.0-metrics-smoke',
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
  aiMetadataProvider: 'openrouter',
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // -----------------------------------------------------------------------
  console.log('\n[1] MetricsService — counter accumulation');
  {
    const svc = new MetricsService();
    svc.inc('uploadsTotal', 10);
    svc.inc('publishedTotal', 7);
    svc.inc('retriesTotal', 2);
    svc.inc('failuresTotal', 1);
    svc.inc('duplicateSkipsTotal', 3);
    svc.inc('schedulerJobsTotal', 5);
    svc.set('queueWaiting', 2);
    svc.set('queueCompleted', 7);

    const snap = svc.snapshot();
    assert(snap.uploadsTotal === 10, 'uploadsTotal = 10');
    assert(snap.publishedTotal === 7, 'publishedTotal = 7');
    assert(snap.retriesTotal === 2, 'retriesTotal = 2');
    assert(snap.failuresTotal === 1, 'failuresTotal = 1');
    assert(snap.duplicateSkipsTotal === 3, 'duplicateSkipsTotal = 3');
    assert(snap.schedulerJobsTotal === 5, 'schedulerJobsTotal = 5');
    assert(snap.queueWaiting === 2, 'queueWaiting = 2');
    assert(snap.queueCompleted === 7, 'queueCompleted = 7');
    assert(typeof snap.collectedAt === 'string', 'collectedAt is string');
  }

  // -----------------------------------------------------------------------
  console.log('\n[2] MetricsService — reset');
  {
    const svc = new MetricsService();
    svc.inc('uploadsTotal', 99);
    svc.reset();
    assert(svc.snapshot().uploadsTotal === 0, 'uploadsTotal = 0 after reset');
  }

  // -----------------------------------------------------------------------
  console.log('\n[3] GET /metrics — no MetricsService (all-zero defaults)');
  {
    const app = buildApp({ config: baseConfig });
    try {
      const res = await app.inject({ method: 'GET', url: '/metrics' });
      assert(res.statusCode === 200, `status 200 (got ${res.statusCode})`);
      const body = res.json<MetricsSnapshot>();
      assert(body.uploadsTotal === 0, 'uploadsTotal = 0');
      assert(body.publishedTotal === 0, 'publishedTotal = 0');
      assert(typeof body.collectedAt === 'string', 'collectedAt present');
    } finally {
      await app.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[4] GET /metrics — with MetricsService injected');
  {
    const svc = new MetricsService();
    svc.inc('uploadsTotal', 5);
    svc.inc('publishedTotal', 4);
    svc.inc('retriesTotal', 1);
    svc.inc('failuresTotal', 1);
    svc.inc('duplicateSkipsTotal', 2);
    svc.inc('schedulerJobsTotal', 3);

    const app = buildApp({ config: baseConfig, metricsService: svc });
    try {
      const res = await app.inject({ method: 'GET', url: '/metrics' });
      assert(res.statusCode === 200, `status 200 (got ${res.statusCode})`);
      const body = res.json<MetricsSnapshot>();
      assert(body.uploadsTotal === 5, `uploadsTotal = 5 (got ${body.uploadsTotal})`);
      assert(body.publishedTotal === 4, `publishedTotal = 4 (got ${body.publishedTotal})`);
      assert(body.retriesTotal === 1, `retriesTotal = 1 (got ${body.retriesTotal})`);
      assert(body.failuresTotal === 1, `failuresTotal = 1 (got ${body.failuresTotal})`);
      assert(body.duplicateSkipsTotal === 2, `duplicateSkipsTotal = 2`);
      assert(body.schedulerJobsTotal === 3, `schedulerJobsTotal = 3`);
    } finally {
      await app.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[5] GET /health — metricsEnabled flag');
  {
    const withMetrics = buildApp({ config: baseConfig, metricsService: new MetricsService() });
    const withoutMetrics = buildApp({ config: baseConfig });
    try {
      const r1 = await withMetrics.inject({ method: 'GET', url: '/health' });
      assert(
        r1.json<{ metricsEnabled: boolean }>().metricsEnabled === true,
        'metricsEnabled = true when injected',
      );

      const r2 = await withoutMetrics.inject({ method: 'GET', url: '/health' });
      assert(
        r2.json<{ metricsEnabled: boolean }>().metricsEnabled === false,
        'metricsEnabled = false when absent',
      );
    } finally {
      await withMetrics.close();
      await withoutMetrics.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[6] GET /metrics — live counter update between requests');
  {
    const svc = new MetricsService();
    const app = buildApp({ config: baseConfig, metricsService: svc });
    try {
      const r1 = await app.inject({ method: 'GET', url: '/metrics' });
      assert(r1.json<MetricsSnapshot>().uploadsTotal === 0, 'uploadsTotal = 0 initially');

      svc.inc('uploadsTotal');
      svc.inc('uploadsTotal');

      const r2 = await app.inject({ method: 'GET', url: '/metrics' });
      assert(r2.json<MetricsSnapshot>().uploadsTotal === 2, 'uploadsTotal = 2 after 2 increments');
    } finally {
      await app.close();
    }
  }

  console.log('\n✅  All metrics smoke checks passed.\n');
}

main().catch((err: unknown) => {
  console.error('Smoke failed:', err);
  process.exit(1);
});
