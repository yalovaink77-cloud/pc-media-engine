/** Base error for generation job contract failures. */
export class GenerationJobError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'GenerationJobError';
  }
}

/** Thrown when a blocked content plan cannot become a runnable job. */
export class GenerationJobBlockedError extends GenerationJobError {
  readonly requestId: string;
  readonly blockReason?: string;

  constructor(options: { requestId: string; blockReason?: string }) {
    super(
      options.blockReason
        ? `Generation job blocked: ${options.blockReason}`
        : 'Generation job blocked by content plan status',
    );
    this.name = 'GenerationJobBlockedError';
    this.requestId = options.requestId;
    this.blockReason = options.blockReason;
  }
}

/** Thrown when a content plan has no prompt payload. */
export class GenerationJobMissingPayloadError extends GenerationJobError {
  readonly requestId: string;

  constructor(requestId: string) {
    super(`Generation job missing prompt payload for request ${requestId}`);
    this.name = 'GenerationJobMissingPayloadError';
    this.requestId = requestId;
  }
}

/** Thrown when an output format is not supported for job creation. */
export class GenerationUnsupportedOutputFormatError extends GenerationJobError {
  readonly outputFormat: string;

  constructor(outputFormat: string) {
    super(`Unsupported generation output format: ${outputFormat}`);
    this.name = 'GenerationUnsupportedOutputFormatError';
    this.outputFormat = outputFormat;
  }
}

/** Thrown when prompt payload contains blocked metadata. */
export class GenerationBlockedMetadataError extends GenerationJobError {
  readonly requestId: string;

  constructor(requestId: string) {
    super(`Generation job payload contains blocked metadata for request ${requestId}`);
    this.name = 'GenerationBlockedMetadataError';
    this.requestId = requestId;
  }
}

/** Thrown when a provider rejects or fails a generation request. */
export class GenerationProviderExecutionError extends GenerationJobError {
  readonly providerId: string;
  readonly code: string;

  constructor(options: { providerId: string; code: string; message: string }) {
    super(options.message);
    this.name = 'GenerationProviderExecutionError';
    this.providerId = options.providerId;
    this.code = options.code;
  }
}
