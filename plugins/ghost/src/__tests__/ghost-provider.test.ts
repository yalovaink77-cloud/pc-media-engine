/**
 * Ghost provider SDK compatibility tests — Sprint 35.
 */

import { isPublisherProvider, PublisherRegistry } from '@pcme/publisher-sdk';
import { describe, expect, it } from 'vitest';

import type { GhostConfig } from '../config.js';
import { GhostPublisher } from '../ghost.publisher.js';
import { GHOST_CAPABILITIES, GHOST_METADATA, ghostRegistration } from '../registration.js';

const VALID_CONFIG: GhostConfig = {
  baseUrl: 'https://ghost.example.com',
  adminApiKey:
    '633c86459f984d202ff980e9e1:8d3c5e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e',
};

describe('GhostPublisher.getMetadata', () => {
  it('returns id="ghost"', () => {
    const pub = new GhostPublisher(VALID_CONFIG);
    expect(pub.getMetadata().id).toBe('ghost');
  });

  it('returns name="Ghost"', () => {
    const pub = new GhostPublisher(VALID_CONFIG);
    expect(pub.getMetadata().name).toBe('Ghost');
  });
});

describe('GhostPublisher.getCapabilities', () => {
  it('drafts=true', () => {
    expect(new GhostPublisher(VALID_CONFIG).getCapabilities().drafts).toBe(true);
  });

  it('tags=true', () => {
    expect(new GhostPublisher(VALID_CONFIG).getCapabilities().tags).toBe(true);
  });

  it('featuredImages=true', () => {
    expect(new GhostPublisher(VALID_CONFIG).getCapabilities().featuredImages).toBe(true);
  });

  it('categories=false', () => {
    expect(new GhostPublisher(VALID_CONFIG).getCapabilities().categories).toBe(false);
  });

  it('matches metadata.capabilities', () => {
    const pub = new GhostPublisher(VALID_CONFIG);
    expect(pub.getCapabilities()).toEqual(pub.getMetadata().capabilities);
  });
});

describe('isPublisherProvider(GhostPublisher)', () => {
  it('returns true', () => {
    expect(isPublisherProvider(new GhostPublisher(VALID_CONFIG))).toBe(true);
  });
});

describe('ghostRegistration', () => {
  it('has id="ghost"', () => {
    expect(ghostRegistration.metadata.id).toBe('ghost');
  });

  it('factory creates GhostPublisher', () => {
    const provider = ghostRegistration.factory(VALID_CONFIG);
    expect(provider.name).toBe('GhostPublisher');
  });

  it('exports GHOST_METADATA and GHOST_CAPABILITIES', () => {
    expect(GHOST_METADATA.id).toBe('ghost');
    expect(GHOST_CAPABILITIES.drafts).toBe(true);
  });
});

describe('PublisherRegistry with Ghost provider', () => {
  it('registers and creates ghost provider', () => {
    const registry = new PublisherRegistry();
    registry.register(ghostRegistration);
    expect(registry.has('ghost')).toBe(true);

    const provider = registry.create('ghost', VALID_CONFIG);
    expect(isPublisherProvider(provider)).toBe(true);
    expect(provider.getMetadata().id).toBe('ghost');
  });

  it('registers alongside WordPress without conflict', () => {
    const registry = new PublisherRegistry();
    registry.register(ghostRegistration);
    registry.register({
      metadata: {
        id: 'wordpress',
        name: 'WordPress',
        version: '1.0.0',
        description: 'WP',
        capabilities: GHOST_CAPABILITIES,
      },
      factory: () => ghostRegistration.factory(VALID_CONFIG),
    });
    expect(registry.list()).toHaveLength(2);
    expect(registry.has('ghost')).toBe(true);
    expect(registry.has('wordpress')).toBe(true);
  });
});
