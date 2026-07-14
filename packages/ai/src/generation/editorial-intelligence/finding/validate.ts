import type {
  AcceptanceCriteria,
  ContentReviewCheckId,
  EditorialFinding,
  EditorialFindingInput,
  EditorialFindingLocation,
  FindingCategory,
  FindingCode,
  FindingConfidence,
  FindingRecommendation,
  FindingSeverity,
} from '@pcme/shared';
import {
  EDITORIAL_FINDING_ID_PATTERN,
  EditorialFindingValidationError,
  FINDING_CATEGORIES,
  FINDING_CODE_PATTERN,
  FINDING_CONFIDENCES,
  FINDING_SEVERITIES,
} from '@pcme/shared';

const CONTENT_REVIEW_CHECK_IDS = Object.freeze([
  'safety',
  'factual-grounding',
  'affiliate-compliance',
  'citation-readiness',
  'formatting',
  'publication-readiness',
] as const satisfies readonly ContentReviewCheckId[]);

function assertNonEmptyString(
  field: string,
  value: unknown,
  code: string,
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EditorialFindingValidationError(field, code, `${field} must be a non-empty string`);
  }
}

function normalizeRecommendation(field: string, value: unknown): FindingRecommendation {
  if (typeof value === 'string') {
    assertNonEmptyString(field, value, 'invalid-recommendation');
    return Object.freeze({ text: value.trim() });
  }

  if (!value || typeof value !== 'object' || !('text' in value)) {
    throw new EditorialFindingValidationError(
      field,
      'invalid-recommendation',
      `${field} must be a string or an object with text`,
    );
  }

  assertNonEmptyString(
    `${field}.text`,
    (value as FindingRecommendation).text,
    'invalid-recommendation',
  );
  return Object.freeze({ text: (value as FindingRecommendation).text.trim() });
}

function normalizeAcceptanceCriteria(field: string, value: unknown): AcceptanceCriteria {
  if (typeof value === 'string') {
    assertNonEmptyString(field, value, 'invalid-acceptance-criteria');
    return Object.freeze({ text: value.trim() });
  }

  if (!value || typeof value !== 'object' || !('text' in value)) {
    throw new EditorialFindingValidationError(
      field,
      'invalid-acceptance-criteria',
      `${field} must be a string or an object with text`,
    );
  }

  assertNonEmptyString(
    `${field}.text`,
    (value as AcceptanceCriteria).text,
    'invalid-acceptance-criteria',
  );
  return Object.freeze({ text: (value as AcceptanceCriteria).text.trim() });
}

function validateCategory(value: unknown): FindingCategory {
  if (
    typeof value !== 'string' ||
    !FINDING_CATEGORIES.includes(value as (typeof FINDING_CATEGORIES)[number])
  ) {
    throw new EditorialFindingValidationError(
      'category',
      'invalid-category',
      `category must be one of: ${FINDING_CATEGORIES.join(', ')}`,
    );
  }

  return value as FindingCategory;
}

function validateSeverity(value: unknown, field: string): FindingSeverity {
  if (
    typeof value !== 'string' ||
    !FINDING_SEVERITIES.includes(value as (typeof FINDING_SEVERITIES)[number])
  ) {
    throw new EditorialFindingValidationError(
      field,
      `invalid-${field}`,
      `${field} must be one of: ${FINDING_SEVERITIES.join(', ')}`,
    );
  }

  return value as FindingSeverity;
}

function validateConfidence(value: unknown): FindingConfidence {
  if (
    typeof value !== 'string' ||
    !FINDING_CONFIDENCES.includes(value as (typeof FINDING_CONFIDENCES)[number])
  ) {
    throw new EditorialFindingValidationError(
      'confidence',
      'invalid-confidence',
      `confidence must be one of: ${FINDING_CONFIDENCES.join(', ')}`,
    );
  }

  return value as FindingConfidence;
}

function validateCode(value: unknown): FindingCode {
  assertNonEmptyString('code', value, 'invalid-code');
  const code = value.trim();
  if (!FINDING_CODE_PATTERN.test(code)) {
    throw new EditorialFindingValidationError(
      'code',
      'invalid-code',
      'code must use kebab-case (for example formatting-corruption)',
    );
  }

  return code;
}

function validateCheckId(value: unknown): ContentReviewCheckId {
  if (
    typeof value !== 'string' ||
    !CONTENT_REVIEW_CHECK_IDS.includes(value as ContentReviewCheckId)
  ) {
    throw new EditorialFindingValidationError(
      'checkId',
      'invalid-check-id',
      `checkId must be one of: ${CONTENT_REVIEW_CHECK_IDS.join(', ')}`,
    );
  }

  return value as ContentReviewCheckId;
}

