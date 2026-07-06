import { describe, expect, it } from 'vitest';

import type { WorkerConfig } from '../config.js';
import { assertNoFatalWorkerErrors, validateWorkerConfig } from '../startup.js';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<WorkerConfig> = {}): WorkerConfig {
  return {
    redisUrl: 'redis://localhost:6379',
    databaseUrl: 'postgresql://user:pass@localhost:5432/pcme',
    storageLocalRoot: '/data/media',
    concurrency: 5,
    logLevel: 'info',
    publisherDriver: 'mock',
    autoEnqueuePublishing: true,
    publishingMaxRetries: 3,
    publishingBackoffMs: 5000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateWorkerConfig — valid config
// ---------------------------------------------------------------------------

describe('validateWorkerConfig — valid config', () => {
  it('returns no errors or warnings for a fully configured instance', () => {
    const d = validateWorkerConfig(makeConfig());
    expect(d.errors).toHaveLength(0);
    expect(d.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateWorkerConfig — REDIS_URL
// ---------------------------------------------------------------------------

describe('validateWorkerConfig — REDIS_URL', () => {
  it('errors when REDIS_URL is absent', () => {
    const d = validateWorkerConfig(makeConfig({ redisUrl: '' }));
    expect(d.errors.some((e) => e.includes('REDIS_URL'))).toBe(true);
  });

  it('errors when REDIS_URL has wrong scheme', () => {
    const d = validateWorkerConfig(makeConfig({ redisUrl: 'http://localhost:6379' }));
    expect(d.errors.some((e) => e.includes('REDIS_URL'))).toBe(true);
  });

  it('accepts rediss:// scheme', () => {
    const d = validateWorkerConfig(makeConfig({ redisUrl: 'rediss://host:6380' }));
    expect(d.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateWorkerConfig — DATABASE_URL
// ---------------------------------------------------------------------------

describe('validateWorkerConfig — DATABASE_URL', () => {
  it('warns when DATABASE_URL is absent', () => {
    const d = validateWorkerConfig(makeConfig({ databaseUrl: '' }));
    expect(d.warnings.some((w) => w.includes('DATABASE_URL'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateWorkerConfig — STORAGE_LOCAL_ROOT
// ---------------------------------------------------------------------------

describe('validateWorkerConfig — STORAGE_LOCAL_ROOT', () => {
  it('warns when storageLocalRoot is absent', () => {
    const d = validateWorkerConfig(makeConfig({ storageLocalRoot: '' }));
    expect(d.warnings.some((w) => w.includes('STORAGE_LOCAL_ROOT'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateWorkerConfig — concurrency
// ---------------------------------------------------------------------------

describe('validateWorkerConfig — concurrency', () => {
  it('errors when concurrency is zero', () => {
    const d = validateWorkerConfig(makeConfig({ concurrency: 0 }));
    expect(d.errors.some((e) => e.includes('WORKER_CONCURRENCY'))).toBe(true);
  });

  it('errors when concurrency is negative', () => {
    const d = validateWorkerConfig(makeConfig({ concurrency: -1 }));
    expect(d.errors.some((e) => e.includes('WORKER_CONCURRENCY'))).toBe(true);
  });

  it('accepts concurrency of 1', () => {
    const d = validateWorkerConfig(makeConfig({ concurrency: 1 }));
    expect(d.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateWorkerConfig — retry config
// ---------------------------------------------------------------------------

describe('validateWorkerConfig — retry config', () => {
  it('errors when publishingMaxRetries is negative', () => {
    const d = validateWorkerConfig(makeConfig({ publishingMaxRetries: -1 }));
    expect(d.errors.some((e) => e.includes('PCME_PUBLISHING_MAX_RETRIES'))).toBe(true);
  });

  it('errors when publishingBackoffMs is negative', () => {
    const d = validateWorkerConfig(makeConfig({ publishingBackoffMs: -100 }));
    expect(d.errors.some((e) => e.includes('PCME_PUBLISHING_BACKOFF_MS'))).toBe(true);
  });

  it('accepts zero retries (disabled retries)', () => {
    const d = validateWorkerConfig(makeConfig({ publishingMaxRetries: 0 }));
    expect(d.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// assertNoFatalWorkerErrors
// ---------------------------------------------------------------------------

describe('assertNoFatalWorkerErrors', () => {
  it('does not throw when errors array is empty', () => {
    expect(() => assertNoFatalWorkerErrors({ errors: [], warnings: [] })).not.toThrow();
  });

  it('throws when errors are present', () => {
    expect(() =>
      assertNoFatalWorkerErrors({ errors: ['Redis is required'], warnings: [] }),
    ).toThrow('Worker startup aborted');
  });

  it('does not throw for warnings-only', () => {
    expect(() => assertNoFatalWorkerErrors({ errors: [], warnings: ['DB missing'] })).not.toThrow();
  });
});
