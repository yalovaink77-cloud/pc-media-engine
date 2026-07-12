import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  type ContentReviewResult,
  createContentReviewRequest,
  createGeneratedContentArtifact,
  createGenerationJob,
  type GeneratedContentArtifact,
  type GenerationJobRequest,
  type GenerationProviderResponse,
} from '@pcme/ai';
import { type ContentGenerationPlan, createCommerceContentOrchestrator } from '@pcme/content';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildDeterministicHandoffId,
  createPublishingHandoff,
  FakePublishingTargetAdapter,
} from '../index.js';
import type { PublishingHandoffRequest, PublishingMetadata, PublishingTarget } from '../types.js';

const tempDirs: string[] = [];
const FIXED_CREATED_AT = '2026-07-10T12:00:00.000Z';
const REVIEWER = Object.freeze({ reviewerId: 'reviewer-001', displayName: 'Test Reviewer' });

const FAKE_TARGET: PublishingTarget = Object.freeze({
  targetId: 'fake',
  platform: 'fake-platform',
  supportedFormats: Object.freeze(['markdown', 'plain-text']),
});

const BASE_METADATA: PublishingMetadata = Object.freeze({
  title: 'NeilMed Product Review',
  slug: 'neilmed-product-review',
  excerpt: 'Balanced aftercare product review.',
  tags: Object.freeze(['aftercare', 'saline']),
  categories: Object.freeze(['product-reviews']),
  author: 'editorial-team',
  publishStatus: 'draft',
});

function withTier0Collections(collections: Record<string, string[]>): Record<string, string[]> {
  return {
    brands: [],
    products: [],
    ...collections,
  };
}

async function createFixtureRepo(collections: Record<string, string[]>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcme-publishing-handoff-'));
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

function successResponse(job: GenerationJobRequest, content: string): GenerationProviderResponse {
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
  });
}

