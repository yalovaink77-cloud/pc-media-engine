import { describe, expect, it } from 'vitest';

import {
  buildStorageKeyPlaceholder,
  MediaValidationError,
  sanitizeFilenameForStorageKey,
  validateChecksum,
  validateMetadataKey,
  validateMetadataNamespace,
  validateMimeType,
  validateSha256Checksum,
  validateStorageKey,
} from './media-validation.js';

const VALID_SHA256 = 'a'.repeat(64);

describe('media-validation', () => {
  describe('validateMimeType', () => {
    it('accepts common image and document MIME types', () => {
      expect(() => validateMimeType('image/jpeg')).not.toThrow();
      expect(() => validateMimeType('application/pdf')).not.toThrow();
    });

    it('rejects invalid MIME types', () => {
      expect(() => validateMimeType('not-a-mime')).toThrow(MediaValidationError);
    });
  });

  describe('validateSha256Checksum', () => {
    it('accepts lowercase hex digests', () => {
      expect(() => validateSha256Checksum(VALID_SHA256)).not.toThrow();
    });

    it('rejects invalid digests', () => {
      expect(() => validateSha256Checksum('abc')).toThrow(MediaValidationError);
    });
  });

  describe('validateChecksum', () => {
    it('validates sha256 checksums', () => {
      expect(() => validateChecksum(VALID_SHA256, 'sha256')).not.toThrow();
    });

    it('rejects unsupported algorithms', () => {
      expect(() => validateChecksum(VALID_SHA256, 'md5')).toThrow(MediaValidationError);
    });
  });

  describe('validateStorageKey', () => {
    it('accepts project-scoped storage keys', () => {
      expect(() => validateStorageKey('piercingconnect/clm123abc/guide-cover.jpg')).not.toThrow();
    });

    it('rejects keys outside the convention', () => {
      expect(() => validateStorageKey('/absolute/path/file.jpg')).toThrow(MediaValidationError);
    });
  });

  describe('sanitizeFilenameForStorageKey', () => {
    it('normalizes unsafe characters', () => {
      expect(sanitizeFilenameForStorageKey('Navel Guide (Final).jpg')).toBe(
        'navel-guide-final.jpg',
      );
    });
  });

  describe('buildStorageKeyPlaceholder', () => {
    it('builds a provider-agnostic key', () => {
      const key = buildStorageKeyPlaceholder('piercingconnect', 'clm123abc', 'Cover Photo.jpg');
      expect(key).toBe('piercingconnect/clm123abc/cover-photo.jpg');
      expect(() => validateStorageKey(key)).not.toThrow();
    });
  });

  describe('metadata record identifiers', () => {
    it('accepts valid namespace and key', () => {
      expect(() => validateMetadataNamespace('exif')).not.toThrow();
      expect(() => validateMetadataKey('width_px')).not.toThrow();
    });

    it('rejects invalid namespace and key', () => {
      expect(() => validateMetadataNamespace('EXIF')).toThrow(MediaValidationError);
      expect(() => validateMetadataKey('1width')).toThrow(MediaValidationError);
    });
  });
});
