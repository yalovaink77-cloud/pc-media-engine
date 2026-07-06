import { describe, expect, it } from 'vitest';

import {
  permissionsForRole,
  ROLE_METADATA,
  ROLE_PERMISSIONS,
  roleHasPermission,
} from '../auth/permissions.js';

describe('ROLE_PERMISSIONS', () => {
  it('admin has wildcard access', () => {
    expect(ROLE_PERMISSIONS.admin).toBe('*');
    expect(roleHasPermission('admin', 'providers:write')).toBe(true);
  });

  it('operator can manage queue but not publish', () => {
    expect(roleHasPermission('operator', 'queue:write')).toBe(true);
    expect(roleHasPermission('operator', 'publishing:write')).toBe(false);
  });

  it('publisher can publish but not manage queue', () => {
    expect(roleHasPermission('publisher', 'publishing:write')).toBe(true);
    expect(roleHasPermission('publisher', 'queue:write')).toBe(false);
    expect(roleHasPermission('publisher', 'publishers:read')).toBe(true);
  });

  it('viewer is read-only', () => {
    expect(roleHasPermission('viewer', 'jobs:read')).toBe(true);
    expect(roleHasPermission('viewer', 'composer:write')).toBe(false);
    expect(roleHasPermission('viewer', 'calendar:read')).toBe(false);
  });

  it('exposes four built-in roles', () => {
    expect(ROLE_METADATA).toHaveLength(4);
    expect(permissionsForRole('viewer').has('assets:read')).toBe(true);
  });
});
