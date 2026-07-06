/**
 * WordPress provider registration for @pcme/publisher-sdk registry — Sprint 34.
 *
 * Usage:
 *
 *   import { PublisherRegistry } from '@pcme/publisher-sdk';
 *   import { wordPressRegistration } from '@pcme/plugin-wordpress';
 *
 *   const registry = new PublisherRegistry();
 *   registry.register(wordPressRegistration);
 *
 *   const config = loadWordPressConfig();
 *   const provider = registry.create('wordpress', config);
 */

import type {
  ProviderMetadata,
  ProviderRegistration,
  PublisherCapabilities,
} from '@pcme/publisher-sdk';

import type { WordPressConfig } from './config.js';
import { WordPressMediaPublisher } from './wordpress-media.publisher.js';

// ---------------------------------------------------------------------------
// Static metadata
// ---------------------------------------------------------------------------

export const WORDPRESS_CAPABILITIES: PublisherCapabilities = {
  mediaUpload: true,
  postCreation: true,
  drafts: true,
  tags: true,
  categories: true,
  featuredImages: true,
  scheduling: false, // WordPress API does not natively schedule via BullMQ
  update: false, // Not implemented yet
  delete: false, // Not implemented yet
};

export const WORDPRESS_METADATA: ProviderMetadata = {
  id: 'wordpress',
  name: 'WordPress',
  version: '1.0.0',
  description: 'Publish media and draft posts to a WordPress site via the REST API.',
  capabilities: WORDPRESS_CAPABILITIES,
  homepageUrl: 'https://developer.wordpress.org/rest-api/',
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const wordPressRegistration: ProviderRegistration<WordPressConfig> = {
  metadata: WORDPRESS_METADATA,
  factory: (config) => new WordPressMediaPublisher(config),
};
