import type { ContentGenerationPlan } from '@pcme/content';
import type {
  EditorialFinding,
  EditorialIntelligenceReport,
  GeneratedContentArtifact,
} from '@pcme/shared';
import { RevisionValidationError } from '@pcme/shared';
import { describe, expect, it } from 'vitest';

import {
  buildDeterministicRevisionRequestId,
  buildRevisionRequestFromReport,
  compareRevisionReports,
  createRevisionGenerationJob,
} from '../index.js';

const REVIEWER = Object.freeze({ reviewerId: 'reviewer-001', displayName: 'Reviewer' });
const FIXED_CREATED_AT = '2026-07-12T12:00:00.000Z';

function createPriorArtifact(): GeneratedContentArtifact {
  return Object.freeze({
    artifactId: 'artifact-v1',
    revisionNumber: 1,
    rootArtifactId: 'artifact-v1',
    jobId: 'job-001',
    requestId: 'request-001',
    sourceId: 'source-001',
    snapshotId: 'snapshot-001',
    providerId: 'fake',
    contentType: 'product-review',
    locale: 'en',
    tone: 'educational',
    format: 'markdown',
    content: '# Draft v1\n\nBody.',
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
    status: 'generated',
    createdAt: FIXED_CREATED_AT,
  });
}

function createFinding(
  overrides: Partial<EditorialFinding> & Pick<EditorialFinding, 'id' | 'code' | 'severity'>,
): EditorialFinding {
  return Object.freeze({
    category: 'editorial',
    analyzerId: 'readability',
    checkId: 'formatting',
    confidence: 'high',
    reason: 'Test reason',
    recommendation: Object.freeze({ text: 'Fix it.' }),
    acceptanceCriteria: Object.freeze({ text: 'Issue resolved.' }),
    ...overrides,
  });
}

function createReport(findings: readonly EditorialFinding[]): EditorialIntelligenceReport {
  return Object.freeze({
    reportId: 'report-001',
    artifactId: 'artifact-v1',
    profileId: 'profile-001',
    contentType: 'product-review',
    locale: 'en',
    analyzedAt: FIXED_CREATED_AT,
    moduleSummaries: Object.freeze([]),
    findings,
    scores: Object.freeze({
      totalFindings: findings.length,
      blockingFindings: findings.filter((finding) => finding.severity === 'high').length,
      advisoryFindings: findings.filter((finding) => finding.severity !== 'high').length,
    }),
    publicationReadiness: Object.freeze({
      status: 'needs-revision',
      blockingFindingCount: findings.filter((finding) => finding.severity === 'high').length,
      advisoryFindingCount: findings.filter((finding) => finding.severity !== 'high').length,
      note: 'Human approval required.',
    }),
  });
}

describe('buildDeterministicRevisionRequestId', () => {
  it('returns a stable 32-character identifier', () => {
    const input = Object.freeze({
      reviewId: 'review-001',
      reportId: 'report-001',
      createdAt: FIXED_CREATED_AT,
    });
    expect(buildDeterministicRevisionRequestId(input)).toBe(
      buildDeterministicRevisionRequestId(input),
    );
    expect(buildDeterministicRevisionRequestId(input)).toHaveLength(32);
  });
});

