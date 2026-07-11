import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { EntityReference } from '@pcme/content';

let cachedFixturePath: string | undefined;

async function writeCollectionRecords(
  repoPath: string,
  collections: Record<string, string[]>,
): Promise<void> {
  for (const [collectionDir, yamlFiles] of Object.entries(collections)) {
    const dir = join(repoPath, 'data', collectionDir);
    await mkdir(dir, { recursive: true });
    for (const [index, yaml] of yamlFiles.entries()) {
      await writeFile(join(dir, `record-${index}.yaml`), yaml, 'utf8');
    }
  }
}

async function writeProductReviewFixture(repoPath: string, productId: string): Promise<void> {
  const brandId = 'dry-run-brand';
  await writeCollectionRecords(repoPath, {
    brands: [
      `id: ${brandId}\nslug: ${brandId}\nname: Dry Run Brand\nproducts:\n  - ${productId}\n`,
    ],
    products: [
      [
        `id: ${productId}`,
        `slug: ${productId}`,
        'name: Dry Run Product',
        `brand: ${brandId}`,
        'category: dry-run-category',
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
      'id: dry-run-category\nslug: dry-run-category\nname: Dry Run Category\n',
    ],
  });
}

/** Create an isolated commerce repository fixture for offline pipeline dry runs. */
export async function createDryRunCommerceFixture(root: EntityReference): Promise<string> {
  if (cachedFixturePath) {
    return cachedFixturePath;
  }

  const repoPath = await mkdtemp(join(tmpdir(), 'pcme-pipeline-dry-run-'));

  if (root.type === 'product') {
    await writeProductReviewFixture(repoPath, root.id);
  } else {
    await writeCollectionRecords(repoPath, {
      brands: ['id: dry-run-brand\nslug: dry-run-brand\nname: Dry Run Brand\n'],
      products: [
        'id: dry-run-product\nslug: dry-run-product\nname: Dry Run Product\nbrand: dry-run-brand\n',
      ],
    });
  }

  cachedFixturePath = await realpath(repoPath);
  return cachedFixturePath;
}

/** Reset cached fixture path for unit tests that need a fresh repository. */
export function resetDryRunCommerceFixtureCache(): void {
  cachedFixturePath = undefined;
}
