import { loadCommerceKnowledge } from '../../commerce/loader.js';
import type { CommerceKnowledgeLoaderOptions } from '../../commerce/types.js';
import type {
  CommerceKnowledgeAccessors,
  CommerceKnowledgeAdapterOptions,
  KnowledgeService,
  KnowledgeSourceAdapter,
  KnowledgeSourceEntity,
  KnowledgeSourceRelation,
  KnowledgeSourceResult,
} from '../types.js';

const COMMERCE_SOURCE_ID = 'piercingconnect-commerce';
const COMMERCE_SOURCE_TYPE = 'yaml-repository';

function omitIdentityFields(raw: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'id' || key === 'slug' || key === 'name') {
      continue;
    }
    fields[key] = value;
  }
  return fields;
}

function mapBrandEntity(brand: {
  id: string;
  slug: string;
  name: string;
  raw: Record<string, unknown>;
}): KnowledgeSourceEntity {
  const relations: KnowledgeSourceRelation[] = [];
  const products = brand.raw.products;
  if (Array.isArray(products)) {
    for (const productId of products) {
      if (typeof productId === 'string' && productId.trim().length > 0) {
        relations.push({ name: 'products', targetType: 'product', targetId: productId });
      }
    }
  }

  return {
    type: 'brand',
    id: brand.id,
    slug: brand.slug,
    name: brand.name,
    fields: omitIdentityFields(brand.raw),
    relations,
  };
}

function mapProductEntity(product: {
  id: string;
  slug: string;
  name: string;
  raw: Record<string, unknown>;
}): KnowledgeSourceEntity {
  const relations: KnowledgeSourceRelation[] = [];
  const brandId = product.raw.brand;
  if (typeof brandId === 'string' && brandId.trim().length > 0) {
    relations.push({ name: 'brand', targetType: 'brand', targetId: brandId });
  }

  return {
    type: 'product',
    id: product.id,
    slug: product.slug,
    name: product.name,
    fields: omitIdentityFields(product.raw),
    relations,
  };
}

/** Read-only adapter for the PiercingConnect commerce YAML repository. */
export class CommerceKnowledgeSourceAdapter implements KnowledgeSourceAdapter {
  readonly sourceId = COMMERCE_SOURCE_ID;
  readonly sourceType = COMMERCE_SOURCE_TYPE;

  constructor(private readonly options?: CommerceKnowledgeAdapterOptions) {}

  async load(): Promise<KnowledgeSourceResult> {
    const loaderOptions: CommerceKnowledgeLoaderOptions = {
      repoPath: this.options?.repoPath,
      mediaEngineRoot: this.options?.mediaEngineRoot,
      maxYamlFileBytes: this.options?.maxYamlFileBytes,
      maxAliasCount: this.options?.maxAliasCount,
    };

    const { repoPath, brands, products } = await loadCommerceKnowledge(loaderOptions);
    const entities: KnowledgeSourceEntity[] = [
      ...brands.map(mapBrandEntity),
      ...products.map(mapProductEntity),
    ];

    entities.sort((a, b) => {
      const typeOrder = a.type.localeCompare(b.type);
      if (typeOrder !== 0) {
        return typeOrder;
      }
      return a.id.localeCompare(b.id);
    });

    return {
      sourcePath: repoPath,
      entities,
    };
  }
}

/** Commerce-specific lookup helpers built on the generic knowledge service API. */
export function createCommerceKnowledgeAccessors(
  service: KnowledgeService,
): CommerceKnowledgeAccessors {
  return {
    getBrand: (id: string) => service.getEntity('brand', id),
    getProduct: (id: string) => service.getEntity('product', id),
    getProductsByBrand: (brandId: string) =>
      service.getRelatedEntities({ type: 'brand', id: brandId }, 'products'),
  };
}
