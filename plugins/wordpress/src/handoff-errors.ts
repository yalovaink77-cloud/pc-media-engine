import { WordPressApiError } from './errors.js';

/** Typed error codes returned by the WordPress handoff adapter. */
export type WordPressHandoffErrorCode =
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'rate-limit'
  | 'timeout'
  | 'network'
  | 'provider-unavailable'
  | 'malformed-response';

const SECRET_PATTERNS = [
  /Basic\s+\S+/gi,
  /Bearer\s+\S+/gi,
  /WORDPRESS_APP_PASSWORD=\S+/gi,
  /sk-[a-zA-Z0-9_-]+/g,
];

export function redactWordPressSecrets(text: string, secrets: readonly string[] = []): string {
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

export function mapWordPressHandoffError(error: unknown): {
  code: WordPressHandoffErrorCode;
  message: string;
} {
  if (error instanceof WordPressApiError) {
    if (error.status === 401) {
      return { code: 'authentication', message: 'WordPress authentication failed' };
    }
    if (error.status === 403) {
      return { code: 'authorization', message: 'WordPress authorization failed' };
    }
    if (error.status === 429) {
      return { code: 'rate-limit', message: 'WordPress rate limit exceeded' };
    }
    if (error.status === 400 || error.status === 422) {
      return {
        code: 'validation',
        message: redactWordPressSecrets(error.message),
      };
    }
    if (error.status >= 500) {
      return { code: 'provider-unavailable', message: 'WordPress provider unavailable' };
    }
    return {
      code: 'provider-unavailable',
      message: redactWordPressSecrets(error.message),
    };
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return { code: 'timeout', message: 'WordPress publish request timed out' };
    }
    return {
      code: 'network',
      message: redactWordPressSecrets(error.message),
    };
  }

  return { code: 'malformed-response', message: 'WordPress returned a malformed response' };
}

export function buildSafeHandoffLogMeta(input: {
  handoffId: string;
  slug: string;
  contentLength: number;
  status?: string;
  httpStatus?: number;
}): Record<string, string | number> {
  return Object.freeze({
    handoffId: input.handoffId,
    slug: input.slug,
    contentLength: input.contentLength,
    ...(input.status ? { status: input.status } : {}),
    ...(input.httpStatus ? { httpStatus: input.httpStatus } : {}),
  });
}
