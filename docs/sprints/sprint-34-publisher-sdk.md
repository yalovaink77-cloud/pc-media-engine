# Sprint 34 — Publisher SDK & Provider Framework

## Objective

Create a shared provider framework (`@pcme/publisher-sdk`) so every publishing
destination — WordPress, Ghost, Medium, Dev.to, Hashnode, LinkedIn — shares one
common architecture.  This sprint is a pure architectural refactor with no
behavioural changes to the publishing pipeline.

---

## Package

```
packages/publisher-sdk/
├── src/
│   ├── provider.ts      — PublisherProvider, PublisherCapabilities, ProviderMetadata
│   ├── factory.ts       — PublisherFactory type
│   ├── registry.ts      — PublisherRegistry, ProviderRegistration
│   ├── config.ts        — PublisherConfiguration, ConfigValidationResult
│   ├── context.ts       — PublisherContext
│   ├── errors.ts        — PublisherError, ErrorCategory, isRetryableError
│   ├── health.ts        — ProviderHealth, ProviderHealthStatus
│   ├── logger.ts        — PublisherLogger, noopLogger, createConsoleLogger
│   ├── timeout.ts       — createTimeoutSignal, DEFAULT_PROVIDER_TIMEOUT_MS
│   ├── validation.ts    — validateProviderMetadata, validatePublisherCapabilities
│   └── index.ts         — public exports
```

The SDK depends on `@pcme/publishing` and re-exports core types
(`Publisher`, `PublishingRequest`, `PublishingResult`, etc.) so consumers can
import everything from a single package.

---

## Provider Architecture

### Layer model

```
@pcme/publishing          — core Publisher interface (unchanged)
        ↑
@pcme/publisher-sdk       — PublisherProvider + registry + shared abstractions
        ↑
@pcme/plugin-wordpress    — WordPressMediaPublisher implements PublisherProvider
@pcme/plugin-ghost        — (future)
@pcme/plugin-medium       — (future)
```

### PublisherProvider

`PublisherProvider` extends `Publisher` with two read-only introspection methods:

```typescript
interface PublisherProvider extends Publisher {
  getMetadata(): ProviderMetadata;    // id, name, version, capabilities
  getCapabilities(): PublisherCapabilities;
}
```

Existing code that depends only on `Publisher` continues to work unchanged.
`WordPressMediaPublisher` now implements `PublisherProvider`.

### PublisherCapabilities

Feature flags describing what a provider can do:

| Flag | Description |
|---|---|
| `mediaUpload` | Accepts raw media buffers |
| `postCreation` | Creates text posts / articles |
| `drafts` | Supports native draft status |
| `tags` | Tag taxonomy |
| `categories` | Hierarchical categories |
| `featuredImages` | Featured / hero image |
| `scheduling` | Native delayed publishing |
| `update` | Update existing content |
| `delete` | Delete published content |

---

## Registry

`PublisherRegistry` manages provider discovery and instantiation:

```typescript
import { PublisherRegistry } from '@pcme/publisher-sdk';
import { wordPressRegistration } from '@pcme/plugin-wordpress';

const registry = new PublisherRegistry();
registry.register(wordPressRegistration);

const provider = registry.create('wordpress', config);
await provider.publish(request);
```

### API

| Method | Description |
|---|---|
| `register(registration)` | Add or overwrite a provider |
| `has(id)` | Check if provider is registered |
| `get(id)` | Get registration descriptor |
| `list()` | All registrations |
| `listMetadata()` | All provider metadata |
| `create(id, config)` | Instantiate a provider |
| `unregister(id)` | Remove a provider |
| `clear()` | Remove all |

Adding a new provider requires only:

1. Implement `PublisherProvider`.
2. Export a `ProviderRegistration` descriptor.
3. Call `registry.register()` at startup.

No changes to existing providers or the worker pipeline.

---

## Factory

`PublisherFactory<TConfig>` is a typed function:

```typescript
type PublisherFactory<TConfig> = (config: TConfig) => PublisherProvider;
```

Each provider exports a registration object:

