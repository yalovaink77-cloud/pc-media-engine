import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ContentGenerationPlan } from '@pcme/content';
import type { EditorialIntelligenceProfile, EditorialModuleId } from '@pcme/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  createEditorialLoopService,
  createGeneratedContentArtifact,
  createGenerationJob,
  FakeGenerationProvider,
  InMemoryContentReviewStore,
  InMemoryGeneratedContentArtifactStore,
  serializeEditorialIntelligenceReport,
} from '../../index.js';

const NEILMED_FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../pilot-piercingconnect/src/__fixtures__/neilmed-generated-review.md',
);

const FIXED_CREATED_AT = '2026-07-12T12:00:00.000Z';
const REVIEWER = Object.freeze({ reviewerId: 'reviewer-001', displayName: 'Reviewer' });

function createIntelligenceProfile(): EditorialIntelligenceProfile {
  return Object.freeze({
    profileId: 'editorial-loop-test',
    contentType: 'product-review',
    locale: 'en',
    enabledModules: Object.freeze([
      'editorial',
      'evidence',
      'seo',
      'ai-seo',
      'commercial',
    ] as const satisfies readonly EditorialModuleId[]),
    editorialAnalyzer: Object.freeze({
      promotionalTonePatterns: Object.freeze([
        Object.freeze({
          id: 'beneficial',
          pattern: String.raw`\bbeneficial\b`,
          flags: 'i',
        }),
      ]),
    }),
    commercialAnalyzer: Object.freeze({
      disclosure: Object.freeze({
        sectionAliases: Object.freeze(['affiliate disclosure placeholder']),
        placeholderPatterns: Object.freeze([String.raw`\[Affiliate Disclosure Placeholder\]`]),
      }),
    }),
  });
}

function createFrozenPlan(snapshotId: string): ContentGenerationPlan {
  return Object.freeze({
    requestId: 'request-loop',
    sourceReference: Object.freeze({ sourceId: 'source-loop', sourceType: 'commerce-repo' }),
    snapshot: Object.freeze({
      snapshotId,
      sourceId: 'source-loop',
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
    contentType: 'product-review',
    locale: 'en',
    tone: 'educational',
    outputFormat: 'markdown',
    status: 'ready',
    metadata: Object.freeze({
      requestId: 'request-loop',
      entityCount: 1,
      promptSectionCount: 1,
      constraintCount: 0,
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
        snapshotId,
      }),
      warnings: Object.freeze([]),
    }),
    createdAt: FIXED_CREATED_AT,
  });
}

