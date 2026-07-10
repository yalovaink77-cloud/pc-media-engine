import { buildProviderUsage } from '../run.js';
import type {
  GenerationProviderAdapter,
  GenerationProviderCapabilities,
  GenerationProviderRequest,
  GenerationProviderResponse,
} from '../types.js';

export interface FakeGenerationProviderOptions {
  readonly shouldFail?: boolean;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly generatedContent?: string;
}

/** In-memory fake provider for tests and offline development only. */
export class FakeGenerationProvider implements GenerationProviderAdapter {
  readonly providerId = 'fake';
  readonly capabilities: GenerationProviderCapabilities = Object.freeze({
    supportedOutputFormats: Object.freeze(['markdown', 'plain-text']),
    supportsStreaming: false,
    maxInputCharacters: 100_000,
  });

  constructor(private readonly options: FakeGenerationProviderOptions = {}) {}

  generate(request: GenerationProviderRequest): Promise<GenerationProviderResponse> {
    if (this.options.shouldFail) {
      return Promise.resolve(
        Object.freeze({
          providerId: this.providerId,
          status: 'failed',
          error: Object.freeze({
            code: this.options.failureCode ?? 'fake-provider-failure',
            message: this.options.failureMessage ?? 'Fake provider simulated failure',
            retryable: false,
          }),
        }),
      );
    }

    const usage = buildProviderUsage(request.job);

    return Promise.resolve(
      Object.freeze({
        providerId: this.providerId,
        status: 'succeeded',
        content: this.options.generatedContent ?? '[fake-generated-content]',
        usage: Object.freeze({
          inputCharacters: usage.inputCharacters,
          outputCharacters: (this.options.generatedContent ?? '[fake-generated-content]').length,
        }),
      }),
    );
  }
}
