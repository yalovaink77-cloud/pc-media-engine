import { PublishingValidationError } from '@pcme/publishing';
import { describe, expect, it, vi } from 'vitest';

import { buildBasicAuth } from '../auth.js';
import type { WordPressConfig } from '../config.js';
import { loadWordPressConfig, WordPressConfigError } from '../config.js';
import { WordPressApiError } from '../errors.js';
import type { FetchFunction } from '../wordpress-media.publisher.js';
import { WordPressMediaPublisher } from '../wordpress-media.publisher.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const VALID_CONFIG: WordPressConfig = {
  baseUrl: 'https://example.com',
  username: 'admin',
  appPassword: 'xxxx yyyy zzzz',
};

const VALID_REQUEST = {
  title: 'Industrial Barbell Photo',
  slug: 'industrial-barbell-photo',
  mediaMimeType: 'image/jpeg',
  mediaFilename: 'industrial-barbell.jpg',
  mediaBuffer: Buffer.from('fake-jpeg-bytes'),
};

/** Build a fake Response with a JSON body. */
function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const WP_MEDIA_RESPONSE = {
  id: 42,
  link: 'https://example.com/?attachment_id=42',
  source_url: 'https://example.com/wp-content/uploads/industrial-barbell.jpg',
  date: '2024-06-01T10:00:00',
};

const WP_USER_RESPONSE = {
  id: 1,
  name: 'Admin User',
};

const VALID_POST_REQUEST = {
  title: 'Aftercare Guide: Industrial Piercings',
  slug: 'aftercare-guide-industrial-piercings',
  excerpt: 'Keep your new industrial clean and healthy.',
  body: '<p>Clean twice daily with saline solution.</p>',
  tags: ['aftercare', 'industrial'],
  categories: ['12', '34'],
  featuredMediaId: 42,
};

const WP_POST_RESPONSE = {
  id: 99,
  link: 'https://example.com/?p=99',
  date: '2024-06-02T10:00:00',
  status: 'draft',
};

// ---------------------------------------------------------------------------
// auth — buildBasicAuth
// ---------------------------------------------------------------------------

describe('buildBasicAuth', () => {
  it('produces a valid Basic auth header', () => {
    const header = buildBasicAuth('user', 'pass');
    expect(header).toBe(`Basic ${Buffer.from('user:pass').toString('base64')}`);
  });

  it('includes spaces in app passwords (they are significant)', () => {
    const header = buildBasicAuth('admin', 'xxxx yyyy zzzz');
    const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString();
    expect(decoded).toBe('admin:xxxx yyyy zzzz');
  });
});

// ---------------------------------------------------------------------------
// loadWordPressConfig
// ---------------------------------------------------------------------------

describe('loadWordPressConfig', () => {
  it('loads config from env vars', () => {
    const config = loadWordPressConfig({
      WORDPRESS_BASE_URL: 'https://site.com/',
      WORDPRESS_USERNAME: 'editor',
      WORDPRESS_APP_PASSWORD: 'ab cd ef',
    });
    expect(config.baseUrl).toBe('https://site.com');
    expect(config.username).toBe('editor');
    expect(config.appPassword).toBe('ab cd ef');
  });

  it('strips trailing slash from baseUrl', () => {
    const config = loadWordPressConfig({
      WORDPRESS_BASE_URL: 'https://site.com///',
      WORDPRESS_USERNAME: 'u',
      WORDPRESS_APP_PASSWORD: 'p',
    });
    expect(config.baseUrl).toBe('https://site.com');
  });

  it('throws WordPressConfigError when WORDPRESS_BASE_URL is missing', () => {
    expect(() =>
      loadWordPressConfig({ WORDPRESS_USERNAME: 'u', WORDPRESS_APP_PASSWORD: 'p' }),
    ).toThrow(WordPressConfigError);
  });

  it('throws WordPressConfigError when WORDPRESS_USERNAME is missing', () => {
    expect(() =>
      loadWordPressConfig({ WORDPRESS_BASE_URL: 'https://site.com', WORDPRESS_APP_PASSWORD: 'p' }),
    ).toThrow(WordPressConfigError);
  });

  it('throws WordPressConfigError when WORDPRESS_APP_PASSWORD is missing', () => {
    expect(() =>
      loadWordPressConfig({ WORDPRESS_BASE_URL: 'https://site.com', WORDPRESS_USERNAME: 'u' }),
    ).toThrow(WordPressConfigError);
  });

  it('includes the missing variable names in the error message', () => {
    let msg = '';
    try {
      loadWordPressConfig({});
    } catch (err) {
      if (err instanceof WordPressConfigError) msg = err.message;
    }
    expect(msg).toContain('WORDPRESS_BASE_URL');
    expect(msg).toContain('WORDPRESS_USERNAME');
    expect(msg).toContain('WORDPRESS_APP_PASSWORD');
  });
});

