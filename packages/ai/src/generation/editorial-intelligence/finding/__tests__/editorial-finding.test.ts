import { EditorialFindingValidationError } from '@pcme/shared';
import { describe, expect, it } from 'vitest';

import {
  buildDeterministicEditorialFindingId,
  isBlockingEditorialFinding,
  normalizeEditorialFindingInput,
  parseEditorialFinding,
  parseEditorialFindings,
  serializeEditorialFinding,
  serializeEditorialFindings,
  validateEditorialFinding,
} from '../index.js';

const VALID_FINDING_INPUT = Object.freeze({
  id: 'identity-key-1',
  category: 'editorial' as const,
  code: 'formatting-corruption',
  analyzerId: 'formatting',
  checkId: 'formatting' as const,
  severity: 'high' as const,
  confidence: 'high' as const,
  reason: 'Merged tokens detected in draft body.',
  recommendation: 'Regenerate affected sentences with correct word boundaries.',
  acceptanceCriteria: 'No confirmed merged tokens remain.',
});

describe('buildDeterministicEditorialFindingId', () => {
  it('returns a stable 32-character identifier', () => {
    const input = Object.freeze({
      reportId: 'report-001',
      category: 'editorial' as const,
      analyzerId: 'formatting',
      code: 'formatting-corruption',
      identityKey: 'identity-key-1',
    });

    expect(buildDeterministicEditorialFindingId(input)).toBe(
      buildDeterministicEditorialFindingId(input),
    );
    expect(buildDeterministicEditorialFindingId(input)).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe('normalizeEditorialFindingInput', () => {
  it('normalizes string recommendation and acceptance criteria', () => {
    const finding = normalizeEditorialFindingInput(VALID_FINDING_INPUT);

    expect(finding.recommendation).toEqual(
      Object.freeze({ text: 'Regenerate affected sentences with correct word boundaries.' }),
    );
    expect(finding.acceptanceCriteria).toEqual(
      Object.freeze({ text: 'No confirmed merged tokens remain.' }),
    );
    expect(finding.category).toBe('editorial');
    expect(finding.code).toBe('formatting-corruption');
  });

  it('rejects invalid finding codes', () => {
    expect(() =>
      normalizeEditorialFindingInput({
        ...VALID_FINDING_INPUT,
        code: 'Invalid_Code',
      }),
    ).toThrow(EditorialFindingValidationError);
  });

  it('rejects invalid categories', () => {
    expect(() =>
      normalizeEditorialFindingInput({
        ...VALID_FINDING_INPUT,
        category: 'unknown-category' as 'editorial',
      }),
    ).toThrow(EditorialFindingValidationError);
  });
});

describe('validateEditorialFinding', () => {
  it('validates a normalized finding with deterministic id requirement', () => {
    const reportId = 'report-001';
    const id = buildDeterministicEditorialFindingId({
      reportId,
      category: 'evidence',
      analyzerId: 'citation-readiness',
      code: 'unresolved-source-placeholders',
      identityKey: 'identity-key-1',
    });

    const finding = validateEditorialFinding(
      normalizeEditorialFindingInput({
        ...VALID_FINDING_INPUT,
        id,
        category: 'evidence',
        code: 'unresolved-source-placeholders',
        analyzerId: 'citation-readiness',
        checkId: 'citation-readiness',
      }),
      { requireDeterministicId: true },
    );

    expect(finding.id).toBe(id);
    expect(finding.category).toBe('evidence');
  });

  it('rejects findings with invalid line ranges', () => {
    expect(() =>
      validateEditorialFinding(
        normalizeEditorialFindingInput({
          ...VALID_FINDING_INPUT,
          location: Object.freeze({ lineRange: Object.freeze({ start: 5, end: 2 }) }),
        }),
      ),
    ).toThrow(EditorialFindingValidationError);
  });
});

describe('isBlockingEditorialFinding', () => {
  it('treats only high severity and high confidence as blocking', () => {
    const blocking = normalizeEditorialFindingInput({
      ...VALID_FINDING_INPUT,
      severity: 'high',
      confidence: 'high',
    });
    const advisory = normalizeEditorialFindingInput({
      ...VALID_FINDING_INPUT,
      severity: 'high',
      confidence: 'medium',
    });

    expect(isBlockingEditorialFinding(blocking)).toBe(true);
    expect(isBlockingEditorialFinding(advisory)).toBe(false);
  });
});

describe('serializeEditorialFinding', () => {
  it('round-trips a finding through JSON', () => {
    const id = buildDeterministicEditorialFindingId({
      reportId: 'report-001',
      category: 'affiliate',
      analyzerId: 'disclosure',
      code: 'disclosure-unresolved',
      identityKey: 'identity-key-1',
    });
    const finding = validateEditorialFinding(
      normalizeEditorialFindingInput({
        ...VALID_FINDING_INPUT,
        id,
        category: 'affiliate',
        code: 'disclosure-unresolved',
        analyzerId: 'disclosure',
        checkId: 'affiliate-compliance',
      }),
      { requireDeterministicId: true },
    );

    const serialized = serializeEditorialFinding(finding);
    const parsed = parseEditorialFinding(serialized);

    expect(parsed).toEqual(finding);
    expect(serialized.endsWith('\n')).toBe(true);
  });
});

describe('serializeEditorialFindings', () => {
  it('round-trips a finding list through JSON', () => {
    const id = buildDeterministicEditorialFindingId({
      reportId: 'report-001',
      category: 'knowledge',
      analyzerId: 'formatting',
      code: 'formatting-corruption',
      identityKey: 'identity-key-1',
    });
    const finding = normalizeEditorialFindingInput({
      ...VALID_FINDING_INPUT,
      id,
      category: 'knowledge',
      checkId: 'factual-grounding',
    });

    const serialized = serializeEditorialFindings([finding]);
    const parsed = parseEditorialFindings(serialized);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.category).toBe('knowledge');
    expect(parsed[0]?.id).toBe(id);
  });
});
