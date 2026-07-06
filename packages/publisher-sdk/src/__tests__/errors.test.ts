/**
 * SDK error types and retry classification tests — Sprint 34.
 */

import { describe, expect, it } from 'vitest';

import { isRetryableCategory, isRetryableError, PublisherError } from '../errors.js';

describe('isRetryableCategory', () => {
  it('rate_limit is retryable', () => {
    expect(isRetryableCategory('rate_limit')).toBe(true);
  });

  it('server_error is retryable', () => {
    expect(isRetryableCategory('server_error')).toBe(true);
  });

  it('network is retryable', () => {
    expect(isRetryableCategory('network')).toBe(true);
  });

  it('auth is not retryable', () => {
    expect(isRetryableCategory('auth')).toBe(false);
  });

  it('not_found is not retryable', () => {
    expect(isRetryableCategory('not_found')).toBe(false);
  });

  it('validation is not retryable', () => {
    expect(isRetryableCategory('validation')).toBe(false);
  });

  it('unknown is not retryable', () => {
    expect(isRetryableCategory('unknown')).toBe(false);
  });
});

describe('PublisherError', () => {
  it('has correct name', () => {
    expect(new PublisherError('msg').name).toBe('PublisherError');
  });

  it('defaults category to unknown', () => {
    expect(new PublisherError('msg').category).toBe('unknown');
  });

  it('stores the given category', () => {
    expect(new PublisherError('msg', 'auth').category).toBe('auth');
  });

  it('retryable=true for rate_limit', () => {
    expect(new PublisherError('msg', 'rate_limit').retryable).toBe(true);
  });

  it('retryable=false for auth', () => {
    expect(new PublisherError('msg', 'auth').retryable).toBe(false);
  });

  it('retryable=false for unknown', () => {
    expect(new PublisherError('msg').retryable).toBe(false);
  });
});

describe('isRetryableError', () => {
  it('returns true for retryable PublisherError', () => {
    expect(isRetryableError(new PublisherError('boom', 'server_error'))).toBe(true);
  });

  it('returns false for non-retryable PublisherError', () => {
    expect(isRetryableError(new PublisherError('boom', 'auth'))).toBe(false);
  });

  it('returns true for TypeError (network)', () => {
    expect(isRetryableError(new TypeError('fetch failed'))).toBe(true);
  });

  it('returns true for AbortError', () => {
    const e = Object.assign(new Error('abort'), { name: 'AbortError' });
    expect(isRetryableError(e)).toBe(true);
  });

  it('returns true for TimeoutError', () => {
    const e = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    expect(isRetryableError(e)).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isRetryableError(new Error('random'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isRetryableError(null)).toBe(false);
  });

  it('returns false for string', () => {
    expect(isRetryableError('error string')).toBe(false);
  });

  it('handles duck-typed errors with category field', () => {
    const duckTyped = { category: 'rate_limit' };
    expect(isRetryableError(duckTyped)).toBe(true);
  });

  it('duck-typed auth is not retryable', () => {
    expect(isRetryableError({ category: 'auth' })).toBe(false);
  });
});
