import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import type { ContentReviewRequest, GeneratedContentArtifact } from '@pcme/ai';

import { PiercingConnectPilotError } from './errors.js';
import { normalizePreservingMarkdownWhitespace } from './formatting.js';
import type { PilotQualityFinding } from './quality.js';
import { findMissingRequiredSections } from './section-markers.js';

/**
 * Detect absolute filesystem paths and home-directory prefixes.
 * Kept as a hard gate after sanitization — do not weaken.
 */
export const ABSOLUTE_PATH_PATTERN =
  /(?:\/(?:home|Users|tmp|var|etc|root|opt|mnt|private)\/[^\s"'<>\\]*|[A-Za-z]:\\[^\s"'<>]*)/;

const SECRET_PATTERN = /(?:OPENROUTER_API_KEY|Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9]+)/i;

export interface PilotArtifactMetadata {
  readonly artifactId: string;
  readonly jobId: string;
  readonly requestId: string;
  readonly sourceId: string;
  readonly snapshotId: string;
  readonly contentType: string;
  readonly locale: string;
  readonly format: string;
  readonly status: string;
  readonly providerId: string;
  readonly model?: string;
  readonly warningCount: number;
  readonly warnings: readonly { readonly code: string }[];
  readonly contentCharacterCount: number;
  readonly createdAt: string;
  readonly productId: string;
  readonly reviewStatus: 'pending-review';
  readonly published: false;
}

export interface PilotReviewSummary {
  readonly reviewId: string;
  readonly artifactId: string;
  readonly jobId: string;
  readonly status: 'pending-review';
  readonly contentType: string;
  readonly locale: string;
  readonly requiredChecks: readonly string[];
  readonly warningCount: number;
  readonly warnings: readonly { readonly code: string }[];
  readonly findings: readonly { readonly code: string; readonly detail: string }[];
  readonly decision: null;
  readonly approved: false;
  readonly published: false;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly note: string;
}

export interface PilotOutputPaths {
  readonly outputDir: string;
  readonly generatedReviewPath: string;
  readonly artifactMetadataPath: string;
  readonly reviewSummaryPath: string;
}

export interface PilotRevisionOutputPaths {
  readonly outputDir: string;
  readonly generatedReviewPath: string;
  readonly generatedReviewV2Path: string;
  readonly editorialReportPath: string;
  readonly editorialReportV2Path: string;
  readonly revisionRequestPath: string;
  readonly revisionComparisonPath: string;
  readonly artifactMetadataPath: string;
  readonly reviewSummaryPath: string;
  readonly editorialHistoryPath: string;
}

export interface ScrubSensitiveTextOptions {
  readonly additionalRoots?: readonly string[];
}

function isUnsafeString(
  value: string,
  mediaEngineRoot: string,
): 'absolute-path' | 'secret' | undefined {
  if (value.includes(mediaEngineRoot) || ABSOLUTE_PATH_PATTERN.test(value)) {
    return 'absolute-path';
  }
  if (SECRET_PATTERN.test(value) || /"apiKey"|OPENROUTER_API_KEY|Bearer /i.test(value)) {
    return 'secret';
  }
  return undefined;
}

/**
 * Locate the first unsafe field for diagnostics.
 * Returns only a JSON-path-like field name — never the unsafe value.
 */
export function findUnsafeOutputLocation(
  payload: unknown,
  mediaEngineRoot: string,
  path = '$',
): { readonly path: string; readonly kind: 'absolute-path' | 'secret' } | undefined {
  if (typeof payload === 'string') {
    const kind = isUnsafeString(payload, mediaEngineRoot);
    return kind ? { path, kind } : undefined;
  }

  if (Array.isArray(payload)) {
    for (const [index, item] of payload.entries()) {
      const hit = findUnsafeOutputLocation(item, mediaEngineRoot, `${path}[${index}]`);
      if (hit) {
        return hit;
      }
    }
    return undefined;
  }

  if (payload && typeof payload === 'object') {
    for (const [key, value] of Object.entries(payload)) {
      const hit = findUnsafeOutputLocation(value, mediaEngineRoot, `${path}.${key}`);
      if (hit) {
        return hit;
      }
    }
  }

  return undefined;
}

/** Recursively scrub every string field in a pilot-facing payload. */
export function scrubPayloadStrings<T>(
  value: T,
  mediaEngineRoot: string,
  options: ScrubSensitiveTextOptions = {},
): T {
  if (typeof value === 'string') {
    return scrubSensitiveText(value, mediaEngineRoot, options) as T;
  }

  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((item) => scrubPayloadStrings(item, mediaEngineRoot, options)),
    ) as T;
  }

  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      next[key] = scrubPayloadStrings(nested, mediaEngineRoot, options);
    }
    return Object.freeze(next) as T;
  }

  return value;
}

