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
  it('does not flag formatting corruption on the clean NeilMed fixture', async () => {
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
    expect(codes).not.toContain('formatting-corruption');
    expect(codes).toContain('promotional-tone');
    expect(neilmedDraft).toBe(before);
  });

  it('still detects formatting corruption in corrupted provider output', () => {
    const analyzer = new EditorialAnalyzer();
    const result = analyzer.analyze(
      Object.freeze({
        content: 'A simpleformulation appears in this draft body.',
        reportId: 'report-corrupt',
        artifactId: 'artifact-corrupt',
      }),
      createPiercingConnectEditorialAnalyzerProfile(),
    );

    expect(result.findings.some((finding) => finding.code === 'formatting-corruption')).toBe(true);
  });

  it('does not hardcode NeilMed tokens in the generic analyzer package', () => {
    const profile = createPiercingConnectEditorialAnalyzerProfile();
    expect(profile.confirmedMergedWordTokens).toContain('simpleformulation');
    expect(profile.productNameGluePatterns?.[0]).toContain('AftercareFine');
  });
});
