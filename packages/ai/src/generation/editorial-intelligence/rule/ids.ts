import { createHash } from 'node:crypto';

import type { EditorialRuleId, FindingCategory, RuleCode } from '@pcme/shared';

/** Build a deterministic editorial rule identifier within a registry scope. */
export function buildDeterministicEditorialRuleId(input: {
  readonly scopeId: string;
  readonly category: FindingCategory;
  readonly analyzerId: string;
  readonly code: RuleCode;
}): EditorialRuleId {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32);
}
