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

import {
  createPiercingConnectPilotConfig,
  DEFAULT_PILOT_OUTPUT_DIR,
  PILOT_REQUIRED_SECTIONS,
  resolveMonorepoRoot,
} from '../config.js';
import {
  assertSpacesPreserved,
  detectFormattingCorruption,
  normalizePreservingMarkdownWhitespace,
} from '../formatting.js';
import {
  assertSafeOutputPayload,
  findUnsafeOutputLocation,
  scrubSensitiveText,
  writePilotOutputs,
} from '../outputs.js';
import {
  analyzePilotDraftQuality,
  detectMissingCitationPlaceholders,
  detectUnsupportedClaims,
} from '../quality.js';
import { runPiercingConnectPilotDraft } from '../run-pilot-draft.js';
import { extractMarkdownHeadings, findMissingRequiredSections } from '../section-markers.js';

const tempDirs: string[] = [];
const FIXED_CREATED_AT = '2026-07-11T12:00:00.000Z';
const PRODUCT_ID = 'neilmed-piercing-aftercare-fine-mist';

const QUALITY_DRAFT = `# NeilMed Piercing Aftercare Fine Mist Review

## Title
NeilMed Piercing Aftercare Fine Mist — educational product overview

## Editorial Summary
This draft summarizes publicly described product details for educational comparison.
One product that has gained attention is discussed cautiously below.
This review aims to provide wound care context without certainty.
It is not medical advice. Individual results may vary; consult a qualified professional.

## Product Overview
The NeilMed Piercing Aftercare Fine Mist is positioned by the manufacturer as a sterile saline spray for piercing aftercare.
Manufacturer claims should be treated as manufacturer claims, not independent clinical evidence.

## Verified Formula
Typical saline aftercare sprays center on sterile water and sodium chloride when those ingredients appear in the product record.
Exact formulation details should be confirmed on the product label.

## Evidence and Guideline Alignment
Any alignment with aftercare guidance should be treated as provisional until human review confirms supporting materials.
Do not invent guideline citations.

## Potential Advantages
Potential practical advantages may include convenient mist application when used as labeled.
These are practical considerations, not guaranteed outcomes.

## Limitations and Uncertainties
Evidence quality may be limited to manufacturer materials and general aftercare guidance.
This review does not claim guaranteed healing outcomes.

## Who May Consider It
It may suit readers seeking a saline mist option for routine aftercare, subject to professional advice and piercing-specific guidance.

## Who Should Seek Professional Guidance
Readers with unusual symptoms, delayed healing, or uncertainty about aftercare should consult a qualified professional.

## Alternatives
Alternatives include other sterile saline sprays, clinician-recommended wound washes, and non-aerosol saline options.

## FAQ
### Can this diagnose an infection?
No. This article cannot diagnose conditions.

### Is this a commission-first recommendation?
No. Availability checks must remain educational and non-urgent.

## Affiliate Disclosure Placeholder
[Affiliate disclosure placeholder: update before publication if any commercial relationship exists.]

## Source Notes
[Source: product official record]
[Source: ingredient evidence record]
[Source: APP-aligned aftercare guidance]
`;

const CORRUPT_DRAFT = QUALITY_DRAFT.replace(
  'This draft summarizes',
  'This draft summarizes productthat reviewaims Itis woundcare AftercareFine concerns.',
);

const UNSUPPORTED_CLAIM_DRAFT = `${QUALITY_DRAFT}

Extra note: It is suitable for all types of piercings and should be used 1-2 times daily.
It is suitable for sensitive skin and reduces the risk of introducing bacteria with guaranteed healing.
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
    const inner = new FakeGenerationProvider({
      generatedContent: `${QUALITY_DRAFT}\n\nInspected ${this.roots.commerceRepoPath} and https://neilmed.com/products\n`,
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

  it('generates a pending-review draft without WordPress or network', async () => {
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
      generationProvider: new FakeGenerationProvider({ generatedContent: QUALITY_DRAFT }),
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
    expect(result.missingSections).toEqual([]);
    expect(result.findings?.some((finding) => finding.code === 'missing-section-markers')).toBe(
      false,
    );

    const reviewMarkdown = await readFile(join(outputDir, 'generated-review.md'), 'utf8');
    expect(reviewMarkdown).toContain('product that');
    expect(reviewMarkdown).toContain('[Source: product official record]');
    expect(JSON.parse(await readFile(join(outputDir, 'review-summary.json'), 'utf8')).status).toBe(
      'pending-review',
    );
  });

  it('redacts absolute paths and still reaches pending-review outputs', async () => {
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
    expect(result.reviewStatus).toBe('pending-review');
    expect(result.wordpressInvoked).toBe(false);

    const combined = [
      await readFile(join(outputDir, 'generated-review.md'), 'utf8'),
      await readFile(join(outputDir, 'artifact-metadata.json'), 'utf8'),
      await readFile(join(outputDir, 'review-summary.json'), 'utf8'),
    ].join('\n');

    expect(combined).not.toContain(repoPath);
    expect(combined).not.toContain('/home/');
    expect(combined).toContain('<commerce-root>');
  });

  it('records quality findings for unsupported claims while remaining pending-review', async () => {
    const repoPath = await createFixtureRepo();
    const outputDir = await mkdtemp(join(tmpdir(), 'pcme-pilot-claims-'));
    tempDirs.push(outputDir);

    const result = await runPiercingConnectPilotDraft({
      repoPath,
      outputDir,
      mediaEngineRoot: resolveMonorepoRoot(),
      fixedCreatedAt: FIXED_CREATED_AT,
      env: { OPENROUTER_API_KEY: 'test-key' },
      generationProvider: new FakeGenerationProvider({
        generatedContent: UNSUPPORTED_CLAIM_DRAFT,
      }),
    });

    expect(result.status).toBe('succeeded-pending-review');
    expect(result.reviewStatus).toBe('pending-review');
    expect(result.findings?.some((finding) => finding.code === 'unsupported-claim')).toBe(true);
    expect(
      result.reviewSummary?.findings.some((finding) => finding.code === 'unsupported-claim'),
    ).toBe(true);
    expect(result.wordpressInvoked).toBe(false);
  });

  it('keeps pilot outputs under a gitignored exports path', async () => {
    const gitignore = await readFile(join(resolveMonorepoRoot(), '.gitignore'), 'utf8');
    expect(gitignore).toContain('exports/');
    expect(DEFAULT_PILOT_OUTPUT_DIR.startsWith('exports/')).toBe(true);
  });
});

