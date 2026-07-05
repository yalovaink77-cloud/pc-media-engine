/**
 * AI metadata enrichment smoke — Sprint 20.
 *
 * Uses MockAiMetadataProvider only. No network, no API key.
 *
 * Run:
 *   pnpm --filter @pcme/ai smoke
 */

import { enrichMetadata } from '@pcme/seo';

import { AiMetadataEnrichmentService } from '../ai-metadata-enrichment.service.js';
import { MockAiMetadataProvider } from '../providers/mock.provider.js';
import { NoneAiMetadataProvider } from '../providers/none.provider.js';
import type { AiMetadataRequest } from '../types.js';

function ok(msg: string): void {
  process.stdout.write(`  ✓ ${msg}\n`);
}

const input: AiMetadataRequest = {
  title: 'Navel Piercing Aftercare Guide',
  body: '<p>Clean twice daily. Avoid submerging in water.</p>',
  tags: ['aftercare', 'navel'],
  image: { width: 1200, height: 1600 },
};

process.stdout.write('\n═══ Sprint 20 AI Metadata Enrichment Smoke ═══\n\n');

process.stdout.write('▶ Step 1 — none provider (deterministic unchanged)\n');
const noneService = new AiMetadataEnrichmentService(new NoneAiMetadataProvider());
const noneResult = await noneService.enrich(input);
const baseline = enrichMetadata(input);
if (noneResult.metadata.slug !== baseline.slug) process.exit(1);
ok(`deterministic slug preserved: ${noneResult.metadata.slug}`);
ok(`aiApplied = ${noneResult.aiApplied}`);

process.stdout.write('\n▶ Step 2 — mock provider (deterministic AI enrichment)\n');
const mockService = new AiMetadataEnrichmentService(new MockAiMetadataProvider());
const mockResult = await mockService.enrich(input);
if (!mockResult.aiApplied) process.exit(1);
ok(`seoTitle = ${mockResult.metadata.seoTitle}`);
ok(`tags = [${mockResult.metadata.tags.join(', ')}]`);
ok(`image.altText = ${mockResult.metadata.image?.altText ?? '(none)'}`);

process.stdout.write(`
╔══════════════════════════════════════════════════════════════════╗
║  ✅  AI Metadata Smoke PASSED — Sprint 20 (mock only)           ║
╚══════════════════════════════════════════════════════════════════╝
Provider: mock | No network | No API key
`);

process.exit(0);
