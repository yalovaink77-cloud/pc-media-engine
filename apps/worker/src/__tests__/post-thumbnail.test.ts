import { MockAiMetadataProvider } from '@pcme/ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enqueuePublishingAfterThumbnail } from '../pipeline/post-thumbnail.js';

describe('enqueuePublishingAfterThumbnail', () => {
  const thumbBuffer = Buffer.from('webp-thumb');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues enriched payload to publishing queue', async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const payload = await enqueuePublishingAfterThumbnail(
      {
        organizationId: 'org-001',
        projectId: 'proj-001',
        assetId: 'asset-001',
        processingJobId: 'job-001',
        asset: { filename: 'smoke-test.jpg', storageKey: 'proj/id/smoke-test.jpg' },
        thumbnailKey: 'proj/id/smoke-test_thumb.webp',
      },
      {
        storageProvider: { get: vi.fn().mockResolvedValue(thumbBuffer) },
        publishingEnqueuer: { enqueue },
        aiProvider: new MockAiMetadataProvider(),
      },
    );

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(payload);
    expect(payload.title).toMatch(/^\[AI\]/);
    expect(payload.mediaBuffer).toBeTruthy();
  });
});