/** Build safe artifact metadata without secrets, absolute paths, or raw provider payloads. */
export function buildArtifactMetadata(input: {
  artifact: GeneratedContentArtifact;
  productId: string;
  mediaEngineRoot: string;
  additionalRoots?: readonly string[];
}): PilotArtifactMetadata {
  // Keep codes only — free-text warning messages are not pilot-safe identifiers.
  return Object.freeze({
    artifactId: input.artifact.artifactId,
    jobId: input.artifact.jobId,
    requestId: input.artifact.requestId,
    sourceId: input.artifact.sourceId,
    snapshotId: input.artifact.snapshotId,
    contentType: input.artifact.contentType,
    locale: input.artifact.locale,
    format: input.artifact.format,
    status: input.artifact.status,
    providerId: input.artifact.providerId,
    model: input.artifact.model
      ? scrubSensitiveText(input.artifact.model, input.mediaEngineRoot, {
          additionalRoots: input.additionalRoots,
        })
      : undefined,
    warningCount: input.artifact.warnings.length,
    warnings: Object.freeze(
      input.artifact.warnings.map((warning) =>
        Object.freeze({
          code: scrubSensitiveText(warning.code, input.mediaEngineRoot, {
            additionalRoots: input.additionalRoots,
          }),
        }),
      ),
    ),
    contentCharacterCount: input.artifact.content.length,
    createdAt: input.artifact.createdAt,
    productId: input.productId,
    reviewStatus: 'pending-review',
    published: false,
  });
}

/** Build a pending-review summary without approving or publishing. */
export function buildReviewSummary(input: {
  review: ContentReviewRequest;
  mediaEngineRoot: string;
  additionalRoots?: readonly string[];
  findings?: readonly PilotQualityFinding[];
}): PilotReviewSummary {
  const findings = input.findings ?? [];
  return Object.freeze({
    reviewId: input.review.reviewId,
    artifactId: input.review.artifactId,
    jobId: input.review.jobId,
    status: 'pending-review',
    contentType: input.review.contentType,
    locale: input.review.locale,
    requiredChecks: Object.freeze(
      input.review.requiredChecks.map((check) =>
        scrubSensitiveText(check, input.mediaEngineRoot, {
          additionalRoots: input.additionalRoots,
        }),
      ),
    ),
    warningCount: findings.length + input.review.warnings.length,
    warnings: Object.freeze(
      input.review.warnings.map((warning) =>
        Object.freeze({
          code: scrubSensitiveText(warning.code, input.mediaEngineRoot, {
            additionalRoots: input.additionalRoots,
          }),
        }),
      ),
    ),
    findings: Object.freeze(
      findings.map((finding) =>
        Object.freeze({
          code: scrubSensitiveText(finding.code, input.mediaEngineRoot, {
            additionalRoots: input.additionalRoots,
          }),
          detail: scrubSensitiveText(finding.detail, input.mediaEngineRoot, {
            additionalRoots: input.additionalRoots,
          }),
        }),
      ),
    ),
    decision: null,
    approved: false,
    published: false,
    createdAt: input.review.createdAt,
    expiresAt: input.review.expiresAt,
    note: 'Draft remains pending-review. Do not publish until human review completes.',
  });
}

/**
 * Project absolute paths and secrets out of pilot-facing text.
 * Known roots (monorepo / commerce) are replaced first, then remaining
 * absolute path matches are redacted in full (global).
 */
