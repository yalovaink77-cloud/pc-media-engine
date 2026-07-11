/**
 * PiercingConnect revenue pilot — first real product-review draft.
 *
 * Pipeline: commerce knowledge → orchestrator → generation → artifact → pending review.
 * Stops before publishing handoff. Does not call WordPress.
 *
 * Run: pnpm piercingconnect:pilot
 */

import { runPiercingConnectPilotDraft } from '../run-pilot-draft.js';

async function main(): Promise<void> {
  const result = await runPiercingConnectPilotDraft();

  if (result.status === 'skipped') {
    console.log(`PiercingConnect pilot skipped: ${result.skipReason}`);
    console.log('Set OPENROUTER_API_KEY to generate a real draft. No publishing was attempted.');
    process.exit(0);
  }

  console.log(`status: ${result.status}`);
  console.log(`product: ${result.productId}`);
  console.log(`content type: ${result.contentType}`);
  console.log(`published: ${result.published}`);
  console.log(`wordpress invoked: ${result.wordpressInvoked}`);
  console.log(`review status: ${result.reviewStatus ?? 'none'}`);
  console.log(`job ID: ${result.jobId ?? 'none'}`);
  console.log(`artifact ID: ${result.artifactId ?? 'none'}`);
  console.log(`review ID: ${result.reviewId ?? 'none'}`);
  console.log(`warning count: ${result.warningCount ?? 0}`);

  if (result.outputs) {
    console.log(`output dir: ${result.outputs.outputDir}`);
    console.log(`generated review: ${result.outputs.generatedReviewPath}`);
    console.log(`artifact metadata: ${result.outputs.artifactMetadataPath}`);
    console.log(`review summary: ${result.outputs.reviewSummaryPath}`);
  }

  if (result.missingSections && result.missingSections.length > 0) {
    console.log(`missing section markers: ${result.missingSections.join(', ')}`);
  }

  if (result.status === 'failed' || result.status === 'blocked') {
    console.error(`error: ${result.error?.code ?? 'unknown'} — ${result.error?.message ?? ''}`);
    process.exit(1);
  }

  console.log('Draft remains pending-review. Do not publish until human review completes.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
