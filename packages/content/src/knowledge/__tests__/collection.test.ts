import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { COMMERCE_COLLECTION_REGISTRY } from '../adapters/commerce/collection-registry.js';
import {
  CommerceKnowledgeSourceAdapter,
  getCommerceSupportedEntityTypes,
} from '../adapters/commerce-adapter.js';
import { KnowledgeSnapshotError, KnowledgeUnsupportedCollectionError } from '../errors.js';
import { createKnowledgeService } from '../service.js';
import type { KnowledgeSourceEntity } from '../types.js';

const tempDirs: string[] = [];

async function createFixtureRepo(collections: Record<string, string[]>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcme-knowledge-collection-'));
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

function buildMinimalCollectionRecord(
  entityLabel: string,
  displayNameFields?: readonly string[],
): string {
  const id = `${entityLabel}-fixture`;
  if (displayNameFields?.includes('primary_keyword')) {
    return `id: ${id}\nslug: ${id}\nprimary_keyword: ${entityLabel} fixture\n`;
  }
  return `id: ${id}\nslug: ${id}\nname: ${entityLabel} fixture\n`;
}

async function createFullSupportedCollectionsFixture(): Promise<string> {
  const collections: Record<string, string[]> = {
    brands: ['id: brand-a\nslug: brand-a\nname: Brand A\n'],
    products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
  };

  for (const definition of COMMERCE_COLLECTION_REGISTRY) {
    if (definition.loadTier === 0) {
      continue;
    }

    const collectionDir = definition.dataSegments.at(0);
    if (collectionDir === undefined) {
      continue;
    }

    collections[collectionDir] = [
      buildMinimalCollectionRecord(definition.entityLabel, definition.displayNameFields),
    ];
  }

  return createFixtureRepo(collections);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('CommerceKnowledgeSourceAdapter collections', () => {
  it('loads all supported entity collections from isolated fixtures', async () => {
    const repoPath = await createFullSupportedCollectionsFixture();
    const adapter = new CommerceKnowledgeSourceAdapter({ repoPath });
    const result = await adapter.loadAllCollections();

    expect(result.loadedCollectionCount).toBe(getCommerceSupportedEntityTypes().length);
    expect(result.supportedCollectionCount).toBe(getCommerceSupportedEntityTypes().length);
    expect(result.entities.length).toBeGreaterThan(0);

    const types = new Set(result.entities.map((entity: KnowledgeSourceEntity) => entity.type));
    for (const entityType of getCommerceSupportedEntityTypes()) {
      expect(types.has(entityType)).toBe(true);
    }
  });

  it('looks up entities from multiple non-brand/product collections', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\n'],
      products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
      ingredients: ['id: sterile-water\nslug: sterile-water\nname: Sterile Water\n'],
      problems: ['id: swelling\nslug: swelling\nname: Swelling\n'],
      'healing-stages': ['id: fresh-piercing\nslug: fresh-piercing\nname: Fresh Piercing\n'],
      'piercing-types': ['id: helix\nslug: helix\nname: Helix\n'],
      keywords: ['id: keyword-a\nslug: keyword-a\nprimary_keyword: Best Saline Spray\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    await expect(service.getEntity('ingredient', 'sterile-water')).resolves.toMatchObject({
      name: 'Sterile Water',
    });
    await expect(service.getEntity('problem', 'swelling')).resolves.toMatchObject({
      name: 'Swelling',
    });
    await expect(service.getEntity('healing-stage', 'fresh-piercing')).resolves.toMatchObject({
      name: 'Fresh Piercing',
    });
    await expect(service.getEntity('piercing-type', 'helix')).resolves.toMatchObject({
      name: 'Helix',
    });
    await expect(service.getEntity('keyword-cluster', 'keyword-a')).resolves.toMatchObject({
      name: 'Best Saline Spray',
    });
  });

  it('rejects duplicate ids within a collection', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\n'],
      products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
      ingredients: [
        'id: duplicate\nslug: duplicate-a\nname: Ingredient A\n',
        'id: duplicate\nslug: duplicate-b\nname: Ingredient B\n',
      ],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    await expect(service.getEntitiesByType('ingredient')).rejects.toBeInstanceOf(
      KnowledgeSnapshotError,
    );
  });

  it('returns entities in deterministic order by type and id', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\n'],
      products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
      symptoms: [
        'id: symptom-z\nslug: symptom-z\nname: Symptom Z\n',
        'id: symptom-a\nslug: symptom-a\nname: Symptom A\n',
      ],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const symptoms = await service.getEntitiesByType('symptom');
    expect(symptoms.map((symptom) => symptom.id)).toEqual(['symptom-a', 'symptom-z']);
  });

  it('throws for unsupported entity types', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\n'],
      products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    await expect(service.getEntity('unsupported-type', 'x')).rejects.toBeInstanceOf(
      KnowledgeUnsupportedCollectionError,
    );
    await expect(service.getEntitiesByType('unsupported-type')).rejects.toBeInstanceOf(
      KnowledgeUnsupportedCollectionError,
    );
  });

  it('fails closed when a lazy collection contains malformed YAML', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\n'],
      products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
      ingredients: ['id: [unclosed\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    await expect(service.getEntitiesByType('ingredient')).rejects.toThrow();
  });

  it('lazy-loads tier-1 collections on first access', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\n'],
      products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
      ingredients: ['id: sterile-water\nslug: sterile-water\nname: Sterile Water\n'],
    });

    const adapter = new CommerceKnowledgeSourceAdapter({ repoPath });
    const service = await createKnowledgeService({ adapter });

    const initialSnapshot = await service.getSnapshot();
    expect(initialSnapshot.loadedCollectionCount).toBe(2);
    expect(initialSnapshot.totalEntityCount).toBe(2);
    expect(adapter.getLoadedEntityTypes()).toEqual(['brand', 'product']);

    await service.getEntity('ingredient', 'sterile-water');

    const loadedSnapshot = await service.getSnapshot();
    expect(loadedSnapshot.loadedCollectionCount).toBe(3);
    expect(loadedSnapshot.totalEntityCount).toBe(3);
    expect(adapter.getLoadedEntityTypes()).toEqual(['brand', 'ingredient', 'product']);
  });

  it('remains backward compatible with Sprint 023 brand and product lookups', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: brand-a\nslug: brand-a\nname: Brand A\nproducts:\n  - product-a\n'],
      products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
    });

    const service = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });

    const brand = await service.getEntity('brand', 'brand-a');
    const product = await service.getEntity('product', 'product-a');
    const related = await service.getRelatedEntities({ type: 'brand', id: 'brand-a' }, 'products');

    expect(brand?.name).toBe('Brand A');
    expect(product?.fields.brand).toBe('brand-a');
    expect(related.map((entry) => entry.id)).toEqual(['product-a']);
  });
});
