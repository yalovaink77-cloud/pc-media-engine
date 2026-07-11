import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type ContentGenerationPlan, createCommerceContentOrchestrator } from '@pcme/content';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildDeterministicJobId,
  createGenerationJob,
  FakeGenerationProvider,
  GenerationJobBlockedError,
  GenerationUnsupportedOutputFormatError,
  runGenerationJob,
} from '../index.js';

const tempDirs: string[] = [];

function withTier0Collections(collections: Record<string, string[]>): Record<string, string[]> {
  return {
    brands: [],
    products: [],
    ...collections,
  };
}

async function createFixtureRepo(collections: Record<string, string[]>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcme-generation-job-'));
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
      '  - sodium-chloride',
      'healing_stages:',
      '  - fresh-piercing',
      'review:',
      '  status: draft',
      '  last_reviewed: 2020-01-01',
    ].join('\n'),
  ],
  ingredients: [
    'id: sterile-water\nslug: sterile-water\nname: Sterile Water\n',
    'id: sodium-chloride\nslug: sodium-chloride\nname: Sodium Chloride\n',
  ],
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

describe('createGenerationJob', () => {
  it('creates a prepared job from a ready plan', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const plan = await prepareProductReviewPlan(repoPath);

    expect(plan.status).toMatch(/^ready/);

    const job = createGenerationJob(plan);

    expect(job.status).toBe('prepared');
    expect(job.requestId).toBe(plan.requestId);
    expect(job.sourceId).toBe(plan.sourceReference.sourceId);
    expect(job.snapshotId).toBe(plan.snapshot.snapshotId);
    expect(job.promptPayload).toBe(plan.promptPayload);
    expect(job.metadata.providerNeutralPayloadSize).toBeGreaterThan(0);
  });

  it('creates a prepared job from a ready-with-warnings plan', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const plan = await prepareProductReviewPlan(repoPath);

    expect(plan.status).toBe('ready-with-warnings');

    const job = createGenerationJob(plan);

    expect(job.status).toBe('prepared');
    expect(job.policySnapshot.warningCount).toBeGreaterThan(0);
    expect(job.policySnapshot.safetyConstraints.length).toBeGreaterThan(0);
  });

  it('rejects blocked plans', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const orchestrator = await createCommerceContentOrchestrator({ commerce: { repoPath } });

    const plan = await orchestrator.prepare({
      root: { type: 'product', id: 'neilmed-product' },
      contextRecipe: 'product-comparison',
      contentType: 'product-review',
    });

    expect(plan.status).toBe('blocked');

    expect(() => createGenerationJob(plan)).toThrow(GenerationJobBlockedError);
  });

  it('preserves request and snapshot metadata', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const plan = await prepareProductReviewPlan(repoPath);
    const job = createGenerationJob(plan);

    expect(job.requestId).toBe(plan.requestId);
    expect(job.snapshotId).toBe(plan.snapshot.snapshotId);
    expect(job.sourceId).toBe(plan.snapshot.sourceId);
    expect(job.metadata.entityCount).toBe(plan.metadata.entityCount);
    expect(job.metadata.promptSectionCount).toBe(plan.metadata.promptSectionCount);
  });

  it('builds a correct policy snapshot', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const plan = await prepareProductReviewPlan(repoPath);
    const job = createGenerationJob(plan);

    expect(job.policySnapshot.safetyConstraints).toContain('no-diagnosis');
    expect(job.policySnapshot.affiliateConstraints).toContain('affiliate-policy');
    expect(job.policySnapshot.citationRequirements).toContain('citation-placeholders');
    expect(job.policySnapshot.blockedFields).toContain('template_path');
    expect(job.policySnapshot.contextComplete).toBe(true);
  });

  it('runs successfully through the fake provider', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const plan = await prepareProductReviewPlan(repoPath);
    const job = createGenerationJob(plan);
    const provider = new FakeGenerationProvider();

    const result = await runGenerationJob(job, provider);

    expect(result.status).toBe('succeeded');
    expect(result.providerId).toBe('fake');
    expect(result.response?.content).toBe('[fake-generated-content]');
  });

  it('surfaces fake provider failure', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const plan = await prepareProductReviewPlan(repoPath);
    const job = createGenerationJob(plan);
    const provider = new FakeGenerationProvider({ shouldFail: true });

    const result = await runGenerationJob(job, provider);

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('fake-provider-failure');
  });

  it('does not leak blocked metadata into the job payload', async () => {
    const repoPath = await createFixtureRepo({
      ...productFixture,
      products: [
        [
          'id: neilmed-product',
          'slug: neilmed-product',
          'name: NeilMed Product',
          'brand: neilmed',
          'category: sterile-saline-spray',
          'ingredients:',
          '  - sterile-water',
          'template_path: /secret/templates/product-review.md',
        ].join('\n'),
      ],
    });

    const plan = await prepareProductReviewPlan(repoPath);
    const job = createGenerationJob(plan);
    const serialized = JSON.stringify(job.promptPayload);

    expect(serialized).not.toContain('template_path');
    expect(serialized).not.toContain('/secret/templates');
    expect(serialized).not.toContain('sourcePath');
  });

  it('creates deterministic jobs for identical plans', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const plan = await prepareProductReviewPlan(repoPath);

    const first = createGenerationJob(plan);
    const second = createGenerationJob(plan);

    expect(first.jobId).toBe(second.jobId);
    expect(first.jobId).toBe(
      buildDeterministicJobId({
        requestId: plan.requestId,
        sourceId: plan.sourceReference.sourceId,
        contentType: plan.contentType,
      }),
    );
  });

  it('rejects unsupported output formats', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const orchestrator = await createCommerceContentOrchestrator({ commerce: { repoPath } });

    const plan = await orchestrator.prepare({
      root: { type: 'product', id: 'neilmed-product' },
      contextRecipe: 'product-review',
      contentType: 'product-review',
      outputFormat: 'pdf',
    });

    expect(() => createGenerationJob(plan)).toThrow(GenerationUnsupportedOutputFormatError);
  });

  it('creates jobs via commerce orchestrator convenience factory', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const orchestrator = await createCommerceContentOrchestrator({ commerce: { repoPath } });
    const plan = await orchestrator.prepare({
      root: { type: 'product', id: 'neilmed-product' },
      contextRecipe: 'product-review',
      contentType: 'product-review',
    });

    const job = createGenerationJob(plan);
    expect(job.contentType).toBe('product-review');
    expect(job.status).toBe('prepared');
  });
});
