import { PublishingValidationError } from '../publisher.js';

/** Base error for publishing handoff failures. */
export class PublishingHandoffError extends PublishingValidationError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'PublishingHandoffError';
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

/** Thrown when handoff validation fails before package creation. */
export class PublishingHandoffBlockedError extends PublishingHandoffError {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PublishingHandoffBlockedError';
    this.code = code;
  }
}
