import { enrichMetadata } from '@pcme/seo';
import { describe, expect, it, vi } from 'vitest';

import {
  AiMetadataEnrichmentService,
  createAiMetadataProvider,
} from '../ai-metadata-enrichment.service.js';
import { resolveAiMetadataProviderDriver } from '../driver.js';
import { mergeAiSuggestions } from '../merge.js';
import { MockAiMetadataProvider } from '../providers/mock.provider.js';
import { NoneAiMetadataProvider } from '../providers/none.provider.js';
import type { AiMetadataProvider, AiMetadataRequest, AiMetadataSuggestion } from '../types.js';
import { AiMetadataProviderError } from '../types.js';

const REQUEST: AiMetadataRequest = {
  title: 'Industrial Piercing Aftercare',
  body: '<p>Clean twice daily with saline solution for best results.</p>',
  tags: ['aftercare'],
  categories: ['Care Guides'],
  image: { width: 800, height: 600, mimeType: 'image/jpeg' },
};

describe('resolveAiMetadataProviderDriver', () => {
  it('defaults to none', () => {
    expect(resolveAiMetadataProviderDriver({})).toBe('none');
  });

  it('accepts mock', () => {
    expect(resolveAiMetadataProviderDriver({ AI_METADATA_PROVIDER: 'mock' })).toBe('mock');
  });

  it('rejects unknown driver', () => {
    expect(() => resolveAiMetadataProviderDriver({ AI_METADATA_PROVIDER: 'gpt' })).toThrow(
      AiMetadataProviderError,
    );
  });
});

describe('createAiMetadataProvider', () => {
  it('returns NoneAiMetadataProvider by default', () => {
    expect(createAiMetadataProvider({}).name).toBe('none');
  });

  it('returns MockAiMetadataProvider when driver is mock', () => {
    expect(createAiMetadataProvider({ AI_METADATA_PROVIDER: 'mock' }).name).toBe('mock');
  });
});

describe('NoneAiMetadataProvider', () => {
  it('returns deterministic metadata unchanged', async () => {
    const service = new AiMetadataEnrichmentService(new NoneAiMetadataProvider());
    const baseline = enrichMetadata(REQUEST);
    const result = await service.enrich(REQUEST);

    expect(result.aiApplied).toBe(false);
    expect(result.metadata).toEqual(baseline);
    expect(result.provider).toBe('none');
  });
});

describe('MockAiMetadataProvider', () => {
  it('enriches metadata deterministically', async () => {
    const service = new AiMetadataEnrichmentService(new MockAiMetadataProvider());
    const result = await service.enrich(REQUEST);

    expect(result.aiApplied).toBe(true);
    expect(result.metadata.seoTitle).toMatch(/^\[AI\] /);
    expect(result.metadata.tags).toContain('industrial-piercing-aftercare-ai');
    expect(result.metadata.image?.altText).toMatch(/^\[AI\] /);
  });

  it('produces same output on repeated calls', async () => {
    const service = new AiMetadataEnrichmentService(new MockAiMetadataProvider());
    const r1 = await service.enrich(REQUEST);
    const r2 = await service.enrich(REQUEST);
    expect(r1.metadata).toEqual(r2.metadata);
  });
});

describe('mergeAiSuggestions', () => {
  const baseline = enrichMetadata(REQUEST);

  it('does not override with empty AI values', () => {
    const merged = mergeAiSuggestions(baseline, {
      seoTitle: '   ',
      metaDescription: '',
      excerpt: '',
    });
    expect(merged.seoTitle).toBe(baseline.seoTitle);
    expect(merged.metaDescription).toBe(baseline.metaDescription);
  });

  it('normalizes enriched tags and categories', () => {
    const merged = mergeAiSuggestions(baseline, {
      tags: [' NEW Tag ', 'new tag', 'Extra'],
      categories: [' Guides ', 'guides'],
    });
    expect(merged.tags).toEqual(['extra', 'new tag']);
    expect(merged.categories).toEqual(['guides']);
  });

  it('falls back for malformed empty suggestion object', () => {
    const merged = mergeAiSuggestions(baseline, {});
    expect(merged).toEqual(baseline);
  });
});

describe('AiMetadataEnrichmentService — AI failure fallback', () => {
  it('returns deterministic metadata when provider throws', async () => {
    const failingProvider: AiMetadataProvider = {
      name: 'failing',
      suggest: vi.fn().mockRejectedValue(new Error('network down')),
    };

    const service = new AiMetadataEnrichmentService(failingProvider);
    const baseline = enrichMetadata(REQUEST);
    const result = await service.enrich(REQUEST);

    expect(result.aiApplied).toBe(false);
    expect(result.metadata).toEqual(baseline);
    expect(result.message).toContain('AI enrichment failed');
  });
});

describe('AiMetadataEnrichmentService — malformed AI output fallback', () => {
  it('keeps deterministic fields when AI returns empty strings', async () => {
    const emptyProvider: AiMetadataProvider = {
      name: 'empty-ai',
      suggest: vi.fn().mockResolvedValue({
        seoTitle: '',
        metaDescription: '   ',
        excerpt: '',
        altText: '',
        tags: [],
        categories: [],
      } satisfies AiMetadataSuggestion),
    };

    const service = new AiMetadataEnrichmentService(emptyProvider);
    const baseline = enrichMetadata(REQUEST);
    const result = await service.enrich(REQUEST);

    expect(result.aiApplied).toBe(false);
    expect(result.metadata.seoTitle).toBe(baseline.seoTitle);
    expect(result.metadata.metaDescription).toBe(baseline.metaDescription);
  });
});
