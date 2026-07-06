import { describe, expect, it } from 'vitest';

import type { Config } from '../config.js';
import { assertNoFatalErrors, validateApiConfig } from '../startup.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    port: 3001,
    host: '0.0.0.0',
    logLevel: 'info',
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateApiConfig
// ---------------------------------------------------------------------------

describe('validateApiConfig — valid config', () => {
  it('returns no errors or warnings for a fully configured instance', () => {
    const d = validateApiConfig(makeConfig());
    expect(d.errors).toHaveLength(0);
    expect(d.warnings).toHaveLength(0);
  });
});

describe('validateApiConfig — DATABASE_URL', () => {
  it('warns when DATABASE_URL is absent', () => {
    const d = validateApiConfig(makeConfig({ databaseUrl: undefined }));
    expect(d.warnings.some((w) => w.includes('DATABASE_URL'))).toBe(true);
  });

  it('errors when DATABASE_URL has wrong scheme', () => {
    const d = validateApiConfig(makeConfig({ databaseUrl: 'mysql://host/db' }));
    expect(d.errors.some((e) => e.includes('DATABASE_URL'))).toBe(true);
  });

  it('accepts postgresql:// scheme', () => {
    const d = validateApiConfig(makeConfig({ databaseUrl: 'postgresql://user:pw@host/db' }));
    expect(d.errors).toHaveLength(0);
  });

  it('accepts postgres:// scheme', () => {
    const d = validateApiConfig(makeConfig({ databaseUrl: 'postgres://host/db' }));
    expect(d.errors).toHaveLength(0);
  });
});

describe('validateApiConfig — REDIS_URL', () => {
  it('warns when REDIS_URL is absent', () => {
    const d = validateApiConfig(makeConfig({ redisUrl: undefined }));
    expect(d.warnings.some((w) => w.includes('REDIS_URL'))).toBe(true);
  });

  it('no error when REDIS_URL is present', () => {
    const d = validateApiConfig(makeConfig({ redisUrl: 'redis://localhost:6379' }));
    expect(d.errors).toHaveLength(0);
  });
});

describe('validateApiConfig — STORAGE_LOCAL_ROOT', () => {
  it('warns when storageLocalRoot is empty', () => {
    const d = validateApiConfig(makeConfig({ storageLocalRoot: '' }));
    expect(d.warnings.some((w) => w.includes('STORAGE_LOCAL_ROOT'))).toBe(true);
  });
});

describe('validateApiConfig — project context', () => {
  it('warns when defaultOrgId is empty', () => {
    const d = validateApiConfig(makeConfig({ defaultOrgId: '' }));
    expect(d.warnings.some((w) => w.includes('PCME_DEFAULT_ORG_ID'))).toBe(true);
  });

  it('warns when defaultProjectId is empty', () => {
    const d = validateApiConfig(makeConfig({ defaultProjectId: '' }));
    expect(d.warnings.some((w) => w.includes('PCME_DEFAULT_PROJECT_ID'))).toBe(true);
  });
});

describe('validateApiConfig — port', () => {
  it('errors when port is zero', () => {
    const d = validateApiConfig(makeConfig({ port: 0 }));
    expect(d.errors.some((e) => e.includes('API_PORT'))).toBe(true);
  });

  it('errors when port is above 65535', () => {
    const d = validateApiConfig(makeConfig({ port: 99999 }));
    expect(d.errors.some((e) => e.includes('API_PORT'))).toBe(true);
  });

  it('accepts port 443', () => {
    const d = validateApiConfig(makeConfig({ port: 443 }));
    expect(d.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// assertNoFatalErrors
// ---------------------------------------------------------------------------

describe('assertNoFatalErrors', () => {
  it('does not throw when errors array is empty', () => {
    expect(() => assertNoFatalErrors({ errors: [], warnings: [] })).not.toThrow();
  });

  it('throws when errors are present', () => {
    expect(() => assertNoFatalErrors({ errors: ['Something is wrong'], warnings: [] })).toThrow(
      'Startup aborted',
    );
  });

  it('does not throw for warnings-only', () => {
    expect(() => assertNoFatalErrors({ errors: [], warnings: ['Just a warning'] })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// GET /health — startedAt
// ---------------------------------------------------------------------------

import { afterEach } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';

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

describe('GET /health — startedAt field', () => {
  it('includes startedAt in response when passed', async () => {
    const ts = '2026-07-06T10:00:00.000Z';
    app = buildApp({ config: baseConfig, startedAt: ts });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.json<{ startedAt: string }>().startedAt).toBe(ts);
  });

  it('generates a startedAt fallback when not passed', async () => {
    app = buildApp({ config: baseConfig });
    const res = await app.inject({ method: 'GET', url: '/health' });
    const { startedAt } = res.json<{ startedAt: string }>();
    expect(typeof startedAt).toBe('string');
    expect(() => new Date(startedAt)).not.toThrow();
  });
});
