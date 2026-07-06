import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import type { MetricsSnapshot } from '../metrics.js';
import { MetricsService } from '../metrics.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.0.0-test',
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

function makeApp(svc?: MetricsService) {
  return buildApp({ config: baseConfig, metricsService: svc });
}

let app: ReturnType<typeof buildApp> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

// ---------------------------------------------------------------------------
// MetricsService unit tests
// ---------------------------------------------------------------------------

describe('MetricsService', () => {
  it('starts with all counters at zero', () => {
    const svc = new MetricsService();
    const snap = svc.snapshot();
    expect(snap.uploadsTotal).toBe(0);
    expect(snap.publishedTotal).toBe(0);
    expect(snap.retriesTotal).toBe(0);
    expect(snap.failuresTotal).toBe(0);
    expect(snap.duplicateSkipsTotal).toBe(0);
    expect(snap.schedulerJobsTotal).toBe(0);
    expect(snap.processedTotal).toBe(0);
    expect(snap.queueWaiting).toBe(0);
    expect(snap.queueActive).toBe(0);
    expect(snap.queueCompleted).toBe(0);
    expect(snap.queueFailed).toBe(0);
  });

  it('increments a counter by 1', () => {
    const svc = new MetricsService();
    svc.inc('uploadsTotal');
    expect(svc.snapshot().uploadsTotal).toBe(1);
  });

  it('increments a counter by a custom amount', () => {
    const svc = new MetricsService();
    svc.inc('retriesTotal', 5);
    expect(svc.snapshot().retriesTotal).toBe(5);
  });

  it('accumulates multiple increments', () => {
    const svc = new MetricsService();
    svc.inc('publishedTotal');
    svc.inc('publishedTotal');
    svc.inc('publishedTotal');
    expect(svc.snapshot().publishedTotal).toBe(3);
  });

  it('sets a gauge to an exact value', () => {
    const svc = new MetricsService();
    svc.set('queueWaiting', 42);
    expect(svc.snapshot().queueWaiting).toBe(42);
  });

  it('snapshot includes collectedAt ISO string', () => {
    const svc = new MetricsService();
    const snap = svc.snapshot();
    expect(typeof snap.collectedAt).toBe('string');
    expect(() => new Date(snap.collectedAt)).not.toThrow();
  });

  it('snapshot is a copy — mutating it does not affect the service', () => {
    const svc = new MetricsService();
    svc.inc('uploadsTotal');
    const snap = svc.snapshot() as MetricsSnapshot & { uploadsTotal: number };
    snap.uploadsTotal = 999;
    expect(svc.snapshot().uploadsTotal).toBe(1);
  });

  it('reset brings all counters back to zero', () => {
    const svc = new MetricsService();
    svc.inc('uploadsTotal', 10);
    svc.inc('publishedTotal', 5);
    svc.reset();
    const snap = svc.snapshot();
    expect(snap.uploadsTotal).toBe(0);
    expect(snap.publishedTotal).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /metrics route tests
// ---------------------------------------------------------------------------

describe('GET /metrics — no service', () => {
  beforeEach(() => {
    app = makeApp();
  });

  it('returns 200', async () => {
    const res = await app!.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
  });

  it('returns all-zero counters when no service injected', async () => {
    const res = await app!.inject({ method: 'GET', url: '/metrics' });
    const body = res.json<MetricsSnapshot>();
    expect(body.uploadsTotal).toBe(0);
    expect(body.publishedTotal).toBe(0);
    expect(body.retriesTotal).toBe(0);
  });

  it('includes collectedAt', async () => {
    const res = await app!.inject({ method: 'GET', url: '/metrics' });
    const body = res.json<MetricsSnapshot>();
    expect(typeof body.collectedAt).toBe('string');
  });
});

describe('GET /metrics — with service', () => {
  let svc: MetricsService;

  beforeEach(() => {
    svc = new MetricsService();
    app = makeApp(svc);
  });

  it('returns live counter values', async () => {
    svc.inc('uploadsTotal', 7);
    svc.inc('publishedTotal', 3);
    svc.inc('retriesTotal', 2);
    svc.inc('failuresTotal', 1);

    const res = await app!.inject({ method: 'GET', url: '/metrics' });
    const body = res.json<MetricsSnapshot>();
    expect(body.uploadsTotal).toBe(7);
    expect(body.publishedTotal).toBe(3);
    expect(body.retriesTotal).toBe(2);
    expect(body.failuresTotal).toBe(1);
  });

  it('reflects subsequent increments', async () => {
    const res1 = await app!.inject({ method: 'GET', url: '/metrics' });
    expect(res1.json<MetricsSnapshot>().uploadsTotal).toBe(0);

    svc.inc('uploadsTotal');
    const res2 = await app!.inject({ method: 'GET', url: '/metrics' });
    expect(res2.json<MetricsSnapshot>().uploadsTotal).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// GET /health — metricsEnabled field
// ---------------------------------------------------------------------------

describe('GET /health — metricsEnabled', () => {
  it('is false when no metricsService injected', async () => {
    app = makeApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.json<{ metricsEnabled: boolean }>().metricsEnabled).toBe(false);
  });

  it('is true when metricsService is injected', async () => {
    app = makeApp(new MetricsService());
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.json<{ metricsEnabled: boolean }>().metricsEnabled).toBe(true);
  });
});
