import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EvidenceAnalyzer } from '@pcme/ai';
import { describe, expect, it } from 'vitest';

import { createPiercingConnectEvidenceAnalyzerProfile } from '../evidence-profile.js';

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../__fixtures__/neilmed-generated-review.md',
);

describe('PiercingConnect evidence analyzer profile', () => {
  it('produces evidence findings for the NeilMed corrupt fixture without mutating content', async () => {
    const neilmedDraft = await readFile(FIXTURE_PATH, 'utf8');
    const before = neilmedDraft;
    const analyzer = new EvidenceAnalyzer();
    const result = analyzer.analyze(
      Object.freeze({
        content: neilmedDraft,
        reportId: 'report-neilmed',
        artifactId: 'artifact-neilmed',
      }),
      createPiercingConnectEvidenceAnalyzerProfile(),
    );

    const codes = result.findings.map((finding) => finding.code);
    expect(codes).toContain('unresolved-source-placeholder');
    expect(codes).toContain('missing-evidence-notes');
    expect(codes).toContain('missing-verification-marker');
    expect(codes).toContain('manufacturer-claim-indicator');
    expect(neilmedDraft).toBe(before);
  });

  it('keeps PiercingConnect markers in the profile adapter only', () => {
    const profile = createPiercingConnectEvidenceAnalyzerProfile();
    expect(profile.manufacturerClaimMarkers?.[0]?.id).toBe('marketed-for');
    expect(profile.requiredSourcePlaceholders).toHaveLength(3);
  });
});
