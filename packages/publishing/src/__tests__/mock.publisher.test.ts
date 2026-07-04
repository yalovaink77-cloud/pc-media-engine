import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { MockPublisher } from '../mock.publisher.js';
import type { Publisher, PublishingRequest } from '../publisher.js';
import { PublishingValidationError } from '../publisher.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deterministicId(slug: string): string {
  return createHash('sha1').update(slug).digest('hex').slice(0, 12);
}

const VALID_REQUEST: PublishingRequest = {
  title: 'Navel Aftercare Guide',
  slug: 'navel-aftercare-guide',
  excerpt: 'Everything you need to know.',
  body: '<p>Clean twice daily...</p>',
  tags: ['aftercare', 'navel'],
  categories: ['care-guides'],
  assetId: 'asset-001',
  featuredAssetId: 'asset-001',
};

// ---------------------------------------------------------------------------
// Publisher interface contract
// ---------------------------------------------------------------------------

describe('Publisher interface contract', () => {
  it('MockPublisher satisfies the Publisher interface at compile time', () => {
    // This is a structural TypeScript check. If MockPublisher does not
    // implement Publisher, this assignment will fail to compile.
    const publisher: Publisher = new MockPublisher();
    expect(publisher).toBeDefined();
    expect(typeof publisher.publishMedia).toBe('function');
    expect(typeof publisher.publishPost).toBe('function');
    expect(typeof publisher.publish).toBe('function');
    expect(typeof publisher.health).toBe('function');
    expect(typeof publisher.name).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// MockPublisher — publishMedia
// ---------------------------------------------------------------------------

describe('MockPublisher.publishMedia', () => {
  it('returns success=true for a valid request', async () => {
    const pub = new MockPublisher();
    const result = await pub.publishMedia(VALID_REQUEST);
    expect(result.success).toBe(true);
  });

  it('returns a deterministic externalId based on slug', async () => {
    const pub = new MockPublisher();
    const id = deterministicId(VALID_REQUEST.slug);
    const result = await pub.publishMedia(VALID_REQUEST);
    expect(result.externalId).toBe(`media-${id}`);
  });

  it('returns a deterministic url based on slug', async () => {
    const pub = new MockPublisher();
    const id = deterministicId(VALID_REQUEST.slug);
    const result = await pub.publishMedia(VALID_REQUEST);
    expect(result.url).toBe(`https://mock.example.com/media/${id}`);
  });

  it('uses custom baseUrl from options', async () => {
    const pub = new MockPublisher({ baseUrl: 'https://staging.example.com' });
    const result = await pub.publishMedia(VALID_REQUEST);
    expect(result.url).toMatch(/^https:\/\/staging\.example\.com\//);
  });

  it('includes a message with the title', async () => {
    const pub = new MockPublisher();
    const result = await pub.publishMedia(VALID_REQUEST);
    expect(result.message).toContain(VALID_REQUEST.title);
  });

  it('returns a publishedAt Date', async () => {
    const pub = new MockPublisher();
    const result = await pub.publishMedia(VALID_REQUEST);
    expect(result.publishedAt).toBeInstanceOf(Date);
  });

  it('same slug always produces the same result (idempotent)', async () => {
    const pub = new MockPublisher();
    const r1 = await pub.publishMedia(VALID_REQUEST);
    const r2 = await pub.publishMedia(VALID_REQUEST);
    expect(r1.externalId).toBe(r2.externalId);
    expect(r1.url).toBe(r2.url);
  });

  it('different slugs produce different externalIds', async () => {
    const pub = new MockPublisher();
    const r1 = await pub.publishMedia({ title: 'A', slug: 'slug-a' });
    const r2 = await pub.publishMedia({ title: 'B', slug: 'slug-b' });
    expect(r1.externalId).not.toBe(r2.externalId);
  });
});

// ---------------------------------------------------------------------------
// MockPublisher — publishPost
// ---------------------------------------------------------------------------

describe('MockPublisher.publishPost', () => {
  it('returns success=true for a valid request', async () => {
    const pub = new MockPublisher();
    const result = await pub.publishPost(VALID_REQUEST);
    expect(result.success).toBe(true);
  });

  it('returns a deterministic externalId with post- prefix', async () => {
    const pub = new MockPublisher();
    const id = deterministicId(VALID_REQUEST.slug);
    const result = await pub.publishPost(VALID_REQUEST);
    expect(result.externalId).toBe(`post-${id}`);
  });

  it('returns a /posts/ url distinct from /media/ url', async () => {
    const pub = new MockPublisher();
    const media = await pub.publishMedia(VALID_REQUEST);
    const post = await pub.publishPost(VALID_REQUEST);
    expect(post.url).toContain('/posts/');
    expect(media.url).toContain('/media/');
    expect(post.url).not.toBe(media.url);
  });
});

// ---------------------------------------------------------------------------
// MockPublisher — publish (routing)
// ---------------------------------------------------------------------------

describe('MockPublisher.publish routing', () => {
  it('routes to publishMedia when assetId is set and body is absent', async () => {
    const pub = new MockPublisher();
    const result = await pub.publish({ title: 'Photo', slug: 'photo', assetId: 'a1' });
    expect(result.url).toContain('/media/');
  });

  it('routes to publishPost when body is present', async () => {
    const pub = new MockPublisher();
    const result = await pub.publish({
      title: 'Article',
      slug: 'article',
      assetId: 'a1',
      body: '<p>content</p>',
    });
    expect(result.url).toContain('/posts/');
  });

  it('routes to publishPost when no assetId', async () => {
    const pub = new MockPublisher();
    const result = await pub.publish({ title: 'Page', slug: 'page' });
    expect(result.url).toContain('/posts/');
  });
});

// ---------------------------------------------------------------------------
// Validation — invalid payloads
// ---------------------------------------------------------------------------

describe('MockPublisher validation', () => {
  it('publishMedia throws PublishingValidationError when title is missing', async () => {
    const pub = new MockPublisher();
    await expect(pub.publishMedia({ title: '', slug: 'some-slug' })).rejects.toThrow(
      PublishingValidationError,
    );
  });

  it('publishMedia throws PublishingValidationError when slug is missing', async () => {
    const pub = new MockPublisher();
    await expect(pub.publishMedia({ title: 'Valid Title', slug: '' })).rejects.toThrow(
      PublishingValidationError,
    );
  });

  it('publishPost throws PublishingValidationError when title is whitespace only', async () => {
    const pub = new MockPublisher();
    await expect(pub.publishPost({ title: '   ', slug: 'ok-slug' })).rejects.toThrow(
      PublishingValidationError,
    );
  });

  it('publishPost throws PublishingValidationError when slug is whitespace only', async () => {
    const pub = new MockPublisher();
    await expect(pub.publishPost({ title: 'Valid', slug: '   ' })).rejects.toThrow(
      PublishingValidationError,
    );
  });

  it('publish propagates validation errors', async () => {
    const pub = new MockPublisher();
    await expect(pub.publish({ title: '', slug: '' })).rejects.toThrow(PublishingValidationError);
  });

  it('PublishingValidationError has the correct name', async () => {
    const pub = new MockPublisher();
    try {
      await pub.publishMedia({ title: '', slug: 'slug' });
    } catch (err) {
      expect(err).toBeInstanceOf(PublishingValidationError);
      if (err instanceof PublishingValidationError) {
        expect(err.name).toBe('PublishingValidationError');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// health()
// ---------------------------------------------------------------------------

describe('MockPublisher.health', () => {
  it('returns status=ok', async () => {
    const pub = new MockPublisher();
    const result = await pub.health();
    expect(result.status).toBe('ok');
  });

  it('does not include a message in the ok state', async () => {
    const pub = new MockPublisher();
    const result = await pub.health();
    expect(result.message).toBeUndefined();
  });
});
