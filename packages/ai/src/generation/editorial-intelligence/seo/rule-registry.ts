import type { EditorialRule } from '@pcme/shared';

import { buildDeterministicEditorialRuleId } from '../rule/ids.js';
import { EditorialRuleRegistry } from '../rule/registry.js';
import { normalizeEditorialRuleInput } from '../rule/validate.js';
import { SEO_RULE_CODES } from './rules.js';

const DEFAULT_RULE_DEFINITIONS = Object.freeze([
  Object.freeze({
    code: 'missing-h1',
    analyzerId: 'structure',
    group: 'seo-structure',
    priority: 10,
    title: 'Missing H1',
    description: 'Detects drafts without an H1 title heading.',
    findingCode: 'missing-h1',
  }),
  Object.freeze({
    code: 'duplicate-h1',
    analyzerId: 'structure',
    group: 'seo-structure',
    priority: 20,
    title: 'Duplicate H1',
    description: 'Detects multiple H1 headings in the draft.',
    findingCode: 'duplicate-h1',
  }),
  Object.freeze({
    code: 'invalid-heading-hierarchy',
    analyzerId: 'structure',
    group: 'seo-structure',
    priority: 30,
    title: 'Invalid heading hierarchy',
    description: 'Detects skipped heading levels in the draft.',
    findingCode: 'invalid-heading-hierarchy',
  }),
  Object.freeze({
    code: 'missing-required-section',
    analyzerId: 'structure',
    group: 'seo-structure',
    priority: 40,
    title: 'Missing required section',
    description: 'Detects required content-type sections missing from the draft.',
    findingCode: 'missing-required-section',
  }),
  Object.freeze({
    code: 'weak-title-keyword-coverage',
    analyzerId: 'keywords',
    group: 'seo-metadata',
    priority: 50,
    title: 'Weak title keyword coverage',
    description: 'Detects titles without configured target keywords.',
    findingCode: 'weak-title-keyword-coverage',
  }),
  Object.freeze({
    code: 'title-too-short',
    analyzerId: 'metadata',
    group: 'seo-metadata',
    priority: 60,
    title: 'Title too short',
    description: 'Detects titles below the configured minimum length.',
    findingCode: 'title-too-short',
  }),
  Object.freeze({
    code: 'title-too-long',
    analyzerId: 'metadata',
    group: 'seo-metadata',
    priority: 70,
    title: 'Title too long',
    description: 'Detects titles above the configured maximum length.',
    findingCode: 'title-too-long',
  }),
  Object.freeze({
    code: 'missing-meta-description-candidate',
    analyzerId: 'metadata',
    group: 'seo-metadata',
    priority: 80,
    title: 'Missing meta description candidate',
    description: 'Detects drafts without a derivable meta description candidate.',
    findingCode: 'missing-meta-description-candidate',
  }),
  Object.freeze({
    code: 'meta-description-too-short',
    analyzerId: 'metadata',
    group: 'seo-metadata',
    priority: 90,
    title: 'Meta description too short',
    description: 'Detects meta description candidates below the configured minimum.',
    findingCode: 'meta-description-too-short',
  }),
  Object.freeze({
    code: 'meta-description-too-long',
    analyzerId: 'metadata',
    group: 'seo-metadata',
    priority: 100,
    title: 'Meta description too long',
    description: 'Detects meta description candidates above the configured maximum.',
    findingCode: 'meta-description-too-long',
  }),
  Object.freeze({
    code: 'missing-required-topic-entity',
    analyzerId: 'entities',
    group: 'seo-coverage',
    priority: 110,
    title: 'Missing required topic entity',
    description: 'Detects required topic entities absent from the draft.',
    findingCode: 'missing-required-topic-entity',
  }),
  Object.freeze({
    code: 'thin-content-section',
    analyzerId: 'content-depth',
    group: 'seo-coverage',
    priority: 120,
    title: 'Thin content section',
    description: 'Detects sections below configured word-count thresholds.',
    findingCode: 'thin-content-section',
  }),
  Object.freeze({
    code: 'missing-faq-section',
    analyzerId: 'faq',
    group: 'seo-faq',
    priority: 130,
    title: 'Missing FAQ section',
    description: 'Detects drafts without a configured FAQ section.',
    findingCode: 'missing-faq-section',
  }),
  Object.freeze({
    code: 'insufficient-faq-question-count',
    analyzerId: 'faq',
    group: 'seo-faq',
    priority: 140,
    title: 'Insufficient FAQ question count',
    description: 'Detects FAQ sections with fewer questions than required.',
    findingCode: 'insufficient-faq-question-count',
  }),
  Object.freeze({
    code: 'duplicate-faq-question',
    analyzerId: 'faq',
    group: 'seo-faq',
    priority: 150,
    title: 'Duplicate FAQ question',
    description: 'Detects repeated FAQ questions.',
    findingCode: 'duplicate-faq-question',
  }),
  Object.freeze({
    code: 'indirect-faq-answer',
    analyzerId: 'faq',
    group: 'seo-faq',
    priority: 160,
    title: 'Indirect FAQ answer',
    description: 'Detects vague or indirect FAQ answers.',
    findingCode: 'indirect-faq-answer',
  }),
  Object.freeze({
    code: 'missing-internal-link-opportunity',
    analyzerId: 'links',
    group: 'seo-links',
    priority: 170,
    title: 'Missing internal link opportunity',
    description: 'Detects internal-link topics without markdown links.',
    findingCode: 'missing-internal-link-opportunity',
  }),
  Object.freeze({
    code: 'missing-external-citation-opportunity',
    analyzerId: 'citations',
    group: 'seo-links',
    priority: 180,
    title: 'Missing external citation opportunity',
    description: 'Detects citation-opportunity language without external links.',
    findingCode: 'missing-external-citation-opportunity',
  }),
  Object.freeze({
    code: 'search-intent-gap',
    analyzerId: 'intent',
    group: 'seo-intent',
    priority: 190,
    title: 'Search intent gap',
    description: 'Detects configured search intent questions not addressed in the draft.',
    findingCode: 'search-intent-gap',
  }),
] as const satisfies readonly {
  readonly code: (typeof SEO_RULE_CODES)[number];
  readonly analyzerId: string;
  readonly group: string;
  readonly priority: number;
  readonly title: string;
  readonly description: string;
  readonly findingCode: string;
}[]);

function buildDefaultSeoRule(
  scopeId: string,
  definition: (typeof DEFAULT_RULE_DEFINITIONS)[number],
): EditorialRule {
  const id = buildDeterministicEditorialRuleId({
    scopeId,
    category: 'seo',
    analyzerId: definition.analyzerId,
    code: definition.code,
  });

  return normalizeEditorialRuleInput({
    id,
    category: 'seo',
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

/** Create the default SEO rule registry for a profile scope. */
export function createDefaultSeoRuleRegistry(scopeId = 'generic-seo-v1'): EditorialRuleRegistry {
  const rules = DEFAULT_RULE_DEFINITIONS.map((definition) =>
    buildDefaultSeoRule(scopeId, definition),
  );
  return new EditorialRuleRegistry(rules);
}

export { DEFAULT_RULE_DEFINITIONS, SEO_RULE_CODES };
