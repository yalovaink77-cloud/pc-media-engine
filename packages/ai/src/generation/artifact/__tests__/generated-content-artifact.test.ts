import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type ContentGenerationPlan, createCommerceContentOrchestrator } from '@pcme/content';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildDeterministicArtifactId,
  createGeneratedContentArtifact,
  createGenerationJob,
  FakeGenerationProvider,
  GeneratedContentArtifactImmutableError,
  GeneratedContentArtifactNotFoundError,
  GeneratedContentArtifactTransitionError,
  InMemoryGeneratedContentArtifactStore,
  runGenerationJob,
} from '../../index.js';
import type { GenerationJobRequest, GenerationProviderResponse } from '../../types.js';

const tempDirs: string[] = [];

function withTier0Collections(collections: Record<string, string[]>): Record<string, string[]> {
  return {
    brands: [],
    products: [],
    ...collections,
  };
}

async function createFixtureRepo(collections: Record<string, string[]>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcme-generation-artifact-'));
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

describe('createGeneratedContentArtifact', () => {
  it('creates a successful artifact from a provider response', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const plan = await prepareProductReviewPlan(repoPath);
    const job = createGenerationJob(plan);
    const content = '# Review\n\nBalanced product overview with consult a professional guidance.';

    const result = createGeneratedContentArtifact(
      job,
      successResponse(job, content, {
        warnings: Object.freeze(['Provider noted incomplete context']),
      }),
    );

    expect(result.validation.valid).toBe(true);
    expect(result.artifact.status).toBe('generated-with-warnings');
    expect(result.artifact.jobId).toBe(job.jobId);
    expect(result.artifact.requestId).toBe(job.requestId);
    expect(result.artifact.sourceId).toBe(job.sourceId);
    expect(result.artifact.snapshotId).toBe(job.snapshotId);
    expect(result.artifact.providerId).toBe('fake');
    expect(result.artifact.model).toBe('fake-model');
    expect(result.artifact.contentType).toBe('product-review');
    expect(result.artifact.format).toBe('markdown');
    expect(result.artifact.content).toBe(content);
    expect(result.artifact.finishReason).toBe('stop');
    expect(result.artifact.policySnapshot).toEqual(job.policySnapshot);
    expect(result.artifact.warnings.length).toBeGreaterThan(0);
  });

  it('rejects empty output', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const job = createGenerationJob(await prepareProductReviewPlan(repoPath));

    const result = createGeneratedContentArtifact(job, successResponse(job, '   '));

    expect(result.validation.valid).toBe(false);
    expect(result.artifact.status).toBe('invalid');
    expect(result.validation.errors.some((error) => error.code === 'empty-content')).toBe(true);
  });

  it('rejects provider failure responses', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const job = createGenerationJob(await prepareProductReviewPlan(repoPath));

    const result = createGeneratedContentArtifact(
      job,
      Object.freeze({
        providerId: 'fake',
        status: 'failed',
        error: Object.freeze({
          code: 'fake-provider-failure',
          message: 'Simulated provider failure',
        }),
      }),
    );

    expect(result.validation.valid).toBe(false);
    expect(result.artifact.status).toBe('invalid');
    expect(result.validation.errors.some((error) => error.code === 'provider-failure')).toBe(true);
  });

  it('detects blocked metadata in generated content', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const job = createGenerationJob(await prepareProductReviewPlan(repoPath));
    const content = 'Review content referencing template_path in output.';

    const result = createGeneratedContentArtifact(job, successResponse(job, content));

    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.some((error) => error.code === 'blocked-metadata')).toBe(true);
  });

  it('detects secrets in generated content', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const job = createGenerationJob(await prepareProductReviewPlan(repoPath));
    const content = 'Do not leak sk-test-secret-key-value in output.';

    const result = createGeneratedContentArtifact(job, successResponse(job, content));

    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.some((error) => error.code === 'secret-detected')).toBe(true);
  });

  it('detects absolute paths in generated content', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const job = createGenerationJob(await prepareProductReviewPlan(repoPath));
    const content = 'Found file at /home/user/secret/output.md';

    const result = createGeneratedContentArtifact(job, successResponse(job, content));

    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.some((error) => error.code === 'absolute-path-detected')).toBe(
      true,
    );
  });

  it('rejects unsafe HTML and script content', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const job = createGenerationJob(await prepareProductReviewPlan(repoPath));
    const content = '<script>alert("x")</script>Unsafe output';

    const result = createGeneratedContentArtifact(job, successResponse(job, content));

    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.some((error) => error.code === 'unsafe-html')).toBe(true);
  });

  it('propagates policy warnings into artifact warnings', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const job = createGenerationJob(await prepareProductReviewPlan(repoPath));
    const content = '# Review\n\nSimple overview without uncertainty language.';

    const result = createGeneratedContentArtifact(job, successResponse(job, content));

    expect(
      result.artifact.warnings.some((warning) => warning.code === 'missing-uncertainty-language'),
    ).toBe(true);
  });

  it('preserves usage metadata', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const job = createGenerationJob(await prepareProductReviewPlan(repoPath));
    const content = '# Review\n\nConsult a professional if unsure about aftercare choices.';

    const result = createGeneratedContentArtifact(job, successResponse(job, content));

    expect(result.artifact.usage?.inputTokens).toBe(50);
    expect(result.artifact.usage?.outputTokens).toBe(20);
    expect(result.artifact.usage?.outputCharacters).toBe(content.length);
  });

  it('creates deterministic artifact IDs in tests', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const job = createGenerationJob(await prepareProductReviewPlan(repoPath));
    const content = '# Review\n\nConsult a professional if unsure about aftercare choices.';
    const response = successResponse(job, content);

    const first = createGeneratedContentArtifact(job, response);
    const second = createGeneratedContentArtifact(job, response);

    expect(first.artifact.artifactId).toBe(second.artifact.artifactId);
    expect(first.artifact.artifactId).toBe(
      buildDeterministicArtifactId({
        jobId: job.jobId,
        requestId: job.requestId,
        providerId: 'fake',
      }),
    );
  });

  it('does not mutate artifacts after creation', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const job = createGenerationJob(await prepareProductReviewPlan(repoPath));
    const content = '# Review\n\nConsult a professional if unsure about aftercare choices.';
    const result = createGeneratedContentArtifact(job, successResponse(job, content));
    const snapshot = JSON.stringify(result.artifact);

    expect(() => {
      (result.artifact as { content: string }).content = 'mutated';
    }).toThrow();

    expect(JSON.stringify(result.artifact)).toBe(snapshot);
  });
});

