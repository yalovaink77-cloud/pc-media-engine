/**
 * Ghost Admin API JWT auth tests — Sprint 35.
 */

import { describe, expect, it } from 'vitest';

import { buildGhostAuthHeader, createGhostJwt, parseGhostAdminApiKey } from '../auth.js';

const FAKE_KEY =
  '633c86459f984d202ff980e9e1:8d3c5e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e';

describe('parseGhostAdminApiKey', () => {
  it('splits id and secret', () => {
    const parts = parseGhostAdminApiKey('abc123:deadbeef');
    expect(parts.id).toBe('abc123');
    expect(parts.secret.equals(Buffer.from('deadbeef', 'hex'))).toBe(true);
  });

  it('throws for missing colon', () => {
    expect(() => parseGhostAdminApiKey('invalid')).toThrow('format');
  });
});

describe('createGhostJwt', () => {
  it('returns a three-part JWT', () => {
    const token = createGhostJwt(FAKE_KEY, 1_700_000_000);
    expect(token.split('.')).toHaveLength(3);
  });

  it('produces deterministic output for fixed timestamp', () => {
    const a = createGhostJwt(FAKE_KEY, 1_700_000_000);
    const b = createGhostJwt(FAKE_KEY, 1_700_000_000);
    expect(a).toBe(b);
  });
});

describe('buildGhostAuthHeader', () => {
  it('prefixes token with Ghost', () => {
    const header = buildGhostAuthHeader(FAKE_KEY);
    expect(header.startsWith('Ghost ')).toBe(true);
  });
});
