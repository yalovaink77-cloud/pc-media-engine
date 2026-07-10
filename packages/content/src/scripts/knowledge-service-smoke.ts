/**
 * Knowledge service smoke script.
 *
 * Demonstrates the generic Knowledge Service backed by the commerce repository adapter.
 *
 * Run: pnpm knowledge:smoke
 */

import {
  CommerceKnowledgeSourceAdapter,
  createCommerceKnowledgeAccessors,
  getCommerceSupportedEntityTypes,
} from '../knowledge/adapters/commerce-adapter.js';
import { formatKnowledgeServiceError } from '../knowledge/errors.js';
import { createKnowledgeService } from '../knowledge/service.js';

async function main(): Promise<void> {
  const adapter = new CommerceKnowledgeSourceAdapter();
  const service = await createKnowledgeService({ adapter });
  const commerce = createCommerceKnowledgeAccessors(service);

  for (const entityType of getCommerceSupportedEntityTypes()) {
    await service.getEntitiesByType(entityType);
  }

  const snapshot = await service.getSnapshot();

  const neilmed = await commerce.getBrand('neilmed');
  const neilmedProducts = await commerce.getProductsByBrand('neilmed');
  const sterileWater = await service.getEntity('ingredient', 'sterile-water');
  const swelling = await service.getEntity('problem', 'swelling');
  const helix = await service.getEntity('piercing-type', 'helix');
  const keyword = await service.getEntity('keyword-cluster', 'best-saline-spray-for-piercings');

  console.log(`Snapshot ID: ${snapshot.snapshotId}`);
  console.log(`Source: ${snapshot.sourceType} (${snapshot.sourcePath})`);
  console.log(`Total entities: ${snapshot.totalEntityCount}`);
  console.log(
    `Collections loaded: ${snapshot.loadedCollectionCount}/${snapshot.supportedCollectionCount}`,
  );

  const sortedTypes = Object.keys(snapshot.entityCounts).sort((a, b) => a.localeCompare(b));
  for (const entityType of sortedTypes) {
    console.log(`  ${entityType}: ${snapshot.entityCounts[entityType] ?? 0}`);
  }

  console.log(`Brand (neilmed): ${neilmed?.name ?? '(not found)'}`);
  console.log(`Product count for neilmed: ${neilmedProducts.length}`);
  console.log(`Ingredient (sterile-water): ${sterileWater?.name ?? '(not found)'}`);
  console.log(`Problem (swelling): ${swelling?.name ?? '(not found)'}`);
  console.log(`Piercing type (helix): ${helix?.name ?? '(not found)'}`);
  console.log(
    `Keyword cluster (best-saline-spray-for-piercings): ${keyword?.name ?? '(not found)'}`,
  );
}

main().catch((error: unknown) => {
  console.error(`Knowledge service smoke failed: ${formatKnowledgeServiceError(error)}`);
  process.exit(1);
});
