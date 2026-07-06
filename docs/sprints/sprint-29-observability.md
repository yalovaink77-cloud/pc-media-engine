# Sprint 29 — Observability & Metrics

## Goal

Add production-grade, offline-capable observability to PC Media Engine.
Expose a `GET /metrics` endpoint on the API, collect worker-side counters,
surface a metrics section in the dashboard UI, and include a `metricsEnabled`
flag in the health endpoint.

---

## Metrics Model

### Design principles

- **In-process, in-memory counters** — no external dependency required (no Prometheus, no StatsD, no Redis counters).
- **Per-process singletons** — the API and worker are separate processes; each maintains its own `MetricsService` / `WorkerMetricsService`.
- **Injectable** — both classes are injected via constructor/options so they can be replaced with mocks in tests.
- **Offline-capable** — `GET /metrics` always returns a valid response even without a database or Redis connection.
- **Future-compatible** — the `MetricsSnapshot` shape maps 1:1 to Prometheus counter/gauge names (see *Future Prometheus Compatibility* below).

### Counter definitions

| Counter | Tracked by | Description |
|---|---|---|
| `uploadsTotal` | API | Successful `POST /media` uploads (HTTP 201) |
| `processedTotal` | Worker | Publishing jobs that ran the full processor pipeline |
| `publishedTotal` | Worker | Jobs that resulted in `success = true` |
| `retriesTotal` | Worker | Jobs that failed and will be retried (not the last attempt) |
| `failuresTotal` | Worker | Jobs that failed but were NOT skipped (genuine errors) |
| `duplicateSkipsTotal` | Worker | Jobs skipped because `findDuplicate` found an existing record |
| `schedulerJobsTotal` | Worker | Jobs enqueued with a future `scheduledFor` delay |
| `queueWaiting` | API (gauge) | BullMQ queue depth — waiting jobs |
| `queueActive` | API (gauge) | BullMQ queue depth — active jobs |
| `queueCompleted` | API (gauge) | BullMQ queue depth — completed jobs |
| `queueFailed` | API (gauge) | BullMQ queue depth — failed jobs |

### MetricsService (API — `apps/api/src/metrics.ts`)

```typescript
const svc = new MetricsService();
svc.inc('uploadsTotal');          // increment by 1
svc.inc('retriesTotal', 3);       // increment by N
svc.set('queueWaiting', 5);       // set a gauge
const snap = svc.snapshot();      // returns MetricsSnapshot (frozen copy)
svc.reset();                      // zero all counters
```

### WorkerMetricsService (Worker — `apps/worker/src/metrics.ts`)

Mirrors the API class for worker-side counters only (`processedTotal`, `publishedTotal`,
`retriesTotal`, `failuresTotal`, `duplicateSkipsTotal`, `schedulerJobsTotal`).
It is injected into `PublishingProcessorDeps` and `PublishingEnqueueOptions`.

---

## GET /metrics

### Endpoint

```
GET /metrics
```

### Response (JSON)

```json
{
  "uploadsTotal": 42,
  "processedTotal": 38,
  "publishedTotal": 35,
  "retriesTotal": 5,
  "failuresTotal": 2,
  "duplicateSkipsTotal": 3,
  "schedulerJobsTotal": 10,
  "queueWaiting": 0,
  "queueActive": 1,
  "queueCompleted": 35,
  "queueFailed": 2,
  "collectedAt": "2026-07-06T10:30:00.000Z"
}
```

- Always returns HTTP 200.
- When no `MetricsService` is injected (e.g. offline/test mode without DI), all counters default to `0`.
- Queue gauges (`queueWaiting` etc.) are populated by an optional `QueueMetricsProvider` (BullMQ `Queue`). When absent they are `0`.
- `collectedAt` is the ISO timestamp at the time of the response.

### Notes on cross-process metrics

The API and worker are separate OS processes. The `GET /metrics` endpoint reports
what the API process can observe directly:
- `uploadsTotal` — tracked via a Fastify `onSend` hook on successful `POST /media` responses.
- Queue gauges — from BullMQ when Redis is configured.

Worker counters (`processedTotal`, `publishedTotal`, etc.) are tracked locally
within the worker process. In a single-machine deployment they can be exposed
by adding a small HTTP metrics endpoint to the worker (deferred; see Roadmap).
For multi-node deployments, the recommended approach is a shared Redis-based
counter store (also deferred).

---

## GET /health — metricsEnabled

