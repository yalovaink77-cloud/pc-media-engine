import type { EditorialRule } from '@pcme/shared';

import { buildDeterministicEditorialRuleId } from '../rule/ids.js';
import { EditorialRuleRegistry } from '../rule/registry.js';
import { normalizeEditorialRuleInput } from '../rule/validate.js';
import { AI_SEO_RULE_CODES } from './rules.js';

const DEFAULT_RULE_DEFINITIONS = Object.freeze([
  Object.freeze({
    code: 'incomplete-canonical-entity-coverage',
    analyzerId: 'entities',
    group: 'ai-seo-entities',
    priority: 10,
    title: 'Incomplete canonical entity coverage',
    description: 'Detects missing canonical entities required for machine retrieval.',
    findingCode: 'incomplete-canonical-entity-coverage',
  }),
  Object.freeze({
    code: 'ambiguous-entity-reference',
    analyzerId: 'entities',
    group: 'ai-seo-entities',
    priority: 20,
    title: 'Ambiguous entity reference',
    description: 'Detects pronoun-heavy sections without explicit entity references.',
    findingCode: 'ambiguous-entity-reference',
  }),
  Object.freeze({
    code: 'excessive-pronoun-without-antecedent',
    analyzerId: 'clarity',
    group: 'ai-seo-clarity',
    priority: 30,
    title: 'Excessive pronoun without antecedent',
    description: 'Detects pronoun-heavy text without clear antecedents.',
    findingCode: 'excessive-pronoun-without-antecedent',
  }),
  Object.freeze({
    code: 'missing-direct-answer-opening',
    analyzerId: 'answer-precision',
    group: 'ai-seo-answers',
    priority: 40,
    title: 'Missing direct answer opening',
    description: 'Detects summary sections without direct answer openings.',
    findingCode: 'missing-direct-answer-opening',
  }),
  Object.freeze({
    code: 'indirect-faq-answer',
    analyzerId: 'faq',
    group: 'ai-seo-answers',
    priority: 50,
    title: 'Indirect FAQ answer',
    description: 'Detects FAQ answers that are too indirect for synthesis.',
    findingCode: 'indirect-faq-answer',
  }),
  Object.freeze({
    code: 'poor-section-chunkability',
    analyzerId: 'chunking',
    group: 'ai-seo-chunking',
    priority: 60,
    title: 'Poor section chunkability',
    description: 'Detects sections that are hard to chunk for retrieval.',
    findingCode: 'poor-section-chunkability',
  }),
  Object.freeze({
    code: 'section-too-long-for-retrieval',
    analyzerId: 'chunking',
    group: 'ai-seo-chunking',
    priority: 70,
    title: 'Section too long for retrieval',
    description: 'Detects sections exceeding configured retrieval chunk size.',
    findingCode: 'section-too-long-for-retrieval',
  }),
  Object.freeze({
    code: 'section-too-thin-to-stand-alone',
    analyzerId: 'chunking',
    group: 'ai-seo-chunking',
    priority: 80,
    title: 'Section too thin to stand alone',
    description: 'Detects sections too thin to serve as standalone retrieval chunks.',
    findingCode: 'section-too-thin-to-stand-alone',
  }),
  Object.freeze({
    code: 'missing-heading-led-context',
    analyzerId: 'chunking',
    group: 'ai-seo-chunking',
    priority: 90,
    title: 'Missing heading-led context',
    description: 'Detects sections without heading-led context openings.',
    findingCode: 'missing-heading-led-context',
  }),
  Object.freeze({
    code: 'low-source-transparency',
    analyzerId: 'citations',
    group: 'ai-seo-citations',
    priority: 100,
    title: 'Low source transparency',
    description: 'Detects source-oriented language without transparency cues.',
    findingCode: 'low-source-transparency',
  }),
  Object.freeze({
    code: 'missing-manufacturer-versus-verified-labeling',
    analyzerId: 'grounding',
    group: 'ai-seo-grounding',
    priority: 110,
    title: 'Missing manufacturer versus verified labeling',
    description: 'Detects manufacturer claims without verified-versus-manufacturer labeling.',
    findingCode: 'missing-manufacturer-versus-verified-labeling',
  }),
  Object.freeze({
    code: 'unsupported-authoritative-phrasing',
    analyzerId: 'grounding',
    group: 'ai-seo-grounding',
    priority: 120,
    title: 'Unsupported authoritative phrasing',
    description: 'Detects authoritative phrasing without transparency cues.',
    findingCode: 'unsupported-authoritative-phrasing',
  }),
  Object.freeze({
    code: 'incomplete-audience-question-coverage',
    analyzerId: 'intent',
    group: 'ai-seo-intent',
    priority: 130,
    title: 'Incomplete audience question coverage',
    description: 'Detects audience questions not addressed in the draft.',
    findingCode: 'incomplete-audience-question-coverage',
  }),
  Object.freeze({
    code: 'duplicated-question-coverage',
    analyzerId: 'intent',
    group: 'ai-seo-intent',
    priority: 140,
    title: 'Duplicated question coverage',
    description: 'Detects overlapping audience question intent buckets.',
    findingCode: 'duplicated-question-coverage',
  }),
  Object.freeze({
    code: 'contradictory-suitability-or-limitation',
    analyzerId: 'consistency',
    group: 'ai-seo-consistency',
    priority: 150,
    title: 'Contradictory suitability or limitation',
    description: 'Detects contradictory suitability and limitation statements.',
    findingCode: 'contradictory-suitability-or-limitation',
  }),
  Object.freeze({
    code: 'vague-claim-without-named-subject',
    analyzerId: 'clarity',
    group: 'ai-seo-clarity',
    priority: 160,
    title: 'Vague claim without named subject',
    description: 'Detects vague claims without named subjects.',
    findingCode: 'vague-claim-without-named-subject',
  }),
  Object.freeze({
    code: 'low-factual-density',
    analyzerId: 'density',
    group: 'ai-seo-density',
    priority: 170,
    title: 'Low factual density',
    description: 'Detects sections with low factual density for retrieval.',
    findingCode: 'low-factual-density',
  }),
  Object.freeze({
    code: 'excessive-filler-language',
    analyzerId: 'clarity',
    group: 'ai-seo-clarity',
    priority: 180,
    title: 'Excessive filler language',
    description: 'Detects excessive filler language in retrieval-critical sections.',
    findingCode: 'excessive-filler-language',
  }),
  Object.freeze({
    code: 'citation-unfriendly-statement',
    analyzerId: 'citations',
    group: 'ai-seo-citations',
    priority: 190,
    title: 'Citation-unfriendly statement',
    description: 'Detects phrasing that is difficult to cite or attribute.',
    findingCode: 'citation-unfriendly-statement',
  }),
  Object.freeze({
    code: 'missing-explicit-uncertainty-language',
    analyzerId: 'grounding',
    group: 'ai-seo-grounding',
    priority: 200,
    title: 'Missing explicit uncertainty language',
    description: 'Detects limitation language without explicit uncertainty markers.',
    findingCode: 'missing-explicit-uncertainty-language',
  }),
] as const satisfies readonly {
  readonly code: (typeof AI_SEO_RULE_CODES)[number];
  readonly analyzerId: string;
  readonly group: string;
  readonly priority: number;
  readonly title: string;
  readonly description: string;
  readonly findingCode: string;
}[]);

function buildDefaultAiSeoRule(
  scopeId: string,
  definition: (typeof DEFAULT_RULE_DEFINITIONS)[number],
): EditorialRule {
  const id = buildDeterministicEditorialRuleId({
    scopeId,
    category: 'ai-seo',
    analyzerId: definition.analyzerId,
    code: definition.code,
  });

  return normalizeEditorialRuleInput({
    id,
    category: 'ai-seo',
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

/** Create the default AI SEO rule registry for a profile scope. */
export function createDefaultAiSeoRuleRegistry(
  scopeId = 'generic-ai-seo-v1',
): EditorialRuleRegistry {
  const rules = DEFAULT_RULE_DEFINITIONS.map((definition) =>
    buildDefaultAiSeoRule(scopeId, definition),
  );
  return new EditorialRuleRegistry(rules);
}

export { AI_SEO_RULE_CODES, DEFAULT_RULE_DEFINITIONS };
