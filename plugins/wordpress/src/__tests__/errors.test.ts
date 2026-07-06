/**
 * Tests for Sprint 33 error categorization:
 * - categorizeHttpStatus
 * - categorizeWpErrorCode
 * - parseWordPressErrorResponse
 * - isRetryableError
 * - WordPressApiError category field
 */

import { describe, expect, it } from 'vitest';

import {
  categorizeHttpStatus,
  categorizeWpErrorCode,
  isRetryableError,
  parseWordPressErrorResponse,
  WordPressApiError,
} from '../errors.js';

// ---------------------------------------------------------------------------
// categorizeHttpStatus
// ---------------------------------------------------------------------------

describe('categorizeHttpStatus', () => {
  it('categorizes 401 as auth', () => {
    expect(categorizeHttpStatus(401)).toBe('auth');
  });

  it('categorizes 403 as auth', () => {
    expect(categorizeHttpStatus(403)).toBe('auth');
  });

  it('categorizes 404 as not_found', () => {
    expect(categorizeHttpStatus(404)).toBe('not_found');
  });

  it('categorizes 429 as rate_limit', () => {
    expect(categorizeHttpStatus(429)).toBe('rate_limit');
  });

  it('categorizes 400 as validation', () => {
    expect(categorizeHttpStatus(400)).toBe('validation');
  });

  it('categorizes 422 as validation', () => {
    expect(categorizeHttpStatus(422)).toBe('validation');
  });

  it('categorizes 500 as server_error', () => {
    expect(categorizeHttpStatus(500)).toBe('server_error');
  });

  it('categorizes 503 as server_error', () => {
    expect(categorizeHttpStatus(503)).toBe('server_error');
  });

  it('categorizes unknown status as unknown', () => {
    expect(categorizeHttpStatus(418)).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// categorizeWpErrorCode
// ---------------------------------------------------------------------------

describe('categorizeWpErrorCode', () => {
  it('categorizes rest_not_logged_in as auth', () => {
    expect(categorizeWpErrorCode('rest_not_logged_in')).toBe('auth');
  });

  it('categorizes rest_forbidden as auth', () => {
    expect(categorizeWpErrorCode('rest_forbidden')).toBe('auth');
  });

  it('categorizes rest_post_invalid_id as not_found', () => {
    expect(categorizeWpErrorCode('rest_post_invalid_id')).toBe('not_found');
  });

  it('categorizes rest_invalid_param_* as validation', () => {
    expect(categorizeWpErrorCode('rest_invalid_param_title')).toBe('validation');
  });

  it('returns null for unknown WP error codes', () => {
    expect(categorizeWpErrorCode('some_custom_error')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// WordPressApiError — category
// ---------------------------------------------------------------------------

describe('WordPressApiError', () => {
  it('infers category from HTTP status when category is absent', () => {
    const err = new WordPressApiError(401, 'rest_not_logged_in', 'Not logged in');
    expect(err.category).toBe('auth');
  });

  it('uses explicit category when provided', () => {
    const err = new WordPressApiError(500, 'server_exploded', 'Boom', 'server_error');
    expect(err.category).toBe('server_error');
  });

  it('has correct name', () => {
    const err = new WordPressApiError(500, 'err', 'msg');
    expect(err.name).toBe('WordPressApiError');
  });

  it('exposes status and code', () => {
    const err = new WordPressApiError(429, 'too_many_requests', 'Slow down');
    expect(err.status).toBe(429);
    expect(err.code).toBe('too_many_requests');
  });
});

// ---------------------------------------------------------------------------
// parseWordPressErrorResponse
// ---------------------------------------------------------------------------

describe('parseWordPressErrorResponse', () => {
  function makeJsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('extracts code and message from JSON body', async () => {
    const res = makeJsonResponse(
      { code: 'rest_not_logged_in', message: 'You are not logged in.' },
      401,
    );
    const err = await parseWordPressErrorResponse(res);
    expect(err.status).toBe(401);
    expect(err.code).toBe('rest_not_logged_in');
    expect(err.message).toBe('You are not logged in.');
  });

  it('categorizes based on WP error code over HTTP status', async () => {
    // HTTP 400 would normally be "validation", but rest_not_logged_in overrides
    const res = makeJsonResponse({ code: 'rest_not_logged_in', message: 'Bad' }, 400);
    const err = await parseWordPressErrorResponse(res);
    expect(err.category).toBe('auth');
  });

  it('falls back to HTTP status when body is not JSON', async () => {
    const res = new Response('Internal Server Error', { status: 500 });
    const err = await parseWordPressErrorResponse(res);
    expect(err.status).toBe(500);
    expect(err.category).toBe('server_error');
  });

  it('uses HTTP status category when code is unrecognised', async () => {
    const res = makeJsonResponse({ code: 'some_custom_code', message: 'Msg' }, 429);
    const err = await parseWordPressErrorResponse(res);
    expect(err.category).toBe('rate_limit');
  });
});

// ---------------------------------------------------------------------------
// isRetryableError
// ---------------------------------------------------------------------------

describe('isRetryableError', () => {
  it('returns true for rate_limit (429)', () => {
    const err = new WordPressApiError(429, 'too_many', 'Slow down');
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns true for server_error (500)', () => {
    const err = new WordPressApiError(500, 'server_error', 'Internal error');
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns false for auth error (401)', () => {
    const err = new WordPressApiError(401, 'rest_not_logged_in', 'Not logged in');
    expect(isRetryableError(err)).toBe(false);
  });

  it('returns false for not_found (404)', () => {
    const err = new WordPressApiError(404, 'rest_no_route', 'Not found');
    expect(isRetryableError(err)).toBe(false);
  });

  it('returns false for validation error (400)', () => {
    const err = new WordPressApiError(400, 'rest_invalid_param', 'Invalid param');
    expect(isRetryableError(err)).toBe(false);
  });

  it('returns true for network TypeError', () => {
    expect(isRetryableError(new TypeError('fetch failed'))).toBe(true);
  });

  it('returns true for AbortError (timeout)', () => {
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    expect(isRetryableError(abort)).toBe(true);
  });

  it('returns false for unknown error types', () => {
    expect(isRetryableError(new Error('random error'))).toBe(false);
    expect(isRetryableError('string error')).toBe(false);
    expect(isRetryableError(null)).toBe(false);
  });
});
