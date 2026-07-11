import { afterEach, describe, expect, it } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import {
  compareApiKeyToHash,
  compareRawApiKeys,
  generateApiKey,
  hashApiKey,
} from '../auth/api-key.js';
import type { AuthConfig } from '../auth/config.js';
import { loadAuthConfig, validateAuthConfig } from '../auth/config.js';
import { signJwt, verifyJwt } from '../auth/jwt.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import type { AuthHealthResponse } from '../routes/auth.js';

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const baseAppConfig: AppOptions['config'] = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.31.0-test',
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

const disabledAuth: AuthConfig = {
  enabled: false,
  jwtEnabled: false,
  jwtSecret: '',
  jwtExpiresInSeconds: 3600,
  apiKeyEnabled: false,
  apiKeys: [],
  apiKeyRoles: {},
  defaultJwtRole: 'operator',
  defaultApiKeyRole: 'admin',
};

const testSecret = 'test-secret-at-least-32-characters-long!!';

function enabledAuth(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    enabled: true,
    jwtEnabled: true,
    jwtSecret: testSecret,
    jwtExpiresInSeconds: 3600,
    apiKeyEnabled: true,
    apiKeys: ['test-key-alpha', 'test-key-beta'],
    apiKeyRoles: {},
    defaultJwtRole: 'operator',
    defaultApiKeyRole: 'admin',
    ...overrides,
  };
}

let app: ReturnType<typeof buildApp> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

// ===========================================================================
// JWT
// ===========================================================================

describe('JWT — signJwt / verifyJwt', () => {
  const secret = 'super-secret-key-for-testing-1234';

  it('produces a three-part token', () => {
    const token = signJwt({ sub: 'user-1' }, secret, 3600);
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifies a freshly signed token', () => {
    const token = signJwt({ sub: 'user-1' }, secret, 3600);
    const result = verifyJwt(token, secret);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.claims.sub).toBe('user-1');
      expect(typeof result.claims.iat).toBe('number');
      expect(typeof result.claims.exp).toBe('number');
    }
  });

  it('preserves custom payload claims', () => {
    const token = signJwt({ sub: 'u1', role: 'admin' }, secret, 3600);
    const result = verifyJwt(token, secret);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.claims['role']).toBe('admin');
  });

  it('rejects a token signed with a different secret', () => {
    const token = signJwt({ sub: 'u1' }, secret, 3600);
    const result = verifyJwt(token, 'wrong-secret');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('invalid signature');
  });

  it('rejects a malformed token', () => {
    const result = verifyJwt('not.a.valid.jwt.here', secret);
    expect(result.valid).toBe(false);
  });

  it('rejects a token with only two parts', () => {
    const result = verifyJwt('header.body', secret);
    expect(result.valid).toBe(false);
  });

  it('rejects an expired token', () => {
    // exp = 1 second in the past
    const token = signJwt({ sub: 'u1' }, secret, -1);
    const result = verifyJwt(token, secret);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('expired');
  });

  it('exp > iat for positive expiresIn', () => {
    const token = signJwt({ sub: 'u1' }, secret, 7200);
    const result = verifyJwt(token, secret);
    if (result.valid) {
      expect(result.claims.exp - result.claims.iat).toBe(7200);
    }
  });
});

// ===========================================================================
// Password
// ===========================================================================

describe('password — hashPassword / verifyPassword', () => {
  it('produces a non-empty hash', async () => {
    const hash = await hashPassword('myS3cretP@ss');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
    expect(hash).toContain(':');
  });

  it('verifies the correct password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('two hashes of the same password differ (random salt)', async () => {
    const h1 = await hashPassword('same');
    const h2 = await hashPassword('same');
    expect(h1).not.toBe(h2);
    // But both must verify correctly.
    expect(await verifyPassword('same', h1)).toBe(true);
    expect(await verifyPassword('same', h2)).toBe(true);
  });

  it('returns false for a malformed hash', async () => {
    expect(await verifyPassword('pass', 'no-colon-here')).toBe(false);
    expect(await verifyPassword('pass', '')).toBe(false);
  });
}, 30000); // scrypt can be slow under load — give 30s

// ===========================================================================
// API keys
// ===========================================================================

