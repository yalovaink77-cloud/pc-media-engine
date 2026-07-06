/**
 * Factory type tests — Sprint 34.
 */

import { describe, expect, it } from 'vitest';

import type { PublisherFactory } from '../factory.js';
import type { PublisherProvider } from '../provider.js';

describe('PublisherFactory', () => {
  it('accepts a config object and returns a PublisherProvider', () => {
    const factory: PublisherFactory<{ apiKey: string }> = (_config) => ({
      name: 'test',
      getMetadata: () => ({
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test provider',
        capabilities: {
          mediaUpload: false,
          postCreation: true,
          drafts: true,
          tags: false,
          categories: false,
          featuredImages: false,
          scheduling: false,
          update: false,
          delete: false,
        },
      }),
      getCapabilities: () => ({
        mediaUpload: false,
        postCreation: true,
        drafts: true,
        tags: false,
        categories: false,
        featuredImages: false,
        scheduling: false,
        update: false,
        delete: false,
      }),
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
    });

    const provider: PublisherProvider = factory({ apiKey: 'secret' });
    expect(provider.getMetadata().id).toBe('test');
  });

  it('factory with unknown config type works', () => {
    const factory: PublisherFactory = () => ({
      name: 'generic',
      getMetadata: () => ({
        id: 'generic',
        name: 'Generic',
        version: '0.1.0',
        description: 'Generic provider',
        capabilities: {
          mediaUpload: true,
          postCreation: true,
          drafts: false,
          tags: false,
          categories: false,
          featuredImages: false,
          scheduling: false,
          update: false,
          delete: false,
        },
      }),
      getCapabilities: () => ({
        mediaUpload: true,
        postCreation: true,
        drafts: false,
        tags: false,
        categories: false,
        featuredImages: false,
        scheduling: false,
        update: false,
        delete: false,
      }),
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
    });

    expect(factory(undefined).name).toBe('generic');
  });
});
