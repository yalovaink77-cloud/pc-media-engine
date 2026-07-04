import { describe, expect, it } from 'vitest';

import { PayloadValidationError, validateJobPayload } from '../queue/payload.js';

describe('validateJobPayload', () => {
  it('accepts a valid payload with processingJobId', () => {
    const result = validateJobPayload({ processingJobId: 'abc123' });
    expect(result).toEqual({ processingJobId: 'abc123' });
  });

  it('returns the processingJobId verbatim', () => {
    const id = 'cmr44fnmm0003npowypjsfc9e';
    const result = validateJobPayload({ processingJobId: id });
    expect(result.processingJobId).toBe(id);
  });

  it('rejects null', () => {
    expect(() => validateJobPayload(null)).toThrow(PayloadValidationError);
  });

  it('rejects a plain string', () => {
    expect(() => validateJobPayload('not-an-object')).toThrow(PayloadValidationError);
  });

  it('rejects an array', () => {
    expect(() => validateJobPayload([{ processingJobId: 'x' }])).toThrow(PayloadValidationError);
  });

  it('rejects missing processingJobId', () => {
    expect(() => validateJobPayload({})).toThrow(PayloadValidationError);
  });

  it('rejects numeric processingJobId', () => {
    expect(() => validateJobPayload({ processingJobId: 42 })).toThrow(PayloadValidationError);
  });

  it('rejects null processingJobId', () => {
    expect(() => validateJobPayload({ processingJobId: null })).toThrow(PayloadValidationError);
  });

  it('rejects empty string processingJobId', () => {
    expect(() => validateJobPayload({ processingJobId: '' })).toThrow(PayloadValidationError);
  });

  it('rejects whitespace-only processingJobId', () => {
    expect(() => validateJobPayload({ processingJobId: '   ' })).toThrow(PayloadValidationError);
  });

  it('includes a descriptive message for missing id', () => {
    try {
      validateJobPayload({});
    } catch (e) {
      expect(e).toBeInstanceOf(PayloadValidationError);
      expect((e as Error).message).toMatch(/processingJobId/);
    }
  });

  it('error name is PayloadValidationError', () => {
    try {
      validateJobPayload(null);
    } catch (e) {
      expect((e as Error).name).toBe('PayloadValidationError');
    }
  });
});
