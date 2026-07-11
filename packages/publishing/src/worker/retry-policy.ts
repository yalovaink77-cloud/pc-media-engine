const NON_RETRYABLE_PUBLISH_ERROR_CODES = new Set([
  'validation',
  'unknown-target',
  'handoff-not-ready',
  'unsupported-format',
  'unsupported-target',
  'authentication',
]);

/** Determine whether a publish failure should be retried by the worker. */
export function isRetryablePublishErrorCode(errorCode: string): boolean {
  return !NON_RETRYABLE_PUBLISH_ERROR_CODES.has(errorCode);
}
