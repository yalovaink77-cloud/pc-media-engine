/**
 * Request validation for Ghost publishing — Sprint 35.
 */

import type { PublishingRequest } from '@pcme/publishing';
import { PublishingValidationError } from '@pcme/publishing';

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export const DEFAULT_MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export function validateMediaRequest(request: PublishingRequest): void {
  if (!request.title?.trim()) {
    throw new PublishingValidationError('PublishingRequest.title is required for image upload');
  }
  if (!request.slug?.trim()) {
    throw new PublishingValidationError('PublishingRequest.slug is required for image upload');
  }

  const buffer = request.mediaBuffer;
  if (!buffer || buffer.length === 0) {
    throw new PublishingValidationError('publishMedia requires a non-empty request.mediaBuffer');
  }

  if (buffer.length > DEFAULT_MAX_IMAGE_SIZE_BYTES) {
    throw new PublishingValidationError(
      `Image size ${(buffer.length / 1024 / 1024).toFixed(1)} MB exceeds Ghost limit of 10 MB`,
    );
  }

  const mimeType = request.mediaMimeType ?? 'application/octet-stream';
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new PublishingValidationError(
      `MIME type "${mimeType}" is not allowed for Ghost image upload`,
    );
  }
}

export function validatePostRequest(request: PublishingRequest): void {
  if (!request.title?.trim()) {
    throw new PublishingValidationError('PublishingRequest.title is required');
  }
  if (!request.slug?.trim()) {
    throw new PublishingValidationError('PublishingRequest.slug is required');
  }
  if (!request.body?.trim()) {
    throw new PublishingValidationError('PublishingRequest.body is required (HTML content)');
  }

  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugPattern.test(request.slug.trim())) {
    throw new PublishingValidationError(`PublishingRequest.slug "${request.slug}" is not URL-safe`);
  }
}

/** Return true when the value looks like an absolute image URL. */
export function isFeatureImageUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
