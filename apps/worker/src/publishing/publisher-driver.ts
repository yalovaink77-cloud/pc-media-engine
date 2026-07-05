/**
 * Publisher driver selection for the publishing worker.
 *
 * PUBLISHER_DRIVER:
 *   mock      — MockPublisher (default)
 *   wordpress — WordPressMediaPublisher (requires WORDPRESS_* env vars)
 */

import type { WordPressConfig } from '@pcme/plugin-wordpress';
import {
  loadWordPressConfig,
  WordPressConfigError,
  WordPressMediaPublisher,
} from '@pcme/plugin-wordpress';
import type { Publisher } from '@pcme/publishing';
import { MockPublisher } from '@pcme/publishing';

export type PublisherDriver = 'mock' | 'wordpress';

export class PublisherDriverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublisherDriverError';
  }
}

export type CreatePublisherOptions = {
  driver?: PublisherDriver;
  env?: Record<string, string | undefined>;
  /** Test hook — avoids real WordPressMediaPublisher construction. */
  createWordPressPublisher?: (config: WordPressConfig) => Publisher;
};

export function resolvePublisherDriver(
  env: Record<string, string | undefined> = process.env,
): PublisherDriver {
  const raw = (env['PUBLISHER_DRIVER'] ?? 'mock').trim().toLowerCase();
  if (raw === 'mock' || raw === 'wordpress') {
    return raw;
  }
  throw new PublisherDriverError(
    `Invalid PUBLISHER_DRIVER="${raw}". Expected "mock" or "wordpress".`,
  );
}

export function createPublisher(options: CreatePublisherOptions = {}): Publisher {
  const driver = options.driver ?? resolvePublisherDriver(options.env);

  if (driver === 'mock') {
    return new MockPublisher();
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