describe('InMemoryGeneratedContentArtifactStore', () => {
  it('supports save, lookup, approval, and rejection transitions', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const job = createGenerationJob(await prepareProductReviewPlan(repoPath));
    const provider = new FakeGenerationProvider({
      generatedContent: '# Review\n\nConsult a professional if unsure about aftercare choices.',
    });
    const generation = await runGenerationJob(job, provider);
    const { artifact } = createGeneratedContentArtifact(job, generation.response!);
    const store = new InMemoryGeneratedContentArtifactStore();

    store.save(artifact);

    expect(store.getById(artifact.artifactId)?.status).toBe(artifact.status);
    expect(store.listByJobId(job.jobId)).toHaveLength(1);

    const approved = store.approve(artifact.artifactId);
    expect(approved.status).toBe('approved');

    expect(() => store.save(artifact)).toThrow(GeneratedContentArtifactImmutableError);
    expect(() => store.approve(artifact.artifactId)).toThrow(
      GeneratedContentArtifactTransitionError,
    );
    expect(store.getById('missing-id')).toBeUndefined();
    expect(() => store.reject('missing-id')).toThrow(GeneratedContentArtifactNotFoundError);
  });

  it('rejects invalid artifacts but cannot approve them', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const job = createGenerationJob(await prepareProductReviewPlan(repoPath));
    const { artifact } = createGeneratedContentArtifact(job, successResponse(job, '   '));
    const store = new InMemoryGeneratedContentArtifactStore();

    store.save(artifact);
    const rejected = store.reject(artifact.artifactId);

    expect(rejected.status).toBe('rejected');
    expect(() => store.approve(artifact.artifactId)).toThrow(
      GeneratedContentArtifactTransitionError,
    );
  });
});
