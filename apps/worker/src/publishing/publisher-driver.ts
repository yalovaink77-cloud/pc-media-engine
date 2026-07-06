/**
 * Publisher driver selection for the publishing worker.
 *
 * PUBLISHER_DRIVER:
 *   mock      — MockPublisher (default)
 *   wordpress — WordPressMediaPublisher (requires WORDPRESS_* env vars)
 */

import type { GhostConfig } from '@pcme/plugin-ghost';
import { GhostPublisher, loadGhostConfig } from '@pcme/plugin-ghost';
import type { WordPressConfig } from '@pcme/plugin-wordpress';
import {
  loadWordPressConfig,
  WordPressConfigError,
  WordPressMediaPublisher,
} from '@pcme/plugin-wordpress';
import type { Publisher } from '@pcme/publishing';
import { MockPublisher } from '@pcme/publishing';

export type PublisherDriver = 'mock' | 'wordpress' | 'ghost';

export class PublisherDriverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublisherDriverError';
  }
}

export type CreatePublisherOptions = {
  driver?: PublisherDriver;
  env?: Record<string, string | undefined>;
  createWordPressPublisher?: (config: WordPressConfig) => Publisher;
  createGhostPublisher?: (config: GhostConfig) => Publisher;
};

export function resolvePublisherId(
  publisherId: string | undefined,
  env: Record<string, string | undefined> = process.env,
): string {
  return publisherId?.trim() || resolvePublisherDriver(env);
}

export function resolvePublisherDriver(
  env: Record<string, string | undefined> = process.env,
): PublisherDriver {
  const raw = (env['PUBLISHER_DRIVER'] ?? 'mock').trim().toLowerCase();
  if (raw === 'mock' || raw === 'wordpress' || raw === 'ghost') {
    return raw;
  }
  throw new PublisherDriverError(
    `Invalid PUBLISHER_DRIVER="${raw}". Expected "mock", "wordpress", or "ghost".`,
  );
}

function mapRegistryIdToDriver(publisherId: string): PublisherDriver {
  if (publisherId === 'wordpress' || publisherId === 'ghost' || publisherId === 'mock') {
    return publisherId;
  }
  throw new PublisherDriverError(`Unknown publisher id "${publisherId}"`);
}

export function createPublisherForRegistryId(
  publisherId: string,
  options: CreatePublisherOptions = {},
): Publisher {
  const driver = mapRegistryIdToDriver(publisherId);
  return createPublisher({ ...options, driver });
}

export function createPublisher(options: CreatePublisherOptions = {}): Publisher {
  const driver = options.driver ?? resolvePublisherDriver(options.env);

  if (driver === 'mock') {
    return new MockPublisher();
  }

  if (driver === 'ghost') {
    try {
      const config = loadGhostConfig(options.env);
      if (options.createGhostPublisher) {
        return options.createGhostPublisher(config);
      }
      return new GhostPublisher(config);
    } catch (err) {
      throw new PublisherDriverError(
        err instanceof Error ? err.message : 'Ghost publisher configuration invalid',
      );
    }
  }

  try {
    const config = loadWordPressConfig(options.env);
    if (options.createWordPressPublisher) {
      return options.createWordPressPublisher(config);
    }
    return new WordPressMediaPublisher(config);
  } catch (err) {
    if (err instanceof WordPressConfigError) {
      throw new PublisherDriverError(
        'PUBLISHER_DRIVER=wordpress requires WORDPRESS_BASE_URL, WORDPRESS_USERNAME, and WORDPRESS_APP_PASSWORD',
      );
    }
    throw err;
  }
}
