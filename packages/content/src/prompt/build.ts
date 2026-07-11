import type { KnowledgeContextResult } from '../knowledge/context/types.js';
import type { EntityType } from '../knowledge/types.js';
import {
  PromptContextRecipeMismatchError,
  PromptMissingRequiredContextError,
  PromptUnsupportedContentTypeError,
} from './errors.js';
import { getPromptContentRecipe } from './recipe.js';
import { buildMandatoryConstraints } from './safety.js';
import { serializeContextNode, serializeContextNodes } from './serialize.js';
import type {
  PromptContentRecipeDefinition,
  PromptContentSectionBinding,
  PromptPayloadRequest,
  PromptPayloadResult,
  PromptPayloadWarning,
  PromptSystemInstruction,
  PromptUserSection,
} from './types.js';

const DEFAULT_LOCALE = 'en';
const DEFAULT_TONE = 'educational';
const DEFAULT_OUTPUT_FORMAT = 'markdown';

function countEntities(context: KnowledgeContextResult): number {
  return Object.values(context.entitiesByType).reduce(
    (total, nodes) => total + (nodes?.length ?? 0),
    0,
  );
}

function humanizeSectionTitle(sectionId: string): string {
  return sectionId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolveSectionContent(
  sectionId: string,
  binding: PromptContentSectionBinding | undefined,
  context: KnowledgeContextResult,
  recipe: PromptContentRecipeDefinition,
): string {
  if (binding?.staticText) {
    return binding.staticText;
  }

  if (sectionId === 'content-objective') {
    return recipe.contentObjective;
  }

  if (sectionId === 'safety-reminders') {
    return recipe.mandatorySafetyConstraintIds.join(', ');
  }

  if (sectionId === 'sources-and-citations') {
    return [
      'Include structured citation placeholders tied to the supplied knowledge context.',
      'Preferred forms: [Source: product official record], [Source: ingredient evidence record], [Source: APP-aligned aftercare guidance].',
      'Do not invent URLs, DOIs, or citations. If concrete references are unavailable, keep placeholders and note uncertainty for human review.',
    ].join(' ');
  }

  if (binding?.includeRoot) {
    return serializeContextNode(context.root);
  }

  if (binding?.entityTypes && binding.entityTypes.length > 0) {
    const nodes = binding.entityTypes.flatMap((type) => context.entitiesByType[type] ?? []);
    return serializeContextNodes(nodes);
  }

  return '';
}

function buildUserSections(
  context: KnowledgeContextResult,
  recipe: PromptContentRecipeDefinition,
  warnings: PromptPayloadWarning[],
): readonly PromptUserSection[] {
  const sections: PromptUserSection[] = [];

  for (const [index, sectionId] of recipe.sectionOrder.entries()) {
    if (recipe.optionalAffiliateSections?.includes(sectionId)) {
      warnings.push(
        Object.freeze({
          code: 'affiliate-section-suppressed',
          message: `Affiliate section suppressed pending verified affiliate context: ${sectionId}`,
        }),
      );
      continue;
    }

    const binding = recipe.sectionBindings[sectionId];
    const content = resolveSectionContent(sectionId, binding, context, recipe);

    sections.push(
      Object.freeze({
        id: sectionId,
        title: humanizeSectionTitle(sectionId),
        order: index + 1,
        content,
      }),
    );
  }

  return Object.freeze(
    [...sections].sort((a, b) => {
      const orderDiff = a.order - b.order;
      if (orderDiff !== 0) {
        return orderDiff;
      }
      return a.id.localeCompare(b.id);
    }),
  );
}

function buildSystemInstructions(
  recipe: PromptContentRecipeDefinition,
  request: PromptPayloadRequest,
): readonly PromptSystemInstruction[] {
  const instructions: PromptSystemInstruction[] = [
    Object.freeze({
      id: 'role',
      priority: 1,
      instruction:
        'You are a careful editorial assistant generating trustworthy educational content for readers researching piercing aftercare and related products.',
    }),
    Object.freeze({
      id: 'objective',
      priority: 2,
      instruction: recipe.contentObjective,
    }),
    Object.freeze({
      id: 'locale-tone',
      priority: 3,
      instruction: `Write in locale ${request.locale ?? DEFAULT_LOCALE} using a ${request.tone ?? DEFAULT_TONE} tone.`,
    }),
    Object.freeze({
      id: 'output-format',
      priority: 4,
      instruction: `Return content suitable for ${request.outputFormat ?? DEFAULT_OUTPUT_FORMAT} output without provider-specific formatting.`,
    }),
  ];

  return Object.freeze(
    [...instructions].sort((a, b) => {
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.id.localeCompare(b.id);
    }),
  );
}

function collectContextWarnings(
  context: KnowledgeContextResult,
  recipe: PromptContentRecipeDefinition,
): PromptPayloadWarning[] {
  const warnings: PromptPayloadWarning[] = [];

  if (context.recipeId !== recipe.requiredContextRecipeId) {
    warnings.push(
      Object.freeze({
        code: 'wrong-context-recipe',
        message: `Expected context recipe ${recipe.requiredContextRecipeId}, received ${context.recipeId}`,
      }),
    );
  }

  for (const entityType of context.missingRequired) {
    warnings.push(
      Object.freeze({
        code: 'missing-required-context',
        message: `Missing required context entity type: ${entityType as EntityType}`,
      }),
    );
  }

  if (context.truncated) {
    warnings.push(
      Object.freeze({
        code: 'context-truncated',
        message: 'Knowledge context was truncated before prompt assembly',
      }),
    );
  }

  if (context.warnings.length > 0) {
    warnings.push(
      Object.freeze({
        code: 'context-incomplete',
        message: `Knowledge context emitted ${context.warnings.length} warning(s) before prompt assembly`,
      }),
    );
  }

  return warnings;
}

function sortWarnings(warnings: readonly PromptPayloadWarning[]): readonly PromptPayloadWarning[] {
  return Object.freeze(
    [...warnings].sort((a, b) => {
      const codeOrder = a.code.localeCompare(b.code);
      if (codeOrder !== 0) {
        return codeOrder;
      }
      return a.message.localeCompare(b.message);
    }),
  );
}

function estimateInputCharacters(
  systemInstructions: readonly PromptSystemInstruction[],
  userSections: readonly PromptUserSection[],
  constraints: readonly { rule: string }[],
): number {
  const systemChars = systemInstructions.reduce(
    (total, entry) => total + entry.instruction.length,
    0,
  );
  const sectionChars = userSections.reduce((total, entry) => total + entry.content.length, 0);
  const constraintChars = constraints.reduce((total, entry) => total + entry.rule.length, 0);
  return systemChars + sectionChars + constraintChars;
}

export interface BuildPromptPayloadOptions {
  readonly recipes?: readonly PromptContentRecipeDefinition[];
}

/** Build a deterministic, provider-neutral prompt payload from knowledge context. */
export function buildPromptPayload(
  request: PromptPayloadRequest,
  options?: BuildPromptPayloadOptions,
): PromptPayloadResult {
  const recipes = options?.recipes ?? [];
  const recipe = getPromptContentRecipe(recipes, request.contentType);
  if (!recipe) {
    throw new PromptUnsupportedContentTypeError(request.contentType);
  }

  const strict = request.strict ?? false;
  const locale = request.locale ?? DEFAULT_LOCALE;
  const tone = request.tone ?? DEFAULT_TONE;
  const outputFormat = request.outputFormat ?? DEFAULT_OUTPUT_FORMAT;
  const warnings = collectContextWarnings(request.context, recipe);

  if (request.context.recipeId !== recipe.requiredContextRecipeId) {
    if (strict) {
      throw new PromptContextRecipeMismatchError({
        contentType: request.contentType,
        expectedContextRecipeId: recipe.requiredContextRecipeId,
        actualContextRecipeId: request.context.recipeId,
      });
    }
  }

  if (request.context.missingRequired.length > 0) {
    if (strict) {
      throw new PromptMissingRequiredContextError({
        contentType: request.contentType,
        missingRequired: request.context.missingRequired,
      });
    }
  }

  const systemInstructions = buildSystemInstructions(recipe, request);
  const userSections = buildUserSections(request.context, recipe, warnings);
  const constraints = buildMandatoryConstraints(
    recipe.mandatorySafetyConstraintIds,
    request.context,
  );

  const outputContract = Object.freeze({
    format: outputFormat,
    locale,
    tone,
    sections: Object.freeze([...recipe.outputStructure]),
    allowedCtaTypes: Object.freeze([...recipe.allowedCtaTypes]),
    prohibitedCtaTypes: Object.freeze([...recipe.prohibitedCtaTypes]),
  });

  const entityCount = countEntities(request.context);
  const estimatedInputCharacters = estimateInputCharacters(
    systemInstructions,
    userSections,
    constraints,
  );

  const metadata = Object.freeze({
    contentType: request.contentType,
    contextRecipeId: request.context.recipeId,
    locale,
    tone,
    outputFormat,
    rootEntityType: request.context.root.type,
    rootEntityId: request.context.root.id,
    snapshotId: request.context.snapshot.snapshotId,
    estimatedInputCharacters,
    estimatedSectionCount: userSections.length,
    entityCount,
    truncationWarning: request.context.truncated,
  });

  return Object.freeze({
    contentType: request.contentType,
    systemInstructions,
    userSections,
    constraints,
    outputContract,
    metadata,
    warnings: sortWarnings(warnings),
  });
}
