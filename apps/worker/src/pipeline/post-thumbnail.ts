import type { AiMetadataProvider } from '@pcme/ai';
import type { StorageProvider } from '@pcme/media';

import type { PublishingJobPayload } from '../queue/publishing-payload.js';
import {
  buildEnrichedPublishingPayload,
  type BuildPublishingPayloadInput,
} from './build-publishing-payload.js';

export type PublishingEnqueuer = {
  enqueue(payload: PublishingJobPayload): Promise<void>;
};

export type ThumbnailCompleteContext = {
  asset: { filename: string; storageKey: string };
  thumbnailKey: string;
};

export type PostThumbnailDeps = {
  storageProvider: Pick<StorageProvider, 'get'>;
  publishingEnqueuer: PublishingEnqueuer;
  buildPayload?: (input: BuildPublishingPayloadInput) => Promise<PublishingJobPayload>;
  aiProvider?: AiMetadataProvider;
  env?: Record<string, string | undefined>;
};

/**
 * After thumbnail generation, enrich metadata and enqueue a publishing job.
 */
export async function enqueuePublishingAfterThumbnail(
  ctx: ThumbnailCompleteContext,
  deps: PostThumbnailDeps,
): Promise<PublishingJobPayload> {
  const thumbBuffer = await deps.storageProvider.get(ctx.thumbnailKey);
  const build = deps.buildPayload ?? buildEnrichedPublishingPayload;
  const payload = await build({
    filename: ctx.asset.filename,
    thumbnailBuffer: thumbBuffer,
    thumbnailStorageKey: ctx.thumbnailKey,
    aiProvider: deps.aiProvider,
    env: deps.env,
  });
  await deps.publishingEnqueuer.enqueue(payload);
  return payload;
}
