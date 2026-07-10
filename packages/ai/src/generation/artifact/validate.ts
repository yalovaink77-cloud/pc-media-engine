import { DEFAULT_BLOCKED_JOB_FIELDS } from '../policy-snapshot.js';
import type { GenerationJobRequest, GenerationProviderResponse } from '../types.js';
import { containsBlockedJobMetadata } from '../validate.js';
import { detectGeneratedContentSafetyWarnings } from './safety.js';
import type {
  GeneratedContentFormat,
  GeneratedContentValidationOptions,
  GeneratedContentValidationResult,
  GeneratedContentWarning,
} from './types.js';

const DEFAULT_MIN_CONTENT_LENGTH = 1;
const DEFAULT_MAX_CONTENT_LENGTH = 500_000;

const DEFAULT_SECRET_PATTERNS = Object.freeze([
  /sk-[a-zA-Z0-9_-]{8,}/,
  /Bearer\s+[a-zA-Z0-9._-]+/i,
  /OPENROUTER_API_KEY\s*=\s*\S+/i,
  /api[_-]?key\s*[:=]\s*\S+/i,
]);

const DEFAULT_BLOCKED_METADATA_PATTERNS = Object.freeze([
  /template_path/i,
  /sourcePath/i,
  /source_path/i,
  /repoPath/i,
  /__proto__/,
]);

const DEFAULT_ABSOLUTE_PATH_PATTERNS = Object.freeze([
  /\/(?:home|tmp|var|Users|etc|root)\/[^\s"'<>]*/,
  /^[A-Za-z]:[\\/][^\s"'<>]*/,
  /[a-z]+:\/\/[^\s"'<>]+/i,
]);

const UNSAFE_HTML_PATTERNS = Object.freeze([
  /<script[\s>]/i,
  /<iframe[\s>]/i,
  /javascript:/i,
  /\son[a-z]+\s*=/i,
  /<embed[\s>]/i,
  /<object[\s>]/i,
]);

function buildIssue(
  code: string,
  message: string,
  severity: GeneratedContentWarning['severity'],
): GeneratedContentWarning {
  return Object.freeze({ code, message, severity });
}

function resolveValidationOptions(
  options?: GeneratedContentValidationOptions,
): Required<GeneratedContentValidationOptions> {
  return {
    minContentLength: options?.minContentLength ?? DEFAULT_MIN_CONTENT_LENGTH,
    maxContentLength: options?.maxContentLength ?? DEFAULT_MAX_CONTENT_LENGTH,
    secretPatterns: options?.secretPatterns ?? DEFAULT_SECRET_PATTERNS,
    blockedMetadataPatterns: options?.blockedMetadataPatterns ?? DEFAULT_BLOCKED_METADATA_PATTERNS,
    absolutePathPatterns: options?.absolutePathPatterns ?? DEFAULT_ABSOLUTE_PATH_PATTERNS,
  };
}

function matchesAnyPattern(content: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(content));
}

function detectBlockedMetadata(content: string): GeneratedContentWarning | undefined {
  for (const field of DEFAULT_BLOCKED_JOB_FIELDS) {
    if (content.includes(field)) {
      return buildIssue(
        'blocked-metadata',
        `Content contains blocked metadata field: ${field}`,
        'error',
      );
    }
  }

  if (matchesAnyPattern(content, DEFAULT_BLOCKED_METADATA_PATTERNS)) {
    return buildIssue('blocked-metadata', 'Content contains blocked metadata patterns', 'error');
  }

  return undefined;
}

function detectUnsafeHtml(
  content: string,
  format: GeneratedContentFormat,
): GeneratedContentWarning | undefined {
  if (format === 'plain-text' && /<[^>]+>/.test(content)) {
    return buildIssue('unsupported-html', 'Plain-text output contains HTML markup', 'error');
  }

  if (matchesAnyPattern(content, UNSAFE_HTML_PATTERNS)) {
    return buildIssue(
      'unsafe-html',
      'Content contains unsupported HTML or script content',
      'error',
    );
  }

  return undefined;
}

/** Validate generated content against provider-neutral artifact rules. */
export function validateGeneratedContent(input: {
  readonly job: GenerationJobRequest;
  readonly providerResponse: GenerationProviderResponse;
  readonly content: string;
  readonly format: GeneratedContentFormat;
  readonly options?: GeneratedContentValidationOptions;
}): GeneratedContentValidationResult {
  const validationOptions = resolveValidationOptions(input.options);
  const errors: GeneratedContentWarning[] = [];
  const warnings: GeneratedContentWarning[] = [];

  if (input.providerResponse.status === 'failed') {
    errors.push(
      buildIssue(
        'provider-failure',
        input.providerResponse.error?.message ?? 'Provider generation failed',
        'error',
      ),
    );
  }

  const trimmedContent = input.content.trim();
  if (trimmedContent.length < validationOptions.minContentLength) {
    errors.push(buildIssue('empty-content', 'Generated content must not be empty', 'error'));
  }

  if (input.content.length > validationOptions.maxContentLength) {
    errors.push(
      buildIssue(
        'content-too-long',
        `Generated content exceeds maximum length of ${validationOptions.maxContentLength}`,
        'error',
      ),
    );
  }

  if (input.format !== input.job.outputFormat) {
    errors.push(
      buildIssue(
        'format-mismatch',
        `Expected output format ${input.job.outputFormat} but received ${input.format}`,
        'error',
      ),
    );
  }

  if (containsBlockedJobMetadata(input.job.promptPayload)) {
    errors.push(
      buildIssue(
        'blocked-job-metadata',
        'Generation job payload contains blocked metadata',
        'error',
      ),
    );
  }

  const blockedMetadataIssue = detectBlockedMetadata(input.content);
  if (blockedMetadataIssue) {
    errors.push(blockedMetadataIssue);
  }

  if (matchesAnyPattern(input.content, validationOptions.secretPatterns)) {
    errors.push(
      buildIssue('secret-detected', 'Generated content appears to contain secrets', 'error'),
    );
  }

  if (matchesAnyPattern(input.content, validationOptions.absolutePathPatterns)) {
    errors.push(
      buildIssue(
        'absolute-path-detected',
        'Generated content appears to contain absolute paths',
        'error',
      ),
    );
  }

  const unsafeHtmlIssue = detectUnsafeHtml(input.content, input.format);
  if (unsafeHtmlIssue) {
    errors.push(unsafeHtmlIssue);
  }

  for (const warningMessage of input.providerResponse.warnings ?? []) {
    warnings.push(buildIssue('provider-warning', warningMessage, 'warning'));
  }

  for (const payloadWarning of input.job.promptPayload.warnings) {
    warnings.push(buildIssue(payloadWarning.code, payloadWarning.message, 'warning'));
  }

  warnings.push(...detectGeneratedContentSafetyWarnings(input.content, input.job.policySnapshot));

  const valid = errors.length === 0;
  const status = valid
    ? warnings.length > 0
      ? 'generated-with-warnings'
      : 'generated'
    : 'invalid';

  return Object.freeze({
    valid,
    status,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
  });
}
