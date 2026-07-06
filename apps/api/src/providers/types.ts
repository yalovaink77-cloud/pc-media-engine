import type { ConfigRequirement } from '../publishers/types.js';

export type ConfigurationStatus = 'complete' | 'partial' | 'missing';

export type ConfigFieldStatus = {
  envVar: string;
  description: string;
  required: boolean;
  configured: boolean;
  /** Non-sensitive values only — never populated for secret fields. */
  value?: string;
  /** Masked secret indicator, e.g. "****abcd". */
  masked?: string;
};

export type ProviderConfigSummary = {
  id: string;
  displayName: string;
  enabled: boolean;
  configured: boolean;
  configurationStatus: ConfigurationStatus;
  requiredFields: ConfigFieldStatus[];
  optionalFields: ConfigFieldStatus[];
  supportsHotReload: boolean;
};

export type ProviderConfigListResult = {
  providers: ProviderConfigSummary[];
  count: number;
};

export type ProviderConfigDetail = ProviderConfigSummary & {
  version: string;
  description: string;
  validation?: ProviderConfigValidationResult;
};

export type ProviderConfigValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type ProviderConfigUpdateInput = Record<string, string | undefined>;

export interface ProviderConfigService {
  listConfigs(): ProviderConfigListResult;
  getConfig(providerId: string): ProviderConfigDetail | null;
  validateConfig(
    providerId: string,
    input?: ProviderConfigUpdateInput,
  ): ProviderConfigValidationResult;
  updateConfig(
    providerId: string,
    input: ProviderConfigUpdateInput,
  ): ProviderConfigDetail | ProviderConfigValidationResult | null;
}

export type { ConfigRequirement };
