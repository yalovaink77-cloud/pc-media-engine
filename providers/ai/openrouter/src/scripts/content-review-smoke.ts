/**
 * Content review gate smoke script.
 *
 * Uses fake generation provider and generated artifact by default.
 *
 * Run: pnpm content-review:smoke
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
  const review = createContentReviewRequest(artifact);
  const store = new InMemoryContentReviewStore();
  const reviewService = createContentReviewService(store);
  const created = store.create(review);
  const finalResult = reviewService.submitDecision({
    reviewId: review.reviewId,
    decision: 'approve-with-notes',
    reviewer: REVIEWER,
    findings: Object.freeze([
      Object.freeze({
        id: 'smoke-finding-1',
        checkId: 'formatting',
        code: 'minor-formatting',
        message: 'Minor formatting note for smoke test',
        severity: 'low',
      }),
    ]),
  });

  console.log(`review ID: ${review.reviewId}`);
  console.log(`artifact ID: ${artifact.artifactId}`);
  console.log(`initial status: ${created.review.status}`);
  console.log(`final decision: ${finalResult.latestDecision ?? 'unknown'}`);
  console.log(`finding count: ${finalResult.findings.length}`);
  console.log(`reviewer ID: ${finalResult.reviewer?.reviewerId ?? 'unknown'}`);
  console.log(`history event count: ${finalResult.history.length}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Content review smoke failed: ${message}`);
  process.exit(1);
});
