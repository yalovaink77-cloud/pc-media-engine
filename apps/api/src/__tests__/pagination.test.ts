import { describe, expect, it } from 'vitest';

import { clampLimit, clampOffset, parseStrictLimit } from '../pagination.js';

describe('clampLimit', () => {
  it('returns default when raw is undefined', () => {
    expect(clampLimit(undefined, 50, 200)).toBe(50);
  });

  it('returns default for invalid values', () => {
    expect(clampLimit('abc', 50, 200)).toBe(50);
    expect(clampLimit('0', 50, 200)).toBe(50);
  });

  it('caps at max', () => {
    expect(clampLimit('500', 50, 200)).toBe(200);
  });
});

describe('clampOffset', () => {
  it('returns 0 when raw is undefined', () => {
    expect(clampOffset(undefined)).toBe(0);
  });

  it('rejects negative offsets', () => {
    expect(clampOffset('-5')).toBe(0);
  });
});

describe('parseStrictLimit', () => {
  it('returns error when over max', () => {
    expect(parseStrictLimit('999', 200, 50).error).toContain('must not exceed');
  });
});
