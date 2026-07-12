import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  EditorialAnalyzerProfile,
  EditorialIntelligenceProfile,
  EditorialModuleId,
} from '@pcme/shared';
import { DEFAULT_EDITORIAL_ANALYZER_THRESHOLDS } from '@pcme/shared';
import { describe, expect, it } from 'vitest';

import type { GeneratedContentArtifact } from '../../../artifact/types.js';
import {
  buildDeterministicEditorialFindingId,
  createEditorialIntelligenceOrchestrator,
} from '../../index.js';
import { EditorialModuleRegistry } from '../../registry.js';
import {
  createDefaultEditorialRuleRegistry,
  createEditorialAnalyzerModule,
  EditorialAnalyzer,
} from '../index.js';

const NEILMED_FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../../pilot-piercingconnect/src/__fixtures__/neilmed-generated-review.md',
);

function createRegressionAnalyzerProfile(): EditorialAnalyzerProfile {
  return Object.freeze({
    thresholds: Object.freeze({
      maxSentenceWordCount: 40,
      maxParagraphCharacterCount: 800,
      minSectionWordCount: 20,
    }),
    confirmedMergedWordTokens: Object.freeze([
      'simpleformulation',
      'includingits',
      'asa',
      'fluidsand',
      'universallyapplicable',
      'seekinga',
      'cleanlinessduring',
      'professionalpiercer',
      'aftercarefine',
    ]),
    productNameGluePatterns: Object.freeze([String.raw`\bAftercareFine\b`]),
    promotionalTonePatterns: Object.freeze([
      Object.freeze({
        id: 'beneficial-claim',
        pattern: String.raw`\bbeneficial\b`,
        flags: 'i',
      }),
      Object.freeze({
        id: 'supported-by-evidence',
        pattern: String.raw`\bsupported by evidence\b`,
        flags: 'i',
      }),
    ]),
    diagnosticTonePatterns: Object.freeze([
      Object.freeze({
        id: 'guaranteed-healing',
        pattern: String.raw`\bwill\s+heal\b`,
        flags: 'i',
      }),
    ]),
  });
}

function analyze(content: string, profile: EditorialAnalyzerProfile = Object.freeze({})) {
  const analyzer = new EditorialAnalyzer();
  return analyzer.analyze(
    Object.freeze({
      content,
      reportId: 'report-test',
      artifactId: 'artifact-test',
    }),
    profile,
  );
}

