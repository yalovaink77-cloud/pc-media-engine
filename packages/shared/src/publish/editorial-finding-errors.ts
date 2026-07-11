/** Base error for editorial finding validation failures. */
export class EditorialFindingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'EditorialFindingError';
  }
}

/** Thrown when an editorial finding fails contract validation. */
export class EditorialFindingValidationError extends EditorialFindingError {
  readonly field: string;
  readonly code: string;

  constructor(field: string, code: string, message: string) {
    super(message);
    this.name = 'EditorialFindingValidationError';
    this.field = field;
    this.code = code;
  }
}
