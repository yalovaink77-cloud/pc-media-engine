import type { EditorialRule } from '@pcme/shared';

import { buildDeterministicEditorialRuleId } from '../rule/ids.js';
import { EditorialRuleRegistry } from '../rule/registry.js';
import { normalizeEditorialRuleInput } from '../rule/validate.js';
import { EVIDENCE_RULE_CODES } from './rules.js';

const DEFAULT_RULE_DEFINITIONS = Object.freeze([
  Object.freeze({
    code: 'missing-required-source-section',
    analyzerId: 'structure',
    group: 'evidence-structure',
    priority: 10,
    title: 'Missing required source section',
    description: 'Detects required evidence sections that are absent from the draft.',
    findingCode: 'missing-required-source-section',
  }),
  Object.freeze({
    code: 'missing-required-source-placeholder',
    analyzerId: 'citation-readiness',
    group: 'citation-quality',
    priority: 20,
    title: 'Missing required source placeholder',
    description: 'Detects required source placeholders that are absent from the draft.',
    findingCode: 'missing-required-source-placeholder',
  }),
  Object.freeze({
    code: 'unresolved-source-placeholder',
    analyzerId: 'citation-readiness',
    group: 'citation-quality',
    priority: 30,
    title: 'Unresolved source placeholder',
    description: 'Detects structured source placeholders that remain unresolved.',
    findingCode: 'unresolved-source-placeholder',
  }),
  Object.freeze({
    code: 'missing-evidence-notes',
    analyzerId: 'citation-readiness',
    group: 'citation-quality',
    priority: 40,
    title: 'Missing evidence notes',
    description: 'Detects evidence notes sections without resolved source records.',
    findingCode: 'missing-evidence-notes',
  }),
  Object.freeze({
    code: 'duplicate-citation-placeholder',
    analyzerId: 'citation-readiness',
    group: 'citation-quality',
    priority: 50,
    title: 'Duplicate citation placeholder',
    description: 'Detects duplicate structured citation placeholders.',
    findingCode: 'duplicate-citation-placeholder',
  }),
  Object.freeze({
    code: 'orphan-source-reference',
    analyzerId: 'citation-readiness',
    group: 'citation-quality',
    priority: 60,
    title: 'Orphan source reference',
    description: 'Detects inline source references without matching evidence notes entries.',
    findingCode: 'orphan-source-reference',
  }),
  Object.freeze({
    code: 'missing-verification-marker',
    analyzerId: 'citation-readiness',
    group: 'verification-quality',
    priority: 70,
    title: 'Missing verification marker',
    description: 'Detects evidentiary claims without configured verification markers.',
    findingCode: 'missing-verification-marker',
  }),
  Object.freeze({
    code: 'unsupported-factual-statement',
    analyzerId: 'factual-grounding',
    group: 'claim-quality',
    priority: 80,
    title: 'Unsupported factual statement',
    description: 'Detects factual statement patterns configured by the profile.',
    findingCode: 'unsupported-factual-statement',
  }),
  Object.freeze({
    code: 'manufacturer-claim-indicator',
    analyzerId: 'factual-grounding',
    group: 'claim-quality',
    priority: 90,
    title: 'Manufacturer claim indicator',
    description: 'Detects manufacturer positioning language configured by the profile.',
    findingCode: 'manufacturer-claim-indicator',
  }),
  Object.freeze({
    code: 'recommendation-without-evidence',
    analyzerId: 'factual-grounding',
    group: 'claim-quality',
    priority: 100,
    title: 'Recommendation without evidence',
    description: 'Detects recommendation language without nearby verification markers.',
    findingCode: 'recommendation-without-evidence',
  }),
  Object.freeze({
    code: 'medical-statement-without-evidence',
    analyzerId: 'factual-grounding',
    group: 'claim-quality',
    priority: 110,
    title: 'Medical statement without evidence',
    description: 'Detects medical statement language without nearby verification markers.',
    findingCode: 'medical-statement-without-evidence',
  }),
] as const satisfies readonly {
  readonly code: (typeof EVIDENCE_RULE_CODES)[number];
  readonly analyzerId: string;
  readonly group: string;
  readonly priority: number;
  readonly title: string;
  readonly description: string;
  readonly findingCode: string;
}[]);

function buildDefaultEvidenceRule(
  scopeId: string,
  definition: (typeof DEFAULT_RULE_DEFINITIONS)[number],
): EditorialRule {
  const id = buildDeterministicEditorialRuleId({
    scopeId,
    category: 'evidence',
    analyzerId: definition.analyzerId,
    code: definition.code,
  });

  return normalizeEditorialRuleInput({
    id,
    category: 'evidence',
    code: definition.code,
    analyzerId: definition.analyzerId,
    group: definition.group,
    priority: definition.priority,
    enabled: true,
    metadata: Object.freeze({
      title: definition.title,
      description: definition.description,
    }),
    findingCode: definition.findingCode,
  });
}

/** Create the default evidence rule registry for a profile scope. */
export function createDefaultEvidenceRuleRegistry(
  scopeId = 'generic-evidence-v1',
): EditorialRuleRegistry {
  const rules = DEFAULT_RULE_DEFINITIONS.map((definition) =>
    buildDefaultEvidenceRule(scopeId, definition),
  );
  return new EditorialRuleRegistry(rules);
}

export { DEFAULT_RULE_DEFINITIONS, EVIDENCE_RULE_CODES };
