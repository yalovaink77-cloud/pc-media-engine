# Sprint 11 — Queue & Worker Foundation

**Status:** Complete  
**Tag:** _not yet tagged_ (pending user sign-off)  
**Depends on:** Sprint 10 — Processing Orchestration Foundation

---

## Goal

Introduce the minimal queue and worker runtime foundation for processing jobs.

Sprint 11 **schedules and executes the worker lifecycle** only.  
It does **not** perform real media processing (no Sharp, no FFmpeg).

---

## Queue

| Property    | Value              |
|-------------|--------------------|
| Engine      | BullMQ (Redis)     |
| Queue name  | `processing`       |
| Payload     | `{ processingJobId: string }` |
| Concurrency | `WORKER_CONCURRENCY` env var (default: 5) |

The payload is deliberately minimal. The worker loads all job details from the database using `processingJobId`. This decouples the queue contract from the database schema — adding fields to `ProcessingJob` does not require changing the queue payload.

---

## No-op Processor Behaviour

For every dequeued job the worker:

1. Validates the BullMQ job payload (throws `PayloadValidationError` on bad data — job fails immediately, no retry).
2. Loads `ProcessingJob` from the database by ID (no project scope — worker is internal).
3. Marks the job `running` with `startedAt`.
4. Gets the next `attemptNumber` and creates a `ProcessingJobAttempt` (status `running`).
5. Records `startedAt` on the attempt.
6. **[No-op]** — real processor dispatch by `processingType` goes here in Sprint 12.
7. Marks the attempt `completed` with `completedAt`.
8. Marks the `ProcessingJob` `completed` with `completedAt`, clears `failureReason`.

No `ProcessingArtifact` is created. No files are read or written.

---

## Why Real Processing Is Deferred

Sprint 11 validates the end-to-end queue infrastructure:

- Redis connectivity
- BullMQ Worker lifecycle (start, process, complete, close)
- Database write path for `ProcessingJobAttempt`
- Idiomatic error handling (failed payload → failed BullMQ job)

Sprint 12 adds the real processor dispatch (`switch (processingType)`) and integrates Sharp for thumbnail generation. Keeping the processor as a no-op allows this infra sprint to be verified without any media files or image libraries.

---

## How to Run the Worker Smoke

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Apply migrations + seed
pnpm --filter @pcme/database db:migrate
pnpm --filter @pcme/database db:seed

# 3. Run smoke (finds or creates a pending job, enqueues it, processes it in-process)
pnpm --filter @pcme/worker smoke
```

Expected output (abridged):
```
═══ Sprint 11 Worker Smoke ═══

▶ Step 1 — Connecting to database...
  ✓ Postgres reachable
▶ Step 2 — Resolving a pending ProcessingJob...
  ✓ Using existing pending job (id=..., type=thumbnail)
▶ Step 3 — Connecting to Redis...
  ✓ Redis reachable
▶ Step 4 — Starting in-process worker...
  ✓ Worker ready
▶ Step 5 — Enqueueing processing job...
  ✓ Enqueued BullMQ job
▶ Step 6 — Waiting for worker to process...
  ✓ Worker completed
▶ Step 7 — Verifying database state...
  ✓ ProcessingJob status = completed
  ✓ ProcessingJobAttempt (number=1) status = completed

╔══════════════════════════════════════════════════════════════════╗
║ ✅ Smoke PASSED — Sprint 11 queue + worker verified              ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## How to Start the Worker

```bash
# Development (with hot reload via tsx)
pnpm --filter @pcme/worker dev

# Production (compiled JS)
pnpm --filter @pcme/worker start
```

Environment variables:

| Variable             | Default                         | Purpose                     |
|----------------------|---------------------------------|-----------------------------|
| `REDIS_URL`          | `redis://localhost:6379`        | BullMQ Redis connection     |
| `DATABASE_URL`       | _(required)_                    | Prisma Postgres connection  |
| `WORKER_CONCURRENCY` | `5`                             | Max parallel jobs           |
| `LOG_LEVEL`          | `info`                          | Pino/console log verbosity  |

---

## Changed Files

| File | Change |
|------|--------|
| `packages/database/src/repositories/processing.repository.ts` | Added `findByIdGlobal(jobId)` — internal worker lookup without project scope |
| `apps/worker/package.json` | Added `bullmq`, `@pcme/database`, `dotenv` deps; `vitest`, `tsx` devDeps; `test`, `dev`, `start`, `smoke` scripts |
| `apps/worker/src/index.ts` | **Replaced** scaffold with real entry point — loads dotenv, starts worker, handles SIGTERM/SIGINT |
| `apps/worker/src/config.ts` | **NEW** — `WorkerConfig`, `loadWorkerConfig()`, `parseRedisConnection()` |
| `apps/worker/src/worker.ts` | **NEW** — `startWorker()` factory wrapping BullMQ `Worker` |
| `apps/worker/src/queue/names.ts` | **NEW** — `PROCESSING_QUEUE = 'processing'` constant |
| `apps/worker/src/queue/payload.ts` | **NEW** — `ProcessingJobPayload` type, `PayloadValidationError`, `validateJobPayload()` |
| `apps/worker/src/processors/noop.processor.ts` | **NEW** — `noopProcessor()`, `ProcessorDeps`, `ProcessingJobNotFoundError` |
| `apps/worker/src/scripts/worker-smoke.ts` | **NEW** — end-to-end smoke using in-process worker + QueueEvents |
| `apps/worker/src/__tests__/payload.test.ts` | **NEW** — 12 payload validation tests (no Redis, no DB) |
| `apps/worker/src/__tests__/noop.processor.test.ts` | **NEW** — 11 processor tests with mocked repositories (no Redis, no DB) |
| `docs/sprints/sprint-11-queue-worker-foundation.md` | **NEW** — this document |

---

## Verification

```
pnpm --filter @pcme/worker test      23 tests — 2 files pass
pnpm --filter @pcme/worker lint      clean
pnpm --filter @pcme/api test         45 tests pass (unchanged)
pnpm --filter @pcme/database test    64 tests pass (+findByIdGlobal added to repo)
pnpm build                           26/26 packages succeed
```

---

## What Sprint 12 Should Do

1. **Dispatch by `processingType`** — replace the no-op comment with a `switch` on `job.processingType`.
2. **Thumbnail processor** — use Sharp to resize the source image, write the output via `LocalStorageProvider`.
3. **Create `ProcessingArtifact`** — with real `storageKey`, `mimeType`, `sizeBytes`, `checksum`.
4. **Failure handling** — on processor error: mark attempt failed, increment `retryCount`, mark job failed with `failureReason`.
5. **BullMQ retry config** — configure `attempts` and backoff on the queue to retry failed jobs.
6. **GET /media/:id** endpoint — return asset + artifact URLs once processing completes.

---

## Intentionally Deferred

- Thumbnail generation (Sharp) — Sprint 12
- `ProcessingArtifact` creation — Sprint 12
- Retry backoff configuration — Sprint 12
- Multi-queue / priority workers — Sprint 13+
- Worker health endpoint — Sprint 13+
- Enqueue from `POST /media` automatically — Sprint 12+ (currently manual/smoke only)
- Auth / multi-tenant queue routing — future sprint
