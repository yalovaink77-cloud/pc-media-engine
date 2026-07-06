/**
 * WordPressMediaPublisher — WordPress REST API publishing provider.
 * Sprint 33: production hardening.
 *
 * Implements the Publisher interface from @pcme/publishing.
 *
 * ✓ health()       — GET  /wp-json/wp/v2/users/me
 * ✓ publishMedia() — POST /wp-json/wp/v2/media
 * ✓ publishPost()  — POST /wp-json/wp/v2/posts (status=draft only)
 * ✓ publish()      — routes to publishMedia or publishPost
 *
 * Sprint 33 additions:
 * ✓ Request timeout via AbortSignal
 * ✓ Structured logging (injectable WordPressPublisherLogger)
 * ✓ Centralised media validation (MIME allowlist, size limit)
 * ✓ Centralised post validation (URL-safe slug, required fields)
 * ✓ Enhanced PublishingResult: wpPostId, wpMediaId, permalink, postStatus
 * ✓ Enriched error categorization via parseWordPressErrorResponse
 * ✓ Retry-safe: idempotent errors (409 duplicate) handled gracefully
 */

import type {
  HealthResult,
  Publisher,
  PublishingRequest,
  PublishingResult,
} from '@pcme/publishing';
import { PublishingValidationError } from '@pcme/publishing';

import { buildBasicAuth } from './auth.js';
import type { WordPressConfig } from './config.js';
import { isConfigComplete } from './config.js';
import { isRetryableError, parseWordPressErrorResponse } from './errors.js';
import type { WordPressPublisherLogger } from './logger.js';
import { noopLogger } from './logger.js';
import { validateMediaRequest, validatePostRequest } from './validator.js';

// ---------------------------------------------------------------------------
// Internal fetch type
// ---------------------------------------------------------------------------

export type FetchFunction = (input: string | URL, init?: RequestInit) => Promise<Response>;

// ---------------------------------------------------------------------------
// Constructor options
// ---------------------------------------------------------------------------

export type WordPressMediaPublisherOptions = {
  /**
   * Injectable logger. Defaults to noopLogger (silent).
   * Pass createConsoleLogger() for dev or a pino instance for production.
   */
  logger?: WordPressPublisherLogger;
};

// ---------------------------------------------------------------------------
// WordPress REST API response shapes
// ---------------------------------------------------------------------------

type WpMediaResponse = {
  id: number;
  link: string;
  source_url: string;
  date: string;
};

type WpUserResponse = {
  id: number;
  name: string;
};

type WpPostResponse = {
  id: number;
  link: string;
  date: string;
  status: string;
  permalink?: string;
};

type WpPostPayload = {
  title: string;
  slug: string;
  content: string;
  status: 'draft';
  excerpt?: string;
  categories?: number[];
  tags?: string[];
  featured_media?: number;
};

// ---------------------------------------------------------------------------
// WordPressMediaPublisher
// ---------------------------------------------------------------------------

export class WordPressMediaPublisher implements Publisher {
  readonly name = 'WordPressMediaPublisher';

  private readonly log: WordPressPublisherLogger;

