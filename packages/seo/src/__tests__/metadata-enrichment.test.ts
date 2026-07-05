import { describe, expect, it } from 'vitest';

import { buildAltTextPlaceholder, resolveImageOrientation } from '../enrichment/image.js';
import {
  enrichMetadata,
  MetadataEnrichmentService,
} from '../enrichment/metadata-enrichment.service.js';
import {
  buildExcerpt,
  buildMetaDescription,
  buildSeoTitle,
  estimateReadingTimeMinutes,
  normalizeCategories,
  normalizeSlug,
  normalizeTags,
  resolveSlug,
} from '../enrichment/normalize.js';
import type { MetadataEnrichmentInput } from '../types.js';

const SAMPLE: MetadataEnrichmentInput = {
  title: 'Industrial Piercing Aftercare Guide',
  slug: '  Industrial-Piercing-Guide  ',
  body: '<p>Clean your piercing twice daily with saline solution. Avoid touching the area.</p>',
  excerpt: '  Keep your industrial piercing clean.  ',
  tags: [' Aftercare ', 'industrial', 'AFTERCARE', '  '],
  categories: ['Care Guides', 'care guides', 'Piercing'],
  image: { width: 1920, height: 1080, mimeType: 'image/jpeg' },
};

describe('normalizeSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(normalizeSlug('Hello World!')).toBe('hello-world');
  });

  it('collapses multiple separators', () => {
    expect(normalizeSlug('  Foo   Bar  ')).toBe('foo-bar');
  });
});

describe('resolveSlug', () => {
  it('normalizes provided slug', () => {
    expect(resolveSlug('  Industrial-Piercing-Guide  ', 'Title')).toBe('industrial-piercing-guide');
  });

  it('derives slug from title when slug is absent', () => {
    expect(resolveSlug(undefined, 'Hello World')).toBe('hello-world');
  });
});

describe('buildSeoTitle', () => {
  it('uses title as SEO title fallback', () => {
    expect(buildSeoTitle('My Article')).toBe('My Article');
  });

  it('truncates long titles', () => {
    const long = 'A'.repeat(80);
    expect(buildSeoTitle(long).length).toBeLessThanOrEqual(61);
  });
});

describe('buildExcerpt', () => {
  it('uses explicit excerpt when provided', () => {
    expect(buildExcerpt('Custom excerpt', '<p>Body</p>')).toBe('Custom excerpt');
  });

  it('falls back to body plain text', () => {
    const result = buildExcerpt(undefined, '<p>First sentence here.</p>');
    expect(result).toContain('First sentence');
  });
});

describe('buildMetaDescription', () => {
  it('prefers excerpt for meta description', () => {
    expect(buildMetaDescription('Short excerpt', '<p>Long body text</p>')).toBe('Short excerpt');
  });

  it('falls back to body when excerpt is empty', () => {
    const result = buildMetaDescription('', '<p>Body fallback text here.</p>');
    expect(result).toContain('Body fallback');
  });
});

describe('estimateReadingTimeMinutes', () => {
  it('returns 0 for empty body', () => {
    expect(estimateReadingTimeMinutes('')).toBe(0);
  });

  it('estimates at 200 wpm', () => {
    const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
    expect(estimateReadingTimeMinutes(words)).toBe(2);
  });

  it('minimum 1 minute when body has words', () => {
    expect(estimateReadingTimeMinutes('one two three')).toBe(1);
  });
});

describe('normalizeTags', () => {
  it('lowercases, dedupes, and sorts', () => {
    expect(normalizeTags([' Aftercare ', 'industrial', 'AFTERCARE'])).toEqual([
      'aftercare',
      'industrial',
    ]);
  });

  it('returns empty array for missing tags', () => {
    expect(normalizeTags(undefined)).toEqual([]);
  });
});

describe('normalizeCategories', () => {
  it('lowercases, dedupes, and sorts', () => {
    expect(normalizeCategories(['Care Guides', 'care guides', 'Piercing'])).toEqual([
      'care guides',
      'piercing',
    ]);
  });
});

describe('resolveImageOrientation', () => {
  it('returns landscape when width > height', () => {
    expect(resolveImageOrientation({ width: 1920, height: 1080 })).toBe('landscape');
  });

  it('returns portrait when height > width', () => {
    expect(resolveImageOrientation({ width: 600, height: 900 })).toBe('portrait');
  });

  it('returns square when width === height', () => {
    expect(resolveImageOrientation({ width: 512, height: 512 })).toBe('square');
  });

  it('returns unknown when dimensions missing', () => {
    expect(resolveImageOrientation({ mimeType: 'image/jpeg' })).toBe('unknown');
  });
});

describe('buildAltTextPlaceholder', () => {
  it('builds deterministic alt text from title', () => {
    expect(buildAltTextPlaceholder('My Photo')).toBe('Image: My Photo');
  });
});

describe('MetadataEnrichmentService', () => {
  it('produces full publish metadata', () => {
    const result = enrichMetadata(SAMPLE);

    expect(result.slug).toBe('industrial-piercing-guide');
    expect(result.seoTitle).toBe('Industrial Piercing Aftercare Guide');
    expect(result.excerpt).toBe('Keep your industrial piercing clean.');
    expect(result.metaDescription).toBe('Keep your industrial piercing clean.');
    expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    expect(result.tags).toEqual(['aftercare', 'industrial']);
    expect(result.categories).toEqual(['care guides', 'piercing']);
    expect(result.image?.orientation).toBe('landscape');
    expect(result.image?.altText).toBe('Image: Industrial Piercing Aftercare Guide');
  });

  it('handles empty optional fields', () => {
    const result = enrichMetadata({
      title: 'Minimal Post',
      body: '',
    });

    expect(result.slug).toBe('minimal-post');
    expect(result.tags).toEqual([]);
    expect(result.categories).toEqual([]);
    expect(result.excerpt).toBe('');
    expect(result.metaDescription).toBe('');
    expect(result.readingTimeMinutes).toBe(0);
    expect(result.image).toBeUndefined();
  });

  it('is deterministic — same input produces same output', () => {
    const service = new MetadataEnrichmentService();
    const r1 = service.enrich(SAMPLE);
    const r2 = service.enrich(SAMPLE);
    expect(r1).toEqual(r2);
  });
});
