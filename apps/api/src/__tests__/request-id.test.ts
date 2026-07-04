import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

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
};

let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  app = buildApp({ config: baseConfig });
});

afterEach(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// Request ID
// ---------------------------------------------------------------------------

describe('X-Request-Id', () => {
  it('response always includes X-Request-Id header', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('generates a UUID when no X-Request-Id is sent', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    const id = res.headers['x-request-id'] as string;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('echoes the X-Request-Id sent by the caller', async () => {
    const callerRequestId = 'upstream-trace-abc123';
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': callerRequestId },
    });
    expect(res.headers['x-request-id']).toBe(callerRequestId);
  });

  it('two concurrent requests receive different generated IDs', async () => {
    const [res1, res2] = await Promise.all([
      app.inject({ method: 'GET', url: '/health' }),
      app.inject({ method: 'GET', url: '/health' }),
    ]);
    expect(res1.headers['x-request-id']).not.toBe(res2.headers['x-request-id']);
  });

  it('X-Request-Id header is present on /version too', async () => {
    const res = await app.inject({ method: 'GET', url: '/version' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('X-Request-Id header is present on / too', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});
