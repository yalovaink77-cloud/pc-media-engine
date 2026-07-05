import { describe, expect, it } from 'vitest';

import {
  encodeMediaBuffer,
  PublishingPayloadValidationError,
  toPublishingRequest,
  validatePublishingJobPayload,
} from '../queue/publishing-payload.js';

const VALID_PAYLOAD = {
  title: 'Aftercare Guide',
  slug: 'aftercare-guide',
  body: '<p>Clean twice daily.</p>',
  mediaData: 'mock-image-bytes',
  mediaMimeType: 'image/jpeg',
  mediaFilename: 'aftercare.jpg',
};

describe('validatePublishingJobPayload', () => {
  it('accepts a valid payload with mediaData', () => {
    const result = validatePublishingJobPayload(VALID_PAYLOAD);
    expect(result.title).toBe('Aftercare Guide');
    expect(result.mediaData).toBe('mock-image-bytes');
  });

  it('accepts a valid payload with base64 mediaBuffer', () => {
    const buffer = Buffer.from('jpeg-bytes');
    const result = validatePublishingJobPayload({
      title: 'Photo',
      slug: 'photo',
      body: '<p>Body</p>',
      mediaBuffer: encodeMediaBuffer(buffer),
    });
    expect(result.mediaBuffer).toBe(buffer.toString('base64'));
  });

  it('rejects null', () => {
    expect(() => validatePublishingJobPayload(null)).toThrow(PublishingPayloadValidationError);
  });

  it('rejects missing title', () => {
    expect(() => validatePublishingJobPayload({ slug: 's', body: 'b', mediaData: 'x' })).toThrow(
      PublishingPayloadValidationError,
    );
  });

  it('rejects missing slug', () => {
    expect(() => validatePublishingJobPayload({ title: 't', body: 'b', mediaData: 'x' })).toThrow(
      PublishingPayloadValidationError,
    );
  });

  it('rejects missing body', () => {
    expect(() => validatePublishingJobPayload({ title: 't', slug: 's', mediaData: 'x' })).toThrow(
      PublishingPayloadValidationError,
    );
  });

  it('rejects when neither mediaBuffer nor mediaData is provided', () => {
    expect(() => validatePublishingJobPayload({ title: 't', slug: 's', body: 'b' })).toThrow(
      PublishingPayloadValidationError,
    );
  });

  it('rejects when both mediaBuffer and mediaData are provided', () => {
    expect(() =>
      validatePublishingJobPayload({
        title: 't',
        slug: 's',
        body: 'b',
        mediaData: 'x',
        mediaBuffer: 'eQ==',
      }),
    ).toThrow(PublishingPayloadValidationError);
  });

  it('rejects empty mediaData', () => {
    expect(() =>
      validatePublishingJobPayload({ title: 't', slug: 's', body: 'b', mediaData: '' }),
    ).toThrow(PublishingPayloadValidationError);
  });
});

describe('toPublishingRequest', () => {
  it('maps mediaData to a Buffer', () => {
    const payload = validatePublishingJobPayload(VALID_PAYLOAD);
    const request = toPublishingRequest(payload);
    expect(request.mediaBuffer?.toString('utf8')).toBe('mock-image-bytes');
    expect(request.title).toBe('Aftercare Guide');
    expect(request.mediaMimeType).toBe('image/jpeg');
  });
});
