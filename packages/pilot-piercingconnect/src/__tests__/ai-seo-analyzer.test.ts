import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AiSeoAnalyzer } from '@pcme/ai';
import { describe, expect, it } from 'vitest';

import { createPiercingConnectAiSeoAnalyzerProfile } from '../ai-seo-profile.js';

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../__fixtures__/neilmed-generated-review.md',
);

describe('PiercingConnect AI SEO analyzer profile', () => {
  it('produces AI SEO findings for the NeilMed corrupt fixture without mutating content', async () => {
    const neilmedDraft = await readFile(FIXTURE_PATH, 'utf8');
    const before = neilmedDraft;
    const analyzer = new AiSeoAnalyzer();
    const result = analyzer.analyze(
      Object.freeze({
        content: neilmedDraft,
        reportId: 'report-neilmed',
        artifactId: 'artifact-neilmed',
      }),
      createPiercingConnectAiSeoAnalyzerProfile(),
    );

    const codes = result.findings.map((finding) => finding.code);
    expect(codes).toContain('incomplete-audience-question-coverage');
    expect(codes).toContain('indirect-faq-answer');
    expect(codes).toContain('contradictory-suitability-or-limitation');
    expect(codes).toContain('low-source-transparency');
    expect(neilmedDraft).toBe(before);
  });

  it('keeps PiercingConnect AI SEO configuration in the profile adapter only', () => {
    const profile = createPiercingConnectAiSeoAnalyzerProfile();
    expect(profile.canonicalEntities?.[0]?.canonicalName).toContain('NeilMed');
    expect(profile.audienceQuestions?.length).toBeGreaterThan(0);
    expect(profile.contradictionPatternPairs?.length).toBeGreaterThan(0);
  });
});