function validateLocation(value: unknown): EditorialFindingLocation | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== 'object') {
    throw new EditorialFindingValidationError(
      'location',
      'invalid-location',
      'location must be an object when provided',
    );
  }

  const location = value as EditorialFindingLocation;
  const lineRange = location.lineRange;

  if (lineRange !== undefined) {
    if (
      !lineRange ||
      typeof lineRange !== 'object' ||
      typeof lineRange.start !== 'number' ||
      typeof lineRange.end !== 'number' ||
      !Number.isInteger(lineRange.start) ||
      !Number.isInteger(lineRange.end) ||
      lineRange.start < 1 ||
      lineRange.end < lineRange.start
    ) {
      throw new EditorialFindingValidationError(
        'location.lineRange',
        'invalid-line-range',
        'location.lineRange must use positive integers with end >= start',
      );
    }
  }

  return Object.freeze({
    sectionId: location.sectionId?.trim() || undefined,
    headingText: location.headingText?.trim() || undefined,
    excerpt: location.excerpt?.trim() || undefined,
    lineRange: lineRange ? Object.freeze({ ...lineRange }) : undefined,
  });
}

function validateMetadata(
  value: unknown,
): Readonly<Record<string, string | number | boolean>> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new EditorialFindingValidationError(
      'metadata',
      'invalid-metadata',
      'metadata must be a plain object when provided',
    );
  }

  const metadata: Record<string, string | number | boolean> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string' && typeof entry !== 'number' && typeof entry !== 'boolean') {
      throw new EditorialFindingValidationError(
        'metadata',
        'invalid-metadata-value',
        'metadata values must be string, number, or boolean',
      );
    }
    metadata[key] = entry;
  }

  return Object.freeze(metadata);
}

function validateFindingId(value: unknown, options?: { requireDeterministic?: boolean }): string {
  assertNonEmptyString('id', value, 'invalid-id');
  const id = value.trim();

  if (options?.requireDeterministic && !EDITORIAL_FINDING_ID_PATTERN.test(id)) {
    throw new EditorialFindingValidationError(
      'id',
      'invalid-id-format',
      'id must be a 32-character lowercase hexadecimal string',
    );
  }

  return id;
}

/** Normalize and validate editorial finding input into a frozen finding contract. */
export function normalizeEditorialFindingInput(input: EditorialFindingInput): EditorialFinding {
  const id = input.id ? validateFindingId(input.id) : 'pending-id-assignment';
  assertNonEmptyString('analyzerId', input.analyzerId, 'invalid-analyzer-id');
  assertNonEmptyString('reason', input.reason, 'invalid-reason');

  return Object.freeze({
    id,
    category: validateCategory(input.category),
    code: validateCode(input.code),
    analyzerId: input.analyzerId.trim(),
    checkId: validateCheckId(input.checkId),
    severity: validateSeverity(input.severity, 'severity'),
    confidence: validateConfidence(input.confidence),
    reason: input.reason.trim(),
    recommendation: normalizeRecommendation('recommendation', input.recommendation),
    acceptanceCriteria: normalizeAcceptanceCriteria('acceptanceCriteria', input.acceptanceCriteria),
    location: validateLocation(input.location),
    metadata: validateMetadata(input.metadata),
  });
}

/** Validate a serialized or in-memory editorial finding contract. */
export function validateEditorialFinding(
  value: unknown,
  options?: { requireDeterministicId?: boolean },
): EditorialFinding {
  if (!value || typeof value !== 'object') {
    throw new EditorialFindingValidationError(
      'finding',
      'invalid-finding',
      'finding must be an object',
    );
  }

  const finding = value as EditorialFinding;
  assertNonEmptyString('analyzerId', finding.analyzerId, 'invalid-analyzer-id');
  assertNonEmptyString('reason', finding.reason, 'invalid-reason');

  return Object.freeze({
    id: validateFindingId(finding.id, { requireDeterministic: options?.requireDeterministicId }),
    category: validateCategory(finding.category),
    code: validateCode(finding.code),
    analyzerId: finding.analyzerId.trim(),
    checkId: validateCheckId(finding.checkId),
    severity: validateSeverity(finding.severity, 'severity'),
    confidence: validateConfidence(finding.confidence),
    reason: finding.reason.trim(),
    recommendation: normalizeRecommendation('recommendation', finding.recommendation),
    acceptanceCriteria: normalizeAcceptanceCriteria(
      'acceptanceCriteria',
      finding.acceptanceCriteria,
    ),
    location: validateLocation(finding.location),
    metadata: validateMetadata(finding.metadata),
  });
}

/** Return true when a finding blocks advisory readiness (high severity and confidence). */
export function isBlockingEditorialFinding(finding: EditorialFinding): boolean {
  return finding.severity === 'high' && finding.confidence === 'high';
}
