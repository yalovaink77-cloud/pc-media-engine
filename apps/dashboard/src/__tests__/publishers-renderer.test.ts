import { describe, expect, it } from 'vitest';

import { renderPublishersPage } from '../renderer.js';
import type { PublishersPageData } from '../types.js';

const capabilities = {
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

function makePageData(overrides: Partial<PublishersPageData> = {}): PublishersPageData {
  return {
    publishers: [
      {
        id: 'wordpress',
        displayName: 'WordPress',
        version: '1.0.0',
        enabled: true,
        capabilities,
        supportsHealthCheck: true,
      },
      {
        id: 'ghost',
        displayName: 'Ghost',
        version: '1.0.0',
        enabled: false,
        capabilities: { ...capabilities, categories: false },
        supportsHealthCheck: true,
      },
    ],
    details: {
      wordpress: {
        id: 'wordpress',
        displayName: 'WordPress',
        version: '1.0.0',
        enabled: true,
        capabilities,
        supportsHealthCheck: true,
        description: 'WordPress REST API publisher',
        homepageUrl: 'https://developer.wordpress.org/rest-api/',
        configurationRequirements: [
          { envVar: 'WORDPRESS_URL', required: true, description: 'Site URL' },
          { envVar: 'WORDPRESS_USERNAME', required: true, description: 'Username' },
        ],
      },
      ghost: null,
    },
    fetchedAt: '2024-06-01T12:00:00.000Z',
    errors: [],
    ...overrides,
  };
}

describe('renderPublishersPage', () => {
  it('renders publisher management title', () => {
    const html = renderPublishersPage(makePageData());
    expect(html).toContain('Publisher Management');
    expect(html).toContain('data-testid="publishers-section"');
  });

  it('renders provider cards with status badges', () => {
    const html = renderPublishersPage(makePageData());
    expect(html).toContain('data-testid="publisher-card-wordpress"');
    expect(html).toContain('data-testid="publisher-card-ghost"');
    expect(html).toContain('Enabled');
    expect(html).toContain('Disabled');
  });

  it('renders capability badges', () => {
    const html = renderPublishersPage(makePageData());
    expect(html).toContain('data-testid="caps-wordpress"');
    expect(html).toContain('Media');
    expect(html).toContain('Posts');
  });

  it('renders configuration requirements', () => {
    const html = renderPublishersPage(makePageData());
    expect(html).toContain('data-testid="config-wordpress"');
    expect(html).toContain('WORDPRESS_URL');
    expect(html).toContain('WORDPRESS_USERNAME');
  });

  it('renders health check forms', () => {
    const html = renderPublishersPage(makePageData());
    expect(html).toContain('data-testid="health-form-wordpress"');
    expect(html).toContain('action="/ops/publishers/wordpress/health"');
    expect(html).toContain('Check Health');
  });

  it('shows unavailable detail gracefully', () => {
    const html = renderPublishersPage(makePageData());
    expect(html).toContain('data-testid="detail-unavailable-ghost"');
  });

  it('renders navigation links', () => {
    const html = renderPublishersPage(makePageData());
    expect(html).toContain('data-testid="dashboard-nav"');
    expect(html).toContain('href="/publishers"');
    expect(html).toContain('nav-active');
  });

  it('renders flash banner', () => {
    const html = renderPublishersPage(
      makePageData({ flash: { type: 'ok', message: 'wordpress: Healthy (42ms)' } }),
    );
    expect(html).toContain('data-testid="flash-banner"');
    expect(html).toContain('Healthy');
  });

  it('renders error banner when API unreachable', () => {
    const html = renderPublishersPage(
      makePageData({
        publishers: [],
        details: {},
        errors: ['Could not reach /publishers'],
      }),
    );
    expect(html).toContain('data-testid="error-banner"');
    expect(html).toContain('data-testid="publishers-unavailable"');
  });
});
