/**
 * Ghost plugin configuration — Sprint 35.
 *
 * Environment variables:
 *   GHOST_URL                    — Ghost site URL (e.g. https://blog.example.com)
 *   GHOST_ADMIN_API_KEY          — Admin API key from Integrations ({id}:{secret})
 *   GHOST_REQUEST_TIMEOUT_MS     — per-request timeout (default: 30000)
 */

export type GhostConfig = {
  /** Full site URL. Trailing slash stripped. */
  baseUrl: string;
  /** Ghost Admin API key in `{id}:{secret}` format. */
  adminApiKey: string;
  /** Per-request timeout in ms. Default: 30 000. */
  requestTimeoutMs?: number;
};

export class GhostConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GhostConfigError';
  }
}

export function isValidGhostUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Return true when the key looks like `{id}:{hex-secret}`. */
export function isValidGhostAdminApiKey(apiKey: string): boolean {
  const colonIdx = apiKey.indexOf(':');
  if (colonIdx <= 0) return false;
  const secretHex = apiKey.slice(colonIdx + 1).trim();
  return /^[0-9a-fA-F]+$/.test(secretHex) && secretHex.length >= 8;
}

export function loadGhostConfig(
  env: Record<string, string | undefined> = process.env,
): GhostConfig {
  const rawUrl = (env['GHOST_URL'] ?? '').trim();
  const adminApiKey = (env['GHOST_ADMIN_API_KEY'] ?? '').trim();
  const timeoutRaw = env['GHOST_REQUEST_TIMEOUT_MS'];

  const missing: string[] = [];
  if (!rawUrl) missing.push('GHOST_URL');
  if (!adminApiKey) missing.push('GHOST_ADMIN_API_KEY');

  if (missing.length > 0) {
    throw new GhostConfigError(`Missing required Ghost configuration: ${missing.join(', ')}`);
  }

  if (!isValidGhostUrl(rawUrl)) {
    throw new GhostConfigError(
      `GHOST_URL "${rawUrl}" is not a valid URL — must start with http:// or https://`,
    );
  }

  if (!isValidGhostAdminApiKey(adminApiKey)) {
    throw new GhostConfigError(
      'GHOST_ADMIN_API_KEY must be in the format "{id}:{hex-secret}" from Ghost Integrations',
    );
  }

  const requestTimeoutMs = timeoutRaw ? parseInt(timeoutRaw, 10) : 30_000;
  if (Number.isNaN(requestTimeoutMs) || requestTimeoutMs < 1) {
    throw new GhostConfigError(
      `GHOST_REQUEST_TIMEOUT_MS must be a positive integer (got: ${timeoutRaw})`,
    );
  }

  return {
    baseUrl: rawUrl.replace(/\/+$/, ''),
    adminApiKey,
    requestTimeoutMs,
  };
}

export function isConfigComplete(config: GhostConfig): boolean {
  return Boolean(config.baseUrl && config.adminApiKey);
}

export type GhostConfigValidation = {
  errors: string[];
  warnings: string[];
};

export function validateGhostConfigStrict(config: GhostConfig): GhostConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.baseUrl) {
    errors.push('baseUrl is required');
  } else if (!isValidGhostUrl(config.baseUrl)) {
    errors.push(`baseUrl "${config.baseUrl}" is not a valid URL`);
  } else if (!isHttpsUrl(config.baseUrl)) {
    warnings.push('baseUrl uses HTTP instead of HTTPS — API keys will be sent in plaintext');
  }

  if (!config.adminApiKey) {
    errors.push('adminApiKey is required');
  } else if (!isValidGhostAdminApiKey(config.adminApiKey)) {
    errors.push('adminApiKey must be in "{id}:{hex-secret}" format');
  }

  const timeout = config.requestTimeoutMs ?? 30_000;
  if (timeout < 5_000) {
    warnings.push(`requestTimeoutMs (${timeout}ms) is very low for image uploads`);
  }

  return { errors, warnings };
}
