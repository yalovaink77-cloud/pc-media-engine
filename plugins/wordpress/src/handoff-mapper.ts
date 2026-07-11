import type { PublishingHandoffPackage, PublishingMetadataPublishStatus } from '@pcme/publishing';

import type { WordPressHandoffPostStatus } from './handoff-config.js';

export interface WordPressHandoffPostPayload {
  readonly title: string;
  readonly slug: string;
  readonly content: string;
  readonly status: WordPressHandoffPostStatus;
  readonly excerpt?: string;
  readonly categories?: readonly number[];
  readonly tags?: readonly string[];
  readonly author?: number;
  readonly featured_media?: number;
  readonly date?: string;
  readonly date_gmt?: string;
  readonly meta?: Readonly<Record<string, string>>;
}

export interface MapHandoffOptions {
  readonly forceDraft?: boolean;
  readonly defaultStatus?: WordPressHandoffPostStatus;
  readonly defaultAuthor?: string;
}

const HTML_TAG_PATTERN = /<[^>]+>/;

export function convertMarkdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const htmlLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith('### ')) {
      htmlLines.push(`<h3>${escapeHtml(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith('## ')) {
      htmlLines.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith('# ')) {
      htmlLines.push(`<h1>${escapeHtml(trimmed.slice(2))}</h1>`);
    } else {
      htmlLines.push(`<p>${escapeHtml(trimmed)}</p>`);
    }
  }

  return htmlLines.join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function convertHandoffContent(format: string, content: string): string {
  if (format === 'html' || HTML_TAG_PATTERN.test(content)) {
    return content;
  }
  if (format === 'plain-text') {
    return content
      .split('\n\n')
      .map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`)
      .join('\n');
  }
  return convertMarkdownToHtml(content);
}

export function mapPublishStatus(
  publishStatus: PublishingMetadataPublishStatus | undefined,
  options?: MapHandoffOptions,
): WordPressHandoffPostStatus {
  if (options?.forceDraft) {
    return 'draft';
  }

  switch (publishStatus) {
    case 'pending':
      return 'pending';
    case 'private':
      return 'private';
    case 'publish':
      return 'publish';
    case 'scheduled':
      return 'future';
    case 'draft':
    default:
      return options?.defaultStatus ?? 'draft';
  }
}

function parseNumericIds(values: readonly string[] | undefined): number[] {
  if (!values) {
    return [];
  }
  return values
    .map((value) => Number.parseInt(value, 10))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function parseAuthorId(author: string | undefined, fallback?: string): number | undefined {
  const candidate = author?.trim() || fallback?.trim();
  if (!candidate) {
    return undefined;
  }
  const parsed = Number.parseInt(candidate, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseFeaturedMediaId(featuredImageRef: string | undefined): number | undefined {
  if (!featuredImageRef?.trim()) {
    return undefined;
  }
  const parsed = Number.parseInt(featuredImageRef, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** Map a publishing handoff package to a WordPress REST post payload. */
export function mapHandoffToWordPressPost(
  pkg: PublishingHandoffPackage,
  options?: MapHandoffOptions,
): WordPressHandoffPostPayload {
  const metadata = pkg.publishingMetadata;
  const status = mapPublishStatus(metadata.publishStatus, options);
  const payload: WordPressHandoffPostPayload = Object.freeze({
    title: metadata.title.trim(),
    slug: metadata.slug.trim(),
    content: convertHandoffContent(pkg.format, pkg.content),
    status,
    excerpt: metadata.excerpt?.trim() || undefined,
    categories: Object.freeze(parseNumericIds(metadata.categories)),
    tags: metadata.tags ? Object.freeze([...metadata.tags]) : undefined,
    author: parseAuthorId(metadata.author, options?.defaultAuthor),
    featured_media: parseFeaturedMediaId(metadata.featuredImageRef),
    meta: Object.freeze({
      _pcme_handoff_id: pkg.handoffId,
      ...(metadata.canonicalUrl ? { canonical_url: metadata.canonicalUrl } : {}),
    }),
  });

  if (status === 'future' && metadata.scheduledAt) {
    const scheduled = new Date(metadata.scheduledAt);
    if (!Number.isNaN(scheduled.getTime())) {
      return Object.freeze({
        ...payload,
        date: scheduled.toISOString(),
        date_gmt: scheduled.toISOString(),
      });
    }
  }

  return payload;
}

export function buildHandoffPublishRequestSummary(pkg: PublishingHandoffPackage): {
  handoffId: string;
  slug: string;
  contentLength: number;
  format: string;
  requestedStatus: WordPressHandoffPostStatus;
} {
  return {
    handoffId: pkg.handoffId,
    slug: pkg.publishingMetadata.slug,
    contentLength: pkg.content.length,
    format: pkg.format,
    requestedStatus: mapPublishStatus(pkg.publishingMetadata.publishStatus),
  };
}
