import type { AiMetadataProvider, AiMetadataSuggestion } from '../types.js';

/** Default provider — returns null so deterministic metadata is unchanged. */
export class NoneAiMetadataProvider implements AiMetadataProvider {
  readonly name = 'none';

  suggest(): Promise<AiMetadataSuggestion | null> {
    return Promise.resolve(null);
  }
}
