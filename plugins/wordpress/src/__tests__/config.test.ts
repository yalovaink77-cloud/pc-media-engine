/**
 * Tests for Sprint 33 config hardening:
 * - WORDPRESS_URL alias
 * - requestTimeoutMs loading
 * - URL format validation
 * - validateWordPressConfigStrict
 */

import { describe, expect, it } from 'vitest';

import {
  isHttpsUrl,
  isValidWordPressUrl,
  loadWordPressConfig,
  validateWordPressConfigStrict,
  WordPressConfigError,
} from '../config.js';

// ---------------------------------------------------------------------------
// isValidWordPressUrl
// ---------------------------------------------------------------------------

describe('isValidWordPressUrl', () => {
  it('accepts https:// URLs', () => {
    expect(isValidWordPressUrl('https://example.com')).toBe(true);
  });

  it('accepts http:// URLs', () => {
    expect(isValidWordPressUrl('http://localhost:8080')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidWordPressUrl('')).toBe(false);
  });

  it('rejects bare hostname without scheme', () => {
    expect(isValidWordPressUrl('example.com')).toBe(false);
  });

  it('rejects non-URL strings', () => {
    expect(isValidWordPressUrl('not a url')).toBe(false);
  });

  it('rejects ftp:// scheme', () => {
    expect(isValidWordPressUrl('ftp://example.com')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isHttpsUrl
// ---------------------------------------------------------------------------

describe('isHttpsUrl', () => {
  it('returns true for https', () => {
    expect(isHttpsUrl('https://example.com')).toBe(true);
  });

  it('returns false for http', () => {
    expect(isHttpsUrl('http://example.com')).toBe(false);
  });

  it('returns false for invalid URL', () => {
    expect(isHttpsUrl('not-a-url')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loadWordPressConfig — WORDPRESS_URL alias
// ---------------------------------------------------------------------------

describe('loadWordPressConfig — WORDPRESS_URL alias', () => {
  it('accepts WORDPRESS_URL instead of WORDPRESS_BASE_URL', () => {
    const config = loadWordPressConfig({
      WORDPRESS_URL: 'https://site.com/',
      WORDPRESS_USERNAME: 'editor',
      WORDPRESS_APP_PASSWORD: 'ab cd ef',
    });
    expect(config.baseUrl).toBe('https://site.com');
  });

  it('prefers WORDPRESS_URL over WORDPRESS_BASE_URL when both present', () => {
    const config = loadWordPressConfig({
      WORDPRESS_URL: 'https://preferred.com',
      WORDPRESS_BASE_URL: 'https://legacy.com',
      WORDPRESS_USERNAME: 'u',
      WORDPRESS_APP_PASSWORD: 'p',
    });
    expect(config.baseUrl).toBe('https://preferred.com');
  });

  it('falls back to WORDPRESS_BASE_URL when WORDPRESS_URL absent', () => {
    const config = loadWordPressConfig({
      WORDPRESS_BASE_URL: 'https://legacy.com/',
      WORDPRESS_USERNAME: 'u',
      WORDPRESS_APP_PASSWORD: 'p',
    });
    expect(config.baseUrl).toBe('https://legacy.com');
  });

  it('throws when both WORDPRESS_URL and WORDPRESS_BASE_URL are absent', () => {
    expect(() =>
      loadWordPressConfig({ WORDPRESS_USERNAME: 'u', WORDPRESS_APP_PASSWORD: 'p' }),
    ).toThrow(WordPressConfigError);
  });
});

// ---------------------------------------------------------------------------
// loadWordPressConfig — URL format validation
// ---------------------------------------------------------------------------

describe('loadWordPressConfig — URL format validation', () => {
  it('throws WordPressConfigError for invalid URL format', () => {
    expect(() =>
      loadWordPressConfig({
        WORDPRESS_URL: 'not-a-url',
        WORDPRESS_USERNAME: 'u',
        WORDPRESS_APP_PASSWORD: 'p',
      }),
    ).toThrow(WordPressConfigError);
  });

  it('throws with descriptive message for invalid URL', () => {
    let message = '';
    try {
      loadWordPressConfig({
        WORDPRESS_URL: 'just-a-hostname',
        WORDPRESS_USERNAME: 'u',
        WORDPRESS_APP_PASSWORD: 'p',
      });
    } catch (err) {
      if (err instanceof WordPressConfigError) message = err.message;
    }
    expect(message).toContain('not a valid URL');
  });
});

// ---------------------------------------------------------------------------
// loadWordPressConfig — requestTimeoutMs
// ---------------------------------------------------------------------------

describe('loadWordPressConfig — requestTimeoutMs', () => {
  it('defaults to 30000 when WORDPRESS_REQUEST_TIMEOUT_MS is absent', () => {
    const config = loadWordPressConfig({
      WORDPRESS_URL: 'https://example.com',
      WORDPRESS_USERNAME: 'u',
      WORDPRESS_APP_PASSWORD: 'p',
    });
    expect(config.requestTimeoutMs).toBe(30_000);
  });

  it('reads WORDPRESS_REQUEST_TIMEOUT_MS', () => {
    const config = loadWordPressConfig({
      WORDPRESS_URL: 'https://example.com',
      WORDPRESS_USERNAME: 'u',
      WORDPRESS_APP_PASSWORD: 'p',
      WORDPRESS_REQUEST_TIMEOUT_MS: '60000',
    });
    expect(config.requestTimeoutMs).toBe(60_000);
  });

  it('throws on invalid WORDPRESS_REQUEST_TIMEOUT_MS', () => {
    expect(() =>
      loadWordPressConfig({
        WORDPRESS_URL: 'https://example.com',
        WORDPRESS_USERNAME: 'u',
        WORDPRESS_APP_PASSWORD: 'p',
        WORDPRESS_REQUEST_TIMEOUT_MS: 'not-a-number',
      }),
    ).toThrow(WordPressConfigError);
  });
});

// ---------------------------------------------------------------------------
// validateWordPressConfigStrict
// ---------------------------------------------------------------------------

describe('validateWordPressConfigStrict', () => {
  const validConfig = {
    baseUrl: 'https://example.com',
    username: 'admin',
    appPassword: 'xxxx yyyy zzzz',
    requestTimeoutMs: 30_000,
  };

  it('returns no errors for a valid HTTPS config', () => {
    const result = validateWordPressConfigStrict(validConfig);
    expect(result.errors).toHaveLength(0);
  });

  it('errors when baseUrl is empty', () => {
    const result = validateWordPressConfigStrict({ ...validConfig, baseUrl: '' });
    expect(result.errors.some((e) => e.includes('baseUrl'))).toBe(true);
  });

  it('errors when username is empty', () => {
    const result = validateWordPressConfigStrict({ ...validConfig, username: '' });
    expect(result.errors.some((e) => e.includes('username'))).toBe(true);
  });

  it('errors when appPassword is empty', () => {
    const result = validateWordPressConfigStrict({ ...validConfig, appPassword: '' });
    expect(result.errors.some((e) => e.includes('appPassword'))).toBe(true);
  });

  it('warns when baseUrl uses HTTP instead of HTTPS', () => {
    const result = validateWordPressConfigStrict({
      ...validConfig,
      baseUrl: 'http://example.com',
    });
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes('HTTP'))).toBe(true);
  });

  it('warns when appPassword is very short', () => {
    const result = validateWordPressConfigStrict({ ...validConfig, appPassword: 'short' });
    expect(result.warnings.some((w) => w.includes('short'))).toBe(true);
  });

  it('warns when requestTimeoutMs is very low', () => {
    const result = validateWordPressConfigStrict({
      ...validConfig,
      requestTimeoutMs: 1_000,
    });
    expect(
      result.warnings.some((w) => w.includes('requestTimeoutMs') || w.includes('1000ms')),
    ).toBe(true);
  });
});
