/**
 * Map a successful publishing flow result to a PublishedContent row.
 *
 * Publishing failures and partial failures return null — no history row is written.
 */

import type { PublishedContentStatus } from '@pcme/database';
import type { PublishingFlowResult } from '@pcme/publishing';

import type { PublishingJobPayload } from '../queue/publishing-payload.js';
import type { PublisherDriver } from './publisher-driver.js';

export type PublishedContentWriteInput = {
  organizationId: string;
  projectId: string;
  assetId: string;
  slug: string;
  publisher: PublisherDriver;
  externalId: string;
  url: string;
  status: PublishedContentStatus;
  publishedAt: Date;
};

/** Current orchestrator always creates draft posts on success. */
export function resolvePublishedContentStatus(
  _result: PublishingFlowResult,
): PublishedContentStatus {
  return 'draft';
}

export function buildPublishedContentInput(
  payload: PublishingJobPayload,
  result: PublishingFlowResult,
  publisher: PublisherDriver,
): PublishedContentWriteInput | null {
  if (!result.success) {
    return null;
  }

  if (!result.post?.externalId || !result.post.url) {
    return null;
  }

  if (!payload.organizationId || !payload.projectId || !payload.assetId) {
    return null;
  }

  return {
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    assetId: payload.assetId,
    slug: payload.slug,
    publisher,
    externalId: result.post.externalId,
    url: result.post.url,
    status: resolvePublishedContentStatus(result),
    publishedAt: result.publishedAt ?? new Date(),
  };
}
