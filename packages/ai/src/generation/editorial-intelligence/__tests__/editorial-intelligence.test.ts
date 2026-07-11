import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type ContentGenerationPlan, createCommerceContentOrchestrator } from '@pcme/content';
import type { EditorialIntelligenceProfile, EditorialModuleId } from '@pcme/shared';
import { afterEach, describe, expect, it } from 'vitest';

import type { GeneratedContentArtifact } from '../../artifact/types.js';
import {
  aggregateEditorialIntelligenceReport,
  buildDeterministicEditorialFindingId,
  buildDeterministicEditorialReportId,
  createContentReviewRequest,
  createDefaultEditorialModuleRegistry,
  createEditorialIntelligenceOrchestrator,
  createEmptyEditorialModule,
  createGeneratedContentArtifact,
  createGenerationJob,
  EditorialModuleRegistry,
  parseEditorialIntelligenceReport,
  serializeEditorialIntelligenceReport,
} from '../../index.js';
import type { GenerationJobRequest, GenerationProviderResponse } from '../../types.js';
import type { EditorialModule } from '../module.js';

const tempDirs: string[] = [];
const FIXED_ANALYZED_AT = '2026-07-11T12:00:00.000Z';
const FIXED_CREATED_AT = '2026-07-11T12:00:00.000Z';

const testProfile: EditorialIntelligenceProfile = Object.freeze({
  profileId: 'generic-product-review-v1',
  contentType: 'product-review',
  locale: 'en',
  enabledModules: Object.freeze([
    'editorial',
    'evidence',
    'seo',
    'ai-seo',
    'affiliate',
  ] as const satisfies readonly EditorialModuleId[]),
});

function withTier0Collections(collections: Record<string, string[]>): Record<string, string[]> {
  return {
    brands: [],
    products: [],
    ...collections,
  };
}

async function createFixtureRepo(collections: Record<string, string[]>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcme-editorial-intelligence-'));
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

async function createValidArtifact(): Promise<GeneratedContentArtifact> {
  const repoPath = await createFixtureRepo(productFixture);
  const job = createGenerationJob(await prepareProductReviewPlan(repoPath));
  const content = '# Review\n\nConsult a professional if unsure about aftercare choices.';
  const { artifact } = createGeneratedContentArtifact(job, successResponse(job, content));
  return artifact;
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
      outputTokens: 25,
      totalTokens: 75,
    }),
    warnings: Object.freeze([]),
    ...overrides,
  });
}

describe('buildDeterministicEditorialReportId', () => {
  it('returns a stable 32-character identifier', () => {
    const input = Object.freeze({
      artifactId: 'artifact-001',
      profileId: 'generic-product-review-v1',
      analyzedAt: FIXED_ANALYZED_AT,
    });

    expect(buildDeterministicEditorialReportId(input)).toBe(
      buildDeterministicEditorialReportId(input),
    );
    expect(buildDeterministicEditorialReportId(input)).toHaveLength(32);
  });
});

describe('buildDeterministicEditorialFindingId', () => {
  it('returns a stable 32-character identifier', () => {
    const input = Object.freeze({
      reportId: 'report-001',
      category: 'editorial' as const,
      analyzerId: 'readability',
      code: 'long-sentence',
      identityKey: 'section-1',
    });

    expect(buildDeterministicEditorialFindingId(input)).toBe(
      buildDeterministicEditorialFindingId(input),
    );
    expect(buildDeterministicEditorialFindingId(input)).toHaveLength(32);
  });
});

describe('EditorialModuleRegistry', () => {
  it('resolves only enabled modules from a profile', () => {
    const registry = createDefaultEditorialModuleRegistry();
    const modules = registry.resolveEnabled(Object.freeze(['editorial', 'evidence']));

    expect(modules).toHaveLength(2);
    expect(modules.map((module) => module.moduleId)).toEqual(['editorial', 'evidence']);
  });

  it('rejects duplicate module registration', () => {
    const registry = new EditorialModuleRegistry();
    registry.register(createEmptyEditorialModule('editorial'));

    expect(() => registry.register(createEmptyEditorialModule('editorial'))).toThrow(
      /already registered/i,
    );
  });
});

describe('aggregateEditorialIntelligenceReport', () => {
  it('marks empty findings as ready-for-human-review', () => {
    const report = aggregateEditorialIntelligenceReport({
      reportId: 'report-empty',
      artifactId: 'artifact-001',
      profileId: testProfile.profileId,
      contentType: testProfile.contentType,
      locale: testProfile.locale,
      analyzedAt: FIXED_ANALYZED_AT,
      enabledModules: testProfile.enabledModules,
      findings: Object.freeze([]),
    });

    expect(report.scores.totalFindings).toBe(0);
    expect(report.publicationReadiness.status).toBe('ready-for-human-review');
    expect(report.publicationReadiness.note).toMatch(/human approval required/i);
    expect(report.moduleSummaries).toHaveLength(5);
    expect(report.moduleSummaries.every((summary) => summary.findingCount === 0)).toBe(true);
  });
});