```typescript
export const wordPressRegistration: ProviderRegistration<WordPressConfig> = {
  metadata: WORDPRESS_METADATA,
  factory: (config) => new WordPressMediaPublisher(config),
};
```

---

## Shared Abstractions

### PublisherLogger

Injectable logger interface. Providers accept `PublisherLogger` at construction.
Built-in: `noopLogger` (silent), `createConsoleLogger(prefix)`.

WordPress re-exports these as `WordPressPublisherLogger` for backward compatibility.

### PublisherError

Base error class with `category: ErrorCategory` and `retryable: boolean`.
`isRetryableError()` handles `PublisherError`, `TypeError`, `AbortError`, and
duck-typed objects with a `category` field (compatible with legacy `WordPressApiError`).

### PublisherConfiguration

Interface for uniform config loading:

```typescript
interface PublisherConfiguration<TConfig> {
  load(env?): TConfig;
  validate(config): ConfigValidationResult;
}
```

### PublisherContext

Optional runtime context for logging and retry-aware behaviour:
`requestId`, `correlationId`, `attemptNumber`, `scheduledFor`, `meta`.

### ProviderHealth

Extended health type with `checkedAt` and `responseTimeMs`.
Compatible with existing `HealthResult` from `@pcme/publishing`.

### Timeout

`createTimeoutSignal(ms)` centralises `AbortSignal.timeout()` usage.
Default: `DEFAULT_PROVIDER_TIMEOUT_MS = 30_000`.

### Validation helpers

- `validateProviderMetadata(metadata)` — id format, required fields
- `validatePublisherCapabilities(caps)` — boolean flag shape, usability warnings

---

## WordPress Compatibility

`WordPressMediaPublisher` implements `PublisherProvider`:

- `getMetadata()` → `WORDPRESS_METADATA` (id: `"wordpress"`)
- `getCapabilities()` → `WORDPRESS_CAPABILITIES`
- `wordPressRegistration` exported for registry use
- All 157 existing WordPress tests pass unchanged
- 17 new compatibility tests in `wordpress-provider.test.ts`

No changes to `publishMedia()`, `publishPost()`, `health()`, or error handling.

---

## Future Providers

The registry supports registration of future providers without code changes:

| Provider | ID | Status |
|---|---|---|
| WordPress | `wordpress` | Implemented (Sprint 14–34) |
| Ghost | `ghost` | Planned |
| Medium | `medium` | Planned |
| Dev.to | `dev-to` | Planned |
| Hashnode | `hashnode` | Planned |
| LinkedIn | `linkedin` | Planned |

Each future provider will:

1. Create `plugins/<name>/` package.
2. Implement `PublisherProvider`.
3. Export `<name>Registration: ProviderRegistration<TConfig>`.
4. Register at worker startup via `PublisherRegistry`.

---

## Compatibility Strategy

| Constraint | Approach |
|---|---|
| No breaking API changes | `Publisher` interface unchanged; new fields are optional |
| Existing worker code | Still uses `createPublisher()` / `PUBLISHER_DRIVER` |
| WordPress logger imports | Re-exported from `@pcme/publisher-sdk` |
| Retry engine | `isRetryableError()` duck-types legacy `WordPressApiError` |
| PublishingResult | Still defined in `@pcme/publishing`; SDK re-exports it |

The registry is opt-in. The worker does not require it until a future sprint
wires provider discovery into startup.

---

## Testing

| Package | File | Tests |
|---|---|---|
| `@pcme/publisher-sdk` | `registry.test.ts` | 16 |
| | `provider.test.ts` | 12 |
| | `errors.test.ts` | 23 |
| | `logger.test.ts` | 9 |
| | `factory.test.ts` | 2 |
| | `timeout.test.ts` | 5 |
| | `validation.test.ts` | 8 |
| `@pcme/plugin-wordpress` | `wordpress-provider.test.ts` | 17 |

Total new SDK tests: **75**. WordPress total: **157** (all pass).

---

## Smoke

```
pnpm publisher-sdk:smoke
```

12 offline sections covering registry, factory, capabilities, logger, errors,
retry classification, timeout, validation helpers, and future provider slots.

---

## Verification

```
pnpm test
pnpm build
pnpm publisher-sdk:smoke
```
