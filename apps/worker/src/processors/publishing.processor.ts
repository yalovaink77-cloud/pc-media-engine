/**
 * Publishing job processor — runs PublishingOrchestrator with a configured Publisher.
 *
 * Publisher selection via PUBLISHER_DRIVER (default: mock).
 * Sprint 18 adds wordpress driver using WordPressMediaPublisher.
 */

import type { Publisher, PublishingFlowResult } from '@pcme/publishing';
import { PublishingOrchestrator } from '@pcme/publishing';

import type { WorkerMetricsService } from '../metrics.js';
import type { PublishedContentWriter } from '../publishing/persist-published-content.js';
import { persistPublishedContentIfSuccessful } from '../publishing/persist-published-content.js';
import {
  createPublisher,
  type CreatePublisherOptions,
  type PublisherDriver,
  resolvePublisherDriver,
} from '../publishing/publisher-driver.js';
import type { PublishingJobPayload } from '../queue/publishing-payload.js';
import { toPublishingRequest } from '../queue/publishing-payload.js';

export type PublishingProcessorDeps = {
  createOrchestrator?: () => PublishingOrchestrator;
  createPublisher?: () => Publisher;
  publisherDriver?: PublisherDriver;
  env?: Record<string, string | undefined>;
  publishedContentRepo?: PublishedContentWriter;
  /** Optional metrics accumulator — increments publisher-side counters. */
  metricsService?: WorkerMetricsService;
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
  const env = deps.env ?? process.env;
  const publisherDriver = deps.publisherDriver ?? resolvePublisherDriver(env);

  // Duplicate detection — runs before the orchestrator so no Publisher is invoked.
  if (deps.publishedContentRepo && payload.projectId) {
    const duplicate = await deps.publishedContentRepo.findDuplicate(
      payload.projectId,
      publisherDriver,
      payload.slug,
    );
    if (duplicate) {
      console.log(
        `[publishing] ⤼ slug=${payload.slug} publisher=${publisherDriver} — duplicate detected, skipping`,
      );
      deps.metricsService?.inc('duplicateSkipsTotal');
      return { success: false, skipped: true, reason: 'duplicate' };
    }
  }

  const orchestrator = buildOrchestrator(deps);
  const result = await orchestrator.publish(toPublishingRequest(payload));

  console.log(
    `[publishing] ${result.success ? '✓' : '✗'} slug=${payload.slug} media=${result.media?.externalId ?? '—'} post=${result.post?.externalId ?? '—'}`,
  );

  if (result.message) {
    console.log(`[publishing]   ${result.message}`);
  }

  if (deps.publishedContentRepo) {
    const record = await persistPublishedContentIfSuccessful(
      payload,
      result,
      publisherDriver,
      deps.publishedContentRepo,
    );
    if (record) {
      console.log(
        `[publishing] history saved — publisher=${record.publisher} externalId=${record.externalId}`,
      );
    }
  }

  deps.metricsService?.inc('processedTotal');
  if (result.success) deps.metricsService?.inc('publishedTotal');
  if (!result.success && !result.skipped) deps.metricsService?.inc('failuresTotal');

  return result;
}
