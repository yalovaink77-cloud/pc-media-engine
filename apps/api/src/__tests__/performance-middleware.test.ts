import { afterEach, describe, expect, it } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import { MetricsService } from '../metrics.js';

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

let app: ReturnType<typeof buildApp> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('performance middleware', () => {
  it('adds x-response-time-ms header', async () => {
    app = buildApp({ config: baseConfig, metricsService: new MetricsService() });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-response-time-ms']).toBeDefined();
  });

  it('sets no-store on /metrics', async () => {
    app = buildApp({ config: baseConfig, metricsService: new MetricsService() });
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('sets short cache on /version', async () => {
    app = buildApp({ config: baseConfig });
    const res = await app.inject({ method: 'GET', url: '/version' });
    expect(res.headers['cache-control']).toContain('max-age=60');
  });
});
