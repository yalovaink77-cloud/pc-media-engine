/**
 * Sprint 34 — WordPress provider compatibility with @pcme/publisher-sdk.
 *
 * Verifies:
 *   - WordPressMediaPublisher implements PublisherProvider
 *   - getMetadata() returns correct id and capabilities
 *   - getCapabilities() returns capability flags
 *   - isPublisherProvider() type guard works
 *   - wordPressRegistration is wired correctly
 *   - PublisherRegistry can create a WordPress provider
 */

import { isPublisherProvider, PublisherRegistry } from '@pcme/publisher-sdk';
import { describe, expect, it } from 'vitest';

import type { WordPressConfig } from '../config.js';
import {
  WORDPRESS_CAPABILITIES,
  WORDPRESS_METADATA,
  wordPressRegistration,
} from '../registration.js';
import { WordPressMediaPublisher } from '../wordpress-media.publisher.js';

const VALID_CONFIG: WordPressConfig = {
  baseUrl: 'https://example.com',
  username: 'admin',
  appPassword: 'xxxx yyyy zzzz',
};

// ---------------------------------------------------------------------------
// getMetadata
// ---------------------------------------------------------------------------

describe('WordPressMediaPublisher.getMetadata', () => {
  it('returns id="wordpress"', () => {
    const pub = new WordPressMediaPublisher(VALID_CONFIG);
    expect(pub.getMetadata().id).toBe('wordpress');
  });

  it('returns name="WordPress"', () => {
    const pub = new WordPressMediaPublisher(VALID_CONFIG);
    expect(pub.getMetadata().name).toBe('WordPress');
  });

  it('returns a semantic version string', () => {
    const pub = new WordPressMediaPublisher(VALID_CONFIG);
    expect(pub.getMetadata().version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('metadata includes capabilities', () => {
    const pub = new WordPressMediaPublisher(VALID_CONFIG);
    expect(pub.getMetadata().capabilities).toBeDefined();
  });

  it('metadata includes homepageUrl', () => {
    const pub = new WordPressMediaPublisher(VALID_CONFIG);
    expect(pub.getMetadata().homepageUrl).toContain('wordpress.org');
  });
});

// ---------------------------------------------------------------------------
// getCapabilities
// ---------------------------------------------------------------------------

describe('WordPressMediaPublisher.getCapabilities', () => {
  it('mediaUpload=true', () => {
    const pub = new WordPressMediaPublisher(VALID_CONFIG);
    expect(pub.getCapabilities().mediaUpload).toBe(true);
  });

  it('postCreation=true', () => {
    const pub = new WordPressMediaPublisher(VALID_CONFIG);
    expect(pub.getCapabilities().postCreation).toBe(true);
  });

  it('drafts=true', () => {
    const pub = new WordPressMediaPublisher(VALID_CONFIG);
    expect(pub.getCapabilities().drafts).toBe(true);
  });

  it('scheduling=false (managed by BullMQ, not WP API)', () => {
    const pub = new WordPressMediaPublisher(VALID_CONFIG);
    expect(pub.getCapabilities().scheduling).toBe(false);
  });

  it('getCapabilities() returns same flags as metadata.capabilities', () => {
    const pub = new WordPressMediaPublisher(VALID_CONFIG);
    expect(pub.getCapabilities()).toEqual(pub.getMetadata().capabilities);
  });
});

// ---------------------------------------------------------------------------
// isPublisherProvider type guard
// ---------------------------------------------------------------------------

describe('isPublisherProvider(WordPressMediaPublisher)', () => {
  it('returns true for WordPressMediaPublisher', () => {
    const pub = new WordPressMediaPublisher(VALID_CONFIG);
    expect(isPublisherProvider(pub)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('wordPressRegistration', () => {
  it('has id="wordpress"', () => {
    expect(wordPressRegistration.metadata.id).toBe('wordpress');
  });

  it('factory creates a WordPressMediaPublisher', () => {
    const provider = wordPressRegistration.factory(VALID_CONFIG);
    expect(provider.name).toBe('WordPressMediaPublisher');
  });

  it('WORDPRESS_METADATA and WORDPRESS_CAPABILITIES are exported', () => {
    expect(WORDPRESS_METADATA.id).toBe('wordpress');
    expect(WORDPRESS_CAPABILITIES.mediaUpload).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Registry integration
// ---------------------------------------------------------------------------

describe('PublisherRegistry with WordPress provider', () => {
  it('can register and retrieve wordpress', () => {
    const registry = new PublisherRegistry();
    registry.register(wordPressRegistration);
    expect(registry.has('wordpress')).toBe(true);
  });

  it('can create a WordPress provider via registry', () => {
    const registry = new PublisherRegistry();
    registry.register(wordPressRegistration);
    const provider = registry.create('wordpress', VALID_CONFIG);
    expect(isPublisherProvider(provider)).toBe(true);
    expect(provider.getMetadata().id).toBe('wordpress');
  });

  it('future providers can be registered alongside WordPress', () => {
    const registry = new PublisherRegistry();
    registry.register(wordPressRegistration);
    registry.register({
      metadata: {
        id: 'ghost',
        name: 'Ghost',
        version: '1.0.0',
        description: 'Ghost CMS',
        capabilities: WORDPRESS_CAPABILITIES,
      },
      factory: () => wordPressRegistration.factory(VALID_CONFIG),
    });
    expect(registry.has('ghost')).toBe(true);
    expect(registry.list()).toHaveLength(2);
  });
});