describe('EditorialAnalyzer', () => {
  it('produces deterministic findings for the same input', () => {
    const content = '# Title\n\n## Section\n\nThis is a simpleformulation example.';
    const profile = createRegressionAnalyzerProfile();
    const first = analyze(content, profile);
    const second = analyze(content, profile);

    expect(second.findings).toEqual(first.findings);
  });

  it('detects confirmed merged-word corruption from profile tokens', () => {
    const result = analyze('A simpleformulation appears here.', createRegressionAnalyzerProfile());

    expect(result.findings.some((finding) => finding.code === 'formatting-corruption')).toBe(true);
    expect(result.findings.some((finding) => finding.metadata?.token === 'simpleformulation')).toBe(
      true,
    );
  });

  it('does not emit heading findings for valid Markdown', () => {
    const content = [
      '# Product Title',
      '',
      '## Editorial Summary',
      'This section has enough words to avoid thin-section findings in the default profile and remains substantive for testing valid heading structure only.',
      '',
      '## Product Overview',
      'Another substantive section with enough words to remain above the default threshold and avoid thin-section findings during valid markdown checks.',
    ].join('\n');

    const result = analyze(content);

    expect(
      result.findings.filter((finding) =>
        [
          'duplicate-h1',
          'invalid-heading-hierarchy',
          'malformed-markdown-heading',
          'repeated-section-heading',
          'thin-section',
        ].includes(finding.code),
      ),
    ).toEqual([]);
  });

  it('detects duplicate H1 headings', () => {
    const content = '# First Title\n\n# Second Title\n\nBody text.';
    const result = analyze(content);

    expect(result.findings.some((finding) => finding.code === 'duplicate-h1')).toBe(true);
  });

  it('detects invalid heading hierarchy when levels are skipped', () => {
    const content =
      '# Title\n\n### Skipped H2\n\nBody text with enough words to avoid thin section.';
    const result = analyze(content);

    expect(result.findings.some((finding) => finding.code === 'invalid-heading-hierarchy')).toBe(
      true,
    );
  });

  it('detects thin sections below the configured threshold', () => {
    const content = '# Title\n\n## Thin\n\nToo short.';
    const result = analyze(
      content,
      Object.freeze({
        thresholds: Object.freeze({
          ...DEFAULT_EDITORIAL_ANALYZER_THRESHOLDS,
          minSectionWordCount: 20,
        }),
      }),
    );

    expect(result.findings.some((finding) => finding.code === 'thin-section')).toBe(true);
  });

  it('detects excessively long paragraphs', () => {
    const longParagraph = 'word '.repeat(200).trim();
    const content = `# Title\n\n## Section\n\n${longParagraph}`;
    const result = analyze(
      content,
      Object.freeze({
        thresholds: Object.freeze({
          ...DEFAULT_EDITORIAL_ANALYZER_THRESHOLDS,
          maxParagraphCharacterCount: 100,
        }),
      }),
    );

    expect(result.findings.some((finding) => finding.code === 'long-paragraph')).toBe(true);
  });

  it('detects excessively long sentences', () => {
    const longSentence = Array.from({ length: 45 }, (_, index) => `word${index}`).join(' ');
    const content = `# Title\n\n## Section\n\n${longSentence}.`;
    const result = analyze(
      content,
      Object.freeze({
        thresholds: Object.freeze({
          ...DEFAULT_EDITORIAL_ANALYZER_THRESHOLDS,
          maxSentenceWordCount: 40,
        }),
      }),
    );

    expect(result.findings.some((finding) => finding.code === 'long-sentence')).toBe(true);
  });

  it('detects repeated section headings', () => {
    const content = [
      '# Title',
      '## FAQ',
      'First answer with enough words to avoid thin section detection in this test case.',
      '## FAQ',
      'Second answer with enough words to avoid thin section detection in this test case.',
    ].join('\n');

    const result = analyze(content);
    expect(result.findings.some((finding) => finding.code === 'repeated-section-heading')).toBe(
      true,
    );
  });

  it('detects promotional tone patterns from the profile', () => {
    const result = analyze(
      'Readers may find this product beneficial for routine aftercare.',
      Object.freeze({
        promotionalTonePatterns: Object.freeze([
          Object.freeze({
            id: 'beneficial-claim',
            pattern: String.raw`\bbeneficial\b`,
            flags: 'i',
          }),
        ]),
      }),
    );

    expect(result.findings.some((finding) => finding.code === 'promotional-tone')).toBe(true);
  });

  it('detects diagnostic tone patterns from the profile', () => {
    const result = analyze(
      'This product will heal your piercing quickly without complications.',
      Object.freeze({
        diagnosticTonePatterns: Object.freeze([
          Object.freeze({
            id: 'guaranteed-healing',
            pattern: String.raw`\bwill\s+heal\b`,
            flags: 'i',
          }),
        ]),
      }),
    );

    expect(result.findings.some((finding) => finding.code === 'diagnostic-tone')).toBe(true);
  });

  it('keeps profile-specific tokens out of generic defaults', () => {
    const result = analyze('A simpleformulation appears here.');

    expect(result.findings.some((finding) => finding.code === 'formatting-corruption')).toBe(false);
  });

  it('does not mutate analyzed content', () => {
    const content = '# Title\n\nsimpleformulation token remains.';
    const before = content;
    analyze(content, createRegressionAnalyzerProfile());
    expect(content).toBe(before);
  });

  it('detects malformed Markdown headings', () => {
    const content = '# Valid Title\n\n##Invalid Heading\n\nBody text.';
    const result = analyze(content);

    expect(result.findings.some((finding) => finding.code === 'malformed-markdown-heading')).toBe(
      true,
    );
  });

  it('honors registry enable and disable behavior', () => {
    const registry = createDefaultEditorialRuleRegistry('test-scope');
    const longSentenceRule = registry.getByCode('editorial', 'long-sentence');
    expect(longSentenceRule).toBeDefined();

    registry.disable(longSentenceRule!.id);
    const analyzer = new EditorialAnalyzer({ ruleRegistry: registry });
    const longSentence = `${Array.from({ length: 45 }, (_, index) => `word${index}`).join(' ')}.`;
    const disabledResult = analyzer.analyze(
      Object.freeze({
        content: `# Title\n\n## Section\n\n${longSentence}`,
        reportId: 'report-test',
        artifactId: 'artifact-test',
      }),
      Object.freeze({
        thresholds: Object.freeze({
          ...DEFAULT_EDITORIAL_ANALYZER_THRESHOLDS,
          maxSentenceWordCount: 40,
        }),
      }),
    );

    expect(disabledResult.findings.some((finding) => finding.code === 'long-sentence')).toBe(false);

    registry.enable(longSentenceRule!.id);
    const enabledResult = analyzer.analyze(
      Object.freeze({
        content: `# Title\n\n## Section\n\n${longSentence}`,
        reportId: 'report-test',
        artifactId: 'artifact-test',
      }),
      Object.freeze({
        thresholds: Object.freeze({
          ...DEFAULT_EDITORIAL_ANALYZER_THRESHOLDS,
          maxSentenceWordCount: 40,
        }),
      }),
    );

    expect(enabledResult.findings.some((finding) => finding.code === 'long-sentence')).toBe(true);
  });

  it('produces expected findings for the evidence-attributed NeilMed fixture profile', async () => {
    const neilmedDraft = await readFile(NEILMED_FIXTURE_PATH, 'utf8');
    const result = analyze(neilmedDraft, createRegressionAnalyzerProfile());
    const codes = result.findings.map((finding) => finding.code);

    expect(codes).not.toContain('formatting-corruption');
    expect(codes).toContain('thin-section');
    expect(result.findings.length).toBeGreaterThan(0);
  });
});

