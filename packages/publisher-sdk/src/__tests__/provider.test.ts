/**
 * Provider interface, capabilities, and type-guard tests — Sprint 34.
 */

import { describe, expect, it } from 'vitest';

import type { ProviderMetadata, PublisherCapabilities, PublisherProvider } from '../provider.js';
import { isPublisherProvider } from '../provider.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_CAPS: PublisherCapabilities = {
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

function makeProvider(id = 'test'): PublisherProvider {
  const meta: ProviderMetadata = {
    id,
    name: id,
    version: '1.0.0',
    description: 'A test provider',
    capabilities: FULL_CAPS,
  };
  return {
    name: id,
    getMetadata: () => meta,
    getCapabilities: () => FULL_CAPS,
    publish: async () => ({
      success: true,
      externalId: '1',
      url: 'http://x',
      publishedAt: new Date(),
    }),
    publishMedia: async () => ({
      success: true,
      externalId: '1',
      url: 'http://x',
      publishedAt: new Date(),
    }),
    publishPost: async () => ({
      success: true,
      externalId: '1',
      url: 'http://x',
      publishedAt: new Date(),
    }),
    health: async () => ({ status: 'ok' }),
  };
}

// ---------------------------------------------------------------------------
// isPublisherProvider
// ---------------------------------------------------------------------------

describe('isPublisherProvider', () => {
  it('returns true for a full PublisherProvider', () => {
    expect(isPublisherProvider(makeProvider())).toBe(true);
  });

  it('returns false for null', () => {
    expect(isPublisherProvider(null)).toBe(false);
  });

  it('returns false for a plain Publisher without getMetadata', () => {
    const plain = {
      name: 'plain',
      publish: async () => ({}),
      publishMedia: async () => ({}),
      publishPost: async () => ({}),
      health: async () => ({ status: 'ok' }),
    };
    expect(isPublisherProvider(plain)).toBe(false);
  });

  it('returns false for an object missing health', () => {
    const obj = {
      name: 'test',
      getMetadata: () => ({}),
      getCapabilities: () => ({}),
      publish: async () => ({}),
      publishMedia: async () => ({}),
      publishPost: async () => ({}),
      // health missing
    };
    expect(isPublisherProvider(obj)).toBe(false);
  });

  it('returns false for a non-object', () => {
    expect(isPublisherProvider('string')).toBe(false);
    expect(isPublisherProvider(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Provider metadata
// ---------------------------------------------------------------------------

describe('ProviderMetadata structure', () => {
  it('provider returns correct id from getMetadata', () => {
    const p = makeProvider('ghost');
    expect(p.getMetadata().id).toBe('ghost');
  });

  it('provider returns capabilities from getCapabilities', () => {
    const p = makeProvider();
    const caps = p.getCapabilities();
    expect(caps.mediaUpload).toBe(true);
    expect(caps.postCreation).toBe(true);
  });

  it('metadata.capabilities matches getCapabilities()', () => {
    const p = makeProvider();
    expect(p.getMetadata().capabilities).toEqual(p.getCapabilities());
  });

  it('provider with optional homepageUrl', () => {
    const meta: ProviderMetadata = {
      id: 'ghost',
      name: 'Ghost',
      version: '1.0.0',
      description: 'Ghost CMS publisher',
      capabilities: FULL_CAPS,
      homepageUrl: 'https://ghost.org',
    };
    expect(meta.homepageUrl).toBe('https://ghost.org');
  });

  it('provider without homepageUrl is valid', () => {
    const meta: ProviderMetadata = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      description: 'Test provider',
      capabilities: FULL_CAPS,
    };
    expect(meta.homepageUrl).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Capability flags
// ---------------------------------------------------------------------------

describe('PublisherCapabilities flags', () => {
  it('all-false capabilities are valid', () => {
    const caps: PublisherCapabilities = {
      mediaUpload: false,
      postCreation: false,
      drafts: false,
      tags: false,
      categories: false,
      featuredImages: false,
      scheduling: false,
      update: false,
      delete: false,
    };
    expect(caps.mediaUpload).toBe(false);
  });

  it('all-true capabilities are valid', () => {
    const caps: PublisherCapabilities = {
      mediaUpload: true,
      postCreation: true,
      drafts: true,
      tags: true,
      categories: true,
      featuredImages: true,
      scheduling: true,
      update: true,
      delete: true,
    };
    expect(caps.scheduling).toBe(true);
  });
});
