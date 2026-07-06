/**
 * Ghost publisher tests — Sprint 35.
 */

import { PublishingValidationError } from '@pcme/publishing';
import { describe, expect, it, vi } from 'vitest';

import type { GhostConfig } from '../config.js';
import { GhostApiError } from '../errors.js';
import type { FetchFunction } from '../ghost.publisher.js';
import { GhostPublisher } from '../ghost.publisher.js';

const VALID_CONFIG: GhostConfig = {
  baseUrl: 'https://ghost.example.com',
  adminApiKey:
    '633c86459f984d202ff980e9e1:8d3c5e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e',
};

const VALID_MEDIA_REQUEST = {
  title: 'Hero Image',
  slug: 'hero-image',
  mediaMimeType: 'image/jpeg',
  mediaFilename: 'hero.jpg',
  mediaBuffer: Buffer.from('fake-jpeg'),
};

const VALID_POST_REQUEST = {
  title: 'Aftercare Guide',
  slug: 'aftercare-guide',
  excerpt: 'Keep it clean.',
  body: '<p>Clean twice daily.</p>',
  tags: ['aftercare', 'piercing'],
  featuredAssetId: 'https://ghost.example.com/content/images/feature.jpg',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const GHOST_SITE_RESPONSE = { site: { title: 'PC Media Blog', url: 'https://ghost.example.com' } };

const GHOST_IMAGE_RESPONSE = {
  images: [{ url: 'https://ghost.example.com/content/images/hero.jpg' }],
};

const GHOST_POST_RESPONSE = {
  posts: [
    {
      id: 'post-abc123',
      url: 'https://ghost.example.com/aftercare-guide/',
      slug: 'aftercare-guide',
      status: 'draft',
      created_at: '2024-06-01T10:00:00.000Z',
    },
  ],
};

describe('GhostPublisher.health', () => {
  it('returns ok when site endpoint responds 200', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(GHOST_SITE_RESPONSE, 200));
    const pub = new GhostPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.health();
    expect(result.status).toBe('ok');
    expect(result.message).toContain('PC Media Blog');
  });

  it('sends Ghost Authorization header', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(GHOST_SITE_RESPONSE, 200));
    const pub = new GhostPublisher(VALID_CONFIG, mockFetch);
    await pub.health();
    const headers = mockFetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Ghost /);
  });

  it('returns down for 401', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(
        jsonResponse({ errors: [{ message: 'Invalid token', type: 'UnauthorizedError' }] }, 401),
      );
    const pub = new GhostPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.health();
    expect(result.status).toBe('down');
  });

  it('returns down when config is incomplete', async () => {
    const pub = new GhostPublisher({ baseUrl: '', adminApiKey: '' }, vi.fn());
    const result = await pub.health();
    expect(result.status).toBe('down');
  });
});

describe('GhostPublisher.publishMedia', () => {
  it('returns success with image URL', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(GHOST_IMAGE_RESPONSE, 201));
    const pub = new GhostPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.publishMedia(VALID_MEDIA_REQUEST);
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://ghost.example.com/content/images/hero.jpg');
    expect(result.permalink).toBe(result.url);
  });

  it('posts multipart form to images/upload', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(GHOST_IMAGE_RESPONSE, 201));
    const pub = new GhostPublisher(VALID_CONFIG, mockFetch);
    await pub.publishMedia(VALID_MEDIA_REQUEST);
    const url = String(mockFetch.mock.calls[0]?.[0]);
    expect(url).toContain('/ghost/api/admin/images/upload/');
    expect(mockFetch.mock.calls[0]?.[1]?.body).toBeInstanceOf(FormData);
  });

  it('throws PublishingValidationError for disallowed MIME type', async () => {
    const pub = new GhostPublisher(VALID_CONFIG, vi.fn());
    await expect(
      pub.publishMedia({ ...VALID_MEDIA_REQUEST, mediaMimeType: 'text/html' }),
    ).rejects.toThrow(PublishingValidationError);
  });

  it('throws GhostApiError on 401', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(
        jsonResponse({ errors: [{ message: 'Bad key', type: 'UnauthorizedError' }] }, 401),
      );
    const pub = new GhostPublisher(VALID_CONFIG, mockFetch);
    let caught: GhostApiError | undefined;
    try {
      await pub.publishMedia(VALID_MEDIA_REQUEST);
    } catch (err) {
      if (err instanceof GhostApiError) caught = err;
    }
    expect(caught?.category).toBe('auth');
  });
});

describe('GhostPublisher.publishPost', () => {
  it('creates draft post with HTML, tags, and feature image', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(GHOST_POST_RESPONSE, 201));
    const pub = new GhostPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.publishPost(VALID_POST_REQUEST);
    expect(result.success).toBe(true);
    expect(result.externalId).toBe('post-abc123');
    expect(result.postStatus).toBe('draft');
    expect(result.permalink).toBe('https://ghost.example.com/aftercare-guide/');

    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body)) as {
      posts: Array<Record<string, unknown>>;
    };
    const post = body.posts[0]!;
    expect(post['status']).toBe('draft');
    expect(post['html']).toBe('<p>Clean twice daily.</p>');
    expect(post['tags']).toEqual([{ name: 'aftercare' }, { name: 'piercing' }]);
    expect(post['feature_image']).toBe('https://ghost.example.com/content/images/feature.jpg');
  });

  it('uses source=html query param', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(GHOST_POST_RESPONSE, 201));
    const pub = new GhostPublisher(VALID_CONFIG, mockFetch);
    await pub.publishPost(VALID_POST_REQUEST);
    const url = String(mockFetch.mock.calls[0]?.[0]);
    expect(url).toContain('source=html');
  });

  it('throws PublishingValidationError for invalid slug', async () => {
    const pub = new GhostPublisher(VALID_CONFIG, vi.fn());
    await expect(pub.publishPost({ ...VALID_POST_REQUEST, slug: 'Bad Slug!' })).rejects.toThrow(
      PublishingValidationError,
    );
  });

  it('throws GhostApiError on 500', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(new Response('Internal error', { status: 500 }));
    const pub = new GhostPublisher(VALID_CONFIG, mockFetch);
    await expect(pub.publishPost(VALID_POST_REQUEST)).rejects.toThrow(GhostApiError);
  });
});

describe('GhostPublisher.publish', () => {
  it('routes to publishMedia when mediaBuffer present', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(GHOST_IMAGE_RESPONSE, 201));
    const pub = new GhostPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.publish(VALID_MEDIA_REQUEST);
    expect(result.url).toContain('/content/images/');
  });

  it('routes to publishPost when no mediaBuffer', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(GHOST_POST_RESPONSE, 201));
    const pub = new GhostPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.publish(VALID_POST_REQUEST);
    expect(result.externalId).toBe('post-abc123');
  });
});

describe('GhostPublisher logger', () => {
  it('emits info events on successful publishPost', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(GHOST_POST_RESPONSE, 201));
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const pub = new GhostPublisher(VALID_CONFIG, mockFetch, { logger });
    await pub.publishPost(VALID_POST_REQUEST);
    expect(logger.info).toHaveBeenCalled();
  });
});
