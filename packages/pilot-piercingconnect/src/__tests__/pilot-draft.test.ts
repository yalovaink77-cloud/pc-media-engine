import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FakeGenerationProvider } from '@pcme/ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PILOT_OUTPUT_DIR, resolveMonorepoRoot } from '../config.js';
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

  it('keeps pilot outputs under a gitignored exports path', async () => {
    const gitignore = await readFile(join(resolveMonorepoRoot(), '.gitignore'), 'utf8');
    expect(gitignore).toContain('exports/');
    expect(DEFAULT_PILOT_OUTPUT_DIR.startsWith('exports/')).toBe(true);
  });
});
