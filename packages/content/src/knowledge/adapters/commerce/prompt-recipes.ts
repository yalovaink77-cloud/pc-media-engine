import type { PromptContentRecipeDefinition } from '../../../prompt/types.js';

const SHARED_SAFETY_CONSTRAINTS = [
  'evidence-policy',
  'affiliate-policy',
  'no-diagnosis',
  'no-unsupported-medical-claims',
  'no-commission-first',
  'uncertainty-disclosure',
  'citation-placeholders',
] as const;

const SHARED_ALLOWED_CTAS = Object.freeze([
  'learn-more',
  'compare-options',
  'consult-professional',
  'read-aftercare-guide',
]);

const SHARED_PROHIBITED_CTAS = Object.freeze([
  'commission-first',
  'buy-now-urgency',
  'hidden-affiliate',
  'guaranteed-healing',
  'medical-diagnosis',
]);

function defineRecipe(recipe: PromptContentRecipeDefinition): PromptContentRecipeDefinition {
  return recipe;
}

/** PiercingConnect commerce prompt content recipes. */
export const COMMERCE_PROMPT_CONTENT_RECIPES: readonly PromptContentRecipeDefinition[] = [
  defineRecipe({
    id: 'brand-profile',
    requiredContextRecipeId: 'brand-profile',
    contentObjective:
      'Write an educational brand profile that explains who the brand is, what products it offers, and why readers might consider it.',
    sectionOrder: [
      'content-objective',
      'brand-overview',
      'product-lineup',
      'category-context',
      'safety-reminders',
      'sources-and-citations',
    ],
    sectionBindings: {
      'brand-overview': { includeRoot: true },
      'product-lineup': { entityTypes: ['product'] },
      'category-context': { entityTypes: ['product-category'] },
    },
    mandatorySafetyConstraintIds: [...SHARED_SAFETY_CONSTRAINTS],
    optionalAffiliateSections: ['affiliate-opportunities'],
    outputStructure: [
      'introduction',
      'brand-overview',
      'product-lineup',
      'category-context',
      'trust-and-fit',
      'cta',
    ],
    allowedCtaTypes: [...SHARED_ALLOWED_CTAS],
    prohibitedCtaTypes: [...SHARED_PROHIBITED_CTAS],
  }),
  defineRecipe({
    id: 'product-review',
    requiredContextRecipeId: 'product-review',
    contentObjective:
      'Write an educational product review that helps readers understand ingredients, aftercare fit, and practical buying considerations.',
    sectionOrder: [
      'content-objective',
      'product-overview',
      'brand-context',
      'ingredients',
      'healing-stages',
      'category-context',
      'safety-reminders',
      'sources-and-citations',
    ],
    sectionBindings: {
      'product-overview': { includeRoot: true },
      'brand-context': { entityTypes: ['brand'] },
      ingredients: { entityTypes: ['ingredient'] },
      'healing-stages': { entityTypes: ['healing-stage'] },
      'category-context': { entityTypes: ['product-category'] },
    },
    mandatorySafetyConstraintIds: [...SHARED_SAFETY_CONSTRAINTS],
    optionalAffiliateSections: ['affiliate-opportunities'],
    outputStructure: [
      'introduction',
      'product-overview',
      'ingredients-and-formulation',
      'aftercare-fit',
      'pros-and-cons',
      'who-it-is-for',
      'cta',
    ],
    allowedCtaTypes: [...SHARED_ALLOWED_CTAS, 'check-availability'],
    prohibitedCtaTypes: [...SHARED_PROHIBITED_CTAS],
  }),
  defineRecipe({
    id: 'product-comparison',
    requiredContextRecipeId: 'product-comparison',
    contentObjective:
      'Compare products objectively using supplied context and highlight meaningful differences without commission-first framing.',
    sectionOrder: [
      'content-objective',
      'product-overview',
      'brand-context',
      'ingredients',
      'category-context',
      'safety-reminders',
      'sources-and-citations',
    ],
    sectionBindings: {
      'product-overview': { includeRoot: true },
      'brand-context': { entityTypes: ['brand'] },
      ingredients: { entityTypes: ['ingredient'] },
      'category-context': { entityTypes: ['product-category'] },
    },
    mandatorySafetyConstraintIds: [...SHARED_SAFETY_CONSTRAINTS],
    optionalAffiliateSections: ['affiliate-opportunities'],
    outputStructure: [
      'introduction',
      'comparison-table',
      'ingredient-differences',
      'aftercare-fit',
      'recommendation-framework',
      'cta',
    ],
    allowedCtaTypes: [...SHARED_ALLOWED_CTAS, 'compare-options'],
    prohibitedCtaTypes: [...SHARED_PROHIBITED_CTAS, 'rank-by-commission'],
  }),
  defineRecipe({
    id: 'problem-guide',
    requiredContextRecipeId: 'problem-guide',
    contentObjective:
      'Write a cautious problem guide that explains symptoms, likely causes, and safe next steps without diagnosing readers.',
    sectionOrder: [
      'content-objective',
      'problem-overview',
      'symptoms',
      'related-products',
      'related-ingredients',
      'safety-reminders',
      'sources-and-citations',
    ],
    sectionBindings: {
      'problem-overview': { includeRoot: true },
      symptoms: { entityTypes: ['symptom'] },
      'related-products': { entityTypes: ['product'] },
      'related-ingredients': { entityTypes: ['ingredient'] },
    },
    mandatorySafetyConstraintIds: [...SHARED_SAFETY_CONSTRAINTS],
    outputStructure: [
      'introduction',
      'symptoms',
      'what-it-may-indicate',
      'safe-next-steps',
      'when-to-seek-help',
      'cta',
    ],
    allowedCtaTypes: [...SHARED_ALLOWED_CTAS, 'consult-professional'],
    prohibitedCtaTypes: [...SHARED_PROHIBITED_CTAS, 'self-diagnosis'],
  }),
  defineRecipe({
    id: 'aftercare-guide',
    requiredContextRecipeId: 'aftercare-guide',
    contentObjective:
      'Write an aftercare guide that explains healing expectations and common issues for the selected piercing type.',
    sectionOrder: [
      'content-objective',
      'piercing-type-overview',
      'healing-stages',
      'common-problems',
      'safety-reminders',
      'sources-and-citations',
    ],
    sectionBindings: {
      'piercing-type-overview': { includeRoot: true },
      'healing-stages': { entityTypes: ['healing-stage'] },
      'common-problems': { entityTypes: ['problem'] },
    },
    mandatorySafetyConstraintIds: [...SHARED_SAFETY_CONSTRAINTS],
    outputStructure: [
      'introduction',
      'healing-timeline',
      'daily-care',
      'common-problems',
      'when-to-seek-help',
      'cta',
    ],
    allowedCtaTypes: [...SHARED_ALLOWED_CTAS],
    prohibitedCtaTypes: [...SHARED_PROHIBITED_CTAS],
  }),
  defineRecipe({
    id: 'buying-guide',
    requiredContextRecipeId: 'buying-guide',
    contentObjective:
      'Write a buying guide that helps readers evaluate products and brands using the supplied category and keyword context.',
    sectionOrder: [
      'content-objective',
      'keyword-context',
      'related-products',
      'related-brands',
      'ingredients',
      'category-context',
      'safety-reminders',
      'sources-and-citations',
    ],
    sectionBindings: {
      'keyword-context': { includeRoot: true },
      'related-products': { entityTypes: ['product'] },
      'related-brands': { entityTypes: ['brand'] },
      ingredients: { entityTypes: ['ingredient'] },
      'category-context': { entityTypes: ['product-category'] },
    },
    mandatorySafetyConstraintIds: [...SHARED_SAFETY_CONSTRAINTS],
    optionalAffiliateSections: ['affiliate-opportunities'],
    outputStructure: [
      'introduction',
      'what-to-look-for',
      'recommended-options',
      'comparison-notes',
      'cta',
    ],
    allowedCtaTypes: [...SHARED_ALLOWED_CTAS, 'compare-options'],
    prohibitedCtaTypes: [...SHARED_PROHIBITED_CTAS, 'rank-by-commission'],
  }),
] as const;

const recipeById = new Map(COMMERCE_PROMPT_CONTENT_RECIPES.map((recipe) => [recipe.id, recipe]));

export function getCommercePromptContentRecipes(): readonly PromptContentRecipeDefinition[] {
  return COMMERCE_PROMPT_CONTENT_RECIPES;
}

export function getCommercePromptContentRecipe(
  contentType: string,
): PromptContentRecipeDefinition | undefined {
  return recipeById.get(contentType);
}
