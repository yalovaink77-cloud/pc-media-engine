import { readFile } from 'node:fs/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { GenerationProviderAdapter } from '@pcme/ai';
import {
  createEditorialLoopService,
  createGeneratedContentArtifact,
  createGenerationJob,
  FakeGenerationProvider,
  serializeEditorialIntelligenceReport,
} from '@pcme/ai';
import { createCommerceContentOrchestrator } from '@pcme/content';
import type { EditorialIntelligenceProfile, EditorialModuleId } from '@pcme/shared';

import {
  createPiercingConnectPilotConfig,
  type PiercingConnectPilotConfig,
  resolveMonorepoRoot,
  resolvePilotCommerceRepoPath,
  resolvePilotOutputDir,
} from './config.js';
import { PiercingConnectPilotError } from './errors.js';
import {
  assertSafeOutputPayload,
  type PilotRevisionOutputPaths,
  scrubPayloadStrings,
  scrubSensitiveText,
} from './outputs.js';
import { withPiercingConnectIntelligenceAnalyzers } from './seo-profile.js';

const REVIEWER = Object.freeze({ reviewerId: 'pilot-reviewer', displayName: 'Pilot Reviewer' });

export interface PiercingConnectPilotRevisionResult {
  readonly status: 'succeeded-pending-review' | 'failed';
  readonly published: false;
  readonly wordpressInvoked: false;
  readonly reviewId?: string;
  readonly artifactId?: string;
  readonly revisionArtifactId?: string;
  readonly outputs?: PilotRevisionOutputPaths;
  readonly error?: { readonly code: string; readonly message: string };
}

export interface RunPiercingConnectPilotRevisionOptions {
  readonly config?: Partial<PiercingConnectPilotConfig>;
  readonly mediaEngineRoot?: string;
  readonly repoPath?: string;
  readonly outputDir?: string;
  readonly fixturePath?: string;
  readonly fixedCreatedAt?: string;
  readonly generationProvider?: GenerationProviderAdapter;
}

function createPilotIntelligenceProfile(
  config: PiercingConnectPilotConfig,
): EditorialIntelligenceProfile {
  return withPiercingConnectIntelligenceAnalyzers(
    Object.freeze({
      profileId: 'piercingconnect-product-review-v1',
      contentType: config.contentType,
      locale: config.locale,
      enabledModules: Object.freeze([
        'editorial',
        'evidence',
        'seo',
        'ai-seo',
        'commercial',
      ] as const satisfies readonly EditorialModuleId[]),
    }),
    config,
  );
}

async function writeRevisionOutputs(input: {
  readonly outputDir: string;
  readonly draftV1: string;
  readonly draftV2: string;
  readonly reportV1: string;
  readonly reportV2: string;
  readonly revisionRequest: unknown;
  readonly revisionComparison: unknown;
  readonly artifactMetadata: unknown;
  readonly reviewSummary: unknown;
  readonly editorialHistory: readonly unknown[];
  readonly mediaEngineRoot: string;
  readonly additionalRoots: readonly string[];
}): Promise<PilotRevisionOutputPaths> {
  await mkdir(input.outputDir, { recursive: true });

  const paths = Object.freeze({
    outputDir: input.outputDir,
    generatedReviewPath: join(input.outputDir, 'generated-review.md'),
    generatedReviewV2Path: join(input.outputDir, 'generated-review-v2.md'),
    editorialReportPath: join(input.outputDir, 'editorial-intelligence-report.json'),
    editorialReportV2Path: join(input.outputDir, 'editorial-intelligence-report-v2.json'),
    revisionRequestPath: join(input.outputDir, 'revision-request.json'),
    revisionComparisonPath: join(input.outputDir, 'revision-comparison.json'),
    artifactMetadataPath: join(input.outputDir, 'artifact-metadata.json'),
    reviewSummaryPath: join(input.outputDir, 'review-summary.json'),
    editorialHistoryPath: join(input.outputDir, 'editorial-history.jsonl'),
  });

  const scrub = (value: string) =>
    scrubSensitiveText(value, input.mediaEngineRoot, { additionalRoots: input.additionalRoots });

  await writeFile(paths.generatedReviewPath, scrub(input.draftV1), 'utf8');
  await writeFile(paths.generatedReviewV2Path, scrub(input.draftV2), 'utf8');
  await writeFile(paths.editorialReportPath, scrub(input.reportV1), 'utf8');
  await writeFile(paths.editorialReportV2Path, scrub(input.reportV2), 'utf8');

  const jsonPayloads = Object.freeze([
    Object.freeze({ path: paths.revisionRequestPath, payload: input.revisionRequest }),
    Object.freeze({ path: paths.revisionComparisonPath, payload: input.revisionComparison }),
    Object.freeze({ path: paths.artifactMetadataPath, payload: input.artifactMetadata }),
    Object.freeze({ path: paths.reviewSummaryPath, payload: input.reviewSummary }),
  ]);

  for (const entry of jsonPayloads) {
    const scrubbed = scrubPayloadStrings(entry.payload, input.mediaEngineRoot, {
      additionalRoots: input.additionalRoots,
    });
    assertSafeOutputPayload(scrubbed, input.mediaEngineRoot);
    await writeFile(entry.path, `${JSON.stringify(scrubbed, null, 2)}\n`, 'utf8');
  }

  const historyLines = input.editorialHistory
    .map((event) =>
      JSON.stringify(
        scrubPayloadStrings(event, input.mediaEngineRoot, {
          additionalRoots: input.additionalRoots,
        }),
      ),
    )
    .join('\n');
  if (historyLines.length > 0) {
    await writeFile(paths.editorialHistoryPath, `${historyLines}\n`, 'utf8');
  }

  return paths;
}

