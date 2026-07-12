import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  EditorialIntelligenceProfile,
  EditorialModuleId,
  SeoAnalyzerProfile,
} from '@pcme/shared';
import { describe, expect, it, vi } from 'vitest';

import type { GeneratedContentArtifact } from '../../../artifact/types.js';
import { createEditorialAnalyzerModule } from '../../editorial/module.js';
import { createEvidenceAnalyzerModule } from '../../evidence/module.js';
import { createEditorialIntelligenceOrchestrator } from '../../index.js';
import { EditorialModuleRegistry } from '../../registry.js';
import { createDefaultSeoRuleRegistry, createSeoAnalyzerModule, SeoAnalyzer } from '../index.js';

const NEILMED_FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../../pilot-piercingconnect/src/__fixtures__/neilmed-generated-review.md',
);

function createRegressionSeoProfile(): SeoAnalyzerProfile {
  return Object.freeze({
    targetKeywords: Object.freeze(['saline spray', 'piercing aftercare spray']),
    requiredEntities: Object.freeze(['NeilMed', 'sterile saline']),
    searchIntentQuestions: Object.freeze([
      'Does NeilMed piercing spray prevent keloid formation?',
      'What is the shelf life of NeilMed piercing aftercare mist?',
    ]),
    requiredSections: Object.freeze([
      Object.freeze({
        id: 'faq',
        headingAliases: Object.freeze(['faq']),
      }),
      Object.freeze({
        id: 'product-overview',
        headingAliases: Object.freeze(['product overview']),
      }),
    ]),
    titleLengthThresholds: Object.freeze({ min: 30, max: 60 }),
    metaDescriptionLengthThresholds: Object.freeze({ min: 70, max: 155 }),
    minimumFaqCount: 4,
    faqSectionAliases: Object.freeze(['faq']),
    metaDescriptionSectionAliases: Object.freeze(['editorial summary']),
    internalLinkTargetDescriptors: Object.freeze([
      Object.freeze({
        id: 'professional-piercer',
        pattern: String.raw`\bprofessional piercer\b`,
        flags: 'i',
      }),
    ]),
    externalCitationOpportunityMarkers: Object.freeze([
      Object.freeze({
        id: 'supported-by-evidence',
        pattern: String.raw`\bsupported by evidence\b`,
        flags: 'i',
      }),
    ]),
    indirectFaqAnswerPatterns: Object.freeze([
      Object.freeze({
        id: 'consult-professional',
        pattern: String.raw`\bconsult with a professional\b`,
        flags: 'i',
      }),
      Object.freeze({
        id: 'not-specified',
        pattern: String.raw`\bnot specified\b`,
        flags: 'i',
      }),
    ]),
    contentCompletenessThresholds: Object.freeze({
      minSectionWordCount: 20,
    }),
  });
}

function analyze(content: string, profile: SeoAnalyzerProfile = Object.freeze({})) {
  const analyzer = new SeoAnalyzer();
  return analyzer.analyze(
    Object.freeze({
      content,
      reportId: 'report-test',
      artifactId: 'artifact-test',
    }),
    profile,
  );
}

