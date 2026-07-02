/**
 * Ingestion-domain validation helpers.
 * Describe intent and tracking facts — no download or processing logic.
 */

import type { IngestionSourceType } from '@prisma/client';

export class IngestionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestionValidationError';
  }
}

const NON_EMPTY_URI_PATTERN = /\S/;

export function validateIngestionSourceUri(
  sourceType: IngestionSourceType,
  sourceUri: string,
): void {
  const normalized = sourceUri.trim();

  if (!NON_EMPTY_URI_PATTERN.test(normalized)) {
    throw new IngestionValidationError('Source URI must not be empty');
  }

  switch (sourceType) {
    case 'http_url':
    case 'youtube':
    case 'rss': {
      let parsed: URL;
      try {
        parsed = new URL(normalized);
      } catch {
        throw new IngestionValidationError(`Invalid URL for ${sourceType}: ${sourceUri}`);
      }

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new IngestionValidationError(`Source URI must use http or https for ${sourceType}`);
      }
      break;
    }
    case 'local_folder': {
      if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
        throw new IngestionValidationError('Local folder source URI must not be an HTTP URL');
      }
      break;
    }
    case 's3_placeholder': {
      if (!normalized.startsWith('s3://')) {
        throw new IngestionValidationError('S3 placeholder source URI must start with s3://');
      }
      break;
    }
    case 'manual':
      break;
    default: {
      const exhaustive: never = sourceType;
      throw new IngestionValidationError(
        `Unsupported ingestion source type: ${String(exhaustive)}`,
      );
    }
  }
}

export function validateNonNegativeCount(fieldName: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new IngestionValidationError(`${fieldName} must be a non-negative integer`);
  }
}

export function validateIngestionCounts(
  discoveredAssetCount: number,
  importedAssetCount: number,
): void {
  validateNonNegativeCount('discoveredAssetCount', discoveredAssetCount);
  validateNonNegativeCount('importedAssetCount', importedAssetCount);

  if (importedAssetCount > discoveredAssetCount) {
    throw new IngestionValidationError('importedAssetCount cannot exceed discoveredAssetCount');
  }
}

export function validateSourceIdentifier(sourceIdentifier: string | undefined | null): void {
  if (sourceIdentifier === undefined || sourceIdentifier === null) {
    return;
  }

  const normalized = sourceIdentifier.trim();
  if (!NON_EMPTY_URI_PATTERN.test(normalized)) {
    throw new IngestionValidationError('Source identifier must not be empty when provided');
  }

  if (normalized.length > 255) {
    throw new IngestionValidationError('Source identifier must be 255 characters or fewer');
  }
}
