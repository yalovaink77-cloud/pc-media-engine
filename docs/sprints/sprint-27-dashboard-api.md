# Sprint 27 — Dashboard Backend API

## Goal

Create read-only dashboard API endpoints that summarise system status for a future dashboard UI.
This sprint is **backend API only** — no frontend, no auth, no mutations.

---

## Endpoint List

| Method | Path                  | Description                                          |
|--------|-----------------------|------------------------------------------------------|
| GET    | `/dashboard/health`   | API + database + publishing system status            |
| GET    | `/dashboard/summary`  | Aggregate publishing statistics + system flags       |
| GET    | `/dashboard/recent`   | Newest publishing-history rows (paginated)           |

---

## GET /dashboard/health

Returns a combined health snapshot covering the API process, optional database liveness,
and the publishing subsystem configuration.
No database query is required for the publishing block; it reads env-derived config.

**Response (200)**
```json
{
  "status": "ok",
  "database": "ok",
  "publishing": {
    "publisherDriver": "mock",
    "queueEnabled": false,
    "retryConfig": {
      "maxRetries": 3,
      "backoffMs": 5000
    }
  },
  "version": "0.0.0",
  "env": "development"
}
```

`database` mirrors the same values used by `GET /health`: `"ok"`, `"unavailable"`, or `"skipped"`.

---

## GET /dashboard/summary

Returns aggregate publishing statistics together with always-on system capability flags.
Backed by three Prisma queries that run in parallel (`Promise.all`):
1. `groupBy status` → counts per status value
2. `groupBy publisher` → per-publisher counts, descending
3. `findFirst orderBy publishedAt desc` → most-recent publish timestamp

**Response (200)**
```json
{
  "totalPublished": 42,
  "totalDrafts": 3,
  "totalFailed": 1,
  "latestPublishedAt": "2024-06-01T12:00:00.000Z",
  "publishers": [
    { "publisher": "wordpress", "count": 40 },
    { "publisher": "mock", "count": 6 }
  ],
  "duplicateDetectionEnabled": true,
  "schedulerEnabled": true,
  "retryEnabled": true,
  "aiProvider": "none",
  "publisherDriver": "mock"
}
```

`latestPublishedAt` is `null` when the `published_content` table is empty.

`duplicateDetectionEnabled`, `schedulerEnabled`, and `retryEnabled` are always `true` — these
features are baked into the worker and cannot be disabled without a code change.

### Errors

| Status | Condition |
|--------|-----------|
| 503    | Repository not configured (no `DATABASE_URL`) |

---

## GET /dashboard/recent

Returns the N most recently published rows, newest first.

### Query Parameters

| Parameter | Type | Required | Default | Max |
|-----------|------|----------|---------|-----|
| `limit`   | int  | No       | 10      | 50  |

**Response (200)**
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
      "status": "published",
      "publishedAt": "2024-06-01T12:00:00.000Z",
      "createdAt": "2024-06-01T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

An empty `published_content` table returns `{ "items": [], "count": 0 }` with status 200.

### Errors

| Status | Condition |
|--------|-----------|
| 400    | `limit` is not a positive integer |
| 400    | `limit` exceeds 50 |
| 503    | Repository not configured (no `DATABASE_URL`) |

---

## Repository Changes

`PublishedContentRepository` gained two new methods (no schema migration required):

```typescript
getSummaryStats(): Promise<PublishedContentSummaryStats>
findRecent(limit: number): Promise<PublishedContent[]>
```

New exported types from `@pcme/database`:
- `PublishedContentSummaryStats`
- `PublishedContentPublisherCount`

---

## Injection Model

`dashboardRoutes` follows the same injection pattern as the other route plugins:

```typescript
// app.ts
app.register(dashboardRoutes, {
  repo: dashboardRepo,        // optional DashboardDataProvider; 503 when absent
  checkDatabase,              // optional; reused from existing health infrastructure
  publishingConfig: config,   // config subset already present
});
```

In production (`server.ts`), the same `PublishedContentRepository` instance satisfies both
`PublishedContentFinder` (publishing routes) and `DashboardDataProvider` (dashboard routes),
avoiding a second connection or client allocation.

---

## Read-Only Behaviour

- No mutations in any dashboard endpoint.
- No retries triggered by any dashboard call.
- No queue control or queue introspection (BullMQ state not exposed in this sprint).
- Database access is scoped to `SELECT` equivalents only (Prisma `findMany`, `groupBy`, `findFirst`).

---

## Smoke

```bash
pnpm dashboard-api:smoke
```

Fully offline — no network, no database, no Redis.
Uses Fastify `inject()` with an in-memory `DashboardDataProvider` mock.

Covers all three endpoints, limit validation, empty-history behaviour, and 503 when no repo.

---

## Why UI, Auth, and Queue Controls Are Deferred

| Concern | Why deferred |
|---------|--------------|
| **Dashboard UI** | The API surface is the stable contract. A React/Next.js frontend can be added independently once the API is confirmed stable. Mixing backend and frontend work in a single sprint risks scope creep and slows CI. |
| **Authentication** | Auth adds cross-cutting infrastructure (API keys, session tokens, middleware, per-org scoping). This is a standalone sprint — adding it here would double the scope with no user-visible benefit until there is also a UI. |
| **Queue controls** (`pause`, `resume`, `drain`) | BullMQ queue management endpoints are write operations that can affect the running worker. They require auth to be safe and belong in a dedicated "Queue Management" sprint with proper rollback consideration. |
| **Cursor pagination** | The `limit` parameter is sufficient for MVP. Cursor-based pagination (`after`/`before`) can be added later when history tables grow large enough that offset-style queries become slow. |
