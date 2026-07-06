/**
 * Ghost error mapping tests — Sprint 35.
 */

import { describe, expect, it } from 'vitest';

import {
  categorizeGhostErrorType,
  categorizeHttpStatus,
  GhostApiError,
  isRetryableError,
  parseGhostErrorResponse,
} from '../errors.js';

describe('categorizeHttpStatus', () => {
  it('maps 401 to auth', () => {
    expect(categorizeHttpStatus(401)).toBe('auth');
  });

  it('maps 429 to rate_limit', () => {
    expect(categorizeHttpStatus(429)).toBe('rate_limit');
  });

  it('maps 500 to server_error', () => {
    expect(categorizeHttpStatus(500)).toBe('server_error');
  });
});

describe('categorizeGhostErrorType', () => {
  it('maps UnauthorizedError to auth', () => {
    expect(categorizeGhostErrorType('UnauthorizedError')).toBe('auth');
  });

  it('maps ValidationError to validation', () => {
    expect(categorizeGhostErrorType('ValidationError')).toBe('validation');
  });
});

describe('parseGhostErrorResponse', () => {
  it('extracts message from Ghost error body', async () => {
    const res = new Response(
      JSON.stringify({
        errors: [{ message: 'Invalid token', type: 'UnauthorizedError' }],
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
    const err = await parseGhostErrorResponse(res);
    expect(err.status).toBe(401);
    expect(err.message).toBe('Invalid token');
    expect(err.category).toBe('auth');
  });
});

describe('isRetryableError', () => {
  it('429 is retryable', () => {
    expect(isRetryableError(new GhostApiError(429, 'rate', 'slow'))).toBe(true);
  });

  it('401 is not retryable', () => {
    expect(isRetryableError(new GhostApiError(401, 'auth', 'no'))).toBe(false);
  });

  it('TypeError is retryable', () => {
    expect(isRetryableError(new TypeError('fetch failed'))).toBe(true);
  });
});
