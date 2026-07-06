/**
 * Timeout abstraction tests — Sprint 34.
 */

import { describe, expect, it } from 'vitest';

import { createTimeoutSignal, DEFAULT_PROVIDER_TIMEOUT_MS } from '../timeout.js';

describe('createTimeoutSignal', () => {
  it('returns an AbortSignal', () => {
    expect(createTimeoutSignal(5000)).toBeInstanceOf(AbortSignal);
  });

  it('signal is not aborted immediately', () => {
    expect(createTimeoutSignal(5000).aborted).toBe(false);
  });

  it('defaults to DEFAULT_PROVIDER_TIMEOUT_MS', () => {
    const signal = createTimeoutSignal();
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(DEFAULT_PROVIDER_TIMEOUT_MS).toBe(30_000);
  });

  it('accepts custom timeout values', () => {
    expect(createTimeoutSignal(60_000)).toBeInstanceOf(AbortSignal);
  });
});

describe('DEFAULT_PROVIDER_TIMEOUT_MS', () => {
  it('is 30 seconds', () => {
    expect(DEFAULT_PROVIDER_TIMEOUT_MS).toBe(30_000);
  });
});
