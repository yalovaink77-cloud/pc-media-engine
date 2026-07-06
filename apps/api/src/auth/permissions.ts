/**
 * RBAC permission registry — Sprint 45.
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

export const ALL_PERMISSIONS: readonly Permission[] = [
  'dashboard:read',
  'metrics:read',
  'jobs:read',
  'assets:read',
  'publishers:read',
  'calendar:read',
  'composer:read',
  'composer:write',
  'publishing:write',
  'scheduling:write',
  'queue:read',
  'queue:write',
  'providers:read',
  'providers:write',
  'media:write',
] as const;

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[] | '*'> = {
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

export type RoleMetadata = {
  id: Role;
  displayName: string;
  description: string;
};

export const ROLE_METADATA: RoleMetadata[] = [
  {
    id: 'admin',
    displayName: 'Admin',
    description: 'Full access to all API and dashboard operations',
  },
  {
    id: 'operator',
    displayName: 'Operator',
    description: 'Queue operations, composer, scheduling, assets, and jobs',
  },
  {
    id: 'publisher',
    displayName: 'Publisher',
    description: 'Publishing, composer, and publisher management',
  },
  {
    id: 'viewer',
    displayName: 'Viewer',
    description: 'Read-only dashboard, jobs, assets, and publishers',
  },
];

export function isRole(value: unknown): value is Role {
  return value === 'admin' || value === 'operator' || value === 'publisher' || value === 'viewer';
}

export function permissionsForRole(role: Role): Set<Permission> {
  const grants = ROLE_PERMISSIONS[role];
  if (grants === '*') return new Set(ALL_PERMISSIONS);
  return new Set(grants);
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  const grants = ROLE_PERMISSIONS[role];
  if (grants === '*') return true;
  return grants.includes(permission);
}
