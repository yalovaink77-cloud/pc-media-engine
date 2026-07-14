export { extractMarkdownFaqEntries, type FaqEntry } from './analysis/faq.js';
export {
  containsNormalizedPhrase,
  normalizeSeoText,
  partitionKeywordCoverage,
} from './analysis/text.js';
export { buildAltTextPlaceholder, resolveImageOrientation } from './enrichment/image.js';
export {
  enrichMetadata,
  MetadataEnrichmentService,
} from './enrichment/metadata-enrichment.service.js';
export {
  buildExcerpt,
  buildMetaDescription,
  buildSeoTitle,
  estimateReadingTimeMinutes,
  normalizeCategories,
  normalizeSlug,
  normalizeTags,
  resolveSlug,
  stripHtml,
  truncateAtWord,
} from './enrichment/normalize.js';
export type {
  EnrichedImageMetadata,
  ImageMetadataInput,
  ImageOrientation,
  MetadataEnrichmentInput,
  PublishMetadata,
} from './types.js';
