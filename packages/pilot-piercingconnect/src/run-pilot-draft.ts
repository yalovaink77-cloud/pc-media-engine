import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import {
  createContentReviewRequest,
  createGeneratedContentArtifact,
  createGenerationJob,
  type GenerationProviderAdapter,
  InMemoryContentReviewStore,
  runGenerationJob,
} from '@pcme/ai';
import { createCommerceContentOrchestrator } from '@pcme/content';
import {
  createOpenRouterGenerationProvider,
  hasOpenRouterGenerationApiKey,
} from '@pcme/provider-ai-openrouter';

import {
  createPiercingConnectPilotConfig,
  type PiercingConnectPilotConfig,
  resolveMonorepoRoot,
  resolvePilotCommerceRepoPath,
  resolvePilotOutputDir,
} from './config.js';
import { PiercingConnectPilotError } from './errors.js';
import { preparePublicationDraft } from './evidence-attribution.js';
import {
  ABSOLUTE_PATH_PATTERN,
  buildArtifactMetadata,
  buildReviewSummary,
  type PilotArtifactMetadata,
  type PilotOutputPaths,
  type PilotReviewSummary,
  scrubSensitiveText,
  writePilotOutputs,
} from './outputs.js';
import { analyzePilotDraftQuality, type PilotQualityFinding } from './quality.js';
import { findMissingRequiredSections } from './section-markers.js';
import { createPilotStructuredGenerationProvider } from './structured-provider.js';

export type PiercingConnectPilotStatus =
  'succeeded-pending-review' | 'skipped' | 'blocked' | 'failed';

export interface PiercingConnectPilotResult {
  readonly status: PiercingConnectPilotStatus;
  readonly productId: string;
  readonly contentType: string;
  readonly reviewStatus?: 'pending-review';
  readonly published: false;
  readonly wordpressInvoked: false;
  readonly skipReason?: string;
  readonly error?: { readonly code: string; readonly message: string };
  readonly sourceId?: string;
  readonly snapshotId?: string;
  readonly jobId?: string;
  readonly artifactId?: string;
  readonly reviewId?: string;
  readonly warningCount?: number;
  readonly missingSections?: readonly string[];
  readonly findings?: readonly PilotQualityFinding[];
  readonly outputs?: PilotOutputPaths;
  readonly artifactMetadata?: PilotArtifactMetadata;
  readonly reviewSummary?: PilotReviewSummary;
  readonly commerceRepoFingerprint?: string;
}

export interface RunPiercingConnectPilotDraftOptions {
  readonly config?: Partial<PiercingConnectPilotConfig>;
  readonly mediaEngineRoot?: string;
  readonly repoPath?: string;
  readonly outputDir?: string;
  readonly env?: Record<string, string | undefined>;
  readonly generationProvider?: GenerationProviderAdapter;
  readonly fixedCreatedAt?: string;
  readonly fetchFn?: typeof fetch;
}

async function fingerprintCommerceRepo(repoPath: string, productId: string): Promise<string> {
  const productFile = join(repoPath, 'data', 'products', `${productId}.yaml`);
  const [fileStat, contents] = await Promise.all([
    stat(productFile),
    readFile(productFile, 'utf8'),
  ]);
  return createHash('sha256')
    .update(
      JSON.stringify({
        size: fileStat.size,
        mtimeMs: fileStat.mtimeMs,
        digest: createHash('sha256').update(contents).digest('hex'),
      }),
    )
    .digest('hex');
}

function buildOpenRouterEnv(
  env: Record<string, string | undefined>,
  config: PiercingConnectPilotConfig,
): Record<string, string | undefined> {
  return {
    ...env,
    OPENROUTER_MAX_OUTPUT_TOKENS:
      env['OPENROUTER_MAX_OUTPUT_TOKENS'] ?? String(config.defaultMaxOutputTokens),
  };
}

