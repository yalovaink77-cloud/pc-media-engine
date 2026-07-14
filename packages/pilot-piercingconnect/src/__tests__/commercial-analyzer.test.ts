import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CommercialAnalyzer } from '@pcme/ai';
import { describe, expect, it } from 'vitest';

import { createPiercingConnectCommercialAnalyzerProfile } from '../commercial-profile.js';

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../__fixtures__/neilmed-generated-review.md',
);

describe('PiercingConnect commercial analyzer profile', () => {
  it('does not flag affiliate disclosure missing on the publication-ready NeilMed fixture', async () => {
    const neilmedDraft = await readFile(FIXTURE_PATH, 'utf8');
    const before = neilmedDraft;
    const analyzer = new CommercialAnalyzer();
    const result = analyzer.analyze(
      Object.freeze({
        content: neilmedDraft,
        reportId: 'report-neilmed',
        artifactId: 'artifact-neilmed',
      }),
      createPiercingConnectCommercialAnalyzerProfile(),
    );

    const codes = result.findings.map((finding) => finding.code);
    expect(codes).not.toContain('affiliate-disclosure-missing');
    expect(codes).toContain('missing-alternatives');
    expect(neilmedDraft).toBe(before);
  });

  it('still detects missing affiliate disclosure in placeholder output', () => {
    const analyzer = new CommercialAnalyzer();
    const result = analyzer.analyze(
      Object.freeze({
        content: '## Affiliate Disclosure Placeholder\n[Affiliate Disclosure Placeholder]',
        reportId: 'report-corrupt',
        artifactId: 'artifact-corrupt',
      }),
      createPiercingConnectCommercialAnalyzerProfile(),
    );

    expect(result.findings.some((finding) => finding.code === 'affiliate-disclosure-missing')).toBe(
      true,
    );
  });

  it('keeps PiercingConnect commercial configuration in the profile adapter only', () => {
    const profile = createPiercingConnectCommercialAnalyzerProfile();
    expect(profile.minimumAlternativesCount).toBe(4);
    expect(profile.disclosure?.placeholderPatterns?.length).toBeGreaterThan(0);
    expect(profile.unsupportedPurchaseRecommendationPatterns?.length).toBeGreaterThan(0);
  });
});