// ---------------------------------------------------------------------------
// WordPressMediaPublisher — publishMedia (success)
// ---------------------------------------------------------------------------

describe('WordPressMediaPublisher.publishMedia — success', () => {
  it('returns PublishingResult with success=true', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(WP_MEDIA_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.publishMedia(VALID_REQUEST);
    expect(result.success).toBe(true);
  });

  it('maps externalId from WordPress id', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(WP_MEDIA_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.publishMedia(VALID_REQUEST);
    expect(result.externalId).toBe('42');
  });

  it('maps url from source_url', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(WP_MEDIA_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.publishMedia(VALID_REQUEST);
    expect(result.url).toBe(WP_MEDIA_RESPONSE.source_url);
  });

  it('falls back to link when source_url is absent', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(
        jsonResponse(
          { id: 99, link: 'https://example.com/?p=99', date: '2024-01-01T00:00:00' },
          201,
        ),
      );
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.publishMedia(VALID_REQUEST);
    expect(result.url).toBe('https://example.com/?p=99');
  });

  it('maps publishedAt to a Date', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(WP_MEDIA_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.publishMedia(VALID_REQUEST);
    expect(result.publishedAt).toBeInstanceOf(Date);
    expect(result.publishedAt.toISOString()).toMatch(/^2024-06-01/);
  });

  it('includes the WordPress id in the message', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(WP_MEDIA_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.publishMedia(VALID_REQUEST);
    expect(result.message).toContain('42');
  });
});

// ---------------------------------------------------------------------------
// WordPressMediaPublisher — auth header
// ---------------------------------------------------------------------------

describe('WordPressMediaPublisher — auth header formation', () => {
  it('sends Authorization header with correct Basic credentials', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(WP_MEDIA_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await pub.publishMedia(VALID_REQUEST);

    const [, init] = mockFetch.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    const expected = buildBasicAuth(VALID_CONFIG.username, VALID_CONFIG.appPassword);
    expect(headers['Authorization']).toBe(expected);
  });

  it('sends correct Content-Type header', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(WP_MEDIA_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await pub.publishMedia(VALID_REQUEST);

    const [, init] = mockFetch.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('image/jpeg');
  });

  it('sends correct Content-Disposition with filename', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(WP_MEDIA_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await pub.publishMedia(VALID_REQUEST);

    const [, init] = mockFetch.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers['Content-Disposition']).toContain('industrial-barbell.jpg');
  });

  it('defaults Content-Disposition filename to slug when mediaFilename absent', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse(WP_MEDIA_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await pub.publishMedia({ ...VALID_REQUEST, mediaFilename: undefined });

    const [, init] = mockFetch.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers['Content-Disposition']).toContain(VALID_REQUEST.slug);
  });
});

// ---------------------------------------------------------------------------
// WordPressMediaPublisher — validation / missing config
// ---------------------------------------------------------------------------

