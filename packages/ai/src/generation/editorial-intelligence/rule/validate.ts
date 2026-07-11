import type {
  EditorialRule,
  EditorialRuleInput,
  EditorialRuleMetadata,
  FindingCategory,
  FindingCode,
  RuleCode,
  RuleGroup,
} from '@pcme/shared';
import {
  EDITORIAL_RULE_ID_PATTERN,
  EditorialRuleValidationError,
  FINDING_CATEGORIES,
  FINDING_CODE_PATTERN,
  RULE_CODE_PATTERN,
  RULE_GROUP_PATTERN,
} from '@pcme/shared';

function assertNonEmptyString(
  field: string,
  value: unknown,
  code: string,
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EditorialRuleValidationError(field, code, `${field} must be a non-empty string`);
  }
}

function validateCategory(value: unknown): FindingCategory {
  if (
    typeof value !== 'string' ||
    !FINDING_CATEGORIES.includes(value as (typeof FINDING_CATEGORIES)[number])
  ) {
    throw new EditorialRuleValidationError(
      'category',
      'invalid-category',
      `category must be one of: ${FINDING_CATEGORIES.join(', ')}`,
    );
  }

  return value as FindingCategory;
}

function validateRuleCode(value: unknown, field: string): RuleCode {
  assertNonEmptyString(field, value, `invalid-${field}`);
  const code = value.trim();
  if (!RULE_CODE_PATTERN.test(code)) {
    throw new EditorialRuleValidationError(
      field,
      `invalid-${field}`,
      `${field} must use kebab-case (for example formatting-corruption)`,
    );
  }

  return code;
}

function validateFindingCode(value: unknown): FindingCode | undefined {
  if (value === undefined) {
    return undefined;
  }

  assertNonEmptyString('findingCode', value, 'invalid-finding-code');
  const code = value.trim();
  if (!FINDING_CODE_PATTERN.test(code)) {
    throw new EditorialRuleValidationError(
      'findingCode',
      'invalid-finding-code',
      'findingCode must use kebab-case (for example formatting-corruption)',
    );
  }

  return code;
}

function validateGroup(value: unknown): RuleGroup {
  assertNonEmptyString('group', value, 'invalid-group');
  const group = value.trim();
  if (!RULE_GROUP_PATTERN.test(group)) {
    throw new EditorialRuleValidationError(
      'group',
      'invalid-group',
      'group must use kebab-case (for example readability-quality)',
    );
  }

  return group;
}

function validatePriority(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new EditorialRuleValidationError(
      'priority',
      'invalid-priority',
      'priority must be a non-negative integer',
    );
  }

  return value;
}

function validateEnabled(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new EditorialRuleValidationError(
      'enabled',
      'invalid-enabled',
      'enabled must be a boolean',
    );
  }

  return value;
}

function validateMetadataAttributes(
  value: unknown,
): Readonly<Record<string, string | number | boolean>> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new EditorialRuleValidationError(
      'metadata.attributes',
      'invalid-metadata-attributes',
      'metadata.attributes must be a plain object when provided',
    );
  }

  const attributes: Record<string, string | number | boolean> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string' && typeof entry !== 'number' && typeof entry !== 'boolean') {
      throw new EditorialRuleValidationError(
        'metadata.attributes',
        'invalid-metadata-attribute-value',
        'metadata.attributes values must be string, number, or boolean',
      );
    }
    attributes[key] = entry;
  }

  return Object.freeze(attributes);
}

function validateTags(value: unknown): readonly string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new EditorialRuleValidationError(
      'metadata.tags',
      'invalid-metadata-tags',
      'metadata.tags must be an array when provided',
    );
  }

  const tags = value.map((tag, index) => {
    assertNonEmptyString(`metadata.tags[${index}]`, tag, 'invalid-metadata-tag');
    return tag.trim();
  });

  return Object.freeze(tags);
}

function validateMetadata(value: unknown): EditorialRuleMetadata {
  if (!value || typeof value !== 'object') {
    throw new EditorialRuleValidationError(
      'metadata',
      'invalid-metadata',
      'metadata must be an object',
    );
  }

  const metadata = value as EditorialRuleMetadata;
  assertNonEmptyString('metadata.title', metadata.title, 'invalid-metadata-title');
  assertNonEmptyString(
    'metadata.description',
    metadata.description,
    'invalid-metadata-description',
  );

  const version = metadata.version === undefined ? undefined : metadata.version.trim() || undefined;

  return Object.freeze({
    title: metadata.title.trim(),
    description: metadata.description.trim(),
    tags: validateTags(metadata.tags),
    version,
    attributes: validateMetadataAttributes(metadata.attributes),
  });
}

function validateRuleId(value: unknown, options?: { requireDeterministic?: boolean }): string {
  assertNonEmptyString('id', value, 'invalid-id');
  const id = value.trim();

  if (options?.requireDeterministic && !EDITORIAL_RULE_ID_PATTERN.test(id)) {
    throw new EditorialRuleValidationError(
      'id',
      'invalid-id-format',
      'id must be a 32-character lowercase hexadecimal string',
    );
  }

  return id;
}

/** Normalize and validate editorial rule input into a frozen rule contract. */
export function normalizeEditorialRuleInput(input: EditorialRuleInput): EditorialRule {
  const id = input.id ? validateRuleId(input.id) : 'pending-id-assignment';
  assertNonEmptyString('analyzerId', input.analyzerId, 'invalid-analyzer-id');

  return Object.freeze({
    id,
    category: validateCategory(input.category),
    code: validateRuleCode(input.code, 'code'),
    analyzerId: input.analyzerId.trim(),
    group: validateGroup(input.group),
    priority: validatePriority(input.priority),
    enabled: input.enabled ?? true,
    metadata: validateMetadata(input.metadata),
    findingCode: validateFindingCode(input.findingCode),
  });
}

/** Validate a serialized or in-memory editorial rule contract. */
export function validateEditorialRule(
  value: unknown,
  options?: { requireDeterministicId?: boolean },
): EditorialRule {
  if (!value || typeof value !== 'object') {
    throw new EditorialRuleValidationError('rule', 'invalid-rule', 'rule must be an object');
  }

  const rule = value as EditorialRule;
  assertNonEmptyString('analyzerId', rule.analyzerId, 'invalid-analyzer-id');

  return Object.freeze({
    id: validateRuleId(rule.id, { requireDeterministic: options?.requireDeterministicId }),
    category: validateCategory(rule.category),
    code: validateRuleCode(rule.code, 'code'),
    analyzerId: rule.analyzerId.trim(),
    group: validateGroup(rule.group),
    priority: validatePriority(rule.priority),
    enabled: validateEnabled(rule.enabled),
    metadata: validateMetadata(rule.metadata),
    findingCode: validateFindingCode(rule.findingCode),
  });
}
