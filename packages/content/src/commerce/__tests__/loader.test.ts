import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_MAX_YAML_FILE_BYTES } from '../constants.js';
import { CommerceKnowledgeError } from '../errors.js';
import { loadCommerceBrands, loadCommerceKnowledge, loadCommerceProducts } from '../loader.js';
import { resolveCommerceRepositoryPath } from '../paths.js';

const tempDirs: string[] = [];

async function createFixtureRepo(options?: {
  brands?: string[];
  products?: string[];
}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcme-commerce-fixture-'));
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

describe('resolveCommerceRepositoryPath', () => {
  it('uses an explicit repo path when provided', async () => {
    const repoPath = await createFixtureRepo();
    await expect(resolveCommerceRepositoryPath({ repoPath })).resolves.toBe(repoPath);
  });
});

describe('loadCommerceKnowledge', () => {
  it('loads and validates brand and product YAML files', async () => {
    const repoPath = await createFixtureRepo({
      brands: [
        'id: brand-a\nslug: brand-a\nname: Brand A\n',
        'id: brand-b\nslug: brand-b\nname: Brand B\n',
      ],
      products: ['id: product-a\nslug: product-a\nname: Product A\nbrand: brand-a\n'],
    });

    const snapshot = await loadCommerceKnowledge({ repoPath });

    expect(snapshot.repoPath).toBe(repoPath);
    expect(snapshot.brands.map((b) => b.id)).toEqual(['brand-a', 'brand-b']);
    expect(snapshot.products.map((p) => p.id)).toEqual(['product-a']);
    expect(snapshot.brands[0]?.raw.website).toBeUndefined();
  });

  it('throws when required fields are missing', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: incomplete\n'],
    });

    await expect(loadCommerceBrands({ repoPath })).rejects.toMatchObject({
      name: 'CommerceKnowledgeError',
      issues: expect.arrayContaining(['slug is required', 'name is required']),
    } satisfies Partial<CommerceKnowledgeError>);
  });

  it('throws when YAML is invalid', async () => {
    const repoPath = await createFixtureRepo({
      products: ['id: [unclosed\n'],
    });

    await expect(loadCommerceProducts({ repoPath })).rejects.toBeInstanceOf(CommerceKnowledgeError);
  });

  it('rejects symlink escapes in brand files', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: safe\nslug: safe\nname: Safe\n'],
    });
    const outsideDir = await mkdtemp(join(tmpdir(), 'pcme-commerce-outside-'));
    tempDirs.push(outsideDir);
    const outsideFile = join(outsideDir, 'outside.yaml');
    await writeFile(outsideFile, 'id: escaped\nslug: escaped\nname: Escaped\n', 'utf8');

    await symlink(outsideFile, join(repoPath, 'data', 'brands', 'escape.yaml'));

    await expect(loadCommerceBrands({ repoPath })).rejects.toMatchObject({
      name: 'CommerceKnowledgeError',
      issues: expect.arrayContaining(['Symlinks are not permitted']),
    } satisfies Partial<CommerceKnowledgeError>);
  });

  it('rejects oversized YAML files', async () => {
    const repoPath = await createFixtureRepo({
      brands: [`id: big\nslug: big\nname: Big\npayload: ${'x'.repeat(2048)}\n`],
    });

    await expect(loadCommerceBrands({ repoPath, maxYamlFileBytes: 128 })).rejects.toMatchObject({
      name: 'CommerceKnowledgeError',
      issues: expect.arrayContaining(['Maximum allowed size is 128 bytes']),
    } satisfies Partial<CommerceKnowledgeError>);
  });

  it('accepts files within the default size limit', async () => {
    const repoPath = await createFixtureRepo({
      brands: ['id: ok\nslug: ok\nname: OK\n'],
    });

    await expect(
      loadCommerceBrands({ repoPath, maxYamlFileBytes: DEFAULT_MAX_YAML_FILE_BYTES }),
    ).resolves.toMatchObject({
      brands: [{ id: 'ok' }],
    });
  });
});
