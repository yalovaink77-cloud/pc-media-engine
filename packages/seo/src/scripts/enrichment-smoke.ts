/**
 * Metadata enrichment smoke — Sprint 19.
 *
 * Runs one sample input through MetadataEnrichmentService.
 * No network, no database, no AI.
 *
 * Run:
 *   pnpm --filter @pcme/seo smoke
 */

import { enrichMetadata } from '../enrichment/metadata-enrichment.service.js';
import type { MetadataEnrichmentInput } from '../types.js';

function ok(msg: string): void {
  process.stdout.write(`  ✓ ${msg}\n`);
}

function line(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

line('\n═══ Sprint 19 Metadata Enrichment Smoke ═══\n');

const input: MetadataEnrichmentInput = {
  title: 'Navel Piercing Aftercare: Complete Guide',
  slug: 'Navel Piercing Aftercare',
  body: `<p>Proper aftercare is essential for healing. Clean twice daily with sterile saline.
Avoid swimming pools for the first few weeks. Watch for signs of infection.</p>`,
  tags: ['aftercare', 'navel', 'piercing'],
  categories: ['Care Guides', 'Body Piercing'],
  image: { width: 1200, height: 1600, mimeType: 'image/jpeg' },
};

line('▶ Input');
ok(`title = ${input.title}`);
ok(`slug  = ${input.slug}`);

const result = enrichMetadata(input);

line('\n▶ Enriched publish metadata');
ok(`slug               = ${result.slug}`);
ok(`seoTitle           = ${result.seoTitle}`);
ok(`excerpt            = ${result.excerpt.slice(0, 60)}…`);
ok(`metaDescription    = ${result.metaDescription.slice(0, 60)}…`);
ok(`readingTimeMinutes = ${result.readingTimeMinutes}`);
ok(`tags               = [${result.tags.join(', ')}]`);
ok(`categories         = [${result.categories.join(', ')}]`);

if (!result.image) {
  process.stderr.write('\n✗ SMOKE FAILED: expected image metadata\n');
  process.exit(1);
}

ok(`image.orientation  = ${result.image.orientation}`);
ok(`image.altText      = ${result.image.altText}`);

if (result.image.orientation !== 'portrait') {
  process.stderr.write(`\n✗ SMOKE FAILED: expected portrait, got ${result.image.orientation}\n`);
  process.exit(1);
}

line(`
╔══════════════════════════════════════════════════════════════════╗
║  ✅  Metadata Enrichment Smoke PASSED — Sprint 19              ║
╚══════════════════════════════════════════════════════════════════╝
Deterministic | No AI | No network
`);

process.exit(0);
