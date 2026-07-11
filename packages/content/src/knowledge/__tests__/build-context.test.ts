import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getCommerceContextRecipe } from '../adapters/commerce/context-recipes.js';
import { CommerceKnowledgeSourceAdapter } from '../adapters/commerce-adapter.js';
import { buildKnowledgeContext } from '../context/build.js';
import { containsBlockedProjectionData } from '../context/projection.js';
import {
  KnowledgeContextMissingRequiredError,
  KnowledgeContextRootTypeError,
  KnowledgeUnsupportedContextRecipeError,
} from '../errors.js';
import { createKnowledgeService } from '../service.js';

const tempDirs: string[] = [];

function withTier0Collections(collections: Record<string, string[]>): Record<string, string[]> {
  return {
    brands: [],
    products: [],
    ...collections,
  };
}

async function createFixtureRepo(collections: Record<string, string[]>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcme-knowledge-context-'));
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

describe('KnowledgeService context builder', () => {
  it('builds product-review context from a NeilMed-like product', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'product', id: 'neilmed-product' },
      recipe: 'product-review',
    });

    expect(context.recipeId).toBe('product-review');
    expect(context.root.id).toBe('neilmed-product');
    expect(context.entitiesByType.product?.map((node) => node.id)).toEqual(['neilmed-product']);
    expect(context.entitiesByType.brand?.map((node) => node.id)).toEqual(['neilmed']);
    expect(context.entitiesByType.ingredient?.map((node) => node.id)).toEqual([
      'sodium-chloride',
      'sterile-water',
    ]);
    expect(context.entitiesByType['healing-stage']?.map((node) => node.id)).toEqual([
      'fresh-piercing',
    ]);
    expect(context.projection).toBe('summary');
  });

  it('builds brand-profile context', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'brand', id: 'neilmed' },
      recipe: 'brand-profile',
    });

    expect(context.recipeId).toBe('brand-profile');
    expect(context.entitiesByType.brand?.[0]?.id).toBe('neilmed');
    expect(context.entitiesByType.product?.map((node) => node.id)).toEqual(['neilmed-product']);
  });

  it('builds problem-guide context', async () => {
    const repoPath = await createFixtureRepo({
      problems: [
        [
          'id: bump-problem',
          'slug: bump-problem',
          'name: Piercing Bump',
          'symptoms:',
          '  - redness',
          'related_products:',
          '  - neilmed-product',
          'related_ingredients:',
          '  - sterile-water',
        ].join('\n'),
      ],
      symptoms: ['id: redness\nslug: redness\nname: Redness\n'],
      products: ['id: neilmed-product\nslug: neilmed-product\nname: Product\nbrand: neilmed\n'],
      ingredients: ['id: sterile-water\nslug: sterile-water\nname: Sterile Water\n'],
      brands: ['id: neilmed\nslug: neilmed\nname: NeilMed\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'problem', id: 'bump-problem' },
      recipe: 'problem-guide',
    });

    expect(context.entitiesByType.problem?.[0]?.id).toBe('bump-problem');
    expect(context.entitiesByType.symptom?.map((node) => node.id)).toEqual(['redness']);
    expect(context.entitiesByType.product?.map((node) => node.id)).toEqual(['neilmed-product']);
  });

  it('builds aftercare-guide context', async () => {
    const repoPath = await createFixtureRepo({
      'piercing-types': [
        [
          'id: test-helix',
          'slug: test-helix',
          'name: Test Helix',
          'healing_stages:',
          '  - test-fresh-piercing',
          'common_problems:',
          '  - test-bump-problem',
        ].join('\n'),
      ],
      'healing-stages': [
        'id: test-fresh-piercing\nslug: test-fresh-piercing\nname: Test Fresh Piercing\n',
      ],
      problems: ['id: test-bump-problem\nslug: test-bump-problem\nname: Test Piercing Bump\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'piercing-type', id: 'test-helix' },
      recipe: 'aftercare-guide',
    });

    expect(context.entitiesByType['piercing-type']?.[0]?.id).toBe('test-helix');
    expect(context.entitiesByType['healing-stage']?.map((node) => node.id)).toEqual([
      'test-fresh-piercing',
    ]);
    expect(context.entitiesByType.problem?.map((node) => node.id)).toEqual(['test-bump-problem']);
  });

  it('throws in strict mode when required entity types are missing', async () => {
    const repoPath = await createFixtureRepo({
      products: ['id: solo\nslug: solo\nname: Solo Product\n'],
      brands: [],
      ingredients: [],
      'healing-stages': [],
      'product-categories': [],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
      strict: true,
    });

    await expect(
      service.buildContext({
        root: { type: 'product', id: 'solo' },
        recipe: 'product-review',
        strict: true,
      }),
    ).rejects.toBeInstanceOf(KnowledgeContextMissingRequiredError);
  });

  it('warns in non-strict mode when required entity types are missing', async () => {
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

    expect(context.missingRequired.length).toBeGreaterThan(0);
    expect(context.warnings.some((warning) => warning.code === 'missing-required-type')).toBe(true);
  });

  it('applies projection filtering', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const identity = await service.buildContext({
      root: { type: 'product', id: 'neilmed-product' },
      recipe: 'product-review',
      projection: 'identity',
    });
    expect(identity.root.fields).toBeUndefined();

    const summary = await service.buildContext({
      root: { type: 'product', id: 'neilmed-product' },
      recipe: 'product-review',
      projection: 'summary',
    });
    expect(summary.root.fields?.category).toBe('sterile-saline-spray');
    expect(summary.root.fields?.template_path).toBeUndefined();
    expect(summary.root.fields?.affiliate).toBeUndefined();
  });

  it('does not expose blocked or internal fields', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const context = await service.buildContext({
      root: { type: 'product', id: 'neilmed-product' },
      recipe: 'product-review',
      projection: 'full',
    });

    for (const nodes of Object.values(context.entitiesByType)) {
      for (const node of nodes ?? []) {
        expect(containsBlockedProjectionData(node)).toBe(false);
        expect(JSON.stringify(node)).not.toContain('/secret/templates');
      }
    }
  });

  it('returns deterministic output', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const first = await service.buildContext({
      root: { type: 'product', id: 'neilmed-product' },
      recipe: 'product-review',
    });
    const second = await service.buildContext({
      root: { type: 'product', id: 'neilmed-product' },
      recipe: 'product-review',
    });

    expect(Object.keys(first.entitiesByType)).toEqual(Object.keys(second.entitiesByType));
    expect(JSON.stringify(first.entitiesByType)).toBe(JSON.stringify(second.entitiesByType));
    expect(JSON.stringify(first.edges)).toBe(JSON.stringify(second.edges));
  });

  it('propagates maxNodes truncation from traversal', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const snapshot = await service.getSnapshot();
    const traversal = await service.traverse({
      start: { type: 'product', id: 'neilmed-product' },
      follow: [
        'product.brand',
        'product.ingredients',
        'product.healing-stages',
        'product.product-category',
      ],
      maxNodes: 2,
    });

    const recipe = getCommerceContextRecipe('product-review');
    expect(recipe).toBeDefined();

    const context = buildKnowledgeContext({
      recipe: recipe!,
      request: {
        root: { type: 'product', id: 'neilmed-product' },
        recipe: 'product-review',
      },
      projection: 'summary',
      traversal,
      snapshot,
      policy: { blockedFields: ['affiliate'] },
    });

    expect(traversal.truncated).toBe(true);
    expect(context.truncated).toBe(true);
    expect(context.warnings.some((warning) => warning.code === 'truncated')).toBe(true);
  });

  it('throws for unsupported recipes', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    await expect(
      service.buildContext({
        root: { type: 'product', id: 'neilmed-product' },
        recipe: 'unknown-recipe',
      }),
    ).rejects.toBeInstanceOf(KnowledgeUnsupportedContextRecipeError);
  });

  it('throws for wrong root type', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    await expect(
      service.buildContext({
        root: { type: 'brand', id: 'neilmed' },
        recipe: 'product-review',
      }),
    ).rejects.toBeInstanceOf(KnowledgeContextRootTypeError);
  });
});
