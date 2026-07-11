import type { GenerationJobRequest } from '@pcme/ai';
import { describe, expect, it, vi } from 'vitest';

import {
  createOpenRouterGenerationProvider,
  OpenRouterGenerationProvider,
} from '../openrouter-generation.provider.js';
import { FetchOpenRouterGenerationClient } from '../openrouter-generation-client.js';
import {
  hasOpenRouterGenerationApiKey,
  loadOpenRouterGenerationConfig,
  OpenRouterGenerationConfigError,
} from '../openrouter-generation-config.js';
import {
  buildGenerationError,
  classifyGenerationErrorCode,
  mapHttpStatusToErrorCode,
  redactSecrets,
  sanitizeErrorMessage,
} from '../openrouter-generation-errors.js';
import {
  buildChatCompletionRequestBody,
  buildChatMessagesFromJob,
} from '../openrouter-generation-messages.js';

const API_KEY = 'sk-test-openrouter-secret-key';

function createTestJob(overrides: Partial<GenerationJobRequest> = {}): GenerationJobRequest {
  return Object.freeze({
    jobId: 'job-123',
    requestId: 'req-456',
    sourceId: 'source-789',
    snapshotId: 'snap-001',
    contentType: 'product-review',
    locale: 'en',
    tone: 'educational',
    outputFormat: 'markdown',
    promptPayload: Object.freeze({
      contentType: 'product-review',
      systemInstructions: Object.freeze([
        Object.freeze({ id: 'role', priority: 1, instruction: 'You are a helpful writer.' }),
        Object.freeze({ id: 'style', priority: 2, instruction: 'Use clear language.' }),
      ]),
      userSections: Object.freeze([
        Object.freeze({
          id: 'overview',
          title: 'Overview',
          order: 1,
          content: 'Product context goes here.',
        }),
        Object.freeze({
          id: 'details',
          title: 'Details',
          order: 2,
          content: 'Additional details.',
        }),
      ]),
      constraints: Object.freeze([
        Object.freeze({
          id: 'no-diagnosis',
          category: 'medical' as const,
          rule: 'Do not provide medical diagnosis.',
          severity: 'required' as const,
        }),
      ]),
      outputContract: Object.freeze({
        format: 'markdown',
        locale: 'en',
        tone: 'educational',
        sections: Object.freeze(['overview', 'summary']),
        allowedCtaTypes: Object.freeze(['learn-more']),
        prohibitedCtaTypes: Object.freeze(['buy-now']),
      }),
      metadata: Object.freeze({
        contentType: 'product-review',
        contextRecipeId: 'product-review',
        locale: 'en',
        tone: 'educational',
        outputFormat: 'markdown',
        rootEntityType: 'product',
        rootEntityId: 'test-product',
        snapshotId: 'snap-001',
        estimatedInputCharacters: 100,
        estimatedSectionCount: 2,
        entityCount: 1,
        truncationWarning: false,
      }),
      warnings: Object.freeze([
        Object.freeze({
          code: 'context-incomplete' as const,
          message: 'Some context was incomplete.',
        }),
      ]),
    }),
    policySnapshot: Object.freeze({
      safetyConstraints: Object.freeze(['no-diagnosis']),
      affiliateConstraints: Object.freeze([]),
      citationRequirements: Object.freeze([]),
      blockedFields: Object.freeze([]),
      strictMode: false,
      contextComplete: true,
      warningCount: 1,
    }),
    metadata: Object.freeze({
      entityCount: 1,
      promptSectionCount: 2,
      constraintCount: 1,
      estimatedInputCharacters: 100,
      providerNeutralPayloadSize: 250,
    }),
    createdAt: '2026-07-10T12:00:00.000Z',
    status: 'prepared',
    ...overrides,
  });
}

