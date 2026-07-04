/**
 * WordPressMediaPublisher — uploads binary media to the WordPress REST API.
 *
 * Implements the Publisher interface from @pcme/publishing.
 *
 * Sprint scope (Sprint 14):
 *   ✓ health()       — GET  /wp-json/wp/v2/users/me
 *   ✓ publishMedia() — POST /wp-json/wp/v2/media
 *   ✗ publishPost()  — deferred to Sprint 15
 *   ✗ publish()      — defers to publishMedia when mediaBuffer present
 *
 * HTTP client:
 *   Uses the standard Fetch API. Pass a custom fetchFn to the constructor for
 *   testing (dependency injection) — no monkey-patching of globals required.
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
import { WordPressApiError } from './errors.js';

// ---------------------------------------------------------------------------
// Internal fetch type
// ---------------------------------------------------------------------------

export type FetchFunction = (input: string | URL, init?: RequestInit) => Promise<Response>;

// ---------------------------------------------------------------------------
// WordPress REST API response shapes
// ---------------------------------------------------------------------------

type WpMediaResponse = {
  id: number;
  link: string;
  source_url: string;
  date: string;
};

type WpErrorResponse = {
  code?: string;
  message?: string;
  data?: { status?: number };
};

type WpUserResponse = {
  id: number;
  name: string;
};

// ---------------------------------------------------------------------------
// WordPressMediaPublisher
// ---------------------------------------------------------------------------

export class WordPressMediaPublisher implements Publisher {
  readonly name = 'WordPressMediaPublisher';

  constructor(
    private readonly config: WordPressConfig,
    private readonly fetchFn: FetchFunction = globalThis.fetch,
  ) {}

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

  private async parseErrorResponse(response: Response): Promise<WordPressApiError> {
    let code = 'unknown';
    let message = `WordPress returned HTTP ${response.status}`;
    try {
      const body = (await response.json()) as Partial<WpErrorResponse>;
      if (body.code) code = body.code;
      if (body.message) message = body.message;
    } catch {
      // unparseable body — keep defaults
    }
    return new WordPressApiError(response.status, code, message);
  }

  // -------------------------------------------------------------------------
  // Publisher interface
  // -------------------------------------------------------------------------

  async publishMedia(request: PublishingRequest): Promise<PublishingResult> {
    if (!isConfigComplete(this.config)) {
      throw new PublishingValidationError(
        'WordPressMediaPublisher: incomplete configuration — check WORDPRESS_BASE_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD',
      );
    }

    if (!request.title || request.title.trim() === '') {
      throw new PublishingValidationError('PublishingRequest.title is required');
    }
    if (!request.slug || request.slug.trim() === '') {
      throw new PublishingValidationError('PublishingRequest.slug is required');
    }

    const buffer = request.mediaBuffer;
    if (!buffer || buffer.length === 0) {
      throw new PublishingValidationError('publishMedia requires a non-empty request.mediaBuffer');
    }

    const mimeType = request.mediaMimeType ?? 'application/octet-stream';
    const filename = request.mediaFilename ?? `${request.slug}`;

    const response = await this.fetchFn(this.mediaUrl(), {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: buffer as unknown as RequestInit['body'],
    });

    if (!response.ok) {
      throw await this.parseErrorResponse(response);
    }

    const data = (await response.json()) as WpMediaResponse;

    return {
      success: true,
      externalId: String(data.id),
      url: data.source_url ?? data.link,
      publishedAt: new Date(data.date),
      message: `Media uploaded to WordPress (id=${data.id})`,
    };
  }

  async publishPost(_request: PublishingRequest): Promise<PublishingResult> {
    throw new Error('WordPress post creation is not implemented — deferred to Sprint 15');
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
          'Incomplete configuration — WORDPRESS_BASE_URL, WORDPRESS_USERNAME and WORDPRESS_APP_PASSWORD are required',
      };
    }

    try {
      const response = await this.fetchFn(this.usersUrl(), {
        headers: { Authorization: this.authHeader() },
      });

      if (response.ok) {
        const user = (await response.json()) as WpUserResponse;
        return { status: 'ok', message: `Authenticated as ${user.name}` };
      }

      return {
        status: 'down',
        message: `WordPress returned HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        status: 'down',
        message: err instanceof Error ? err.message : 'Network error',
      };
    }
  }
}
