/**
 * Authentication configuration — Sprint 31.
 *
 * Loaded from environment variables at API startup.
 * Auth is disabled by default to preserve backward compatibility.
 *
 * Environment variables:
 *   PCME_AUTH_ENABLED     "true" to enable the auth layer (default: false)
 *   PCME_JWT_SECRET       HMAC-SHA256 secret (required when JWT is enabled)
 *   PCME_JWT_EXPIRES_IN   token lifetime in seconds (default: 3600)
 *   PCME_API_KEYS         comma-separated raw API keys (enables API-key auth)
 *   PCME_API_KEY_ROLES    comma-separated key:role pairs (Sprint 45 RBAC)
 *   PCME_DEFAULT_JWT_ROLE default JWT role when claim missing (default: operator)
 *   PCME_DEFAULT_API_KEY_ROLE default API key role (default: admin)
 */

import type { Role } from './permissions.js';
import { isRole } from './permissions.js';

export type AuthConfig = {
  /** Master switch — false means all requests pass through unverified. */
  enabled: boolean;
  /** Whether JWT bearer token validation is active. */
  jwtEnabled: boolean;
  /** HMAC-SHA256 secret used to sign and verify JWTs. */
  jwtSecret: string;
  /** Lifetime of a newly issued JWT in seconds. Default: 3600. */
  jwtExpiresInSeconds: number;
  /** Whether API-key header validation is active. */
  apiKeyEnabled: boolean;
  /**
   * Set of raw API keys accepted by the key middleware.
   * In production these should be long random strings; in tests use short values.
   * Future: replace with DB-backed hashed keys (Sprint 32+).
   */
  apiKeys: string[];
  /** Maps raw API key → role (from PCME_API_KEY_ROLES). */
  apiKeyRoles: Record<string, Role>;
  /** Role used when JWT has no role claim. Default: operator. */
  defaultJwtRole: Role;
  /** Role used when API key has no explicit mapping. Default: admin. */
  defaultApiKeyRole: Role;
};

export type AuthConfigValidation = {
  errors: string[];
  warnings: string[];
};

export type AuthConfigValidationOptions = {
  /** When true, disabled or incomplete auth is treated as a fatal startup error. */
  readonly production?: boolean;
};

function parseApiKeyRoles(raw: string | undefined): Record<string, Role> {
  const map: Record<string, Role> = {};
  if (!raw) return map;
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(':');
    if (colon <= 0) continue;
    const key = trimmed.slice(0, colon).trim();
    const roleRaw = trimmed.slice(colon + 1).trim();
    if (key && isRole(roleRaw)) map[key] = roleRaw;
  }
  return map;
}

function parseDefaultRole(raw: string | undefined, fallback: Role): Role {
  return raw && isRole(raw) ? raw : fallback;
}

export function loadAuthConfig(): AuthConfig {
  const enabled = process.env['PCME_AUTH_ENABLED'] === 'true';
  const rawKeys = process.env['PCME_API_KEYS'];
  const apiKeys = rawKeys
    ? rawKeys
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
    : [];

  return {
    enabled,
    jwtSecret: process.env['PCME_JWT_SECRET'] ?? '',
    jwtExpiresInSeconds: parseInt(process.env['PCME_JWT_EXPIRES_IN'] ?? '3600', 10),
    jwtEnabled: enabled && !!process.env['PCME_JWT_SECRET'],
    apiKeyEnabled: enabled && apiKeys.length > 0,
    apiKeys,
    apiKeyRoles: parseApiKeyRoles(process.env['PCME_API_KEY_ROLES']),
    defaultJwtRole: parseDefaultRole(process.env['PCME_DEFAULT_JWT_ROLE'], 'operator'),
    defaultApiKeyRole: parseDefaultRole(process.env['PCME_DEFAULT_API_KEY_ROLE'], 'admin'),
  };
}

export function validateAuthConfig(
  config: AuthConfig,
  options?: AuthConfigValidationOptions,
): AuthConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const production = options?.production === true;

  if (!config.enabled) {
    if (production) {
      errors.push('Authentication must be enabled in production (set PCME_AUTH_ENABLED=true)');
    } else {
      warnings.push(
        'Auth is disabled (PCME_AUTH_ENABLED != true) — all requests are unauthenticated',
      );
    }
    return { errors, warnings };
  }

  if (!config.jwtSecret && !config.apiKeyEnabled) {
    errors.push(
      'Auth is enabled but neither PCME_JWT_SECRET nor PCME_API_KEYS is set — no auth method available',
    );
  }

  if (config.jwtSecret && config.jwtSecret.length < 32) {
    warnings.push(
      'PCME_JWT_SECRET is shorter than 32 characters — use a longer secret in production',
    );
  }

  if (!config.jwtSecret) {
    warnings.push('PCME_JWT_SECRET is not set — JWT auth is disabled');
  }

  if (!config.apiKeyEnabled) {
    warnings.push('PCME_API_KEYS is not set — API key auth is disabled');
  }

  if (!Number.isInteger(config.jwtExpiresInSeconds) || config.jwtExpiresInSeconds < 1) {
    errors.push(
      `PCME_JWT_EXPIRES_IN must be a positive integer (got: ${config.jwtExpiresInSeconds})`,
    );
  }

  return { errors, warnings };
}
