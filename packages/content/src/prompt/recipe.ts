import type { PromptContentRecipeDefinition } from './types.js';

export function buildPromptContentRecipeIndex(
  recipes: readonly PromptContentRecipeDefinition[],
): ReadonlyMap<string, PromptContentRecipeDefinition> {
  const index = new Map<string, PromptContentRecipeDefinition>();
  for (const recipe of recipes) {
    index.set(recipe.id, recipe);
  }
  return index;
}

export function getPromptContentRecipe(
  recipes: readonly PromptContentRecipeDefinition[],
  contentType: string,
): PromptContentRecipeDefinition | undefined {
  return recipes.find((recipe) => recipe.id === contentType);
}
