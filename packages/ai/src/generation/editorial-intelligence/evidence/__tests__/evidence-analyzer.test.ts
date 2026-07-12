import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  EditorialIntelligenceProfile,
  EditorialModuleId,
  EvidenceAnalyzerProfile,
} from '@pcme/shared';
import { DEFAULT_SOURCE_PLACEHOLDER_PATTERN } from '@pcme/shared';
import { describe, expect, it } from 'vitest';

import type { GeneratedContentArtifact } from '../../../artifact/types.js';
import { createEditorialAnalyzerModule } from '../../editorial/module.js';
import { createEditorialIntelligenceOrchestrator } from '../../index.js';
import { EditorialModuleRegistry } from '../../registry.js';
import {
  createDefaultEvidenceRuleRegistry,
  createEvidenceAnalyzerModule,
  EvidenceAnalyzer,
} from '../index.js';

const NEILMED_FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../../pilot-piercingconnect/src/__fixtures__/neilmed-generated-review.md',
);

function createRegressionEvidenceProfile(): EvidenceAnalyzerProfile {
  return Object.freeze({
    requiredSourcePlaceholders: Object.freeze([
      '[Source: product official record]',
      '[Source: ingredient evidence record]',
      '[Source: APP-aligned aftercare guidance]',
    ]),
    sourcePlaceholderPattern: DEFAULT_SOURCE_PLACEHOLDER_PATTERN,
    evidenceNotesSectionAliases: Object.freeze(['source notes', 'source-notes']),
    verificationMarkers: Object.freeze(['human-verified', 'resolved source record']),
    manufacturerClaimMarkers: Object.freeze([
      Object.freeze({
        id: 'marketed-for',
        pattern: String.raw`\bmarketed for\b`,
        flags: 'i',
      }),
    ]),
    medicalClaimMarkers: Object.freeze([
      Object.freeze({
        id: 'healing-process',
        pattern: String.raw`\bhealing process\b`,
        flags: 'i',
      }),
    ]),
    unsupportedFactualStatementMarkers: Object.freeze([
      Object.freeze({
        id: 'supported-by-evidence',
        pattern: String.raw`\bsupported by evidence\b`,
        flags: 'i',
      }),
    ]),
    recommendationWithoutEvidenceMarkers: Object.freeze([
      Object.freeze({
        id: 'recommended-for',
        pattern: String.raw`\brecommended for\b`,
        flags: 'i',
      }),
    ]),
  });
}

function analyze(content: string, profile: EvidenceAnalyzerProfile = Object.freeze({})) {
  const analyzer = new EvidenceAnalyzer();
  return analyzer.analyze(
    Object.freeze({
      content,
      reportId: 'report-test',
      artifactId: 'artifact-test',
    }),
    profile,
  );
}

