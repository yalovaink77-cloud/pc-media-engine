import type { EditorialRule } from '@pcme/shared';

import { buildDeterministicEditorialRuleId } from '../rule/ids.js';
import { EditorialRuleRegistry } from '../rule/registry.js';
import { normalizeEditorialRuleInput } from '../rule/validate.js';
import { EDITORIAL_RULE_CODES } from './rules.js';

const DEFAULT_RULE_DEFINITIONS = Object.freeze([
  Object.freeze({
    code: 'missing-required-section',
    analyzerId: 'structure',
    group: 'structure-quality',
    priority: 10,
    title: 'Missing required section',
    description: 'Detects required profile sections that are absent from the draft.',
    findingCode: 'missing-required-section',
  }),
  Object.freeze({
    code: 'duplicate-h1',
    analyzerId: 'structure',
    group: 'structure-quality',
    priority: 20,
    title: 'Duplicate H1 heading',
    description: 'Detects multiple top-level title headings in the draft.',
    findingCode: 'duplicate-h1',
  }),
  Object.freeze({
    code: 'invalid-heading-hierarchy',
    analyzerId: 'structure',
    group: 'structure-quality',
    priority: 30,
    title: 'Invalid heading hierarchy',
    description: 'Detects skipped heading levels in the draft outline.',
    findingCode: 'invalid-heading-hierarchy',
  }),
  Object.freeze({
    code: 'repeated-section-heading',
    analyzerId: 'structure',
    group: 'structure-quality',
    priority: 40,
    title: 'Repeated section heading',
    description: 'Detects duplicated section heading text.',
    findingCode: 'repeated-section-heading',
  }),
  Object.freeze({
    code: 'malformed-markdown-heading',
    analyzerId: 'structure',
    group: 'structure-quality',
    priority: 50,
    title: 'Malformed Markdown heading',
    description: 'Detects invalid ATX heading syntax.',
    findingCode: 'malformed-markdown-heading',
  }),
  Object.freeze({
    code: 'thin-section',
    analyzerId: 'readability',
    group: 'readability-quality',
    priority: 60,
    title: 'Thin section',
    description: 'Detects sections with insufficient substantive content.',
    findingCode: 'thin-section',
  }),
  Object.freeze({
    code: 'long-paragraph',
    analyzerId: 'readability',
    group: 'readability-quality',
    priority: 70,
    title: 'Long paragraph',
    description: 'Detects paragraphs that exceed the configured character limit.',
    findingCode: 'long-paragraph',
  }),
  Object.freeze({
    code: 'long-sentence',
    analyzerId: 'readability',
    group: 'readability-quality',
    priority: 80,
    title: 'Long sentence',
    description: 'Detects sentences that exceed the configured word limit.',
    findingCode: 'long-sentence',
  }),
  Object.freeze({
    code: 'formatting-corruption',
    analyzerId: 'formatting',
    group: 'formatting-quality',
    priority: 90,
    title: 'Formatting corruption',
    description: 'Detects merged-word corruption and spacing defects.',
    findingCode: 'formatting-corruption',
  }),
  Object.freeze({
    code: 'promotional-tone',
    analyzerId: 'tone',
    group: 'tone-quality',
    priority: 100,
    title: 'Promotional tone signal',
    description: 'Detects promotional language configured by the profile.',
    findingCode: 'promotional-tone',
  }),
  Object.freeze({
    code: 'diagnostic-tone',
    analyzerId: 'tone',
    group: 'tone-quality',
    priority: 110,
    title: 'Diagnostic tone signal',
    description: 'Detects diagnostic or urgent medical tone configured by the profile.',
    findingCode: 'diagnostic-tone',
  }),
] as const satisfies readonly {
  readonly code: (typeof EDITORIAL_RULE_CODES)[number];
  readonly analyzerId: string;
  readonly group: string;
  readonly priority: number;
  readonly title: string;
  readonly description: string;
  readonly findingCode: string;
}[]);

function buildDefaultEditorialRule(
  scopeId: string,
  definition: (typeof DEFAULT_RULE_DEFINITIONS)[number],
): EditorialRule {
  const id = buildDeterministicEditorialRuleId({
    scopeId,
    category: 'editorial',
    analyzerId: definition.analyzerId,
    code: definition.code,
  });

  return normalizeEditorialRuleInput({
    id,
    category: 'editorial',
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

/** Create the default editorial rule registry for a profile scope. */
export function createDefaultEditorialRuleRegistry(
  scopeId = 'generic-editorial-v1',
): EditorialRuleRegistry {
  const rules = DEFAULT_RULE_DEFINITIONS.map((definition) =>
    buildDefaultEditorialRule(scopeId, definition),
  );
  return new EditorialRuleRegistry(rules);
}

export { DEFAULT_RULE_DEFINITIONS, EDITORIAL_RULE_CODES };