describe('API key — generation and hashing', () => {
  it('generateApiKey produces a pcme_ prefixed key', () => {
    const key = generateApiKey();
    expect(key.startsWith('pcme_')).toBe(true);
    expect(key.length).toBeGreaterThan(20);
  });

  it('hashApiKey produces a 64-char hex string', () => {
    const hash = hashApiKey('pcme_testkey');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('same key always hashes to same value', () => {
    expect(hashApiKey('key-a')).toBe(hashApiKey('key-a'));
  });

  it('different keys produce different hashes', () => {
    expect(hashApiKey('key-a')).not.toBe(hashApiKey('key-b'));
  });

  it('compareApiKeyToHash matches correct raw key', () => {
    const raw = generateApiKey();
    const hash = hashApiKey(raw);
    expect(compareApiKeyToHash(raw, hash)).toBe(true);
  });

  it('compareApiKeyToHash rejects wrong raw key', () => {
    const hash = hashApiKey('correct-key');
    expect(compareApiKeyToHash('wrong-key', hash)).toBe(false);
  });

  it('compareRawApiKeys is timing-safe and matches equal strings', () => {
    expect(compareRawApiKeys('abc', 'abc')).toBe(true);
  });

  it('compareRawApiKeys rejects unequal strings', () => {
    expect(compareRawApiKeys('abc', 'xyz')).toBe(false);
  });
});

// ===========================================================================
// Auth config validation
// ===========================================================================

describe('validateAuthConfig', () => {
  it('warns when auth is disabled', () => {
    const d = validateAuthConfig(disabledAuth);
    expect(d.errors).toHaveLength(0);
    expect(d.warnings.some((w) => w.includes('disabled'))).toBe(true);
  });

  it('errors when auth is disabled in production', () => {
    const d = validateAuthConfig(disabledAuth, { production: true });
    expect(d.errors.some((e) => e.includes('must be enabled in production'))).toBe(true);
    expect(d.warnings).toHaveLength(0);
  });

  it('warns when auth is disabled in non-production', () => {
    const d = validateAuthConfig(disabledAuth, { production: false });
    expect(d.errors).toHaveLength(0);
    expect(d.warnings.some((w) => w.includes('disabled'))).toBe(true);
  });

  it('errors when auth is enabled but no methods configured', () => {
    const cfg: AuthConfig = { ...disabledAuth, enabled: true };
    const d = validateAuthConfig(cfg);
    expect(d.errors.some((e) => e.includes('no auth method'))).toBe(true);
  });

  it('errors when production auth is enabled but no methods configured', () => {
    const cfg: AuthConfig = { ...disabledAuth, enabled: true };
    const d = validateAuthConfig(cfg, { production: true });
    expect(d.errors.some((e) => e.includes('no auth method'))).toBe(true);
  });

  it('warns when JWT secret is short', () => {
    const cfg = enabledAuth({ jwtSecret: 'short' });
    const d = validateAuthConfig(cfg);
    expect(d.warnings.some((w) => w.includes('shorter'))).toBe(true);
  });

  it('errors when jwtExpiresInSeconds is zero', () => {
    const cfg = enabledAuth({ jwtExpiresInSeconds: 0 });
    const d = validateAuthConfig(cfg);
    expect(d.errors.some((e) => e.includes('PCME_JWT_EXPIRES_IN'))).toBe(true);
  });

  it('passes a fully-configured auth config', () => {
    const d = validateAuthConfig(enabledAuth());
    expect(d.errors).toHaveLength(0);
  });
});

// ===========================================================================
// Auth middleware
// ===========================================================================

describe('createAuthMiddleware — disabled auth', () => {
  it('authenticateRequest does not set request.auth when disabled', async () => {
    const middleware = createAuthMiddleware(disabledAuth);
    const request = { headers: {} } as Parameters<typeof middleware.authenticateRequest>[0];
    const reply = {} as Parameters<typeof middleware.authenticateRequest>[1];
    await middleware.authenticateRequest(request, reply);
    expect(request.auth).toBeUndefined();
  });

  it('requireAuth does not reject when auth is disabled', async () => {
    const middleware = createAuthMiddleware(disabledAuth);
    const request = { headers: {} } as Parameters<typeof middleware.requireAuth>[0];
    let statusSent: number | undefined;
    const reply = {
      status(code: number) {
        statusSent = code;
        return this;
      },
      send() {
        return this;
      },
    } as unknown as Parameters<typeof middleware.requireAuth>[1];
    await middleware.requireAuth(request, reply);
    expect(statusSent).toBeUndefined();
  });
});

describe('createAuthMiddleware — JWT auth', () => {
  const cfg = enabledAuth({ apiKeyEnabled: false, apiKeys: [] });
  const middleware = createAuthMiddleware(cfg);

  it('populates request.auth for a valid Bearer JWT', async () => {
    const token = signJwt({ sub: 'u1' }, testSecret, 3600);
    const request = {
      headers: { authorization: `Bearer ${token}` },
    } as Parameters<typeof middleware.authenticateRequest>[0];
    await middleware.authenticateRequest(request, {} as never);
    expect(request.auth?.type).toBe('jwt');
    if (request.auth?.type === 'jwt') expect(request.auth.sub).toBe('u1');
  });

  it('does not set request.auth for an invalid Bearer JWT', async () => {
    const request = {
      headers: { authorization: 'Bearer not.a.valid.token' },
    } as Parameters<typeof middleware.authenticateRequest>[0];
    await middleware.authenticateRequest(request, {} as never);
    expect(request.auth).toBeUndefined();
  });

  it('requireAuth returns 401 when no credentials provided', async () => {
    const request = { headers: {} } as Parameters<typeof middleware.requireAuth>[0];
    let statusCode: number | undefined;
    const reply = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      send() {
        return this;
      },
    } as unknown as Parameters<typeof middleware.requireAuth>[1];
    await middleware.requireAuth(request, reply);
    expect(statusCode).toBe(401);
  });
});

describe('createAuthMiddleware — API key auth', () => {
  const cfg = enabledAuth({ jwtEnabled: false, jwtSecret: '' });
  const middleware = createAuthMiddleware(cfg);

  it('sets request.auth for valid X-API-Key header', async () => {
    const request = {
      headers: { 'x-api-key': 'test-key-alpha' },
    } as unknown as Parameters<typeof middleware.authenticateRequest>[0];
    await middleware.authenticateRequest(request, {} as never);
    expect(request.auth?.type).toBe('api-key');
  });

  it('sets request.auth for valid Authorization: ApiKey header', async () => {
    const request = {
      headers: { authorization: 'ApiKey test-key-beta' },
    } as unknown as Parameters<typeof middleware.authenticateRequest>[0];
    await middleware.authenticateRequest(request, {} as never);
    expect(request.auth?.type).toBe('api-key');
  });

  it('does not set request.auth for unknown key', async () => {
    const request = {
      headers: { 'x-api-key': 'pcme_not_a_real_key' },
    } as unknown as Parameters<typeof middleware.authenticateRequest>[0];
    await middleware.authenticateRequest(request, {} as never);
    expect(request.auth).toBeUndefined();
  });

  it('requireAuth returns 401 for unknown key', async () => {
    const request = {
      headers: { 'x-api-key': 'wrong-key' },
    } as unknown as Parameters<typeof middleware.requireAuth>[0];
    let statusCode: number | undefined;
    const reply = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      send() {
        return this;
      },
    } as unknown as Parameters<typeof middleware.requireAuth>[1];
    await middleware.requireAuth(request, reply);
    expect(statusCode).toBe(401);
  });
});