describe('SeoAnalyzer', () => {
  it('produces deterministic findings for the same input', () => {
    const content =
      '# Product Title That Is Long Enough For SEO\n\n## Editorial Summary\nSummary text.';
    const profile = createRegressionSeoProfile();
    const first = analyze(content, profile);
    const second = analyze(content, profile);
    expect(second.findings).toEqual(first.findings);
  });

  it('detects missing H1', () => {
    const result = analyze('## Section Only\n\nBody text.');
    expect(result.findings.some((finding) => finding.code === 'missing-h1')).toBe(true);
  });

  it('detects duplicate H1 headings', () => {
    const result = analyze('# First Title\n\n# Second Title');
    expect(result.findings.some((finding) => finding.code === 'duplicate-h1')).toBe(true);
  });

  it('accepts valid heading hierarchy', () => {
    const result = analyze('# Title\n\n## Section\n\n### Subsection');
    expect(result.findings.some((finding) => finding.code === 'invalid-heading-hierarchy')).toBe(
      false,
    );
  });

  it('detects invalid heading hierarchy', () => {
    const result = analyze('# Title\n\n### Skipped Level');
    expect(result.findings.some((finding) => finding.code === 'invalid-heading-hierarchy')).toBe(
      true,
    );
  });

  it('detects title length boundaries', () => {
    const shortResult = analyze(
      '# Short',
      Object.freeze({
        titleLengthThresholds: Object.freeze({ min: 30, max: 60 }),
      }),
    );
    expect(shortResult.findings.some((finding) => finding.code === 'title-too-short')).toBe(true);

    const longTitle = '# '.concat('A'.repeat(80));
    const longResult = analyze(
      longTitle,
      Object.freeze({
        titleLengthThresholds: Object.freeze({ min: 30, max: 60 }),
      }),
    );
    expect(longResult.findings.some((finding) => finding.code === 'title-too-long')).toBe(true);
  });

  it('detects weak title keyword coverage', () => {
    const result = analyze(
      '# Generic Product Review Title For Testing Purposes',
      Object.freeze({
        targetKeywords: Object.freeze(['saline spray']),
        titleLengthThresholds: Object.freeze({ min: 20, max: 80 }),
      }),
    );
    expect(result.findings.some((finding) => finding.code === 'weak-title-keyword-coverage')).toBe(
      true,
    );
  });

  it('detects missing required topic entities', () => {
    const result = analyze(
      '# NeilMed Piercing Aftercare Fine Mist Long Enough\n\n## Editorial Summary\nOverview.',
      Object.freeze({
        requiredEntities: Object.freeze(['missing entity phrase']),
        titleLengthThresholds: Object.freeze({ min: 20, max: 80 }),
      }),
    );
    expect(
      result.findings.some((finding) => finding.code === 'missing-required-topic-entity'),
    ).toBe(true);
  });

  it('detects missing FAQ section', () => {
    const result = analyze(
      '# Title Long Enough For Thresholds\n\n## Overview\nBody.',
      Object.freeze({
        minimumFaqCount: 2,
        faqSectionAliases: Object.freeze(['faq']),
        titleLengthThresholds: Object.freeze({ min: 20, max: 80 }),
      }),
    );
    expect(result.findings.some((finding) => finding.code === 'missing-faq-section')).toBe(true);
  });

  it('detects insufficient FAQ question count', () => {
    const result = analyze(
      [
        '# Title Long Enough For SEO Thresholds',
        '## FAQ',
        '**Q: First question?**',
        'A: First answer.',
        '**Q: Second question?**',
        'A: Second answer.',
      ].join('\n'),
      Object.freeze({
        minimumFaqCount: 3,
        faqSectionAliases: Object.freeze(['faq']),
        titleLengthThresholds: Object.freeze({ min: 20, max: 80 }),
      }),
    );
    expect(
      result.findings.some((finding) => finding.code === 'insufficient-faq-question-count'),
    ).toBe(true);
  });

  it('detects duplicate FAQ questions', () => {
    const result = analyze(
      [
        '# Title Long Enough For SEO Thresholds',
        '## FAQ',
        '**Q: How often should I clean my piercing?**',
        'A: Follow professional guidance.',
        '**Q: How often should I clean my piercing?**',
        'A: Follow professional guidance again.',
      ].join('\n'),
      Object.freeze({
        faqSectionAliases: Object.freeze(['faq']),
        titleLengthThresholds: Object.freeze({ min: 20, max: 80 }),
      }),
    );
    expect(result.findings.some((finding) => finding.code === 'duplicate-faq-question')).toBe(true);
  });

  it('detects indirect FAQ answers', () => {
    const result = analyze(
      [
        '# Title Long Enough For SEO Thresholds',
        '## FAQ',
        '**Q: How often should I clean my piercing?**',
        'A: The frequency is not specified. Consult with a professional.',
      ].join('\n'),
      Object.freeze({
        faqSectionAliases: Object.freeze(['faq']),
        indirectFaqAnswerPatterns: Object.freeze([
          Object.freeze({
            id: 'consult-professional',
            pattern: String.raw`\bconsult with a professional\b`,
            flags: 'i',
          }),
        ]),
        titleLengthThresholds: Object.freeze({ min: 20, max: 80 }),
      }),
    );
    expect(result.findings.some((finding) => finding.code === 'indirect-faq-answer')).toBe(true);
  });

  it('detects missing internal link opportunities', () => {
    const result = analyze(
      [
        '# Title Long Enough For SEO Thresholds',
        '## Guidance',
        'Ask a professional piercer for tailored advice.',
      ].join('\n'),
      Object.freeze({
        internalLinkTargetDescriptors: Object.freeze([
          Object.freeze({
            id: 'professional-piercer',
            pattern: String.raw`\bprofessional piercer\b`,
            flags: 'i',
          }),
        ]),
        titleLengthThresholds: Object.freeze({ min: 20, max: 80 }),
      }),
    );
    expect(
      result.findings.some((finding) => finding.code === 'missing-internal-link-opportunity'),
    ).toBe(true);
  });

  it('detects external citation opportunities', () => {
    const result = analyze(
      [
        '# Title Long Enough For SEO Thresholds',
        '## Evidence',
        'This approach is supported by evidence for aftercare routines.',
      ].join('\n'),
      Object.freeze({
        externalCitationOpportunityMarkers: Object.freeze([
          Object.freeze({
            id: 'supported-by-evidence',
            pattern: String.raw`\bsupported by evidence\b`,
            flags: 'i',
          }),
        ]),
        titleLengthThresholds: Object.freeze({ min: 20, max: 80 }),
      }),
    );
    expect(
      result.findings.some((finding) => finding.code === 'missing-external-citation-opportunity'),
    ).toBe(true);
  });

  it('detects search intent gaps', () => {
    const result = analyze(
      '# NeilMed Piercing Aftercare Fine Mist Long Enough\n\n## Overview\nGeneral product text.',
      Object.freeze({
        searchIntentQuestions: Object.freeze([
          'Does NeilMed piercing aftercare reduce infection risk?',
        ]),
        titleLengthThresholds: Object.freeze({ min: 20, max: 80 }),
      }),
    );
    expect(result.findings.some((finding) => finding.code === 'search-intent-gap')).toBe(true);
  });

  it('detects required section gaps', () => {
    const result = analyze(
      '# Title Long Enough For SEO Thresholds\n\n## Overview\nBody.',
      Object.freeze({
        requiredSections: Object.freeze([
          Object.freeze({
            id: 'faq',
            headingAliases: Object.freeze(['faq']),
          }),
        ]),
        titleLengthThresholds: Object.freeze({ min: 20, max: 80 }),
      }),
    );
    expect(result.findings.some((finding) => finding.code === 'missing-required-section')).toBe(
      true,
    );
  });

  it('keeps profile-specific markers out of generic defaults', () => {
    const result = analyze('Ask a professional piercer for advice.');
    expect(
      result.findings.some((finding) => finding.code === 'missing-internal-link-opportunity'),
    ).toBe(false);
  });

  it('does not mutate analyzed content', () => {
    const content = '# Title Long Enough For SEO Thresholds\n\n## FAQ\nBody.';
    const before = content;
    analyze(content, createRegressionSeoProfile());
    expect(content).toBe(before);
  });

  it('does not perform network or WordPress operations', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked'));
    const result = analyze('# Title Long Enough For SEO\n\n## Overview\nBody.');
    expect(result.findings.length).toBeGreaterThanOrEqual(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('honors registry enable and disable behavior', () => {
    const registry = createDefaultSeoRuleRegistry('test-scope');
    const rule = registry.getByCode('seo', 'missing-h1');
    expect(rule).toBeDefined();

    registry.disable(rule!.id);
    const disabledAnalyzer = new SeoAnalyzer({ ruleRegistry: registry });
    const disabledResult = disabledAnalyzer.analyze(
      Object.freeze({
        content: '## No Title\n\nBody.',
        reportId: 'report-test',
        artifactId: 'artifact-test',
      }),
    );
    expect(disabledResult.findings.some((finding) => finding.code === 'missing-h1')).toBe(false);

    registry.enable(rule!.id);
    const enabledResult = disabledAnalyzer.analyze(
      Object.freeze({
        content: '## No Title\n\nBody.',
        reportId: 'report-test',
        artifactId: 'artifact-test',
      }),
    );
    expect(enabledResult.findings.some((finding) => finding.code === 'missing-h1')).toBe(true);
  });

  it('produces expected findings for the NeilMed corrupt fixture profile', async () => {
    const neilmedDraft = await readFile(NEILMED_FIXTURE_PATH, 'utf8');
    const result = analyze(neilmedDraft, createRegressionSeoProfile());
    const codes = result.findings.map((finding) => finding.code);

    expect(codes).toContain('weak-title-keyword-coverage');
    expect(codes).toContain('insufficient-faq-question-count');
    expect(codes).toContain('missing-internal-link-opportunity');
    expect(codes).toContain('missing-external-citation-opportunity');
    expect(codes).toContain('search-intent-gap');
    expect(codes).toContain('indirect-faq-answer');
    expect(result.findings.length).toBeGreaterThan(0);
  });
});

describe('createSeoAnalyzerModule integration', () => {
  function createTestArtifact(content: string): GeneratedContentArtifact {
    return Object.freeze({
      artifactId: 'artifact-seo-analyzer',
      jobId: 'job-seo-analyzer',
      requestId: 'request-seo-analyzer',
      sourceId: 'source-seo-analyzer',
      snapshotId: 'snapshot-seo-analyzer',
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

  it('assigns stable finding IDs through the orchestrator with all three active modules', () => {
    const content = '# NeilMed Piercing Aftercare Fine Mist Long Enough\n\n## Overview\nBody.';
    const artifact = createTestArtifact(content);
    const profile: EditorialIntelligenceProfile = Object.freeze({
      profileId: 'seo-analyzer-test',
      contentType: 'product-review',
      locale: 'en',
      enabledModules: Object.freeze([
        'editorial',
        'evidence',
        'seo',
      ] as const satisfies readonly EditorialModuleId[]),
      seoAnalyzer: createRegressionSeoProfile(),
    });

    const registry = new EditorialModuleRegistry([
      createEditorialAnalyzerModule(),
      createEvidenceAnalyzerModule(),
      createSeoAnalyzerModule(),
    ]);
    const orchestrator = createEditorialIntelligenceOrchestrator({ registry });
    const analyzedAt = '2026-07-12T00:00:00.000Z';

    const report = orchestrator.analyze({ artifact, profile, analyzedAt });
    const seoFindings = report.findings.filter((finding) => finding.category === 'seo');

    expect(seoFindings.length).toBeGreaterThan(0);
    expect(seoFindings[0]?.id).toMatch(/^[a-f0-9]{32}$/);

    const secondReport = orchestrator.analyze({ artifact, profile, analyzedAt });
    expect(secondReport.findings.filter((finding) => finding.category === 'seo')).toEqual(
      seoFindings,
    );
    expect(artifact.content).toBe(content);
  });
});
