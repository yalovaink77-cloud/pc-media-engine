/**
 * OpenRouter generation provider smoke — MANUAL ONLY, not for CI.
 *
 * Run: pnpm generation-provider:smoke
 */

import { createGenerationJob, runGenerationJob } from '@pcme/ai';
import { createCommerceContentOrchestrator } from '@pcme/content';

import { createOpenRouterGenerationProvider } from '../openrouter-generation.provider.js';
import {
  hasOpenRouterGenerationApiKey,
  loadOpenRouterGenerationConfig,
  OpenRouterGenerationConfigError,
} from '../openrouter-generation-config.js';

const PRODUCT_ID = 'neilmed-piercing-aftercare-fine-mist';

async function main(): Promise<void> {
  if (!hasOpenRouterGenerationApiKey(process.env as Record<string, string>)) {
    console.log('OPENROUTER_API_KEY is not set. Skipping generation provider smoke.');
    return;
  }

  try {
    loadOpenRouterGenerationConfig(process.env as Record<string, string>);
  } catch (error: unknown) {
    if (error instanceof OpenRouterGenerationConfigError) {
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
  const provider = createOpenRouterGenerationProvider(process.env as Record<string, string>);
  const result = await runGenerationJob(job, provider);
  const response = result.response;

  console.log(`provider: ${result.providerId ?? provider.providerId}`);
  console.log(`model: ${response?.model ?? 'unknown'}`);
  console.log(`status: ${result.status}`);
  console.log(`output characters: ${response?.content?.length ?? 0}`);
  console.log(`input tokens: ${response?.usage?.inputTokens ?? 0}`);
  console.log(`output tokens: ${response?.usage?.outputTokens ?? 0}`);
  console.log(`finish reason: ${response?.finishReason ?? 'unknown'}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Generation provider smoke failed: ${message}`);
  process.exit(1);
});