export function scrubSensitiveText(
  value: string,
  mediaEngineRoot: string,
  options: ScrubSensitiveTextOptions = {},
): string {
  let next = value;

  const roots = [mediaEngineRoot, ...(options.additionalRoots ?? [])]
    .map((root) => root.trim())
    .filter((root) => root.length > 0)
    .sort((left, right) => right.length - left.length);

  for (const root of roots) {
    next = next.replaceAll(root, root === mediaEngineRoot ? '<monorepo-root>' : '<commerce-root>');
  }

  // Fresh global regex per call avoids lastIndex interference across scrub passes.
  next = next.replace(new RegExp(SECRET_PATTERN.source, 'gi'), '[redacted]');
  next = next.replace(new RegExp(ABSOLUTE_PATH_PATTERN.source, 'g'), '[path]');
  return next;
}

/** Hard gate: reject payloads that still contain absolute paths or secrets. */
export function assertSafeOutputPayload(payload: unknown, mediaEngineRoot: string): void {
  const hit = findUnsafeOutputLocation(payload, mediaEngineRoot);
  if (!hit) {
    return;
  }

  if (hit.kind === 'absolute-path') {
    throw new PiercingConnectPilotError(
      'unsafe-output',
      `Pilot output contains absolute paths and cannot be written (field: ${hit.path})`,
    );
  }

  throw new PiercingConnectPilotError(
    'unsafe-output',
    `Pilot output contains secret-like material and cannot be written (field: ${hit.path})`,
  );
}

/** @deprecated Use findMissingRequiredSections from section-markers.js */
export function assertDraftContainsRequiredSections(
  markdown: string,
  requiredSections: Parameters<typeof findMissingRequiredSections>[1],
): readonly string[] {
  return findMissingRequiredSections(markdown, requiredSections);
}

/** Write pilot draft outputs under the configured gitignored directory. */
export async function writePilotOutputs(input: {
  outputDir: string;
  markdown: string;
  artifactMetadata: PilotArtifactMetadata;
  reviewSummary: PilotReviewSummary;
  mediaEngineRoot: string;
  additionalRoots?: readonly string[];
}): Promise<PilotOutputPaths> {
  const scrubOptions = { additionalRoots: input.additionalRoots };
  // Normalize invisible characters first, then scrub secrets/paths — never collapse spaces.
  const safeMarkdown = scrubSensitiveText(
    normalizePreservingMarkdownWhitespace(input.markdown),
    input.mediaEngineRoot,
    scrubOptions,
  );
  const safeArtifactMetadata = scrubPayloadStrings(
    input.artifactMetadata,
    input.mediaEngineRoot,
    scrubOptions,
  );
  const safeReviewSummary = scrubPayloadStrings(
    input.reviewSummary,
    input.mediaEngineRoot,
    scrubOptions,
  );

  assertSafeOutputPayload(safeArtifactMetadata, input.mediaEngineRoot);
  assertSafeOutputPayload(safeReviewSummary, input.mediaEngineRoot);
  assertSafeOutputPayload({ content: safeMarkdown }, input.mediaEngineRoot);

  await mkdir(input.outputDir, { recursive: true });

  const generatedReviewPath = join(input.outputDir, 'generated-review.md');
  const artifactMetadataPath = join(input.outputDir, 'artifact-metadata.json');
  const reviewSummaryPath = join(input.outputDir, 'review-summary.json');

  await writeFile(generatedReviewPath, `${safeMarkdown.trim()}\n`, 'utf8');
  await writeFile(
    artifactMetadataPath,
    `${JSON.stringify(safeArtifactMetadata, null, 2)}\n`,
    'utf8',
  );
  await writeFile(reviewSummaryPath, `${JSON.stringify(safeReviewSummary, null, 2)}\n`, 'utf8');

  return Object.freeze({
    outputDir: relative(input.mediaEngineRoot, input.outputDir),
    generatedReviewPath: relative(input.mediaEngineRoot, generatedReviewPath),
    artifactMetadataPath: relative(input.mediaEngineRoot, artifactMetadataPath),
    reviewSummaryPath: relative(input.mediaEngineRoot, reviewSummaryPath),
  });
}
