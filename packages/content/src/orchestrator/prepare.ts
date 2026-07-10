import { getContextRecipe } from '../knowledge/context/index.js';
import type { KnowledgeContextResult } from '../knowledge/context/types.js';
import {
  KnowledgeContextMissingRequiredError,
  KnowledgeContextRootTypeError,
  KnowledgeEntityNotFoundError,
  KnowledgeUnsupportedContextRecipeError,
} from '../knowledge/errors.js';
import { buildPromptPayload } from '../prompt/build.js';
import { PromptUnsupportedContentTypeError } from '../prompt/errors.js';
import { getPromptContentRecipe } from '../prompt/recipe.js';
import type { PromptPayloadResult } from '../prompt/types.js';
import {
  checkBlockedMetadataLeakage,
  checkDraftEntityWarnings,
  checkMissingSourceNotesWarnings,
  checkProblemGuideAffiliatePolicy,
  checkSafetyFirstConstraints,
  checkSafetyFirstPolicyBlock,
  checkStaleReviewWarnings,
  isUnsafeRecipePolicy,
} from './policy.js';
import { buildContextSummary, countContextEntities } from './summary.js';
import type {
  ContentGenerationBlockCode,
  ContentGenerationPlan,
  ContentGenerationRequest,
  ContentGenerationStatus,
  ContentGenerationWarning,
  ContentOrchestratorOptions,
} from './types.js';
import {
  buildDeterministicRequestId,
  dedupeGenerationWarnings,
  normalizeContextWarnings,
  normalizePromptWarnings,
  normalizeSnapshotWarnings,
} from './warnings.js';

const DEFAULT_LOCALE = 'en';
const DEFAULT_TONE = 'educational';
const DEFAULT_OUTPUT_FORMAT = 'markdown';

function buildBlockedPlan(input: {
  request: ContentGenerationRequest;
  requestId: string;
  snapshot: ContentGenerationPlan['snapshot'];
  sourceReference: ContentGenerationPlan['sourceReference'];
  blockReason: string;
  blockCode: ContentGenerationBlockCode;
  warnings: readonly ContentGenerationWarning[];
  context?: KnowledgeContextResult;
  createdAt: string;
}): ContentGenerationPlan {
  const locale = input.request.locale ?? DEFAULT_LOCALE;
  const tone = input.request.tone ?? DEFAULT_TONE;
  const outputFormat = input.request.outputFormat ?? DEFAULT_OUTPUT_FORMAT;

  return Object.freeze({
    requestId: input.requestId,
    status: 'blocked',
    sourceReference: input.sourceReference,
    snapshot: input.snapshot,
    root: input.request.root,
    contextRecipeId: input.request.contextRecipe,
    contentType: input.request.contentType,
    locale,
    tone,
    outputFormat,
    contextSummary: input.context
      ? buildContextSummary(input.context)
      : Object.freeze({
          recipeId: input.request.contextRecipe,
          projection: 'summary',
          entityCountByType: Object.freeze({}),
          missingRequired: Object.freeze([]),
          truncated: false,
        }),
    warnings: dedupeGenerationWarnings([
      ...input.warnings,
      Object.freeze({
        code: input.blockCode,
        message: input.blockReason,
        source: 'orchestrator',
        severity: 'warning',
      }),
    ]),
    metadata: Object.freeze({
      requestId: input.requestId,
      entityCount: input.context ? countContextEntities(input.context) : 0,
      promptSectionCount: 0,
      constraintCount: 0,
      estimatedInputCharacters: 0,
    }),
    createdAt: input.createdAt,
    blockReason: input.blockReason,
  });
}

function resolveStatus(warnings: readonly ContentGenerationWarning[]): ContentGenerationStatus {
  const hasWarnings = warnings.some((warning) => warning.severity === 'warning');
  return hasWarnings ? 'ready-with-warnings' : 'ready';
}

