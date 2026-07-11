/** Configuration for the OpenRouter generation provider adapter. */

export interface OpenRouterGenerationConfig {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxOutputTokens: number;
  readonly temperature: number;
}

export class OpenRouterGenerationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenRouterGenerationConfigError';
  }
}

const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.3;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseTemperature(value: string | undefined, fallback: number): number {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 2 ? parsed : fallback;
}

export function loadOpenRouterGenerationConfig(
  env: Record<string, string | undefined> = process.env,
): OpenRouterGenerationConfig {
  const apiKey = env['OPENROUTER_API_KEY'] ?? '';
  if (!apiKey.trim()) {
    throw new OpenRouterGenerationConfigError(
      'OPENROUTER_API_KEY is required when using the OpenRouter generation provider',
    );
  }

  return Object.freeze({
    apiKey: apiKey.trim(),
    model: (env['OPENROUTER_MODEL'] ?? DEFAULT_MODEL).trim(),
    baseUrl: (env['OPENROUTER_BASE_URL'] ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
    timeoutMs: parsePositiveInt(env['OPENROUTER_TIMEOUT_MS'], DEFAULT_TIMEOUT_MS),
    maxOutputTokens: parsePositiveInt(
      env['OPENROUTER_MAX_OUTPUT_TOKENS'],
      DEFAULT_MAX_OUTPUT_TOKENS,
    ),
    temperature: parseTemperature(env['OPENROUTER_TEMPERATURE'], DEFAULT_TEMPERATURE),
  });
}

export function hasOpenRouterGenerationApiKey(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env['OPENROUTER_API_KEY']?.trim());
}
