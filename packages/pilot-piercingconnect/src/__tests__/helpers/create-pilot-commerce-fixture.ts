import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PRODUCT_ID = 'neilmed-piercing-aftercare-fine-mist';

const trackedTempDirs: string[] = [];

/** Minimal read-only commerce repo for offline pilot tests (no sibling checkout required). */
export async function createPilotCommerceFixtureRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcme-piercingconnect-pilot-'));
  trackedTempDirs.push(root);

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

/** Allocate a temporary pilot output directory tracked for cleanup. */
export async function createPilotTestOutputDir(prefix = 'pcme-pilot-out-'): Promise<string> {
  const outputDir = await mkdtemp(join(tmpdir(), prefix));
  trackedTempDirs.push(outputDir);
  return outputDir;
}

/** Remove fixture/output dirs created by this helper during the current test file. */
export async function cleanupPilotTestDirs(): Promise<void> {
  await Promise.all(
    trackedTempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
}