// ===========================================================================
// GET /auth/health
// ===========================================================================

describe('GET /auth/health', () => {
  it('returns 200', async () => {
    app = buildApp({ config: baseAppConfig });
    const res = await app.inject({ method: 'GET', url: '/auth/health' });
    expect(res.statusCode).toBe(200);
  });

  it('reports authEnabled: false when no authConfig injected', async () => {
    app = buildApp({ config: baseAppConfig });
    const body = (
      await app.inject({ method: 'GET', url: '/auth/health' })
    ).json<AuthHealthResponse>();
    expect(body.status).toBe('ok');
    expect(body.authEnabled).toBe(false);
    expect(body.jwtEnabled).toBe(false);
    expect(body.apiKeyEnabled).toBe(false);
  });

  it('reports authEnabled: true when auth is configured', async () => {
    app = buildApp({ config: baseAppConfig, authConfig: enabledAuth() });
    const body = (
      await app.inject({ method: 'GET', url: '/auth/health' })
    ).json<AuthHealthResponse>();
    expect(body.authEnabled).toBe(true);
    expect(body.jwtEnabled).toBe(true);
    expect(body.apiKeyEnabled).toBe(true);
  });

  it('reports jwtEnabled: false when only API keys configured', async () => {
    app = buildApp({
      config: baseAppConfig,
      authConfig: enabledAuth({ jwtEnabled: false, jwtSecret: '' }),
    });
    const body = (
      await app.inject({ method: 'GET', url: '/auth/health' })
    ).json<AuthHealthResponse>();
    expect(body.jwtEnabled).toBe(false);
    expect(body.apiKeyEnabled).toBe(true);
  });

  it('includes version', async () => {
    app = buildApp({ config: baseAppConfig });
    const body = (
      await app.inject({ method: 'GET', url: '/auth/health' })
    ).json<AuthHealthResponse>();
    expect(body.version).toBe('0.31.0-test');
  });
});

// ===========================================================================
// loadAuthConfig (env var loading)
// ===========================================================================

describe('loadAuthConfig', () => {
  it('returns disabled auth when env vars are absent', () => {
    const origEnabled = process.env['PCME_AUTH_ENABLED'];
    delete process.env['PCME_AUTH_ENABLED'];
    const cfg = loadAuthConfig();
    expect(cfg.enabled).toBe(false);
    if (origEnabled !== undefined) process.env['PCME_AUTH_ENABLED'] = origEnabled;
  });
});
