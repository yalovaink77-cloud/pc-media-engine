import { describe, expect, it } from 'vitest';

import { renderProviderConfigPage } from '../renderer.js';
import type { ProviderConfigPageData } from '../types.js';

const pageData: ProviderConfigPageData = {
  providers: [
    {
      id: 'wordpress',
      displayName: 'WordPress',
      enabled: true,
      configured: true,
      configurationStatus: 'complete',
      requiredFields: [
        {
          envVar: 'WORDPRESS_URL',
          description: 'Site URL',
          required: true,
          configured: true,
          value: 'https://wp.test',
        },
        {
          envVar: 'WORDPRESS_APP_PASSWORD',
          description: 'App password',
          required: true,
          configured: true,
          masked: '****abcd',
        },
      ],
      optionalFields: [],
      supportsHotReload: true,
    },
  ],
  details: {
    wordpress: {
      id: 'wordpress',
      displayName: 'WordPress',
      version: '1.0.0',
      description: 'WordPress publisher',
      enabled: true,
      configured: true,
      configurationStatus: 'complete',
      requiredFields: [],
      optionalFields: [],
      supportsHotReload: true,
    },
  },
  fetchedAt: '2026-07-06T12:00:00.000Z',
  errors: [],
};

describe('renderProviderConfigPage', () => {
  it('renders provider configuration section', () => {
    const html = renderProviderConfigPage(pageData);
    expect(html).toContain('provider-config-section');
    expect(html).toContain('provider-config-card-wordpress');
  });

  it('masks secrets in field display', () => {
    const html = renderProviderConfigPage(pageData);
    expect(html).toContain('****abcd');
    expect(html).not.toContain('WORDPRESS_APP_PASSWORD":');
  });

  it('shows edit form when editProviderId set', () => {
    const html = renderProviderConfigPage({ ...pageData, editProviderId: 'wordpress' });
    expect(html).toContain('edit-form-wordpress');
    expect(html).toContain('validate-btn-wordpress');
    expect(html).toContain('save-btn-wordpress');
  });

  it('includes provider config nav link', () => {
    const html = renderProviderConfigPage(pageData);
    expect(html).toContain('href="/provider-config"');
    expect(html).toContain('Provider Config');
  });

  it('shows validation result when provided', () => {
    const html = renderProviderConfigPage({
      ...pageData,
      validationResult: { valid: false, errors: ['Invalid URL'], warnings: [] },
    });
    expect(html).toContain('validation-result');
    expect(html).toContain('Invalid URL');
  });
});
