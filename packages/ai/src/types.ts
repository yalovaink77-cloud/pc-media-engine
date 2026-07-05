/**
 * Provider-neutral AI metadata enrichment types.
 */

import type { MetadataEnrichmentInput, PublishMetadata } from '@pcme/seo';

/** Input for AI metadata enrichment (same as deterministic input). */
export type AiMetadataRequest = MetadataEnrichmentInput;

/** Partial metadata suggestions from an AI provider. */
export type AiMetadataSuggestion = {
  seoTitle?: string;
  metaDescription?: string;
  excerpt?: string;
  altText?: string;
  tags?: string[];
  categories?: string[];
};

/** Result of AI metadata enrichment (includes final publish metadata). */
export type AiMetadataResult = {
  metadata: PublishMetadata;
  provider: string;
  aiApplied: boolean;
  message?: string;
};

export interface AiMetadataProvider {
  readonly name: string;
  /**
   * Return metadata suggestions to merge over deterministic baseline.
   * Return null when no AI enrichment should be applied (none provider).
   */
  suggest(
    request: AiMetadataRequest,
    baseline: PublishMetadata,
  ): Promise<AiMetadataSuggestion | null>;
}

export type AiMetadataProviderDriver = 'none' | 'mock' | 'openrouter';

export class AiMetadataProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiMetadataProviderError';
  }
}
