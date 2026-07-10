import type {
  GenerationProviderAdapter,
  GenerationProviderCapabilities,
  GenerationProviderRequest,
  GenerationProviderResponse,
} from '@pcme/ai';
import { buildProviderUsage } from '@pcme/ai';

import type { FetchFunction } from './openrouter-ai-metadata.provider.js';
import type { OpenRouterGenerationClient } from './openrouter-generation-client.js';
import {
  FetchOpenRouterGenerationClient,
  type OpenRouterChatCompletionResponseBody,
} from './openrouter-generation-client.js';
import type { OpenRouterGenerationConfig } from './openrouter-generation-config.js';
import { loadOpenRouterGenerationConfig } from './openrouter-generation-config.js';
import {
  buildGenerationError,
  buildProviderFailureMessage,
  buildRedactedDiagnostics,
  mapHttpStatusToErrorCode,
  sanitizeErrorMessage,
} from './openrouter-generation-errors.js';
import { buildChatCompletionRequestBody } from './openrouter-generation-messages.js';

export interface OpenRouterGenerationProviderOptions {
  readonly abortSignal?: AbortSignal;
}

export class OpenRouterGenerationProvider implements GenerationProviderAdapter {
  readonly providerId = 'openrouter';
  readonly capabilities: GenerationProviderCapabilities = Object.freeze({
    supportedOutputFormats: Object.freeze(['markdown', 'plain-text']),
    supportsStreaming: false,
    maxInputCharacters: 200_000,
  });

  constructor(
    private readonly config: OpenRouterGenerationConfig,
    private readonly client: OpenRouterGenerationClient,
    private readonly options: OpenRouterGenerationProviderOptions = {},
  ) {}

  async generate(request: GenerationProviderRequest): Promise<GenerationProviderResponse> {
    const { job } = request;
    const startedAt = Date.now();
    let abortReason: 'timeout' | 'cancelled' = 'timeout';
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortReason = 'timeout';
      timeoutController.abort();
    }, this.config.timeoutMs);

    const onExternalAbort = (): void => {
      abortReason = 'cancelled';
      timeoutController.abort();
    };

    if (this.options.abortSignal) {
      if (this.options.abortSignal.aborted) {
        clearTimeout(timeoutId);
        return this.buildFailedResponse(job, 'cancelled', startedAt);
      }
      this.options.abortSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    const body = buildChatCompletionRequestBody(job, {
      model: this.config.model,
      maxOutputTokens: this.config.maxOutputTokens,
      temperature: this.config.temperature,
    });

    try {
      const response = await this.client.createChatCompletion(body, {
        signal: timeoutController.signal,
      });

      if (!response.ok) {
        const errorBody = await this.readErrorBody(response);
        const code = mapHttpStatusToErrorCode(response.status);
        return this.buildHttpFailedResponse(job, code, response.status, errorBody, startedAt);
      }

      let parsed: OpenRouterChatCompletionResponseBody;
      try {
        parsed = (await response.json()) as OpenRouterChatCompletionResponseBody;
      } catch {
        return this.buildFailedResponse(job, 'malformed-response', startedAt, {
          httpStatus: response.status,
          detail: 'Response body was not valid JSON',
        });
      }

      if (parsed.error) {
        const detail = sanitizeErrorMessage(parsed.error.message ?? 'Provider error', [
          this.config.apiKey,
        ]);
        return this.buildFailedResponse(job, 'invalid-request', startedAt, {
          httpStatus: response.status,
          detail,
        });
      }

      const choice = parsed.choices?.[0];
      const content = choice?.message?.content;
      if (!choice || typeof content !== 'string' || content.length === 0) {
        return this.buildFailedResponse(job, 'malformed-response', startedAt, {
          httpStatus: response.status,
          providerModel: parsed.model ?? this.config.model,
          detail: 'Response missing assistant content',
        });
      }

      const inputUsage = buildProviderUsage(job);
      const finishReason = choice.finish_reason ?? 'stop';
      const warnings = job.promptPayload.warnings.map((warning) => warning.message);

      return Object.freeze({
        providerId: this.providerId,
        status: 'succeeded',
        jobId: job.jobId,
        requestId: job.requestId,
        model: parsed.model ?? this.config.model,
        finishReason,
        content,
        usage: Object.freeze({
          inputCharacters: inputUsage.inputCharacters,
          outputCharacters: content.length,
          inputTokens: parsed.usage?.prompt_tokens,
          outputTokens: parsed.usage?.completion_tokens,
        }),
        warnings: Object.freeze(warnings),
        diagnostics: buildRedactedDiagnostics({
          httpStatus: response.status,
          providerModel: parsed.model ?? this.config.model,
          finishReason,
          inputTokens: parsed.usage?.prompt_tokens,
          outputTokens: parsed.usage?.completion_tokens,
          elapsedMs: Date.now() - startedAt,
          secrets: [this.config.apiKey],
        }),
      });
    } catch (error: unknown) {
      if (isAbortError(error)) {
        return this.buildFailedResponse(job, abortReason, startedAt);
      }

      return this.buildFailedResponse(job, 'provider-unavailable', startedAt, {
        detail: sanitizeErrorMessage(toErrorMessage(error), [this.config.apiKey]),
      });
    } finally {
      clearTimeout(timeoutId);
      this.options.abortSignal?.removeEventListener('abort', onExternalAbort);
    }
  }

  private buildHttpFailedResponse(
    job: GenerationProviderRequest['job'],
    code: ReturnType<typeof mapHttpStatusToErrorCode>,
    httpStatus: number,
    errorBody: string,
    startedAt: number,
  ): GenerationProviderResponse {
    return this.buildFailedResponse(job, code, startedAt, {
      httpStatus,
      detail: sanitizeErrorMessage(errorBody.slice(0, 200), [this.config.apiKey]),
    });
  }

  private buildFailedResponse(
    job: GenerationProviderRequest['job'],
    code: Parameters<typeof buildGenerationError>[0],
    startedAt: number,
    diagnosticsInput?: Parameters<typeof buildRedactedDiagnostics>[0],
  ): GenerationProviderResponse {
    const message = buildProviderFailureMessage(code, diagnosticsInput?.httpStatus);

    return Object.freeze({
      providerId: this.providerId,
      status: 'failed',
      jobId: job.jobId,
      requestId: job.requestId,
      model: this.config.model,
      error: buildGenerationError(code, message),
      diagnostics: buildRedactedDiagnostics({
        providerModel: this.config.model,
        elapsedMs: Date.now() - startedAt,
        secrets: [this.config.apiKey],
        ...diagnosticsInput,
      }),
    });
  }

  private async readErrorBody(response: Response): Promise<string> {
    try {
      const text = await response.text();
      return text.slice(0, 200);
    } catch {
      return '';
    }
  }
}

export function createOpenRouterGenerationProvider(
  env: Record<string, string | undefined> = process.env,
  options?: {
    fetchFn?: FetchFunction;
    abortSignal?: AbortSignal;
  },
): OpenRouterGenerationProvider {
  const config = loadOpenRouterGenerationConfig(env);
  const client = new FetchOpenRouterGenerationClient(config, options?.fetchFn);
  return new OpenRouterGenerationProvider(config, client, {
    abortSignal: options?.abortSignal,
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
