import { normalizeCategories, normalizeTags, type PublishMetadata } from '@pcme/seo';

import type { AiMetadataSuggestion } from './types.js';

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/** Merge validated AI suggestions over deterministic baseline. Empty AI values never override. */
export function mergeAiSuggestions(
  baseline: PublishMetadata,
  suggestion: AiMetadataSuggestion | null,
): PublishMetadata {
  if (!suggestion) return baseline;

  const result: PublishMetadata = { ...baseline };

  const seoTitle = nonEmpty(suggestion.seoTitle);
  if (seoTitle) result.seoTitle = seoTitle;

  const excerpt = nonEmpty(suggestion.excerpt);
  if (excerpt) result.excerpt = excerpt;

  const metaDescription = nonEmpty(suggestion.metaDescription);
  if (metaDescription) result.metaDescription = metaDescription;

  if (suggestion.tags && suggestion.tags.length > 0) {
    const normalized = normalizeTags(suggestion.tags);
    if (normalized.length > 0) result.tags = normalized;
  }

  if (suggestion.categories && suggestion.categories.length > 0) {
    const normalized = normalizeCategories(suggestion.categories);
    if (normalized.length > 0) result.categories = normalized;
  }

  const altText = nonEmpty(suggestion.altText);
  if (altText && result.image) {
    result.image = { ...result.image, altText };
  }

  return result;
}

export function hasAiSuggestions(suggestion: AiMetadataSuggestion | null): boolean {
  if (!suggestion) return false;
  return Boolean(
    nonEmpty(suggestion.seoTitle) ||
    nonEmpty(suggestion.excerpt) ||
    nonEmpty(suggestion.metaDescription) ||
    nonEmpty(suggestion.altText) ||
    (suggestion.tags && suggestion.tags.length > 0) ||
    (suggestion.categories && suggestion.categories.length > 0),
  );
}
