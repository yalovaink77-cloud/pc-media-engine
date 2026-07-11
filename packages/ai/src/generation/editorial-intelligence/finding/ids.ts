import { createHash } from 'node:crypto';

import type { EditorialFindingId, FindingCategory, FindingCode } from '@pcme/shared';

/** Build a deterministic editorial finding identifier within a report. */
export function buildDeterministicEditorialFindingId(input: {
  readonly reportId: string;
  readonly category: FindingCategory;
  readonly analyzerId: string;
  readonly code: FindingCode;
  readonly identityKey: string;
}): EditorialFindingId {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32);
}
