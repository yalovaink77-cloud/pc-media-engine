/**
 * Tests for Sprint 33 media and post validators.
 */

import { PublishingValidationError } from '@pcme/publishing';
import { describe, expect, it } from 'vitest';

import {
  ALLOWED_MEDIA_MIME_TYPES,
  DEFAULT_MAX_MEDIA_SIZE_BYTES,
  validateMediaRequest,
  validatePostRequest,
} from '../validator.js';

// ---------------------------------------------------------------------------
// validateMediaRequest
// ---------------------------------------------------------------------------

const VALID_MEDIA = {
  title: 'Photo Title',
  slug: 'photo-title',
  mediaMimeType: 'image/jpeg',
  mediaBuffer: Buffer.from('fake-jpeg'),
};

describe('validateMediaRequest', () => {
  it('passes for a valid media request', () => {
    expect(() => validateMediaRequest(VALID_MEDIA)).not.toThrow();
  });

  it('throws when title is missing', () => {
    expect(() => validateMediaRequest({ ...VALID_MEDIA, title: '' })).toThrow(
      PublishingValidationError,
    );
  });

  it('throws when title is whitespace-only', () => {
    expect(() => validateMediaRequest({ ...VALID_MEDIA, title: '   ' })).toThrow(
      PublishingValidationError,
    );
  });

  it('throws when slug is missing', () => {
    expect(() => validateMediaRequest({ ...VALID_MEDIA, slug: '' })).toThrow(
      PublishingValidationError,
    );
  });

  it('throws when mediaBuffer is absent', () => {
    expect(() => validateMediaRequest({ ...VALID_MEDIA, mediaBuffer: undefined })).toThrow(
      PublishingValidationError,
    );
  });

  it('throws when mediaBuffer is empty', () => {
    expect(() => validateMediaRequest({ ...VALID_MEDIA, mediaBuffer: Buffer.alloc(0) })).toThrow(
      PublishingValidationError,
    );
  });

  it('throws when MIME type is not in allowlist', () => {
    expect(() => validateMediaRequest({ ...VALID_MEDIA, mediaMimeType: 'text/html' })).toThrow(
      PublishingValidationError,
    );
  });

  it('throws when buffer exceeds max size', () => {
    const oversized = Buffer.alloc(DEFAULT_MAX_MEDIA_SIZE_BYTES + 1);
    expect(() => validateMediaRequest({ ...VALID_MEDIA, mediaBuffer: oversized })).toThrow(
      PublishingValidationError,
    );
  });

  it('accepts image/jpeg', () => {
    expect(() =>
      validateMediaRequest({ ...VALID_MEDIA, mediaMimeType: 'image/jpeg' }),
    ).not.toThrow();
  });

  it('accepts image/png', () => {
    expect(() =>
      validateMediaRequest({ ...VALID_MEDIA, mediaMimeType: 'image/png' }),
    ).not.toThrow();
  });

  it('accepts image/webp', () => {
    expect(() =>
      validateMediaRequest({ ...VALID_MEDIA, mediaMimeType: 'image/webp' }),
    ).not.toThrow();
  });

  it('accepts video/mp4', () => {
    expect(() =>
      validateMediaRequest({ ...VALID_MEDIA, mediaMimeType: 'video/mp4' }),
    ).not.toThrow();
  });

  it('accepts a custom allowlist override', () => {
    expect(() =>
      validateMediaRequest(
        { ...VALID_MEDIA, mediaMimeType: 'text/plain' },
        { allowedMimeTypes: new Set(['text/plain']) },
      ),
    ).not.toThrow();
  });

  it('accepts a custom max size override', () => {
    const small = Buffer.alloc(10);
    expect(() =>
      validateMediaRequest({ ...VALID_MEDIA, mediaBuffer: small }, { maxSizeBytes: 5 }),
    ).toThrow(PublishingValidationError);
  });

  it('ALLOWED_MEDIA_MIME_TYPES includes common image types', () => {
    expect(ALLOWED_MEDIA_MIME_TYPES.has('image/jpeg')).toBe(true);
    expect(ALLOWED_MEDIA_MIME_TYPES.has('image/png')).toBe(true);
    expect(ALLOWED_MEDIA_MIME_TYPES.has('image/webp')).toBe(true);
  });

  it('DEFAULT_MAX_MEDIA_SIZE_BYTES is 50 MB', () => {
    expect(DEFAULT_MAX_MEDIA_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });
});

// ---------------------------------------------------------------------------
// validatePostRequest
// ---------------------------------------------------------------------------

const VALID_POST = {
  title: 'Aftercare Guide',
  slug: 'aftercare-guide',
  body: '<p>Content here.</p>',
};

describe('validatePostRequest', () => {
  it('passes for a valid post request', () => {
    expect(() => validatePostRequest(VALID_POST)).not.toThrow();
  });

  it('throws when title is missing', () => {
    expect(() => validatePostRequest({ ...VALID_POST, title: '' })).toThrow(
      PublishingValidationError,
    );
  });

  it('throws when slug is missing', () => {
    expect(() => validatePostRequest({ ...VALID_POST, slug: '' })).toThrow(
      PublishingValidationError,
    );
  });

  it('throws when body is missing', () => {
    expect(() => validatePostRequest({ ...VALID_POST, body: '' })).toThrow(
      PublishingValidationError,
    );
  });

  it('throws when body is whitespace-only', () => {
    expect(() => validatePostRequest({ ...VALID_POST, body: '   ' })).toThrow(
      PublishingValidationError,
    );
  });

  it('throws when slug is not URL-safe', () => {
    expect(() => validatePostRequest({ ...VALID_POST, slug: 'My Post Title!' })).toThrow(
      PublishingValidationError,
    );
  });

  it('accepts slug with hyphens and digits', () => {
    expect(() =>
      validatePostRequest({ ...VALID_POST, slug: 'guide-2024-aftercare' }),
    ).not.toThrow();
  });

  it('throws for slug with uppercase letters', () => {
    expect(() => validatePostRequest({ ...VALID_POST, slug: 'Aftercare-Guide' })).toThrow(
      PublishingValidationError,
    );
  });
});
