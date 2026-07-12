import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  AiSeoAnalyzerProfile,
  EditorialIntelligenceProfile,
  EditorialModuleId,
} from '@pcme/shared';
import { describe, expect, it, vi } from 'vitest';

import type { GeneratedContentArtifact } from '../../../artifact/types.js';
import { createEditorialAnalyzerModule } from '../../editorial/module.js';
import { createEvidenceAnalyzerModule } from '../../evidence/module.js';
import { createEditorialIntelligenceOrchestrator } from '../../index.js';
import { EditorialModuleRegistry } from '../../registry.js';
import { createSeoAnalyzerModule } from '../../seo/module.js';
import {
  AiSeoAnalyzer,
  createAiSeoAnalyzerModule,
  createDefaultAiSeoRuleRegistry,
} from '../index.js';

const NEILMED_FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../../pilot-piercingconnect/src/__fixtures__/neilmed-generated-review.md',
);

function createRegressionAiSeoProfile(): AiSeoAnalyzerProfile {
  return Object.freeze({
    canonicalEntities: Object.freeze([
      Object.freeze({
        id: 'product',
        canonicalName: 'NeilMed Piercing Aftercare Fine Mist',
      }),
      Object.freeze({
        id: 'app',
        canonicalName: 'Association of Professional Piercers',
      }),
    ]),
    requiredEntityAliases: Object.freeze(['NeilMed', 'sterile saline']),
    audienceQuestions: Object.freeze([
      'Does NeilMed piercing spray prevent keloid formation?',
      'What is the shelf life of NeilMed piercing aftercare mist?',
      'Does NeilMed aftercare compare with homemade saline mixes?',
      'How does NeilMed aftercare compare with homemade saline mixes?',
    ]),
    sectionLengthTargets: Object.freeze({ minWords: 25 }),
    chunkingTargets: Object.freeze({
      maxSectionWords: 120,
      maxParagraphWords: 40,
      minHeadingContextWords: 8,
    }),
    directAnswerPatterns: Object.freeze([
      Object.freeze({
        id: 'definition',
        pattern: String.raw`\bNeilMed\b.{0,80}\bsterile saline\b`,
        flags: 'i',
      }),
    ]),
    sourceTransparencyMarkers: Object.freeze([
      Object.freeze({
        id: 'supported-by-evidence',
        pattern: String.raw`\bsupported by evidence\b`,
        flags: 'i',
      }),
    ]),
    uncertaintyMarkers: Object.freeze([
      Object.freeze({
        id: 'may-vary',
        pattern: String.raw`\bmay vary\b`,
        flags: 'i',
      }),
    ]),
    manufacturerClaimMarkers: Object.freeze([
      Object.freeze({
        id: 'marketed-for',
        pattern: String.raw`\bmarketed for\b`,
        flags: 'i',
      }),
    ]),
    contradictionPatternPairs: Object.freeze([
      Object.freeze({
        id: 'benefit-vs-limitation',
        positivePattern: String.raw`\bbeneficial\b`,
        negativePattern: String.raw`\bno guarantee\b`,
        flags: 'i',
      }),
    ]),
    fillerLanguagePatterns: Object.freeze([
      Object.freeze({
        id: 'advisable',
        pattern: String.raw`\bit is advisable\b`,
        flags: 'i',
      }),
    ]),
    factualDensityThresholds: Object.freeze({
      minNamedEntityMentionsPerSection: 2,
      minContentWordsPerSection: 30,
    }),
    indirectFaqAnswerPatterns: Object.freeze([
      Object.freeze({
        id: 'not-specified',
        pattern: String.raw`\bnot specified\b`,
        flags: 'i',
      }),
    ]),
    citationUnfriendlyPatterns: Object.freeze([
      Object.freeze({
        id: 'some-users',
        pattern: String.raw`\bsome users\b`,
        flags: 'i',
      }),
    ]),
    unsupportedAuthoritativePatterns: Object.freeze([
      Object.freeze({
        id: 'supported-by-evidence',
        pattern: String.raw`\bsupported by evidence\b`,
        flags: 'i',
      }),
    ]),
    vagueClaimPatterns: Object.freeze([
      Object.freeze({
        id: 'beneficial',
        pattern: String.raw`\bbeneficial\b`,
        flags: 'i',
      }),
    ]),
    pronounPatterns: Object.freeze([
      Object.freeze({
        id: 'second-person',
        pattern: String.raw`\b(?:you|your)\b`,
        flags: 'i',
      }),
    ]),
    faqSectionAliases: Object.freeze(['faq']),
    summarySectionAliases: Object.freeze(['editorial summary']),
  });
}