/** Run the PiercingConnect first-draft pilot and stop before publishing handoff. */
export async function runPiercingConnectPilotDraft(
  options: RunPiercingConnectPilotDraftOptions = {},
): Promise<PiercingConnectPilotResult> {
  const config = createPiercingConnectPilotConfig(options.config);
  const mediaEngineRoot = options.mediaEngineRoot ?? resolveMonorepoRoot();
  const env = options.env ?? process.env;
  const published = false as const;
  const wordpressInvoked = false as const;

  if (!options.generationProvider && !hasOpenRouterGenerationApiKey(env)) {
    return Object.freeze({
      status: 'skipped',
      productId: config.productId,
      contentType: config.contentType,
      published,
      wordpressInvoked,
      skipReason: 'OPENROUTER_API_KEY is not set',
    });
  }

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

  let commerceRepoFingerprint: string | undefined;
  try {
    commerceRepoFingerprint = await fingerprintCommerceRepo(repoPath, config.productId);
  } catch {
    commerceRepoFingerprint = undefined;
  }

  try {
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

    if (plan.status === 'blocked') {
      return Object.freeze({
        status: 'blocked',
        productId: config.productId,
        contentType: config.contentType,
        published,
        wordpressInvoked,
        sourceId: plan.sourceReference.sourceId,
        snapshotId: plan.snapshot.snapshotId,
        warningCount: plan.warnings.length,
        commerceRepoFingerprint,
        error: {
          code: 'context-blocked',
          message: plan.blockReason ?? 'Content generation plan is blocked',
        },
      });
    }

    const job = createGenerationJob(plan);
    const innerProvider =
      options.generationProvider ??
      createOpenRouterGenerationProvider(buildOpenRouterEnv(env, config), {
        fetchFn: options.fetchFn,
      });
    const provider = createPilotStructuredGenerationProvider(innerProvider, config);

    const generation = await runGenerationJob(job, provider);
    if (generation.status !== 'succeeded' || !generation.response) {
      throw new PiercingConnectPilotError(
        'provider-failure',
        generation.error?.message ?? 'Generation provider failed',
      );
    }

    // Preserve provider whitespace exactly (no dictionary repair). Only scrub unsafe metadata.
    const scrubOptions = { additionalRoots: [repoPath] as const };
    const normalizedContent = preparePublicationDraft(generation.response.content ?? '');
    const providerResponse = Object.freeze({
      ...generation.response,
      content: scrubSensitiveText(normalizedContent, mediaEngineRoot, scrubOptions),
      model: generation.response.model
        ? scrubSensitiveText(generation.response.model, mediaEngineRoot, scrubOptions)
        : generation.response.model,
      warnings: Object.freeze(
        (generation.response.warnings ?? []).map((warning) =>
          scrubSensitiveText(warning, mediaEngineRoot, scrubOptions),
        ),
      ),
    });

    const { artifact } = createGeneratedContentArtifact(job, providerResponse, {
      createdAt: options.fixedCreatedAt,
      validation: {
        absolutePathPatterns: Object.freeze([ABSOLUTE_PATH_PATTERN]),
      },
    });

    if (artifact.status === 'invalid' || artifact.status === 'rejected') {
      throw new PiercingConnectPilotError(
        'artifact-invalid',
        `Generated artifact status ${artifact.status} is not acceptable for review`,
      );
    }

    const missingSections = findMissingRequiredSections(artifact.content, config.requiredSections);
    const findings = analyzePilotDraftQuality(artifact.content, config);

    const review = createContentReviewRequest(artifact, {
      createdAt: options.fixedCreatedAt,
    });
    // Persist pending-review only — never submit a decision or publish.
    const reviewStore = new InMemoryContentReviewStore();
    reviewStore.create(review);

    if (review.status !== 'pending-review') {
      throw new PiercingConnectPilotError(
        'review-status',
        `Expected pending-review but received ${review.status}`,
      );
    }

    const artifactMetadata = buildArtifactMetadata({
      artifact,
      productId: config.productId,
      mediaEngineRoot,
      additionalRoots: [repoPath],
    });
    const reviewSummary = buildReviewSummary({
      review,
      mediaEngineRoot,
      additionalRoots: [repoPath],
      findings,
    });
    const outputs = await writePilotOutputs({
      outputDir,
      markdown: artifact.content,
      artifactMetadata,
      reviewSummary,
      mediaEngineRoot,
      additionalRoots: [repoPath],
    });

    let postFingerprint = commerceRepoFingerprint;
    try {
      postFingerprint = await fingerprintCommerceRepo(repoPath, config.productId);
    } catch {
      postFingerprint = commerceRepoFingerprint;
    }

    if (commerceRepoFingerprint && postFingerprint && commerceRepoFingerprint !== postFingerprint) {
      throw new PiercingConnectPilotError(
        'commerce-mutated',
        'Commerce repository changed during the pilot run',
      );
    }

    return Object.freeze({
      status: 'succeeded-pending-review',
      productId: config.productId,
      contentType: config.contentType,
      reviewStatus: 'pending-review',
      published,
      wordpressInvoked,
      sourceId: plan.sourceReference.sourceId,
      snapshotId: plan.snapshot.snapshotId,
      jobId: job.jobId,
      artifactId: artifact.artifactId,
      reviewId: review.reviewId,
      warningCount: reviewSummary.warningCount,
      missingSections: Object.freeze(missingSections),
      findings,
      outputs,
      artifactMetadata,
      reviewSummary,
      commerceRepoFingerprint: postFingerprint,
    });
  } catch (error: unknown) {
    if (error instanceof PiercingConnectPilotError) {
      return Object.freeze({
        status: 'failed',
        productId: config.productId,
        contentType: config.contentType,
        published,
        wordpressInvoked,
        commerceRepoFingerprint,
        error: { code: error.code, message: error.message },
      });
    }

    return Object.freeze({
      status: 'failed',
      productId: config.productId,
      contentType: config.contentType,
      published,
      wordpressInvoked,
      commerceRepoFingerprint,
      error: {
        code: 'pilot-failure',
        message: error instanceof Error ? error.message : 'PiercingConnect pilot failed',
      },
    });
  }
}
