/**
 * BullMQ job payload for the `publishing` queue.
 *
 * Media content is serialised for Redis:
 *   - mediaBuffer — base64-encoded binary
 *   - mediaData   — plain utf8 mock content (smoke/tests)
 *
 * Exactly one of mediaBuffer or mediaData must be present.
 */

import type { PublishingRequest } from '@pcme/publishing';

export type PublishingJobPayload = {
  title: string;
  slug: string;
  body: string;
  /** Scope fields for publishing history (Sprint 22). */
  organizationId?: string;
  projectId?: string;
  assetId?: string;
  processingJobId?: string;
  mediaMimeType?: string;
  mediaFilename?: string;
  /** Base64-encoded binary content. */
  mediaBuffer?: string;
  /** Plain mock media content (utf8). */
  mediaData?: string;
};

export class PublishingPayloadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishingPayloadValidationError';
  }
}

function requireNonEmptyString(obj: Record<string, unknown>, field: string): string {
  const value = obj[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PublishingPayloadValidationError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function resolveMediaBuffer(payload: PublishingJobPayload): Buffer {
  if (payload.mediaBuffer) {
    const buffer = Buffer.from(payload.mediaBuffer, 'base64');
    if (buffer.length === 0) {
      throw new PublishingPayloadValidationError('mediaBuffer must decode to non-empty content');
    }
    return buffer;
  }

  if (payload.mediaData) {
    const buffer = Buffer.from(payload.mediaData, 'utf8');
    if (buffer.length === 0) {
      throw new PublishingPayloadValidationError('mediaData must be non-empty');
    }
    return buffer;
  }

  throw new PublishingPayloadValidationError('Either mediaBuffer or mediaData must be provided');
}

/**
 * Validate and narrow unknown queue job data to `PublishingJobPayload`.
 */
export function validatePublishingJobPayload(data: unknown): PublishingJobPayload {
  if (data === null || typeof data !== 'object') {
    throw new PublishingPayloadValidationError('Payload must be a non-null object');
  }

  const obj = data as Record<string, unknown>;

  const title = requireNonEmptyString(obj, 'title');
  const slug = requireNonEmptyString(obj, 'slug');
  const body = requireNonEmptyString(obj, 'body');

  const mediaBuffer = typeof obj['mediaBuffer'] === 'string' ? obj['mediaBuffer'] : undefined;
  const mediaData = typeof obj['mediaData'] === 'string' ? obj['mediaData'] : undefined;

  if (!mediaBuffer && !mediaData) {
    throw new PublishingPayloadValidationError('Either mediaBuffer or mediaData must be provided');
  }

  if (mediaBuffer && mediaData) {
    throw new PublishingPayloadValidationError('Provide either mediaBuffer or mediaData, not both');
  }

  const payload: PublishingJobPayload = {
    title,
    slug,
    body,
    mediaBuffer,
    mediaData,
  };

  if (typeof obj['mediaMimeType'] === 'string' && obj['mediaMimeType'].trim()) {
    payload.mediaMimeType = obj['mediaMimeType'].trim();
  }
  if (typeof obj['mediaFilename'] === 'string' && obj['mediaFilename'].trim()) {
    payload.mediaFilename = obj['mediaFilename'].trim();
  }

  if (typeof obj['organizationId'] === 'string' && obj['organizationId'].trim()) {
    payload.organizationId = obj['organizationId'].trim();
  }
  if (typeof obj['projectId'] === 'string' && obj['projectId'].trim()) {
    payload.projectId = obj['projectId'].trim();
  }
  if (typeof obj['assetId'] === 'string' && obj['assetId'].trim()) {
    payload.assetId = obj['assetId'].trim();
  }
  if (typeof obj['processingJobId'] === 'string' && obj['processingJobId'].trim()) {
    payload.processingJobId = obj['processingJobId'].trim();
  }

  // Validate media resolves to non-empty buffer
  resolveMediaBuffer(payload);

  return payload;
}

/** Map a validated queue payload to a PublishingRequest for the orchestrator. */
export function toPublishingRequest(payload: PublishingJobPayload): PublishingRequest {
  return {
    title: payload.title,
    slug: payload.slug,
    body: payload.body,
    mediaBuffer: resolveMediaBuffer(payload),
    mediaMimeType: payload.mediaMimeType,
    mediaFilename: payload.mediaFilename,
  };
}

/** Serialise a Buffer for enqueueing on the publishing queue. */
export function encodeMediaBuffer(buffer: Buffer): string {
  return buffer.toString('base64');
}
