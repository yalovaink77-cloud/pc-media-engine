import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CommerceKnowledgeSourceAdapter } from '../adapters/commerce-adapter.js';
import { KnowledgeEntityNotFoundError, KnowledgeUnsupportedRelationshipError } from '../errors.js';
import { createKnowledgeService } from '../service.js';

const tempDirs: string[] = [];

async function createFixtureRepo(collections: Record<string, string[]>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcme-knowledge-graph-'));
  tempDirs.push(root);

  for (const [collectionDir, yamlFiles] of Object.entries(collections)) {
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

describe('KnowledgeService graph traversal', () => {
  it('traverses brand to products', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\nproducts:\n  - product-a\n'],
      products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const result = await service.traverse({
      start: { type: 'brand', id: 'brand-a' },
      follow: ['brand.products'],
      maxDepth: 1,
    });

    expect(result.nodes.map((node) => `${node.type}:${node.id}`)).toEqual([
      'brand:brand-a',
      'product:product-a',
    ]);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]?.relationship).toBe('brand.products');
  });

  it('traverses product to ingredients', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\n'],
      products: [
        'id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\ningredients:\n  - ingredient-a\n  - ingredient-b\n',
      ],
      ingredients: [
        'id: ingredient-a\nslug: ingredient-a\nname: Ingredient A\n',
        'id: ingredient-b\nslug: ingredient-b\nname: Ingredient B\n',
      ],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const result = await service.traverse({
      start: { type: 'product', id: 'product-a' },
      follow: ['product.ingredients'],
      maxDepth: 1,
    });

    expect(result.nodes.map((node) => node.id)).toEqual([
      'ingredient-a',
      'ingredient-b',
      'product-a',
    ]);
  });

  it('supports multi-hop traversal', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\nproducts:\n  - product-a\n'],
      products: [
        'id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\ningredients:\n  - ingredient-a\n',
      ],
      ingredients: ['id: ingredient-a\nslug: ingredient-a\nname: Ingredient A\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const result = await service.traverse({
      start: { type: 'brand', id: 'brand-a' },
      follow: ['brand.products', 'product.ingredients'],
      maxDepth: 2,
    });

    expect(result.nodes.map((node) => `${node.type}:${node.id}`)).toEqual([
      'brand:brand-a',
      'ingredient:ingredient-a',
      'product:product-a',
    ]);
  });

  it('detects cycles deterministically', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\nproducts:\n  - product-a\n'],
      products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const result = await service.traverse({
      start: { type: 'brand', id: 'brand-a' },
      follow: ['brand.products', 'product.brand'],
      maxDepth: 3,
    });

    expect(result.warnings.some((warning) => warning.code === 'cycle-detected')).toBe(true);
  });

  it('returns deterministic node and edge ordering', async () => {
    const repoPath = await createFixtureRepo({
      brands: [
        'id: brand-a\nslug: brand-a\nname: Brand A\nproducts:\n  - product-z\n  - product-a\n',
      ],
      products: [
        'id: product-z\nslug: product-z\nname: Product Z\nbrand: brand-a\n',
        'id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n',
      ],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const first = await service.traverse({
      start: { type: 'brand', id: 'brand-a' },
      follow: ['brand.products'],
      maxDepth: 1,
    });
    const second = await service.traverse({
      start: { type: 'brand', id: 'brand-a' },
      follow: ['brand.products'],
      maxDepth: 1,
    });

    expect(first.nodes.map((node) => node.id)).toEqual(second.nodes.map((node) => node.id));
    expect(first.edges.map((edge) => edge.to.id)).toEqual(second.edges.map((edge) => edge.to.id));
  });

  it('warns on missing references in non-strict mode', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\nproducts:\n  - missing-product\n'],
      products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const result = await service.traverse({
      start: { type: 'brand', id: 'brand-a' },
      follow: ['brand.products'],
      maxDepth: 1,
    });

    expect(result.warnings.some((warning) => warning.code === 'missing-reference')).toBe(true);
  });

  it('throws on missing references in strict traversal mode', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\nproducts:\n  - missing-product\n'],
      products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    await expect(
      service.traverse({
        start: { type: 'brand', id: 'brand-a' },
        follow: ['brand.products'],
        maxDepth: 1,
        strict: true,
      }),
    ).rejects.toBeInstanceOf(KnowledgeEntityNotFoundError);
  });

  it('enforces maxDepth', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\nproducts:\n  - product-a\n'],
      products: [
        'id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\ningredients:\n  - ingredient-a\n',
      ],
      ingredients: ['id: ingredient-a\nslug: ingredient-a\nname: Ingredient A\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const result = await service.traverse({
      start: { type: 'brand', id: 'brand-a' },
      follow: ['brand.products', 'product.ingredients'],
      maxDepth: 1,
    });

    expect(result.nodes.map((node) => node.type)).toEqual(['brand', 'product']);
  });

  it('truncates when maxNodes is exceeded', async () => {
    const repoPath = await createFixtureRepo({
      brands: [
        'id: brand-a\nslug: brand-a\nname: Brand A\nproducts:\n  - product-a\n  - product-b\n  - product-c\n',
      ],
      products: [
        'id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n',
        'id: product-b\nslug: product-b\nname: Product B\nbrand: brand-a\n',
        'id: product-c\nslug: product-c\nname: Product C\nbrand: brand-a\n',
      ],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const result = await service.traverse({
      start: { type: 'brand', id: 'brand-a' },
      follow: ['brand.products'],
      maxDepth: 1,
      maxNodes: 2,
    });

    expect(result.truncated).toBe(true);
    expect(result.nodes.length).toBeLessThanOrEqual(2);
  });

  it('throws for unsupported relationships', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\n'],
      products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    await expect(
      service.traverse({
        start: { type: 'brand', id: 'brand-a' },
        follow: ['brand.unsupported'],
      }),
    ).rejects.toBeInstanceOf(KnowledgeUnsupportedRelationshipError);
  });

  it('lazy-loads collections during traversal', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\nproducts:\n  - product-a\n'],
      products: [
        'id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\ningredients:\n  - ingredient-a\n',
      ],
      ingredients: ['id: ingredient-a\nslug: ingredient-a\nname: Ingredient A\n'],
    });

    const adapter = new CommerceKnowledgeSourceAdapter({ repoPath });
    const service = await createKnowledgeService({ adapter });

    expect(adapter.getLoadedEntityTypes()).toEqual(['brand', 'product']);

    await service.traverse({
      start: { type: 'brand', id: 'brand-a' },
      follow: ['brand.products', 'product.ingredients'],
      maxDepth: 2,
    });

    expect(adapter.getLoadedEntityTypes()).toContain('ingredient');
  });
});
