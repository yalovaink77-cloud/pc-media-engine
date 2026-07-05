# Sprint 20 — AI Metadata Enrichment Foundation

## Goal

Optional AI enrichment layer on top of Sprint 19 deterministic metadata. AI enhances — never replaces — the baseline.

---

## Architecture

```
MetadataEnrichmentInput
       ↓
enrichMetadata()          ← deterministic (@pcme/seo)
       ↓
AiMetadataProvider.suggest()  ← optional (none | mock | openrouter)
       ↓
mergeAiSuggestions()      ← validated merge with fallbacks
       ↓
AiMetadataResult
```

---

## Provider interface

```typescript
interface AiMetadataProvider {
  readonly name: string;
  suggest(request, baseline): Promise<AiMetadataSuggestion | null>;
}
```

| Provider | Package | Network |
|---|---|---|
| `none` (default) | `@pcme/ai` | No |
| `mock` | `@pcme/ai` | No |
| `openrouter` | `@pcme/provider-ai-openrouter` | Yes (manual only) |

Set via `AI_METADATA_PROVIDER=none|mock|openrouter` (default: `none`).

---

## Fallback rules

| Scenario | Behaviour |
|---|---|
| Provider is `none` | Deterministic metadata unchanged |
| AI returns empty fields | Keep deterministic value for that field |
| AI throws / network error | Full fallback to deterministic metadata |
| Malformed JSON (OpenRouter) | Throw → service catches → deterministic fallback |

AI may enrich: `seoTitle`, `metaDescription`, `excerpt`, `altText`, `tags`, `categories`.

---

## OpenRouter env vars

| Variable | Required | Default |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes (when using openrouter) | — |
| `OPENROUTER_MODEL` | No | `openai/gpt-4o-mini` |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` |

Missing `OPENROUTER_API_KEY` → `OpenRouterConfigError` (fail fast).

---

## Why tests use mock provider

Unit tests must be deterministic, offline, and credential-free. `MockAiMetadataProvider` produces predictable `[AI]` prefixed enrichments. OpenRouter tests use injected `fetchFn` — no real LLM calls.

---

## Deferred

| Feature | Sprint |
|---|---|
| Worker integration | Future |
| Automatic AI publishing | Future |
| Image vision / OCR / Whisper | Future |
| Dashboard | Future |

Worker will call `AiMetadataEnrichmentService` before enqueueing publish jobs in a future sprint.

---

## Verification

```bash
pnpm --filter @pcme/ai test
pnpm --filter @pcme/ai smoke
pnpm --filter @pcme/provider-ai-openrouter test
pnpm build
```

Manual OpenRouter (not CI):

```bash
pnpm --filter @pcme/provider-ai-openrouter smoke
```
