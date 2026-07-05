import type { Publisher } from '@pcme/publishing';
import { MockPublisher } from '@pcme/publishing';
import { describe, expect, it } from 'vitest';

import {
  createPublisher,
  PublisherDriverError,
  resolvePublisherDriver,
} from '../publishing/publisher-driver.js';

const WP_ENV = {
  PUBLISHER_DRIVER: 'wordpress',
  WORDPRESS_BASE_URL: 'https://example.com',
  WORDPRESS_USERNAME: 'admin',
  WORDPRESS_APP_PASSWORD: 'xxxx yyyy zzzz',
};

describe('resolvePublisherDriver', () => {
  it('defaults to mock when PUBLISHER_DRIVER is unset', () => {
    expect(resolvePublisherDriver({})).toBe('mock');
  });

  it('accepts explicit mock driver', () => {
    expect(resolvePublisherDriver({ PUBLISHER_DRIVER: 'mock' })).toBe('mock');
  });

  it('accepts explicit wordpress driver', () => {
    expect(resolvePublisherDriver({ PUBLISHER_DRIVER: 'wordpress' })).toBe('wordpress');
  });

  it('rejects unknown driver values', () => {
    expect(() => resolvePublisherDriver({ PUBLISHER_DRIVER: 'pinterest' })).toThrow(
      PublisherDriverError,
    );
  });
});

describe('createPublisher', () => {
  it('returns MockPublisher for default driver', () => {
    const publisher = createPublisher({ env: {} });
    expect(publisher).toBeInstanceOf(MockPublisher);
    expect(publisher.name).toBe('MockPublisher');
  });

  it('returns MockPublisher for explicit mock driver', () => {
    const publisher = createPublisher({ driver: 'mock' });
    expect(publisher.name).toBe('MockPublisher');
  });

  it('returns WordPress publisher when driver is wordpress and config is valid', () => {
    const fakePublisher = { name: 'FakeWordPress' } as Publisher;
    const publisher = createPublisher({
      driver: 'wordpress',
      env: WP_ENV,
      createWordPressPublisher: () => fakePublisher,
    });
    expect(publisher).toBe(fakePublisher);
  });

  it('fails fast when wordpress driver is selected but config is missing', () => {
    expect(() =>
      createPublisher({
        driver: 'wordpress',
        env: { PUBLISHER_DRIVER: 'wordpress' },
      }),
    ).toThrow(PublisherDriverError);

    try {
      createPublisher({ driver: 'wordpress', env: {} });
    } catch (err) {
      expect(err).toBeInstanceOf(PublisherDriverError);
      expect((err as Error).message).toContain('WORDPRESS_BASE_URL');
      expect((err as Error).message).toContain('WORDPRESS_USERNAME');
      expect((err as Error).message).toContain('WORDPRESS_APP_PASSWORD');
    }
  });
});
