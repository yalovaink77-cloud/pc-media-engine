import { loadCommerceCollection, loadValidatedCommerceCollection } from './collection-loader.js';
import { resolveCommerceRepositoryPath } from './paths.js';
import type {
  CommerceBrand,
  CommerceKnowledgeLoaderOptions,
  CommerceKnowledgeSnapshot,
  CommerceProduct,
} from './types.js';
import { toCommerceBrand, toCommerceProduct } from './validation.js';

/** Load all brand YAML records from the commerce repository. */
export async function loadCommerceBrands(
  options?: CommerceKnowledgeLoaderOptions,
): Promise<{ repoPath: string; brands: CommerceBrand[] }> {
  const repoPath = await resolveCommerceRepositoryPath(options);
  const brands = await loadValidatedCommerceCollection(
    repoPath,
    ['brands'],
    'brand',
    toCommerceBrand,
    options,
  );
  return { repoPath, brands };
}

/** Load all product YAML records from the commerce repository. */
export async function loadCommerceProducts(
  options?: CommerceKnowledgeLoaderOptions,
): Promise<{ repoPath: string; products: CommerceProduct[] }> {
  const repoPath = await resolveCommerceRepositoryPath(options);
  const products = await loadValidatedCommerceCollection(
    repoPath,
    ['products'],
    'product',
    toCommerceProduct,
    options,
  );
  return { repoPath, products };
}

/** Load brands and products from the commerce repository. Offline-first; no network I/O. */
export async function loadCommerceKnowledge(
  options?: CommerceKnowledgeLoaderOptions,
): Promise<CommerceKnowledgeSnapshot> {
  const repoPath = await resolveCommerceRepositoryPath(options);
  const [brands, products] = await Promise.all([
    loadValidatedCommerceCollection(repoPath, ['brands'], 'brand', toCommerceBrand, options),
    loadValidatedCommerceCollection(repoPath, ['products'], 'product', toCommerceProduct, options),
  ]);

  return { repoPath, brands, products };
}

export { loadCommerceCollection };
