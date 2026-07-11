export {
  COMMERCE_PROMPT_CONTENT_RECIPES,
  getCommercePromptContentRecipe,
  getCommercePromptContentRecipes,
} from '../knowledge/adapters/commerce/prompt-recipes.js';
export type { BuildPromptPayloadOptions } from './build.js';
export { buildPromptPayload } from './build.js';
export {
  PromptContextRecipeMismatchError,
  PromptMissingRequiredContextError,
  PromptPayloadError,
  PromptUnsupportedContentTypeError,
} from './errors.js';
export { buildPromptContentRecipeIndex, getPromptContentRecipe } from './recipe.js';
export {
  buildMandatoryConstraints,
  getUniversalPromptConstraint,
  UNIVERSAL_PROMPT_CONSTRAINTS,
} from './safety.js';
export {
  containsBlockedPromptMetadata,
  serializeContextNode,
  serializeContextNodes,
} from './serialize.js';
export type {
  PromptConstraint,
  PromptContentRecipeDefinition,
  PromptContentRecipeRegistry,
  PromptContentSectionBinding,
  PromptOutputContract,
  PromptOutputFormat,
  PromptPayloadBudgetMetadata,
  PromptPayloadMetadata,
  PromptPayloadRequest,
  PromptPayloadResult,
  PromptPayloadWarning,
  PromptSystemInstruction,
  PromptUserSection,
} from './types.js';

import { getCommercePromptContentRecipes } from '../knowledge/adapters/commerce/prompt-recipes.js';
import { buildPromptPayload } from './build.js';
import type { PromptPayloadRequest, PromptPayloadResult } from './types.js';

/** Build a prompt payload using default commerce content recipes. */
export function buildCommercePromptPayload(request: PromptPayloadRequest): PromptPayloadResult {
  return buildPromptPayload(request, { recipes: getCommercePromptContentRecipes() });
}
