import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  CommercialAnalyzerProfile,
  EditorialIntelligenceProfile,
  EditorialModuleId,
} from '@pcme/shared';
import {
  DEFAULT_COMMERCIAL_ADVANTAGES_SECTION_ALIASES,
  DEFAULT_COMMERCIAL_ALTERNATIVES_SECTION_ALIASES,
  DEFAULT_COMMERCIAL_DISADVANTAGES_SECTION_ALIASES,
  DEFAULT_COMMERCIAL_DISCLOSURE_SECTION_ALIASES,
} from '@pcme/shared';
import { describe, expect, it, vi } from 'vitest';

import type { GeneratedContentArtifact } from '../../../artifact/types.js';
import { createEditorialAnalyzerModule } from '../../editorial/module.js';
import { createEditorialIntelligenceOrchestrator } from '../../index.js';
import { EditorialModuleRegistry } from '../../registry.js';
import {
  CommercialAnalyzer,
  createCommercialAnalyzerModule,
  createDefaultCommercialRuleRegistry,
} from '../index.js';

const NEILMED_FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../../pilot-piercingconnect/src/__fixtures__/neilmed-generated-review.md',
);

function createRegressionCommercialProfile(): CommercialAnalyzerProfile {
  return Object.freeze({
    disclosure: Object.freeze({
      sectionAliases: DEFAULT_COMMERCIAL_DISCLOSURE_SECTION_ALIASES,
      placeholderPatterns: Object.freeze([String.raw`\[Affiliate Disclosure Placeholder\]`]),
      resolvedDisclosureMarkers: Object.freeze(['affiliate link', 'may earn a commission']),
    }),
    requiredAlternativesSection: Object.freeze({
      id: 'alternatives',
      headingAliases: DEFAULT_COMMERCIAL_ALTERNATIVES_SECTION_ALIASES,
    }),
    minimumAlternativesCount: 4,
    advantagesSectionAliases: DEFAULT_COMMERCIAL_ADVANTAGES_SECTION_ALIASES,
    disadvantagesSectionAliases: DEFAULT_COMMERCIAL_DISADVANTAGES_SECTION_ALIASES,
    comparisonSectionAliases: Object.freeze(['comparison']),
    whoShouldAvoidSectionAliases: Object.freeze(['who should avoid']),
    unsupportedPurchaseRecommendationPatterns: Object.freeze([
      Object.freeze({
        id: 'recommended-for',
        pattern: String.raw`\brecommended for\b`,
        flags: 'i',
      }),
    ]),
    promotionalLanguagePatterns: Object.freeze([
      Object.freeze({
        id: 'beneficial',
        pattern: String.raw`\bbeneficial\b`,
        flags: 'i',
      }),
      Object.freeze({
        id: 'best-choice',
        pattern: String.raw`\bbest (?:choice|option)\b`,
        flags: 'i',
      }),
    ]),
    neutralityMarkers: Object.freeze([
      Object.freeze({
        id: 'editorial-independence',
        pattern: String.raw`\beditorial(?:ly)? independent\b`,
        flags: 'i',
      }),
    ]),
    promotionThresholds: Object.freeze({
      maxPromotionalPhraseCount: 0,
      minNeutralityMarkerCount: 1,
    }),
    prosConsThresholds: Object.freeze({
      minDisadvantagesToAdvantagesRatio: 1.6,
    }),
  });
}

function analyze(content: string, profile: CommercialAnalyzerProfile = Object.freeze({})) {
  const analyzer = new CommercialAnalyzer();
  return analyzer.analyze(
    Object.freeze({
      content,
      reportId: 'report-test',
      artifactId: 'artifact-test',
    }),
    profile,
  );
}

