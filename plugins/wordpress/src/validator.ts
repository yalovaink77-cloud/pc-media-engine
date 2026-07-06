/**
 * Media and post validation for WordPress publishing — Sprint 33.
 *
 * Centralises all field-level checks so they can be tested independently
 * from the HTTP layer.
 */

import type { PublishingRequest } from '@pcme/publishing';
import { PublishingValidationError } from '@pcme/publishing';

// ---------------------------------------------------------------------------
// Media validation
// ---------------------------------------------------------------------------

/**
 * MIME types accepted by the WordPress media library.
 * This is a conservative subset — add more as needed.
 */
export const ALLOWED_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'application/octet-stream', // fallback — allowed but not recommended
]);

/** Default maximum upload size: 50 MB */
export const DEFAULT_MAX_MEDIA_SIZE_BYTES = 50 * 1024 * 1024;

export type MediaValidationOptions = {
  /** Override allowed MIME type set. */
  allowedMimeTypes?: Set<string>;
  /** Maximum buffer size in bytes. Default: 50 MB. */
  maxSizeBytes?: number;
};

/**
 * Validate a media publishing request.
 * Throws `PublishingValidationError` on the first validation failure.
 */
export function validateMediaRequest(
  request: PublishingRequest,
  options: MediaValidationOptions = {},
): void {
  const {
    allowedMimeTypes = ALLOWED_MEDIA_MIME_TYPES,
    maxSizeBytes = DEFAULT_MAX_MEDIA_SIZE_BYTES,
  } = options;

  if (!request.title || request.title.trim() === '') {
    throw new PublishingValidationError('PublishingRequest.title is required for media upload');
  }
  if (!request.slug || request.slug.trim() === '') {
    throw new PublishingValidationError('PublishingRequest.slug is required for media upload');
  }

  const buffer = request.mediaBuffer;
  if (!buffer || buffer.length === 0) {
    throw new PublishingValidationError('publishMedia requires a non-empty request.mediaBuffer');
  }

  if (buffer.length > maxSizeBytes) {
    const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);
    const limitMB = (maxSizeBytes / 1024 / 1024).toFixed(0);
    throw new PublishingValidationError(
      `Media buffer size ${sizeMB} MB exceeds maximum allowed ${limitMB} MB`,
    );
  }

  const mimeType = request.mediaMimeType ?? 'application/octet-stream';
  if (!allowedMimeTypes.has(mimeType)) {
    throw new PublishingValidationError(
      `MIME type "${mimeType}" is not allowed. Allowed types: ${[...allowedMimeTypes].join(', ')}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Post validation
// ---------------------------------------------------------------------------

/**
 * Validate a post publishing request.
 * Throws `PublishingValidationError` on the first validation failure.
 */
export function validatePostRequest(request: PublishingRequest): void {
  if (!request.title || request.title.trim() === '') {
    throw new PublishingValidationError('PublishingRequest.title is required');
  }
  if (!request.slug || request.slug.trim() === '') {
    throw new PublishingValidationError('PublishingRequest.slug is required');
  }
  if (!request.body || request.body.trim() === '') {
    throw new PublishingValidationError('PublishingRequest.body is required');
  }

  // Warn-equivalent validation: slug must be URL-safe.
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugPattern.test(request.slug.trim())) {
    throw new PublishingValidationError(
      `PublishingRequest.slug "${request.slug}" is not URL-safe — use lowercase letters, digits, and hyphens only`,
    );
  }
}
