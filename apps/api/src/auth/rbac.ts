import type { AuthConfig } from './config.js';
import type { AuthContext } from './middleware.js';
import {
  ALL_PERMISSIONS,
  isRole,
  type Permission,
  permissionsForRole,
  type Role,
  ROLE_METADATA,
  roleHasPermission,
  type RoleMetadata,
} from './permissions.js';

export type RbacMetadata = {
  roles: RoleMetadata[];
  permissions: Permission[];
};

export function getRbacMetadata(): RbacMetadata {
  return {
    roles: ROLE_METADATA,
    permissions: [...ALL_PERMISSIONS],
  };
}

export function resolveJwtRole(claims: Record<string, unknown>, defaultRole: Role): Role {
  const raw = claims['role'];
  return isRole(raw) ? raw : defaultRole;
}

export function resolveApiKeyRole(apiKey: string, config: AuthConfig): Role {
  if (config.apiKeyRoles[apiKey]) return config.apiKeyRoles[apiKey];
  return config.defaultApiKeyRole;
}

export function enrichAuthContext(
  auth: AuthContext,
  config: AuthConfig,
  matchedApiKey?: string,
): AuthContext {
  if (auth.type === 'jwt') {
    const role = resolveJwtRole(auth.claims, config.defaultJwtRole);
    return { ...auth, role, permissions: [...permissionsForRole(role)] };
  }
  const role = matchedApiKey ? resolveApiKeyRole(matchedApiKey, config) : config.defaultApiKeyRole;
  return { ...auth, role, permissions: [...permissionsForRole(role)] };
}

export function hasPermission(auth: AuthContext | undefined, permission: Permission): boolean {
  if (!auth) return false;
  return roleHasPermission(auth.role, permission);
}
