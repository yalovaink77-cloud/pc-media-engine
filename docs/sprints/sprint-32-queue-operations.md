# Sprint 32 — Queue Operations

## Goal

Add operational queue management to PC Media Engine. Operators can inspect, pause, resume, drain, retry failed jobs, and remove individual jobs via authenticated API endpoints. The Dashboard gains a read-only queue status section.

---

## Architecture

```
apps/api/src/
  queue/
    queue-service.ts          — QueueService interface + error types
    bullmq-queue-service.ts   — BullMQ-backed production implementation
  routes/
    queue.ts                  — GET /queue/status + mutation routes
apps/dashboard/src/
  types.ts                    — DashboardQueueData type added
  client.ts                   — fetchQueueStatus() added
  renderer.ts                 — renderQueueStatus() section added
  config.ts                   — DASHBOARD_API_KEY optional env var
```

---

## Queue Lifecycle

```
                  ┌─────────────────────────────────────────┐
                  │               BullMQ Queue               │
                  │                                          │
enqueue ──────►  waiting ──► active ──► completed           │
                  │            │                             │
                  │            └──► failed ──► retry ──►  waiting
                  │                              │
                  │                              └──► (exhausted → stays failed)
                  │                                          │
                  │  drain() removes all waiting jobs        │
                  │  pause() stops workers picking up jobs   │
                  └─────────────────────────────────────────┘
```

---

## API Endpoints

All routes are **protected with `requireAuth`** from Sprint 31.
When no queue service is available (no Redis), all routes return `503`.
When auth is disabled (`PCME_AUTH_ENABLED` is not `"true"`), all routes are open.

### GET /queue/status

Returns the current queue counts and paused state.

```http
GET /queue/status
Authorization: Bearer <jwt>
```

```json
{
  "paused": false,
  "waiting": 3,
  "active": 1,
  "delayed": 0,
  "completed": 847,
  "failed": 2
}
```

### POST /queue/pause

Pauses the queue — the worker stops picking up new jobs. In-flight jobs finish normally.

```http
POST /queue/pause
Authorization: Bearer <jwt>
```

```json
{ "success": true, "message": "Queue paused" }
```

### POST /queue/resume

Resumes a paused queue.

```http
POST /queue/resume
Authorization: Bearer <jwt>
```

### POST /queue/drain

Removes all **waiting** jobs from the queue. Active, delayed, completed, and failed jobs are unaffected.

```http
POST /queue/drain
Authorization: Bearer <jwt>
```

### POST /queue/jobs/:id/retry

Retries a specific failed job by ID.

- Returns `404` if the job does not exist.
- Returns `409` if the job is not in the `failed` state.

```http
POST /queue/jobs/abc123/retry
Authorization: Bearer <jwt>
```

### DELETE /queue/jobs/:id

Removes a job from the queue entirely.

- Returns `404` if the job does not exist.

```http
DELETE /queue/jobs/abc123
Authorization: Bearer <jwt>
```

---

## Operational Commands Reference

| Intent                          | Command                             |
|---------------------------------|-------------------------------------|
| Check queue state               | `GET /queue/status`                 |
| Stop processing new jobs        | `POST /queue/pause`                 |
| Resume processing               | `POST /queue/resume`                |
| Clear the backlog               | `POST /queue/drain`                 |
| Re-run a specific failed job    | `POST /queue/jobs/:id/retry`        |
| Remove a specific job           | `DELETE /queue/jobs/:id`            |

---

## QueueService abstraction

The `QueueService` interface decouples routes from BullMQ:

```typescript
interface QueueService {
  getStatus(): Promise<QueueStatus>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  drain(): Promise<void>;
  retryJob(jobId: string): Promise<void>;
  removeJob(jobId: string): Promise<void>;
}
```

The BullMQ implementation (`createBullMqQueueService`) wraps the `publishing` queue. Tests inject lightweight in-memory mocks.

**Error types:**
- `QueueJobNotFoundError` — job does not exist in BullMQ → `404`
- `QueueJobStateError` — job exists but not in a retriable state → `409`

---

## Dashboard

The dashboard now fetches `GET /queue/status` on every page load and renders a **read-only** queue section.

### Configuration

`DASHBOARD_API_KEY` (optional) — API key sent as `X-API-Key` when calling authenticated endpoints. Required when `PCME_AUTH_ENABLED=true` in production.

When queue status is unavailable (no Redis, or 401 from the API), the section shows a graceful "unavailable" message rather than an error.

### Display

- `State: Running / Paused` badge
- Cards for: Waiting, Active, Delayed, Completed, Failed

No action buttons — mutation controls are deferred to Sprint 33+.

---

## Testing

| Suite | Tests |
|---|---|
| Queue API routes (all 6 endpoints + error cases + auth enforcement) | 19 |
| Dashboard renderer — queue section (null, running, paused) | 4 |
| Dashboard app (mock client includes fetchQueueStatus) | 12 |

---

## Smoke test

`pnpm queue:smoke` — 22 offline checks using an in-memory mock `QueueService`:

1. 503 when no service
2. 401 without credentials
3. Correct counts with Bearer JWT
4. Correct counts with X-API-Key
5. pause → queue becomes paused
6. resume → queue becomes running
7. drain → waiting count drops to 0
8. retry success for failed job
9. retry → 404 for unknown job
10. retry → 409 for non-failed job
11. delete removes job
12. delete → 404 for unknown job
13. All routes accessible when auth is disabled

---

## Future dashboard controls (Sprint 33+)

- Pause / Resume buttons in the queue section
- Drain button with confirmation dialog
- Per-job retry and delete actions in a failed-jobs list
- Auto-refresh queue counts every 30 s

---

## Known limitations (Sprint 32)

- `drain()` removes waiting jobs only; delayed jobs are unaffected (by design — delayed jobs are scheduled publishes).
- Queue service manages only the `publishing` queue; the `processing` queue has no management UI yet.
- Dashboard queue status requires `DASHBOARD_API_KEY` when auth is enabled — this is a manual configuration step.
