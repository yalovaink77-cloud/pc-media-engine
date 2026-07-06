import {
  isConfigComplete as isGhostConfigComplete,
  loadGhostConfig,
  validateGhostConfigStrict,
} from '@pcme/plugin-ghost';
import {
  isConfigComplete as isWordPressConfigComplete,
  loadWordPressConfig,
  validateWordPressConfigStrict,
} from '@pcme/plugin-wordpress';
import type { PublisherRegistry } from '@pcme/publisher-sdk';

import { PUBLISHER_CONFIG_REQUIREMENTS } from '../publishers/config-requirements.js';
import type { ConfigRequirement } from '../publishers/types.js';
import { ProviderConfigStore } from './config-store.js';
import { isSecretEnvVar, maskSecret } from './secret-fields.js';
import type {
  ConfigFieldStatus,
  ConfigurationStatus,
  ProviderConfigDetail,
  ProviderConfigListResult,
  ProviderConfigService,
  ProviderConfigUpdateInput,
  ProviderConfigValidationResult,
} from './types.js';

export type CreateProviderConfigServiceOptions = {
  registry: PublisherRegistry;
  configStore?: ProviderConfigStore;
};

const HOT_RELOAD_PROVIDERS = new Set(['wordpress', 'ghost']);

function buildFieldStatus(req: ConfigRequirement, value: string | undefined): ConfigFieldStatus {
  const configured = Boolean(value?.trim());
  const field: ConfigFieldStatus = {
    envVar: req.envVar,
    description: req.description,
    required: req.required,
    configured,
  };
  if (!configured) return field;
  if (isSecretEnvVar(req.envVar)) {
    field.masked = maskSecret(value!);
  } else {
    field.value = value;
  }
  return field;
}

function deriveConfigurationStatus(
  required: ConfigFieldStatus[],
  enabled: boolean,
): ConfigurationStatus {
  if (enabled) return 'complete';
  const configuredRequired = required.filter((f) => f.configured).length;
  if (configuredRequired === 0) return 'missing';
  return 'partial';
}

function tryValidate(
  providerId: string,
  env: Record<string, string | undefined>,
): ProviderConfigValidationResult {
  try {
    if (providerId === 'wordpress') {
      const config = loadWordPressConfig(env);
      const { errors, warnings } = validateWordPressConfigStrict(config);
      return { valid: errors.length === 0, errors, warnings };
    }
    if (providerId === 'ghost') {
      const config = loadGhostConfig(env);
      const { errors, warnings } = validateGhostConfigStrict(config);
      return { valid: errors.length === 0, errors, warnings };
    }
    return { valid: false, errors: [`Unknown provider "${providerId}"`], warnings: [] };
  } catch (err) {
    return {
      valid: false,
      errors: [err instanceof Error ? err.message : 'Configuration validation failed'],
      warnings: [],
    };
  }
}

function isProviderEnabled(providerId: string, env: Record<string, string | undefined>): boolean {
  try {
    if (providerId === 'wordpress') {
      return isWordPressConfigComplete(loadWordPressConfig(env));
    }
    if (providerId === 'ghost') {
      return isGhostConfigComplete(loadGhostConfig(env));
    }
    return false;
  } catch {
    return false;
  }
}

function buildEnvForValidation(
  store: ProviderConfigStore,
  providerId: string,
  input?: ProviderConfigUpdateInput,
): Record<string, string | undefined> {
  const merged = store.getMergedEnv();
  if (!input) return merged;

  const preview = { ...merged };
  const fieldValues = store.getProviderFieldValues(providerId);
  for (const req of PUBLISHER_CONFIG_REQUIREMENTS[providerId] ?? []) {
    const key = req.envVar;
    const update = input[key];
    if (update === undefined) {
      if (fieldValues[key]) preview[key] = fieldValues[key];
      continue;
    }
    const trimmed = update.trim();
    if (!trimmed || (isSecretEnvVar(key) && /^\*{4,}/.test(trimmed))) {
      if (fieldValues[key]) preview[key] = fieldValues[key];
      continue;
    }
    preview[key] = trimmed;
  }
  if (providerId === 'wordpress' && preview['WORDPRESS_URL']) {
    preview['WORDPRESS_BASE_URL'] = preview['WORDPRESS_URL'];
  }
  return preview;
}

function buildSummary(
  providerId: string,
  metadata: { name: string; version: string; description: string },
  store: ProviderConfigStore,
): ProviderConfigDetail {
  const requirements = PUBLISHER_CONFIG_REQUIREMENTS[providerId] ?? [];
  const fieldValues = store.getProviderFieldValues(providerId);
  const env = store.getMergedEnv();
  const enabled = isProviderEnabled(providerId, env);

  const requiredFields: ConfigFieldStatus[] = [];
  const optionalFields: ConfigFieldStatus[] = [];

  for (const req of requirements) {
    const field = buildFieldStatus(req, fieldValues[req.envVar]);
    if (req.required) requiredFields.push(field);
    else optionalFields.push(field);
  }

  const configured = [...requiredFields, ...optionalFields].some((f) => f.configured);
  const configurationStatus = deriveConfigurationStatus(requiredFields, enabled);
  const validation = tryValidate(providerId, env);

  return {
    id: providerId,
    displayName: metadata.name,
    version: metadata.version,
    description: metadata.description,
    enabled,
    configured,
    configurationStatus,
    requiredFields,
    optionalFields,
    supportsHotReload: HOT_RELOAD_PROVIDERS.has(providerId),
    validation,
  };
}

export function createProviderConfigService(
  options: CreateProviderConfigServiceOptions,
): ProviderConfigService {
  const { registry } = options;
  const store = options.configStore ?? new ProviderConfigStore();

  return {
    listConfigs(): ProviderConfigListResult {
      const providers = registry.listMetadata().map((metadata) => {
        const summary = buildSummary(metadata.id, metadata, store);
        return {
          id: summary.id,
          displayName: summary.displayName,
          enabled: summary.enabled,
          configured: summary.configured,
          configurationStatus: summary.configurationStatus,
          requiredFields: summary.requiredFields,
          optionalFields: summary.optionalFields,
          supportsHotReload: summary.supportsHotReload,
        };
      });
      return { providers, count: providers.length };
    },

    getConfig(providerId: string): ProviderConfigDetail | null {
      const registration = registry.get(providerId);
      if (!registration) return null;
      return buildSummary(providerId, registration.metadata, store);
    },

    validateConfig(
      providerId: string,
      input?: ProviderConfigUpdateInput,
    ): ProviderConfigValidationResult {
      if (!registry.get(providerId)) {
        return {
          valid: false,
          errors: [`Provider "${providerId}" is not registered`],
          warnings: [],
        };
      }
      const env = buildEnvForValidation(store, providerId, input);
      return tryValidate(providerId, env);
    },

    updateConfig(providerId: string, input: ProviderConfigUpdateInput) {
      const registration = registry.get(providerId);
      if (!registration) return null;

      const validation = this.validateConfig(providerId, input);
      if (!validation.valid) return validation;

      store.mergeUpdate(providerId, input);
      return buildSummary(providerId, registration.metadata, store);
    },
  };
}

/** Exported for tests. */
export { ProviderConfigStore };
