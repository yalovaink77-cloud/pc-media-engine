# AI Provider Interface

## Goal

All AI operations flow through a single abstraction. Business logic in `packages/ai`, `packages/content`, and `packages/seo` must never import vendor SDKs directly.

## Interface

```typescript
type AiTask =
  | "draft"
  | "rewrite"
  | "summarize"
  | "seo-optimize"
  | "social-repurpose"
  | "refresh-suggest"
  | "classify-intent";

interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AiCompletionRequest {
  task: AiTask;
  messages: AiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  metadata?: Record<string, unknown>;
}

interface AiCompletionResponse {
  content: string;
  model: string;
  provider: string;
  usage: { inputTokens: number; outputTokens: number };
  finishReason: "stop" | "length" | "error";
}

interface AiProvider {
  readonly name: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
  listModels?(): Promise<string[]>;
  ping?(): Promise<boolean>;
}
```

## Provider Registration

Concrete implementations live in `providers/ai/{claude,openai,gemini,openrouter}/`.

Worker/API bootstrap selects provider from project config:

```typescript
const provider = aiRegistry.create(project.aiConfig);
const result = await aiPipeline.run("draft", { contentId, provider });
```

## Pipeline Layer (`packages/ai`)

- Owns prompt templates and orchestration
- Prompt registry: variables like `{{focusKeyword}}`, `{{projectVoice}}`, `{{outline}}`
- Default prompts in package; project overrides in DB or config
- Structured output tasks use `jsonMode` + Zod validation

## Tasks

| Task               | Output                                     |
| ------------------ | ------------------------------------------ |
| `draft`            | markdown body                              |
| `rewrite`          | revised markdown                           |
| `summarize`        | short summary                              |
| `seo-optimize`     | title, meta, slug, FAQ suggestions         |
| `social-repurpose` | platform snippets                          |
| `refresh-suggest`  | diff suggestions, priority                 |
| `classify-intent`  | informational / commercial / transactional |

## Error Handling

| Error         | Behavior                                       |
| ------------- | ---------------------------------------------- |
| Rate limit    | Retry with exponential backoff (BullMQ)        |
| Invalid JSON  | Retry once with repair prompt; then fail       |
| Provider down | Fail job; optional fallback provider (phase 2) |
| Token limit   | Split task or summarize-first sub-job          |

Provider failures must not crash workflows or corrupt content.

## Logging & Audit

Every completion writes an `AiJob` row: projectId, contentId, task, provider, model, tokens, durationMs, status.

Audit events: `ai_job_completed`, `ai_job_failed`. No API keys or full prompts in audit metadata.

## MVP

Implement Claude only (`providers/ai/claude`). Others stub until needed.

## Testing

- Unit tests mock `AiProvider`
- Contract tests per provider (env-gated integration suite)
- Golden-file tests for prompt rendering