describe('WordPressMediaPublisher — validation', () => {
  it('throws PublishingValidationError when config is incomplete', async () => {
    const pub = new WordPressMediaPublisher(
      { baseUrl: '', username: '', appPassword: '' },
      vi.fn(),
    );
    await expect(pub.publishMedia(VALID_REQUEST)).rejects.toThrow(PublishingValidationError);
  });

  it('throws PublishingValidationError when title is empty', async () => {
    const mockFetch = vi.fn<FetchFunction>();
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await expect(pub.publishMedia({ ...VALID_REQUEST, title: '' })).rejects.toThrow(
      PublishingValidationError,
    );
  });

  it('throws PublishingValidationError when slug is empty', async () => {
    const mockFetch = vi.fn<FetchFunction>();
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await expect(pub.publishMedia({ ...VALID_REQUEST, slug: '' })).rejects.toThrow(
      PublishingValidationError,
    );
  });

  it('throws PublishingValidationError when mediaBuffer is absent', async () => {
    const mockFetch = vi.fn<FetchFunction>();
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await expect(pub.publishMedia({ ...VALID_REQUEST, mediaBuffer: undefined })).rejects.toThrow(
      PublishingValidationError,
    );
  });

  it('throws PublishingValidationError when mediaBuffer is empty', async () => {
    const mockFetch = vi.fn<FetchFunction>();
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await expect(
      pub.publishMedia({ ...VALID_REQUEST, mediaBuffer: Buffer.alloc(0) }),
    ).rejects.toThrow(PublishingValidationError);
  });
});

// ---------------------------------------------------------------------------
// WordPressMediaPublisher — WordPress API error responses
// ---------------------------------------------------------------------------

describe('WordPressMediaPublisher — WordPress error responses', () => {
  it('throws WordPressApiError on 401 Unauthorized', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(
        jsonResponse({ code: 'rest_cannot_create', message: 'Sorry, you are not allowed.' }, 401),
      );
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await expect(pub.publishMedia(VALID_REQUEST)).rejects.toThrow(WordPressApiError);
  });

  it('WordPressApiError carries the HTTP status', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(
        jsonResponse({ code: 'rest_cannot_create', message: 'Not allowed.' }, 403),
      );
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    let caught: WordPressApiError | null = null;
    try {
      await pub.publishMedia(VALID_REQUEST);
    } catch (err) {
      if (err instanceof WordPressApiError) caught = err;
    }
    expect(caught?.status).toBe(403);
    expect(caught?.code).toBe('rest_cannot_create');
  });

  it('throws WordPressApiError on 500 with non-JSON body', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(new Response('Internal Server Error', { status: 500 }));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await expect(pub.publishMedia(VALID_REQUEST)).rejects.toThrow(WordPressApiError);
  });
});

// ---------------------------------------------------------------------------
// WordPressMediaPublisher — network failure
// ---------------------------------------------------------------------------

describe('WordPressMediaPublisher — network failure', () => {
  it('propagates fetch errors from publishMedia', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockRejectedValue(new TypeError('fetch failed: ECONNREFUSED'));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await expect(pub.publishMedia(VALID_REQUEST)).rejects.toThrow('ECONNREFUSED');
  });

  it('health() returns status=down on network error', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockRejectedValue(new TypeError('fetch failed: ECONNREFUSED'));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.health();
    expect(result.status).toBe('down');
    expect(result.message).toContain('ECONNREFUSED');
  });
});

// ---------------------------------------------------------------------------
// WordPressMediaPublisher — health()
// ---------------------------------------------------------------------------

