/**
 * Generation artifact smoke script.
 *
 * Uses the fake provider by default. Set GENERATION_ARTIFACT_USE_OPENROUTER=true
 * and OPENROUTER_API_KEY to opt into a live OpenRouter generation call.
 *
 * Run: pnpm generation-artifact:smoke
 */

import {
  createGeneratedContentArtifact,
  createGenerationJob,
  FakeGenerationProvider,
  runGenerationJob,
} from '@pcme/ai';
import { createCommerceContentOrchestrator } from '@pcme/content';

import { createOpenRouterGenerationProvider } from '../openrouter-generation.provider.js';
import {
  hasOpenRouterGenerationApiKey,
  loadOpenRouterGenerationConfig,
  OpenRouterGenerationConfigError,
} from '../openrouter-generation-config.js';

const PRODUCT_ID = 'neilmed-piercing-aftercare-fine-mist';

async function resolveProvider() {
  if (
    process.env['GENERATION_ARTIFACT_USE_OPENROUTER'] === 'true' &&
    hasOpenRouterGenerationApiKey(process.env as Record<string, string>)
  ) {
    return createOpenRouterGenerationProvider(process.env as Record<string, string>);
  }

  return new FakeGenerationProvider({
    generatedContent: '# Product review\n\nSample generated review content for smoke testing.',
  });
}

async function main(): Promise<void> {
  if (process.env['GENERATION_ARTIFACT_USE_OPENROUTER'] === 'true') {
    try {
      loadOpenRouterGenerationConfig(process.env as Record<string, string>);
    } catch (error: unknown) {
      if (error instanceof OpenRouterGenerationConfigError) {
        console.log('OPENROUTER_API_KEY is not set. Falling back to fake provider.');
      } else {
        throw error;
      }
    }
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
  const provider = await resolveProvider();
  const result = await runGenerationJob(job, provider);

  if (!result.response) {
    console.error('Generation did not return a provider response.');
    process.exit(1);
  }

  const artifactResult = createGeneratedContentArtifact(job, result.response);
  const artifact = artifactResult.artifact;

  console.log(`artifact ID: ${artifact.artifactId}`);
  console.log(`status: ${artifact.status}`);
  console.log(`content type: ${artifact.contentType}`);
  console.log(`format: ${artifact.format}`);
  console.log(`content character count: ${artifact.content.length}`);
  console.log(`warning count: ${artifact.warnings.length}`);
  console.log(`provider: ${artifact.providerId}`);
  console.log(`model: ${artifact.model ?? 'unknown'}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Generation artifact smoke failed: ${message}`);
  process.exit(1);
});
