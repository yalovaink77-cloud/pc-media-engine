import type { FetchFunction } from './openrouter-ai-metadata.provider.js';
import type { OpenRouterGenerationConfig } from './openrouter-generation-config.js';
import type { OpenRouterChatCompletionRequestBody } from './openrouter-generation-messages.js';

export interface OpenRouterChatCompletionChoice {
  readonly message?: {
    readonly content?: string;
  };
  readonly finish_reason?: string;
}

export interface OpenRouterChatCompletionResponseBody {
  readonly id?: string;
  readonly model?: string;
  readonly choices?: readonly OpenRouterChatCompletionChoice[];
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
  };
  readonly error?: {
    readonly message?: string;
    readonly code?: string | number;
    readonly type?: string;
  };
}

export interface OpenRouterGenerationClient {
  createChatCompletion(
    body: OpenRouterChatCompletionRequestBody,
    options?: { signal?: AbortSignal },
  ): Promise<Response>;
}

export class FetchOpenRouterGenerationClient implements OpenRouterGenerationClient {
  constructor(
    private readonly config: OpenRouterGenerationConfig,
    private readonly fetchFn: FetchFunction = globalThis.fetch,
  ) {}

  createChatCompletion(
    body: OpenRouterChatCompletionRequestBody,
    options?: { signal?: AbortSignal },
  ): Promise<Response> {
    return this.fetchFn(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    });
  }
}
