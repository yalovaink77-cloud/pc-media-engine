/**
 * End-to-end pipeline dry run smoke script.
 *
 * Run: pnpm pipeline:dry-run
 */

import { runContentPipelineDryRun } from '../pipeline/run-content-pipeline-dry-run.js';

const PRODUCT_ID = 'neilmed-piercing-aftercare-fine-mist';

async function main(): Promise<void> {
  const result = await runContentPipelineDryRun({
    root: { type: 'product', id: PRODUCT_ID },
    contextRecipe: 'product-review',
    contentType: 'product-review',
    locale: 'en',
    tone: 'educational',
    outputFormat: 'markdown',
    strict: false,
  });

  console.log(`pipeline status: ${result.status}`);
  console.log(`source ID: ${result.sourceId ?? 'none'}`);
  console.log(`snapshot ID: ${result.snapshotId ?? 'none'}`);
  console.log(`content type: ${result.contentType}`);
  console.log(`entity count: ${result.entityCount ?? 0}`);
  console.log(`job ID: ${result.jobId ?? 'none'}`);
  console.log(`artifact ID: ${result.artifactId ?? 'none'}`);
  console.log(`review ID: ${result.reviewId ?? 'none'}`);
  console.log(`handoff ID: ${result.handoffId ?? 'none'}`);
  console.log(`outbox ID: ${result.outboxId ?? 'none'}`);
  console.log(`worker status: ${result.workerStatus ?? 'none'}`);
  console.log(`target ID: ${result.targetId ?? 'none'}`);
  console.log(`total warnings: ${result.warningCounts.total}`);
  console.log(`total duration: ${result.totalDurationMs}ms`);

  if (result.status === 'failed' || result.status === 'blocked') {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