function analyze(content: string, profile: AiSeoAnalyzerProfile = Object.freeze({})) {
  const analyzer = new AiSeoAnalyzer();
  return analyzer.analyze(
    Object.freeze({
      content,
      reportId: 'report-test',
      artifactId: 'artifact-test',
    }),
    profile,
  );
}

describe('AiSeoAnalyzer', () => {
  it('produces deterministic findings for the same input', () => {
    const content = '# Product\n\n## Summary\nNeilMed sterile saline aftercare overview.';
    const profile = createRegressionAiSeoProfile();
    const first = analyze(content, profile);
    const second = analyze(content, profile);
    expect(second.findings).toEqual(first.findings);
  });

  it('detects incomplete canonical entity coverage', () => {
    const result = analyze(
      '# Generic Product\n\n## Summary\nA sterile saline product overview.',
      createRegressionAiSeoProfile(),
    );
    expect(
      result.findings.some((finding) => finding.code === 'incomplete-canonical-entity-coverage'),
    ).toBe(true);
  });

  it('detects ambiguous pronoun-heavy text', () => {
    const result = analyze(
      [
        '# Product Title For Testing',
        '## Guidance',
        'If you notice irritation, you should act quickly because it may vary and your experience could differ.',
      ].join('\n'),
      Object.freeze({
        requiredEntityAliases: Object.freeze(['Named Product Entity']),
        pronounPatterns: Object.freeze([
          Object.freeze({
            id: 'pronouns',
            pattern: String.raw`\b(?:you|your|it|they|them)\b`,
            flags: 'i',
          }),
        ]),
      }),
    );
    expect(result.findings.some((finding) => finding.code === 'ambiguous-entity-reference')).toBe(
      true,
    );
  });

  it('detects missing direct-answer openings', () => {
    const result = analyze(
      [
        '# NeilMed Piercing Aftercare Fine Mist',
        '## Editorial Summary',
        'This article discusses aftercare topics in general terms.',
      ].join('\n'),
      createRegressionAiSeoProfile(),
    );
    expect(
      result.findings.some((finding) => finding.code === 'missing-direct-answer-opening'),
    ).toBe(true);
  });

  it('detects indirect FAQ answers', () => {
    const result = analyze(
      [
        '# NeilMed Piercing Aftercare Fine Mist',
        '## FAQ',
        '**Q: How often should I use the spray?**',
        'A: The frequency is not specified.',
      ].join('\n'),
      createRegressionAiSeoProfile(),
    );
    expect(result.findings.some((finding) => finding.code === 'indirect-faq-answer')).toBe(true);
  });

  it('detects oversized sections for retrieval', () => {
    const body = 'NeilMed sterile saline aftercare fact. '.repeat(40);
    const result = analyze(
      `# NeilMed Piercing Aftercare Fine Mist\n\n## Editorial Summary\n${body}`,
      createRegressionAiSeoProfile(),
    );
    expect(
      result.findings.some((finding) => finding.code === 'section-too-long-for-retrieval'),
    ).toBe(true);
  });

  it('detects thin sections', () => {
    const result = analyze(
      '# NeilMed Piercing Aftercare Fine Mist\n\n## Notes\nShort.',
      createRegressionAiSeoProfile(),
    );
    expect(
      result.findings.some((finding) => finding.code === 'section-too-thin-to-stand-alone'),
    ).toBe(true);
  });

  it('detects missing heading-led context', () => {
    const result = analyze(
      ['# NeilMed Piercing Aftercare Fine Mist', '## Product Overview', 'Yes.'].join('\n'),
      createRegressionAiSeoProfile(),
    );
    expect(result.findings.some((finding) => finding.code === 'missing-heading-led-context')).toBe(
      true,
    );
  });

  it('detects low source transparency', () => {
    const result = analyze(
      [
        '# NeilMed Piercing Aftercare Fine Mist',
        '## Evidence',
        'This approach is supported by evidence for aftercare routines.',
      ].join('\n'),
      createRegressionAiSeoProfile(),
    );
    expect(result.findings.some((finding) => finding.code === 'low-source-transparency')).toBe(
      true,
    );
  });

  it('detects missing manufacturer versus verified labeling', () => {
    const result = analyze(
      [
        '# NeilMed Piercing Aftercare Fine Mist',
        '## Overview',
        'The product is marketed for routine aftercare use.',
      ].join('\n'),
      createRegressionAiSeoProfile(),
    );
    expect(
      result.findings.some(
        (finding) => finding.code === 'missing-manufacturer-versus-verified-labeling',
      ),
    ).toBe(true);
  });

  it('detects unsupported authoritative phrasing as blocking', () => {
    const result = analyze(
      [
        '# NeilMed Piercing Aftercare Fine Mist',
        '## Evidence',
        'The spray is supported by evidence for healing support.',
      ].join('\n'),
      createRegressionAiSeoProfile(),
    );
    const finding = result.findings.find(
      (entry) => entry.code === 'unsupported-authoritative-phrasing',
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('high');
    expect(finding?.confidence).toBe('high');
  });

  it('detects incomplete audience question coverage', () => {
    const result = analyze(
      '# NeilMed Piercing Aftercare Fine Mist\n\n## Overview\nGeneral product text.',
      createRegressionAiSeoProfile(),
    );
    expect(
      result.findings.some((finding) => finding.code === 'incomplete-audience-question-coverage'),
    ).toBe(true);
  });

  it('detects duplicated question coverage buckets', () => {
    const result = analyze(
      '# NeilMed Product\n\n## Overview\nBody text.',
      createRegressionAiSeoProfile(),
    );
    expect(result.findings.some((finding) => finding.code === 'duplicated-question-coverage')).toBe(
      true,
    );
  });

  it('detects contradictory suitability and limitation statements', () => {
    const result = analyze(
      [
        '# NeilMed Piercing Aftercare Fine Mist',
        '## Suitability',
        'Readers may find NeilMed beneficial, but there is no guarantee of outcomes and users may still experience issues.',
      ].join('\n'),
      createRegressionAiSeoProfile(),
    );
    expect(
      result.findings.some((finding) => finding.code === 'contradictory-suitability-or-limitation'),
    ).toBe(true);
  });

  it('detects low factual density', () => {
    const result = analyze(
      [
        '# NeilMed Piercing Aftercare Fine Mist',
        '## Overview',
        [
          'This section repeats generic aftercare guidance without naming specific entities or concrete facts',
          'in enough detail for retrieval systems to use across multiple paragraphs of filler-style explanation',
          'that stays intentionally abstract and avoids proper nouns beyond the opening title reference',
        ].join(' '),
      ].join('\n'),
      createRegressionAiSeoProfile(),
    );
    expect(result.findings.some((finding) => finding.code === 'low-factual-density')).toBe(true);
  });

  it('detects filler language', () => {
    const result = analyze(
      [
        '# NeilMed Piercing Aftercare Fine Mist',
        '## Guidance',
        'It is advisable to follow professional guidance. It is advisable to monitor healing closely.',
      ].join('\n'),
      createRegressionAiSeoProfile(),
    );
    expect(result.findings.some((finding) => finding.code === 'excessive-filler-language')).toBe(
      true,
    );
  });

  it('detects citation-unfriendly phrasing', () => {
    const result = analyze(
      '# NeilMed Piercing Aftercare Fine Mist\n\n## Overview\nSome users prefer saline sprays.',
      Object.freeze({
        citationUnfriendlyPatterns: Object.freeze([
          Object.freeze({
            id: 'some-users',
            pattern: String.raw`\bsome users\b`,
            flags: 'i',
          }),
        ]),
      }),
    );
    expect(
      result.findings.some((finding) => finding.code === 'citation-unfriendly-statement'),
    ).toBe(true);
  });

  it('keeps profile-specific markers out of generic defaults', () => {
    const result = analyze('The product is marketed for routine use.');
    expect(
      result.findings.some(
        (finding) => finding.code === 'missing-manufacturer-versus-verified-labeling',
      ),
    ).toBe(false);
  });

  it('does not mutate analyzed content', () => {
    const content = '# NeilMed Piercing Aftercare Fine Mist\n\n## Overview\nBody.';
    const before = content;
    analyze(content, createRegressionAiSeoProfile());
    expect(content).toBe(before);
  });

  it('does not perform network or WordPress operations', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked'));
    analyze('# NeilMed Product\n\n## Overview\nBody.');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('honors registry enable and disable behavior', () => {
    const registry = createDefaultAiSeoRuleRegistry('test-scope');
    const rule = registry.getByCode('ai-seo', 'missing-direct-answer-opening');
    expect(rule).toBeDefined();

    registry.disable(rule!.id);
    const analyzer = new AiSeoAnalyzer({ ruleRegistry: registry });
    const disabled = analyzer.analyze(
      Object.freeze({
        content: '# Product\n\n## Editorial Summary\nGeneric opening.',
        reportId: 'report-test',
        artifactId: 'artifact-test',
      }),
      createRegressionAiSeoProfile(),
    );
    expect(
      disabled.findings.some((finding) => finding.code === 'missing-direct-answer-opening'),
    ).toBe(false);
  });

  it('produces expected findings for the evidence-attributed NeilMed fixture profile', async () => {
    const neilmedDraft = await readFile(NEILMED_FIXTURE_PATH, 'utf8');
    const result = analyze(neilmedDraft, createRegressionAiSeoProfile());
    const codes = result.findings.map((finding) => finding.code);

    expect(codes).toContain('indirect-faq-answer');
    expect(codes).toContain('incomplete-audience-question-coverage');
    expect(codes).not.toContain('contradictory-suitability-or-limitation');
    expect(codes).not.toContain('unsupported-authoritative-phrasing');
    expect(result.findings.length).toBeGreaterThan(0);
  });
});

describe('createAiSeoAnalyzerModule integration', () => {
  function createTestArtifact(content: string): GeneratedContentArtifact {
    return Object.freeze({
      artifactId: 'artifact-ai-seo-analyzer',
      jobId: 'job-ai-seo-analyzer',
      requestId: 'request-ai-seo-analyzer',
      sourceId: 'source-ai-seo-analyzer',
      snapshotId: 'snapshot-ai-seo-analyzer',
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

  it('assigns stable finding IDs through the orchestrator with all four active modules', () => {
    const content = '# NeilMed Piercing Aftercare Fine Mist\n\n## Overview\nBody.';
    const artifact = createTestArtifact(content);
    const profile: EditorialIntelligenceProfile = Object.freeze({
      profileId: 'ai-seo-analyzer-test',
      contentType: 'product-review',
      locale: 'en',
      enabledModules: Object.freeze([
        'editorial',
        'evidence',
        'seo',
        'ai-seo',
      ] as const satisfies readonly EditorialModuleId[]),
      aiSeoAnalyzer: createRegressionAiSeoProfile(),
    });

    const registry = new EditorialModuleRegistry([
      createEditorialAnalyzerModule(),
      createEvidenceAnalyzerModule(),
      createSeoAnalyzerModule(),
      createAiSeoAnalyzerModule(),
    ]);
    const orchestrator = createEditorialIntelligenceOrchestrator({ registry });
    const analyzedAt = '2026-07-12T00:00:00.000Z';

    const report = orchestrator.analyze({ artifact, profile, analyzedAt });
    const aiSeoFindings = report.findings.filter((finding) => finding.category === 'ai-seo');

    expect(aiSeoFindings.length).toBeGreaterThan(0);
    expect(aiSeoFindings[0]?.id).toMatch(/^[a-f0-9]{32}$/);
    expect(artifact.content).toBe(content);
  });
});
