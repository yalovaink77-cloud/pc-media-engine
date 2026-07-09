/**
 * Commerce knowledge loader smoke script.
 *
 * Loads brand and product YAML from the sibling piercingconnect-commerce repository
 * and prints summary counts and sample IDs. Offline-only; no AI or WordPress I/O.
 *
 * Run: pnpm commerce:smoke
 */

import { loadCommerceKnowledge } from '../commerce/loader.js';

async function main(): Promise<void> {
  const { repoPath, brands, products } = await loadCommerceKnowledge();

  console.log(`Commerce repository: ${repoPath}`);
  console.log(`Brands loaded: ${brands.length}`);
  console.log(`Products loaded: ${products.length}`);
  console.log(
    `First 5 brand IDs: ${
      brands
        .slice(0, 5)
        .map((b) => b.id)
        .join(', ') || '(none)'
    }`,
  );
  console.log(
    `First 5 product IDs: ${
      products
        .slice(0, 5)
        .map((p) => p.id)
        .join(', ') || '(none)'
    }`,
  );
}

main().catch((error: unknown) => {
  console.error('Commerce knowledge smoke failed:', error);
  process.exit(1);
});
