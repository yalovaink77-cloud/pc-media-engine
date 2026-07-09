import { describe, expect, it } from 'vitest';

import { toCommerceBrand, toCommerceProduct, validateCommerceRecord } from '../validation.js';

describe('validateCommerceRecord', () => {
  it('accepts records with required identity fields', () => {
    const result = validateCommerceRecord(
      { id: 'neilmed', slug: 'neilmed', name: 'NeilMed' },
      'brand',
    );
    expect(result.errors).toHaveLength(0);
  });

  it('requires id, slug, and name', () => {
    const result = validateCommerceRecord({ id: 'x' }, 'product');
    expect(result.errors).toEqual(expect.arrayContaining(['slug is required', 'name is required']));
  });

  it('rejects non-mapping documents', () => {
    const result = validateCommerceRecord(['not-a-map'], 'brand');
    expect(result.errors).toContain('brand must be a YAML mapping');
  });
});

describe('toCommerceBrand', () => {
  it('maps identity fields and preserves raw document', () => {
    const raw = { id: 'neilmed', slug: 'neilmed', name: 'NeilMed', website: 'https://x.test' };
    const brand = toCommerceBrand(raw);
    expect(brand).toEqual({
      id: 'neilmed',
      slug: 'neilmed',
      name: 'NeilMed',
      raw,
    });
  });
});

describe('toCommerceProduct', () => {
  it('maps identity fields and preserves raw document', () => {
    const raw = {
      id: 'sample-product',
      slug: 'sample-product',
      name: 'Sample Product',
      brand: 'neilmed',
    };
    const product = toCommerceProduct(raw);
    expect(product.id).toBe('sample-product');
    expect(product.raw).toBe(raw);
  });
});
