import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type ContentGenerationPlan, createCommerceContentOrchestrator } from '@pcme/content';
import { afterEach, describe, expect, it } from 'vitest';

import type { GeneratedContentArtifact } from '../../artifact/types.js';
import {
  buildDeterministicReviewId,
  ContentReviewDecisionError,
  ContentReviewExpiredError,
  ContentReviewMissingReviewerError,
  ContentReviewTerminalStateError,
  createContentReviewRequest,
  createContentReviewService,
  createGeneratedContentArtifact,
  createGenerationJob,
  InMemoryContentReviewStore,
} from '../../index.js';
import type { GenerationJobRequest, GenerationProviderResponse } from '../../types.js';

const tempDirs: string[] = [];
const FIXED_CREATED_AT = '2026-07-10T12:00:00.000Z';
const REVIEWER = Object.freeze({ reviewerId: 'reviewer-001', displayName: 'Test Reviewer' });

function withTier0Collections(collections: Record<string, string[]>): Record<string, string[]> {
  return {
    brands: [],
    products: [],
    ...collections,
  };
}

async function createFixtureRepo(collections: Record<string, string[]>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcme-content-review-'));
  tempDirs.push(root);

  for (const [collectionDir, yamlFiles] of Object.entries(withTier0Collections(collections))) {
    const dir = join(root, 'data', collectionDir);
    await mkdir(dir, { recursive: true });
    for (const [index, yaml] of yamlFiles.entries()) {
      await writeFile(join(dir, `record-${index}.yaml`), yaml, 'utf8');
    }
  }

  return realpath(root);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const productFixture = withTier0Collections({
  brands: ['id: neilmed\nslug: neilmed\nname: NeilMed\nproducts:\n  - neilmed-product\n'],
  products: [
    [
      'id: neilmed-product',
      'slug: neilmed-product',
      'name: NeilMed Product',
      'brand: neilmed',
      'category: sterile-saline-spray',
      'ingredients:',
      '  - sterile-water',
      'healing_stages:',
      '  - fresh-piercing',
      'review:',
      '  status: draft',
      '  last_reviewed: 2020-01-01',
    ].join('\n'),
  ],
  ingredients: ['id: sterile-water\nslug: sterile-water\nname: Sterile Water\n'],
  'healing-stages': ['id: fresh-piercing\nslug: fresh-piercing\nname: Fresh Piercing\n'],
  'product-categories': [
    'id: sterile-saline-spray\nslug: sterile-saline-spray\nname: Sterile Saline Spray\n',
  ],
});

async function prepareProductReviewPlan(repoPath: string): Promise<ContentGenerationPlan> {
  const orchestrator = await createCommerceContentOrchestrator({ commerce: { repoPath } });

  return orchestrator.prepare({
    root: { type: 'product', id: 'neilmed-product' },
    contextRecipe: 'product-review',
    contentType: 'product-review',
    locale: 'en',
    tone: 'educational',
    outputFormat: 'markdown',
  });
}

async function createValidArtifact(): Promise<{
  artifact: GeneratedContentArtifact;
  job: GenerationJobRequest;
}> {
  const repoPath = await createFixtureRepo(productFixture);
  const job = createGenerationJob(await prepareProductReviewPlan(repoPath));
  const content = '# Review\n\nConsult a professional if unsure about aftercare choices.';
  const { artifact } = createGeneratedContentArtifact(job, successResponse(job, content));

  return { artifact, job };
}

function successResponse(
  job: GenerationJobRequest,
  content: string,
  overrides: Partial<GenerationProviderResponse> = {},
): GenerationProviderResponse {
  return Object.freeze({
    providerId: 'fake',
    status: 'succeeded',
    jobId: job.jobId,
    requestId: job.requestId,
    model: 'fake-model',
    finishReason: 'stop',
    content,
    usage: Object.freeze({
      inputCharacters: 100,
      outputCharacters: content.length,
      inputTokens: 50,
      outputTokens: 20,
    }),
    warnings: Object.freeze([]),
    ...overrides,
  });
}

function createReviewOptions(createdAt = FIXED_CREATED_AT) {
  return {
    createdAt,
    expiresAt: new Date(Date.parse(createdAt) + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

describe('createContentReviewRequest', () => {
  it('creates a review request from a valid artifact', async () => {
    const { artifact } = await createValidArtifact();
    const review = createContentReviewRequest(artifact, createReviewOptions());

    expect(review.status).toBe('pending-review');
    expect(review.artifactId).toBe(artifact.artifactId);
    expect(review.jobId).toBe(artifact.jobId);
    expect(review.contentType).toBe('product-review');
    expect(review.locale).toBe('en');
    expect(review.artifactStatus).toBe(artifact.status);
    expect(review.requiredChecks).toEqual([
      'safety',
      'factual-grounding',
      'affiliate-compliance',
      'citation-readiness',
      'formatting',
      'publication-readiness',
    ]);
    expect(review.warnings.length).toBeGreaterThan(0);
    expect(review.policySnapshot).toEqual(artifact.policySnapshot);
  });

  it('creates deterministic review IDs in tests', async () => {
    const { artifact } = await createValidArtifact();
    const options = createReviewOptions();

    const first = createContentReviewRequest(artifact, options);
    const second = createContentReviewRequest(artifact, options);

    expect(first.reviewId).toBe(second.reviewId);
    expect(first.reviewId).toBe(
      buildDeterministicReviewId({
        artifactId: artifact.artifactId,
        createdAt: FIXED_CREATED_AT,
      }),
    );
  });

  it('does not mutate the original artifact', async () => {
    const { artifact } = await createValidArtifact();
    const snapshot = JSON.stringify(artifact);

    createContentReviewRequest(artifact, createReviewOptions());

    expect(() => {
      (artifact as { content: string }).content = 'mutated';
    }).toThrow();
    expect(JSON.stringify(artifact)).toBe(snapshot);
  });
});

describe('InMemoryContentReviewStore', () => {
  it('approves a valid artifact', async () => {
    const { artifact } = await createValidArtifact();
    const store = new InMemoryContentReviewStore();
    const reviewService = createContentReviewService(store);
    const review = createContentReviewRequest(artifact, createReviewOptions());
    const created = store.create(review);

    expect(created.review.status).toBe('pending-review');

    const result = reviewService.submitDecision({
      reviewId: review.reviewId,
      decision: 'approve',
      reviewer: REVIEWER,
    });

    expect(result.review.status).toBe('approved');
    expect(result.latestDecision).toBe('approve');
    expect(result.reviewer?.reviewerId).toBe('reviewer-001');
  });

  it('rejects an artifact', async () => {
    const { artifact } = await createValidArtifact();
    const store = new InMemoryContentReviewStore();
    const review = createContentReviewRequest(artifact, createReviewOptions());
    store.create(review);

    const result = store.submitDecision({
      reviewId: review.reviewId,
      decision: 'reject',
      reviewer: REVIEWER,
      notes: 'Not suitable for publication',
    });

    expect(result.review.status).toBe('rejected');
    expect(result.history.at(-1)?.notes).toBe('Not suitable for publication');
  });

  it('requests changes', async () => {
    const { artifact } = await createValidArtifact();
    const store = new InMemoryContentReviewStore();
    const review = createContentReviewRequest(artifact, createReviewOptions());
    store.create(review);

    const result = store.submitDecision({
      reviewId: review.reviewId,
      decision: 'request-changes',
      reviewer: REVIEWER,
      findings: Object.freeze([
        Object.freeze({
          id: 'finding-1',
          checkId: 'formatting',
          code: 'heading-structure',
          message: 'Improve heading hierarchy',
          severity: 'medium',
        }),
      ]),
    });

    expect(result.review.status).toBe('changes-requested');
    expect(result.findings).toHaveLength(1);
  });

  it('blocks approval when high-severity findings remain unresolved', async () => {
    const { artifact } = await createValidArtifact();
    const store = new InMemoryContentReviewStore();
    const review = createContentReviewRequest(artifact, createReviewOptions());
    store.create(review);

    expect(() =>
      store.submitDecision({
        reviewId: review.reviewId,
        decision: 'approve',
        reviewer: REVIEWER,
        findings: Object.freeze([
          Object.freeze({
            id: 'finding-high',
            checkId: 'safety',
            code: 'unsafe-claim',
            message: 'Unsafe claim detected',
            severity: 'high',
          }),
        ]),
      }),
    ).toThrow(ContentReviewDecisionError);
  });

  it('blocks approval when reviewer identity is missing', async () => {
    const { artifact } = await createValidArtifact();
    const store = new InMemoryContentReviewStore();
    const review = createContentReviewRequest(artifact, createReviewOptions());
    store.create(review);

    expect(() =>
      store.submitDecision({
        reviewId: review.reviewId,
        decision: 'approve',
        reviewer: Object.freeze({ reviewerId: '   ' }),
      }),
    ).toThrow(ContentReviewMissingReviewerError);
  });

  it('rejects decisions on expired reviews', async () => {
    const { artifact } = await createValidArtifact();
    const store = new InMemoryContentReviewStore();
    const review = createContentReviewRequest(artifact, {
      createdAt: '2020-01-01T00:00:00.000Z',
      expiresAt: '2020-01-02T00:00:00.000Z',
    });
    store.create(review);

    expect(() =>
      store.submitDecision(
        {
          reviewId: review.reviewId,
          decision: 'approve',
          reviewer: REVIEWER,
        },
        Date.parse('2021-01-01T00:00:00.000Z'),
      ),
    ).toThrow(ContentReviewExpiredError);
  });

  it('protects terminal states from further decisions', async () => {
    const { artifact } = await createValidArtifact();
    const store = new InMemoryContentReviewStore();
    const review = createContentReviewRequest(artifact, createReviewOptions());
    store.create(review);
    store.submitDecision({
      reviewId: review.reviewId,
      decision: 'approve',
      reviewer: REVIEWER,
    });

    expect(() =>
      store.submitDecision({
        reviewId: review.reviewId,
        decision: 'request-changes',
        reviewer: REVIEWER,
      }),
    ).toThrow(ContentReviewTerminalStateError);
  });

  it('reopens a review after revision', async () => {
    const { artifact } = await createValidArtifact();
    const store = new InMemoryContentReviewStore();
    const review = createContentReviewRequest(artifact, createReviewOptions());
    store.create(review);
    store.submitDecision({
      reviewId: review.reviewId,
      decision: 'request-changes',
      reviewer: REVIEWER,
    });

    const reopened = store.reopenAfterRevision(review.reviewId, '2026-07-10T13:00:00.000Z');

    expect(reopened.review.status).toBe('pending-review');
    expect(reopened.history.at(-1)?.type).toBe('reopened');
  });

  it('keeps review history append-only', async () => {
    const { artifact } = await createValidArtifact();
    const store = new InMemoryContentReviewStore();
    const review = createContentReviewRequest(artifact, createReviewOptions());
    const created = store.create(review);
    const initialHistory = JSON.stringify(created.history);

    store.submitDecision({
      reviewId: review.reviewId,
      decision: 'request-changes',
      reviewer: REVIEWER,
    });
    store.reopenAfterRevision(review.reviewId);
    store.submitDecision({
      reviewId: review.reviewId,
      decision: 'approve-with-notes',
      reviewer: REVIEWER,
      findings: Object.freeze([
        Object.freeze({
          id: 'finding-low',
          checkId: 'formatting',
          code: 'minor-formatting',
          message: 'Minor formatting note',
          severity: 'low',
        }),
      ]),
    });

    const finalResult = store.getById(review.reviewId);
    expect(finalResult?.history.length).toBe(4);
    expect(JSON.stringify(finalResult?.history[0])).toBe(
      JSON.stringify(JSON.parse(initialHistory)[0]),
    );
  });

  it('blocks approval for invalid artifacts', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const job = createGenerationJob(await prepareProductReviewPlan(repoPath));
    const { artifact } = createGeneratedContentArtifact(job, successResponse(job, '   '));
    const store = new InMemoryContentReviewStore();
    const review = createContentReviewRequest(artifact, createReviewOptions());
    store.create(review);

    expect(() =>
      store.submitDecision({
        reviewId: review.reviewId,
        decision: 'approve',
        reviewer: REVIEWER,
      }),
    ).toThrow(ContentReviewDecisionError);
  });

  it('lists reviews by artifact ID', async () => {
    const { artifact } = await createValidArtifact();
    const store = new InMemoryContentReviewStore();
    const review = createContentReviewRequest(artifact, createReviewOptions());
    store.create(review);

    expect(store.listByArtifactId(artifact.artifactId)).toHaveLength(1);
  });
});
