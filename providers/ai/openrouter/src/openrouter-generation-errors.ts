import type {
  GenerationError,
  GenerationProviderDiagnostics,
  GenerationProviderErrorCode,
} from '@pcme/ai';

/** Retry classification metadata for downstream retry engines. */
export interface OpenRouterGenerationRetryMetadata {
  readonly retryable: boolean;
  readonly errorCode: GenerationProviderErrorCode;
}

const RETRYABLE_CODES = new Set<GenerationProviderErrorCode>([
  'rate-limit',
  'timeout',
  'provider-unavailable',
]);

export function classifyGenerationErrorCode(
  code: GenerationProviderErrorCode,
): OpenRouterGenerationRetryMetadata {
  return Object.freeze({
    retryable: RETRYABLE_CODES.has(code),
    errorCode: code,
  });
}

export function mapHttpStatusToErrorCode(status: number): GenerationProviderErrorCode {
  if (status === 401 || status === 403) {
    return 'authentication';
  }
  if (status === 429) {
    return 'rate-limit';
  }
  if (status === 408) {
    return 'timeout';
  }
  if (status === 400 || status === 422) {
    return 'invalid-request';
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'provider-unavailable';
  }
  return 'provider-unavailable';
}

export function buildGenerationError(
  code: GenerationProviderErrorCode,
  message: string,
): GenerationError {
  const { retryable } = classifyGenerationErrorCode(code);
  return Object.freeze({ code, message, retryable });
}

export function buildProviderFailureMessage(
  code: GenerationProviderErrorCode,
  httpStatus?: number,
): string {
  switch (code) {
    case 'authentication':
      return 'OpenRouter authentication failed';
    case 'rate-limit':
      return 'OpenRouter rate limit exceeded';
    case 'timeout':
      return 'OpenRouter generation request timed out';
    case 'invalid-request':
      return 'OpenRouter rejected the generation request';
    case 'provider-unavailable':
      return httpStatus
        ? `OpenRouter is unavailable (HTTP ${httpStatus})`
        : 'OpenRouter is unavailable';
    case 'malformed-response':
      return 'OpenRouter returned a malformed generation response';
    case 'cancelled':
      return 'OpenRouter generation request was cancelled';
    default:
      return 'OpenRouter generation request failed';
  }
}

const SECRET_PATTERNS = [/Bearer\s+\S+/gi, /sk-[a-zA-Z0-9_-]+/g, /OPENROUTER_API_KEY=\S+/g];

export function redactSecrets(text: string, secrets: readonly string[] = []): string {
  let redacted = text;

  for (const secret of secrets) {
    if (secret.trim()) {
      redacted = redacted.replaceAll(secret, '[REDACTED]');
    }
  }

  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }

  return redacted;
}

export function buildRedactedDiagnostics(options: {
  httpStatus?: number;
  providerModel?: string;
  finishReason?: string;
  inputTokens?: number;
  outputTokens?: number;
  elapsedMs?: number;
  detail?: string;
  secrets?: readonly string[];
}): GenerationProviderDiagnostics {
  return Object.freeze({
    httpStatus: options.httpStatus,
    providerModel: options.providerModel,
    finishReason: options.finishReason,
    inputTokens: options.inputTokens,
    outputTokens: options.outputTokens,
    elapsedMs: options.elapsedMs,
    detail: options.detail ? redactSecrets(options.detail, options.secrets) : undefined,
  });
}

export function sanitizeErrorMessage(message: string, secrets: readonly string[] = []): string {
  return redactSecrets(message, secrets);
}