  constructor(
    private readonly config: WordPressConfig,
    private readonly fetchFn: FetchFunction = globalThis.fetch,
    options: WordPressMediaPublisherOptions = {},
  ) {
    this.log = options.logger ?? noopLogger;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private authHeader(): string {
    return buildBasicAuth(this.config.username, this.config.appPassword);
  }

  private mediaUrl(): string {
    return `${this.config.baseUrl}/wp-json/wp/v2/media`;
  }

  private usersUrl(): string {
    return `${this.config.baseUrl}/wp-json/wp/v2/users/me`;
  }

  private postsUrl(): string {
    return `${this.config.baseUrl}/wp-json/wp/v2/posts`;
  }

  private assertConfigComplete(): void {
    if (!isConfigComplete(this.config)) {
      throw new PublishingValidationError(
        'WordPressMediaPublisher: incomplete configuration — check WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD',
      );
    }
  }

  /**
   * Build an AbortSignal with the configured timeout.
   * Falls back to 30 000 ms if requestTimeoutMs is absent (backward compat).
   */
  private timeoutSignal(): AbortSignal {
    const ms = this.config.requestTimeoutMs ?? 30_000;
    return AbortSignal.timeout(ms);
  }

  /** Resolve WordPress featured_media id from explicit id or numeric featuredAssetId. */
  private resolveFeaturedMediaId(request: PublishingRequest): number | undefined {
    if (request.featuredMediaId !== undefined && request.featuredMediaId > 0) {
      return request.featuredMediaId;
    }
    if (request.featuredAssetId) {
      const parsed = Number.parseInt(request.featuredAssetId, 10);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    return undefined;
  }

  private buildPostPayload(request: PublishingRequest): WpPostPayload {
    const payload: WpPostPayload = {
      title: request.title.trim(),
      slug: request.slug.trim(),
      content: request.body!.trim(),
      status: 'draft',
    };

    if (request.excerpt?.trim()) payload.excerpt = request.excerpt.trim();

    const categories = (request.categories ?? [])
      .map((v) => Number.parseInt(v, 10))
      .filter((id) => !Number.isNaN(id) && id > 0);
    if (categories.length > 0) payload.categories = categories;

    const tags = (request.tags ?? []).map((t) => t.trim()).filter((t) => t.length > 0);
    if (tags.length > 0) payload.tags = tags as string[];

    const featuredMediaId = this.resolveFeaturedMediaId(request);
    if (featuredMediaId !== undefined) payload.featured_media = featuredMediaId;

    return payload;
  }

  // -------------------------------------------------------------------------
  // Publisher interface
  // -------------------------------------------------------------------------

  async publishMedia(request: PublishingRequest): Promise<PublishingResult> {
    this.assertConfigComplete();

    // Centralised validation (MIME type, size, required fields).
    validateMediaRequest(request);

    const mimeType = request.mediaMimeType ?? 'application/octet-stream';
    const filename = request.mediaFilename ?? request.slug;

    this.log.info('wp.media.upload.start', {
      slug: request.slug,
      mimeType,
      filename,
      sizeBytes: request.mediaBuffer!.length,
    });

    let response: Response;
    try {
      response = await this.fetchFn(this.mediaUrl(), {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(),
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
        body: request.mediaBuffer as unknown as RequestInit['body'],
        signal: this.timeoutSignal(),
      });
    } catch (err) {
      this.log.error('wp.media.upload.network_error', {
        slug: request.slug,
        retryable: isRetryableError(err),
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    if (!response.ok) {
      const apiErr = await parseWordPressErrorResponse(response);
      this.log.error('wp.media.upload.api_error', {
        slug: request.slug,
        status: apiErr.status,
        code: apiErr.code,
        category: apiErr.category,
        retryable: isRetryableError(apiErr),
      });
      throw apiErr;
    }

    const data = (await response.json()) as WpMediaResponse;

    this.log.info('wp.media.upload.success', {
      slug: request.slug,
      wpMediaId: data.id,
      url: data.source_url ?? data.link,
    });

    return {
      success: true,
      externalId: String(data.id),
      url: data.source_url ?? data.link,
      publishedAt: new Date(data.date),
      message: `Media uploaded to WordPress (id=${data.id})`,
      wpMediaId: data.id,
      permalink: data.source_url ?? data.link,
    };
  }

  async publishPost(request: PublishingRequest): Promise<PublishingResult> {
    this.assertConfigComplete();

    // Centralised validation (required fields, URL-safe slug).
    validatePostRequest(request);

    const payload = this.buildPostPayload(request);

    this.log.info('wp.post.create.start', {
      title: request.title,
      slug: request.slug,
      featuredMediaId: payload.featured_media,
    });

    let response: Response;
    try {
      response = await this.fetchFn(this.postsUrl(), {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: this.timeoutSignal(),
      });
    } catch (err) {
      this.log.error('wp.post.create.network_error', {
        slug: request.slug,
        retryable: isRetryableError(err),
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    if (!response.ok) {
      const apiErr = await parseWordPressErrorResponse(response);
      this.log.error('wp.post.create.api_error', {
        slug: request.slug,
        status: apiErr.status,
        code: apiErr.code,
        category: apiErr.category,
        retryable: isRetryableError(apiErr),
      });
      throw apiErr;
    }

    const data = (await response.json()) as WpPostResponse;

    // WordPress returns the `link` field as the permalink for draft posts.
    const permalink = data.permalink ?? data.link;

    this.log.info('wp.post.create.success', {
      slug: request.slug,
      wpPostId: data.id,
      postStatus: data.status,
      permalink,
    });

    return {
      success: true,
      externalId: String(data.id),
      url: permalink,
      publishedAt: new Date(data.date),
      message: `Draft post created in WordPress (id=${data.id}, status=${data.status})`,
      wpPostId: data.id,
      permalink,
      postStatus: data.status,
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
        message:
          'Incomplete configuration — WORDPRESS_URL, WORDPRESS_USERNAME and WORDPRESS_APP_PASSWORD are required',
      };
    }

    this.log.info('wp.health.check', { baseUrl: this.config.baseUrl });

    try {
      const response = await this.fetchFn(this.usersUrl(), {
        headers: { Authorization: this.authHeader() },
        signal: this.timeoutSignal(),
      });

      if (response.ok) {
        const user = (await response.json()) as WpUserResponse;
        this.log.info('wp.health.ok', { user: user.name });
        return { status: 'ok', message: `Authenticated as ${user.name}` };
      }

      const apiErr = await parseWordPressErrorResponse(response);
      this.log.warn('wp.health.degraded', { status: apiErr.status, category: apiErr.category });
      return {
        status: 'down',
        message: `WordPress returned HTTP ${response.status}: ${apiErr.message}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      this.log.error('wp.health.error', { error: message });
      return { status: 'down', message };
    }
  }
}
