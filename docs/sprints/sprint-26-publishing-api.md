# Sprint 26 — Publishing Management API

## Goal

Expose publishing history and publishing status through the existing Fastify API.
This sprint is **READ-ONLY** — no writes, no auth, no pipeline changes.

---

## Route Overview

All routes are prefixed at `/publishing`.

| Method | Path                  | Description                              |
|--------|-----------------------|------------------------------------------|
| GET    | `/publishing/health`  | Publishing system status                 |
| GET    | `/publishing/history` | Paginated list of published-content rows |
| GET    | `/publishing/:id`     | Single published-content record          |

---

## GET /publishing/health

Returns the current publishing system configuration as read from environment variables.
No database query is performed.

**Response (200)**
```json
{
  "status": "ok",
  "publisherDriver": "mock",
  "queueEnabled": false,
  "retryConfig": {
    "maxRetries": 3,
    "backoffMs": 5000
  },
  "schedulerEnabled": true,
  "duplicateDetectionEnabled": true,
  "aiMetadataProvider": "none",
  "workerVersion": "0.0.0"
}
```

### Fields

| Field                    | Source env var                  | Default |
|--------------------------|---------------------------------|---------|
| `publisherDriver`        | `PUBLISHER_DRIVER`              | `mock`  |
| `queueEnabled`           | `PCME_AUTO_ENQUEUE_PUBLISHING`  | `false` |
| `retryConfig.maxRetries` | `PCME_PUBLISHING_MAX_RETRIES`   | `3`     |
| `retryConfig.backoffMs`  | `PCME_PUBLISHING_BACKOFF_MS`    | `5000`  |
| `schedulerEnabled`       | always `true`                   | —       |
| `duplicateDetectionEnabled` | always `true`                | —       |
| `aiMetadataProvider`     | `AI_METADATA_PROVIDER`          | `none`  |
| `workerVersion`          | `npm_package_version`           | `0.0.0` |

`schedulerEnabled` and `duplicateDetectionEnabled` are always `true` because both features
are baked into the worker; they cannot be disabled without a code change.

---

## GET /publishing/history

Returns a newest-first list of `PublishedContent` records.

### Query Parameters

| Parameter   | Type   | Required | Default | Max |
|-------------|--------|----------|---------|-----|
| `projectId` | string | No       | —       | —   |
| `assetId`   | string | No       | —       | —   |
| `publisher` | string | No       | —       | —   |
| `limit`     | int    | No       | 50      | 200 |

Multiple filters are ANDed together.

### Response (200)

```json
{
  "items": [
    {
      "id": "01J...",
      "projectId": "proj-abc",
      "assetId": "asset-xyz",
      "publisher": "mock",
      "externalId": "post-01J...",
      "url": "https://example.com/posts/my-article",
      "status": "PUBLISHED",
      "publishedAt": "2024-06-01T12:00:00.000Z",
      "createdAt": "2024-06-01T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Errors

| Status | Condition                             |
|--------|---------------------------------------|
| 400    | `limit` is not a positive integer     |
| 400    | `limit` exceeds 200                   |
| 503    | Repository not configured (no DB URL) |

---

## GET /publishing/:id

Returns a single `PublishedContent` record by its primary key.

### Response (200)

```json
{
  "id": "01J...",
  "projectId": "proj-abc",
  "assetId": "asset-xyz",
  "publisher": "mock",
  "externalId": "post-01J...",
  "url": "https://example.com/posts/my-article",
  "status": "PUBLISHED",
  "publishedAt": "2024-06-01T12:00:00.000Z",
  "createdAt": "2024-06-01T12:00:00.000Z"
}
```

### Errors

| Status | Condition                             |
|--------|---------------------------------------|
| 404    | No record found for the given `id`    |
| 503    | Repository not configured (no DB URL) |

> **Route ordering note:** `/publishing/health` is registered before `/publishing/:id` in the
> Fastify plugin, so the literal path `health` is never captured as a dynamic `:id` parameter.

---

## Repository

`PublishedContentRepository` was extended with two new methods (no schema migration required):

```typescript
findHistory(opts: FindPublishedContentHistoryOptions): Promise<PublishedContent[]>
findById(id: string): Promise<PublishedContent | null>
```

`FindPublishedContentHistoryOptions` is exported from `@pcme/database`.

---

## Injection Model

The route plugin (`publishingRoutes`) follows the same injection pattern as the other API routes:

```typescript
// app.ts
app.register(publishingRoutes, {
  publishedContentRepo,   // optional; 503 when absent
  publishingConfig: config,
});
```

In production (`server.ts`), a real `PublishedContentRepository` is created when `DATABASE_URL`
is set. In tests and the offline smoke, a lightweight in-memory mock is injected.

---

## New Config Fields (API)

Added as optional fields to `Config` (read from env vars by `loadConfig()`):

| Field                   | Env var                        |
|-------------------------|--------------------------------|
| `publisherDriver`       | `PUBLISHER_DRIVER`             |
| `autoEnqueuePublishing` | `PCME_AUTO_ENQUEUE_PUBLISHING` |
| `publishingMaxRetries`  | `PCME_PUBLISHING_MAX_RETRIES`  |
| `publishingBackoffMs`   | `PCME_PUBLISHING_BACKOFF_MS`   |
| `aiMetadataProvider`    | `AI_METADATA_PROVIDER`         |

---

## Smoke

```bash
pnpm publishing-api:smoke
```

Fully offline — no network, no database, no Redis.
Uses Fastify's `app.inject()` against an in-memory mock repository.

Covers:
- `GET /publishing/health` — all fields verified
- `GET /publishing/history` — all three records returned
- `GET /publishing/history?projectId=...` — filtered to 2 records
- `GET /publishing/history?publisher=...` — filtered to 1 record
- `GET /publishing/history?limit=1` — limit applied
- `GET /publishing/history?limit=201` — 400 validation error
- `GET /publishing/rec-001` — single record returned
- `GET /publishing/unknown-xyz` — 404 with error message

---

## Future — Authenticated Endpoints

The current implementation has no authentication by design (Sprint 26 scope was read-only,
no auth). Future sprints should add:

1. **API key validation** — middleware that checks an `Authorization: Bearer <key>` header
   against a table of hashed API keys scoped to an organization.
2. **Organization-scoped queries** — add `organizationId` to `findHistory` so tenants cannot
   read each other's history.
3. **Write endpoints** — `POST /publishing/retry/:id` to manually trigger a retry for a failed
   record; `DELETE /publishing/:id` to soft-delete a history row.
4. **Cursor-based pagination** — replace `limit` with `after` / `before` cursors for
   efficient pagination over large history tables.
5. **OpenAPI / JSON Schema** — generate a machine-readable spec from the Fastify schemas
   already present on each route.
