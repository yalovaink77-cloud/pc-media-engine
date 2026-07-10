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

  const traversal = await service.traverse({
    start: { type: 'brand', id: 'neilmed' },
    follow: ['brand.products', 'product.ingredients'],
    maxDepth: 2,
  });

  const productCount = traversal.nodes.filter((node) => node.type === 'product').length;
  const ingredientCount = traversal.nodes.filter((node) => node.type === 'ingredient').length;

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
  console.log('Traversal from neilmed:');
  console.log(`  Products: ${productCount}`);
  console.log(`  Ingredients: ${ingredientCount}`);
  console.log(`  Total nodes: ${traversal.nodes.length}`);
  console.log(`  Total edges: ${traversal.edges.length}`);
  console.log(`  Truncated: ${traversal.truncated}`);

  const productReviewContext = await service.buildContext({
    root: { type: 'product', id: 'neilmed-piercing-aftercare-fine-mist' },
    recipe: 'product-review',
  });

  const contextEntityCounts = Object.fromEntries(
    Object.entries(productReviewContext.entitiesByType).map(([type, nodes]) => [
      type,
      nodes?.length ?? 0,
    ]),
  );

  console.log('Product-review context (neilmed-piercing-aftercare-fine-mist):');
  console.log(`  Recipe ID: ${productReviewContext.recipeId}`);
  console.log(`  Root ID: ${productReviewContext.root.id}`);
  console.log(`  Entity count by type: ${JSON.stringify(contextEntityCounts)}`);
  console.log(`  Warning count: ${productReviewContext.warnings.length}`);
  console.log(`  Missing required count: ${productReviewContext.missingRequired.length}`);
  console.log(`  Truncated: ${productReviewContext.truncated}`);
}

main().catch((error: unknown) => {
  console.error(`Knowledge service smoke failed: ${formatKnowledgeServiceError(error)}`);
  process.exit(1);
});
