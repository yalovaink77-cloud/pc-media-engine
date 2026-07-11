import type { KnowledgeContextResult } from '../knowledge/context/types.js';
import type { PromptConstraint } from './types.js';

/** Universal safety constraints applied to every prompt payload. */
export const UNIVERSAL_PROMPT_CONSTRAINTS: readonly PromptConstraint[] = Object.freeze([
  Object.freeze({
    id: 'evidence-policy',
    category: 'evidence',
    rule: 'Base factual claims only on supplied knowledge context. Do not invent specifications, certifications, or clinical outcomes.',
    severity: 'required',
  }),
  Object.freeze({
    id: 'affiliate-policy',
    category: 'affiliate',
    rule: 'When mentioning products, prioritize reader safety and fit over monetization. Disclose affiliate relationships when CTAs are used.',
    severity: 'required',
  }),
  Object.freeze({
    id: 'no-diagnosis',
    category: 'medical',
    rule: 'Do not diagnose conditions or tell readers they have a specific medical problem.',
    severity: 'required',
  }),
  Object.freeze({
    id: 'no-unsupported-medical-claims',
    category: 'medical',
    rule: 'Do not claim cures, guaranteed healing times, reduced bacterial risk, sensitive-skin suitability, fixed usage frequency, universal suitability for all piercing types, or other medical outcomes not supported by the provided context. Distinguish verified structured facts, manufacturer positioning, professional guidance, and uncertainty.',
    severity: 'required',
  }),
  Object.freeze({
    id: 'no-commission-first',
    category: 'affiliate',
    rule: 'Do not rank or recommend products primarily because of affiliate availability or commission potential.',
    severity: 'required',
  }),
  Object.freeze({
    id: 'uncertainty-disclosure',
    category: 'disclosure',
    rule: 'When context is incomplete or truncated, explicitly state uncertainty and avoid definitive claims.',
    severity: 'required',
  }),
  Object.freeze({
    id: 'citation-placeholders',
    category: 'evidence',
    rule: 'When source notes or evidence references are available in context, include structured citation placeholders such as [Source: product official record], [Source: ingredient evidence record], and [Source: APP-aligned aftercare guidance]. Do not invent URLs or citations.',
    severity: 'required',
  }),
]);

const constraintById = new Map(
  UNIVERSAL_PROMPT_CONSTRAINTS.map((constraint) => [constraint.id, constraint]),
);

export function getUniversalPromptConstraint(id: string): PromptConstraint | undefined {
  return constraintById.get(id);
}

export function buildMandatoryConstraints(
  constraintIds: readonly string[],
  context: KnowledgeContextResult,
): readonly PromptConstraint[] {
  const constraints: PromptConstraint[] = [];

  for (const id of constraintIds) {
    const constraint = getUniversalPromptConstraint(id);
    if (constraint) {
      constraints.push(constraint);
    }
  }

  if (context.missingRequired.length > 0 || context.truncated) {
    const uncertainty = getUniversalPromptConstraint('uncertainty-disclosure');
    if (uncertainty && !constraints.some((entry) => entry.id === uncertainty.id)) {
      constraints.push(uncertainty);
    }
  }

  return Object.freeze(
    [...constraints].sort((a, b) => {
      const categoryOrder = a.category.localeCompare(b.category);
      if (categoryOrder !== 0) {
        return categoryOrder;
      }
      return a.id.localeCompare(b.id);
    }),
  );
}
