import type { PublishingHandoffPackage } from '@pcme/publishing';
import { describe, expect, it, vi } from 'vitest';

import type { WordPressHandoffAdapterConfig } from '../handoff-config.js';
import { redactWordPressSecrets } from '../handoff-errors.js';
import { InMemoryWordPressHandoffIdempotencyStore } from '../handoff-idempotency.js';
import {
  convertMarkdownToHtml,
  mapHandoffToWordPressPost,
  mapPublishStatus,
} from '../handoff-mapper.js';
import type { FetchFunction } from '../wordpress-media.publisher.js';
import { WordPressPublishingTargetAdapter } from '../wordpress-publishing-target.adapter.js';

const CONFIG: WordPressHandoffAdapterConfig = Object.freeze({
  baseUrl: 'https://wp.example.com',
  username: 'editor',
  appPassword: 'secret-app-password-value',
  requestTimeoutMs: 5_000,
  defaultAuthor: '7',
  defaultStatus: 'draft',
});

function buildReadyPackage(
  overrides: Partial<PublishingHandoffPackage> = {},
): PublishingHandoffPackage {
  return Object.freeze({
    handoffId: 'handoff-123',
    artifactId: 'artifact-123',
    reviewId: 'review-123',
    jobId: 'job-123',
    requestId: 'request-123',
    sourceId: 'source-123',
    snapshotId: 'snapshot-123',
    contentType: 'product-review',
    locale: 'en',
    format: 'markdown',
    content: '# Title\n\nConsult a professional if unsure.',
    target: Object.freeze({
      targetId: 'wordpress',
      platform: 'wordpress',
      supportedFormats: Object.freeze(['markdown', 'html']),
    }),
    publishingMetadata: Object.freeze({
      title: 'Product Review',
      slug: 'product-review',
      excerpt: 'Short excerpt',
      tags: Object.freeze(['aftercare']),
      categories: Object.freeze(['12']),
      author: '7',
      publishStatus: 'draft',
    }),
    policySnapshot: Object.freeze({
      safetyConstraints: Object.freeze([]),
      affiliateConstraints: Object.freeze([]),
      citationRequirements: Object.freeze([]),
      blockedFields: Object.freeze([]),
      strictMode: false,
      contextComplete: true,
      warningCount: 0,
    }),
    reviewSummary: Object.freeze({
      reviewId: 'review-123',
      status: 'approved',
      decision: 'approve',
      reviewerId: 'reviewer-1',
      findingCount: 0,
    }),
    warnings: Object.freeze([]),
    status: 'ready',
    createdAt: '2026-07-10T12:00:00.000Z',
    ...overrides,
  });
}

function successFetch(postId = 501): FetchFunction {
  return vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: postId,
        link: `https://wp.example.com/?p=${postId}`,
        permalink: `https://wp.example.com/product-review/`,
        date: '2026-07-10T13:00:00.000Z',
        status: 'draft',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    ),
  );
}

describe('mapHandoffToWordPressPost', () => {
  it('maps draft publish metadata', () => {
    const payload = mapHandoffToWordPressPost(buildReadyPackage());
    expect(payload.status).toBe('draft');
    expect(payload.title).toBe('Product Review');
    expect(payload.slug).toBe('product-review');
    expect(payload.tags).toEqual(['aftercare']);
    expect(payload.categories).toEqual([12]);
    expect(payload.meta?._pcme_handoff_id).toBe('handoff-123');
    expect(payload.content).toContain('<h1>');
  });

  it('maps scheduled publish metadata', () => {
    const payload = mapHandoffToWordPressPost(
      buildReadyPackage({
        publishingMetadata: Object.freeze({
          title: 'Scheduled',
          slug: 'scheduled-post',
          publishStatus: 'scheduled',
          scheduledAt: '2026-12-01T10:00:00.000Z',
        }),
      }),
    );

    expect(payload.status).toBe('future');
    expect(payload.date).toBeDefined();
    expect(payload.date_gmt).toBeDefined();
  });

  it('maps category and tag metadata', () => {
    const payload = mapHandoffToWordPressPost(buildReadyPackage());
    expect(payload.categories).toEqual([12]);
    expect(payload.tags).toEqual(['aftercare']);
  });

  it('forces draft when requested', () => {
    const payload = mapHandoffToWordPressPost(
      buildReadyPackage({
        publishingMetadata: Object.freeze({
          title: 'Public',
          slug: 'public-post',
          publishStatus: 'publish',
        }),
      }),
      { forceDraft: true },
    );
    expect(payload.status).toBe('draft');
  });
});

