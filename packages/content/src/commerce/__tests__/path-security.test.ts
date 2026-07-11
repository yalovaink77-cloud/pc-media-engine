import { describe, expect, it } from 'vitest';

import { isPathContained } from '../path-security.js';

describe('isPathContained', () => {
  it('accepts the root path itself', () => {
    expect(isPathContained('/repo', '/repo')).toBe(true);
  });

  it('accepts nested paths under the root', () => {
    expect(isPathContained('/repo/data/brands/a.yaml', '/repo')).toBe(true);
  });

  it('rejects paths outside the root', () => {
    expect(isPathContained('/other/file.yaml', '/repo')).toBe(false);
    expect(isPathContained('/repo-escape/file.yaml', '/repo')).toBe(false);
  });
});
