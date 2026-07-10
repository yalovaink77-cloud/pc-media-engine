import { describe, expect, it } from 'vitest';

import {
  assertPersistableArtifactContent,
  assertPersistableJsonValue,
  ContentWorkflowValidationError,
  fromDbContentReviewStatus,
  fromDbGeneratedContentArtifactStatus,
  toDbContentReviewStatus,
  toDbGeneratedContentArtifactStatus,
} from './content-workflow-validation.js';

describe('content-workflow-validation', () => {
  it('round-trips generated content artifact statuses', () => {
    expect(fromDbGeneratedContentArtifactStatus('generated_with_warnings')).toBe(
      'generated-with-warnings',
    );
    expect(toDbGeneratedContentArtifactStatus('generated-with-warnings')).toBe(
      'generated_with_warnings',
    );
  });

  it('round-trips content review statuses', () => {
    expect(fromDbContentReviewStatus('pending_review')).toBe('pending-review');
    expect(toDbContentReviewStatus('approved-with-notes')).toBe('approved_with_notes');
  });

  it('rejects blocked metadata in artifact content', () => {
    expect(() => assertPersistableArtifactContent('/home/user/secret.txt')).toThrow(
      ContentWorkflowValidationError,
    );
  });

  it('rejects secrets in nested json values', () => {
    expect(() => assertPersistableJsonValue({ token: 'Bearer abc.def.ghi' }, 'payload')).toThrow(
      ContentWorkflowValidationError,
    );
  });
});
