/**
 * Provider validation helper tests — Sprint 34.
 */

import { describe, expect, it } from 'vitest';

import type { ProviderMetadata, PublisherCapabilities } from '../provider.js';
import { validateProviderMetadata, validatePublisherCapabilities } from '../validation.js';

const VALID_CAPS: PublisherCapabilities = {
  mediaUpload: true,
  postCreation: true,
  drafts: true,
  tags: true,
  categories: true,
  featuredImages: true,
  scheduling: false,
  update: false,
  delete: false,
};

const VALID_META: ProviderMetadata = {
  id: 'wordpress',
  name: 'WordPress',
  version: '1.0.0',
  description: 'WordPress REST API publisher',
  capabilities: VALID_CAPS,
  homepageUrl: 'https://developer.wordpress.org/rest-api/',
};

describe('validatePublisherCapabilities', () => {
  it('returns no errors for valid capabilities', () => {
    const result = validatePublisherCapabilities(VALID_CAPS);
    expect(result.errors).toHaveLength(0);
  });

  it('errors when a capability flag is not boolean', () => {
    const bad = { ...VALID_CAPS, mediaUpload: 'yes' as unknown as boolean };
    const result = validatePublisherCapabilities(bad);
    expect(result.errors.some((e) => e.includes('mediaUpload'))).toBe(true);
  });

  it('warns when provider has no media or post support', () => {
    const caps: PublisherCapabilities = {
      ...VALID_CAPS,
      mediaUpload: false,
      postCreation: false,
    };
    const result = validatePublisherCapabilities(caps);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('validateProviderMetadata', () => {
  it('returns no errors for valid metadata', () => {
    const result = validateProviderMetadata(VALID_META);
    expect(result.errors).toHaveLength(0);
  });

  it('errors when id is missing', () => {
    const result = validateProviderMetadata({ ...VALID_META, id: '' });
    expect(result.errors.some((e) => e.includes('id'))).toBe(true);
  });

  it('errors when id is not lowercase-hyphen format', () => {
    const result = validateProviderMetadata({ ...VALID_META, id: 'WordPress' });
    expect(result.errors.some((e) => e.includes('id'))).toBe(true);
  });

  it('accepts hyphenated ids like dev-to', () => {
    const result = validateProviderMetadata({ ...VALID_META, id: 'dev-to' });
    expect(result.errors).toHaveLength(0);
  });

  it('errors when name is missing', () => {
    const result = validateProviderMetadata({ ...VALID_META, name: '' });
    expect(result.errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('warns when homepageUrl is invalid', () => {
    const result = validateProviderMetadata({ ...VALID_META, homepageUrl: 'not-a-url' });
    expect(result.warnings.some((w) => w.includes('homepageUrl'))).toBe(true);
  });
});
