import type { PublishingFlowResult } from '@pcme/publishing';
import { MockPublisher, PublishingOrchestrator } from '@pcme/publishing';
import { describe, expect, it, vi } from 'vitest';

import { processPublishingJob } from '../processors/publishing.processor.js';
import type { PublishingJobPayload } from '../queue/publishing-payload.js';

const VALID_PAYLOAD: PublishingJobPayload = {
  title: 'Aftercare Guide',
  slug: 'aftercare-guide',
  body: '<p>Clean twice daily.</p>',
  mediaData: 'mock-image-bytes',
  mediaMimeType: 'image/jpeg',
  mediaFilename: 'aftercare.jpg',
};

describe('processPublishingJob — happy path', () => {
  it('returns combined media and post result using MockPublisher', async () => {
    const result = await processPublishingJob(VALID_PAYLOAD, { publisherDriver: 'mock' });

    expect(result.success).toBe(true);
    expect(result.media?.externalId).toMatch(/^media-/);
    expect(result.post?.externalId).toMatch(/^post-/);
    expect(result.media?.url).toContain('/media/');
    expect(result.post?.url).toContain('/posts/');
  });
});

describe('processPublishingJob — orchestrator invocation', () => {
  it('calls orchestrator.publish exactly once', async () => {
    const publish = vi.fn().mockResolvedValue({
      success: true,
      media: { externalId: 'm1', url: 'https://mock/media/m1' },
      post: { externalId: 'p1', url: 'https://mock/posts/p1' },
      publishedAt: new Date(),
      message: 'ok',
    } satisfies PublishingFlowResult);

    const orchestrator = { publish } as unknown as PublishingOrchestrator;

    await processPublishingJob(VALID_PAYLOAD, {
      createOrchestrator: () => orchestrator,
    });

    expect(publish).toHaveBeenCalledOnce();
    expect(publish.mock.calls[0]![0].slug).toBe('aftercare-guide');
    expect(publish.mock.calls[0]![0].mediaBuffer?.toString('utf8')).toBe('mock-image-bytes');
  });

  it('uses MockPublisher when publisherDriver is mock', async () => {
    const createPublisherFn = vi.fn(() => new MockPublisher());
    await processPublishingJob(VALID_PAYLOAD, {
      publisherDriver: 'mock',
      createPublisher: createPublisherFn,
    });
    expect(createPublisherFn).toHaveBeenCalledOnce();
  });

  it('uses injected publisher when wordpress driver is selected', async () => {
    const fakePublisher = {
      name: 'FakeWordPress',
      publishMedia: vi.fn().mockResolvedValue({
        success: true,
        externalId: '42',
        url: 'https://wp/media/42',
        publishedAt: new Date(),
      }),
      publishPost: vi.fn().mockResolvedValue({
        success: true,
        externalId: '99',
        url: 'https://wp/posts/99',
        publishedAt: new Date(),
      }),
      publish: vi.fn(),
      health: vi.fn(),
    };

    const result = await processPublishingJob(VALID_PAYLOAD, {
      createPublisher: () => fakePublisher,
    });

    expect(fakePublisher.publishMedia).toHaveBeenCalledOnce();
    expect(fakePublisher.publishPost).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(result.media?.externalId).toBe('42');
    expect(result.post?.externalId).toBe('99');
  });
});

describe('processPublishingJob — media failure', () => {
  it('returns media failure without post result', async () => {
    const orchestrator = {
      publish: vi.fn().mockResolvedValue({
        success: false,
        message: 'Media upload failed: quota exceeded',
      } satisfies PublishingFlowResult),
    } as unknown as PublishingOrchestrator;

    const result = await processPublishingJob(VALID_PAYLOAD, {
      createOrchestrator: () => orchestrator,
    });

    expect(result.success).toBe(false);
    expect(result.media).toBeUndefined();
    expect(result.message).toContain('Media upload failed');
  });
});

describe('processPublishingJob — draft failure', () => {
  it('returns media result and draft failure', async () => {
    const orchestrator = {
      publish: vi.fn().mockResolvedValue({
        success: false,
        media: { externalId: '42', url: 'https://mock/media/42' },
        post: { externalId: '', url: '' },
        publishedAt: new Date('2024-06-01T00:00:00.000Z'),
        message: 'Draft creation failed: invalid category',
      } satisfies PublishingFlowResult),
    } as unknown as PublishingOrchestrator;

    const result = await processPublishingJob(VALID_PAYLOAD, {
      createOrchestrator: () => orchestrator,
    });

    expect(result.success).toBe(false);
    expect(result.media?.externalId).toBe('42');
    expect(result.message).toContain('Draft creation failed');
  });
});

describe('processPublishingJob — invalid payload', () => {
  it('propagates orchestrator validation errors', async () => {
    await expect(processPublishingJob({ ...VALID_PAYLOAD, body: '' })).rejects.toThrow(/body/);
  });
});

const SCOPED_PAYLOAD: PublishingJobPayload = {
  ...VALID_PAYLOAD,
  organizationId: 'org-1',
  projectId: 'proj-1',
  assetId: 'asset-1',
  processingJobId: 'job-1',
};

