import type { KnowledgeContextRecipeDefinition } from './types.js';

export function buildContextRecipeIndex(
  recipes: readonly KnowledgeContextRecipeDefinition[],
): ReadonlyMap<string, KnowledgeContextRecipeDefinition> {
  const index = new Map<string, KnowledgeContextRecipeDefinition>();
  for (const recipe of recipes) {
    index.set(recipe.id, recipe);
  }
  return index;
}

export function getContextRecipe(
  recipes: readonly KnowledgeContextRecipeDefinition[],
  recipeId: string,
): KnowledgeContextRecipeDefinition | undefined {
  return recipes.find((recipe) => recipe.id === recipeId);
}
