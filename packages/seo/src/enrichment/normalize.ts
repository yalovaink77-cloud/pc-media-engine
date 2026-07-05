/**
 * Deterministic string and taxonomy normalization helpers.
 */

/** Strip HTML tags and collapse whitespace to plain text. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize a URL-safe slug (lowercase, hyphen-separated). */
export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Resolve slug from explicit value or derive from title. */
export function resolveSlug(slug: string | undefined, title: string): string {
  const candidate = slug?.trim() ? slug : title;
  const normalized = normalizeSlug(candidate);
  return normalized || 'untitled';
}

/** Normalize tag list: trim, lowercase, dedupe, sort for determinism. */
export function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags || tags.length === 0) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (tag.length === 0 || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }

  return result.sort();
}

/** Normalize category list: trim, lowercase, dedupe, sort for determinism. */
export function normalizeCategories(categories: string[] | undefined): string[] {
  if (!categories || categories.length === 0) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of categories) {
    const category = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (category.length === 0 || seen.has(category)) continue;
    seen.add(category);
    result.push(category);
  }

  return result.sort();
}

/** Truncate text to maxLen, breaking at last space when possible. */
export function truncateAtWord(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;

  const slice = trimmed.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxLen * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trim()}…`;
}

/** SEO title fallback from title (trimmed, max 60 chars). */
export function buildSeoTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return 'Untitled';
  return trimmed.length <= 60 ? trimmed : truncateAtWord(trimmed, 60);
}

/** Excerpt fallback from explicit excerpt or body plain text. */
export function buildExcerpt(excerpt: string | undefined, body: string, maxLen = 160): string {
  const explicit = excerpt?.trim();
  if (explicit) return explicit;

  const plain = stripHtml(body);
  if (!plain) return '';
  return truncateAtWord(plain, maxLen);
}

/** Meta description fallback (prefers excerpt, else body; max 155 chars). */
export function buildMetaDescription(excerpt: string, body: string, maxLen = 155): string {
  const fromExcerpt = excerpt.trim();
  if (fromExcerpt) {
    return fromExcerpt.length <= maxLen ? fromExcerpt : truncateAtWord(fromExcerpt, maxLen);
  }

  const plain = stripHtml(body);
  if (!plain) return '';
  return truncateAtWord(plain, maxLen);
}

/** Estimate reading time in whole minutes (200 wpm, min 1 when body has words). */
export function estimateReadingTimeMinutes(body: string, wordsPerMinute = 200): number {
  const plain = stripHtml(body);
  if (!plain) return 0;

  const words = plain.split(/\s+/).filter((w) => w.length > 0).length;
  if (words === 0) return 0;

  return Math.max(1, Math.ceil(words / wordsPerMinute));
}
