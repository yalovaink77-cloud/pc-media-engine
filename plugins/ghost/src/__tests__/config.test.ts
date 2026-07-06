/**
 * Ghost config tests — Sprint 35.
 */

import { describe, expect, it } from 'vitest';

import {
  GhostConfigError,
  isValidGhostAdminApiKey,
  isValidGhostUrl,
  loadGhostConfig,
  validateGhostConfigStrict,
} from '../config.js';

const VALID_KEY =
  '633c86459f984d202ff980e9e1:8d3c5e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e';

describe('loadGhostConfig', () => {
  it('loads config from env vars', () => {
    const cfg = loadGhostConfig({
      GHOST_URL: 'https://blog.example.com/',
      GHOST_ADMIN_API_KEY: VALID_KEY,
    });
    expect(cfg.baseUrl).toBe('https://blog.example.com');
    expect(cfg.adminApiKey).toBe(VALID_KEY);
    expect(cfg.requestTimeoutMs).toBe(30_000);
  });

  it('reads GHOST_REQUEST_TIMEOUT_MS', () => {
    const cfg = loadGhostConfig({
      GHOST_URL: 'https://blog.example.com',
      GHOST_ADMIN_API_KEY: VALID_KEY,
      GHOST_REQUEST_TIMEOUT_MS: '45000',
    });
    expect(cfg.requestTimeoutMs).toBe(45_000);
  });

  it('throws when GHOST_URL is missing', () => {
    expect(() => loadGhostConfig({ GHOST_ADMIN_API_KEY: VALID_KEY })).toThrow(GhostConfigError);
  });

  it('throws when API key is missing', () => {
    expect(() => loadGhostConfig({ GHOST_URL: 'https://blog.example.com' })).toThrow(
      GhostConfigError,
    );
  });

  it('throws for invalid URL', () => {
    expect(() => loadGhostConfig({ GHOST_URL: 'not-url', GHOST_ADMIN_API_KEY: VALID_KEY })).toThrow(
      GhostConfigError,
    );
  });

  it('throws for invalid API key format', () => {
    expect(() =>
      loadGhostConfig({ GHOST_URL: 'https://blog.example.com', GHOST_ADMIN_API_KEY: 'bad' }),
    ).toThrow(GhostConfigError);
  });
});

describe('isValidGhostUrl', () => {
  it('accepts https URLs', () => {
    expect(isValidGhostUrl('https://example.com')).toBe(true);
  });

  it('rejects bare hostnames', () => {
    expect(isValidGhostUrl('example.com')).toBe(false);
  });
});

describe('isValidGhostAdminApiKey', () => {
  it('accepts id:hex format', () => {
    expect(isValidGhostAdminApiKey(VALID_KEY)).toBe(true);
  });

  it('rejects keys without colon', () => {
    expect(isValidGhostAdminApiKey('nocolon')).toBe(false);
  });
});

describe('validateGhostConfigStrict', () => {
  it('returns no errors for valid config', () => {
    const result = validateGhostConfigStrict({
      baseUrl: 'https://blog.example.com',
      adminApiKey: VALID_KEY,
      requestTimeoutMs: 30_000,
    });
    expect(result.errors).toHaveLength(0);
  });

  it('warns on HTTP URL', () => {
    const result = validateGhostConfigStrict({
      baseUrl: 'http://blog.example.com',
      adminApiKey: VALID_KEY,
    });
    expect(result.warnings.some((w) => w.includes('HTTP'))).toBe(true);
  });
});
