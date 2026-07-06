import { describe, expect, it } from 'vitest';

import { createDashboardRbac } from '../rbac.js';
import { renderDashboardPage, setDashboardRbacContext } from '../renderer.js';

const health = {
  status: 'ok' as const,
  database: 'ok' as const,
  publishing: {
    publisherDriver: 'mock',
    queueEnabled: false,
    retryConfig: { maxRetries: 3, backoffMs: 5000 },
  },
  version: '0.0.0-test',
  env: 'test',
};

describe('dashboard RBAC', () => {
  it('hides queue operations for viewer', () => {
    setDashboardRbacContext(createDashboardRbac('viewer', true));
    const html = renderDashboardPage({
      health,
      summary: null,
      recent: null,
      metrics: null,
      queueStatus: null,
      fetchedAt: 'now',
      errors: [],
      apiKeyConfigured: false,
    });
    expect(html).toContain('queue-ops-denied');
    expect(html).not.toContain('form-pause');
  });

  it('shows queue operations for operator', () => {
    setDashboardRbacContext(createDashboardRbac('operator', true));
    const html = renderDashboardPage({
      health,
      summary: null,
      recent: null,
      metrics: null,
      queueStatus: null,
      fetchedAt: 'now',
      errors: [],
      apiKeyConfigured: false,
    });
    expect(html).toContain('form-pause');
  });

  it('shows all nav links when RBAC disabled', () => {
    setDashboardRbacContext(createDashboardRbac('viewer', false));
    const html = renderDashboardPage({
      health,
      summary: null,
      recent: null,
      metrics: null,
      queueStatus: null,
      fetchedAt: 'now',
      errors: [],
      apiKeyConfigured: false,
    });
    expect(html).toContain('href="/composer"');
    expect(html).toContain('form-pause');
  });
});
