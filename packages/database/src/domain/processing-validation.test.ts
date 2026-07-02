import { describe, expect, it } from 'vitest';

import {
  PRIORITY_MAX,
  PRIORITY_MIN,
  ProcessingValidationError,
  validateArtifactChecksum,
  validateArtifactCompatibility,
  validateArtifactMimeType,
  validatePriority,
  validateRetryCount,
  validateStorageKeyPlaceholder,
} from './processing-validation.js';

const VALID_SHA256 = 'a'.repeat(64);

describe('processing-validation', () => {
  describe('validatePriority', () => {
    it('accepts boundary values', () => {
      expect(() => validatePriority(PRIORITY_MIN)).not.toThrow();
      expect(() => validatePriority(PRIORITY_MAX)).not.toThrow();
      expect(() => validatePriority(50)).not.toThrow();
    });

    it('rejects values below minimum', () => {
      expect(() => validatePriority(-1)).toThrow(ProcessingValidationError);
    });

    it('rejects values above maximum', () => {
      expect(() => validatePriority(101)).toThrow(ProcessingValidationError);
    });

    it('rejects non-integers', () => {
      expect(() => validatePriority(1.5)).toThrow(ProcessingValidationError);
    });
  });

  describe('validateRetryCount', () => {
    it('accepts zero and positive integers', () => {
      expect(() => validateRetryCount(0)).not.toThrow();
      expect(() => validateRetryCount(5)).not.toThrow();
    });

    it('rejects negative values', () => {
      expect(() => validateRetryCount(-1)).toThrow(ProcessingValidationError);
    });
  });

  describe('validateArtifactMimeType', () => {
    it('accepts standard MIME types', () => {
      expect(() => validateArtifactMimeType('image/jpeg')).not.toThrow();
      expect(() => validateArtifactMimeType('audio/wav')).not.toThrow();
      expect(() => validateArtifactMimeType('application/json')).not.toThrow();
    });

    it('rejects malformed MIME types', () => {
      expect(() => validateArtifactMimeType('not-a-mime')).toThrow(ProcessingValidationError);
      expect(() => validateArtifactMimeType('')).toThrow(ProcessingValidationError);
    });
  });

  describe('validateStorageKeyPlaceholder', () => {
    it('accepts well-formed placeholder paths', () => {
      expect(() =>
        validateStorageKeyPlaceholder('piercingconnect/clm123abc/thumb-cover.jpg'),
      ).not.toThrow();
    });

    it('rejects absolute paths', () => {
      expect(() => validateStorageKeyPlaceholder('/absolute/path/file.jpg')).toThrow(
        ProcessingValidationError,
      );
    });

    it('rejects paths with too few segments', () => {
      expect(() => validateStorageKeyPlaceholder('onlyone')).toThrow(ProcessingValidationError);
    });
  });

  describe('validateArtifactCompatibility', () => {
    it('accepts valid type pairs', () => {
      expect(() => validateArtifactCompatibility('thumbnail', 'thumbnail')).not.toThrow();
      expect(() => validateArtifactCompatibility('ai_analysis', 'metadata')).not.toThrow();
      expect(() => validateArtifactCompatibility('ai_analysis', 'transcript')).not.toThrow();
    });

    it('rejects incompatible pairs', () => {
      expect(() => validateArtifactCompatibility('thumbnail', 'transcript')).toThrow(
        ProcessingValidationError,
      );
      expect(() => validateArtifactCompatibility('waveform', 'thumbnail')).toThrow(
        ProcessingValidationError,
      );
    });
  });

  describe('validateArtifactChecksum', () => {
    it('accepts valid sha-256 digests', () => {
      expect(() => validateArtifactChecksum(VALID_SHA256)).not.toThrow();
    });

    it('rejects short digests', () => {
      expect(() => validateArtifactChecksum('abc123')).toThrow(ProcessingValidationError);
    });
  });
});