describe('buildRevisionRequestFromReport', () => {
  it('groups findings by module in deterministic order', () => {
    const report = createReport(
      Object.freeze([
        createFinding({
          id: 'finding-seo',
          code: 'missing-h1',
          severity: 'medium',
          category: 'seo',
        }),
        createFinding({
          id: 'finding-editorial',
          code: 'long-sentence',
          severity: 'low',
          category: 'editorial',
        }),
      ]),
    );

    const request = buildRevisionRequestFromReport({
      reviewId: 'review-001',
      priorArtifact: createPriorArtifact(),
      report,
      reviewer: REVIEWER,
      sourceSnapshotId: 'snapshot-001',
      createdAt: FIXED_CREATED_AT,
    });

    expect(request.moduleBundles.map((bundle) => bundle.module)).toEqual(['editorial', 'seo']);
    expect(request.priority).toBe('should-fix');
    expect(request.globalConstraints.humanApprovalRequired).toBe(true);
  });

  it('filters findings when selectedFindingIds are provided', () => {
    const report = createReport(
      Object.freeze([
        createFinding({ id: 'finding-a', code: 'alpha', severity: 'high' }),
        createFinding({ id: 'finding-b', code: 'beta', severity: 'medium' }),
      ]),
    );

    const request = buildRevisionRequestFromReport({
      reviewId: 'review-001',
      priorArtifact: createPriorArtifact(),
      report,
      reviewer: REVIEWER,
      sourceSnapshotId: 'snapshot-001',
      selectedFindingIds: Object.freeze(['finding-b']),
      createdAt: FIXED_CREATED_AT,
    });

    expect(request.moduleBundles.flatMap((bundle) => bundle.items)).toHaveLength(1);
    expect(request.moduleBundles[0]?.items[0]?.findingId).toBe('finding-b');
    expect(request.priority).toBe('should-fix');
  });

  it('includes all high-severity findings when no explicit selection is provided', () => {
    const report = createReport(
      Object.freeze([
        createFinding({ id: 'finding-high', code: 'high-issue', severity: 'high' }),
        createFinding({ id: 'finding-low', code: 'low-issue', severity: 'low' }),
      ]),
    );

    const request = buildRevisionRequestFromReport({
      reviewId: 'review-001',
      priorArtifact: createPriorArtifact(),
      report,
      reviewer: REVIEWER,
      sourceSnapshotId: 'snapshot-001',
      createdAt: FIXED_CREATED_AT,
    });

    const findingIds = request.moduleBundles.flatMap((bundle) =>
      bundle.items.map((item) => item.findingId),
    );
    expect(findingIds).toContain('finding-high');
    expect(request.priority).toBe('must-fix');
  });

  it('rejects empty revision requests', () => {
    const report = createReport(
      Object.freeze([createFinding({ id: 'finding-a', code: 'alpha', severity: 'medium' })]),
    );

    expect(() =>
      buildRevisionRequestFromReport({
        reviewId: 'review-001',
        priorArtifact: createPriorArtifact(),
        report,
        reviewer: REVIEWER,
        sourceSnapshotId: 'snapshot-001',
        selectedFindingIds: Object.freeze(['missing-id']),
        createdAt: FIXED_CREATED_AT,
      }),
    ).toThrow(RevisionValidationError);
  });

  it('deduplicates identical root issues', () => {
    const report = createReport(
      Object.freeze([
        createFinding({
          id: 'finding-1',
          code: 'duplicate-code',
          severity: 'medium',
          location: Object.freeze({ sectionId: 'overview' }),
        }),
        createFinding({
          id: 'finding-2',
          code: 'duplicate-code',
          severity: 'medium',
          location: Object.freeze({ sectionId: 'overview' }),
        }),
      ]),
    );

    const request = buildRevisionRequestFromReport({
      reviewId: 'review-001',
      priorArtifact: createPriorArtifact(),
      report,
      reviewer: REVIEWER,
      sourceSnapshotId: 'snapshot-001',
      createdAt: FIXED_CREATED_AT,
    });

    expect(request.moduleBundles.flatMap((bundle) => bundle.items)).toHaveLength(1);
  });
});