describe('EvidenceAnalyzer', () => {
  it('produces deterministic findings for the same input', () => {
    const content = 'Claim text [Source: product official record]';
    const profile = createRegressionEvidenceProfile();
    const first = analyze(content, profile);
    const second = analyze(content, profile);
    expect(second.findings).toEqual(first.findings);
  });

  it('detects unresolved source placeholders', () => {
    const result = analyze(
      'Evidence note: [Source: product official record]',
      createRegressionEvidenceProfile(),
    );
    expect(
      result.findings.some((finding) => finding.code === 'unresolved-source-placeholder'),
    ).toBe(true);
  });

  it('detects missing required source placeholders', () => {
    const result = analyze('No placeholders here.', createRegressionEvidenceProfile());
    expect(
      result.findings.some((finding) => finding.code === 'missing-required-source-placeholder'),
    ).toBe(true);
  });

  it('detects duplicate citation placeholders', () => {
    const placeholder = '[Source: product official record]';
    const result = analyze(
      `${placeholder}\n\n## Source Notes\n${placeholder}`,
      createRegressionEvidenceProfile(),
    );
    expect(
      result.findings.some((finding) => finding.code === 'duplicate-citation-placeholder'),
    ).toBe(true);
  });

  it('detects manufacturer claim indicators from profile markers', () => {
    const result = analyze(
      'The product is marketed for routine aftercare use.',
      createRegressionEvidenceProfile(),
    );
    expect(result.findings.some((finding) => finding.code === 'manufacturer-claim-indicator')).toBe(
      true,
    );
  });

  it('detects medical statements without verification markers', () => {
    const result = analyze(
      'The spray may support the healing process during aftercare.',
      createRegressionEvidenceProfile(),
    );
    expect(
      result.findings.some((finding) => finding.code === 'medical-statement-without-evidence'),
    ).toBe(true);
  });

  it('detects recommendations without evidence', () => {
    const result = analyze(
      'This product is recommended for daily aftercare routines.',
      createRegressionEvidenceProfile(),
    );
    expect(
      result.findings.some((finding) => finding.code === 'recommendation-without-evidence'),
    ).toBe(true);
  });

  it('detects missing evidence sections', () => {
    const result = analyze(
      '# Title\n\nBody without required evidence sections.',
      Object.freeze({
        requiredEvidenceSections: Object.freeze([
          Object.freeze({
            id: 'source-notes',
            headingAliases: Object.freeze(['source notes']),
          }),
        ]),
      }),
    );
    expect(
      result.findings.some((finding) => finding.code === 'missing-required-source-section'),
    ).toBe(true);
  });

  it('detects orphan source references', () => {
    const result = analyze(
      [
        '# Title',
        'Inline reference [Source: orphan record] without a note entry.',
        '## Source Notes',
        '- [Source: product official record]',
      ].join('\n'),
      createRegressionEvidenceProfile(),
    );
    expect(result.findings.some((finding) => finding.code === 'orphan-source-reference')).toBe(
      true,
    );
  });

  it('keeps profile-specific markers out of generic defaults', () => {
    const result = analyze('The product is marketed for routine aftercare use.');
    expect(result.findings.some((finding) => finding.code === 'manufacturer-claim-indicator')).toBe(
      false,
    );
  });

  it('does not mutate analyzed content', () => {
    const content = 'Claim [Source: product official record]';
    const before = content;
    analyze(content, createRegressionEvidenceProfile());
    expect(content).toBe(before);
  });

  it('honors registry enable and disable behavior', () => {
    const registry = createDefaultEvidenceRuleRegistry('test-scope');
    const rule = registry.getByCode('evidence', 'unresolved-source-placeholder');
    expect(rule).toBeDefined();

    registry.disable(rule!.id);
    const disabledAnalyzer = new EvidenceAnalyzer({ ruleRegistry: registry });
    const disabledResult = disabledAnalyzer.analyze(
      Object.freeze({
        content: '[Source: product official record]',
        reportId: 'report-test',
        artifactId: 'artifact-test',
      }),
      createRegressionEvidenceProfile(),
    );
    expect(
      disabledResult.findings.some((finding) => finding.code === 'unresolved-source-placeholder'),
    ).toBe(false);

    registry.enable(rule!.id);
    const enabledResult = disabledAnalyzer.analyze(
      Object.freeze({
        content: '[Source: product official record]',
        reportId: 'report-test',
        artifactId: 'artifact-test',
      }),
      createRegressionEvidenceProfile(),
    );
    expect(
      enabledResult.findings.some((finding) => finding.code === 'unresolved-source-placeholder'),
    ).toBe(true);
  });

  it('produces expected findings for the NeilMed corrupt fixture profile', async () => {
    const neilmedDraft = await readFile(NEILMED_FIXTURE_PATH, 'utf8');
    const result = analyze(neilmedDraft, createRegressionEvidenceProfile());
    const codes = result.findings.map((finding) => finding.code);

    expect(codes).toContain('unresolved-source-placeholder');
    expect(codes).toContain('missing-evidence-notes');
    expect(codes).toContain('missing-verification-marker');
    expect(codes).toContain('manufacturer-claim-indicator');
    expect(codes).toContain('recommendation-without-evidence');
    expect(result.findings.length).toBeGreaterThan(0);
  });
});

describe('createEvidenceAnalyzerModule integration', () => {
  function createTestArtifact(content: string): GeneratedContentArtifact {
    return Object.freeze({
      artifactId: 'artifact-evidence-analyzer',
      jobId: 'job-evidence-analyzer',
      requestId: 'request-evidence-analyzer',
      sourceId: 'source-evidence-analyzer',
      snapshotId: 'snapshot-evidence-analyzer',
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

  it('assigns stable finding IDs through the orchestrator with editorial and evidence modules', () => {
    const content = 'Recommended for daily use [Source: product official record]';
    const artifact = createTestArtifact(content);
    const profile: EditorialIntelligenceProfile = Object.freeze({
      profileId: 'evidence-analyzer-test',
      contentType: 'product-review',
      locale: 'en',
      enabledModules: Object.freeze([
        'editorial',
        'evidence',
      ] as const satisfies readonly EditorialModuleId[]),
      evidenceAnalyzer: createRegressionEvidenceProfile(),
    });

    const registry = new EditorialModuleRegistry([
      createEditorialAnalyzerModule(),
      createEvidenceAnalyzerModule(),
    ]);
    const orchestrator = createEditorialIntelligenceOrchestrator({ registry });
    const analyzedAt = '2026-07-12T00:00:00.000Z';

    const report = orchestrator.analyze({ artifact, profile, analyzedAt });
    const evidenceFindings = report.findings.filter((finding) => finding.category === 'evidence');

    expect(evidenceFindings.length).toBeGreaterThan(0);
    expect(evidenceFindings[0]?.id).toMatch(/^[a-f0-9]{32}$/);

    const secondReport = orchestrator.analyze({ artifact, profile, analyzedAt });
    expect(secondReport.findings.filter((finding) => finding.category === 'evidence')).toEqual(
      evidenceFindings,
    );
    expect(artifact.content).toBe(content);
  });
});