The health endpoint now includes:

```json
{
  "status": "ok",
  "metricsEnabled": true,
  ...
}
```

`metricsEnabled` is `true` when a `MetricsService` instance is wired into the app,
`false` otherwise. This lets monitoring systems detect whether metrics collection
is active without calling `GET /metrics`.

---

## Worker Instrumentation

### publishing.processor.ts

- Increments `duplicateSkipsTotal` before returning early on duplicate detection.
- Increments `processedTotal` after the orchestrator runs (success or failure).
- Increments `publishedTotal` when `result.success === true`.
- Increments `failuresTotal` when `result.success === false && !result.skipped`.
- `metricsService` is optional (`deps.metricsService?: WorkerMetricsService`); absence is a no-op.

### publishing-worker.ts

- Increments `retriesTotal` when a genuine failure occurs and it is *not* the last attempt.

### publishing-enqueue.ts

- Increments `schedulerJobsTotal` when `computeScheduleDelay(payload.scheduledFor) > 0`.

---

## Dashboard Integration

The dashboard UI (`apps/dashboard`) was extended with a **Observability & Metrics** section:

- Fetches `GET /metrics` concurrently with the other dashboard API calls.
- Displays: Uploads, Processed, Published, Retries, Failures, Dup. Skips, Scheduled.
- Displays queue gauges: Waiting, Active, Completed, Failed.
- Shows `collectedAt` timestamp below the metrics cards.
- Gracefully degrades with an "unavailable" message if `GET /metrics` returns an error.

Dashboard client was extended with `fetchMetrics()` on `DashboardApiClient`.
`DashboardPageData` now includes a `metrics: DashboardMetricsData | null` field.

---

## Smoke Test

```bash
pnpm metrics:smoke
```

Runs entirely offline (no Redis, no DB, no network).

**Scenarios covered:**
1. `MetricsService` counter accumulation and `set` for gauges.
2. `MetricsService.reset()` zeroes all counters.
3. `GET /metrics` with no service injected returns all-zero JSON.
4. `GET /metrics` with service injected returns live counter values.
5. `GET /health` — `metricsEnabled` flag reflects service presence.
6. Live counter update visible between consecutive `GET /metrics` requests.

---

## Testing

| Package | Command | Tests |
|---|---|---|
| `@pcme/api` | `pnpm --filter @pcme/api test` | 111 passing |
| `@pcme/dashboard` | `pnpm --filter @pcme/dashboard test` | 45 passing |
| `@pcme/worker` | `pnpm --filter @pcme/worker test` | 145 passing |

New test files:
- `apps/api/src/__tests__/metrics.test.ts` — MetricsService unit + GET /metrics + health flag
- `apps/worker/src/__tests__/worker-metrics.test.ts` — WorkerMetricsService + processor instrumentation
- `apps/dashboard/src/__tests__/renderer.test.ts` — extended with metrics section assertions

---

## Future Prometheus Compatibility

The `MetricsSnapshot` field names are chosen to be directly mappable to
standard Prometheus metric names:

| Snapshot field | Prometheus name | Type |
|---|---|---|
| `uploadsTotal` | `pcme_uploads_total` | counter |
| `processedTotal` | `pcme_processed_total` | counter |
| `publishedTotal` | `pcme_published_total` | counter |
| `retriesTotal` | `pcme_retries_total` | counter |
| `failuresTotal` | `pcme_failures_total` | counter |
| `duplicateSkipsTotal` | `pcme_duplicate_skips_total` | counter |
| `schedulerJobsTotal` | `pcme_scheduler_jobs_total` | counter |
| `queueWaiting` | `pcme_queue_waiting` | gauge |
| `queueActive` | `pcme_queue_active` | gauge |
| `queueCompleted` | `pcme_queue_completed` | gauge |
| `queueFailed` | `pcme_queue_failed` | gauge |

To add Prometheus support later:
1. Accept `Accept: text/plain; version=0.0.4` on `GET /metrics`.
2. Render the snapshot in Prometheus text exposition format (no library required).
3. The `MetricsService` API does not need to change.

---

## Deferred

- Worker HTTP metrics endpoint (for cross-process metric aggregation).
- Redis-backed shared counter store (for multi-node deployments).
- Histogram / latency metrics (p50, p95, p99 for publish duration).
- Alert rules / dashboards in Grafana / Datadog.
- Authentication on `GET /metrics` (currently public, consistent with other read endpoints).