describe('section marker detection', () => {
  it('recognizes H1 title and Source Notes headings without false missing markers', () => {
    const markdown = `# NeilMed Piercing Aftercare Fine Mist Review

## Editorial Summary
Summary text with ordinary spaces.

## Product Overview
Overview

## Verified Formula
Formula

## Evidence and Guideline Alignment
Evidence

## Potential Advantages
Advantages

## Limitations and Uncertainties
Limits

## Who May Consider It
Audience

## Who Should Seek Professional Guidance
Guidance

## Alternatives
Alternatives

## FAQ
Questions

## Affiliate Disclosure Placeholder
Disclosure

## Source Notes
[Source: product official record]
`;

    const headings = extractMarkdownHeadings(markdown);
    expect(headings.some((heading) => heading.level === 1)).toBe(true);
    expect(headings.some((heading) => heading.normalizedText === 'source notes')).toBe(true);

    const missing = findMissingRequiredSections(markdown, PILOT_REQUIRED_SECTIONS);
    expect(missing).not.toContain('title');
    expect(missing).not.toContain('source-notes');
    expect(missing).toEqual([]);
  });
});

describe('pilot quality analysis', () => {
  it('requires structured source-note placeholders', () => {
    const findings = detectMissingCitationPlaceholders(
      '## Source Notes\nPlease refer to the provided context.',
    );
    expect(findings.some((finding) => finding.code === 'missing-citation-placeholders')).toBe(true);
  });

  it('warns on unsupported frequency and suitability claims', () => {
    const findings = detectUnsupportedClaims(
      'Use 1-2 times daily. Suitable for all types of piercings. It is suitable for sensitive skin.',
    );
    expect(findings.map((finding) => finding.detail)).toEqual(
      expect.arrayContaining([
        'fixed-usage-frequency',
        'universal-suitability',
        'sensitive-skin-suitability',
      ]),
    );
  });

  it('flags formatting corruption without altering pending-review posture in analysis', () => {
    expect(detectFormattingCorruption(CORRUPT_DRAFT).length).toBeGreaterThan(0);
    const findings = analyzePilotDraftQuality(CORRUPT_DRAFT, createPiercingConnectPilotConfig());
    expect(findings.some((finding) => finding.code === 'formatting-corruption')).toBe(true);
  });
});

describe('pilot output path sanitization and whitespace', () => {
  it('preserves ordinary spaces through scrubbing and normalization', () => {
    const mediaEngineRoot = '/home/murat/Projects/pc-media-engine';
    const input =
      'One product that has gained attention. This review aims to provide wound care guidance. It is cautious.';
    const normalized = normalizePreservingMarkdownWhitespace(input);
    const scrubbed = scrubSensitiveText(normalized, mediaEngineRoot, {
      additionalRoots: ['/home/murat/Projects/piercingconnect-commerce'],
    });

    expect(scrubbed).toContain('product that');
    expect(scrubbed).toContain('review aims');
    expect(scrubbed).toContain('It is');
    expect(scrubbed).toContain('wound care');
    expect(assertSpacesPreserved(input, scrubbed)).toBe(true);
    expect(scrubbed).not.toMatch(/productthat|reviewaims|Itis|woundcare/);
  });

  it('still rejects unsanitized absolute paths at the hard gate and reports field path only', () => {
    const payload = { message: 'Loaded from /home/murat/Projects/piercingconnect-commerce' };
    const location = findUnsafeOutputLocation(payload, '/home/murat/Projects/pc-media-engine');

    expect(location).toEqual({ path: '$.message', kind: 'absolute-path' });
    expect(() => assertSafeOutputPayload(payload, '/home/murat/Projects/pc-media-engine')).toThrow(
      /field: \$\.message/,
    );
  });

  it('writes scrubbed markdown when draft text contains absolute paths', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'pcme-pilot-scrub-write-'));
    tempDirs.push(outputDir);
    const mediaEngineRoot = resolveMonorepoRoot();
    const commerceRoot = '/home/murat/Projects/piercingconnect-commerce';

    await writePilotOutputs({
      outputDir,
      markdown: `${QUALITY_DRAFT}\n\nInspected ${commerceRoot}\n`,
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
        findings: Object.freeze([]),
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
    expect(markdown).toContain('product that');
  });
});
