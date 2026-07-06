export { compareApiKeyToHash, compareRawApiKeys, generateApiKey, hashApiKey } from './api-key.js';
export type { AuthConfig, AuthConfigValidation } from './config.js';
export { loadAuthConfig, validateAuthConfig } from './config.js';
export type { JwtClaims, JwtPayload, JwtVerifyResult } from './jwt.js';
export { signJwt, verifyJwt } from './jwt.js';
export type { AuthContext, AuthMiddleware } from './middleware.js';
export { createAuthMiddleware } from './middleware.js';
export { hashPassword, verifyPassword } from './password.js';
export type { Permission, Role, RoleMetadata } from './permissions.js';
export {
  ALL_PERMISSIONS,
  isRole,
  permissionsForRole,
  ROLE_METADATA,
  ROLE_PERMISSIONS,
  roleHasPermission,
} from './permissions.js';
export { getRbacMetadata, hasPermission, resolveApiKeyRole, resolveJwtRole } from './rbac.js';
