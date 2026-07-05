import { MockAiMetadataProvider, NoneAiMetadataProvider } from '@pcme/ai';
import { describe, expect, it } from 'vitest';

import { buildEnrichedPublishingPayload } from '../pipeline/build-publishing-payload.js';

const THUMB = Buffer.from('fake-webp-bytes');

describe('buildEnrichedPublishingPayload', () => {
  it('applies deterministic metadata enrichment', async () => {
    const payload = await buildEnrichedPublishingPayload({
      filename: 'industrial-aftercare.jpg',
      thumbnailBuffer: THUMB,
      thumbnailStorageKey: 'piercingconnect/asset1/industrial-aftercare_thumb.webp',
      aiProvider: new NoneAiMetadataProvider(),
    });

    expect(payload.slug).toBe('industrial-aftercare');
    expect(payload.title).toContain('industrial aftercare');
    expect(payload.body).toContain('Publish-ready content');
    expect(payload.mediaMimeType).toBe('image/webp');
    expect(payload.mediaFilename).toBe('industrial-aftercare_thumb.webp');
    expect(payload.mediaBuffer).toBeTruthy();
  });

  it('merges mock AI suggestions when mock provider is used', async () => {
    const payload = await buildEnrichedPublishingPayload({
      filename: 'helix-guide.jpg',
      thumbnailBuffer: THUMB,
      thumbnailStorageKey: 'piercingconnect/asset1/helix-guide_thumb.webp',
      aiProvider: new MockAiMetadataProvider(),
    });

    expect(payload.title).toMatch(/^\[AI\]/);
    expect(payload.slug).toBe('helix-guide');
  });

  it('uses none provider by default via env', async () => {
    const payload = await buildEnrichedPublishingPayload({
      filename: 'lobe-care.jpg',
      thumbnailBuffer: THUMB,
      thumbnailStorageKey: 'piercingconnect/asset1/lobe-care_thumb.webp',
      env: { AI_METADATA_PROVIDER: 'none' },
    });

    expect(payload.title).not.toMatch(/^\[AI\]/);
  });
});
