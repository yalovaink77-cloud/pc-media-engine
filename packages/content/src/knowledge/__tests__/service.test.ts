import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CommerceKnowledgeSourceAdapter } from '../adapters/commerce-adapter.js';
import { KnowledgeEntityNotFoundError, KnowledgeSnapshotError } from '../errors.js';
import { createKnowledgeService } from '../service.js';

const tempDirs: string[] = [];

async function createFixtureRepo(options?: {
  brands?: string[];
  products?: string[];
}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcme-knowledge-fixture-'));
  tempDirs.push(root);

  const brandsDir = join(root, 'data', 'brands');
  const productsDir = join(root, 'data', 'products');
  await mkdir(brandsDir, { recursive: true });
  await mkdir(productsDir, { recursive: true });

  for (const [index, yaml] of (options?.brands ?? []).entries()) {
    await writeFile(join(brandsDir, `brand-${index}.yaml`), yaml, 'utf8');
  }

  for (const [index, yaml] of (options?.products ?? []).entries()) {
    await writeFile(join(productsDir, `product-${index}.yaml`), yaml, 'utf8');
  }

  return realpath(root);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('KnowledgeService', () => {
  it('creates an immutable snapshot with metadata', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\n'],
      products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });
    const snapshot = await service.getSnapshot();

    expect(snapshot.snapshotId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(snapshot.sourceType).toBe('yaml-repository');
    expect(snapshot.sourcePath).toBe(repoPath);
    expect(snapshot.totalEntityCount).toBe(2);
    expect(snapshot.entityCounts.brand).toBe(1);
    expect(snapshot.entityCounts.product).toBe(1);
    expect(snapshot.loadedCollectionCount).toBe(2);
    expect(snapshot.supportedCollectionCount).toBe(18);
    expect(snapshot.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.warnings)).toBe(true);
    expect(Object.isFrozen(snapshot.entityCounts)).toBe(true);
  });

  it('looks up brands and products by id', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\n'],
      products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const brand = await service.getEntity('brand', 'brand-a');
    const product = await service.getEntity('product', 'product-a');

    expect(brand?.name).toBe('Brand A');
    expect(product?.fields.brand).toBe('brand-a');
  });

  it('looks up entities by slug', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-slug\nname: Brand A\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const brand = await service.getEntityBySlug('brand', 'brand-slug');
    expect(brand?.id).toBe('brand-a');
  });

  it('returns products related to a brand in deterministic order', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\n'],
      products: [
        'id: product-z\nslug: product-z\nname: Product Z\nbrand: brand-a\n',
        'id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n',
        'id: product-m\nslug: product-m\nname: Product M\nbrand: brand-a\n',
        'id: other\nslug: other\nname: Other\nbrand: brand-b\n',
      ],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const products = await service.getRelatedEntities({ type: 'brand', id: 'brand-a' }, 'products');
    expect(products.map((product) => product.id)).toEqual(['product-a', 'product-m', 'product-z']);
  });

  it('returns undefined for missing entities in non-strict mode', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    await expect(service.getEntity('brand', 'missing')).resolves.toBeUndefined();
  });

  it('throws for missing entities in strict mode', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\n'],
    });

    const service = await createKnowledgeService({
      strict: true,
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    await expect(service.getEntity('brand', 'missing')).rejects.toBeInstanceOf(
      KnowledgeEntityNotFoundError,
    );
  });

  it('returns entities by type in deterministic order', async () => {
    const repoPath = await createFixtureRepo({
      brands: [
        'id: brand-z\nslug: brand-z\nname: Brand Z\n',
        'id: brand-a\nslug: brand-a\nname: Brand A\n',
      ],
      products: [],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const brands = await service.getEntitiesByType('brand');
    expect(brands.map((brand) => brand.id)).toEqual(['brand-a', 'brand-z']);
    expect(Object.isFrozen(brands)).toBe(true);
  });

  it('freezes returned entities and prevents field mutation', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\nwebsite: https://example.test\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const brand = await service.getEntity('brand', 'brand-a');
    expect(brand).toBeDefined();
    expect(Object.isFrozen(brand)).toBe(true);
    expect(Object.isFrozen(brand?.fields)).toBe(true);

    expect(() => {
      (brand as { name: string }).name = 'Changed';
    }).toThrow();
  });

  it('rejects duplicate entity ids during snapshot creation', async () => {
    const repoPath = await createFixtureRepo({
      brands: [
        'id: brand-a\nslug: brand-a\nname: Brand A\n',
        'id: brand-a\nslug: brand-a-2\nname: Brand A Duplicate\n',
      ],
    });

    await expect(
      createKnowledgeService({
        adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
      }),
    ).rejects.toBeInstanceOf(KnowledgeSnapshotError);
  });
});
