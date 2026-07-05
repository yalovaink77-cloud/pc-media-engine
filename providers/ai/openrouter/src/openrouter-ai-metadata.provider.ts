/**
 * OpenRouter AI metadata provider.
 *
 * Requires OPENROUTER_API_KEY. Optional OPENROUTER_MODEL (default: openai/gpt-4o-mini).
 * No network calls in unit tests — inject fetchFn.
 */

import type { AiMetadataProvider, AiMetadataRequest, AiMetadataSuggestion } from '@pcme/ai';
import type { PublishMetadata } from '@pcme/seo';

export type FetchFunction = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type OpenRouterConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

export class OpenRouterConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenRouterConfigError';
  }
}

export function loadOpenRouterConfig(
  env: Record<string, string | undefined> = process.env,
): OpenRouterConfig {
  const apiKey = env['OPENROUTER_API_KEY'] ?? '';
  if (!apiKey.trim()) {
    throw new OpenRouterConfigError(
      'OPENROUTER_API_KEY is required when using the OpenRouter AI metadata provider',
    );
  }

  return {
    apiKey: apiKey.trim(),
    model: (env['OPENROUTER_MODEL'] ?? 'openai/gpt-4o-mini').trim(),
    baseUrl: (env['OPENROUTER_BASE_URL'] ?? 'https://openrouter.ai/api/v1').replace(/\/+$/, ''),
  };
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
};

export class OpenRouterAiMetadataProvider implements AiMetadataProvider {
  readonly name = 'openrouter';

  constructor(
    private readonly config: OpenRouterConfig,
    private readonly fetchFn: FetchFunction = globalThis.fetch,
  ) {}

  async suggest(
    request: AiMetadataRequest,
    baseline: PublishMetadata,
  ): Promise<AiMetadataSuggestion | null> {
    const prompt = buildPrompt(request, baseline);

    const response = await this.fetchFn(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a metadata assistant. Respond with JSON only. Fields: seoTitle, metaDescription, excerpt, altText, tags (array), categories (array). Platform-neutral, no markdown.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenRouter response missing content');
    }

    return parseSuggestionJson(content);
  }
}

function buildPrompt(request: AiMetadataRequest, baseline: PublishMetadata): string {
  return JSON.stringify({
    title: request.title,
    body: request.body.slice(0, 2000),
    baseline: {
      seoTitle: baseline.seoTitle,
      metaDescription: baseline.metaDescription,
      excerpt: baseline.excerpt,
      tags: baseline.tags,
      categories: baseline.categories,
      altText: baseline.image?.altText,
    },
  });
}

export function parseSuggestionJson(raw: string): AiMetadataSuggestion {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const suggestion: AiMetadataSuggestion = {};

  if (typeof parsed['seoTitle'] === 'string') suggestion.seoTitle = parsed['seoTitle'];
  if (typeof parsed['metaDescription'] === 'string') {
    suggestion.metaDescription = parsed['metaDescription'];
  }
  if (typeof parsed['excerpt'] === 'string') suggestion.excerpt = parsed['excerpt'];
  if (typeof parsed['altText'] === 'string') suggestion.altText = parsed['altText'];
  if (Array.isArray(parsed['tags'])) {
    suggestion.tags = parsed['tags'].filter((t): t is string => typeof t === 'string');
  }
  if (Array.isArray(parsed['categories'])) {
    suggestion.categories = parsed['categories'].filter((c): c is string => typeof c === 'string');
  }

  return suggestion;
}

export function createOpenRouterAiMetadataProvider(
  env: Record<string, string | undefined> = process.env,
  fetchFn?: FetchFunction,
): OpenRouterAiMetadataProvider {
  return new OpenRouterAiMetadataProvider(loadOpenRouterConfig(env), fetchFn);
}
