/**
 * PublishingOrchestrator — coordinates media upload + draft post creation.
 *
 * Depends only on the Publisher interface. Knows nothing about WordPress or
 * any other destination.
 *
 * Flow:
 *   publish(request) → publisher.publishMedia() → publisher.publishPost()
 *
 * Failure behaviour:
 *   - Media upload fails  → stop immediately, no draft created
 *   - Draft creation fails → return media result + post failure (error not hidden)
 */

import type { Publisher, PublishingRequest } from './publisher.js';
import { PublishingValidationError } from './publisher.js';
import type { PublishingFlowResult } from './publishing-flow-result.js';

export class PublishingOrchestrator {
  constructor(private readonly publisher: Publisher) {}

  async publish(request: PublishingRequest): Promise<PublishingFlowResult> {
    this.validateRequest(request);

    let mediaResult;
    try {
      mediaResult = await this.publisher.publishMedia(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Media upload failed';
      return { success: false, message: `Media upload failed: ${message}` };
    }

    if (!mediaResult.success) {
      return {
        success: false,
        message: mediaResult.message ?? 'Media upload failed',
      };
    }

    const media = {
      externalId: mediaResult.externalId,
      url: mediaResult.url,
    };

    const postRequest = this.buildPostRequest(request, mediaResult.externalId);

    let postResult;
    try {
      postResult = await this.publisher.publishPost(postRequest);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Draft creation failed';
      return {
        success: false,
        media,
        post: { externalId: '', url: '' },
        publishedAt: mediaResult.publishedAt,
        message: `Draft creation failed: ${message}`,
      };
    }

    if (!postResult.success) {
      return {
        success: false,
        media,
        post: { externalId: postResult.externalId, url: postResult.url },
        publishedAt: mediaResult.publishedAt,
        message: postResult.message ?? 'Draft creation failed',
      };
    }

    return {
      success: true,
      media,
      post: {
        externalId: postResult.externalId,
        url: postResult.url,
      },
      publishedAt: postResult.publishedAt,
      message: `Published media (${media.externalId}) and draft post (${postResult.externalId})`,
    };
  }

  private validateRequest(request: PublishingRequest): void {
    if (!request.title || request.title.trim() === '') {
      throw new PublishingValidationError('PublishingRequest.title is required');
    }
    if (!request.slug || request.slug.trim() === '') {
      throw new PublishingValidationError('PublishingRequest.slug is required');
    }
    if (!request.mediaBuffer || request.mediaBuffer.length === 0) {
      throw new PublishingValidationError(
        'PublishingOrchestrator requires a non-empty request.mediaBuffer',
      );
    }
    if (!request.body || request.body.trim() === '') {
      throw new PublishingValidationError(
        'PublishingOrchestrator requires a non-empty request.body',
      );
    }
  }

  private buildPostRequest(request: PublishingRequest, mediaExternalId: string): PublishingRequest {
    const featuredMediaId = Number.parseInt(mediaExternalId, 10);
    const hasNumericMediaId = !Number.isNaN(featuredMediaId) && featuredMediaId > 0;

    return {
      ...request,
      featuredAssetId: mediaExternalId,
      featuredMediaId: hasNumericMediaId ? featuredMediaId : request.featuredMediaId,
    };
  }
}
