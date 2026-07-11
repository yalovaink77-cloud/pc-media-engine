import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CommerceKnowledgeSourceAdapter } from '../../knowledge/adapters/commerce-adapter.js';
import { createKnowledgeService } from '../../knowledge/service.js';
import { buildPromptPayload } from '../build.js';
import {
  PromptContextRecipeMismatchError,
  PromptMissingRequiredContextError,
  PromptUnsupportedContentTypeError,
} from '../errors.js';
import { getCommercePromptContentRecipes } from '../index.js';
import { containsBlockedPromptMetadata } from '../serialize.js';

const tempDirs: string[] = [];

function withTier0Collections(collections: Record<string, string[]>): Record<string, string[]> {
  return {
    brands: [],
    products: [],
    ...collections,
  };
}

async function createFixtureRepo(collections: Record<string, string[]>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcme-prompt-payload-'));
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
      'template_path: /secret/templates/product-review.md',
      'affiliate:',
      '  commission_rate: 10',
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

const recipes = getCommercePromptContentRecipes();

describe('buildPromptPayload', () => {
  it('builds a product-review payload', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'product', id: 'neilmed-product' },
      recipe: 'product-review',
    });

    const payload = buildPromptPayload(
      {
        context,
        contentType: 'product-review',
        locale: 'en',
        tone: 'educational',
        outputFormat: 'markdown',
      },
      { recipes },
    );

    expect(payload.contentType).toBe('product-review');
    expect(payload.systemInstructions.length).toBeGreaterThan(0);
    expect(payload.userSections.length).toBeGreaterThan(0);
    expect(payload.userSections[0]?.id).toBe('content-objective');
    expect(payload.metadata.rootEntityId).toBe('neilmed-product');
    expect(payload.metadata.entityCount).toBeGreaterThan(0);
  });

  it('includes problem-guide safety constraints', async () => {
    const repoPath = await createFixtureRepo({
      problems: [
        [
          'id: bump-problem',
          'slug: bump-problem',
          'name: Piercing Bump',
          'symptoms:',
          '  - redness',
        ].join('\n'),
      ],
      symptoms: ['id: redness\nslug: redness\nname: Redness\n'],
      ingredients: [],
      products: [],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'problem', id: 'bump-problem' },
      recipe: 'problem-guide',
    });

    const payload = buildPromptPayload(
      {
        context,
        contentType: 'problem-guide',
      },
      { recipes },
    );

    const constraintIds = payload.constraints.map((constraint) => constraint.id);
    expect(constraintIds).toContain('no-diagnosis');
    expect(constraintIds).toContain('no-unsupported-medical-claims');
    expect(constraintIds).toContain('evidence-policy');
  });

  it('restricts affiliate CTAs in the output contract', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'product', id: 'neilmed-product' },
      recipe: 'product-review',
    });

    const payload = buildPromptPayload(
      {
        context,
        contentType: 'product-review',
      },
      { recipes },
    );

    expect(payload.outputContract.prohibitedCtaTypes).toContain('commission-first');
    expect(payload.outputContract.prohibitedCtaTypes).toContain('hidden-affiliate');
    expect(payload.constraints.some((constraint) => constraint.id === 'no-commission-first')).toBe(
      true,
    );
  });

  it('returns deterministic output', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'product', id: 'neilmed-product' },
      recipe: 'product-review',
    });

    const request = {
      context,
      contentType: 'product-review',
      locale: 'en',
      tone: 'educational',
      outputFormat: 'markdown' as const,
    };

    const first = buildPromptPayload(request, { recipes });
    const second = buildPromptPayload(request, { recipes });

    expect(JSON.stringify(first.userSections)).toBe(JSON.stringify(second.userSections));
    expect(JSON.stringify(first.constraints)).toBe(JSON.stringify(second.constraints));
    expect(JSON.stringify(first.systemInstructions)).toBe(
      JSON.stringify(second.systemInstructions),
    );
  });

  it('does not include blocked metadata in payload sections', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'product', id: 'neilmed-product' },
      recipe: 'product-review',
    });

    const payload = buildPromptPayload(
      {
        context,
        contentType: 'product-review',
      },
      { recipes },
    );

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('template_path');
    expect(serialized).not.toContain('sourcePath');
    expect(serialized).not.toContain('/secret/templates');
    expect(payload.metadata.snapshotId).toBeTruthy();
    expect(serialized).not.toContain(context.snapshot.sourcePath);

    for (const section of payload.userSections) {
      expect(containsBlockedPromptMetadata(section.content)).toBe(false);
    }
  });

  it('throws in strict mode when required context is missing', async () => {
    const repoPath = await createFixtureRepo({
      products: ['id: solo\nslug: solo\nname: Solo Product\n'],
      brands: [],
      ingredients: [],
      'healing-stages': [],
      'product-categories': [],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'product', id: 'solo' },
      recipe: 'product-review',
    });

    expect(() =>
      buildPromptPayload(
        {
          context,
          contentType: 'product-review',
          strict: true,
        },
        { recipes },
      ),
    ).toThrow(PromptMissingRequiredContextError);
  });

  it('warns in non-strict mode when required context is missing', async () => {
    const repoPath = await createFixtureRepo({
      products: ['id: solo\nslug: solo\nname: Solo Product\n'],
      brands: [],
      ingredients: [],
      'healing-stages': [],
      'product-categories': [],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'product', id: 'solo' },
      recipe: 'product-review',
    });

    const payload = buildPromptPayload(
      {
        context,
        contentType: 'product-review',
      },
      { recipes },
    );

    expect(payload.warnings.some((warning) => warning.code === 'missing-required-context')).toBe(
      true,
    );
  });

  it('throws for unsupported content type', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'product', id: 'neilmed-product' },
      recipe: 'product-review',
    });

    expect(() =>
      buildPromptPayload(
        {
          context,
          contentType: 'unknown-content-type',
        },
        { recipes },
      ),
    ).toThrow(PromptUnsupportedContentTypeError);
  });

  it('throws for wrong context recipe in strict mode', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'product', id: 'neilmed-product' },
      recipe: 'product-comparison',
    });

    expect(() =>
      buildPromptPayload(
        {
          context,
          contentType: 'product-review',
          strict: true,
        },
        { recipes },
      ),
    ).toThrow(PromptContextRecipeMismatchError);
  });

  it('builds a correct output contract', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'product', id: 'neilmed-product' },
      recipe: 'product-review',
    });

    const payload = buildPromptPayload(
      {
        context,
        contentType: 'product-review',
        locale: 'en',
        tone: 'educational',
        outputFormat: 'markdown',
      },
      { recipes },
    );

    expect(payload.outputContract.format).toBe('markdown');
    expect(payload.outputContract.locale).toBe('en');
    expect(payload.outputContract.tone).toBe('educational');
    expect(payload.outputContract.sections).toContain('editorial-summary');
    expect(payload.outputContract.sections).toContain('product-overview');
    expect(payload.outputContract.sections).toContain('source-notes');
  });

  it('includes token-budget metadata', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'product', id: 'neilmed-product' },
      recipe: 'product-review',
    });

    const payload = buildPromptPayload(
      {
        context,
        contentType: 'product-review',
      },
      { recipes },
    );

    expect(payload.metadata.estimatedInputCharacters).toBeGreaterThan(0);
    expect(payload.metadata.estimatedSectionCount).toBe(payload.userSections.length);
    expect(payload.metadata.entityCount).toBeGreaterThan(0);
    expect(payload.metadata.truncationWarning).toBe(false);
  });
});
