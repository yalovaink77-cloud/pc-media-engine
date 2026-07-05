import type { AiMetadataProviderDriver } from './types.js';
import { AiMetadataProviderError } from './types.js';

export function resolveAiMetadataProviderDriver(
  env: Record<string, string | undefined> = process.env,
): AiMetadataProviderDriver {
  const raw = (env['AI_METADATA_PROVIDER'] ?? 'none').trim().toLowerCase();
  if (raw === 'none' || raw === 'mock' || raw === 'openrouter') {
    return raw;
  }
  throw new AiMetadataProviderError(
    `Invalid AI_METADATA_PROVIDER="${raw}". Expected "none", "mock", or "openrouter".`,
  );
}
