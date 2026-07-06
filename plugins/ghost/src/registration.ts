/**
 * Ghost provider registration for @pcme/publisher-sdk — Sprint 35.
 */

import type {
  ProviderMetadata,
  ProviderRegistration,
  PublisherCapabilities,
} from '@pcme/publisher-sdk';

import type { GhostConfig } from './config.js';
import { GhostPublisher } from './ghost.publisher.js';

export const GHOST_CAPABILITIES: PublisherCapabilities = {
  mediaUpload: true,
  postCreation: true,
  drafts: true,
  tags: true,
  categories: false,
  featuredImages: true,
  scheduling: false,
  update: false,
  delete: false,
};

export const GHOST_METADATA: ProviderMetadata = {
  id: 'ghost',
  name: 'Ghost',
  version: '1.0.0',
  description: 'Publish HTML draft posts and feature images to a Ghost site via the Admin API.',
  capabilities: GHOST_CAPABILITIES,
  homepageUrl: 'https://ghost.org/docs/admin-api/',
};

export const ghostRegistration: ProviderRegistration<GhostConfig> = {
  metadata: GHOST_METADATA,
  factory: (config) => new GhostPublisher(config),
};
