import { PUBLISHER_CONFIG_REQUIREMENTS } from '../publishers/config-requirements.js';
import { isMaskedPlaceholder, isSecretEnvVar } from './secret-fields.js';

export type ProviderConfigStoreOptions = {
  baseEnv?: Record<string, string | undefined>;
};

/**
 * In-memory provider configuration overlay.
 * Merges operator updates over process.env for hot reload without restart.
 */
export class ProviderConfigStore {
  private readonly baseEnv: Record<string, string | undefined>;
  private readonly overrides = new Map<string, Record<string, string>>();

  constructor(options: ProviderConfigStoreOptions = {}) {
    this.baseEnv = options.baseEnv ?? process.env;
  }

  getMergedEnv(): Record<string, string | undefined> {
    const merged: Record<string, string | undefined> = { ...this.baseEnv };
    for (const vars of this.overrides.values()) {
      for (const [key, value] of Object.entries(vars)) {
        if (value) merged[key] = value;
      }
    }
    return merged;
  }

  getProviderOverrides(providerId: string): Record<string, string> {
    return { ...(this.overrides.get(providerId) ?? {}) };
  }

  /** Env vars relevant to a provider (from requirements map). */
  providerEnvVars(providerId: string): string[] {
    return (PUBLISHER_CONFIG_REQUIREMENTS[providerId] ?? []).map((r) => r.envVar);
  }

  /** Current effective values for a provider's configuration fields. */
  getProviderFieldValues(providerId: string): Record<string, string | undefined> {
    const merged = this.getMergedEnv();
    const values: Record<string, string | undefined> = {};
    for (const envVar of this.providerEnvVars(providerId)) {
      values[envVar] = merged[envVar]?.trim() || undefined;
    }
    if (providerId === 'wordpress' && !values['WORDPRESS_URL']) {
      values['WORDPRESS_URL'] = merged['WORDPRESS_BASE_URL']?.trim() || undefined;
    }
    return values;
  }

  /**
   * Merge update body over existing values.
   * Omitted keys and masked secret placeholders preserve existing configuration.
   */
  mergeUpdate(
    providerId: string,
    input: Record<string, string | undefined>,
  ): Record<string, string> {
    const existing = this.getProviderFieldValues(providerId);
    const currentOverrides = this.getProviderOverrides(providerId);
    const next: Record<string, string> = { ...currentOverrides };

    for (const envVar of this.providerEnvVars(providerId)) {
      const fromEnv = existing[envVar];
      if (fromEnv && !next[envVar]) next[envVar] = fromEnv;
    }

    for (const [key, raw] of Object.entries(input)) {
      if (raw === undefined) continue;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (isSecretEnvVar(key) && isMaskedPlaceholder(trimmed)) continue;
      next[key] = trimmed;
    }

    this.overrides.set(providerId, next);
    return next;
  }

  /** Replace overrides entirely (for tests). */
  setProviderOverrides(providerId: string, overrides: Record<string, string>): void {
    this.overrides.set(providerId, { ...overrides });
  }

  clear(): void {
    this.overrides.clear();
  }
}
