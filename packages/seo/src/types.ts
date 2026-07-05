/**
 * Input for deterministic metadata enrichment.
 * Platform-neutral — no provider-specific fields.
 */

export type ImageMetadataInput = {
  width?: number;
  height?: number;
  mimeType?: string;
};

export type MetadataEnrichmentInput = {
  /** Primary title (required). */
  title: string;
  /** Optional slug; normalized or derived from title when absent. */
  slug?: string;
  /** Body content (HTML or plain text). */
  body: string;
  excerpt?: string;
  tags?: string[];
  categories?: string[];
  image?: ImageMetadataInput;
};

export type ImageOrientation = 'landscape' | 'portrait' | 'square' | 'unknown';

export type EnrichedImageMetadata = {
  orientation: ImageOrientation;
  altText: string;
};

/**
 * Publish-ready metadata produced by the enrichment layer.
 */
export type PublishMetadata = {
  slug: string;
  seoTitle: string;
  excerpt: string;
  metaDescription: string;
  readingTimeMinutes: number;
  tags: string[];
  categories: string[];
  image?: EnrichedImageMetadata;
};
