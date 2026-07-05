import { describe, expect, it, vi } from 'vitest';

import { MockPublisher } from '../mock.publisher.js';
import type { Publisher, PublishingRequest, PublishingResult } from '../publisher.js';
import { PublishingValidationError } from '../publisher.js';
import { PublishingOrchestrator } from '../publishing-orchestrator.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_REQUEST: PublishingRequest = {
  title: 'Aftercare Guide',
  slug: 'aftercare-guide',
  body: '<p>Clean twice daily.</p>',
  excerpt: 'A short guide.',
  tags: ['aftercare'],
  categories: ['12'],
  mediaBuffer: Buffer.from('fake-image'),
  mediaMimeType: 'image/jpeg',
  mediaFilename: 'aftercare.jpg',
};

const MEDIA_RESULT: PublishingResult = {
  success: true,
  externalId: '42',
  url: 'https://example.com/media/42',
  publishedAt: new Date('2024-06-01T10:00:00.000Z'),
  message: 'Media uploaded',
};

const POST_RESULT: PublishingResult = {
  success: true,
  externalId: '99',
  url: 'https://example.com/posts/99',
  publishedAt: new Date('2024-06-02T10:00:00.000Z'),
  message: 'Draft created',
};

function createMockPublisher(
  overrides: Partial<{
    publishMedia: Publisher['publishMedia'];
    publishPost: Publisher['publishPost'];
  }> = {},
): Publisher {
  return {
    name: 'TestPublisher',
    publishMedia: overrides.publishMedia ?? vi.fn().mockResolvedValue(MEDIA_RESULT),
    publishPost: overrides.publishPost ?? vi.fn().mockResolvedValue(POST_RESULT),
    publish: vi.fn(),
    health: vi.fn().mockResolvedValue({ status: 'ok' }),
  };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('PublishingOrchestrator — happy path', () => {
  it('returns success=true with media and post results', async () => {
    const publisher = createMockPublisher();
    const orchestrator = new PublishingOrchestrator(publisher);
    const result = await orchestrator.publish(VALID_REQUEST);

    expect(result.success).toBe(true);
    expect(result.media).toEqual({ externalId: '42', url: MEDIA_RESULT.url });
    expect(result.post).toEqual({ externalId: '99', url: POST_RESULT.url });
    expect(result.publishedAt).toEqual(POST_RESULT.publishedAt);
    expect(result.message).toContain('42');
    expect(result.message).toContain('99');
  });

  it('works end-to-end with MockPublisher', async () => {
    const orchestrator = new PublishingOrchestrator(new MockPublisher());
    const result = await orchestrator.publish(VALID_REQUEST);

    expect(result.success).toBe(true);
    expect(result.media?.externalId).toMatch(/^media-/);
    expect(result.post?.externalId).toMatch(/^post-/);
    expect(result.media?.url).toContain('/media/');
    expect(result.post?.url).toContain('/posts/');
  });
});

// ---------------------------------------------------------------------------
// Call order
// ---------------------------------------------------------------------------

describe('PublishingOrchestrator — call order', () => {
  it('calls publishMedia before publishPost', async () => {
    const order: string[] = [];
    const publisher = createMockPublisher({
      publishMedia: vi.fn(async () => {
        order.push('media');
        return MEDIA_RESULT;
      }),
      publishPost: vi.fn(async () => {
        order.push('post');
        return POST_RESULT;
      }),
    });

    const orchestrator = new PublishingOrchestrator(publisher);
    await orchestrator.publish(VALID_REQUEST);

    expect(order).toEqual(['media', 'post']);
  });

  it('calls publishMedia exactly once', async () => {
    const publishMedia = vi.fn().mockResolvedValue(MEDIA_RESULT);
    const publisher = createMockPublisher({ publishMedia });
    const orchestrator = new PublishingOrchestrator(publisher);
    await orchestrator.publish(VALID_REQUEST);
    expect(publishMedia).toHaveBeenCalledOnce();
  });

  it('calls publishPost exactly once', async () => {
    const publishPost = vi.fn().mockResolvedValue(POST_RESULT);
    const publisher = createMockPublisher({ publishPost });
    const orchestrator = new PublishingOrchestrator(publisher);
    await orchestrator.publish(VALID_REQUEST);
    expect(publishPost).toHaveBeenCalledOnce();
  });

  it('passes media externalId to publishPost as featuredAssetId', async () => {
    const publishPost = vi.fn().mockResolvedValue(POST_RESULT);
    const publisher = createMockPublisher({ publishPost });
    const orchestrator = new PublishingOrchestrator(publisher);
    await orchestrator.publish(VALID_REQUEST);

    const postRequest = publishPost.mock.calls[0]![0] as PublishingRequest;
    expect(postRequest.featuredAssetId).toBe('42');
    expect(postRequest.featuredMediaId).toBe(42);
  });

  it('passes numeric featuredMediaId when media externalId is numeric', async () => {
    const publishPost = vi.fn().mockResolvedValue(POST_RESULT);
    const publisher = createMockPublisher({
      publishMedia: vi.fn().mockResolvedValue({ ...MEDIA_RESULT, externalId: '1337' }),
      publishPost,
    });
    const orchestrator = new PublishingOrchestrator(publisher);
    await orchestrator.publish(VALID_REQUEST);

    const postRequest = publishPost.mock.calls[0]![0] as PublishingRequest;
    expect(postRequest.featuredMediaId).toBe(1337);
  });

  it('does not call publisher.publish()', async () => {
    const publisher = createMockPublisher();
    const orchestrator = new PublishingOrchestrator(publisher);
    await orchestrator.publish(VALID_REQUEST);
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Media failure
// ---------------------------------------------------------------------------

describe('PublishingOrchestrator — media failure', () => {
  it('stops immediately when publishMedia throws', async () => {
    const publishMedia = vi.fn().mockRejectedValue(new Error('upload rejected'));
    const publishPost = vi.fn().mockResolvedValue(POST_RESULT);
    const publisher = createMockPublisher({ publishMedia, publishPost });
    const orchestrator = new PublishingOrchestrator(publisher);

    const result = await orchestrator.publish(VALID_REQUEST);

    expect(result.success).toBe(false);
    expect(result.media).toBeUndefined();
    expect(result.post).toBeUndefined();
    expect(result.message).toContain('Media upload failed');
    expect(publishPost).not.toHaveBeenCalled();
  });

  it('stops when publishMedia returns success=false', async () => {
    const publishMedia = vi.fn().mockResolvedValue({
      ...MEDIA_RESULT,
      success: false,
      message: 'Quota exceeded',
    });
    const publishPost = vi.fn().mockResolvedValue(POST_RESULT);
    const publisher = createMockPublisher({ publishMedia, publishPost });
    const orchestrator = new PublishingOrchestrator(publisher);

    const result = await orchestrator.publish(VALID_REQUEST);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Quota exceeded');
    expect(publishPost).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Draft failure
// ---------------------------------------------------------------------------

describe('PublishingOrchestrator — draft failure', () => {
  it('returns media result when publishPost throws', async () => {
    const publishPost = vi.fn().mockRejectedValue(new Error('draft rejected'));
    const publisher = createMockPublisher({ publishPost });
    const orchestrator = new PublishingOrchestrator(publisher);

    const result = await orchestrator.publish(VALID_REQUEST);

    expect(result.success).toBe(false);
    expect(result.media).toEqual({ externalId: '42', url: MEDIA_RESULT.url });
    expect(result.post).toEqual({ externalId: '', url: '' });
    expect(result.publishedAt).toEqual(MEDIA_RESULT.publishedAt);
    expect(result.message).toContain('Draft creation failed');
  });

  it('returns media result when publishPost returns success=false', async () => {
    const publishPost = vi.fn().mockResolvedValue({
      ...POST_RESULT,
      success: false,
      message: 'Invalid category',
    });
    const publisher = createMockPublisher({ publishPost });
    const orchestrator = new PublishingOrchestrator(publisher);

    const result = await orchestrator.publish(VALID_REQUEST);

    expect(result.success).toBe(false);
    expect(result.media?.externalId).toBe('42');
    expect(result.message).toContain('Invalid category');
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('PublishingOrchestrator — validation', () => {
  it('throws when mediaBuffer is missing', async () => {
    const orchestrator = new PublishingOrchestrator(createMockPublisher());
    await expect(
      orchestrator.publish({ ...VALID_REQUEST, mediaBuffer: undefined }),
    ).rejects.toThrow(PublishingValidationError);
  });

  it('throws when body is missing', async () => {
    const orchestrator = new PublishingOrchestrator(createMockPublisher());
    await expect(orchestrator.publish({ ...VALID_REQUEST, body: '' })).rejects.toThrow(
      PublishingValidationError,
    );
  });
});