describe('createRevisionGenerationJob', () => {
  it('preserves the frozen snapshot and does not rerun orchestrator metadata', () => {
    const priorArtifact = createPriorArtifact();
    const report = createReport(
      Object.freeze([createFinding({ id: 'finding-a', code: 'alpha', severity: 'medium' })]),
    );
    const revisionRequest = buildRevisionRequestFromReport({
      reviewId: 'review-001',
      priorArtifact,
      report,
      reviewer: REVIEWER,
      sourceSnapshotId: priorArtifact.snapshotId,
      createdAt: FIXED_CREATED_AT,
    });

    const plan = Object.freeze({
      requestId: priorArtifact.requestId,
      sourceReference: Object.freeze({
        sourceId: priorArtifact.sourceId,
        sourceType: 'commerce-repo',
      }),
      snapshot: Object.freeze({
        snapshotId: priorArtifact.snapshotId,
        sourceId: priorArtifact.sourceId,
        sourceType: 'commerce-repo',
        sourcePath: 'commerce',
        createdAt: FIXED_CREATED_AT,
        entityCounts: Object.freeze({ product: 1 }),
        warnings: Object.freeze([]),
      }),
      root: Object.freeze({ type: 'product', id: 'product-001' }),
      contextRecipeId: 'product-review',
      contextSummary: Object.freeze({
        recipeId: 'product-review',
        projection: 'default',
        entityCountByType: Object.freeze({ product: 1 }),
        missingRequired: Object.freeze([]),
        truncated: false,
      }),
      warnings: Object.freeze([]),
      contentType: priorArtifact.contentType,
      locale: priorArtifact.locale,
      tone: priorArtifact.tone,
      outputFormat: 'markdown',
      status: 'ready' as const,
      metadata: Object.freeze({
        requestId: priorArtifact.requestId,
        entityCount: 1,
        promptSectionCount: 2,
        constraintCount: 1,
        estimatedInputCharacters: 100,
      }),
      promptPayload: Object.freeze({
        contentType: 'product-review',
        systemInstructions: Object.freeze([
          Object.freeze({ id: 'base', priority: 1, instruction: 'Write neutrally.' }),
        ]),
        userSections: Object.freeze([
          Object.freeze({ id: 'context', title: 'Context', order: 1, content: 'Context body' }),
        ]),
        constraints: Object.freeze([]),
        outputContract: Object.freeze({
          format: 'markdown',
          locale: 'en',
          tone: 'educational',
          sections: Object.freeze(['overview']),
          allowedCtaTypes: Object.freeze([]),
          prohibitedCtaTypes: Object.freeze(['buy-now']),
        }),
        metadata: Object.freeze({
          estimatedInputCharacters: 100,
          estimatedSectionCount: 1,
          entityCount: 1,
          truncationWarning: false,
          contentType: 'product-review',
          contextRecipeId: 'product-review',
          locale: 'en',
          tone: 'educational',
          outputFormat: 'markdown',
          rootEntityType: 'product',
          rootEntityId: 'product-001',
          snapshotId: priorArtifact.snapshotId,
        }),
        warnings: Object.freeze([]),
      }),
      createdAt: FIXED_CREATED_AT,
    }) satisfies ContentGenerationPlan;

    const job = createRevisionGenerationJob({
      plan,
      priorArtifact,
      revisionRequest,
    });

    expect(job.snapshotId).toBe(priorArtifact.snapshotId);
    expect(job.policySnapshot).toBe(priorArtifact.policySnapshot);
    expect(job.promptPayload.userSections.some((section) => section.id === 'prior-draft')).toBe(
      true,
    );
    expect(
      job.promptPayload.constraints.some(
        (constraint) => constraint.id === 'revision-do-not-invent-sources',
      ),
    ).toBe(true);
    expect(
      job.promptPayload.userSections.find((section) => section.id === 'prior-draft')?.content,
    ).toBe(priorArtifact.content);
  });
});

describe('compareRevisionReports', () => {
  it('classifies resolved, persisting, and new findings', () => {
    const priorReport = createReport(
      Object.freeze([
        createFinding({ id: 'resolved-1', code: 'alpha', severity: 'high' }),
        createFinding({ id: 'persist-1', code: 'beta', severity: 'medium' }),
      ]),
    );
    const nextReport = createReport(
      Object.freeze([
        createFinding({ id: 'persist-1', code: 'beta', severity: 'medium' }),
        createFinding({ id: 'new-1', code: 'gamma', severity: 'low' }),
      ]),
    );

    const comparison = compareRevisionReports({ priorReport, nextReport });
    expect(comparison.resolvedCount).toBe(1);
    expect(comparison.persistingCount).toBe(1);
    expect(comparison.newCount).toBe(1);
    expect(comparison.blockingRemainingCount).toBe(0);
    expect(comparison.resolvedFindingIds).toContain('resolved-1');
    expect(comparison.newFindingIds).toContain('new-1');
  });
});