describe('CommercialAnalyzer', () => {
  it('produces deterministic findings for the same input', () => {
    const content = [
      '# Product Review',
      '## Potential Advantages',
      '- Great feature',
      '## Limitations and Uncertainties',
      'Some limitations apply.',
      '## Affiliate Disclosure Placeholder',
      '[Affiliate Disclosure Placeholder]',
    ].join('\n');
    const profile = createRegressionCommercialProfile();
    const first = analyze(content, profile);
    const second = analyze(content, profile);
    expect(second.findings).toEqual(first.findings);
  });

  it('detects missing affiliate disclosure', () => {
    const result = analyze(
      [
        '# Product Review',
        '## Affiliate Disclosure Placeholder',
        '[Affiliate Disclosure Placeholder]',
      ].join('\n'),
      Object.freeze({
        disclosure: Object.freeze({
          sectionAliases: DEFAULT_COMMERCIAL_DISCLOSURE_SECTION_ALIASES,
          placeholderPatterns: Object.freeze([String.raw`\[Affiliate Disclosure Placeholder\]`]),
        }),
      }),
    );
    expect(result.findings.some((finding) => finding.code === 'affiliate-disclosure-missing')).toBe(
      true,
    );
  });

  it('detects duplicate affiliate disclosure sections', () => {
    const result = analyze(
      [
        '# Product Review',
        '## Affiliate Disclosure',
        'We may earn a commission.',
        '## Affiliate Disclosure',
        'Duplicate disclosure.',
      ].join('\n'),
      Object.freeze({
        disclosure: Object.freeze({
          sectionAliases: Object.freeze(['affiliate disclosure']),
        }),
      }),
    );
    expect(
      result.findings.some((finding) => finding.code === 'affiliate-disclosure-duplicate'),
    ).toBe(true);
  });

  it('detects missing alternatives', () => {
    const result = analyze(
      '# Product Review\n\n## Overview\nBody only.',
      Object.freeze({
        requiredAlternativesSection: Object.freeze({
          id: 'alternatives',
          headingAliases: DEFAULT_COMMERCIAL_ALTERNATIVES_SECTION_ALIASES,
        }),
      }),
    );
    expect(result.findings.some((finding) => finding.code === 'missing-alternatives')).toBe(true);
  });

  it('detects insufficient alternatives count', () => {
    const result = analyze(
      ['# Product Review', '## Alternatives', '- Option A', '- Option B', '- Option C'].join('\n'),
      Object.freeze({
        requiredAlternativesSection: Object.freeze({
          id: 'alternatives',
          headingAliases: DEFAULT_COMMERCIAL_ALTERNATIVES_SECTION_ALIASES,
        }),
        minimumAlternativesCount: 4,
      }),
    );
    expect(result.findings.some((finding) => finding.code === 'missing-alternatives')).toBe(true);
  });

  it('detects missing disadvantages', () => {
    const result = analyze(
      '# Product Review\n\n## Potential Advantages\n- Pro item',
      Object.freeze({
        advantagesSectionAliases: DEFAULT_COMMERCIAL_ADVANTAGES_SECTION_ALIASES,
        disadvantagesSectionAliases: DEFAULT_COMMERCIAL_DISADVANTAGES_SECTION_ALIASES,
      }),
    );
    expect(result.findings.some((finding) => finding.code === 'missing-disadvantages')).toBe(true);
  });

  it('detects missing comparison opportunity', () => {
    const result = analyze(
      '# Product Review\n\n## Overview\nShort body.',
      Object.freeze({
        comparisonSectionAliases: Object.freeze(['comparison']),
        requiredAlternativesSection: Object.freeze({
          id: 'alternatives',
          headingAliases: DEFAULT_COMMERCIAL_ALTERNATIVES_SECTION_ALIASES,
        }),
      }),
    );
    expect(
      result.findings.some((finding) => finding.code === 'missing-comparison-opportunity'),
    ).toBe(true);
  });

  it('detects unsupported purchase recommendation language', () => {
    const result = analyze(
      [
        '# Product Review',
        '## FAQ',
        '**Q: Who is this for?**',
        'A: This product is recommended for most users.',
      ].join('\n'),
      Object.freeze({
        unsupportedPurchaseRecommendationPatterns: Object.freeze([
          Object.freeze({
            id: 'recommended-for',
            pattern: String.raw`\brecommended for\b`,
            flags: 'i',
          }),
        ]),
      }),
    );
    expect(
      result.findings.some((finding) => finding.code === 'unsupported-purchase-recommendation'),
    ).toBe(true);
  });

  it('detects overly promotional wording', () => {
    const result = analyze(
      '# Product Review\n\n## Overview\nThis is the best choice for everyone and truly beneficial.',
      Object.freeze({
        promotionalLanguagePatterns: Object.freeze([
          Object.freeze({
            id: 'beneficial',
            pattern: String.raw`\bbeneficial\b`,
            flags: 'i',
          }),
          Object.freeze({
            id: 'best-choice',
            pattern: String.raw`\bbest choice\b`,
            flags: 'i',
          }),
        ]),
        promotionThresholds: Object.freeze({
          maxPromotionalPhraseCount: 0,
        }),
      }),
    );
    expect(result.findings.some((finding) => finding.code === 'overly-promotional-language')).toBe(
      true,
    );
  });

  it('detects imbalanced pros and cons coverage', () => {
    const result = analyze(
      [
        '# Product Review',
        '## Potential Advantages',
        '- First advantage with several descriptive words here.',
        '- Second advantage with more promotional detail.',
        '- Third advantage expanding the section further.',
        '## Limitations and Uncertainties',
        'Brief limitation note.',
      ].join('\n'),
      Object.freeze({
        advantagesSectionAliases: DEFAULT_COMMERCIAL_ADVANTAGES_SECTION_ALIASES,
        disadvantagesSectionAliases: DEFAULT_COMMERCIAL_DISADVANTAGES_SECTION_ALIASES,
        prosConsThresholds: Object.freeze({
          minDisadvantagesToAdvantagesRatio: 1.5,
        }),
      }),
    );
    expect(result.findings.some((finding) => finding.code === 'imbalanced-pros-cons-ratio')).toBe(
      true,
    );
  });

  it('detects missing who-should-avoid guidance', () => {
    const result = analyze(
      '# Product Review\n\n## Who May Consider It\nSome users may consider this product.',
      Object.freeze({
        whoShouldAvoidSectionAliases: Object.freeze(['who should avoid']),
      }),
    );
    expect(
      result.findings.some((finding) => finding.code === 'missing-who-should-avoid-guidance'),
    ).toBe(true);
  });

  it('detects missing neutrality statements when promotional language is present', () => {
    const result = analyze(
      '# Product Review\n\n## Overview\nReaders will find this product beneficial.',
      Object.freeze({
        promotionalLanguagePatterns: Object.freeze([
          Object.freeze({
            id: 'beneficial',
            pattern: String.raw`\bbeneficial\b`,
            flags: 'i',
          }),
        ]),
        neutralityMarkers: Object.freeze([
          Object.freeze({
            id: 'editorial-independence',
            pattern: String.raw`\beditorial(?:ly)? independent\b`,
            flags: 'i',
          }),
        ]),
        promotionThresholds: Object.freeze({
          minNeutralityMarkerCount: 1,
        }),
      }),
    );
    expect(result.findings.some((finding) => finding.code === 'missing-neutrality-statement')).toBe(
      true,
    );
  });

  it('keeps profile-specific markers out of generic defaults', () => {
    const result = analyze('This product is recommended for everyone.');
    expect(
      result.findings.some((finding) => finding.code === 'unsupported-purchase-recommendation'),
    ).toBe(false);
  });

  it('does not mutate analyzed content', () => {
    const content = '# Product Review\n\n## Overview\nBody.';
    const before = content;
    analyze(content, createRegressionCommercialProfile());
    expect(content).toBe(before);
  });

  it('does not perform network or WordPress operations', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked'));
    analyze('# Product Review\n\n## Overview\nBody.');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('honors registry enable and disable behavior', () => {
    const registry = createDefaultCommercialRuleRegistry('test-scope');
    const rule = registry.getByCode('commercial', 'affiliate-disclosure-missing');
    expect(rule).toBeDefined();

    registry.disable(rule!.id);
    const disabledAnalyzer = new CommercialAnalyzer({ ruleRegistry: registry });
    const disabledResult = disabledAnalyzer.analyze(
      Object.freeze({
        content: [
          '# Product Review',
          '## Affiliate Disclosure Placeholder',
          '[Affiliate Disclosure Placeholder]',
        ].join('\n'),
        reportId: 'report-test',
        artifactId: 'artifact-test',
      }),
      Object.freeze({
        disclosure: Object.freeze({
          sectionAliases: DEFAULT_COMMERCIAL_DISCLOSURE_SECTION_ALIASES,
          placeholderPatterns: Object.freeze([String.raw`\[Affiliate Disclosure Placeholder\]`]),
        }),
      }),
    );
    expect(
      disabledResult.findings.some((finding) => finding.code === 'affiliate-disclosure-missing'),
    ).toBe(false);
  });

  it('produces expected findings for the evidence-attributed NeilMed fixture profile', async () => {
    const neilmedDraft = await readFile(NEILMED_FIXTURE_PATH, 'utf8');
    const result = analyze(neilmedDraft, createRegressionCommercialProfile());
    const codes = result.findings.map((finding) => finding.code);

    expect(codes).toContain('affiliate-disclosure-missing');
    expect(codes).toContain('missing-alternatives');
    expect(codes).toContain('unsupported-purchase-recommendation');
    expect(codes).toContain('missing-who-should-avoid-guidance');
    expect(result.findings.length).toBeGreaterThan(0);
  });
});

describe('createCommercialAnalyzerModule integration', () => {
  function createTestArtifact(content: string): GeneratedContentArtifact {
    return Object.freeze({
      artifactId: 'artifact-commercial-analyzer',
      jobId: 'job-commercial-analyzer',
      requestId: 'request-commercial-analyzer',
      sourceId: 'source-commercial-analyzer',
      snapshotId: 'snapshot-commercial-analyzer',
      providerId: 'fake',
      model: 'fake-model',
      contentType: 'product-review',
      locale: 'en',
      tone: 'educational',
      format: 'markdown',
      status: 'generated',
      content,
      warnings: Object.freeze([]),
      policySnapshot: Object.freeze({
        safetyConstraints: Object.freeze([]),
        affiliateConstraints: Object.freeze([]),
        citationRequirements: Object.freeze([]),
        blockedFields: Object.freeze([]),
        strictMode: false,
        contextComplete: true,
        warningCount: 0,
      }),
      createdAt: '2026-07-12T00:00:00.000Z',
    });
  }

  it('assigns stable finding IDs through the orchestrator with commercial module enabled', () => {
    const content = [
      '# Product Review',
      '## Affiliate Disclosure Placeholder',
      '[Affiliate Disclosure Placeholder]',
    ].join('\n');
    const artifact = createTestArtifact(content);
    const profile: EditorialIntelligenceProfile = Object.freeze({
      profileId: 'commercial-analyzer-test',
      contentType: 'product-review',
      locale: 'en',
      enabledModules: Object.freeze(['commercial'] as const satisfies readonly EditorialModuleId[]),
      commercialAnalyzer: Object.freeze({
        disclosure: Object.freeze({
          sectionAliases: DEFAULT_COMMERCIAL_DISCLOSURE_SECTION_ALIASES,
          placeholderPatterns: Object.freeze([String.raw`\[Affiliate Disclosure Placeholder\]`]),
        }),
      }),
    });

    const registry = new EditorialModuleRegistry([createCommercialAnalyzerModule()]);
    const orchestrator = createEditorialIntelligenceOrchestrator({ registry });
    const analyzedAt = '2026-07-12T00:00:00.000Z';

    const report = orchestrator.analyze({ artifact, profile, analyzedAt });
    const commercialFindings = report.findings.filter(
      (finding) => finding.category === 'commercial',
    );

    expect(commercialFindings.length).toBeGreaterThan(0);
    expect(commercialFindings[0]?.id).toMatch(/^[a-f0-9]{32}$/);
    expect(artifact.content).toBe(content);
  });

  it('deduplicates promotional findings across editorial and commercial modules', () => {
    const content = [
      '# NeilMed Piercing Aftercare Fine Mist',
      '## Product Overview',
      'Individuals seeking safe aftercare solutions may appreciate this sterile saline spray.',
    ].join('\n');
    const artifact = createTestArtifact(content);
    const profile: EditorialIntelligenceProfile = Object.freeze({
      profileId: 'commercial-cross-module-test',
      contentType: 'product-review',
      locale: 'en',
      enabledModules: Object.freeze([
        'editorial',
        'commercial',
      ] as const satisfies readonly EditorialModuleId[]),
      editorialAnalyzer: Object.freeze({
        promotionalTonePatterns: Object.freeze([
          Object.freeze({
            id: 'safe-claim',
            pattern: String.raw`\bseeking safe aftercare\b`,
            flags: 'i',
          }),
        ]),
      }),
      commercialAnalyzer: Object.freeze({
        promotionalLanguagePatterns: Object.freeze([
          Object.freeze({
            id: 'safe-claim',
            pattern: String.raw`\bseeking safe aftercare\b`,
            flags: 'i',
          }),
        ]),
        promotionThresholds: Object.freeze({
          maxPromotionalPhraseCount: 0,
        }),
      }),
    });

    const registry = new EditorialModuleRegistry([
      createEditorialAnalyzerModule(),
      createCommercialAnalyzerModule(),
    ]);
    const orchestrator = createEditorialIntelligenceOrchestrator({ registry });
    const report = orchestrator.analyze({
      artifact,
      profile,
      analyzedAt: '2026-07-12T00:00:00.000Z',
    });

    const promotionalCodes = report.findings
      .filter((finding) =>
        ['promotional-tone', 'overly-promotional-language'].includes(finding.code),
      )
      .map((finding) => finding.code);
    expect(promotionalCodes).toHaveLength(1);
    expect(promotionalCodes[0]).toBe('overly-promotional-language');
  });
});