/** Run the offline PiercingConnect revision pilot and stop at pending-review. */
export async function runPiercingConnectPilotRevision(
  options: RunPiercingConnectPilotRevisionOptions = {},
): Promise<PiercingConnectPilotRevisionResult> {
  const config = createPiercingConnectPilotConfig(options.config);
  const mediaEngineRoot = options.mediaEngineRoot ?? resolveMonorepoRoot();
  const published = false as const;
  const wordpressInvoked = false as const;
  const fixedCreatedAt = options.fixedCreatedAt ?? '2026-07-12T12:00:00.000Z';

  const repoPath = resolvePilotCommerceRepoPath({
    mediaEngineRoot,
    commerceRepoRelativePath: config.commerceRepoRelativePath,
    repoPath: options.repoPath,
  });
  const outputDir =
    options.outputDir ??
    resolvePilotOutputDir({
      mediaEngineRoot,
      outputDirRelativePath: config.outputDirRelativePath,
    });

  try {
    const fixturePath =
      options.fixturePath ??
      join(
        mediaEngineRoot,
        'packages/pilot-piercingconnect/src/__fixtures__/neilmed-generated-review.md',
      );
    const draftV1 = await readFile(fixturePath, 'utf8');

    const orchestrator = await createCommerceContentOrchestrator({
      commerce: { repoPath, mediaEngineRoot },
      strict: false,
    });
    const plan = await orchestrator.prepare({
      root: { type: 'product', id: config.productId },
      contextRecipe: config.contextRecipe,
      contentType: config.contentType,
      locale: config.locale,
      tone: config.tone,
      outputFormat: config.outputFormat,
      strict: false,
    });

    if (plan.status === 'blocked' || !plan.promptPayload) {
      throw new PiercingConnectPilotError(
        'context-blocked',
        plan.blockReason ?? 'Content generation plan is blocked',
      );
    }

    const job = createGenerationJob(plan);
    const { artifact: artifactV1 } = createGeneratedContentArtifact(
      job,
      Object.freeze({
        providerId: 'fake',
        status: 'succeeded',
        content: draftV1,
        model: 'fake-model',
        finishReason: 'stop',
      }),
      { createdAt: fixedCreatedAt },
    );

    const profile = createPilotIntelligenceProfile(config);
    const loop = createEditorialLoopService();
    const initial = loop.prepareInitialReview({
      artifact: artifactV1,
      profile,
      analyzedAt: fixedCreatedAt,
      createdAt: fixedCreatedAt,
    });

    const requested = loop.requestRevision({
      reviewId: initial.review.reviewId,
      priorArtifact: artifactV1,
      report: initial.report,
      reviewer: REVIEWER,
      sourceSnapshotId: artifactV1.snapshotId,
      humanNotes: 'Pilot offline revision pass.',
      createdAt: fixedCreatedAt,
    });

    const draftV2 = `${draftV1}\n\n## Affiliate Disclosure\nWe may earn a commission from qualifying purchases. This review remains editorially independent.`;
    const provider =
      options.generationProvider ?? new FakeGenerationProvider({ generatedContent: draftV2 });
    const revised = await loop.runRevision({
      plan,
      priorArtifact: artifactV1,
      revisionRequest: requested.revisionRequest,
      provider,
    });

    const reanalyzed = loop.reanalyzeRevision({
      artifact: revised.artifact,
      profile,
      priorReport: initial.report,
      analyzedAt: '2026-07-12T13:00:00.000Z',
    });

    const reopened = loop.reopenReviewAfterRevision({
      reviewId: initial.review.reviewId,
      activeArtifact: revised.artifact,
      report: reanalyzed.report,
      timestamp: '2026-07-12T13:00:00.000Z',
    });

    const outputs = await writeRevisionOutputs({
      outputDir,
      draftV1,
      draftV2: revised.artifact.content,
      reportV1: serializeEditorialIntelligenceReport(initial.report),
      reportV2: serializeEditorialIntelligenceReport(reanalyzed.report),
      revisionRequest: requested.revisionRequest,
      revisionComparison: reanalyzed.comparison,
      artifactMetadata: Object.freeze({
        rootArtifactId: artifactV1.rootArtifactId,
        artifactId: artifactV1.artifactId,
        revisionArtifactId: revised.artifact.artifactId,
        revisionNumber: revised.artifact.revisionNumber,
        snapshotId: artifactV1.snapshotId,
        reviewStatus: reopened.review.status,
        published,
      }),
      reviewSummary: Object.freeze({
        reviewId: reopened.review.reviewId,
        activeArtifactId: reopened.review.activeArtifactId,
        revisionCount: reopened.review.revisionCount,
        status: reopened.review.status,
        approved: false,
        published,
      }),
      editorialHistory: reopened.history,
      mediaEngineRoot,
      additionalRoots: Object.freeze([repoPath]),
    });

    return Object.freeze({
      status: 'succeeded-pending-review',
      published,
      wordpressInvoked,
      reviewId: reopened.review.reviewId,
      artifactId: artifactV1.artifactId,
      revisionArtifactId: revised.artifact.artifactId,
      outputs,
    });
  } catch (error: unknown) {
    if (error instanceof PiercingConnectPilotError) {
      return Object.freeze({
        status: 'failed',
        published,
        wordpressInvoked,
        error: { code: error.code, message: error.message },
      });
    }

    return Object.freeze({
      status: 'failed',
      published,
      wordpressInvoked,
      error: {
        code: 'pilot-revision-failure',
        message: error instanceof Error ? error.message : 'PiercingConnect revision pilot failed',
      },
    });
  }
}
