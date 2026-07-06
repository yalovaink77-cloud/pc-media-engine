# Sprint 38 — Publishing Jobs Management

## Objective

Expose publishing jobs through a read-only management interface with detailed
inspection and operational actions using the existing BullMQ queue infrastructure.
No changes to publishing logic, scheduler, or retry engine.

---

## Job Lifecycle

Publishing jobs live in the BullMQ `publishing` queue:

```
Enqueue (POST pipeline / scheduler)
    → waiting
    → active (worker processing)
    → completed (success or duplicate skip)
    → failed (after retries exhausted)
```

Delayed jobs use BullMQ `delay` when `scheduledFor` is set in the payload.

| State | Meaning |
|---|---|
| `waiting` | Queued, not yet picked up |
| `active` | Worker is processing |
| `delayed` | Scheduled for future execution |
| `completed` | Finished (success or idempotent skip) |
| `failed` | Exhausted retries — operator action may be needed |

Jobs are ephemeral in Redis. Successful publishes may also create a
`PublishedContent` row in PostgreSQL — there is no FK between queue job ID
and database records.

---

## API Endpoints

All endpoints require authentication (same as `/queue/*`).

| Endpoint | Purpose |
|---|---|
| `GET /jobs` | Paginated job list with filters |
| `GET /jobs/:id` | Full job detail |

### Query parameters (`GET /jobs`)

| Param | Description |
|---|---|
| `status` | BullMQ state: waiting, active, delayed, failed, completed |
| `publisher` | Filter by configured publisher driver |
| `projectId` | Filter by payload `projectId` |
| `assetId` | Filter by payload `assetId` |
| `limit` | Page size (default 50, max 200) |
| `offset` | Pagination offset |

### Response fields

**List item:** id, status, publisher, title, slug, retry count, created/updated timestamps

**Detail:** payload summary (no media blobs), error info, retry history, queue state,
scheduled time, timestamps, queue paused flag

---

## Queue Integration

The API extends `QueueService` with:

- `listJobs(query, publisherDriver)` — BullMQ `getJobs()` + in-memory filter/paginate
- `getJob(id, publisherDriver)` — BullMQ `getJob()` + state resolution

Operational actions reuse Sprint 32 endpoints:

| Action | API | Dashboard proxy |
|---|---|---|
| Retry failed job | `POST /queue/jobs/:id/retry` | `POST /ops/jobs/:id/retry` |
| Remove job | `DELETE /queue/jobs/:id` | `POST /ops/jobs/:id/remove` |

The dashboard job detail page links directly to these existing queue APIs.

---

## Retry Visibility

Job detail exposes retry information from BullMQ metadata:

- `retryCount` — `attemptsMade`
- `maxAttempts` — `opts.attempts`
- `error.message` — `failedReason`
- `error.stacktrace` — BullMQ stack traces
- `retryHistory` — per-attempt errors derived from stacktrace/failedReason

This is read-only visibility — the retry engine itself is unchanged.

---

## Dashboard

| Route | Page |
|---|---|
| `GET /jobs` | Job table with filter form |
| `GET /jobs/:id` | Job detail with metadata, payload, errors, retry history |
| `POST /ops/jobs/:id/retry` | Retry action (PRG flash on detail page) |
| `POST /ops/jobs/:id/remove` | Remove action (redirect to jobs list on success) |

Navigation: Dashboard → Publishers → **Jobs**

Requires `DASHBOARD_API_KEY` when `PCME_AUTH_ENABLED=true`.

---

## Architecture

```
Browser ──GET /jobs──▶ Dashboard SSR ──GET /jobs + X-API-Key──▶ API ──▶ BullMQ Queue

Browser ──POST /ops/jobs/:id/retry──▶ Dashboard ──POST /queue/jobs/:id/retry──▶ API
```

Media buffers are stripped from all API responses.

---

## Testing

| File | Coverage |
|---|---|
| `apps/api/src/__tests__/jobs.test.ts` | API routes, filters, pagination, 404 |
| `apps/api/src/__tests__/job-mapper.test.ts` | Payload sanitization, DTO mapping |
| `apps/dashboard/src/__tests__/jobs-renderer.test.ts` | Table, filters, detail page |
| `apps/dashboard/src/__tests__/jobs-app.test.ts` | Routes, retry redirect |

---

## Smoke

```
pnpm jobs:smoke
```

Runs offline API smoke (mocked `QueueService`) and dashboard smoke (mocked client).

---

## Future Work

- **Advanced filtering** — date range, full-text search on title/slug
- **Bulk retry** — retry all failed jobs matching filters
- **Job ↔ history join** — correlate queue jobs with `PublishedContent` rows
- **Processing queue UI** — extend pattern to `processing` BullMQ queue
- **Live updates** — WebSocket push for job state changes

---

## Verification

```
pnpm test
pnpm build
pnpm jobs:smoke
```