describe('serializeEditorialIntelligenceReport', () => {
  it('round-trips a frozen report through JSON', async () => {
    const artifact = await createValidArtifact();
    const orchestrator = createEditorialIntelligenceOrchestrator();
    const report = orchestrator.analyze({
      artifact,
      profile: testProfile,
      analyzedAt: FIXED_ANALYZED_AT,
    });

    const serialized = serializeEditorialIntelligenceReport(report);
    const parsed = parseEditorialIntelligenceReport(serialized);

    expect(parsed).toEqual(report);
    expect(serialized).toContain('"reportId"');
    expect(serialized.endsWith('\n')).toBe(true);
  });
});

describe('EditorialIntelligenceOrchestrator', () => {
  it('returns empty findings for all default stub modules', async () => {
    const artifact = await createValidArtifact();
    const orchestrator = createEditorialIntelligenceOrchestrator();
    const report = orchestrator.analyze({
      artifact,
      profile: testProfile,
      analyzedAt: FIXED_ANALYZED_AT,
    });

    expect(report.reportId).toBe(
      buildDeterministicEditorialReportId({
        artifactId: artifact.artifactId,
        profileId: testProfile.profileId,
        analyzedAt: FIXED_ANALYZED_AT,
      }),
    );
    expect(report.artifactId).toBe(artifact.artifactId);
    expect(report.findings).toEqual([]);
    expect(report.moduleSummaries).toHaveLength(testProfile.enabledModules.length);
    expect(report.publicationReadiness.blockingFindingCount).toBe(0);
  });

  it('assigns deterministic finding IDs when a module returns findings', async () => {
    const artifact = await createValidArtifact();
    const findingModule: EditorialModule = Object.freeze({
      moduleId: 'editorial',
      analyze: () =>
        Object.freeze([
          Object.freeze({
            id: 'identity-key-1',
            category: 'editorial',
            analyzerId: 'readability',
            code: 'long-sentence',
            checkId: 'formatting',
            severity: 'medium',
            confidence: 'medium',
            reason: 'Sentence is long.',
            recommendation: Object.freeze({ text: 'Split the sentence.' }),
            acceptanceCriteria: Object.freeze({ text: 'Average sentence length is lower.' }),
          }),
        ]),
    });

    const registry = new EditorialModuleRegistry([
      findingModule,
      createEmptyEditorialModule('evidence'),
      createEmptyEditorialModule('seo'),
      createEmptyEditorialModule('ai-seo'),
      createEmptyEditorialModule('affiliate'),
    ]);

    const orchestrator = createEditorialIntelligenceOrchestrator({ registry });
    const report = orchestrator.analyze({
      artifact,
      profile: Object.freeze({
        ...testProfile,
        enabledModules: Object.freeze([
          'editorial',
        ] as const satisfies readonly EditorialModuleId[]),
      }),
      analyzedAt: FIXED_ANALYZED_AT,
    });

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.id).toBe(
      buildDeterministicEditorialFindingId({
        reportId: report.reportId,
        category: 'editorial',
        analyzerId: 'readability',
        code: 'long-sentence',
        identityKey: 'identity-key-1',
      }),
    );
  });
});

describe('createContentReviewRequest editorial integration', () => {
  it('attaches editorial intelligence report metadata to a review request', async () => {
    const artifact = await createValidArtifact();
    const orchestrator = createEditorialIntelligenceOrchestrator();
    const editorialReport = orchestrator.analyze({
      artifact,
      profile: testProfile,
      analyzedAt: FIXED_ANALYZED_AT,
    });

    const review = createContentReviewRequest(artifact, {
      createdAt: FIXED_CREATED_AT,
      editorialReport,
    });

    expect(review.status).toBe('pending-review');
    expect(review.editorialReportId).toBe(editorialReport.reportId);
    expect(review.preReviewFindings).toEqual(editorialReport.findings);
    expect(review.publicationReadiness).toEqual(editorialReport.publicationReadiness);
  });

  it('omits editorial fields when no report is supplied', async () => {
    const artifact = await createValidArtifact();
    const review = createContentReviewRequest(artifact, { createdAt: FIXED_CREATED_AT });

    expect(review.editorialReportId).toBeUndefined();
    expect(review.preReviewFindings).toBeUndefined();
    expect(review.publicationReadiness).toBeUndefined();
  });
});
