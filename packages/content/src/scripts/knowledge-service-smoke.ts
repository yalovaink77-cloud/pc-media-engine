/**
 * Knowledge service smoke script.
 *
 * Demonstrates the generic Knowledge Service backed by the commerce repository adapter.
 *
 * Run: pnpm knowledge:smoke
 */

import { createCommerceKnowledgeAccessors } from '../knowledge/adapters/commerce-adapter.js';
import { formatKnowledgeServiceError } from '../knowledge/errors.js';
import { createKnowledgeService } from '../knowledge/service.js';

async function main(): Promise<void> {
  const service = await createKnowledgeService();
  const commerce = createCommerceKnowledgeAccessors(service);
  const snapshot = await service.getSnapshot();

  const neilmed = await commerce.getBrand('neilmed');
  const neilmedProducts = await commerce.getProductsByBrand('neilmed');

  console.log(`Snapshot ID: ${snapshot.snapshotId}`);
  console.log(`Source: ${snapshot.sourceType} (${snapshot.sourcePath})`);
  console.log(`Total entities: ${snapshot.totalEntityCount}`);
  console.log(`Brand count: ${snapshot.entityCounts.brand ?? 0}`);
  console.log(`Product count: ${snapshot.entityCounts.product ?? 0}`);
  console.log(`NeilMed brand: ${neilmed?.name ?? '(not found)'}`);
  console.log(`NeilMed products: ${neilmedProducts.length}`);
}

main().catch((error: unknown) => {
  console.error(`Knowledge service smoke failed: ${formatKnowledgeServiceError(error)}`);
  process.exit(1);
});
