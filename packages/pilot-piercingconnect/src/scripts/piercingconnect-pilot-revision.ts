/**
 * PiercingConnect offline revision pilot.
 *
 * Pipeline: fixture draft → intelligence report → request-changes → revision → re-analysis.
 * Stops at pending-review. Does not call WordPress or publish.
 *
 * Run: pnpm piercingconnect:pilot:revision
 */

import { runPiercingConnectPilotRevision } from '../run-pilot-revision.js';

async function main(): Promise<void> {
  const result = await runPiercingConnectPilotRevision();

  console.log(`status: ${result.status}`);
  console.log(`published: ${result.published}`);
  console.log(`wordpress invoked: ${result.wordpressInvoked}`);
  console.log(`review ID: ${result.reviewId ?? 'none'}`);
  console.log(`artifact ID: ${result.artifactId ?? 'none'}`);
  console.log(`revision artifact ID: ${result.revisionArtifactId ?? 'none'}`);

  if (result.outputs) {
    console.log(`output dir: ${result.outputs.outputDir}`);
    console.log(`draft v1: ${result.outputs.generatedReviewPath}`);
    console.log(`draft v2: ${result.outputs.generatedReviewV2Path}`);
    console.log(`revision request: ${result.outputs.revisionRequestPath}`);
    console.log(`revision comparison: ${result.outputs.revisionComparisonPath}`);
  }

  if (result.status === 'failed') {
    console.error(`error: ${result.error?.code ?? 'unknown'} — ${result.error?.message ?? ''}`);
    process.exit(1);
  }

  console.log('Revision draft remains pending-review. Human approval is still required.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
