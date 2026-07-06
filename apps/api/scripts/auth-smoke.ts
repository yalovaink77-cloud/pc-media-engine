/**
 * Offline smoke test for Sprint 31 — Authentication Foundation.
 *
 * Exercises:
 *  - JWT sign / verify
 *  - Password hash / verify
 *  - API key generation and comparison
 *  - Auth middleware (disabled, JWT, API key)
 *  - GET /auth/health with various configs
 *  - requireAuth returns 401 when credentials missing
 *
 * No network, database, or Redis required.
 *
 * Run with:  pnpm auth:smoke
 */

import type { AppOptions } from '../src/app.js';
import { buildApp } from '../src/app.js';
import {
  compareApiKeyToHash,
  compareRawApiKeys,
  generateApiKey,
  hashApiKey,
} from '../src/auth/api-key.js';
import type { AuthConfig } from '../src/auth/config.js';
import { validateAuthConfig } from '../src/auth/config.js';
import { signJwt, verifyJwt } from '../src/auth/jwt.js';
import { createAuthMiddleware } from '../src/auth/middleware.js';
import { hashPassword, verifyPassword } from '../src/auth/password.js';
import type { AuthHealthResponse } from '../src/routes/auth.js';

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
  version: '0.31.0-smoke',
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

const JWT_SECRET = 'smoke-test-secret-32-chars-minimum!!';
const TEST_API_KEY = 'pcme_smoke_test_key_alpha';