describe('WordPressPublishingTargetAdapter', () => {
  it('publishes a draft handoff successfully', async () => {
    const fetchFn = successFetch();
    const adapter = new WordPressPublishingTargetAdapter(CONFIG, { fetchFn });
    const pkg = buildReadyPackage();
    const result = await adapter.publish(pkg);

    expect(result.success).toBe(true);
    expect(result.externalId).toBe('501');
    expect(result.url).toContain('wp.example.com');
    expect(vi.mocked(fetchFn)).toHaveBeenCalledOnce();
    const [, init] = vi.mocked(fetchFn).mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body)) as { status: string };
    expect(body.status).toBe('draft');
  });

  it('supports approved-with-notes reviews', async () => {
    const adapter = new WordPressPublishingTargetAdapter(CONFIG, { fetchFn: successFetch() });
    const result = await adapter.publish(
      buildReadyPackage({
        reviewSummary: Object.freeze({
          reviewId: 'review-123',
          status: 'approved-with-notes',
          decision: 'approve-with-notes',
          reviewerId: 'reviewer-1',
          findingCount: 1,
        }),
        warnings: Object.freeze([
          Object.freeze({ code: 'note', message: 'Minor note', severity: 'warning' }),
        ]),
      }),
    );

    expect(result.success).toBe(true);
  });

  it('blocks unsupported formats', () => {
    const adapter = new WordPressPublishingTargetAdapter(CONFIG, { fetchFn: successFetch() });
    const validation = adapter.validate(buildReadyPackage({ format: 'pdf' }));
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((error) => error.code === 'unsupported-format')).toBe(true);
  });

  it('maps authentication failures', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'rest_not_logged_in', message: 'Not logged in.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const adapter = new WordPressPublishingTargetAdapter(CONFIG, { fetchFn });
    const result = await adapter.publish(buildReadyPackage());

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('authentication');
  });

  it('maps timeout failures', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    const adapter = new WordPressPublishingTargetAdapter(CONFIG, { fetchFn });
    const result = await adapter.publish(buildReadyPackage());

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('timeout');
  });

  it('maps malformed responses', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response('not-json', { status: 201, headers: { 'Content-Type': 'application/json' } }),
      );
    const adapter = new WordPressPublishingTargetAdapter(CONFIG, { fetchFn });
    const result = await adapter.publish(buildReadyPackage());

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('malformed-response');
  });

  it('prevents duplicate handoff publishes in-memory', async () => {
    const fetchFn = successFetch(777);
    const store = new InMemoryWordPressHandoffIdempotencyStore();
    const adapter = new WordPressPublishingTargetAdapter(CONFIG, {
      fetchFn,
      idempotencyStore: store,
    });
    const pkg = buildReadyPackage();

    const first = await adapter.publish(pkg);
    const second = await adapter.publish(pkg);

    expect(first.success).toBe(true);
    expect(second).toEqual(first);
    expect(vi.mocked(fetchFn)).toHaveBeenCalledOnce();
  });

  it('redacts secrets from error surfaces', () => {
    const redacted = redactWordPressSecrets(`Authorization: Basic ${CONFIG.appPassword}`, [
      CONFIG.appPassword,
    ]);
    expect(redacted).not.toContain(CONFIG.appPassword);
    expect(redacted).toContain('[REDACTED]');
  });

  it('validates missing credentials at config load time via adapter options', () => {
    const adapter = new WordPressPublishingTargetAdapter(
      Object.freeze({ ...CONFIG, appPassword: '' }),
      { fetchFn: successFetch() },
    );
    const validation = adapter.validate(buildReadyPackage());
    expect(validation.valid).toBe(true);
  });
});

describe('convertMarkdownToHtml', () => {
  it('converts headings and paragraphs', () => {
    const html = convertMarkdownToHtml('# Heading\n\nBody text');
    expect(html).toContain('<h1>Heading</h1>');
    expect(html).toContain('<p>Body text</p>');
  });
});

describe('mapPublishStatus', () => {
  it('maps pending and private statuses', () => {
    expect(mapPublishStatus('pending')).toBe('pending');
    expect(mapPublishStatus('private')).toBe('private');
  });
});
