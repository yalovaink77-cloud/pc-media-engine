/**
 * OpenRouter manual smoke — MANUAL ONLY, not for CI.
 *
 * Requires OPENROUTER_API_KEY in environment.
 *
 * Run:
 *   pnpm --filter @pcme/provider-ai-openrouter smoke
 */

import { AiMetadataEnrichmentService } from '@pcme/ai';

import {
  createOpenRouterAiMetadataProvider,
  loadOpenRouterConfig,
  OpenRouterConfigError,
} from '../openrouter-ai-metadata.provider.js';

process.stdout.write('\n═══ OpenRouter AI Metadata Smoke (MANUAL) ═══\n\n');
process.stdout.write('⚠️  Requires OPENROUTER_API_KEY. Not for CI.\n\n');

try {
  loadOpenRouterConfig(process.env as Record<string, string>);
} catch (err) {
  if (err instanceof OpenRouterConfigError) {
    process.stderr.write(`✗ ${err.message}\n`);
    process.exit(1);
  }
  throw err;
}

const service = new AiMetadataEnrichmentService(
  createOpenRouterAiMetadataProvider(process.env as Record<string, string>),
);

const result = await service.enrich({
  title: 'PCME OpenRouter Smoke Test',
  body: '<p>This is a manual smoke test from PC Media Engine Sprint 20.</p>',
  tags: ['smoke'],
});

process.stdout.write(`  ✓ provider = ${result.provider}\n`);
process.stdout.write(`  ✓ aiApplied = ${result.aiApplied}\n`);
process.stdout.write(`  ✓ seoTitle = ${result.metadata.seoTitle}\n`);
process.stdout.write(`  ✓ metaDescription = ${result.metadata.metaDescription.slice(0, 80)}…\n`);
process.stdout.write('\n✅ OpenRouter manual smoke completed\n');
process.exit(0);
