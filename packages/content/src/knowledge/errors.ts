import type { EntityReference, EntityType } from './types.js';

/** Base error for knowledge service failures. */
export class KnowledgeServiceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'KnowledgeServiceError';
  }
}

/** Thrown when snapshot construction fails. */
export class KnowledgeSnapshotError extends KnowledgeServiceError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'KnowledgeSnapshotError';
  }
}

/** Thrown when a required entity cannot be resolved in strict mode. */
export class KnowledgeEntityNotFoundError extends KnowledgeServiceError {
  readonly reference: EntityReference;

  constructor(reference: EntityReference) {
    super(`Knowledge entity not found: ${reference.type}:${reference.id}`);
    this.name = 'KnowledgeEntityNotFoundError';
    this.reference = reference;
  }
}

/** Thrown when an entity type is not supported by the active source adapter. */
export class KnowledgeUnsupportedCollectionError extends KnowledgeServiceError {
  readonly entityType: EntityReference['type'];

  constructor(entityType: EntityReference['type']) {
    super(`Unsupported knowledge collection: ${entityType}`);
    this.name = 'KnowledgeUnsupportedCollectionError';
    this.entityType = entityType;
  }
}

/** Thrown when a named relationship is not declared in the active manifest. */
export class KnowledgeUnsupportedRelationshipError extends KnowledgeServiceError {
  readonly relationship: string;

  constructor(relationship: string) {
    super(`Unsupported knowledge relationship: ${relationship}`);
    this.name = 'KnowledgeUnsupportedRelationshipError';
    this.relationship = relationship;
  }
}

/** Thrown when a context recipe is not declared by the active adapter. */
export class KnowledgeUnsupportedContextRecipeError extends KnowledgeServiceError {
  readonly recipeId: string;

  constructor(recipeId: string) {
    super(`Unsupported knowledge context recipe: ${recipeId}`);
    this.name = 'KnowledgeUnsupportedContextRecipeError';
    this.recipeId = recipeId;
  }
}

/** Thrown when a context request root type does not match the recipe. */
export class KnowledgeContextRootTypeError extends KnowledgeServiceError {
  readonly recipeId: string;
  readonly expectedType: EntityType;
  readonly actualType: EntityType;

  constructor(options: { recipeId: string; expectedType: EntityType; actualType: EntityType }) {
    super(
      `Context recipe ${options.recipeId} requires root type ${options.expectedType}, received ${options.actualType}`,
    );
    this.name = 'KnowledgeContextRootTypeError';
    this.recipeId = options.recipeId;
    this.expectedType = options.expectedType;
    this.actualType = options.actualType;
  }
}

/** Thrown when required entity types are missing from context in strict mode. */
export class KnowledgeContextMissingRequiredError extends KnowledgeServiceError {
  readonly recipeId: string;
  readonly missingRequired: readonly EntityType[];

  constructor(options: { recipeId: string; missingRequired: readonly EntityType[] }) {
    super(
      `Context recipe ${options.recipeId} missing required entity types: ${options.missingRequired.join(', ')}`,
    );
    this.name = 'KnowledgeContextMissingRequiredError';
    this.recipeId = options.recipeId;
    this.missingRequired = options.missingRequired;
  }
}

/** Format knowledge errors for logs without exposing parser internals. */
export function formatKnowledgeServiceError(error: unknown): string {
  if (error instanceof KnowledgeEntityNotFoundError) {
    return error.message;
  }

  if (error instanceof KnowledgeServiceError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