export async function prepareContentGenerationPlan(
  options: ContentOrchestratorOptions,
  request: ContentGenerationRequest,
): Promise<ContentGenerationPlan> {
  const createdAt = new Date().toISOString();
  const strict = request.strict ?? false;
  const locale = request.locale ?? DEFAULT_LOCALE;
  const tone = request.tone ?? DEFAULT_TONE;
  const outputFormat = request.outputFormat ?? DEFAULT_OUTPUT_FORMAT;
  const contextRecipes = options.contextRecipes ?? [];
  const promptRecipes = options.promptRecipes ?? [];

  const snapshot = await options.knowledgeService.getSnapshot();
  const requestId = (
    options.requestIdGenerator ??
    ((input) => buildDeterministicRequestId(input.request, input.sourceKey))
  )({
    request,
    sourceKey: snapshot.sourceId,
  });

  const sourceReference = Object.freeze({
    sourceId: snapshot.sourceId,
    sourceType: snapshot.sourceType,
  });

  const baseWarnings = normalizeSnapshotWarnings(snapshot.warnings);

  const contextRecipe = getContextRecipe(contextRecipes, request.contextRecipe);
  if (!contextRecipe) {
    return buildBlockedPlan({
      request,
      requestId,
      snapshot,
      sourceReference,
      blockReason: `Unsupported context recipe: ${request.contextRecipe}`,
      blockCode: 'unsupported-context-recipe',
      warnings: baseWarnings,
      createdAt,
    });
  }

  const promptRecipe = getPromptContentRecipe(promptRecipes, request.contentType);
  if (!promptRecipe) {
    return buildBlockedPlan({
      request,
      requestId,
      snapshot,
      sourceReference,
      blockReason: `Unsupported content type: ${request.contentType}`,
      blockCode: 'unsupported-content-type',
      warnings: baseWarnings,
      createdAt,
    });
  }

  if (promptRecipe.requiredContextRecipeId !== request.contextRecipe) {
    return buildBlockedPlan({
      request,
      requestId,
      snapshot,
      sourceReference,
      blockReason: `Incompatible context recipe ${request.contextRecipe} for content type ${request.contentType}`,
      blockCode: 'incompatible-recipe-content',
      warnings: baseWarnings,
      createdAt,
    });
  }

  const rootEntity = await options.knowledgeService.getEntity(request.root.type, request.root.id);
  if (!rootEntity) {
    return buildBlockedPlan({
      request,
      requestId,
      snapshot,
      sourceReference,
      blockReason: `Missing root entity: ${request.root.type}:${request.root.id}`,
      blockCode: 'missing-root-entity',
      warnings: baseWarnings,
      createdAt,
    });
  }

  let context: KnowledgeContextResult;
  try {
    context = await options.knowledgeService.buildContext({
      root: request.root,
      recipe: request.contextRecipe,
      strict,
    });
  } catch (error) {
    if (
      error instanceof KnowledgeUnsupportedContextRecipeError ||
      error instanceof KnowledgeContextRootTypeError ||
      error instanceof KnowledgeEntityNotFoundError ||
      error instanceof KnowledgeContextMissingRequiredError
    ) {
      const blockCode: ContentGenerationBlockCode =
        error instanceof KnowledgeContextMissingRequiredError
          ? 'missing-required-context'
          : error instanceof KnowledgeUnsupportedContextRecipeError
            ? 'unsupported-context-recipe'
            : error instanceof KnowledgeEntityNotFoundError
              ? 'missing-root-entity'
              : 'incompatible-recipe-content';

      return buildBlockedPlan({
        request,
        requestId,
        snapshot,
        sourceReference,
        blockReason: error.message,
        blockCode,
        warnings: baseWarnings,
        createdAt,
      });
    }

    throw error;
  }

  if (strict && context.missingRequired.length > 0) {
    return buildBlockedPlan({
      request,
      requestId,
      snapshot,
      sourceReference,
      blockReason: `Missing required context entity types: ${context.missingRequired.join(', ')}`,
      blockCode: 'missing-required-context',
      warnings: dedupeGenerationWarnings([
        ...baseWarnings,
        ...normalizeContextWarnings(context.warnings),
      ]),
      context,
      createdAt,
    });
  }

  if (strict && context.truncated) {
    return buildBlockedPlan({
      request,
      requestId,
      snapshot,
      sourceReference,
      blockReason: 'Context traversal truncated while strict mode requires completeness',
      blockCode: 'truncated-context-strict',
      warnings: dedupeGenerationWarnings([
        ...baseWarnings,
        ...normalizeContextWarnings(context.warnings),
      ]),
      context,
      createdAt,
    });
  }

  let promptPayload: PromptPayloadResult;
  try {
    promptPayload = buildPromptPayload(
      {
        context,
        contentType: request.contentType,
        locale,
        tone,
        outputFormat,
        strict,
      },
      { recipes: promptRecipes },
    );
  } catch (error) {
    if (error instanceof PromptUnsupportedContentTypeError) {
      return buildBlockedPlan({
        request,
        requestId,
        snapshot,
        sourceReference,
        blockReason: error.message,
        blockCode: 'unsupported-content-type',
        warnings: dedupeGenerationWarnings([
          ...baseWarnings,
          ...normalizeContextWarnings(context.warnings),
        ]),
        context,
        createdAt,
      });
    }

    throw error;
  }

  if (isUnsafeRecipePolicy(request.contentType, promptPayload)) {
    return buildBlockedPlan({
      request,
      requestId,
      snapshot,
      sourceReference,
      blockReason: `Unsafe recipe policy for content type ${request.contentType}`,
      blockCode: 'unsafe-recipe-policy',
      warnings: dedupeGenerationWarnings([
        ...baseWarnings,
        ...normalizeContextWarnings(context.warnings),
        ...normalizePromptWarnings(promptPayload.warnings),
      ]),
      context,
      createdAt,
    });
  }

  if (checkSafetyFirstPolicyBlock(request.contentType, promptPayload)) {
    return buildBlockedPlan({
      request,
      requestId,
      snapshot,
      sourceReference,
      blockReason: `Safety-first constraints missing for content type ${request.contentType}`,
      blockCode: 'unsafe-recipe-policy',
      warnings: dedupeGenerationWarnings([
        ...baseWarnings,
        ...normalizeContextWarnings(context.warnings),
      ]),
      context,
      createdAt,
    });
  }

  if (checkBlockedMetadataLeakage(promptPayload)) {
    return buildBlockedPlan({
      request,
      requestId,
      snapshot,
      sourceReference,
      blockReason: 'Prompt payload contains blocked metadata',
      blockCode: 'unsafe-recipe-policy',
      warnings: dedupeGenerationWarnings([
        ...baseWarnings,
        ...normalizeContextWarnings(context.warnings),
      ]),
      context,
      createdAt,
    });
  }

  const warnings = dedupeGenerationWarnings([
    ...baseWarnings,
    ...normalizeContextWarnings(context.warnings),
    ...normalizePromptWarnings(promptPayload.warnings),
    ...checkDraftEntityWarnings(context),
    ...checkMissingSourceNotesWarnings(context),
    ...checkStaleReviewWarnings(context),
    ...checkProblemGuideAffiliatePolicy(request.contentType, promptPayload),
    ...checkSafetyFirstConstraints(request.contentType, promptPayload),
    ...(context.truncated
      ? [
          Object.freeze({
            code: 'context-truncated',
            message: 'Knowledge context was truncated during assembly',
            source: 'orchestrator' as const,
            severity: 'warning' as const,
          }),
        ]
      : []),
  ]);

  const normalizedWarnings = warnings;
  const status = resolveStatus(normalizedWarnings);

  return Object.freeze({
    requestId,
    status,
    sourceReference,
    snapshot: context.snapshot,
    root: request.root,
    contextRecipeId: request.contextRecipe,
    contentType: request.contentType,
    locale,
    tone,
    outputFormat,
    contextSummary: buildContextSummary(context),
    promptPayload,
    warnings: normalizedWarnings,
    metadata: Object.freeze({
      requestId,
      entityCount: countContextEntities(context),
      promptSectionCount: promptPayload.userSections.length,
      constraintCount: promptPayload.constraints.length,
      estimatedInputCharacters: promptPayload.metadata.estimatedInputCharacters,
    }),
    createdAt,
  });
}
