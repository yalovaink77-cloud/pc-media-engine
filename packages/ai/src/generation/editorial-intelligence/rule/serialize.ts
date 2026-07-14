import type { EditorialRule } from '@pcme/shared';

import { validateEditorialRule } from './validate.js';

function cloneRule(rule: EditorialRule): EditorialRule {
  return Object.freeze({
    ...rule,
    metadata: Object.freeze({
      ...rule.metadata,
      tags: rule.metadata.tags ? Object.freeze([...rule.metadata.tags]) : undefined,
      attributes: rule.metadata.attributes
        ? Object.freeze({ ...rule.metadata.attributes })
        : undefined,
    }),
  });
}

/** Serialize an editorial rule to canonical JSON. */
export function serializeEditorialRule(rule: EditorialRule): string {
  const validated = validateEditorialRule(rule);
  return `${JSON.stringify(cloneRule(validated), null, 2)}\n`;
}

/** Parse and validate a serialized editorial rule. */
export function parseEditorialRule(serialized: string): EditorialRule {
  const parsed = JSON.parse(serialized) as unknown;
  return validateEditorialRule(parsed, { requireDeterministicId: true });
}

/** Serialize a list of editorial rules to canonical JSON. */
export function serializeEditorialRules(rules: readonly EditorialRule[]): string {
  return `${JSON.stringify(
    rules.map((rule) => cloneRule(validateEditorialRule(rule))),
    null,
    2,
  )}\n`;
}

/** Parse and validate a serialized editorial rule list. */
export function parseEditorialRules(serialized: string): readonly EditorialRule[] {
  const parsed = JSON.parse(serialized) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('serialized rules must be a JSON array');
  }

  return Object.freeze(
    parsed.map((rule) => validateEditorialRule(rule, { requireDeterministicId: true })),
  );
}
