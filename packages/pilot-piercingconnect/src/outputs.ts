import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import type { ContentReviewRequest, GeneratedContentArtifact } from '@pcme/ai';

import type { PiercingConnectPilotConfig } from './config.js';
import { PiercingConnectPilotError } from './errors.js';

const ABSOLUTE_PATH_PATTERN = /(?:\/home\/|\/Users\/|[A-Za-z]:\\)/;
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
  readonly warnings: readonly { readonly code: string; readonly message: string }[];
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
  readonly warnings: readonly { readonly code: string; readonly message: string }[];
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

/** Build safe artifact metadata without secrets, absolute paths, or raw provider payloads. */
export function buildArtifactMetadata(input: {
  artifact: GeneratedContentArtifact;
  productId: string;
  mediaEngineRoot: string;
}): PilotArtifactMetadata {
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
    model: input.artifact.model,
    warningCount: input.artifact.warnings.length,
    warnings: Object.freeze(
      input.artifact.warnings.map((warning) =>
        Object.freeze({
          code: warning.code,
          message: scrubSensitiveText(warning.message, input.mediaEngineRoot),
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
}): PilotReviewSummary {
  return Object.freeze({
    reviewId: input.review.reviewId,
    artifactId: input.review.artifactId,
    jobId: input.review.jobId,
    status: 'pending-review',
    contentType: input.review.contentType,
    locale: input.review.locale,
    requiredChecks: Object.freeze([...input.review.requiredChecks]),
    warningCount: input.review.warnings.length,
    warnings: Object.freeze(
      input.review.warnings.map((warning) =>
        Object.freeze({
          code: warning.code,
          message: scrubSensitiveText(warning.message, input.mediaEngineRoot),
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

export function scrubSensitiveText(value: string, mediaEngineRoot: string): string {
  let next = value.replaceAll(mediaEngineRoot, '<monorepo-root>');
  next = next.replace(SECRET_PATTERN, '[redacted]');
  next = next.replace(ABSOLUTE_PATH_PATTERN, '[path]');
  return next;
}

export function assertSafeOutputPayload(payload: unknown, mediaEngineRoot: string): void {
  const serialized = JSON.stringify(payload);
  if (serialized.includes(mediaEngineRoot) || ABSOLUTE_PATH_PATTERN.test(serialized)) {
    throw new PiercingConnectPilotError(
      'unsafe-output',
      'Pilot output contains absolute paths and cannot be written',
    );
  }
  if (SECRET_PATTERN.test(serialized)) {
    throw new PiercingConnectPilotError(
      'unsafe-output',
      'Pilot output contains secret-like material and cannot be written',
    );
  }
  if (/"apiKey"|OPENROUTER_API_KEY|Bearer /i.test(serialized)) {
    throw new PiercingConnectPilotError(
      'unsafe-output',
      'Pilot output contains API credential material and cannot be written',
    );
  }
}

export function assertDraftContainsRequiredSections(
  markdown: string,
  config: PiercingConnectPilotConfig,
): readonly string[] {
  const normalized = markdown.toLowerCase();
  return config.requiredSections.filter((section) => !normalized.includes(section.toLowerCase()));
}

/** Write pilot draft outputs under the configured gitignored directory. */
export async function writePilotOutputs(input: {
  outputDir: string;
  markdown: string;
  artifactMetadata: PilotArtifactMetadata;
  reviewSummary: PilotReviewSummary;
  mediaEngineRoot: string;
}): Promise<PilotOutputPaths> {
  assertSafeOutputPayload(input.artifactMetadata, input.mediaEngineRoot);
  assertSafeOutputPayload(input.reviewSummary, input.mediaEngineRoot);
  assertSafeOutputPayload({ content: input.markdown }, input.mediaEngineRoot);

  await mkdir(input.outputDir, { recursive: true });

  const generatedReviewPath = join(input.outputDir, 'generated-review.md');
  const artifactMetadataPath = join(input.outputDir, 'artifact-metadata.json');
  const reviewSummaryPath = join(input.outputDir, 'review-summary.json');

  await writeFile(generatedReviewPath, `${input.markdown.trim()}\n`, 'utf8');
  await writeFile(
    artifactMetadataPath,
    `${JSON.stringify(input.artifactMetadata, null, 2)}\n`,
    'utf8',
  );
  await writeFile(reviewSummaryPath, `${JSON.stringify(input.reviewSummary, null, 2)}\n`, 'utf8');

  return Object.freeze({
    outputDir: relative(input.mediaEngineRoot, input.outputDir) || input.outputDir,
    generatedReviewPath: relative(input.mediaEngineRoot, generatedReviewPath),
    artifactMetadataPath: relative(input.mediaEngineRoot, artifactMetadataPath),
    reviewSummaryPath: relative(input.mediaEngineRoot, reviewSummaryPath),
  });
}
