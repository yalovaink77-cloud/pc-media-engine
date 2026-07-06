/**
 * PublisherRegistry tests — Sprint 34.
 */

import { describe, expect, it } from 'vitest';

import type { ProviderMetadata, PublisherCapabilities, PublisherProvider } from '../provider.js';
import { type ProviderRegistration, PublisherRegistry } from '../registry.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CAPS: PublisherCapabilities = {
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

function makeMeta(id: string): ProviderMetadata {
  return { id, name: id, version: '1.0.0', description: `${id} provider`, capabilities: CAPS };
}

function makeProvider(id: string): PublisherProvider {
  return {
    name: id,
    getMetadata: () => makeMeta(id),
    getCapabilities: () => CAPS,
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

function makeRegistration(id: string): ProviderRegistration {
  return {
    metadata: makeMeta(id),
    factory: () => makeProvider(id),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PublisherRegistry', () => {
  it('starts empty', () => {
    const reg = new PublisherRegistry();
    expect(reg.list()).toHaveLength(0);
  });

  it('register() adds a provider', () => {
    const reg = new PublisherRegistry();
    reg.register(makeRegistration('wordpress'));
    expect(reg.list()).toHaveLength(1);
  });

  it('has() returns true after registration', () => {
    const reg = new PublisherRegistry();
    reg.register(makeRegistration('ghost'));
    expect(reg.has('ghost')).toBe(true);
  });

  it('has() returns false for unregistered id', () => {
    const reg = new PublisherRegistry();
    expect(reg.has('medium')).toBe(false);
  });

  it('get() returns the registration', () => {
    const reg = new PublisherRegistry();
    reg.register(makeRegistration('wordpress'));
    expect(reg.get('wordpress')?.metadata.id).toBe('wordpress');
  });

  it('get() returns undefined for unknown id', () => {
    const reg = new PublisherRegistry();
    expect(reg.get('unknown')).toBeUndefined();
  });

  it('list() returns all registrations', () => {
    const reg = new PublisherRegistry();
    reg.register(makeRegistration('wordpress'));
    reg.register(makeRegistration('ghost'));
    expect(reg.list()).toHaveLength(2);
  });

  it('listMetadata() returns metadata for each provider', () => {
    const reg = new PublisherRegistry();
    reg.register(makeRegistration('wordpress'));
    reg.register(makeRegistration('ghost'));
    const ids = reg.listMetadata().map((m) => m.id);
    expect(ids).toContain('wordpress');
    expect(ids).toContain('ghost');
  });

  it('register() overwrites existing registration with same id', () => {
    const reg = new PublisherRegistry();
    reg.register(makeRegistration('wordpress'));
    const updated = makeRegistration('wordpress');
    updated.metadata.version = '2.0.0';
    reg.register(updated);
    expect(reg.list()).toHaveLength(1);
    expect(reg.get('wordpress')?.metadata.version).toBe('2.0.0');
  });

  it('create() returns a PublisherProvider', () => {
    const reg = new PublisherRegistry();
    reg.register(makeRegistration('wordpress'));
    const provider = reg.create('wordpress', {});
    expect(typeof provider.publish).toBe('function');
    expect(typeof provider.getMetadata).toBe('function');
  });

  it('create() throws for unregistered id', () => {
    const reg = new PublisherRegistry();
    expect(() => reg.create('unknown', {})).toThrow('no provider registered');
  });

  it('create() error message lists registered ids', () => {
    const reg = new PublisherRegistry();
    reg.register(makeRegistration('wordpress'));
    reg.register(makeRegistration('ghost'));
    let message = '';
    try {
      reg.create('medium', {});
    } catch (e) {
      message = String(e);
    }
    expect(message).toContain('wordpress');
    expect(message).toContain('ghost');
  });

  it('unregister() removes a provider', () => {
    const reg = new PublisherRegistry();
    reg.register(makeRegistration('wordpress'));
    const removed = reg.unregister('wordpress');
    expect(removed).toBe(true);
    expect(reg.has('wordpress')).toBe(false);
  });

  it('unregister() returns false for unknown id', () => {
    const reg = new PublisherRegistry();
    expect(reg.unregister('ghost')).toBe(false);
  });

  it('clear() removes all registrations', () => {
    const reg = new PublisherRegistry();
    reg.register(makeRegistration('wordpress'));
    reg.register(makeRegistration('ghost'));
    reg.clear();
    expect(reg.list()).toHaveLength(0);
  });

  it('factory receives the config object', () => {
    const reg = new PublisherRegistry();
    let receivedConfig: unknown;
    const registration: ProviderRegistration<{ apiKey: string }> = {
      metadata: makeMeta('test'),
      factory: (cfg) => {
        receivedConfig = cfg;
        return makeProvider('test');
      },
    };
    reg.register(registration);
    reg.create('test', { apiKey: 'abc' });
    expect(receivedConfig).toEqual({ apiKey: 'abc' });
  });
});
