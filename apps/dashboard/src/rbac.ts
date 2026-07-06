/**
 * Dashboard RBAC helpers — Sprint 45.
 * Mirrors API permission registry for UI adaptation.
 */

export type Role = 'admin' | 'operator' | 'publisher' | 'viewer';

export type Permission =
  | 'dashboard:read'
  | 'metrics:read'
  | 'jobs:read'
  | 'assets:read'
  | 'publishers:read'
  | 'calendar:read'
  | 'composer:read'
  | 'composer:write'
  | 'publishing:write'
  | 'scheduling:write'
  | 'queue:read'
  | 'queue:write'
  | 'providers:read'
  | 'providers:write'
  | 'media:write';

const ROLE_PERMISSIONS: Record<Role, readonly Permission[] | '*'> = {
  admin: '*',
  operator: [
    'dashboard:read',
    'metrics:read',
    'jobs:read',
    'assets:read',
    'calendar:read',
    'composer:read',
    'composer:write',
    'scheduling:write',
    'queue:read',
    'queue:write',
    'providers:read',
    'media:write',
  ],
  publisher: [
    'dashboard:read',
    'metrics:read',
    'jobs:read',
    'assets:read',
    'publishers:read',
    'composer:read',
    'composer:write',
    'publishing:write',
  ],
  viewer: ['dashboard:read', 'metrics:read', 'jobs:read', 'assets:read', 'publishers:read'],
};

export type DashboardRbac = {
  enabled: boolean;
  role: Role;
  can(permission: Permission): boolean;
};

function roleHasPermission(role: Role, permission: Permission): boolean {
  const grants = ROLE_PERMISSIONS[role];
  if (grants === '*') return true;
  return grants.includes(permission);
}

export function createDashboardRbac(role: Role, enabled = true): DashboardRbac {
  return {
    enabled,
    role,
    can(permission: Permission) {
      if (!enabled) return true;
      return roleHasPermission(role, permission);
    },
  };
}

export function loadDashboardRbac(): DashboardRbac {
  const enabled = process.env['DASHBOARD_RBAC_ENABLED'] === 'true';
  const rawRole = process.env['DASHBOARD_ROLE'] ?? 'admin';
  const role: Role =
    rawRole === 'operator' || rawRole === 'publisher' || rawRole === 'viewer' || rawRole === 'admin'
      ? rawRole
      : 'admin';

  return {
    enabled,
    role,
    can(permission: Permission) {
      if (!enabled) return true;
      return roleHasPermission(role, permission);
    },
  };
}

export function permissionDeniedMessage(permission: Permission): string {
  return `Permission denied — requires ${permission}`;
}
