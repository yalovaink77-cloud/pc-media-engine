#!/usr/bin/env node
/**
 * PiercingConnect revenue acceptance pilot — full offline pipeline.
 *
 * Run: pnpm piercingconnect:pilot:acceptance
 */

import { runPiercingConnectPilotAcceptance } from '../run-pilot-acceptance.js';

async function main(): Promise<void> {
  const result = await runPiercingConnectPilotAcceptance();

  if (result.status === 'failed') {
    console.error(`Acceptance pilot failed: ${result.error?.code} — ${result.error?.message}`);
    process.exit(1);
  }

  console.log('PiercingConnect revenue acceptance pilot completed.');
  console.log(`Review status: ${result.humanReviewStatus}`);
  console.log(`WordPress draft status: ${result.wordpressDraftStatus}`);
  console.log(`Published: ${result.published}`);
  console.log(`WordPress invoked: ${result.wordpressInvoked}`);
  if (result.outputs?.acceptanceReportPath) {
    console.log(`Acceptance report: ${result.outputs.acceptanceReportPath}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
