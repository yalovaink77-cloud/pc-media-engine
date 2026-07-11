import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EditorialAnalyzer } from '@pcme/ai';
import { describe, expect, it } from 'vitest';

import { createPiercingConnectEditorialAnalyzerProfile } from '../editorial-profile.js';

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../__fixtures__/neilmed-generated-review.md',
);

describe('PiercingConnect editorial analyzer profile', () => {
  it('produces editorial findings for the NeilMed corrupt fixture without mutating content', async () => {
    const neilmedDraft = await readFile(FIXTURE_PATH, 'utf8');
    const before = neilmedDraft;
    const analyzer = new EditorialAnalyzer();
    const result = analyzer.analyze(
      Object.freeze({
        content: neilmedDraft,
        reportId: 'report-neilmed',
        artifactId: 'artifact-neilmed',
      }),
      createPiercingConnectEditorialAnalyzerProfile(),
    );

    const codes = result.findings.map((finding) => finding.code);
    expect(codes).toContain('formatting-corruption');
    expect(codes).toContain('promotional-tone');
    expect(neilmedDraft).toBe(before);
  });

  it('does not hardcode NeilMed tokens in the generic analyzer package', () => {
    const profile = createPiercingConnectEditorialAnalyzerProfile();
    expect(profile.confirmedMergedWordTokens).toContain('simpleformulation');
    expect(profile.productNameGluePatterns?.[0]).toContain('AftercareFine');
  });
});
