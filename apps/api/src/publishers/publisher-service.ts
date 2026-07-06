import {
  ghostRegistration,
  isConfigComplete as isGhostConfigComplete,
  loadGhostConfig,
} from '@pcme/plugin-ghost';
import {
  isConfigComplete as isWordPressConfigComplete,
  loadWordPressConfig,
  wordPressRegistration,
} from '@pcme/plugin-wordpress';
import { PublisherRegistry } from '@pcme/publisher-sdk';

import { PUBLISHER_CONFIG_REQUIREMENTS } from './config-requirements.js';
import type {
  PublisherDetail,
  PublisherHealthResponse,
  PublisherListItem,
  PublisherManagementService,
} from './types.js';

export type CreatePublisherServiceOptions = {
  registry?: PublisherRegistry;
  env?: Record<string, string | undefined>;
};

function buildDefaultRegistry(): PublisherRegistry {
  const registry = new PublisherRegistry();
  registry.register(wordPressRegistration);
  registry.register(ghostRegistration);
  return registry;
}

function isProviderEnabled(id: string, env: Record<string, string | undefined>): boolean {
  try {
    if (id === 'wordpress') {
      const config = loadWordPressConfig(env);
      return isWordPressConfigComplete(config);
    }
    if (id === 'ghost') {
      const config = loadGhostConfig(env);
      return isGhostConfigComplete(config);
    }
    return false;
  } catch {
    return false;
  }
}

function tryLoadProviderConfig(
  id: string,
  env: Record<string, string | undefined>,
): unknown | null {
  try {
    if (id === 'wordpress') return loadWordPressConfig(env);
    if (id === 'ghost') return loadGhostConfig(env);
    return null;
  } catch {
    return null;
  }
}

export function createPublisherService(
  options: CreatePublisherServiceOptions = {},
): PublisherManagementService {
  const registry = options.registry ?? buildDefaultRegistry();
  const env = options.env ?? process.env;

  return {
    listPublishers(): PublisherListItem[] {
      return registry.listMetadata().map((metadata) => ({
        id: metadata.id,
        displayName: metadata.name,
        version: metadata.version,
        enabled: isProviderEnabled(metadata.id, env),
        capabilities: metadata.capabilities,
        supportsHealthCheck: true,
      }));
    },

    getPublisher(id: string): PublisherDetail | null {
      const registration = registry.get(id);
      if (!registration) return null;

      const { metadata } = registration;
      return {
        id: metadata.id,
        displayName: metadata.name,
        version: metadata.version,
        description: metadata.description,
        homepageUrl: metadata.homepageUrl,
        enabled: isProviderEnabled(metadata.id, env),
        capabilities: metadata.capabilities,
        supportsHealthCheck: true,
        configurationRequirements: PUBLISHER_CONFIG_REQUIREMENTS[metadata.id] ?? [],
      };
    },

    async checkHealth(id: string): Promise<PublisherHealthResponse> {
      const registration = registry.get(id);
      if (!registration) {
        return {
          healthy: false,
          latency: 0,
          message: `Publisher "${id}" is not registered`,
        };
      }

      const config = tryLoadProviderConfig(id, env);
      if (!config) {
        return {
          healthy: false,
          latency: 0,
          message: 'Provider is disabled — required configuration is missing',
        };
      }

      const start = Date.now();
      try {
        const provider = registry.create(id, config);
        const result = await provider.health();
        const latency = Date.now() - start;
        const healthy = result.status === 'ok' || result.status === 'degraded';
        return {
          healthy,
          latency,
          message: result.message ?? result.status,
        };
      } catch (err) {
        return {
          healthy: false,
          latency: Date.now() - start,
          message: err instanceof Error ? err.message : 'Health check failed',
        };
      }
    },
  };
}