describe('processPublishingJob — publishing history (Sprint 22)', () => {
  it('persists PublishedContent after successful MockPublisher flow', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'pub-1',
      publisher: 'mock',
      externalId: 'post-abc',
      url: 'https://mock/posts/abc',
      status: 'draft',
      publishedAt: new Date(),
    });
    const findDuplicate = vi.fn().mockResolvedValue(null);

    await processPublishingJob(SCOPED_PAYLOAD, {
      publisherDriver: 'mock',
      publishedContentRepo: { create, findDuplicate },
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0]).toMatchObject({
      organizationId: 'org-1',
      projectId: 'proj-1',
      assetId: 'asset-1',
      slug: 'aftercare-guide',
      publisher: 'mock',
      status: 'draft',
    });
    expect(create.mock.calls[0]![0].externalId).toMatch(/^post-/);
  });

  it('persists PublishedContent when wordpress publisher succeeds (mocked)', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'pub-wp' });
    const findDuplicate = vi.fn().mockResolvedValue(null);
    const fakePublisher = {
      name: 'FakeWordPress',
      publishMedia: vi.fn().mockResolvedValue({
        success: true,
        externalId: '42',
        url: 'https://wp/media/42',
        publishedAt: new Date(),
      }),
      publishPost: vi.fn().mockResolvedValue({
        success: true,
        externalId: '99',
        url: 'https://wp/posts/99',
        publishedAt: new Date(),
      }),
      publish: vi.fn(),
      health: vi.fn(),
    };

    await processPublishingJob(SCOPED_PAYLOAD, {
      publisherDriver: 'wordpress',
      createPublisher: () => fakePublisher,
      publishedContentRepo: { create, findDuplicate },
    });

    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]![0]).toMatchObject({
      publisher: 'wordpress',
      externalId: '99',
      url: 'https://wp/posts/99',
      status: 'draft',
    });
  });

  it('does not persist PublishedContent when publishing fails', async () => {
    const create = vi.fn();
    const findDuplicate = vi.fn().mockResolvedValue(null);
    const orchestrator = {
      publish: vi.fn().mockResolvedValue({
        success: false,
        message: 'Media upload failed: quota exceeded',
      } satisfies PublishingFlowResult),
    } as unknown as PublishingOrchestrator;

    await processPublishingJob(SCOPED_PAYLOAD, {
      createOrchestrator: () => orchestrator,
      publishedContentRepo: { create, findDuplicate },
    });

    expect(create).not.toHaveBeenCalled();
  });

  it('does not persist PublishedContent when repo is not injected', async () => {
    const result = await processPublishingJob(SCOPED_PAYLOAD, { publisherDriver: 'mock' });
    expect(result.success).toBe(true);
  });
});

describe('processPublishingJob — duplicate detection (Sprint 23)', () => {
  it('returns skipped=true and does not call publisher when duplicate exists', async () => {
    const publishMedia = vi.fn();
    const publishPost = vi.fn();
    const create = vi.fn();
    const findDuplicate = vi.fn().mockResolvedValue({
      id: 'pub-existing',
      projectId: 'proj-1',
      publisher: 'mock',
      slug: 'aftercare-guide',
    });

    const result = await processPublishingJob(SCOPED_PAYLOAD, {
      publisherDriver: 'mock',
      createPublisher: () => ({
        publishMedia,
        publishPost,
        publish: vi.fn(),
        health: vi.fn(),
        name: 'mock',
      }),
      publishedContentRepo: { create, findDuplicate },
    });

    expect(result.success).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('duplicate');
    expect(publishMedia).not.toHaveBeenCalled();
    expect(publishPost).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('proceeds normally when no duplicate exists', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'pub-new' });
    const findDuplicate = vi.fn().mockResolvedValue(null);

    const result = await processPublishingJob(SCOPED_PAYLOAD, {
      publisherDriver: 'mock',
      publishedContentRepo: { create, findDuplicate },
    });

    expect(result.success).toBe(true);
    expect(result.skipped).toBeUndefined();
    expect(create).toHaveBeenCalledOnce();
  });

  it('skips duplicate check when publishedContentRepo is not injected', async () => {
    const result = await processPublishingJob(SCOPED_PAYLOAD, { publisherDriver: 'mock' });
    expect(result.success).toBe(true);
    expect(result.skipped).toBeUndefined();
  });

  it('skips duplicate check when projectId is absent from payload', async () => {
    const findDuplicate = vi.fn();
    const create = vi.fn().mockResolvedValue({ id: 'pub-1' });
    const payloadWithoutProject: PublishingJobPayload = {
      ...VALID_PAYLOAD,
    };

    const result = await processPublishingJob(payloadWithoutProject, {
      publisherDriver: 'mock',
      publishedContentRepo: { create, findDuplicate },
    });

    expect(result.success).toBe(true);
    expect(findDuplicate).not.toHaveBeenCalled();
  });

  it('history row is NOT created for a skipped duplicate', async () => {
    const create = vi.fn();
    const findDuplicate = vi.fn().mockResolvedValue({ id: 'pub-existing' });

    await processPublishingJob(SCOPED_PAYLOAD, {
      publisherDriver: 'mock',
      publishedContentRepo: { create, findDuplicate },
    });

    expect(create).not.toHaveBeenCalled();
  });
});
