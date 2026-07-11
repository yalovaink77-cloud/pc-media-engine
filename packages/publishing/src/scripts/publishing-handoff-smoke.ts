/**
 * Publishing handoff smoke script.
 *
 * fake provider → artifact → approved review → handoff → fake publisher
 *
 * Run: pnpm publishing-handoff:smoke
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

import { createPublishingHandoff, FakePublishingTargetAdapter } from '../handoff/index.js';

const PRODUCT_ID = 'neilmed-piercing-aftercare-fine-mist';
const REVIEWER = Object.freeze({ reviewerId: 'smoke-reviewer', displayName: 'Smoke Reviewer' });

async function main(): Promise<void> {
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
      targetId: 'fake',
      platform: 'fake-platform',
      supportedFormats: Object.freeze(['markdown', 'plain-text']),
    }),
    metadata: Object.freeze({
      title: 'NeilMed Piercing Aftercare Review',
      slug: 'neilmed-piercing-aftercare-review',
      excerpt: 'Smoke test publishing handoff.',
      publishStatus: 'draft',
    }),
  });

  const publisher = new FakePublishingTargetAdapter();
  const publishResult = await publisher.publish(handoff.package);

  console.log(`handoff ID: ${handoff.package.handoffId}`);
  console.log(`status: ${handoff.package.status}`);
  console.log(`target: ${handoff.package.target.targetId}`);
  console.log(`content type: ${handoff.package.contentType}`);
  console.log(`publish result status: ${publishResult.success ? 'succeeded' : 'failed'}`);
  console.log(`warning count: ${handoff.package.warnings.length}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Publishing handoff smoke failed: ${message}`);
  process.exit(1);
});
