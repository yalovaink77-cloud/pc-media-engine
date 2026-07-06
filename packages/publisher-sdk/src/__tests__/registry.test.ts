import type { PublisherCapabilities } from '@pcme/publisher-sdk';
import { PublisherRegistry } from '@pcme/publisher-sdk';
import { describe, expect, it } from 'vitest';

const capabilities: PublisherCapabilities = {
  mediaUpload: true,
  postCreation: true,
  drafts: false,
  tags: false,
  categories: false,
  featuredImages: false,
  scheduling: false,
  update: false,
  delete: false,
};

function makeStubProvider(id: string, name: string) {
  const metadata = {
    id,
    name,
    version: '0.1.0',
    description: `${name} stub`,
    capabilities,
  };
  return {
    metadata,
    factory: () =>
      ({
        name,
        getMetadata: () => metadata,
        getCapabilities: () => capabilities,
        publish: async () => ({
          success: true,
          externalId: '1',
          url: 'https://example.com',
          publishedAt: new Date(),
        }),
        publishMedia: async () => ({
          success: true,
          externalId: '1',
          url: 'https://example.com',
          publishedAt: new Date(),
        }),
        publishPost: async () => ({
          success: true,
          externalId: '1',
          url: 'https://example.com',
          publishedAt: new Date(),
        }),
        health: async () => ({ status: 'ok' as const }),
      }) as never,
  };
}

describe('PublisherRegistry', () => {
  it('starts empty', () => {
    const registry = new PublisherRegistry();
    expect(registry.list()).toEqual([]);
    expect(registry.listMetadata()).toEqual([]);
  });

  it('registers and retrieves a provider', () => {
    const registry = new PublisherRegistry();
    const reg = makeStubProvider('alpha', 'Alpha');
    registry.register(reg);
    expect(registry.has('alpha')).toBe(true);
    expect(registry.get('alpha')?.metadata.id).toBe('alpha');
  });

  it('overwrites duplicate registrations', () => {
    const registry = new PublisherRegistry();
    registry.register(makeStubProvider('alpha', 'Alpha v1'));
    registry.register(makeStubProvider('alpha', 'Alpha v2'));
    expect(registry.listMetadata()).toHaveLength(1);
    expect(registry.get('alpha')?.metadata.name).toBe('Alpha v2');
  });

  it('lists all registered providers', () => {
    const registry = new PublisherRegistry();
    registry.register(makeStubProvider('alpha', 'Alpha'));
    registry.register(makeStubProvider('beta', 'Beta'));
    const ids = registry
      .listMetadata()
      .map((m) => m.id)
      .sort();
    expect(ids).toEqual(['alpha', 'beta']);
  });

  it('creates a provider instance via factory', () => {
    const registry = new PublisherRegistry();
    registry.register(makeStubProvider('alpha', 'Alpha'));
    const provider = registry.create('alpha', {});
    expect(provider.getMetadata().id).toBe('alpha');
  });

  it('throws when creating unknown provider', () => {
    const registry = new PublisherRegistry();
    expect(() => registry.create('missing', {})).toThrow(/no provider registered/);
  });

  it('unregisters and clears providers', () => {
    const registry = new PublisherRegistry();
    registry.register(makeStubProvider('alpha', 'Alpha'));
    expect(registry.unregister('alpha')).toBe(true);
    expect(registry.has('alpha')).toBe(false);
    registry.register(makeStubProvider('beta', 'Beta'));
    registry.clear();
    expect(registry.list()).toEqual([]);
  });
});
