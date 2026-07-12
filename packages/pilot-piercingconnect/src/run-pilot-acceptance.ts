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
import { createPublishingHandoff, FakePublishingTargetAdapter } from '@pcme/publishing';
import type { EditorialIntelligenceProfile, EditorialModuleId } from '@pcme/shared';

import { buildPilotAcceptanceReport } from './acceptance-report.js';
import {
  createPiercingConnectPilotConfig,
  type PiercingConnectPilotConfig,
  resolveMonorepoRoot,
  resolvePilotCommerceRepoPath,
  resolvePilotOutputDir,
} from './config.js';
import { PiercingConnectPilotError } from './errors.js';
import {
  normalizePreservingMarkdownWhitespace,
  repairPublicationFormatting,
} from './formatting.js';
import {
  assertSafeOutputPayload,
  type PilotRevisionOutputPaths,
  scrubPayloadStrings,
  scrubSensitiveText,
} from './outputs.js';
import { withPiercingConnectIntelligenceAnalyzers } from './seo-profile.js';

const REVIEWER = Object.freeze({ reviewerId: 'pilot-reviewer', displayName: 'Pilot Reviewer' });

export interface PilotAcceptanceOutputPaths extends PilotRevisionOutputPaths {
  readonly acceptanceReportPath: string;
  readonly wordpressHandoffPath: string;
  readonly wordpressPublishResultPath: string;
  readonly wordpressDraftPath: string;
}

export interface PiercingConnectPilotAcceptanceResult {
  readonly status: 'succeeded-pending-review' | 'failed';
  readonly published: false;
  readonly wordpressInvoked: boolean;
  readonly reviewId?: string;
  readonly artifactId?: string;
  readonly revisionArtifactId?: string;
  readonly humanReviewStatus?: string;
  readonly wordpressDraftStatus?: 'ready' | 'blocked' | 'skipped';
  readonly outputs?: PilotAcceptanceOutputPaths;
  readonly error?: { readonly code: string; readonly message: string };
}

export interface RunPiercingConnectPilotAcceptanceOptions {
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

async function writeAcceptanceOutputs(input: {
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
  readonly acceptanceReport: unknown;
  readonly wordpressHandoff: unknown;
  readonly wordpressPublishResult: unknown;
  readonly mediaEngineRoot: string;
  readonly additionalRoots: readonly string[];
}): Promise<PilotAcceptanceOutputPaths> {
  await mkdir(input.outputDir, { recursive: true });

  const revisionPaths = Object.freeze({
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
    acceptanceReportPath: join(input.outputDir, 'acceptance-report.json'),
    wordpressHandoffPath: join(input.outputDir, 'wordpress-handoff-package.json'),
    wordpressPublishResultPath: join(input.outputDir, 'wordpress-publish-result.json'),
    wordpressDraftPath: join(input.outputDir, 'wordpress-draft.md'),
  });

  const scrub = (value: string) =>
    scrubSensitiveText(value, input.mediaEngineRoot, { additionalRoots: input.additionalRoots });

  await writeFile(revisionPaths.generatedReviewPath, scrub(input.draftV1), 'utf8');
  await writeFile(revisionPaths.generatedReviewV2Path, scrub(input.draftV2), 'utf8');
  await writeFile(revisionPaths.wordpressDraftPath, scrub(input.draftV2), 'utf8');
  await writeFile(revisionPaths.editorialReportPath, scrub(input.reportV1), 'utf8');
  await writeFile(revisionPaths.editorialReportV2Path, scrub(input.reportV2), 'utf8');

  const jsonPayloads = Object.freeze([
    Object.freeze({ path: revisionPaths.revisionRequestPath, payload: input.revisionRequest }),
    Object.freeze({
      path: revisionPaths.revisionComparisonPath,
      payload: input.revisionComparison,
    }),
    Object.freeze({ path: revisionPaths.artifactMetadataPath, payload: input.artifactMetadata }),
    Object.freeze({ path: revisionPaths.reviewSummaryPath, payload: input.reviewSummary }),
    Object.freeze({ path: revisionPaths.acceptanceReportPath, payload: input.acceptanceReport }),
    Object.freeze({ path: revisionPaths.wordpressHandoffPath, payload: input.wordpressHandoff }),
    Object.freeze({
      path: revisionPaths.wordpressPublishResultPath,
      payload: input.wordpressPublishResult,
    }),
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
    await writeFile(revisionPaths.editorialHistoryPath, `${historyLines}\n`, 'utf8');
  }

  return revisionPaths;
}

/** Run the offline PiercingConnect revenue acceptance pipeline and stop before live publish. */
export async function runPiercingConnectPilotAcceptance(
  options: RunPiercingConnectPilotAcceptanceOptions = {},
): Promise<PiercingConnectPilotAcceptanceResult> {
  const config = createPiercingConnectPilotConfig(options.config);
  const mediaEngineRoot = options.mediaEngineRoot ?? resolveMonorepoRoot();
  const published = false as const;
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
    const draftV1 = repairPublicationFormatting(
      normalizePreservingMarkdownWhitespace(await readFile(fixturePath, 'utf8')),
    );

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
      humanNotes: 'Revenue acceptance pilot revision pass.',
      createdAt: fixedCreatedAt,
    });

