/**
 * MetadataEnrichmentService — deterministic, platform-neutral metadata enrichment.
 *
 * No AI, no network, no randomness. Same input always produces same output.
 */

import type { MetadataEnrichmentInput, PublishMetadata } from '../types.js';
import { buildAltTextPlaceholder, resolveImageOrientation } from './image.js';
import {
  buildExcerpt,
  buildMetaDescription,
  buildSeoTitle,
  estimateReadingTimeMinutes,
  normalizeCategories,
  normalizeTags,
  resolveSlug,
} from './normalize.js';

export class MetadataEnrichmentService {
  enrich(input: MetadataEnrichmentInput): PublishMetadata {
    const slug = resolveSlug(input.slug, input.title);
    const seoTitle = buildSeoTitle(input.title);
    const excerpt = buildExcerpt(input.excerpt, input.body);
    const metaDescription = buildMetaDescription(excerpt, input.body);
    const readingTimeMinutes = estimateReadingTimeMinutes(input.body);
    const tags = normalizeTags(input.tags);
    const categories = normalizeCategories(input.categories);

    const result: PublishMetadata = {
      slug,
      seoTitle,
      excerpt,
      metaDescription,
      readingTimeMinutes,
      tags,
      categories,
    };

    if (input.image !== undefined) {
      result.image = {
        orientation: resolveImageOrientation(input.image),
        altText: buildAltTextPlaceholder(input.title),
      };
    }

    return result;
  }
}

/** Convenience function — stateless enrichment. */
export function enrichMetadata(input: MetadataEnrichmentInput): PublishMetadata {
  return new MetadataEnrichmentService().enrich(input);
}
