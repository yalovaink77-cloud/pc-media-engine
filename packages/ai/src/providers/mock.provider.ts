import { type PublishMetadata, resolveSlug } from '@pcme/seo';

import type { AiMetadataProvider, AiMetadataRequest, AiMetadataSuggestion } from '../types.js';

/** Deterministic mock provider for tests and offline development. */
export class MockAiMetadataProvider implements AiMetadataProvider {
  readonly name = 'mock';

  suggest(
    request: AiMetadataRequest,
    baseline: PublishMetadata,
  ): Promise<AiMetadataSuggestion | null> {
    const slug = resolveSlug(request.slug, request.title);

    return Promise.resolve({
      seoTitle: `[AI] ${baseline.seoTitle}`,
      metaDescription: `[AI] ${baseline.metaDescription}`,
      excerpt: `[AI] ${baseline.excerpt}`,
      altText: baseline.image ? `[AI] ${baseline.image.altText}` : undefined,
      tags: [...baseline.tags, `${slug}-ai`].sort(),
      categories: baseline.categories,
    });
  }
}
