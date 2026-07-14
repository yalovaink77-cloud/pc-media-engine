import { describe, expect, it } from 'vitest';

import {
  alignSuitabilityLimitationLanguage,
  resolveAffiliateDisclosure,
  RESOLVED_AFFILIATE_DISCLOSURE,
} from '../commercial-attribution.js';

describe('resolveAffiliateDisclosure', () => {
  it('replaces the affiliate placeholder section with a resolved disclosure at the end', () => {
    const input = [
      '## Body',
      'Content.',
      '',
      '## Affiliate Disclosure Placeholder',
      '[Affiliate Disclosure Placeholder]',
      '',
      '## Source Notes',
      '- note',
    ].join('\n');
    const resolved = resolveAffiliateDisclosure(input);
    expect(resolved).toContain('## Affiliate Disclosure');
    expect(resolved).toContain(RESOLVED_AFFILIATE_DISCLOSURE);
    expect(resolved).toContain('may earn a commission');
    expect(resolved).not.toContain('[Affiliate Disclosure Placeholder]');
    expect(resolved.indexOf('## Source Notes')).toBeLessThan(
      resolved.indexOf('## Affiliate Disclosure'),
    );
  });
});

describe('alignSuitabilityLimitationLanguage', () => {
  it('removes cross-section contradiction trigger phrases', () => {
    const input = [
      'Individuals may find it beneficial.',
      'There is no guarantee of specific healing outcomes or timelines.',
      'users may still experience issues',
      'seeking safe aftercare solutions',
    ].join('\n');
    const aligned = alignSuitabilityLimitationLanguage(input);
    expect(aligned).not.toMatch(/\bbeneficial\b/i);
    expect(aligned).not.toMatch(/\bno guarantee\b/i);
    expect(aligned).not.toMatch(/\bmay still experience\b/i);
    expect(aligned).not.toMatch(/\bsafe aftercare\b/i);
  });
});
