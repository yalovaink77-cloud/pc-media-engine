import type { EntityType } from '../knowledge/types.js';

/** Base error for prompt payload builder failures. */
export class PromptPayloadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PromptPayloadError';
  }
}

/** Thrown when a content type has no registered prompt recipe. */
export class PromptUnsupportedContentTypeError extends PromptPayloadError {
  readonly contentType: string;

  constructor(contentType: string) {
    super(`Unsupported prompt content type: ${contentType}`);
    this.name = 'PromptUnsupportedContentTypeError';
    this.contentType = contentType;
  }
}

/** Thrown when context recipe does not match the content recipe requirement. */
export class PromptContextRecipeMismatchError extends PromptPayloadError {
  readonly contentType: string;
  readonly expectedContextRecipeId: string;
  readonly actualContextRecipeId: string;

  constructor(options: {
    contentType: string;
    expectedContextRecipeId: string;
    actualContextRecipeId: string;
  }) {
    super(
      `Content type ${options.contentType} requires context recipe ${options.expectedContextRecipeId}, received ${options.actualContextRecipeId}`,
    );
    this.name = 'PromptContextRecipeMismatchError';
    this.contentType = options.contentType;
    this.expectedContextRecipeId = options.expectedContextRecipeId;
    this.actualContextRecipeId = options.actualContextRecipeId;
  }
}

/** Thrown when required context is missing in strict mode. */
export class PromptMissingRequiredContextError extends PromptPayloadError {
  readonly contentType: string;
  readonly missingRequired: readonly EntityType[];

  constructor(options: { contentType: string; missingRequired: readonly EntityType[] }) {
    super(
      `Prompt content type ${options.contentType} missing required context entity types: ${options.missingRequired.join(', ')}`,
    );
    this.name = 'PromptMissingRequiredContextError';
    this.contentType = options.contentType;
    this.missingRequired = options.missingRequired;
  }
}
