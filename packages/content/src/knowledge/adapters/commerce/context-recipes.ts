import type { KnowledgeContextRecipeDefinition } from '../../context/types.js';

function defineRecipe(recipe: KnowledgeContextRecipeDefinition): KnowledgeContextRecipeDefinition {
  return recipe;
}

/** PiercingConnect commerce context recipes for template assembly. */
export const COMMERCE_CONTEXT_RECIPES: readonly KnowledgeContextRecipeDefinition[] = [
  defineRecipe({
    id: 'brand-profile',
    rootEntityType: 'brand',
    follow: ['brand.products', 'product.product-category'],
    requiredEntityTypes: ['brand', 'product'],
    optionalEntityTypes: ['product-category', 'keyword-cluster'],
    defaultProjection: 'summary',
    maxDepth: 2,
    maxNodes: 100,
  }),
  defineRecipe({
    id: 'product-review',
    rootEntityType: 'product',
    follow: [
      'product.brand',
      'product.ingredients',
      'product.healing-stages',
      'product.product-category',
    ],
    requiredEntityTypes: ['product', 'brand', 'ingredient', 'healing-stage'],
    optionalEntityTypes: ['product-category', 'problem', 'keyword-cluster'],
    defaultProjection: 'summary',
    maxDepth: 2,
    maxNodes: 100,
  }),
  defineRecipe({
    id: 'product-comparison',
    rootEntityType: 'product',
    follow: ['product.brand', 'product.ingredients', 'product.product-category'],
    requiredEntityTypes: ['product', 'brand', 'ingredient'],
    optionalEntityTypes: ['product-category', 'keyword-cluster'],
    defaultProjection: 'summary',
    maxDepth: 2,
    maxNodes: 100,
  }),
  defineRecipe({
    id: 'problem-guide',
    rootEntityType: 'problem',
    follow: ['problem.symptoms', 'problem.related-products', 'problem.related-ingredients'],
    requiredEntityTypes: ['problem'],
    optionalEntityTypes: [
      'symptom',
      'product',
      'ingredient',
      'healing-stage',
      'piercing-type',
      'keyword-cluster',
    ],
    defaultProjection: 'summary',
    maxDepth: 2,
    maxNodes: 100,
  }),
  defineRecipe({
    id: 'aftercare-guide',
    rootEntityType: 'piercing-type',
    follow: ['piercing-type.healing-stages', 'piercing-type.common-problems'],
    requiredEntityTypes: ['piercing-type', 'healing-stage'],
    optionalEntityTypes: ['body-location', 'problem', 'keyword-cluster'],
    defaultProjection: 'summary',
    maxDepth: 2,
    maxNodes: 100,
  }),
  defineRecipe({
    id: 'buying-guide',
    rootEntityType: 'keyword-cluster',
    follow: [
      'keyword-cluster.related-products',
      'keyword-cluster.related-brands',
      'product.ingredients',
      'product.product-category',
    ],
    requiredEntityTypes: ['keyword-cluster'],
    optionalEntityTypes: ['product', 'brand', 'ingredient', 'product-category'],
    defaultProjection: 'summary',
    maxDepth: 2,
    maxNodes: 100,
  }),
] as const;

const recipeById = new Map(COMMERCE_CONTEXT_RECIPES.map((recipe) => [recipe.id, recipe]));

export function getCommerceContextRecipes(): readonly KnowledgeContextRecipeDefinition[] {
  return COMMERCE_CONTEXT_RECIPES;
}

export function getCommerceContextRecipe(
  recipeId: string,
): KnowledgeContextRecipeDefinition | undefined {
  return recipeById.get(recipeId);
}

export function getCommerceProjectionPolicy() {
  return Object.freeze({
    blockedFields: Object.freeze(['affiliate', 'source_notes']),
  });
}
