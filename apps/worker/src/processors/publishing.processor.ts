/**
 * Publishing job processor — runs PublishingOrchestrator with a configured Publisher.
 *
 * Publisher selection via PUBLISHER_DRIVER (default: mock).
 * Sprint 18 adds wordpress driver using WordPressMediaPublisher.
 */

import type { Publisher, PublishingFlowResult } from '@pcme/publishing';
import { PublishingOrchestrator } from '@pcme/publishing';

import {
  createPublisher,
  type CreatePublisherOptions,
  type PublisherDriver,
} from '../publishing/publisher-driver.js';
import type { PublishingJobPayload } from '../queue/publishing-payload.js';
import { toPublishingRequest } from '../queue/publishing-payload.js';

export type PublishingProcessorDeps = {
  createOrchestrator?: () => PublishingOrchestrator;
  createPublisher?: () => Publisher;
  publisherDriver?: PublisherDriver;
  env?: Record<string, string | undefined>;
};

function buildOrchestrator(deps: PublishingProcessorDeps): PublishingOrchestrator {
  if (deps.createOrchestrator) {
    return deps.createOrchestrator();
  }

  const publisher =
    deps.createPublisher?.() ??
    createPublisher({
      driver: deps.publisherDriver,
      env: deps.env,
    } satisfies CreatePublisherOptions);

  return new PublishingOrchestrator(publisher);
}

export async function processPublishingJob(
  payload: PublishingJobPayload,
  deps: PublishingProcessorDeps = {},
): Promise<PublishingFlowResult> {
  const orchestrator = buildOrchestrator(deps);
  const result = await orchestrator.publish(toPublishingRequest(payload));

  console.log(
    `[publishing] ${result.success ? '✓' : '✗'} slug=${payload.slug} media=${result.media?.externalId ?? '—'} post=${result.post?.externalId ?? '—'}`,
  );

  if (result.message) {
    console.log(`[publishing]   ${result.message}`);
  }

  return result;
}
