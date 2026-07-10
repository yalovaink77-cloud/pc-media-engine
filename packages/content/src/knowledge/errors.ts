import type { EntityReference } from './types.js';

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
