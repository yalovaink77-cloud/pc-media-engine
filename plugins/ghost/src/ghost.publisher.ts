/**
 * GhostPublisher — Ghost Admin API publishing provider — Sprint 35.
 *
 * Implements PublisherProvider from @pcme/publisher-sdk.
 *
 * ✓ health()       — GET  /ghost/api/admin/site/
 * ✓ publishMedia() — POST /ghost/api/admin/images/upload/
 * ✓ publishPost()  — POST /ghost/api/admin/posts/?source=html (status=draft)
 * ✓ publish()      — routes to publishMedia or publishPost
 */

import type { PublisherProvider } from '@pcme/publisher-sdk';
import { createTimeoutSignal } from '@pcme/publisher-sdk';
import type { HealthResult, PublishingRequest, PublishingResult } from '@pcme/publishing';
import { PublishingValidationError } from '@pcme/publishing';

import { buildGhostAuthHeader } from './auth.js';
import type { GhostConfig } from './config.js';
import { isConfigComplete } from './config.js';
import { GhostApiError, isRetryableError, parseGhostErrorResponse } from './errors.js';
import type { GhostPublisherLogger } from './logger.js';
import { noopLogger } from './logger.js';
import { GHOST_CAPABILITIES, GHOST_METADATA } from './registration.js';
import { isFeatureImageUrl, validateMediaRequest, validatePostRequest } from './validator.js';

export type FetchFunction = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type GhostPublisherOptions = {
  logger?: GhostPublisherLogger;
};

type GhostSiteResponse = {
  site?: { title?: string; url?: string };
};

type GhostImageResponse = {
  images?: Array<{ url?: string }>;
};

