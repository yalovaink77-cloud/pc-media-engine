# ADR 003: Provider Abstraction for AI and Storage

## Status

Accepted — Sprint 0

## Context

AI vendors change pricing, models, and availability frequently. Storage may start local and move to cloud. Hard-coding Claude or S3 into business logic would block MVP and future projects.

## Decision

1. Define **`AiProvider`** interface in `packages/ai`; implementations in `providers/ai/*`.
2. Define **`StorageProvider`** interface in `packages/media`; implementations in `providers/storage/*`.
3. Define **`MediaUrlResolver`** in `packages/media` — URLs never constructed in domain code.
4. Define **`PublishingChannel`** interface in `packages/publishing`; WordPress in `plugins/wordpress`.
5. Project config selects active provider + credentials.
6. Domain packages import **interfaces only**; apps/worker wire concrete providers at bootstrap.
7. **Core packages must not depend on plugins or providers.**

## Registration Pattern

```typescript
// Bootstrap (apps/api, apps/worker)
storageRegistry.register("local", LocalStorageFactory);
aiRegistry.register("claude", ClaudeAiFactory);
// Apps compose plugins at bootstrap — packages never import plugins
```

## Consequences

### Positive

- Swap Claude → OpenRouter without touching content/SEO logic
- Swap local → R2 without touching renderers
- Test with in-memory mocks
- Per-project provider selection

### Negative

- Lowest-common-denominator features
- Factory/registry boilerplate

## Non-Goals

- Runtime hot-swap without restart
- Automatic provider failover (deferred to phase 2)

## Alternatives Considered

| Alternative                         | Rejected because                                      |
| ----------------------------------- | ----------------------------------------------------- |
| Direct SDK calls in services        | Violates modularity goal                              |
| Single OpenRouter adapter only      | Still need storage abstraction                        |
| Environment-only provider selection | Cannot support multi-project with different providers |
