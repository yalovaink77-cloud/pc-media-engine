/**
 * Prompt payload smoke script.
 *
 * Builds a product-review prompt payload for a NeilMed product.
 *
 * Run: pnpm prompt:smoke
 */

import { CommerceKnowledgeSourceAdapter } from '../knowledge/adapters/commerce-adapter.js';
import { formatKnowledgeServiceError } from '../knowledge/errors.js';
import { createKnowledgeService } from '../knowledge/service.js';
import { buildCommercePromptPayload } from '../prompt/index.js';

const PRODUCT_ID = 'neilmed-piercing-aftercare-fine-mist';

async function main(): Promise<void> {
  const service = await createKnowledgeService({
    adapter: new CommerceKnowledgeSourceAdapter(),
  });

  const context = await service.buildContext({
    root: { type: 'product', id: PRODUCT_ID },
    recipe: 'product-review',
  });

  const payload = buildCommercePromptPayload({
    context,
    contentType: 'product-review',
    locale: 'en',
    tone: 'educational',
    outputFormat: 'markdown',
  });

  console.log(`Content type: ${payload.contentType}`);
  console.log(`System instruction count: ${payload.systemInstructions.length}`);
  console.log(`User section count: ${payload.userSections.length}`);
  console.log(`Constraint count: ${payload.constraints.length}`);
  console.log(`Entity count: ${payload.metadata.entityCount}`);
  console.log(`Warning count: ${payload.warnings.length}`);
  console.log(`Estimated input characters: ${payload.metadata.estimatedInputCharacters}`);
}

main().catch((error: unknown) => {
  console.error(`Prompt payload smoke failed: ${formatKnowledgeServiceError(error)}`);
  process.exit(1);
});
