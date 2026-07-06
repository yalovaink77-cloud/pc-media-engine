import type { ConfigRequirement } from './types.js';

export const PUBLISHER_CONFIG_REQUIREMENTS: Record<string, ConfigRequirement[]> = {
  wordpress: [
    {
      envVar: 'WORDPRESS_URL',
      required: true,
      description: 'WordPress site URL (WORDPRESS_BASE_URL is also accepted)',
    },
    {
      envVar: 'WORDPRESS_USERNAME',
      required: true,
      description: 'WordPress username for REST API authentication',
    },
    {
      envVar: 'WORDPRESS_APP_PASSWORD',
      required: true,
      description: 'WordPress Application Password (not the login password)',
    },
    {
      envVar: 'WORDPRESS_REQUEST_TIMEOUT_MS',
      required: false,
      description: 'Per-request timeout in milliseconds (default: 30000)',
    },
  ],
  ghost: [
    {
      envVar: 'GHOST_URL',
      required: true,
      description: 'Ghost site URL (e.g. https://blog.example.com)',
    },
    {
      envVar: 'GHOST_ADMIN_API_KEY',
      required: true,
      description: 'Admin API key from Ghost Integrations ({id}:{secret})',
    },
    {
      envVar: 'GHOST_REQUEST_TIMEOUT_MS',
      required: false,
      description: 'Per-request timeout in milliseconds (default: 30000)',
    },
  ],
};
