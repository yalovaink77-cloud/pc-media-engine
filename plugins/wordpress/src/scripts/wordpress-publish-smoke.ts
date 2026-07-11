/**
 * WordPress publishing handoff smoke script.
 *
 * Without WordPress credentials: exits safely with a skip message.
 * With credentials: publishes one reviewed artifact as draft only.
 *
 * Run: pnpm wordpress-publish:smoke
 */

import {
  createContentReviewRequest,
  createContentReviewService,
  createGeneratedContentArtifact,
  createGenerationJob,
  FakeGenerationProvider,
  InMemoryContentReviewStore,
  runGenerationJob,
} from '@pcme/ai';
import { createCommerceContentOrchestrator } from '@pcme/content';
import { createPublishingHandoff } from '@pcme/publishing';

import { WordPressConfigError } from '../config.js';
import {
  hasWordPressHandoffCredentials,
  loadWordPressHandoffAdapterConfig,
} from '../handoff-config.js';
import { WordPressPublishingTargetAdapter } from '../wordpress-publishing-target.adapter.js';

const PRODUCT_ID = 'neilmed-piercing-aftercare-fine-mist';
const REVIEWER = Object.freeze({ reviewerId: 'smoke-reviewer', displayName: 'Smoke Reviewer' });

async function main(): Promise<void> {
  if (!hasWordPressHandoffCredentials(process.env as Record<string, string>)) {
    console.log(
      'WordPress credentials are not set. Skipping wordpress-publish smoke (WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD).',
    );
    return;
  }

  try {
    loadWordPressHandoffAdapterConfig(process.env as Record<string, string>);
  } catch (error: unknown) {
    if (error instanceof WordPressConfigError) {
      console.log(error.message);
      return;
    }
    throw error;
  }

  const orchestrator = await createCommerceContentOrchestrator();
  const plan = await orchestrator.prepare({
    root: { type: 'product', id: PRODUCT_ID },
    contextRecipe: 'product-review',
    contentType: 'product-review',
    locale: 'en',
    tone: 'educational',
    outputFormat: 'markdown',
    strict: false,
  });

  const job = createGenerationJob(plan);
  const provider = new FakeGenerationProvider({
    generatedContent:
      '# Product review\n\nConsult a professional if unsure about aftercare choices.',
  });
  const generation = await runGenerationJob(job, provider);

  if (!generation.response) {
    console.error('Generation did not return a provider response.');
    process.exit(1);
  }

  const { artifact } = createGeneratedContentArtifact(job, generation.response);
  const reviewRequest = createContentReviewRequest(artifact);
  const reviewStore = new InMemoryContentReviewStore();
  const reviewService = createContentReviewService(reviewStore);
  reviewStore.create(reviewRequest);
  const reviewResult = reviewService.submitDecision({
    reviewId: reviewRequest.reviewId,
    decision: 'approve',
    reviewer: REVIEWER,
  });

  const handoff = createPublishingHandoff({
    artifact,
    review: reviewResult,
    target: Object.freeze({
      targetId: 'wordpress',
      platform: 'wordpress',
      supportedFormats: Object.freeze(['markdown', 'plain-text', 'html']),
    }),
    metadata: Object.freeze({
      title: 'NeilMed Piercing Aftercare Review',
      slug: 'neilmed-piercing-aftercare-review',
      excerpt: 'Smoke test WordPress draft publish.',
      publishStatus: 'draft',
    }),
  });

  const adapter = new WordPressPublishingTargetAdapter(
    loadWordPressHandoffAdapterConfig(process.env as Record<string, string>),
    { forceDraft: true },
  );
  const publishResult = await adapter.publish(handoff.package);

  console.log(`target: ${adapter.targetId}`);
  console.log(`handoff ID: ${handoff.package.handoffId}`);
  console.log(`requested status: draft`);
  console.log(`result status: ${publishResult.success ? 'succeeded' : 'failed'}`);
  console.log(`remote content ID: ${publishResult.externalId ?? 'none'}`);
  console.log(`remote URL: ${publishResult.url ?? 'none'}`);
  console.log(`warning count: ${handoff.package.warnings.length}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WordPress publish smoke failed: ${message}`);
  process.exit(1);
});
