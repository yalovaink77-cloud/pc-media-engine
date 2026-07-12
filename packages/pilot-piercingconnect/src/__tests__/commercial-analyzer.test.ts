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
  it('produces commercial findings for the NeilMed corrupt fixture without mutating content', async () => {
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
    expect(codes).toContain('affiliate-disclosure-missing');
    expect(codes).toContain('missing-alternatives');
    expect(codes).toContain('imbalanced-pros-cons-ratio');
    expect(codes).toContain('unsupported-purchase-recommendation');
    expect(codes).toContain('missing-who-should-avoid-guidance');
    expect(neilmedDraft).toBe(before);
  });

  it('keeps PiercingConnect commercial configuration in the profile adapter only', () => {
    const profile = createPiercingConnectCommercialAnalyzerProfile();
    expect(profile.minimumAlternativesCount).toBe(4);
    expect(profile.disclosure?.placeholderPatterns?.length).toBeGreaterThan(0);
    expect(profile.unsupportedPurchaseRecommendationPatterns?.length).toBeGreaterThan(0);
  });
});
