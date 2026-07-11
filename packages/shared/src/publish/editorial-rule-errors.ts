/** Base error for editorial rule validation failures. */
export class EditorialRuleError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'EditorialRuleError';
  }
}

/** Thrown when an editorial rule fails contract validation. */
export class EditorialRuleValidationError extends EditorialRuleError {
  readonly field: string;
  readonly code: string;

  constructor(field: string, code: string, message: string) {
    super(message);
    this.name = 'EditorialRuleValidationError';
    this.field = field;
    this.code = code;
  }
}
