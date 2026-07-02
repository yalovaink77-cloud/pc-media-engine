import { describe, expect, it } from 'vitest';

import {
  IngestionValidationError,
  validateIngestionCounts,
  validateIngestionSourceUri,
  validateSourceIdentifier,
} from './ingestion-validation.js';

describe('ingestion-validation', () => {
  describe('validateIngestionSourceUri', () => {
    it('accepts http URLs for http_url sources', () => {
      expect(() =>
        validateIngestionSourceUri('http_url', 'https://example.com/media/feed.json'),
      ).not.toThrow();
    });

    it('accepts local folder paths', () => {
      expect(() =>
        validateIngestionSourceUri('local_folder', './data/media/piercingconnect/inbox'),
      ).not.toThrow();
    });

    it('accepts s3 placeholder URIs', () => {
      expect(() =>
        validateIngestionSourceUri('s3_placeholder', 's3://pcme-dev/piercingconnect/inbox'),
      ).not.toThrow();
    });

    it('rejects invalid URLs for youtube sources', () => {
      expect(() => validateIngestionSourceUri('youtube', 'not-a-url')).toThrow(
        IngestionValidationError,
      );
    });

    it('rejects HTTP URLs for local_folder sources', () => {
      expect(() =>
        validateIngestionSourceUri('local_folder', 'https://example.com/folder'),
      ).toThrow(IngestionValidationError);
    });
  });

  describe('validateIngestionCounts', () => {
    it('accepts valid count pairs', () => {
      expect(() => validateIngestionCounts(10, 8)).not.toThrow();
    });

    it('rejects imported counts greater than discovered counts', () => {
      expect(() => validateIngestionCounts(3, 5)).toThrow(IngestionValidationError);
    });

    it('rejects negative counts', () => {
      expect(() => validateIngestionCounts(-1, 0)).toThrow(IngestionValidationError);
    });
  });

  describe('validateSourceIdentifier', () => {
    it('allows null and undefined identifiers', () => {
      expect(() => validateSourceIdentifier(undefined)).not.toThrow();
      expect(() => validateSourceIdentifier(null)).not.toThrow();
    });

    it('rejects empty identifiers', () => {
      expect(() => validateSourceIdentifier('   ')).toThrow(IngestionValidationError);
    });
  });
});
