import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';
import type { VersionResponse } from '../routes/version.js';

const baseConfig = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '1.2.3-test',
  databaseUrl: undefined,
  storageLocalRoot: '',
  defaultOrgId: '',
  defaultProjectId: '',
  defaultProjectSlug: 'piercingconnect',
};

let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  app = buildApp({ config: baseConfig });
});

afterEach(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// GET /version
// ---------------------------------------------------------------------------

describe('GET /version', () => {
  it('returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/version' });
    expect(res.statusCode).toBe(200);
  });

  it('returns JSON with service name', async () => {
    const res = await app.inject({ method: 'GET', url: '/version' });
    const body = res.json<VersionResponse>();
    expect(body.name).toBe('pc-media-engine-api');
  });

  it('returns version from config', async () => {
    const res = await app.inject({ method: 'GET', url: '/version' });
    const body = res.json<VersionResponse>();
    expect(body.version).toBe('1.2.3-test');
  });

  it('returns env from config', async () => {
    const res = await app.inject({ method: 'GET', url: '/version' });
    const body = res.json<VersionResponse>();
    expect(body.env).toBe('test');
  });

  it('returns Content-Type application/json', async () => {
    const res = await app.inject({ method: 'GET', url: '/version' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

describe('GET /', () => {
  it('returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
  });

  it('returns service identity', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    const body = res.json<{ service: string }>();
    expect(body.service).toBe('PC Media Engine API');
  });
});
