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
