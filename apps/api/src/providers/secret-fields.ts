/** Env vars whose values must never be returned in API responses. */
export const SECRET_ENV_VARS = new Set(['WORDPRESS_APP_PASSWORD', 'GHOST_ADMIN_API_KEY']);

export function isSecretEnvVar(envVar: string): boolean {
  return SECRET_ENV_VARS.has(envVar);
}

/** True when the value is a masked placeholder sent by the dashboard (preserve existing). */
export function isMaskedPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^\*{4,}/.test(trimmed);
}

/** Mask a secret for display — shows last 4 chars when long enough. */
export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 4) return '****';
  return `****${trimmed.slice(-4)}`;
}
