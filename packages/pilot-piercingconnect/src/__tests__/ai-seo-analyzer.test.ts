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
  it('does not flag contradictory suitability on the publication-ready NeilMed fixture', async () => {
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
    expect(codes).not.toContain('contradictory-suitability-or-limitation');
    expect(codes).toContain('incomplete-audience-question-coverage');
    expect(neilmedDraft).toBe(before);
  });

  it('still detects contradictory suitability in misaligned drafts', () => {
    const analyzer = new AiSeoAnalyzer();
    const result = analyzer.analyze(
      Object.freeze({
        content: [
          '## Who May Consider It',
          'This product is beneficial for healing piercings.',
          '## Limitations',
          'There is no guarantee of outcomes.',
        ].join('\n\n'),
        reportId: 'report-corrupt',
        artifactId: 'artifact-corrupt',
      }),
      createPiercingConnectAiSeoAnalyzerProfile(),
    );

    expect(
      result.findings.some((finding) => finding.code === 'contradictory-suitability-or-limitation'),
    ).toBe(true);
  });

  it('keeps PiercingConnect AI SEO configuration in the profile adapter only', () => {
    const profile = createPiercingConnectAiSeoAnalyzerProfile();
    expect(profile.canonicalEntities?.[0]?.canonicalName).toContain('NeilMed');
    expect(profile.audienceQuestions?.length).toBeGreaterThan(0);
    expect(profile.contradictionPatternPairs?.length).toBeGreaterThan(0);
  });
});