function fullAuthConfig(): AuthConfig {
  return {
    enabled: true,
    jwtEnabled: true,
    jwtSecret: JWT_SECRET,
    jwtExpiresInSeconds: 3600,
    apiKeyEnabled: true,
    apiKeys: [TEST_API_KEY],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // -----------------------------------------------------------------------
  console.log('\n[1] JWT — sign and verify round-trip');
  {
    const token = signJwt({ sub: 'smoke-user', role: 'admin' }, JWT_SECRET, 3600);
    assert(token.split('.').length === 3, 'token has 3 parts');
    const result = verifyJwt(token, JWT_SECRET);
    assert(result.valid, 'token verifies');
    if (result.valid) {
      assert(result.claims.sub === 'smoke-user', `sub = smoke-user (got ${result.claims.sub})`);
      assert(result.claims['role'] === 'admin', 'custom claim preserved');
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[2] JWT — invalid signature rejected');
  {
    const token = signJwt({ sub: 'u1' }, JWT_SECRET, 3600);
    const bad = verifyJwt(token, 'wrong-secret');
    assert(!bad.valid, 'bad secret rejected');
  }

  // -----------------------------------------------------------------------
  console.log('\n[3] JWT — expired token rejected');
  {
    const token = signJwt({ sub: 'u1' }, JWT_SECRET, -1);
    const result = verifyJwt(token, JWT_SECRET);
    assert(!result.valid, 'expired token rejected');
    if (!result.valid) assert(result.error.includes('expired'), 'error says "expired"');
  }

  // -----------------------------------------------------------------------
  console.log('\n[4] Password — hash and verify');
  {
    const hash = await hashPassword('correct-horse-battery-staple');
    assert(hash.includes(':'), 'hash contains salt separator');
    assert(await verifyPassword('correct-horse-battery-staple', hash), 'correct password accepted');
    assert(!(await verifyPassword('wrong-password', hash)), 'wrong password rejected');
  }

  // -----------------------------------------------------------------------
  console.log('\n[5] Password — two hashes differ (random salt)');
  {
    const h1 = await hashPassword('same-pass');
    const h2 = await hashPassword('same-pass');
    assert(h1 !== h2, 'hashes differ due to random salt');
    assert(await verifyPassword('same-pass', h1), 'h1 verifies');
    assert(await verifyPassword('same-pass', h2), 'h2 verifies');
  }

  // -----------------------------------------------------------------------
  console.log('\n[6] API key — generation and hashing');
  {
    const key = generateApiKey();
    assert(key.startsWith('pcme_'), 'key has pcme_ prefix');
    const hash = hashApiKey(key);
    assert(hash.length === 64, 'hash is 64-char hex');
    assert(compareApiKeyToHash(key, hash), 'compareApiKeyToHash matches');
    assert(!compareApiKeyToHash('wrong', hash), 'compareApiKeyToHash rejects wrong key');
    assert(compareRawApiKeys('abc', 'abc'), 'raw compare matches equal');
    assert(!compareRawApiKeys('abc', 'xyz'), 'raw compare rejects unequal');
  }

  // -----------------------------------------------------------------------
  console.log('\n[7] Auth config validation — disabled produces warning not error');
  {
    const cfg: AuthConfig = {
      enabled: false,
      jwtEnabled: false,
      jwtSecret: '',
      jwtExpiresInSeconds: 3600,
      apiKeyEnabled: false,
      apiKeys: [],
    };
    const d = validateAuthConfig(cfg);
    assert(d.errors.length === 0, 'no errors for disabled auth');
    assert(d.warnings.length > 0, 'has warning about disabled auth');
  }

  // -----------------------------------------------------------------------
  console.log('\n[8] Auth middleware — disabled passes everything');
  {
    const middleware = createAuthMiddleware({
      enabled: false,
      jwtEnabled: false,
      jwtSecret: '',
      jwtExpiresInSeconds: 3600,
      apiKeyEnabled: false,
      apiKeys: [],
    });
    const request = { headers: {} } as never;
    await middleware.authenticateRequest(request, {} as never);
    assert((request as { auth?: unknown }).auth === undefined, 'auth not set when disabled');
  }

  // -----------------------------------------------------------------------
  console.log('\n[9] Auth middleware — valid Bearer JWT sets request.auth');
  {
    const token = signJwt({ sub: 'u1' }, JWT_SECRET, 3600);
    const middleware = createAuthMiddleware(fullAuthConfig());
    const request = { headers: { authorization: `Bearer ${token}` } } as never;
    await middleware.authenticateRequest(request, {} as never);
    const auth = (request as { auth?: { type: string; sub: string } }).auth;
    assert(auth?.type === 'jwt', 'auth.type = jwt');
    assert(auth?.sub === 'u1', 'auth.sub = u1');
  }

  // -----------------------------------------------------------------------
  console.log('\n[10] Auth middleware — valid X-API-Key sets request.auth');
  {
    const middleware = createAuthMiddleware(fullAuthConfig());
    const request = { headers: { 'x-api-key': TEST_API_KEY } } as never;
    await middleware.authenticateRequest(request, {} as never);
    const auth = (request as { auth?: { type: string } }).auth;
    assert(auth?.type === 'api-key', 'auth.type = api-key');
  }

  // -----------------------------------------------------------------------
  console.log('\n[11] Auth middleware — requireAuth sends 401 on missing credentials');
  {
    const middleware = createAuthMiddleware(fullAuthConfig());
    const request = { headers: {} } as never;
    let sentStatus: number | undefined;
    const reply = {
      status(c: number) {
        sentStatus = c;
        return this;
      },
      send() {
        return this;
      },
    } as never;
    await middleware.requireAuth(request, reply);
    assert(sentStatus === 401, `status 401 sent (got ${sentStatus})`);
  }

  // -----------------------------------------------------------------------
  console.log('\n[12] GET /auth/health — auth disabled');
  {
    const a = buildApp({ config: baseConfig });
    try {
      const res = await a.inject({ method: 'GET', url: '/auth/health' });
      assert(res.statusCode === 200, `status 200 (got ${res.statusCode})`);
      const body = res.json<AuthHealthResponse>();
      assert(body.status === 'ok', 'status ok');
      assert(body.authEnabled === false, 'authEnabled false');
      assert(body.jwtEnabled === false, 'jwtEnabled false');
      assert(body.apiKeyEnabled === false, 'apiKeyEnabled false');
      assert(body.version === '0.31.0-smoke', `version present (got ${body.version})`);
    } finally {
      await a.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[13] GET /auth/health — full auth enabled');
  {
    const a = buildApp({ config: baseConfig, authConfig: fullAuthConfig() });
    try {
      const res = await a.inject({ method: 'GET', url: '/auth/health' });
      const body = res.json<AuthHealthResponse>();
      assert(body.authEnabled === true, 'authEnabled true');
      assert(body.jwtEnabled === true, 'jwtEnabled true');
      assert(body.apiKeyEnabled === true, 'apiKeyEnabled true');
    } finally {
      await a.close();
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n[14] GET /auth/health — remains accessible with auth enabled (public endpoint)');
  {
    const a = buildApp({ config: baseConfig, authConfig: fullAuthConfig() });
    try {
      // No credentials — should still return 200 (health is always public)
      const res = await a.inject({ method: 'GET', url: '/auth/health' });
      assert(res.statusCode === 200, `GET /auth/health public (got ${res.statusCode})`);
    } finally {
      await a.close();
    }
  }

  console.log('\n✅  All auth smoke checks passed.\n');
}

main().catch((err: unknown) => {
  console.error('Auth smoke failed:', err);
  process.exit(1);
});