describe('WordPressMediaPublisher.health', () => {
  it('returns ok when WordPress responds 200', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(jsonResponse(WP_USER_RESPONSE, 200));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.health();
    expect(result.status).toBe('ok');
  });

  it('includes the authenticated username in the message', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(jsonResponse(WP_USER_RESPONSE, 200));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.health();
    expect(result.message).toContain('Admin User');
  });

  it('returns down when WordPress responds 401', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse({ code: 'rest_not_logged_in' }, 401));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.health();
    expect(result.status).toBe('down');
  });

  it('returns down with message when config is incomplete', async () => {
    const pub = new WordPressMediaPublisher(
      { baseUrl: '', username: '', appPassword: '' },
      vi.fn(),
    );
    const result = await pub.health();
    expect(result.status).toBe('down');
    expect(result.message).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// WordPressMediaPublisher — publishPost (draft creation)
// ---------------------------------------------------------------------------

describe('WordPressMediaPublisher.publishPost — success', () => {
  it('returns PublishingResult with success=true', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(jsonResponse(WP_POST_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.publishPost(VALID_POST_REQUEST);
    expect(result.success).toBe(true);
  });

  it('maps externalId from WordPress post id', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(jsonResponse(WP_POST_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.publishPost(VALID_POST_REQUEST);
    expect(result.externalId).toBe('99');
  });

  it('maps url from link', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(jsonResponse(WP_POST_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.publishPost(VALID_POST_REQUEST);
    expect(result.url).toBe(WP_POST_RESPONSE.link);
  });

  it('maps publishedAt to a Date', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(jsonResponse(WP_POST_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.publishPost(VALID_POST_REQUEST);
    expect(result.publishedAt).toBeInstanceOf(Date);
    expect(result.publishedAt.toISOString()).toMatch(/^2024-06-02/);
  });

  it('includes draft status in the message', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(jsonResponse(WP_POST_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    const result = await pub.publishPost(VALID_POST_REQUEST);
    expect(result.message).toContain('draft');
    expect(result.message).toContain('99');
  });
});

describe('WordPressMediaPublisher.publishPost — request payload', () => {
  it('always sends status=draft', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(jsonResponse(WP_POST_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await pub.publishPost(VALID_POST_REQUEST);

    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(body['status']).toBe('draft');
  });

  it('sends title, slug, content, excerpt, categories, tags, featured_media', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(jsonResponse(WP_POST_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await pub.publishPost(VALID_POST_REQUEST);

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(String(url)).toContain('/wp-json/wp/v2/posts');
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(body['title']).toBe(VALID_POST_REQUEST.title);
    expect(body['slug']).toBe(VALID_POST_REQUEST.slug);
    expect(body['content']).toBe(VALID_POST_REQUEST.body);
    expect(body['excerpt']).toBe(VALID_POST_REQUEST.excerpt);
    expect(body['categories']).toEqual([12, 34]);
    expect(body['tags']).toEqual(['aftercare', 'industrial']);
    expect(body['featured_media']).toBe(42);
  });

  it('maps featuredAssetId when it is a numeric WordPress media id', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(jsonResponse(WP_POST_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await pub.publishPost({
      ...VALID_POST_REQUEST,
      featuredMediaId: undefined,
      featuredAssetId: '77',
    });

    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(body['featured_media']).toBe(77);
  });

  it('prefers featuredMediaId over featuredAssetId', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(jsonResponse(WP_POST_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await pub.publishPost({
      ...VALID_POST_REQUEST,
      featuredMediaId: 55,
      featuredAssetId: '77',
    });

    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(body['featured_media']).toBe(55);
  });

  it('omits featured_media when no featured id is provided', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(jsonResponse(WP_POST_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await pub.publishPost({
      title: 'Title',
      slug: 'title',
      body: '<p>Body</p>',
    });

    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(body['featured_media']).toBeUndefined();
  });
});

describe('WordPressMediaPublisher.publishPost — auth header', () => {
  it('sends Authorization header with correct Basic credentials', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(jsonResponse(WP_POST_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await pub.publishPost(VALID_POST_REQUEST);

    const [, init] = mockFetch.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    const expected = buildBasicAuth(VALID_CONFIG.username, VALID_CONFIG.appPassword);
    expect(headers['Authorization']).toBe(expected);
  });

  it('sends Content-Type application/json', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(jsonResponse(WP_POST_RESPONSE, 201));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await pub.publishPost(VALID_POST_REQUEST);

    const [, init] = mockFetch.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('WordPressMediaPublisher.publishPost — validation', () => {
  it('throws PublishingValidationError when config is incomplete', async () => {
    const pub = new WordPressMediaPublisher(
      { baseUrl: '', username: '', appPassword: '' },
      vi.fn(),
    );
    await expect(pub.publishPost(VALID_POST_REQUEST)).rejects.toThrow(PublishingValidationError);
  });

  it('throws PublishingValidationError when title is empty', async () => {
    const mockFetch = vi.fn<FetchFunction>();
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await expect(pub.publishPost({ ...VALID_POST_REQUEST, title: '' })).rejects.toThrow(
      PublishingValidationError,
    );
  });

  it('throws PublishingValidationError when slug is empty', async () => {
    const mockFetch = vi.fn<FetchFunction>();
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await expect(pub.publishPost({ ...VALID_POST_REQUEST, slug: '' })).rejects.toThrow(
      PublishingValidationError,
    );
  });

  it('throws PublishingValidationError when body is empty', async () => {
    const mockFetch = vi.fn<FetchFunction>();
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await expect(pub.publishPost({ ...VALID_POST_REQUEST, body: '' })).rejects.toThrow(
      PublishingValidationError,
    );
  });
});

describe('WordPressMediaPublisher.publishPost — WordPress error responses', () => {
  it('throws WordPressApiError on 401 Unauthorized', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(
        jsonResponse({ code: 'rest_cannot_create', message: 'Sorry, you are not allowed.' }, 401),
      );
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await expect(pub.publishPost(VALID_POST_REQUEST)).rejects.toThrow(WordPressApiError);
  });
});

describe('WordPressMediaPublisher.publishPost — network failure', () => {
  it('propagates fetch errors from publishPost', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockRejectedValue(new TypeError('fetch failed: ECONNREFUSED'));
    const pub = new WordPressMediaPublisher(VALID_CONFIG, mockFetch);
    await expect(pub.publishPost(VALID_POST_REQUEST)).rejects.toThrow('ECONNREFUSED');
  });
});

// ===========================================================================
// Sprint 33 — enhanced result fields, logging, timeout, error categories
// ===========================================================================

const VALID_CONFIG_S33: WordPressConfig = {
  baseUrl: 'https://example.com',
  username: 'admin',
  appPassword: 'xxxx yyyy',
  requestTimeoutMs: 30_000,
};

describe('Sprint 33 — publishMedia enhanced result', () => {
  it('result.wpMediaId equals WordPress id', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(
      jsonResponse(
        {
          id: 77,
          link: 'https://ex.com/?a=77',
          source_url: 'https://ex.com/img.jpg',
          date: '2024-01-01T00:00:00',
        },
        201,
      ),
    );
    const pub = new WordPressMediaPublisher(VALID_CONFIG_S33, mockFetch);
    const result = await pub.publishMedia({ ...VALID_REQUEST });
    expect(result.wpMediaId).toBe(77);
  });

  it('result.permalink equals source_url', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(
      jsonResponse(
        {
          id: 77,
          link: 'https://ex.com/?a=77',
          source_url: 'https://ex.com/img.jpg',
          date: '2024-01-01T00:00:00',
        },
        201,
      ),
    );
    const pub = new WordPressMediaPublisher(VALID_CONFIG_S33, mockFetch);
    const result = await pub.publishMedia({ ...VALID_REQUEST });
    expect(result.permalink).toBe('https://ex.com/img.jpg');
  });
});

describe('Sprint 33 — publishPost enhanced result', () => {
  it('result.wpPostId equals WordPress id', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(
        jsonResponse(
          { id: 200, link: 'https://ex.com/?p=200', date: '2024-01-01T00:00:00', status: 'draft' },
          201,
        ),
      );
    const pub = new WordPressMediaPublisher(VALID_CONFIG_S33, mockFetch);
    const result = await pub.publishPost(VALID_POST_REQUEST);
    expect(result.wpPostId).toBe(200);
  });

  it('result.postStatus equals WordPress status', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(
        jsonResponse(
          { id: 200, link: 'https://ex.com/?p=200', date: '2024-01-01T00:00:00', status: 'draft' },
          201,
        ),
      );
    const pub = new WordPressMediaPublisher(VALID_CONFIG_S33, mockFetch);
    const result = await pub.publishPost(VALID_POST_REQUEST);
    expect(result.postStatus).toBe('draft');
  });

  it('result.permalink equals link field', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(
        jsonResponse(
          { id: 200, link: 'https://ex.com/?p=200', date: '2024-01-01T00:00:00', status: 'draft' },
          201,
        ),
      );
    const pub = new WordPressMediaPublisher(VALID_CONFIG_S33, mockFetch);
    const result = await pub.publishPost(VALID_POST_REQUEST);
    expect(result.permalink).toBe('https://ex.com/?p=200');
  });
});

describe('Sprint 33 — logger injection', () => {
  it('calls logger.info on successful publishMedia', async () => {
    const mockFetch = vi.fn<FetchFunction>().mockResolvedValue(
      jsonResponse(
        {
          id: 1,
          link: 'https://ex.com/?a=1',
          source_url: 'https://ex.com/img.jpg',
          date: '2024-01-01T00:00:00',
        },
        201,
      ),
    );
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const pub = new WordPressMediaPublisher(VALID_CONFIG_S33, mockFetch, { logger });
    await pub.publishMedia({ ...VALID_REQUEST });
    expect(logger.info).toHaveBeenCalled();
    // At least one call should mention 'upload'
    const events = (logger.info as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );
    expect(events.some((e) => e.includes('upload'))).toBe(true);
  });

  it('calls logger.error on publishMedia API error', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(
        jsonResponse({ code: 'rest_not_logged_in', message: 'Not logged in.' }, 401),
      );
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const pub = new WordPressMediaPublisher(VALID_CONFIG_S33, mockFetch, { logger });
    await expect(pub.publishMedia({ ...VALID_REQUEST })).rejects.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('Sprint 33 — error categories in API responses', () => {
  it('WordPressApiError has category=auth for 401', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(
        jsonResponse({ code: 'rest_not_logged_in', message: 'Not logged in' }, 401),
      );
    const pub = new WordPressMediaPublisher(VALID_CONFIG_S33, mockFetch);
    let caught: WordPressApiError | undefined;
    try {
      await pub.publishMedia({ ...VALID_REQUEST });
    } catch (err) {
      if (err instanceof WordPressApiError) caught = err;
    }
    expect(caught?.category).toBe('auth');
  });

  it('WordPressApiError has category=rate_limit for 429', async () => {
    const mockFetch = vi
      .fn<FetchFunction>()
      .mockResolvedValue(jsonResponse({ code: 'too_many_requests', message: 'Slow down' }, 429));
    const pub = new WordPressMediaPublisher(VALID_CONFIG_S33, mockFetch);
    let caught: WordPressApiError | undefined;
    try {
      await pub.publishMedia({ ...VALID_REQUEST });
    } catch (err) {
      if (err instanceof WordPressApiError) caught = err;
    }
    expect(caught?.category).toBe('rate_limit');
  });
});

describe('Sprint 33 — validator integration', () => {
  it('rejects disallowed MIME type via validateMediaRequest', async () => {
    const mockFetch = vi.fn<FetchFunction>();
    const pub = new WordPressMediaPublisher(VALID_CONFIG_S33, mockFetch);
    await expect(
      pub.publishMedia({ ...VALID_REQUEST, mediaMimeType: 'text/html' }),
    ).rejects.toThrow(PublishingValidationError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects non-URL-safe slug via validatePostRequest', async () => {
    const mockFetch = vi.fn<FetchFunction>();
    const pub = new WordPressMediaPublisher(VALID_CONFIG_S33, mockFetch);
    await expect(
      pub.publishPost({ ...VALID_POST_REQUEST, slug: 'My Invalid Slug!' }),
    ).rejects.toThrow(PublishingValidationError);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
