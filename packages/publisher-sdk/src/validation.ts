/**
 * Provider validation helpers — Sprint 34.
 *
 * Shared validation for provider metadata and capability descriptors.
 * Used at registration time to catch misconfigured providers early.
 */

import type { ConfigValidationResult } from './config.js';
import type { ProviderMetadata, PublisherCapabilities } from './provider.js';

/** Lowercase alphanumeric + hyphens, e.g. "wordpress", "dev-to". */
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

const CAPABILITY_KEYS: (keyof PublisherCapabilities)[] = [
  'mediaUpload',
  'postCreation',
  'drafts',
  'tags',
  'categories',
  'featuredImages',
  'scheduling',
  'update',
  'delete',
];

/**
 * Validate a `ProviderMetadata` object.
 * Returns errors for missing or malformed fields; warnings for soft issues.
 */
export function validateProviderMetadata(metadata: ProviderMetadata): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!metadata.id?.trim()) {
    errors.push('metadata.id is required');
  } else if (!PROVIDER_ID_PATTERN.test(metadata.id)) {
    errors.push(
      `metadata.id "${metadata.id}" must be lowercase alphanumeric with hyphens (e.g. "wordpress", "dev-to")`,
    );
  }

  if (!metadata.name?.trim()) errors.push('metadata.name is required');
  if (!metadata.version?.trim()) errors.push('metadata.version is required');
  if (!metadata.description?.trim()) errors.push('metadata.description is required');

  if (!metadata.capabilities) {
    errors.push('metadata.capabilities is required');
  } else {
    const capResult = validatePublisherCapabilities(metadata.capabilities);
    errors.push(...capResult.errors);
    warnings.push(...capResult.warnings);
  }

  if (metadata.homepageUrl && !isValidUrl(metadata.homepageUrl)) {
    warnings.push(`metadata.homepageUrl "${metadata.homepageUrl}" is not a valid URL`);
  }

  return { errors, warnings };
}

/**
 * Validate a `PublisherCapabilities` object has all required boolean flags.
 */
export function validatePublisherCapabilities(
  capabilities: PublisherCapabilities,
): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const key of CAPABILITY_KEYS) {
    if (typeof capabilities[key] !== 'boolean') {
      errors.push(`capabilities.${key} must be a boolean`);
    }
  }

  if (!capabilities.mediaUpload && !capabilities.postCreation) {
    warnings.push('provider supports neither mediaUpload nor postCreation — it may be unusable');
  }

  return { errors, warnings };
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
