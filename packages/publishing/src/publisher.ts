/**
 * Publisher — abstract interface for all publishing destinations.
 *
 * Implementations:
 *   - MockPublisher     (development / testing — deterministic, no network)
 *   - WordPressPublisher (Sprint 14 — WordPress REST API)
 *
 * The interface is intentionally channel-agnostic. Callers pass a
 * PublishingRequest and receive a PublishingResult; the concrete publisher
 * decides how to map the request to its target platform.
 */

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

/**
 * A platform-agnostic publishing request.
 *
 * Implementors map these fields to whatever the target platform accepts.
 * Fields are intentionally optional so the same type works for media-only
 * publishes (just assetId) and full editorial posts.
 */
export type PublishingRequest = {
  /** ID of the primary asset being published. */
  assetId?: string;
  /** Human-readable title shown on the destination. */
  title: string;
  /** URL-safe identifier; used for permalink generation. Required. */
  slug: string;
  /** Short summary / teaser. */
  excerpt?: string;
  /** Full content body (HTML or Markdown, publisher-dependent). */
  body?: string;
  /** Flat list of tags. */
  tags?: string[];
  /** Hierarchical categories / taxonomies. */
  categories?: string[];
  /** ID of the asset to use as the featured / hero image. */
  featuredAssetId?: string;

  // ---- Raw media payload (for binary-upload publishers) ------------------

  /**
   * Raw binary content for publishers that upload files directly
   * (e.g. WordPressMediaPublisher → POST /wp/v2/media).
   * Text-only publishers (MockPublisher, etc.) ignore this field.
   */
  mediaBuffer?: Buffer;

  /** MIME type of the binary payload. Defaults to application/octet-stream. */
  mediaMimeType?: string;

  /** Filename sent in Content-Disposition. Defaults to request.slug. */
  mediaFilename?: string;
};

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/**
 * The outcome of a publish operation.
 */
export type PublishingResult = {
  /** Whether the publish succeeded. */
  success: boolean;
  /** Platform-assigned identifier (e.g., WordPress post ID). */
  externalId: string;
  /** Canonical public URL of the published resource. */
  url: string;
  /** When the resource was published, according to the destination. */
  publishedAt: Date;
  /** Optional human-readable status or error message. */
  message?: string;
};

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export type HealthStatus = 'ok' | 'degraded' | 'down';

export type HealthResult = {
  status: HealthStatus;
  /** Optional detail for degraded/down status. */
  message?: string;
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a PublishingRequest fails validation before it is dispatched
 * to the remote platform.
 */
export class PublishingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishingValidationError';
  }
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Publisher {
  /** Publish a media asset (image, video, etc.) to the destination. */
  publishMedia(request: PublishingRequest): Promise<PublishingResult>;

  /** Publish an editorial post (article, page, etc.) to the destination. */
  publishPost(request: PublishingRequest): Promise<PublishingResult>;

  /**
   * Publish using the most appropriate channel for the request.
   * Implementations decide whether to call publishMedia or publishPost.
   */
  publish(request: PublishingRequest): Promise<PublishingResult>;

  /**
   * Check reachability and authentication status of the destination.
   * Must not throw — return { status: 'down' } instead.
   */
  health(): Promise<HealthResult>;

  /** Human-readable identifier for logging / config inspection. */
  readonly name: string;
}
