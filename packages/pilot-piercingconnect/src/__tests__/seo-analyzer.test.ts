import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SeoAnalyzer } from '@pcme/ai';
import { describe, expect, it } from 'vitest';

import { createPiercingConnectSeoAnalyzerProfile } from '../seo-profile.js';

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../__fixtures__/neilmed-generated-review.md',
);

describe('PiercingConnect SEO analyzer profile', () => {
  it('produces SEO findings for the NeilMed corrupt fixture without mutating content', async () => {
    const neilmedDraft = await readFile(FIXTURE_PATH, 'utf8');
    const before = neilmedDraft;
    const analyzer = new SeoAnalyzer();
    const result = analyzer.analyze(
      Object.freeze({
        content: neilmedDraft,
        reportId: 'report-neilmed',
        artifactId: 'artifact-neilmed',
      }),
      createPiercingConnectSeoAnalyzerProfile(),
    );

    const codes = result.findings.map((finding) => finding.code);
    expect(codes).toContain('weak-title-keyword-coverage');
    expect(codes).toContain('insufficient-faq-question-count');
    expect(codes).toContain('missing-internal-link-opportunity');
    expect(codes).toContain('missing-external-citation-opportunity');
    expect(codes).toContain('search-intent-gap');
    expect(codes).toContain('indirect-faq-answer');
    expect(neilmedDraft).toBe(before);
  });

  it('keeps PiercingConnect SEO configuration in the profile adapter only', () => {
    const profile = createPiercingConnectSeoAnalyzerProfile();
    expect(profile.targetKeywords?.[0]).toBe('saline spray');
    expect(profile.minimumFaqCount).toBe(4);
    expect(profile.searchIntentQuestions?.length).toBeGreaterThan(0);
  });
});
