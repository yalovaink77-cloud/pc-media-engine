import { basename, extname } from 'node:path';

import { type AiMetadataProvider, createAiMetadataEnrichmentService } from '@pcme/ai';

import { THUMBNAIL_MIME } from '../processors/thumbnail.processor.js';
import { encodeMediaBuffer, type PublishingJobPayload } from '../queue/publishing-payload.js';

export type BuildPublishingPayloadInput = {
  organizationId: string;
  projectId: string;
  assetId: string;
  processingJobId: string;
  filename: string;
  thumbnailBuffer: Buffer;
  thumbnailStorageKey: string;
  bodyHtml?: string;
  aiProvider?: AiMetadataProvider;
  env?: Record<string, string | undefined>;
};

function titleFromFilename(filename: string): string {
  const ext = extname(filename);
  const base = basename(filename, ext) || 'media';
  return base.replace(/[-_]/g, ' ').trim() || 'media';
}

/**
 * Build a publishing queue payload with deterministic + optional AI metadata enrichment.
 */
export async function buildEnrichedPublishingPayload(
  input: BuildPublishingPayloadInput,
): Promise<PublishingJobPayload> {
  const title = titleFromFilename(input.filename);
  const body = input.bodyHtml ?? `<p>Publish-ready content for ${title}.</p>`;

  const aiService = createAiMetadataEnrichmentService({
    provider: input.aiProvider,
    env: input.env,
  });

  const { metadata } = await aiService.enrich({
    title,
    body,
    image: { mimeType: THUMBNAIL_MIME },
  });

  return {
    organizationId: input.organizationId,
    projectId: input.projectId,
    assetId: input.assetId,
    processingJobId: input.processingJobId,
    title: metadata.seoTitle,
    slug: metadata.slug,
    body,
    mediaBuffer: encodeMediaBuffer(input.thumbnailBuffer),
    mediaMimeType: THUMBNAIL_MIME,
    mediaFilename: basename(input.thumbnailStorageKey),
  };
}
