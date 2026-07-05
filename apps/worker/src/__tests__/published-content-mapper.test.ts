import type { PublishingFlowResult } from '@pcme/publishing';
import { describe, expect, it } from 'vitest';

import { buildPublishedContentInput } from '../publishing/published-content-mapper.js';
import type { PublishingJobPayload } from '../queue/publishing-payload.js';

const SCOPED_PAYLOAD: PublishingJobPayload = {
  title: 'Aftercare Guide',
  slug: 'aftercare-guide',
  body: '<p>Clean twice daily.</p>',
  mediaData: 'mock-image-bytes',
  organizationId: 'org-1',
  projectId: 'proj-1',
  assetId: 'asset-1',
  processingJobId: 'job-1',
};

describe('buildPublishedContentInput', () => {
  it('maps a successful mock result to a draft history row', () => {
    const result: PublishingFlowResult = {
      success: true,
      media: { externalId: 'media-1', url: 'https://mock/media/1' },
      post: { externalId: 'post-1', url: 'https://mock/posts/1' },
      publishedAt: new Date('2026-07-05T12:00:00.000Z'),
    };

    const input = buildPublishedContentInput(SCOPED_PAYLOAD, result, 'mock');

    expect(input).toEqual({
      organizationId: 'org-1',
      projectId: 'proj-1',
      assetId: 'asset-1',
      publisher: 'mock',
      externalId: 'post-1',
      url: 'https://mock/posts/1',
      status: 'draft',
      publishedAt: result.publishedAt,
    });
  });

  it('maps a successful wordpress result', () => {
    const result: PublishingFlowResult = {
      success: true,
      media: { externalId: '42', url: 'https://wp/media/42' },
      post: { externalId: '99', url: 'https://wp/posts/99' },
      publishedAt: new Date('2026-07-05T12:00:00.000Z'),
    };

    const input = buildPublishedContentInput(SCOPED_PAYLOAD, result, 'wordpress');

    expect(input?.publisher).toBe('wordpress');
    expect(input?.externalId).toBe('99');
  });

  it('returns null when publishing failed', () => {
    const result: PublishingFlowResult = {
      success: false,
      message: 'Media upload failed: quota exceeded',
    };

    expect(buildPublishedContentInput(SCOPED_PAYLOAD, result, 'mock')).toBeNull();
  });

  it('returns null when draft creation failed after media upload', () => {
    const result: PublishingFlowResult = {
      success: false,
      media: { externalId: '42', url: 'https://mock/media/42' },
      post: { externalId: '', url: '' },
      message: 'Draft creation failed: invalid category',
    };

    expect(buildPublishedContentInput(SCOPED_PAYLOAD, result, 'mock')).toBeNull();
  });

  it('returns null when scope fields are missing from payload', () => {
    const result: PublishingFlowResult = {
      success: true,
      post: { externalId: 'post-1', url: 'https://mock/posts/1' },
    };

    expect(
      buildPublishedContentInput(
        { title: 't', slug: 's', body: 'b', mediaData: 'x' },
        result,
        'mock',
      ),
    ).toBeNull();
  });
});