type GhostPostRecord = {
  id?: string;
  uuid?: string;
  url?: string;
  slug?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type GhostPostResponse = {
  posts?: GhostPostRecord[];
};

type GhostPostPayload = {
  title: string;
  slug: string;
  html: string;
  status: 'draft';
  excerpt?: string;
  tags?: Array<{ name: string }>;
  feature_image?: string;
};

export class GhostPublisher implements PublisherProvider {
  readonly name = 'GhostPublisher';

  private readonly log: GhostPublisherLogger;

  constructor(
    private readonly config: GhostConfig,
    private readonly fetchFn: FetchFunction = globalThis.fetch,
    options: GhostPublisherOptions = {},
  ) {
    this.log = options.logger ?? noopLogger;
  }

  private authHeader(): string {
    return buildGhostAuthHeader(this.config.adminApiKey);
  }

  private adminUrl(path: string): string {
    return `${this.config.baseUrl}/ghost/api/admin${path}`;
  }

  private timeoutSignal(): AbortSignal {
    return createTimeoutSignal(this.config.requestTimeoutMs ?? 30_000);
  }

  private assertConfigComplete(): void {
    if (!isConfigComplete(this.config)) {
      throw new PublishingValidationError(
        'GhostPublisher: incomplete configuration — check GHOST_URL and GHOST_ADMIN_API_KEY',
      );
    }
  }

  private resolveFeatureImageUrl(request: PublishingRequest): string | undefined {
    if (request.featuredAssetId && isFeatureImageUrl(request.featuredAssetId)) {
      return request.featuredAssetId;
    }
    return undefined;
  }

  private buildPostPayload(request: PublishingRequest): GhostPostPayload {
    const payload: GhostPostPayload = {
      title: request.title.trim(),
      slug: request.slug.trim(),
      html: request.body!.trim(),
      status: 'draft',
    };

    if (request.excerpt?.trim()) payload.excerpt = request.excerpt.trim();

    const tags = (request.tags ?? []).map((t) => t.trim()).filter((t) => t.length > 0);
    if (tags.length > 0) payload.tags = tags.map((name) => ({ name }));

    const featureImage = this.resolveFeatureImageUrl(request);
    if (featureImage) payload.feature_image = featureImage;

    return payload;
  }

  getMetadata() {
    return GHOST_METADATA;
  }

  getCapabilities() {
    return GHOST_CAPABILITIES;
  }

  async publishMedia(request: PublishingRequest): Promise<PublishingResult> {
    this.assertConfigComplete();
    validateMediaRequest(request);

    const mimeType = request.mediaMimeType ?? 'image/jpeg';
    const filename = request.mediaFilename ?? `${request.slug}.jpg`;

    this.log.info('ghost.image.upload.start', {
      slug: request.slug,
      mimeType,
      filename,
      sizeBytes: request.mediaBuffer!.length,
    });

    const form = new FormData();
    form.append('file', new Blob([request.mediaBuffer!], { type: mimeType }), filename);

    let response: Response;
    try {
      response = await this.fetchFn(this.adminUrl('/images/upload/'), {
        method: 'POST',
        headers: { Authorization: this.authHeader() },
        body: form,
        signal: this.timeoutSignal(),
      });
    } catch (err) {
      this.log.error('ghost.image.upload.network_error', {
        slug: request.slug,
        retryable: isRetryableError(err),
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    if (!response.ok) {
      const apiErr = await parseGhostErrorResponse(response);
      this.log.error('ghost.image.upload.api_error', {
        slug: request.slug,
        status: apiErr.status,
        code: apiErr.code,
        category: apiErr.category,
        retryable: isRetryableError(apiErr),
      });
      throw apiErr;
    }

    const data = (await response.json()) as GhostImageResponse;
    const imageUrl = data.images?.[0]?.url;
    if (!imageUrl) {
      throw new GhostApiError(500, 'invalid_response', 'Ghost image upload returned no URL');
    }

    this.log.info('ghost.image.upload.success', { slug: request.slug, url: imageUrl });

    return {
      success: true,
      externalId: imageUrl,
      url: imageUrl,
      publishedAt: new Date(),
      message: `Image uploaded to Ghost`,
      permalink: imageUrl,
    };
  }

  async publishPost(request: PublishingRequest): Promise<PublishingResult> {
    this.assertConfigComplete();
    validatePostRequest(request);

    const post = this.buildPostPayload(request);

    this.log.info('ghost.post.create.start', {
      title: request.title,
      slug: request.slug,
      hasFeatureImage: Boolean(post.feature_image),
      tagCount: post.tags?.length ?? 0,
    });

    let response: Response;
    try {
      response = await this.fetchFn(this.adminUrl('/posts/?source=html'), {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ posts: [post] }),
        signal: this.timeoutSignal(),
      });
    } catch (err) {
      this.log.error('ghost.post.create.network_error', {
        slug: request.slug,
        retryable: isRetryableError(err),
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    if (!response.ok) {
      const apiErr = await parseGhostErrorResponse(response);
      this.log.error('ghost.post.create.api_error', {
        slug: request.slug,
        status: apiErr.status,
        code: apiErr.code,
        category: apiErr.category,
        retryable: isRetryableError(apiErr),
      });
      throw apiErr;
    }

    const data = (await response.json()) as GhostPostResponse;
    const created = data.posts?.[0];
    if (!created?.id || !created.url) {
      throw new GhostApiError(
        500,
        'invalid_response',
        'Ghost post creation returned incomplete data',
      );
    }

    const publishedAt = new Date(created.created_at ?? created.updated_at ?? Date.now());

    this.log.info('ghost.post.create.success', {
      slug: request.slug,
      ghostPostId: created.id,
      postStatus: created.status,
      url: created.url,
    });

    return {
      success: true,
      externalId: created.id,
      url: created.url,
      publishedAt,
      message: `Draft post created in Ghost (id=${created.id}, status=${created.status ?? 'draft'})`,
      permalink: created.url,
      postStatus: created.status ?? 'draft',
    };
  }

  async publish(request: PublishingRequest): Promise<PublishingResult> {
    if (request.mediaBuffer) {
      return this.publishMedia(request);
    }
    return this.publishPost(request);
  }

  async health(): Promise<HealthResult> {
    if (!isConfigComplete(this.config)) {
      return {
        status: 'down',
        message: 'Incomplete configuration — GHOST_URL and GHOST_ADMIN_API_KEY are required',
      };
    }

    this.log.info('ghost.health.check', { baseUrl: this.config.baseUrl });

    try {
      const response = await this.fetchFn(this.adminUrl('/site/'), {
        headers: { Authorization: this.authHeader() },
        signal: this.timeoutSignal(),
      });

      if (response.ok) {
        const data = (await response.json()) as GhostSiteResponse;
        const title = data.site?.title ?? 'Ghost site';
        this.log.info('ghost.health.ok', { site: title });
        return { status: 'ok', message: `Connected to Ghost site "${title}"` };
      }

      const apiErr = await parseGhostErrorResponse(response);
      this.log.warn('ghost.health.degraded', { status: apiErr.status, category: apiErr.category });
      return {
        status: 'down',
        message: `Ghost returned HTTP ${response.status}: ${apiErr.message}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      this.log.error('ghost.health.error', { error: message });
      return { status: 'down', message };
    }
  }
}