async function createApprovedPair(
  reviewStatus: 'approved' | 'approved-with-notes' = 'approved',
): Promise<{
  artifact: GeneratedContentArtifact;
  review: ContentReviewResult;
}> {
  const repoPath = await createFixtureRepo(productFixture);
  const job = createGenerationJob(await prepareProductReviewPlan(repoPath));
  const content = '# Review\n\nConsult a professional if unsure about aftercare choices.';
  const { artifact } = createGeneratedContentArtifact(job, successResponse(job, content));

  const reviewRequest = createContentReviewRequest(artifact, {
    createdAt: FIXED_CREATED_AT,
    expiresAt: new Date(Date.parse(FIXED_CREATED_AT) + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const review: ContentReviewResult = Object.freeze({
    review: Object.freeze({
      ...reviewRequest,
      status: reviewStatus,
    }),
    history: Object.freeze([]),
    latestDecision: reviewStatus === 'approved' ? 'approve' : 'approve-with-notes',
    reviewer: REVIEWER,
    findings: Object.freeze(
      reviewStatus === 'approved-with-notes'
        ? [
            Object.freeze({
              id: 'finding-1',
              checkId: 'formatting' as const,
              code: 'minor-formatting',
              message: 'Minor formatting note',
              severity: 'low' as const,
            }),
          ]
        : [],
    ),
  });

  return { artifact, review };
}

function buildRequest(
  artifact: GeneratedContentArtifact,
  review: ContentReviewResult,
  metadata: PublishingMetadata = BASE_METADATA,
): PublishingHandoffRequest {
  return Object.freeze({ artifact, review, target: FAKE_TARGET, metadata });
}

describe('createPublishingHandoff', () => {
  it('creates a ready handoff from an approved artifact', async () => {
    const { artifact, review } = await createApprovedPair('approved');
    const result = createPublishingHandoff(buildRequest(artifact, review), {
      createdAt: FIXED_CREATED_AT,
    });

    expect(result.validation.valid).toBe(true);
    expect(result.package.status).toBe('ready');
    expect(result.package.artifactId).toBe(artifact.artifactId);
    expect(result.package.reviewId).toBe(review.review.reviewId);
    expect(result.package.jobId).toBe(artifact.jobId);
    expect(result.package.contentType).toBe('product-review');
    expect(result.package.target.targetId).toBe('fake');
    expect(result.package.reviewSummary.status).toBe('approved');
  });

  it('creates a ready handoff from an approved-with-notes review', async () => {
    const { artifact, review } = await createApprovedPair('approved-with-notes');
    const result = createPublishingHandoff(buildRequest(artifact, review));

    expect(result.validation.valid).toBe(true);
    expect(result.package.status).toBe('ready');
    expect(result.package.warnings.length).toBeGreaterThan(0);
    expect(result.package.reviewSummary.decision).toBe('approve-with-notes');
  });

  it('blocks handoff for pending review', async () => {
    const { artifact, review } = await createApprovedPair('approved');
    const pendingReview: ContentReviewResult = Object.freeze({
      ...review,
      review: Object.freeze({ ...review.review, status: 'pending-review' }),
    });

    const result = createPublishingHandoff(buildRequest(artifact, pendingReview));

    expect(result.validation.valid).toBe(false);
    expect(result.package.status).toBe('blocked');
    expect(result.validation.errors.some((error) => error.code === 'review-not-approved')).toBe(
      true,
    );
  });

  it('blocks handoff for rejected review', async () => {
    const { artifact, review } = await createApprovedPair('approved');
    const rejectedReview: ContentReviewResult = Object.freeze({
      ...review,
      review: Object.freeze({ ...review.review, status: 'rejected' }),
    });

    const result = createPublishingHandoff(buildRequest(artifact, rejectedReview));

    expect(result.validation.valid).toBe(false);
    expect(result.package.status).toBe('blocked');
  });

  it('blocks handoff when artifact and review IDs mismatch', async () => {
    const { artifact, review } = await createApprovedPair('approved');
    const mismatchedReview: ContentReviewResult = Object.freeze({
      ...review,
      review: Object.freeze({
        ...review.review,
        artifactId: 'other-artifact',
        activeArtifactId: 'other-artifact',
      }),
    });

    const result = createPublishingHandoff(buildRequest(artifact, mismatchedReview));

    expect(result.validation.valid).toBe(false);
    expect(
      result.validation.errors.some((error) => error.code === 'artifact-review-mismatch'),
    ).toBe(true);
  });

  it('accepts handoff when activeArtifactId matches the revision artifact', async () => {
    const { artifact, review } = await createApprovedPair('approved');
    const revisionArtifact: GeneratedContentArtifact = Object.freeze({
      ...artifact,
      artifactId: 'artifact-revision-v2',
      jobId: 'job-revision-v2',
      parentArtifactId: artifact.artifactId,
      revisionNumber: 2,
    });
    const revisionReview: ContentReviewResult = Object.freeze({
      ...review,
      review: Object.freeze({
        ...review.review,
        artifactId: artifact.artifactId,
        activeArtifactId: revisionArtifact.artifactId,
        jobId: revisionArtifact.jobId,
        revisionCount: 1,
      }),
    });

    const result = createPublishingHandoff(buildRequest(revisionArtifact, revisionReview));

    expect(result.validation.valid).toBe(true);
    expect(result.package.artifactId).toBe(revisionArtifact.artifactId);
  });

  it('blocks handoff when title or slug is missing', async () => {
    const { artifact, review } = await createApprovedPair('approved');

    const missingTitle = createPublishingHandoff(
      buildRequest(artifact, review, Object.freeze({ ...BASE_METADATA, title: '   ' })),
    );
    const missingSlug = createPublishingHandoff(
      buildRequest(artifact, review, Object.freeze({ ...BASE_METADATA, slug: '   ' })),
    );

    expect(missingTitle.validation.valid).toBe(false);
    expect(missingTitle.validation.errors.some((error) => error.code === 'missing-title')).toBe(
      true,
    );
    expect(missingSlug.validation.valid).toBe(false);
    expect(missingSlug.validation.errors.some((error) => error.code === 'missing-slug')).toBe(true);
  });

  it('blocks handoff for unsupported format', async () => {
    const { artifact, review } = await createApprovedPair('approved');
    const pdfTarget: PublishingTarget = Object.freeze({
      targetId: 'pdf-only',
      platform: 'pdf',
      supportedFormats: Object.freeze(['pdf']),
    });

    const result = createPublishingHandoff(
      Object.freeze({
        artifact,
        review,
        target: pdfTarget,
        metadata: BASE_METADATA,
      }),
    );

    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.some((error) => error.code === 'unsupported-format')).toBe(
      true,
    );
  });

  it('does not leak blocked metadata into handoff package', async () => {
    const { artifact, review } = await createApprovedPair('approved');
    const poisonedMetadata = Object.freeze({
      ...BASE_METADATA,
      excerpt: 'template_path: /secret/templates/product-review.md',
    });

    const result = createPublishingHandoff(buildRequest(artifact, review, poisonedMetadata));
    const serialized = JSON.stringify(result.package);

    expect(result.validation.valid).toBe(false);
    expect(serialized).not.toContain('/secret/templates');
    expect(
      result.validation.errors.some((error) => error.code === 'blocked-metadata-detected'),
    ).toBe(true);
  });

  it('creates deterministic handoff IDs in tests', async () => {
    const { artifact, review } = await createApprovedPair('approved');
    const request = buildRequest(artifact, review);
    const options = { createdAt: FIXED_CREATED_AT };

    const first = createPublishingHandoff(request, options);
    const second = createPublishingHandoff(request, options);

    expect(first.package.handoffId).toBe(second.package.handoffId);
    expect(first.package.handoffId).toBe(
      buildDeterministicHandoffId({
        artifactId: artifact.artifactId,
        reviewId: review.review.reviewId,
        targetId: FAKE_TARGET.targetId,
      }),
    );
  });

  it('does not mutate artifact or review inputs', async () => {
    const { artifact, review } = await createApprovedPair('approved');
    const artifactSnapshot = JSON.stringify(artifact);
    const reviewSnapshot = JSON.stringify(review);

    createPublishingHandoff(buildRequest(artifact, review));

    expect(JSON.stringify(artifact)).toBe(artifactSnapshot);
    expect(JSON.stringify(review)).toBe(reviewSnapshot);
  });
});

describe('FakePublishingTargetAdapter', () => {
  it('publishes a ready handoff successfully', async () => {
    const { artifact, review } = await createApprovedPair('approved');
    const { package: pkg } = createPublishingHandoff(buildRequest(artifact, review));
    const adapter = new FakePublishingTargetAdapter();

    const result = await adapter.publish(pkg);

    expect(result.success).toBe(true);
    expect(result.targetId).toBe('fake');
    expect(result.externalId).toBeDefined();
    expect(result.url).toContain(pkg.publishingMetadata.slug);
  });

  it('returns failure when configured to fail', async () => {
    const { artifact, review } = await createApprovedPair('approved');
    const { package: pkg } = createPublishingHandoff(buildRequest(artifact, review));
    const adapter = new FakePublishingTargetAdapter({ shouldFail: true });

    const result = await adapter.publish(pkg);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('fake-publish-failure');
  });

  it('rejects blocked handoff packages', async () => {
    const { artifact, review } = await createApprovedPair('approved');
    const rejectedReview: ContentReviewResult = Object.freeze({
      ...review,
      review: Object.freeze({ ...review.review, status: 'rejected' }),
    });
    const { package: pkg } = createPublishingHandoff(buildRequest(artifact, rejectedReview));
    const adapter = new FakePublishingTargetAdapter();

    const validation = adapter.validate(pkg);
    const result = await adapter.publish(pkg);

    expect(validation.valid).toBe(false);
    expect(result.success).toBe(false);
  });
});
