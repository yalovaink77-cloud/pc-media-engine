# Sprint 24 — Retry Engine Foundation

## Goal

Automatically retry failed publishing jobs with exponential backoff.
Duplicate publications never retry.

No scheduler, dashboard, or UI.

---

## Configuration

| Environment variable            | Default | Meaning                                          |
|---------------------------------|---------|--------------------------------------------------|
| `PCME_PUBLISHING_MAX_RETRIES`   | `3`     | Number of retries after the initial attempt      |
| `PCME_PUBLISHING_BACKOFF_MS`    | `5000`  | Initial exponential backoff delay in ms          |

Total attempts = `PCME_PUBLISHING_MAX_RETRIES + 1` (initial + retries).

---

## Retry lifecycle

```
Job received by BullMQ worker
        │
        ▼
executePublishingJobWithRetry()
        │
        ├─ result.skipped = true  ──────────────▶  return result  (job COMPLETE, no retry)
        │   reason = "duplicate"
        │
        ├─ result.success = true  ──────────────▶  return result  (job COMPLETE)
        │
        └─ result.success = false ──────────────▶  throw Error    (BullMQ retries)
            skipped = false/undef
                        │
                        ├─ attempts remaining  ──▶  backoff delay, re-enqueue
                        └─ attempts exhausted  ──▶  job FAILED (permanent)
```

---

## Backoff strategy

BullMQ exponential backoff: `delay × 2^(attemptsMade)`.

With `PCME_PUBLISHING_BACKOFF_MS=5000` and `PCME_PUBLISHING_MAX_RETRIES=3`:

| Attempt | Delay before next retry |
|---------|------------------------|
| 1       | 5 000 ms               |
| 2       | 10 000 ms              |
| 3       | 20 000 ms              |
| 4       | — (retries exhausted)  |

Retry settings are configured as `defaultJobOptions` on the BullMQ Queue
(producer side via `createPublishingEnqueuer`). The worker throws to trigger
BullMQ's built-in retry scheduling — no custom scheduler needed.

---

## Duplicate behaviour

When `processPublishingJob` returns `{ skipped: true, reason: "duplicate" }`:

- `executePublishingJobWithRetry` **returns** (does not throw).
- BullMQ marks the job **completed** immediately.
- No retry is scheduled.
- `MockPublisher` is never called.
- No `PublishedContent` row is created.

This is correct: a duplicate is an expected outcome, not an error.

---

## Logging

| Event                   | Log prefix                                            |
|-------------------------|-------------------------------------------------------|
| Job starts              | `[publishing-worker] job=X attempt=N/M — starting`   |
| Success                 | `[publishing-worker] job=X attempt=N/M — published …` |
| Duplicate skipped       | `[publishing-worker] job=X attempt=N/M — duplicate — completing without retry` |
| Failure, retry pending  | `[publishing-worker] job=X attempt=N/M — failed, retry scheduled: …` |
| Failure, last attempt   | `[publishing-worker] job=X attempt=N/M — failed, retries exhausted: …` |

---

## Testable unit: `executePublishingJobWithRetry`

The core retry logic is extracted into:

```typescript
executePublishingJobWithRetry(
  payload: PublishingJobPayload,
  context: PublishingJobContext,   // { attemptsMade, totalAttempts, jobId }
  deps: PublishingProcessorDeps,
): Promise<PublishingFlowResult>
```

This function is unit-testable without a BullMQ instance.
`startPublishingWorker` wraps it in the BullMQ Worker callback.

---

## Verification

```bash
pnpm --filter @pcme/worker test   # 113 tests
pnpm --filter @pcme/publishing test
pnpm build                        # 26/26 tasks
pnpm retry:smoke
```

---

## Future: dead-letter queue

When all retries are exhausted BullMQ moves the job to the `failed` state.
A future sprint can add a dead-letter queue handler that:
- Persists a `PublishedContent` row with `status: 'failed'`.
- Sends an alert or notification.
- Enables manual requeue via an admin endpoint.

---

## Recommended commit message

```
feat(worker): add exponential retry engine for publishing failures (Sprint 24)

- Add publishingMaxRetries + publishingBackoffMs to WorkerConfig
  (PCME_PUBLISHING_MAX_RETRIES, PCME_PUBLISHING_BACKOFF_MS)
- Set defaultJobOptions (attempts, exponential backoff) on publishing queue
- Extract executePublishingJobWithRetry for unit-testable retry logic
- Worker throws for genuine failures (BullMQ retries), returns for duplicates
- Add retry.test.ts: 14 tests (config, success, duplicate, failure, retry, exhausted)
- Add retry:smoke (offline, counting publisher: fail×2 → succeed×1)
```