    const draftV2 = repairPublicationFormatting(
      `${draftV1}\n\n## Affiliate Disclosure\nWe may earn a commission from qualifying purchases. This review remains editorially independent.`,
    );
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

    let humanReviewStatus = reopened.review.status;
    const hasBlockingHighFindings = reanalyzed.report.findings.some(
      (finding) => finding.severity === 'high',
    );

    let handoffReview = reopened;
    if (!hasBlockingHighFindings) {
      handoffReview = loop.submitHumanDecision({
        reviewId: reopened.review.reviewId,
        decision: 'approve-with-notes',
        reviewer: REVIEWER,
        notes: 'Acceptance pilot approval with remaining advisory findings.',
        editorialFindings: reanalyzed.report.findings,
      });
      humanReviewStatus = handoffReview.review.status;
    }

    const handoff = createPublishingHandoff({
      artifact: revised.artifact,
      review: handoffReview,
      target: Object.freeze({
        targetId: 'wordpress',
        platform: 'wordpress',
        supportedFormats: Object.freeze(['markdown', 'plain-text', 'html']),
      }),
      metadata: Object.freeze({
        title: 'NeilMed Piercing Aftercare Fine Mist Review',
        slug: 'neilmed-piercing-aftercare-fine-mist-review',
        excerpt:
          'Educational product review for NeilMed Piercing Aftercare Fine Mist with editorial intelligence findings.',
        publishStatus: 'draft',
      }),
    });

    let wordpressInvoked = false;
    let wordpressDraftStatus: 'ready' | 'blocked' | 'skipped' = handoff.validation.valid
      ? 'ready'
      : 'blocked';
    let wordpressPublishResult: Record<string, unknown> = Object.freeze({
      success: false,
      published: false,
      reason: handoff.validation.valid
        ? 'pending-publish'
        : handoff.validation.errors.map((error) => error.code).join(', '),
    });

    if (handoff.validation.valid) {
      const publisher = new FakePublishingTargetAdapter();
      const publishResult = await publisher.publish(handoff.package);
      wordpressInvoked = true;
      wordpressDraftStatus = publishResult.success ? 'ready' : 'blocked';
      wordpressPublishResult = Object.freeze({
        success: publishResult.success,
        published: false,
        targetId: publishResult.targetId,
        externalId: publishResult.externalId,
        url: publishResult.url,
        message: publishResult.message,
        error: publishResult.error,
      });
    }

    const acceptanceReport = buildPilotAcceptanceReport({
      productId: config.productId,
      report: reanalyzed.report,
      comparison: reanalyzed.comparison,
      humanReviewStatus,
      wordpressDraftStatus,
    });

    const outputs = await writeAcceptanceOutputs({
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
        reviewStatus: humanReviewStatus,
        published,
        wordpressDraftStatus,
      }),
      reviewSummary: Object.freeze({
        reviewId: reopened.review.reviewId,
        activeArtifactId: reopened.review.activeArtifactId,
        revisionCount: reopened.review.revisionCount,
        status: humanReviewStatus,
        approved: humanReviewStatus === 'approved' || humanReviewStatus === 'approved-with-notes',
        published,
        wordpressDraftStatus,
      }),
      editorialHistory: reopened.history,
      acceptanceReport,
      wordpressHandoff: handoff.package,
      wordpressPublishResult,
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
      humanReviewStatus,
      wordpressDraftStatus,
      outputs,
    });
  } catch (error: unknown) {
    if (error instanceof PiercingConnectPilotError) {
      return Object.freeze({
        status: 'failed',
        published,
        wordpressInvoked: false,
        error: { code: error.code, message: error.message },
      });
    }

    return Object.freeze({
      status: 'failed',
      published,
      wordpressInvoked: false,
      error: {
        code: 'pilot-acceptance-failure',
        message: error instanceof Error ? error.message : 'PiercingConnect acceptance pilot failed',
      },
    });
  }
}
