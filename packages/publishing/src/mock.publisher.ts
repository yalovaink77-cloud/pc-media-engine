/**
 * MockPublisher — deterministic, in-process publisher for development and tests.
 *
 * Guarantees:
 *   - No network requests, ever.
 *   - Same slug always produces the same externalId and url.
 *   - publishMedia and publishPost use separate URL namespaces.
 *   - Invalid requests (missing title or slug) throw PublishingValidationError.
 *   - health() always returns { status: 'ok' }.
 */

import { createHash } from 'node:crypto';

import type { HealthResult, Publisher, PublishingRequest, PublishingResult } from './publisher.js';
import { PublishingValidationError } from './publisher.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const MOCK_BASE_URL = 'https://mock.example.com';

/** Deterministic 12-character hex ID derived from the slug. */
function deterministicId(slug: string): string {
  return createHash('sha1').update(slug).digest('hex').slice(0, 12);
}

function validateRequest(request: PublishingRequest): void {
  if (!request.title || request.title.trim() === '') {
    throw new PublishingValidationError('PublishingRequest.title is required');
  }
  if (!request.slug || request.slug.trim() === '') {
    throw new PublishingValidationError('PublishingRequest.slug is required');
  }
}

// ---------------------------------------------------------------------------
// MockPublisher
// ---------------------------------------------------------------------------

export type MockPublisherOptions = {
  /**
   * Override the base URL used for generated mock URLs.
   * Defaults to 'https://mock.example.com'.
   */
  baseUrl?: string;
};

export class MockPublisher implements Publisher {
  readonly name = 'MockPublisher';

  private readonly baseUrl: string;

  constructor(options: MockPublisherOptions = {}) {
    this.baseUrl = options.baseUrl ?? MOCK_BASE_URL;
  }

  async publishMedia(request: PublishingRequest): Promise<PublishingResult> {
    validateRequest(request);
    const id = deterministicId(request.slug);
    return {
      success: true,
      externalId: `media-${id}`,
      url: `${this.baseUrl}/media/${id}`,
      publishedAt: new Date('2024-01-01T00:00:00.000Z'),
      message: `Mock media published: ${request.title}`,
    };
  }

  async publishPost(request: PublishingRequest): Promise<PublishingResult> {
    validateRequest(request);
    const id = deterministicId(request.slug);
    return {
      success: true,
      externalId: `post-${id}`,
      url: `${this.baseUrl}/posts/${id}`,
      publishedAt: new Date('2024-01-01T00:00:00.000Z'),
      message: `Mock post published: ${request.title}`,
    };
  }

  async publish(request: PublishingRequest): Promise<PublishingResult> {
    validateRequest(request);
    // Dispatch to publishMedia when an assetId is the primary payload,
    // otherwise default to publishPost.
    if (request.assetId && !request.body) {
      return this.publishMedia(request);
    }
    return this.publishPost(request);
  }

  async health(): Promise<HealthResult> {
    return { status: 'ok' };
  }
}
