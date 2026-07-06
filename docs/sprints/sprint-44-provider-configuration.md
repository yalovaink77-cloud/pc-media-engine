# Sprint 44 — Provider Configuration Management

## Objective

Introduce the first configuration management module: operators inspect, validate,
and update provider settings through the Dashboard without editing environment
files manually.

---

## Configuration Lifecycle

```
Operator opens /provider-config
    → GET /providers/config (list)
    → GET /providers/config/:id (detail per card)

Edit → Validate → Save
    → POST /providers/config/:id/validate  (no persist)
    → PUT  /providers/config/:id           (validate then persist)
```

Configuration is stored in an **in-memory overlay** (`ProviderConfigStore`)
merged over `process.env`. Updates take effect immediately for publisher
enablement and health checks — no process restart when hot reload is supported.

---

## Validation

Validation reuses plugin loaders and strict validators:

| Provider | Load | Strict validate |
|---|---|---|
| WordPress | `loadWordPressConfig` | `validateWordPressConfigStrict` |
| Ghost | `loadGhostConfig` | `validateGhostConfigStrict` |

`POST /providers/config/:id/validate` accepts a partial configuration body.
Omitted fields are filled from the current effective configuration before
validation runs. Response:

```json
{ "valid": true, "errors": [], "warnings": [] }
```

`PUT` runs the same validation; on failure returns HTTP 400 with errors.
On success, merges into the overlay and returns updated metadata.

---

## Hot Reload Support

WordPress and Ghost providers support hot reload in the API process:

- `createPublisherService({ getEnv })` reads merged env on every call
- `enabled` status and `checkHealth()` reflect updates immediately
- Dashboard shows a **Hot reload** badge for supported providers

The worker process still reads `process.env` at startup (unchanged in Sprint 44).
Composer publish validation still uses construction-time env (no publishing
behaviour changes).

---

## Secret Masking

Secret env vars (`WORDPRESS_APP_PASSWORD`, `GHOST_ADMIN_API_KEY`) are never
returned in API responses or dashboard HTML:

- GET responses expose `masked: "****uvwx"` (last four characters)
- Non-secret fields (URLs, usernames, timeouts) return `value`
- PUT preserves existing secrets when the body omits the field or sends a
  masked placeholder (`****…`)

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/providers/config` | All providers with status + field metadata |
| GET | `/providers/config/:providerId` | Single provider detail |
| POST | `/providers/config/:providerId/validate` | Validate without saving |
| PUT | `/providers/config/:providerId` | Validate and save |

Auth middleware applies when `PCME_AUTH_ENABLED=true` (same pattern as calendar).

---

## Dashboard

`/provider-config` page:

- Provider cards with configuration status badges
- Required and optional field lists (secrets masked)
- Edit dialog with Validate and Save buttons
- Health button (reuses `/publishers/:id/health` API)

---

## Future Secret Manager Integration

Sprint 44 deliberately avoids a secrets vault. The overlay store is a stepping
stone:

1. Replace `ProviderConfigStore` persistence with a secret-manager backend
2. Keep the same API shape (`masked` / `value` field semantics)
3. Add encryption at rest for overlay file persistence
4. Wire worker and composer to the same dynamic env resolver

---

## Verification

```bash
pnpm test
pnpm build
pnpm provider-config:smoke
```

---

## Sprint 44 Complete

Provider configuration management is the first operator-facing config module.
Publishing, queue, scheduler, and Publisher SDK designs are unchanged.