function successResponse(content = 'Generated markdown output.'): Response {
  return new Response(
    JSON.stringify({
      id: 'gen-123',
      model: 'openai/gpt-4o-mini',
      choices: [{ message: { content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 120, completion_tokens: 45 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

describe('loadOpenRouterGenerationConfig', () => {
  it('loads generation config when API key is present', () => {
    const config = loadOpenRouterGenerationConfig({
      OPENROUTER_API_KEY: API_KEY,
      OPENROUTER_MODEL: 'anthropic/claude-3.5-sonnet',
      OPENROUTER_TIMEOUT_MS: '30000',
      OPENROUTER_MAX_OUTPUT_TOKENS: '512',
      OPENROUTER_TEMPERATURE: '0.5',
    });

    expect(config.apiKey).toBe(API_KEY);
    expect(config.model).toBe('anthropic/claude-3.5-sonnet');
    expect(config.timeoutMs).toBe(30_000);
    expect(config.maxOutputTokens).toBe(512);
    expect(config.temperature).toBe(0.5);
  });

  it('fails fast when OPENROUTER_API_KEY is missing', () => {
    expect(() => loadOpenRouterGenerationConfig({})).toThrow(OpenRouterGenerationConfigError);
  });

  it('detects missing API key for smoke guard', () => {
    expect(hasOpenRouterGenerationApiKey({})).toBe(false);
    expect(hasOpenRouterGenerationApiKey({ OPENROUTER_API_KEY: API_KEY })).toBe(true);
  });
});

describe('buildChatCompletionRequestBody', () => {
  it('builds deterministic request construction', () => {
    const job = createTestJob();
    const first = buildChatCompletionRequestBody(job, {
      model: 'openai/gpt-4o-mini',
      maxOutputTokens: 256,
      temperature: 0.2,
    });
    const second = buildChatCompletionRequestBody(job, {
      model: 'openai/gpt-4o-mini',
      maxOutputTokens: 256,
      temperature: 0.2,
    });

    expect(first).toEqual(second);
    expect(first.messages[0]?.role).toBe('system');
    expect(first.messages[1]?.role).toBe('user');
    expect(first.messages[0]?.content).toContain('You are a helpful writer.');
    expect(first.messages[0]?.content).toContain('[no-diagnosis]');
    expect(first.messages[1]?.content).toContain('## Overview');
  });
});

describe('OpenRouterGenerationProvider', () => {
  it('maps successful generation responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue(successResponse('Hello world output.'));
    const provider = createOpenRouterGenerationProvider(
      { OPENROUTER_API_KEY: API_KEY },
      { fetchFn: mockFetch },
    );
    const job = createTestJob();

    const response = await provider.generate({ job });

    expect(response.status).toBe('succeeded');
    expect(response.providerId).toBe('openrouter');
    expect(response.jobId).toBe('job-123');
    expect(response.requestId).toBe('req-456');
    expect(response.model).toBe('openai/gpt-4o-mini');
    expect(response.finishReason).toBe('stop');
    expect(response.content).toBe('Hello world output.');
    expect(response.usage?.inputTokens).toBe(120);
    expect(response.usage?.outputTokens).toBe(45);
    expect(response.warnings).toEqual(['Some context was incomplete.']);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('maps authentication errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const provider = createOpenRouterGenerationProvider(
      { OPENROUTER_API_KEY: API_KEY },
      { fetchFn: mockFetch },
    );

    const response = await provider.generate({ job: createTestJob() });

    expect(response.status).toBe('failed');
    expect(response.error?.code).toBe('authentication');
    expect(response.error?.retryable).toBe(false);
  });

  it('maps rate-limit errors as retryable', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('Too Many Requests', { status: 429 }));
    const provider = createOpenRouterGenerationProvider(
      { OPENROUTER_API_KEY: API_KEY },
      { fetchFn: mockFetch },
    );

    const response = await provider.generate({ job: createTestJob() });

    expect(response.status).toBe('failed');
    expect(response.error?.code).toBe('rate-limit');
    expect(response.error?.retryable).toBe(true);
    expect(classifyGenerationErrorCode('rate-limit').retryable).toBe(true);
  });

  it('maps timeout errors', async () => {
    const mockFetch = vi.fn().mockImplementation((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        });
      });
    });

    const provider = new OpenRouterGenerationProvider(
      loadOpenRouterGenerationConfig({
        OPENROUTER_API_KEY: API_KEY,
        OPENROUTER_TIMEOUT_MS: '10',
      }),
      new FetchOpenRouterGenerationClient(
        loadOpenRouterGenerationConfig({
          OPENROUTER_API_KEY: API_KEY,
          OPENROUTER_TIMEOUT_MS: '10',
        }),
        mockFetch,
      ),
    );

    const response = await provider.generate({ job: createTestJob() });

    expect(response.status).toBe('failed');
    expect(response.error?.code).toBe('timeout');
    expect(response.error?.retryable).toBe(true);
  });

  it('maps malformed responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: {} }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const provider = createOpenRouterGenerationProvider(
      { OPENROUTER_API_KEY: API_KEY },
      { fetchFn: mockFetch },
    );

    const response = await provider.generate({ job: createTestJob() });

    expect(response.status).toBe('failed');
    expect(response.error?.code).toBe('malformed-response');
  });

  it('maps usage from provider response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(successResponse('Token usage test.'));
    const provider = createOpenRouterGenerationProvider(
      { OPENROUTER_API_KEY: API_KEY },
      { fetchFn: mockFetch },
    );

    const response = await provider.generate({ job: createTestJob() });

    expect(response.usage?.inputTokens).toBe(120);
    expect(response.usage?.outputTokens).toBe(45);
    expect(response.usage?.outputCharacters).toBe('Token usage test.'.length);
  });

  it('handles cancellation via abort signal', async () => {
    const controller = new AbortController();
    controller.abort();

    const mockFetch = vi.fn();
    const provider = createOpenRouterGenerationProvider(
      { OPENROUTER_API_KEY: API_KEY },
      { fetchFn: mockFetch, abortSignal: controller.signal },
    );

    const response = await provider.generate({ job: createTestJob() });

    expect(response.status).toBe('failed');
    expect(response.error?.code).toBe('cancelled');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('redacts secrets from diagnostics and error surfaces', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const provider = createOpenRouterGenerationProvider(
      { OPENROUTER_API_KEY: API_KEY },
      { fetchFn: mockFetch },
    );

    const response = await provider.generate({ job: createTestJob() });
    const serialized = JSON.stringify(response);

    expect(serialized).not.toContain(API_KEY);
    expect(redactSecrets(`Bearer ${API_KEY}`, [API_KEY])).not.toContain(API_KEY);
    expect(sanitizeErrorMessage(`Error with key ${API_KEY}`, [API_KEY])).not.toContain(API_KEY);
  });

  it('does not leak prompt content in failure messages', async () => {
    const secretPrompt = 'TOP_SECRET_PROMPT_FRAGMENT_SHOULD_NOT_LEAK';
    const job = createTestJob({
      promptPayload: Object.freeze({
        ...createTestJob().promptPayload,
        userSections: Object.freeze([
          Object.freeze({
            id: 'secret',
            title: 'Secret',
            order: 1,
            content: secretPrompt,
          }),
        ]),
      }),
    });

    const mockFetch = vi.fn().mockResolvedValue(new Response('Bad Request', { status: 400 }));
    const provider = createOpenRouterGenerationProvider(
      { OPENROUTER_API_KEY: API_KEY },
      { fetchFn: mockFetch },
    );

    const response = await provider.generate({ job });
    const serialized = JSON.stringify(response);

    expect(response.error?.message).toBe('OpenRouter rejected the generation request');
    expect(serialized).not.toContain(secretPrompt);
    expect(buildChatMessagesFromJob(job)[1]?.content).toContain(secretPrompt);
  });

  it('classifies HTTP statuses for retry metadata', () => {
    expect(mapHttpStatusToErrorCode(401)).toBe('authentication');
    expect(mapHttpStatusToErrorCode(429)).toBe('rate-limit');
    expect(mapHttpStatusToErrorCode(503)).toBe('provider-unavailable');
    expect(buildGenerationError('provider-unavailable', 'down').retryable).toBe(true);
  });
});
