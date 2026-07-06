/**
 * Beta readiness smoke test — Sprint 30.
 *
 * Exercises startup validation, health endpoint enhancements, graceful
 * shutdown flow, and API/dashboard responsiveness.
 * Fully offline — no network, no database, no Redis required.
 *
 * Run with:  pnpm beta:smoke
 */

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { MetricsService } from '../src/metrics.js';
import { assertNoFatalErrors, validateApiConfig } from '../src/startup.js';

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

const validConfig: Config = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'production',
  version: '0.30.0',
  databaseUrl: 'postgresql://user:pass@localhost:5432/pcme',
  storageLocalRoot: '/data/media',
  defaultOrgId: 'org-001',
  defaultProjectId: 'proj-001',
  defaultProjectSlug: 'piercingconnect',
  redisUrl: 'redis://localhost:6379',
  autoEnqueueProcessing: true,
  publisherDriver: 'mock',
  autoEnqueuePublishing: true,
  publishingMaxRetries: 3,
  publishingBackoffMs: 5000,
  aiMetadataProvider: 'none',
};

const appConfig: AppOptions['config'] = {
  ...validConfig,
  logLevel: 'silent',
  databaseUrl: undefined,
  redisUrl: undefined,
  storageLocalRoot: '',
  defaultOrgId: '',
  defaultProjectId: '',
};

function makeApp(overrides: Partial<AppOptions> = {}) {
  return buildApp({ config: appConfig, ...overrides });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // -----------------------------------------------------------------------
  console.log('\n[1] Config validation — valid fully-configured config');
  {
    const d = validateApiConfig(validConfig);
    assert(d.errors.length === 0, 'no fatal errors for valid config');
    assert(d.warnings.length === 0, 'no warnings for valid config');
  }

  // -----------------------------------------------------------------------
  console.log('\n[2] Config validation — missing DATABASE_URL produces warning (not error)');
  {
    const d = validateApiConfig({ ...validConfig, databaseUrl: undefined });
    assert(d.errors.length === 0, 'no fatal errors for missing DATABASE_URL');
    assert(
      d.warnings.some((w) => w.includes('DATABASE_URL')),
      'warns about missing DATABASE_URL',
    );
  }

  // -----------------------------------------------------------------------
  console.log('\n[3] Config validation — invalid DATABASE_URL scheme produces error');
  {
    const d = validateApiConfig({ ...validConfig, databaseUrl: 'mysql://host/db' });
    assert(
      d.errors.some((e) => e.includes('DATABASE_URL')),
      'errors on wrong DB scheme',
    );
  }

  // -----------------------------------------------------------------------
  console.log('\n[4] Config validation — missing REDIS_URL produces warning');
  {
    const d = validateApiConfig({ ...validConfig, redisUrl: undefined });
    assert(
      d.warnings.some((w) => w.includes('REDIS_URL')),
      'warns about missing REDIS_URL',
    );
  }

  // -----------------------------------------------------------------------
  console.log('\n[5] Config validation — invalid port produces error');
  {
    const d = validateApiConfig({ ...validConfig, port: 0 });
    assert(
      d.errors.some((e) => e.includes('API_PORT')),
      'errors on port=0',
    );
  }

  // -----------------------------------------------------------------------
  console.log('\n[6] assertNoFatalErrors — passes clean config');
  {
    const d = validateApiConfig(validConfig);
    let threw = false;
    try {
      assertNoFatalErrors(d);
    } catch {
      threw = true;
    }
    assert(!threw, 'does not throw on clean config');
  }

  // -----------------------------------------------------------------------
  console.log('\n[7] assertNoFatalErrors — throws on fatal errors');
  {
    let threw = false;
    try {
      assertNoFatalErrors({ errors: ['Something fatal'], warnings: [] });
    } catch {
      threw = true;
    }
    assert(threw, 'throws when errors present');
  }

  // -----------------------------------------------------------------------
  console.log('\n[8] GET /health — startedAt field present');
  {
    const startedAt = '2026-07-06T10:00:00.000Z';
    const app = makeApp({ startedAt });
    try {
      const res = await app.inject({ method: 'GET', url: '/health' });
      assert(res.statusCode === 200, `status 200 (got ${res.statusCode})`);
      const body = res.json<{ startedAt: string; status: string; uptime: number }>();
      assert(body.startedAt === startedAt, `startedAt = ${startedAt} (got ${body.startedAt})`);
      assert(body.status === 'ok', 'status = ok');
      assert(typeof body.uptime === 'number', 'uptime is a number');
    } finally {
      await app.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[9] GET /health — metricsEnabled reflects MetricsService injection');
  {
    const withMetrics = makeApp({ metricsService: new MetricsService() });
    const withoutMetrics = makeApp();
    try {
      const r1 = await withMetrics.inject({ method: 'GET', url: '/health' });
      assert(
        r1.json<{ metricsEnabled: boolean }>().metricsEnabled === true,
        'metricsEnabled=true when injected',
      );
      const r2 = await withoutMetrics.inject({ method: 'GET', url: '/health' });
      assert(
        r2.json<{ metricsEnabled: boolean }>().metricsEnabled === false,
        'metricsEnabled=false when absent',
      );
    } finally {
      await withMetrics.close();
      await withoutMetrics.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[10] GET /metrics — all counters present');
  {
    const svc = new MetricsService();
    svc.inc('uploadsTotal', 5);
    const app = makeApp({ metricsService: svc });
    try {
      const res = await app.inject({ method: 'GET', url: '/metrics' });
      assert(res.statusCode === 200, `status 200 (got ${res.statusCode})`);
      const body = res.json<Record<string, unknown>>();
      const expected = [
        'uploadsTotal',
        'processedTotal',
        'publishedTotal',
        'retriesTotal',
        'failuresTotal',
        'duplicateSkipsTotal',
        'schedulerJobsTotal',
        'queueWaiting',
        'queueActive',
        'queueCompleted',
        'queueFailed',
        'collectedAt',
      ];
      for (const key of expected) {
        assert(key in body, `response includes "${key}"`);
      }
      assert(body['uploadsTotal'] === 5, 'uploadsTotal = 5');
    } finally {
      await app.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[11] API — graceful app.close() completes without throwing');
  {
    const app = makeApp();
    await app.inject({ method: 'GET', url: '/health' }); // warm up
    let closed = false;
    try {
      await app.close();
      closed = true;
    } catch {
      // handled below
    }
    assert(closed, 'app.close() resolves without error');
  }

  // -----------------------------------------------------------------------
  console.log('\n[12] Multiple simultaneous apps — independent lifecycle');
  {
    const a = makeApp({ startedAt: 'ts-a' });
    const b = makeApp({ startedAt: 'ts-b' });
    try {
      const ra = await a.inject({ method: 'GET', url: '/health' });
      const rb = await b.inject({ method: 'GET', url: '/health' });
      assert(ra.json<{ startedAt: string }>().startedAt === 'ts-a', 'app A has its own startedAt');
      assert(rb.json<{ startedAt: string }>().startedAt === 'ts-b', 'app B has its own startedAt');
    } finally {
      await a.close();
      await b.close();
    }
  }

  console.log('\n✅  All beta smoke checks passed.\n');
}

main().catch((err: unknown) => {
  console.error('Beta smoke failed:', err);
  process.exit(1);
});
