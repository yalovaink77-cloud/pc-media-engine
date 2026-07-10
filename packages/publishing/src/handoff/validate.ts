import type { GeneratedContentArtifact } from '@pcme/ai';

import type {
  PublishingHandoffRequest,
  PublishingHandoffStatus,
  PublishingHandoffWarning,
  PublishingMetadata,
  PublishingValidationResult,
} from './types.js';

const APPROVED_REVIEW_STATUSES = new Set(['approved', 'approved-with-notes']);
const BLOCKED_ARTIFACT_STATUSES = new Set(['invalid', 'rejected']);

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{8,}/,
  /Bearer\s+[a-zA-Z0-9._-]+/i,
  /api[_-]?key\s*[:=]\s*\S+/i,
];

const BLOCKED_METADATA_PATTERNS = [
  /template_path/i,
  /sourcePath/i,
  /source_path/i,
  /repoPath/i,
  /__proto__/,
  /^---\s*\n/m,
];

const ABSOLUTE_PATH_PATTERNS = [
  /\/(?:home|tmp|var|Users|etc|root)\/[^\s"'<>]*/,
  /^[A-Za-z]:[\\/][^\s"'<>]*/,
  /[a-z]+:\/\/[^\s"'<>]+/i,
];

function buildIssue(
  code: string,
  message: string,
  severity: PublishingHandoffWarning['severity'],
): PublishingHandoffWarning {
  return Object.freeze({ code, message, severity });
}

function matchesAnyPattern(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function redactBlockedValue(value: string): string {
  if (
    matchesAnyPattern(value, SECRET_PATTERNS) ||
    matchesAnyPattern(value, ABSOLUTE_PATH_PATTERNS) ||
    matchesAnyPattern(value, BLOCKED_METADATA_PATTERNS)
  ) {
    return '[REDACTED]';
  }
  return value;
}

/** Redact blocked metadata patterns from publishing metadata fields. */
export function sanitizePublishingMetadata(metadata: PublishingMetadata): PublishingMetadata {
  return Object.freeze({
    ...metadata,
    title: redactBlockedValue(metadata.title),
    slug: metadata.slug,
    excerpt: metadata.excerpt ? redactBlockedValue(metadata.excerpt) : undefined,
    author: metadata.author ? redactBlockedValue(metadata.author) : undefined,
    featuredImageRef: metadata.featuredImageRef
      ? redactBlockedValue(metadata.featuredImageRef)
      : undefined,
    canonicalUrl: metadata.canonicalUrl ? redactBlockedValue(metadata.canonicalUrl) : undefined,
    tags: metadata.tags?.map((tag) => redactBlockedValue(tag)),
    categories: metadata.categories?.map((category) => redactBlockedValue(category)),
    publishStatus: metadata.publishStatus,
    scheduledAt: metadata.scheduledAt,
  });
}

function inspectForBlockedContent(serialized: string): PublishingHandoffWarning | undefined {
  if (matchesAnyPattern(serialized, SECRET_PATTERNS)) {
    return buildIssue('secret-detected', 'Handoff payload appears to contain secrets', 'error');
  }
  if (matchesAnyPattern(serialized, ABSOLUTE_PATH_PATTERNS)) {
    return buildIssue(
      'absolute-path-detected',
      'Handoff payload appears to contain absolute paths',
      'error',
    );
  }
  if (matchesAnyPattern(serialized, BLOCKED_METADATA_PATTERNS)) {
    return buildIssue(
      'blocked-metadata-detected',
      'Handoff payload appears to contain blocked internal metadata',
      'error',
    );
  }
  return undefined;
}

function validateMetadata(metadata: PublishingMetadata): PublishingHandoffWarning[] {
  const errors: PublishingHandoffWarning[] = [];

  if (!metadata.title.trim()) {
    errors.push(buildIssue('missing-title', 'Publishing metadata title is required', 'error'));
  }
  if (!metadata.slug.trim()) {
    errors.push(buildIssue('missing-slug', 'Publishing metadata slug is required', 'error'));
  }

  return errors;
}

/** Validate whether an artifact and review can produce a publish-ready handoff. */
export function validatePublishingHandoff(
  input: PublishingHandoffRequest,
): PublishingValidationResult {
  const errors: PublishingHandoffWarning[] = [];
  const warnings: PublishingHandoffWarning[] = [];

  const { artifact, review, target, metadata } = input;

  if (!APPROVED_REVIEW_STATUSES.has(review.review.status)) {
    errors.push(
      buildIssue(
        'review-not-approved',
        `Review status ${review.review.status} cannot create a ready handoff`,
        'error',
      ),
    );
  }

  if (BLOCKED_ARTIFACT_STATUSES.has(artifact.status)) {
    errors.push(
      buildIssue(
        'artifact-not-publishable',
        `Artifact status ${artifact.status} cannot create a ready handoff`,
        'error',
      ),
    );
  }

  if (review.review.artifactId !== artifact.artifactId) {
    errors.push(
      buildIssue(
        'artifact-review-mismatch',
        'Review artifactId does not match artifact.artifactId',
        'error',
      ),
    );
  }

  if (review.review.jobId !== artifact.jobId) {
    errors.push(
      buildIssue('artifact-review-mismatch', 'Review jobId does not match artifact.jobId', 'error'),
    );
  }

  if (!artifact.content.trim()) {
    errors.push(buildIssue('empty-content', 'Artifact content must not be empty', 'error'));
  }

  if (!target.supportedFormats.includes(artifact.format)) {
    errors.push(
      buildIssue(
        'unsupported-format',
        `Target ${target.targetId} does not support format ${artifact.format}`,
        'error',
      ),
    );
  }

  errors.push(...validateMetadata(metadata));

  const serialized = JSON.stringify({
    content: artifact.content,
    metadata,
  });
  const blockedIssue = inspectForBlockedContent(serialized);
  if (blockedIssue) {
    errors.push(blockedIssue);
  }

  for (const artifactWarning of artifact.warnings) {
    warnings.push(
      buildIssue(artifactWarning.code, artifactWarning.message, artifactWarning.severity),
    );
  }

  for (const reviewFinding of review.findings) {
    warnings.push(buildIssue(reviewFinding.code, reviewFinding.message, 'warning'));
  }

  const valid = errors.length === 0;
  const status: PublishingHandoffStatus = valid ? 'ready' : 'blocked';

  return Object.freeze({
    valid,
    status,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
  });
}

export function validateHandoffPackageContent(
  artifact: GeneratedContentArtifact,
  metadata: PublishingMetadata,
): PublishingHandoffWarning | undefined {
  return inspectForBlockedContent(JSON.stringify({ content: artifact.content, metadata }));
}
