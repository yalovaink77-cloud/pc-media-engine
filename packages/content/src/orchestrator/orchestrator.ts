import { getCommerceContextRecipes } from '../knowledge/adapters/commerce/context-recipes.js';
import { getCommercePromptContentRecipes } from '../knowledge/adapters/commerce/prompt-recipes.js';
import { CommerceKnowledgeSourceAdapter } from '../knowledge/adapters/commerce-adapter.js';
import { createKnowledgeService } from '../knowledge/service.js';
import { prepareContentGenerationPlan } from './prepare.js';
import type {
  CommerceContentOrchestratorOptions,
  ContentGenerationPlan,
  ContentGenerationRequest,
  ContentOrchestrator,
  ContentOrchestratorOptions,
} from './types.js';

export class ContentOrchestratorImpl implements ContentOrchestrator {
  constructor(private readonly options: ContentOrchestratorOptions) {}

  prepare(request: ContentGenerationRequest): Promise<ContentGenerationPlan> {
    return prepareContentGenerationPlan(this.options, request);
  }
}

/** Create a generic content orchestrator wired to knowledge, context, and prompt layers. */
export function createContentOrchestrator(
  options: ContentOrchestratorOptions,
): ContentOrchestrator {
  return new ContentOrchestratorImpl(options);
}

/** Create a commerce-backed content orchestrator with default adapter recipes. */
export async function createCommerceContentOrchestrator(
  options?: CommerceContentOrchestratorOptions,
): Promise<ContentOrchestrator> {
  const knowledgeService = await createKnowledgeService({
    strict: options?.strict,
    adapter: new CommerceKnowledgeSourceAdapter(options?.commerce),
  });

  return createContentOrchestrator({
    knowledgeService,
    contextRecipes: getCommerceContextRecipes(),
    promptRecipes: getCommercePromptContentRecipes(),
  });
}
