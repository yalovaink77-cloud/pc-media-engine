import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import type { HealthResponse } from '../routes/health.js';

// ---------------------------------------------------------------------------
// Fixture: minimal config (no DB, no pino-pretty transport)
// ---------------------------------------------------------------------------

const baseConfig = {
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
};

function makeApp(overrides: Partial<AppOptions> = {}) {
  return buildApp({ config: baseConfig, ...overrides });
}

let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  app = makeApp();
});

afterEach(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('returns JSON with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = res.json<HealthResponse>();
    expect(body.status).toBe('ok');
  });

  it('includes uptime as a number', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = res.json<HealthResponse>();
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('includes env from config', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = res.json<HealthResponse>();
    expect(body.env).toBe('test');
  });

  it('includes version from config', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = res.json<HealthResponse>();
    expect(body.version).toBe('0.0.0-test');
  });

  it('sets database to skipped when no checkDatabase is provided', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = res.json<HealthResponse>();
    expect(body.database).toBe('skipped');
  });

  it('calls checkDatabase and returns its result', async () => {
    const customApp = makeApp({
      checkDatabase: async () => 'ok',
    });
    const res = await customApp.inject({ method: 'GET', url: '/health' });
    const body = res.json<HealthResponse>();
    expect(body.database).toBe('ok');
    await customApp.close();
  });

  it('returns database unavailable when checkDatabase returns unavailable', async () => {
    const customApp = makeApp({
      checkDatabase: async () => 'unavailable',
    });
    const res = await customApp.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json<HealthResponse>();
    expect(body.database).toBe('unavailable');
    await customApp.close();
  });

  it('returns 200 even when database is unavailable', async () => {
    const customApp = makeApp({
      checkDatabase: async () => 'unavailable',
    });
    const res = await customApp.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    await customApp.close();
  });

  it('returns Content-Type application/json', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