describe('createEditorialAnalyzerModule integration', () => {
  function createTestArtifact(content: string): GeneratedContentArtifact {
    return Object.freeze({
      artifactId: 'artifact-editorial-analyzer',
      jobId: 'job-editorial-analyzer',
      requestId: 'request-editorial-analyzer',
      sourceId: 'source-editorial-analyzer',
      snapshotId: 'snapshot-editorial-analyzer',
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

  it('assigns stable finding IDs through the orchestrator', () => {
    const content = 'A simpleformulation appears in this draft body.';
    const artifact = createTestArtifact(content);

    const profile: EditorialIntelligenceProfile = Object.freeze({
      profileId: 'editorial-analyzer-test',
      contentType: 'product-review',
      locale: 'en',
      enabledModules: Object.freeze(['editorial'] as const satisfies readonly EditorialModuleId[]),
      editorialAnalyzer: createRegressionAnalyzerProfile(),
    });

    const registry = new EditorialModuleRegistry([createEditorialAnalyzerModule()]);
    const orchestrator = createEditorialIntelligenceOrchestrator({ registry });
    const analyzedAt = '2026-07-12T00:00:00.000Z';

    const firstReport = orchestrator.analyze({ artifact, profile, analyzedAt });
    const secondReport = orchestrator.analyze({ artifact, profile, analyzedAt });

    expect(firstReport.findings.length).toBeGreaterThan(0);
    expect(secondReport.findings).toEqual(firstReport.findings);
    const corruptionFinding = firstReport.findings.find(
      (finding) =>
        finding.code === 'formatting-corruption' && finding.metadata?.token === 'simpleformulation',
    );
    expect(corruptionFinding).toBeDefined();
    expect(corruptionFinding?.id).toBe(
      buildDeterministicEditorialFindingId({
        reportId: firstReport.reportId,
        category: 'editorial',
        analyzerId: corruptionFinding!.analyzerId,
        code: corruptionFinding!.code,
        identityKey: 'token:simpleformulation',
      }),
    );
    expect(artifact.content).toBe(content);
  });
});
