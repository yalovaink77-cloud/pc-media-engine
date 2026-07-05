/**
 * Publishing job processor — runs PublishingOrchestrator with MockPublisher.
 *
 * Sprint 17 uses MockPublisher only. No external network calls.
 * Sprint 18 will inject WordPressMediaPublisher via configuration.
 */

import type { PublishingFlowResult } from '@pcme/publishing';
import { MockPublisher, PublishingOrchestrator } from '@pcme/publishing';

import type { PublishingJobPayload } from '../queue/publishing-payload.js';
import { toPublishingRequest } from '../queue/publishing-payload.js';

export type PublishingProcessorDeps = {
  createOrchestrator?: () => PublishingOrchestrator;
};

export async function processPublishingJob(
  payload: PublishingJobPayload,
  deps: PublishingProcessorDeps = {},
): Promise<PublishingFlowResult> {
  const orchestrator =
    deps.createOrchestrator?.() ?? new PublishingOrchestrator(new MockPublisher());

  const result = await orchestrator.publish(toPublishingRequest(payload));

  console.log(
    `[publishing] ${result.success ? '✓' : '✗'} slug=${payload.slug} media=${result.media?.externalId ?? '—'} post=${result.post?.externalId ?? '—'}`,
  );

  if (result.message) {
    console.log(`[publishing]   ${result.message}`);
  }

  return result;
}
