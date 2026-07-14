import type { EditorialRule } from '@pcme/shared';

import { buildDeterministicEditorialRuleId } from '../rule/ids.js';
import { EditorialRuleRegistry } from '../rule/registry.js';
import { normalizeEditorialRuleInput } from '../rule/validate.js';
import { COMMERCIAL_RULE_CODES } from './rules.js';

const DEFAULT_RULE_DEFINITIONS = Object.freeze([
  Object.freeze({
    code: 'affiliate-disclosure-missing',
    analyzerId: 'disclosure',
    group: 'commercial-disclosure',
    priority: 10,
    title: 'Affiliate disclosure missing',
    description: 'Detects missing resolved affiliate or commercial disclosures.',
    findingCode: 'affiliate-disclosure-missing',
  }),
  Object.freeze({
    code: 'affiliate-disclosure-misplaced',
    analyzerId: 'disclosure',
    group: 'commercial-disclosure',
    priority: 20,
    title: 'Affiliate disclosure misplaced',
    description: 'Detects disclosures outside the configured publication position.',
    findingCode: 'affiliate-disclosure-misplaced',
  }),
  Object.freeze({
    code: 'affiliate-disclosure-duplicate',
    analyzerId: 'disclosure',
    group: 'commercial-disclosure',
    priority: 30,
    title: 'Affiliate disclosure duplicate',
    description: 'Detects duplicate affiliate disclosure sections.',
    findingCode: 'affiliate-disclosure-duplicate',
  }),
  Object.freeze({
    code: 'commercial-relationship-not-disclosed',
    analyzerId: 'disclosure',
    group: 'commercial-disclosure',
    priority: 40,
    title: 'Commercial relationship not disclosed',
    description: 'Detects commercial relationship language without disclosure.',
    findingCode: 'commercial-relationship-not-disclosed',
  }),
  Object.freeze({
    code: 'single-product-bias',
    analyzerId: 'neutrality',
    group: 'commercial-neutrality',
    priority: 50,
    title: 'Single product bias',
    description: 'Detects single-product bias without alternatives coverage.',
    findingCode: 'single-product-bias',
  }),
  Object.freeze({
    code: 'missing-alternatives',
    analyzerId: 'structure',
    group: 'commercial-structure',
    priority: 60,
    title: 'Missing alternatives',
    description: 'Detects missing or insufficient alternatives coverage.',
    findingCode: 'missing-alternatives',
  }),
  Object.freeze({
    code: 'missing-disadvantages',
    analyzerId: 'structure',
    group: 'commercial-structure',
    priority: 70,
    title: 'Missing disadvantages',
    description: 'Detects missing disadvantages or limitations sections.',
    findingCode: 'missing-disadvantages',
  }),
  Object.freeze({
    code: 'missing-advantages',
    analyzerId: 'structure',
    group: 'commercial-structure',
    priority: 80,
    title: 'Missing advantages',
    description: 'Detects missing advantages sections.',
    findingCode: 'missing-advantages',
  }),
  Object.freeze({
    code: 'missing-comparison-opportunity',
    analyzerId: 'structure',
    group: 'commercial-structure',
    priority: 90,
    title: 'Missing comparison opportunity',
    description: 'Detects missing comparison or alternatives context.',
    findingCode: 'missing-comparison-opportunity',
  }),
  Object.freeze({
    code: 'unsupported-purchase-recommendation',
    analyzerId: 'recommendations',
    group: 'commercial-recommendations',
    priority: 100,
    title: 'Unsupported purchase recommendation',
    description: 'Detects unsupported purchase recommendation language.',
    findingCode: 'unsupported-purchase-recommendation',
  }),
  Object.freeze({
    code: 'overly-promotional-language',
    analyzerId: 'neutrality',
    group: 'commercial-neutrality',
    priority: 110,
    title: 'Overly promotional language',
    description: 'Detects overly promotional language that reduces trust.',
    findingCode: 'overly-promotional-language',
  }),
  Object.freeze({
    code: 'commercial-call-to-action-imbalance',
    analyzerId: 'neutrality',
    group: 'commercial-neutrality',
    priority: 120,
    title: 'Commercial call-to-action imbalance',
    description: 'Detects excessive commercial call-to-action phrasing.',
    findingCode: 'commercial-call-to-action-imbalance',
  }),
  Object.freeze({
    code: 'price-mention-without-context',
    analyzerId: 'claims',
    group: 'commercial-claims',
    priority: 130,
    title: 'Price mention without context',
    description: 'Detects price mentions without contextual qualification.',
    findingCode: 'price-mention-without-context',
  }),
  Object.freeze({
    code: 'availability-claim-without-qualification',
    analyzerId: 'claims',
    group: 'commercial-claims',
    priority: 140,
    title: 'Availability claim without qualification',
    description: 'Detects availability claims without qualification.',
    findingCode: 'availability-claim-without-qualification',
  }),
  Object.freeze({
    code: 'sponsored-wording-indicator',
    analyzerId: 'disclosure',
    group: 'commercial-disclosure',
    priority: 150,
    title: 'Sponsored wording indicator',
    description: 'Detects sponsored wording indicators.',
    findingCode: 'sponsored-wording-indicator',
  }),
  Object.freeze({
    code: 'missing-neutrality-statement',
    analyzerId: 'neutrality',
    group: 'commercial-neutrality',
    priority: 160,
    title: 'Missing neutrality statement',
    description: 'Detects promotional language without neutrality statements.',
    findingCode: 'missing-neutrality-statement',
  }),
  Object.freeze({
    code: 'missing-product-suitability-section',
    analyzerId: 'structure',
    group: 'commercial-structure',
    priority: 170,
    title: 'Missing product suitability section',
    description: 'Detects missing product suitability sections.',
    findingCode: 'missing-product-suitability-section',
  }),
  Object.freeze({
    code: 'missing-who-should-avoid-guidance',
    analyzerId: 'structure',
    group: 'commercial-structure',
    priority: 180,
    title: 'Missing who should avoid guidance',
    description: 'Detects missing who-should-avoid guidance.',
    findingCode: 'missing-who-should-avoid-guidance',
  }),
  Object.freeze({
    code: 'missing-decision-support-information',
    analyzerId: 'structure',
    group: 'commercial-structure',
    priority: 190,
    title: 'Missing decision support information',
    description: 'Detects missing decision-support information.',
    findingCode: 'missing-decision-support-information',
  }),
  Object.freeze({
    code: 'imbalanced-pros-cons-ratio',
    analyzerId: 'neutrality',
    group: 'commercial-neutrality',
    priority: 200,
    title: 'Imbalanced pros and cons ratio',
    description: 'Detects imbalanced advantages and disadvantages coverage.',
    findingCode: 'imbalanced-pros-cons-ratio',
  }),
  Object.freeze({
    code: 'commercial-repetition',
    analyzerId: 'neutrality',
    group: 'commercial-neutrality',
    priority: 210,
    title: 'Commercial repetition',
    description: 'Detects excessive repetition of commercial phrasing.',
    findingCode: 'commercial-repetition',
  }),
] as const satisfies readonly {
  readonly code: (typeof COMMERCIAL_RULE_CODES)[number];
  readonly analyzerId: string;
  readonly group: string;
  readonly priority: number;
  readonly title: string;
  readonly description: string;
  readonly findingCode: string;
}[]);

function buildDefaultCommercialRule(
  scopeId: string,
  definition: (typeof DEFAULT_RULE_DEFINITIONS)[number],
): EditorialRule {
  const id = buildDeterministicEditorialRuleId({
    scopeId,
    category: 'commercial',
    analyzerId: definition.analyzerId,
    code: definition.code,
  });

  return normalizeEditorialRuleInput({
    id,
    category: 'commercial',
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

/** Create the default commercial rule registry for a profile scope. */
export function createDefaultCommercialRuleRegistry(
  scopeId = 'generic-commercial-v1',
): EditorialRuleRegistry {
  const rules = DEFAULT_RULE_DEFINITIONS.map((definition) =>
    buildDefaultCommercialRule(scopeId, definition),
  );
  return new EditorialRuleRegistry(rules);
}

export { COMMERCIAL_RULE_CODES, DEFAULT_RULE_DEFINITIONS };