describe('createEditorialLoopService', () => {
  it('runs the structured revision loop without mutating the prior artifact', async () => {
    const draftV1 = await readFile(NEILMED_FIXTURE_PATH, 'utf8');
    const before = draftV1;
    const plan = createFrozenPlan('snapshot-loop');
    const job = createGenerationJob(plan);
    const { artifact: artifactV1 } = createGeneratedContentArtifact(
      job,
      {
        providerId: 'fake',
        status: 'succeeded',
        content: draftV1,
      },
      { createdAt: FIXED_CREATED_AT },
    );

    const artifactStore = new InMemoryGeneratedContentArtifactStore();
    const reviewStore = new InMemoryContentReviewStore();
    const loop = createEditorialLoopService({ artifactStore, reviewStore });

    const initial = loop.prepareInitialReview({
      artifact: artifactV1,
      profile: createIntelligenceProfile(),
      analyzedAt: FIXED_CREATED_AT,
      createdAt: FIXED_CREATED_AT,
    });
    expect(initial.report.findings.length).toBeGreaterThan(0);

    const requested = loop.requestRevision({
      reviewId: initial.review.reviewId,
      priorArtifact: artifactV1,
      report: initial.report,
      reviewer: REVIEWER,
      sourceSnapshotId: artifactV1.snapshotId,
      humanNotes: 'Address disclosure and neutrality issues.',
      createdAt: FIXED_CREATED_AT,
    });
    expect(requested.reviewResult.review.status).toBe('changes-requested');

    const draftV2 = `${draftV1}\n\n## Affiliate Disclosure\nWe may earn a commission from qualifying purchases.`;
    const provider = new FakeGenerationProvider({ generatedContent: draftV2 });
    const revised = await loop.runRevision({
      plan,
      priorArtifact: artifactV1,
      revisionRequest: requested.revisionRequest,
      provider,
    });

    expect(revised.artifact.revisionNumber).toBe(2);
    expect(revised.artifact.rootArtifactId).toBe(artifactV1.artifactId);
    expect(revised.artifact.parentArtifactId).toBe(artifactV1.artifactId);
    expect(artifactStore.getById(artifactV1.artifactId)?.content).toBe(draftV1);

    const reanalyzed = loop.reanalyzeRevision({
      artifact: revised.artifact,
      profile: createIntelligenceProfile(),
      priorReport: initial.report,
      analyzedAt: '2026-07-12T13:00:00.000Z',
    });
    expect(
      reanalyzed.comparison.resolvedCount + reanalyzed.comparison.persistingCount,
    ).toBeGreaterThan(0);

    const reopened = loop.reopenReviewAfterRevision({
      reviewId: initial.review.reviewId,
      activeArtifact: revised.artifact,
      report: reanalyzed.report,
      timestamp: '2026-07-12T13:00:00.000Z',
    });
    expect(reopened.review.status).toBe('pending-review');
    expect(reopened.review.activeArtifactId).toBe(revised.artifact.artifactId);
    expect(reopened.review.artifactId).toBe(revised.artifact.artifactId);
    expect(reopened.review.jobId).toBe(revised.artifact.jobId);
    expect(reopened.review.revisionCount).toBe(1);
    expect(reopened.history.some((event) => event.type === 'revision-completed')).toBe(true);
    expect(draftV1).toBe(before);
  });

  it('enforces revision count limits and blocks approval when high findings remain', async () => {
    const content = '# Product\n\nThis is beneficial and recommended for everyone.';
    const plan = createFrozenPlan('snapshot-limit');
    const job = createGenerationJob(plan);
    const { artifact } = createGeneratedContentArtifact(job, {
      providerId: 'fake',
      status: 'succeeded',
      content,
    });
    const loop = createEditorialLoopService({ maxRevisionCount: 2 });
    const initial = loop.prepareInitialReview({
      artifact,
      profile: createIntelligenceProfile(),
    });
    const requested = loop.requestRevision({
      reviewId: initial.review.reviewId,
      priorArtifact: artifact,
      report: initial.report,
      reviewer: REVIEWER,
      sourceSnapshotId: artifact.snapshotId,
    });
    const firstRevision = await loop.runRevision({
      plan,
      priorArtifact: artifact,
      revisionRequest: requested.revisionRequest,
      provider: new FakeGenerationProvider({ generatedContent: content }),
    });

    await expect(
      loop.runRevision({
        plan,
        priorArtifact: firstRevision.artifact,
        revisionRequest: requested.revisionRequest,
        provider: new FakeGenerationProvider({ generatedContent: content }),
      }),
    ).rejects.toThrow(/revision count limit/i);
  });

  it('blocks approval when high-severity findings remain and never auto-approves', () => {
    const content = '# Product\n\nThis is beneficial.';
    const plan = createFrozenPlan('snapshot-approval');
    const job = createGenerationJob(plan);
    const { artifact } = createGeneratedContentArtifact(job, {
      providerId: 'fake',
      status: 'succeeded',
      content,
    });
    const loop = createEditorialLoopService();
    const initial = loop.prepareInitialReview({
      artifact,
      profile: createIntelligenceProfile(),
    });

    expect(initial.review.status).toBe('pending-review');
    expect(() =>
      loop.submitHumanDecision({
        reviewId: initial.review.reviewId,
        decision: 'approve',
        reviewer: REVIEWER,
        editorialFindings: initial.report.findings,
      }),
    ).toThrow(/High-severity unresolved findings block approval/);
  });

  it('does not perform network or WordPress operations', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked'));
    const plan = createFrozenPlan('snapshot-network');
    const job = createGenerationJob(plan);
    const { artifact } = createGeneratedContentArtifact(job, {
      providerId: 'fake',
      status: 'succeeded',
      content: '# Product\n\nBody.',
    });
    const loop = createEditorialLoopService();
    loop.prepareInitialReview({ artifact, profile: createIntelligenceProfile() });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('keeps approved reviews terminal', () => {
    const plan = createFrozenPlan('snapshot-terminal');
    const job = createGenerationJob(plan);
    const { artifact } = createGeneratedContentArtifact(job, {
      providerId: 'fake',
      status: 'succeeded',
      content: '# Product Review\n\nNeutral educational body without promotional claims.',
    });
    const loop = createEditorialLoopService();
    const initial = loop.prepareInitialReview({
      artifact,
      profile: Object.freeze({
        ...createIntelligenceProfile(),
        editorialAnalyzer: Object.freeze({}),
        commercialAnalyzer: Object.freeze({}),
      }),
    });

    loop.submitHumanDecision({
      reviewId: initial.review.reviewId,
      decision: 'approve',
      reviewer: REVIEWER,
      findings: Object.freeze([]),
    });

    expect(() =>
      loop.submitHumanDecision({
        reviewId: initial.review.reviewId,
        decision: 'request-changes',
        reviewer: REVIEWER,
      }),
    ).toThrow(/terminal state/i);
  });

  it('serializes editorial intelligence reports for revision comparison output', async () => {
    const draftV1 = await readFile(NEILMED_FIXTURE_PATH, 'utf8');
    const plan = createFrozenPlan('snapshot-serialize');
    const job = createGenerationJob(plan);
    const { artifact } = createGeneratedContentArtifact(job, {
      providerId: 'fake',
      status: 'succeeded',
      content: draftV1,
    });
    const loop = createEditorialLoopService();
    const initial = loop.prepareInitialReview({
      artifact,
      profile: createIntelligenceProfile(),
      analyzedAt: FIXED_CREATED_AT,
    });
    const serialized = serializeEditorialIntelligenceReport(initial.report);
    expect(serialized).toContain('"reportId"');
    expect(serialized.endsWith('\n')).toBe(true);
  });
});
