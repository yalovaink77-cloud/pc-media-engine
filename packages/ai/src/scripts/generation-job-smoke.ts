/**
 * Generation job contract smoke script.
 *
 * Prepares a NeilMed product-review plan and converts it to a generation job.
 *
 * Run: pnpm generation-job:smoke
 */

import { createCommerceContentOrchestrator } from '@pcme/content';

import { countPolicyWarnings, createGenerationJob } from '../generation/index.js';

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

  const job = createGenerationJob(plan);

  console.log(`Job ID: ${job.jobId}`);
  console.log(`Status: ${job.status}`);
  console.log(`Provider-neutral payload size: ${job.metadata.providerNeutralPayloadSize}`);
  console.log(`Policy warning count: ${countPolicyWarnings(plan)}`);
  console.log(`Content type: ${job.contentType}`);
  console.log(`Output format: ${job.outputFormat}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Generation job smoke failed: ${message}`);
  process.exit(1);
});
