/** Typed error codes for content pipeline dry runs. */
export type ContentPipelineErrorCode =
  | 'knowledge-load-failure'
  | 'context-blocked'
  | 'generation-job-blocked'
  | 'provider-failure'
  | 'artifact-invalid'
  | 'review-failure'
  | 'handoff-blocked'
  | 'enqueue-failure'
  | 'worker-failure'
  | 'mode-unavailable';

/** Typed pipeline error with stage attribution. */
export class ContentPipelineDryRunError extends Error {
  readonly code: ContentPipelineErrorCode;
  readonly stage: string;

  constructor(code: ContentPipelineErrorCode, stage: string, message: string) {
    super(message);
    this.name = 'ContentPipelineDryRunError';
    this.code = code;
    this.stage = stage;
  }
}

export function isContentPipelineDryRunError(error: unknown): error is ContentPipelineDryRunError {
  return error instanceof ContentPipelineDryRunError;
}
