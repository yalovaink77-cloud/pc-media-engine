import type { EditorialFinding } from '@pcme/shared';

import { validateEditorialFinding } from './validate.js';

function cloneFinding(finding: EditorialFinding): EditorialFinding {
  return Object.freeze({
    ...finding,
    recommendation: Object.freeze({ ...finding.recommendation }),
    acceptanceCriteria: Object.freeze({ ...finding.acceptanceCriteria }),
    location: finding.location ? Object.freeze({ ...finding.location }) : undefined,
    metadata: finding.metadata ? Object.freeze({ ...finding.metadata }) : undefined,
  });
}

/** Serialize an editorial finding to canonical JSON. */
export function serializeEditorialFinding(finding: EditorialFinding): string {
  const validated = validateEditorialFinding(finding);
  return `${JSON.stringify(cloneFinding(validated), null, 2)}\n`;
}

/** Parse and validate a serialized editorial finding. */
export function parseEditorialFinding(serialized: string): EditorialFinding {
  const parsed = JSON.parse(serialized) as unknown;
  return validateEditorialFinding(parsed, { requireDeterministicId: true });
}

/** Serialize a list of editorial findings to canonical JSON. */
export function serializeEditorialFindings(findings: readonly EditorialFinding[]): string {
  return `${JSON.stringify(
    findings.map((finding) => cloneFinding(validateEditorialFinding(finding))),
    null,
    2,
  )}\n`;
}

/** Parse and validate a serialized editorial finding list. */
export function parseEditorialFindings(serialized: string): readonly EditorialFinding[] {
  const parsed = JSON.parse(serialized) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('serialized findings must be a JSON array');
  }

  return Object.freeze(
    parsed.map((finding) => validateEditorialFinding(finding, { requireDeterministicId: true })),
  );
}
