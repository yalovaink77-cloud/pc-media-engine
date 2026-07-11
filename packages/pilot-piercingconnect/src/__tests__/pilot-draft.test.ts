import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  FakeGenerationProvider,
  type GenerationProviderAdapter,
  type GenerationProviderRequest,
} from '@pcme/ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PILOT_OUTPUT_DIR, resolveMonorepoRoot } from '../config.js';
import {
  assertSafeOutputPayload,
  findUnsafeOutputLocation,
  scrubSensitiveText,
  writePilotOutputs,
} from '../outputs.js';
import { runPiercingConnectPilotDraft } from '../run-pilot-draft.js';

const tempDirs: string[] = [];
const FIXED_CREATED_AT = '2026-07-11T12:00:00.000Z';
const PRODUCT_ID = 'neilmed-piercing-aftercare-fine-mist';

const SAMPLE_DRAFT = `# NeilMed Piercing Aftercare Fine Mist Review

## Title
NeilMed Piercing Aftercare Fine Mist — educational product overview

## Introduction
This draft summarizes publicly described product details for educational comparison.
It is not medical advice.

## Product overview
The NeilMed Piercing Aftercare Fine Mist is positioned as a sterile saline spray for piercing aftercare.
Manufacturer claims should be treated as manufacturer claims, not independent clinical evidence.

## Ingredients
Typical saline aftercare sprays center on sterile water and sodium chloride.
Exact formulation details should be confirmed on the product label.

## Safety and suitability
No diagnosis is provided here. Readers with unusual symptoms should consult a qualified professional.
Suitability depends on individual piercing stage, jewelry material, and clinician guidance.

## Benefits
Potential practical benefits include convenient mist application and saline-based cleansing when used as labeled.

## Limitations
Evidence quality may be limited to manufacturer materials and general aftercare guidance.
This review does not claim guaranteed healing outcomes.

## Who it may suit
It may suit readers seeking a saline mist option for routine aftercare, subject to professional advice.

## Alternatives
Alternatives include other sterile saline sprays, clinician-recommended wound washes, and non-aerosol saline options.

## FAQ
### Can this diagnose an infection?
No. This article cannot diagnose conditions.

### Is this a commission-first recommendation?
No. Availability checks must remain educational and non-urgent.

## Disclosure
[Affiliate disclosure placeholder: update before publication if any commercial relationship exists.]

## Source-note
[Source note placeholder: manufacturer product information]
[Source note placeholder: aftercare guidance references pending editorial review]
`;

class AbsolutePathWarningProvider implements GenerationProviderAdapter {
  readonly providerId = 'fake-path-warning';
  readonly capabilities = Object.freeze({
    supportedOutputFormats: Object.freeze(['markdown', 'plain-text']),
  });

  constructor(
    private readonly roots: {
      commerceRepoPath: string;
      mediaEngineRoot: string;
    },
  ) {}

  async generate(request: GenerationProviderRequest) {
    // Paths arrive via provider warning strings and draft text (OpenRouter-like leakage).
    const inner = new FakeGenerationProvider({
      generatedContent: `${SAMPLE_DRAFT}\n\nInspected ${this.roots.commerceRepoPath} and https://neilmed.com/products\n`,
    });
    const response = await inner.generate(request);
    return Object.freeze({
      ...response,
      model: `${this.roots.mediaEngineRoot}/models/custom`,
      warnings: Object.freeze([
        `sourcePath=${this.roots.commerceRepoPath}`,
        `Also checked /Users/ci/runner/work/pcme/file.yaml and ${this.roots.mediaEngineRoot}/packages/content`,
      ]),
    });
  }
}

