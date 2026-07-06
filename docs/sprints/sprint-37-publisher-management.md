# Sprint 37 — Publisher Management

## Objective

Create a read-only Publisher Management experience inside the Dashboard that exposes
all registered Publisher SDK providers (WordPress, Ghost, and future providers).
No publishing actions, editing, or credentials management in this sprint.

---

## Publisher SDK

The `@pcme/publisher-sdk` package (Sprint 34) defines the provider contract:

- **`PublisherProvider`** — extends `Publisher` with `getMetadata()` and `getCapabilities()`
- **`PublisherRegistry`** — explicit registration, list, and factory instantiation
- **`PublisherConfiguration`** — typed config loading and validation per provider

Each plugin exports a `ProviderRegistration` descriptor:

```typescript
import { wordPressRegistration } from '@pcme/plugin-wordpress';
import { ghostRegistration } from '@pcme/plugin-ghost';

registry.register(wordPressRegistration);
registry.register(ghostRegistration);
```

---

## Registry

The API wires a `PublisherRegistry` at startup with WordPress and Ghost registrations.
The registry is the single source of truth for which providers exist and what they can do.

| Method | Purpose |
|---|---|
| `register()` | Add a provider at startup |
| `listMetadata()` | Enumerate all registered providers |
| `get(id)` | Look up a registration by ID |
| `create(id, config)` | Instantiate a provider for health checks |

No auto-discovery — providers must be registered explicitly.

---

## API Endpoints

All endpoints are read-only and public (no auth required).

| Endpoint | Returns |
|---|---|
| `GET /publishers` | List of providers: id, displayName, version, enabled, capabilities, supportsHealthCheck |
| `GET /publishers/:id` | Detail: metadata, capabilities, health support, configuration requirements |
| `GET /publishers/:id/health` | Live health probe: healthy, latency, message |

### Enabled status

A provider is `enabled: true` when all required environment variables are present
and pass validation. Missing config does not remove the provider from the list — it
appears as disabled.

### Configuration requirements

Static per-provider env var documentation is returned by `GET /publishers/:id`:

| Provider | Required vars |
|---|---|
| WordPress | `WORDPRESS_URL`, `WORDPRESS_USERNAME`, `WORDPRESS_APP_PASSWORD` |
| Ghost | `GHOST_URL`, `GHOST_ADMIN_API_KEY` |

Optional timeout vars are also listed.

---

## Health Checks

`GET /publishers/:id/health` creates a provider instance (when config is present) and
calls `PublisherProvider.health()`. Results map to:

| Field | Source |
|---|---|
| `healthy` | `true` when status is `ok` or `degraded` |
| `latency` | Round-trip time in milliseconds |
| `message` | Provider message or status string |

When configuration is missing, health returns `healthy: false` with an explanatory
message — no network call is made.

---

## Dashboard

New page at `/publishers` (linked from main dashboard nav).

Each provider is shown as a card with:

- Status badge (Enabled / Disabled)
- Version and provider ID
- Capability badges
- Configuration requirements list
- **Check Health** button (HTML form → `POST /ops/publishers/:id/health`)

The dashboard proxies health checks to the API and shows results via PRG flash banners.
Unavailable provider details are shown gracefully without crashing the page.

No editing, delete, or credentials UI.

---

## Architecture

```
Browser ──GET /publishers──▶ Dashboard SSR
                              │
                              └──GET /publishers──▶ API ──▶ PublisherRegistry

Browser ──POST /ops/publishers/:id/health──▶ Dashboard SSR
                                              │
                                              └──GET /publishers/:id/health──▶ API
                                                                              └── provider.health()
```

---

## Testing

| File | Coverage |
|---|---|
| `packages/publisher-sdk/src/__tests__/registry.test.ts` | Registry register/list/create/unregister |
| `apps/api/src/__tests__/publishers.test.ts` | API routes, service integration, health |
| `apps/dashboard/src/__tests__/publishers-renderer.test.ts` | Provider cards, badges, forms |
| `apps/dashboard/src/__tests__/publishers-app.test.ts` | Page route, health action |
| `apps/dashboard/src/__tests__/client.test.ts` | Publisher API client methods |

---

## Smoke

```
pnpm publisher-management:smoke
```

Runs offline API smoke (mocked service) and dashboard smoke (mocked client).

---

## Future Work

- **Provider editing** — enable/disable providers via UI
- **Credentials management** — secure credential storage and rotation
- **Publishing actions** — trigger publish/test from dashboard
- **Worker integration** — replace `PUBLISHER_DRIVER` switch with registry at runtime
- **Provider detail pages** — per-provider history, config status, live metrics
- **New providers** — Medium, Dev.to, LinkedIn via same registration pattern

---

## Verification

```
pnpm test
pnpm build
pnpm publisher-management:smoke
```
