import { enrichMetadata } from '@pcme/seo';
import { describe, expect, it, vi } from 'vitest';

import {
  createOpenRouterAiMetadataProvider,
  loadOpenRouterConfig,
  OpenRouterConfigError,
  parseSuggestionJson,
} from '../openrouter-ai-metadata.provider.js';

describe('loadOpenRouterConfig', () => {
  it('loads config when API key is present', () => {
    const config = loadOpenRouterConfig({
      OPENROUTER_API_KEY: 'sk-test',
      OPENROUTER_MODEL: 'anthropic/claude-3.5-sonnet',
    });
    expect(config.apiKey).toBe('sk-test');
    expect(config.model).toBe('anthropic/claude-3.5-sonnet');
  });

  it('uses default model when OPENROUTER_MODEL is unset', () => {
    const config = loadOpenRouterConfig({ OPENROUTER_API_KEY: 'sk-test' });
    expect(config.model).toBe('openai/gpt-4o-mini');
  });

  it('fails fast when OPENROUTER_API_KEY is missing', () => {
    expect(() => loadOpenRouterConfig({})).toThrow(OpenRouterConfigError);
  });
});

describe('parseSuggestionJson', () => {
  it('parses valid JSON suggestion', () => {
    const result = parseSuggestionJson(
      JSON.stringify({
        seoTitle: 'Better Title',
        metaDescription: 'Meta',
        excerpt: 'Excerpt',
        altText: 'Alt',
        tags: ['a', 'b'],
        categories: ['c'],
      }),
    );
    expect(result.seoTitle).toBe('Better Title');
    expect(result.tags).toEqual(['a', 'b']);
  });
});

describe('OpenRouterAiMetadataProvider', () => {
  const baseline = enrichMetadata({
    title: 'Test Article',
    body: '<p>Body text here.</p>',
  });

  it('calls OpenRouter with mocked fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  seoTitle: 'AI Title',
                  metaDescription: 'AI Meta',
                  excerpt: 'AI Excerpt',
                  tags: ['ai-tag'],
                  categories: ['ai-cat'],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const provider = createOpenRouterAiMetadataProvider(
      { OPENROUTER_API_KEY: 'sk-test' },
      mockFetch,
    );

    const suggestion = await provider.suggest(
      { title: 'Test Article', body: '<p>Body</p>' },
      baseline,
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(suggestion?.seoTitle).toBe('AI Title');
    expect(suggestion?.tags).toEqual(['ai-tag']);
  });

  it('throws when OpenRouter returns non-OK status', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const provider = createOpenRouterAiMetadataProvider(
      { OPENROUTER_API_KEY: 'sk-test' },
      mockFetch,
    );

    await expect(provider.suggest({ title: 'T', body: 'B' }, baseline)).rejects.toThrow('HTTP 401');
  });
});