async function createFixtureRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcme-piercingconnect-pilot-'));
  tempDirs.push(root);

  const collections: Record<string, string[]> = {
    brands: [
      'id: neilmed\nslug: neilmed\nname: NeilMed\nproducts:\n  - neilmed-piercing-aftercare-fine-mist\n',
    ],
    products: [
      [
        `id: ${PRODUCT_ID}`,
        `slug: ${PRODUCT_ID}`,
        'name: NeilMed Piercing Aftercare Fine Mist',
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
  };

  for (const [dir, files] of Object.entries(collections)) {
    const target = join(root, 'data', dir);
    await mkdir(target, { recursive: true });
    for (const [index, yaml] of files.entries()) {
      const fileName = dir === 'products' ? `${PRODUCT_ID}.yaml` : `record-${index}.yaml`;
      await writeFile(join(target, fileName), yaml, 'utf8');
    }
  }

  return realpath(root);
}

async function fingerprint(repoPath: string): Promise<string> {
  const productFile = join(repoPath, 'data', 'products', `${PRODUCT_ID}.yaml`);
  const [fileStat, contents] = await Promise.all([
    stat(productFile),
    readFile(productFile, 'utf8'),
  ]);
  return createHash('sha256')
    .update(`${fileStat.size}:${fileStat.mtimeMs}:${contents}`)
    .digest('hex');
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('runPiercingConnectPilotDraft', () => {
  it('safely skips when OPENROUTER_API_KEY is missing', async () => {
    const result = await runPiercingConnectPilotDraft({
      env: {},
      mediaEngineRoot: resolveMonorepoRoot(),
    });

    expect(result.status).toBe('skipped');
    expect(result.skipReason).toMatch(/OPENROUTER_API_KEY/);
    expect(result.published).toBe(false);
    expect(result.wordpressInvoked).toBe(false);
  });

  it('generates a pending-review draft without WordPress or publishing', async () => {
    const repoPath = await createFixtureRepo();
    const outputDir = await mkdtemp(join(tmpdir(), 'pcme-pilot-out-'));
    tempDirs.push(outputDir);
    const fetchSpy = vi.fn().mockRejectedValue(new Error('network disabled'));

    const before = await fingerprint(repoPath);
    const result = await runPiercingConnectPilotDraft({
      repoPath,
      outputDir,
      mediaEngineRoot: resolveMonorepoRoot(),
      fixedCreatedAt: FIXED_CREATED_AT,
      env: { OPENROUTER_API_KEY: 'test-openrouter-key-should-not-leak' },
      generationProvider: new FakeGenerationProvider({ generatedContent: SAMPLE_DRAFT }),
      fetchFn: fetchSpy as unknown as typeof fetch,
    });
    const after = await fingerprint(repoPath);

    expect(result.status).toBe('succeeded-pending-review');
    expect(result.reviewStatus).toBe('pending-review');
    expect(result.reviewSummary?.status).toBe('pending-review');
    expect(result.reviewSummary?.approved).toBe(false);
    expect(result.reviewSummary?.decision).toBeNull();
    expect(result.published).toBe(false);
    expect(result.wordpressInvoked).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(before).toBe(after);

    const reviewMarkdown = await readFile(join(outputDir, 'generated-review.md'), 'utf8');
    const artifactMetadata = await readFile(join(outputDir, 'artifact-metadata.json'), 'utf8');
    const reviewSummary = await readFile(join(outputDir, 'review-summary.json'), 'utf8');
    const combined = `${reviewMarkdown}\n${artifactMetadata}\n${reviewSummary}`;

    expect(combined).not.toContain('test-openrouter-key-should-not-leak');
    expect(combined).not.toContain('/home/');
    expect(combined).not.toContain('OPENROUTER_API_KEY');
    expect(combined).not.toContain('Bearer ');
    expect(combined.toLowerCase()).toContain('disclosure');
    expect(combined.toLowerCase()).toContain('source-note');
    expect(JSON.parse(reviewSummary).status).toBe('pending-review');
  });

  it('redacts absolute commerce/source paths and still reaches pending-review outputs', async () => {
    const repoPath = await createFixtureRepo();
    const outputDir = await mkdtemp(join(tmpdir(), 'pcme-pilot-path-out-'));
    tempDirs.push(outputDir);
    const mediaEngineRoot = resolveMonorepoRoot();

    const result = await runPiercingConnectPilotDraft({
      repoPath,
      outputDir,
      mediaEngineRoot,
      fixedCreatedAt: FIXED_CREATED_AT,
      env: { OPENROUTER_API_KEY: 'test-openrouter-key-should-not-leak' },
      generationProvider: new AbsolutePathWarningProvider({
        commerceRepoPath: repoPath,
        mediaEngineRoot,
      }),
    });

    expect(result.status).toBe('succeeded-pending-review');
    expect(result.jobId).toBeTruthy();
    expect(result.artifactId).toBeTruthy();
    expect(result.reviewId).toBeTruthy();
    expect(result.reviewStatus).toBe('pending-review');
    expect(result.wordpressInvoked).toBe(false);

    const reviewMarkdown = await readFile(join(outputDir, 'generated-review.md'), 'utf8');
    const artifactMetadata = await readFile(join(outputDir, 'artifact-metadata.json'), 'utf8');
    const reviewSummary = await readFile(join(outputDir, 'review-summary.json'), 'utf8');
    const combined = `${reviewMarkdown}\n${artifactMetadata}\n${reviewSummary}`;
    const parsedMetadata = JSON.parse(artifactMetadata);
    const parsedSummary = JSON.parse(reviewSummary);

    expect(combined).not.toContain(repoPath);
    expect(combined).not.toContain(mediaEngineRoot);
    expect(combined).not.toContain('/home/');
    expect(combined).not.toContain('/Users/');
    expect(combined).toContain('<commerce-root>');
    expect(parsedMetadata.warnings.every((warning: { message?: string }) => !warning.message)).toBe(
      true,
    );
    expect(parsedSummary.warnings.every((warning: { message?: string }) => !warning.message)).toBe(
      true,
    );
    expect(parsedSummary.status).toBe('pending-review');
    expect(parsedMetadata.model).toContain('<monorepo-root>');
  });

  it('keeps pilot outputs under a gitignored exports path', async () => {
    const gitignore = await readFile(join(resolveMonorepoRoot(), '.gitignore'), 'utf8');
    expect(gitignore).toContain('exports/');
    expect(DEFAULT_PILOT_OUTPUT_DIR.startsWith('exports/')).toBe(true);
  });
});

describe('pilot output path sanitization', () => {
  it('removes real-looking absolute paths from text', () => {
    const mediaEngineRoot = '/home/murat/Projects/pc-media-engine';
    const commerceRoot = '/home/murat/Projects/piercingconnect-commerce';
    const scrubbed = scrubSensitiveText(
      `sourcePath=${commerceRoot} monorepo=${mediaEngineRoot}/packages/content also /Users/ci/a.yaml and /tmp/cache/x`,
      mediaEngineRoot,
      { additionalRoots: [commerceRoot] },
    );

    expect(scrubbed).toContain('<commerce-root>');
    expect(scrubbed).toContain('<monorepo-root>');
    expect(scrubbed).toContain('[path]');
    expect(scrubbed).not.toContain('/home/');
    expect(scrubbed).not.toContain('/Users/');
    expect(scrubbed).not.toContain('/tmp/');
  });

  it('still rejects unsanitized absolute paths at the hard gate and reports field path only', () => {
    const payload = { message: 'Loaded from /home/murat/Projects/piercingconnect-commerce' };
    const location = findUnsafeOutputLocation(payload, '/home/murat/Projects/pc-media-engine');

    expect(location).toEqual({ path: '$.message', kind: 'absolute-path' });
    expect(() => assertSafeOutputPayload(payload, '/home/murat/Projects/pc-media-engine')).toThrow(
      /field: \$\.message/,
    );
    expect(() => assertSafeOutputPayload(payload, '/home/murat/Projects/pc-media-engine')).toThrow(
      /absolute paths/,
    );
  });

  it('writes scrubbed markdown when draft text contains absolute paths', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'pcme-pilot-scrub-write-'));
    tempDirs.push(outputDir);
    const mediaEngineRoot = resolveMonorepoRoot();
    const commerceRoot = '/home/murat/Projects/piercingconnect-commerce';

    const paths = await writePilotOutputs({
      outputDir,
      markdown: `${SAMPLE_DRAFT}\n\nInspected ${commerceRoot}\n`,
      artifactMetadata: Object.freeze({
        artifactId: 'artifact-1',
        jobId: 'job-1',
        requestId: 'request-1',
        sourceId: 'piercingconnect-commerce',
        snapshotId: 'snapshot-1',
        contentType: 'product-review',
        locale: 'en',
        format: 'markdown',
        status: 'generated-with-warnings',
        providerId: 'fake',
        warningCount: 0,
        warnings: Object.freeze([]),
        contentCharacterCount: 10,
        createdAt: FIXED_CREATED_AT,
        productId: PRODUCT_ID,
        reviewStatus: 'pending-review',
        published: false,
      }),
      reviewSummary: Object.freeze({
        reviewId: 'review-1',
        artifactId: 'artifact-1',
        jobId: 'job-1',
        status: 'pending-review',
        contentType: 'product-review',
        locale: 'en',
        requiredChecks: Object.freeze([]),
        warningCount: 0,
        warnings: Object.freeze([]),
        decision: null,
        approved: false,
        published: false,
        createdAt: FIXED_CREATED_AT,
        expiresAt: FIXED_CREATED_AT,
        note: 'pending',
      }),
      mediaEngineRoot,
      additionalRoots: [commerceRoot],
    });

    const markdown = await readFile(join(outputDir, 'generated-review.md'), 'utf8');
    expect(markdown).not.toContain('/home/');
    expect(markdown).toContain('<commerce-root>');
    expect(paths.generatedReviewPath).not.toContain('/home/');
  });
});
