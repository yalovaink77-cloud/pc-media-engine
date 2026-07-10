/**
 * Content orchestrator smoke script.
 *
 * Prepares a product-review generation plan for a NeilMed product.
 *
 * Run: pnpm orchestrator:smoke
 */

import { formatKnowledgeServiceError } from '../knowledge/errors.js';
import { createCommerceContentOrchestrator } from '../orchestrator/index.js';

const PRODUCT_ID = 'neilmed-piercing-aftercare-fine-mist';

async function main(): Promise<void> {
  const orchestrator = await createCommerceContentOrchestrator();

  const plan = await orchestrator.prepare({
    root: { type: 'product', id: PRODUCT_ID },
    contextRecipe: 'product-review',
    contentType: 'product-review',
    locale: 'en',
    tone: 'educational',
    outputFormat: 'markdown',
    strict: false,
  });

  console.log(`Request ID: ${plan.requestId}`);
  console.log(`Status: ${plan.status}`);
  console.log(`Content type: ${plan.contentType}`);
  console.log(`Context recipe: ${plan.contextRecipeId}`);
  console.log(`Entity count: ${plan.metadata.entityCount}`);
  console.log(`Prompt section count: ${plan.metadata.promptSectionCount}`);
  console.log(`Warning count: ${plan.warnings.length}`);
  console.log(`Snapshot ID: ${plan.snapshot.snapshotId}`);
}

main().catch((error: unknown) => {
  console.error(`Orchestrator smoke failed: ${formatKnowledgeServiceError(error)}`);
  process.exit(1);
});
