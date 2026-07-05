/**
 * AiMetadataEnrichmentService — optional AI layer on deterministic metadata.
 *
 * 1. Always runs deterministic enrichment first (@pcme/seo).
 * 2. Optionally merges AI suggestions from a provider.
 * 3. Falls back to deterministic metadata on AI failure.
 */

import { enrichMetadata } from '@pcme/seo';

import { resolveAiMetadataProviderDriver } from './driver.js';
import { hasAiSuggestions, mergeAiSuggestions } from './merge.js';
import { MockAiMetadataProvider } from './providers/mock.provider.js';
import { NoneAiMetadataProvider } from './providers/none.provider.js';
import type { AiMetadataProvider, AiMetadataRequest, AiMetadataResult } from './types.js';

export type AiMetadataEnrichmentServiceOptions = {
  provider?: AiMetadataProvider;
  env?: Record<string, string | undefined>;
};

export function createAiMetadataProvider(
  env: Record<string, string | undefined> = process.env,
): AiMetadataProvider {
  const driver = resolveAiMetadataProviderDriver(env);
  if (driver === 'mock') return new MockAiMetadataProvider();
  return new NoneAiMetadataProvider();
}

export class AiMetadataEnrichmentService {
  constructor(private readonly provider: AiMetadataProvider = new NoneAiMetadataProvider()) {}

  async enrich(request: AiMetadataRequest): Promise<AiMetadataResult> {
    const baseline = enrichMetadata(request);

    try {
      const suggestion = await this.provider.suggest(request, baseline);
      const metadata = mergeAiSuggestions(baseline, suggestion);

      return {
        metadata,
        provider: this.provider.name,
        aiApplied: hasAiSuggestions(suggestion),
        message: hasAiSuggestions(suggestion)
          ? `AI enrichment applied via ${this.provider.name}`
          : `Deterministic metadata unchanged (${this.provider.name})`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown AI error';
      return {
        metadata: baseline,
        provider: this.provider.name,
        aiApplied: false,
        message: `AI enrichment failed, using deterministic metadata: ${message}`,
      };
    }
  }
}

export function createAiMetadataEnrichmentService(
  options: AiMetadataEnrichmentServiceOptions = {},
): AiMetadataEnrichmentService {
  const provider = options.provider ?? createAiMetadataProvider(options.env ?? process.env);
  return new AiMetadataEnrichmentService(provider);
}
