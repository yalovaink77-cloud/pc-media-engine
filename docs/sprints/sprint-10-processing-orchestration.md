# Sprint 10 — Processing Orchestration Foundation

**Status:** Complete  
**Tag:** _not yet tagged_ (pending user sign-off)  
**Depends on:** Sprint 9 — Upload API Foundation

---

## Goal

After a successful media upload, create processing intent records in the database.

Sprint 10 **schedules** processing work only.  
It does **not** execute processing.

---

## What the Orchestrator Does

1. `POST /media` uploads the file and creates an `Asset` record (unchanged from Sprint 9).
2. After the `Asset` is created, `scheduleDefaultJobs()` is called with the asset context.
3. For each default processing type (`thumbnail`), the orchestrator:
   - Checks whether a `ProcessingJob` for `(assetId, processingType)` already exists.
   - If yes — includes the existing job in the response without creating a duplicate.
   - If no — creates a new `ProcessingJob` with `status = pending`.
4. The returned `processingJobs` array is included in the `POST /media` 201 response.

No worker is started.  No queue message is sent.  No `ProcessingJobAttempt` is created.  No `ProcessingArtifact` is created.

---

## Default Processing Types

| Type        | Description                    | Sprint scheduled |
|-------------|--------------------------------|------------------|
| `thumbnail` | Generate a thumbnail image     | Sprint 10        |

Additional types (`waveform`, `transcript`, `ai_analysis`, …) can be added to
`DEFAULT_PROCESSING_TYPES` in `apps/api/src/orchestration/processing.orchestrator.ts`
when the corresponding workers are ready.

---

## Duplicate Job Behaviour

The `ProcessingJob` table has a `@@unique([assetId, processingType])` constraint
(established in Sprint 6). The orchestrator pre-checks with `findByAssetAndType` before
calling `create`, so the response is always idempotent:

- First upload with asset X → job created, `status = pending`.
- Re-upload (or retry) with same `assetId` → existing job returned, no duplicate inserted.

---

## API Response Change

`POST /media` now returns a `processingJobs` array alongside the asset fields.

```json
{
  "id": "abc123",
  "filename": "photo.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 42000,
  "storageKey": "piercingconnect/abc123/photo.jpg",
  "status": "active",
  "processingJobs": [
    {
      "id": "job-xyz",
      "processingType": "thumbnail",
      "status": "pending"
    }
  ]
}
```

If no `jobScheduler` is wired (e.g. during unit tests that don't need it), `processingJobs`
is an empty array — the response is always present and stable.

---

## curl Example

```bash
curl -s -X POST http://localhost:3000/media \
  -F "file=@/path/to/photo.jpg;type=image/jpeg" | jq .
```

Expected output (abridged):
```json
{
  "id": "...",
  "processingJobs": [
    { "id": "...", "processingType": "thumbnail", "status": "pending" }
  ]
}
```

---

## Why Workers and Queues Are Deferred

Workers and queues introduce:
- A runtime dependency (BullMQ / Redis or a custom poller).
- Distributed failure modes (retry storms, dead-letter queues).
- Operational overhead (worker health checks, concurrency limits).

By separating **intent** (this sprint) from **execution** (Sprint 11+), we can:
- Verify the scheduling contract works end-to-end without a running worker.
- Swap the execution backend (in-process, BullMQ, etc.) without touching the API.
- Test the API fully in-memory with no external services.

---

## Changed Files

| File | Change |
|------|--------|
| `apps/api/src/orchestration/processing.orchestrator.ts` | **NEW** — `scheduleDefaultJobs()`, `JobScheduler` interface, `DEFAULT_PROCESSING_TYPES` |
| `apps/api/src/routes/media.ts` | Extended `UploadResponse` with `processingJobs`, added `JobScheduler` to `MediaRouteOptions`, calls orchestrator after asset creation |
| `apps/api/src/app.ts` | Added `jobScheduler?: JobScheduler` to `AppOptions`, passes it to `mediaRoutes` |
| `apps/api/src/server.ts` | Wires real `ProcessingJobRepository` as `jobScheduler` when upload is active |
| `apps/api/src/__tests__/media.test.ts` | Added 7 new test cases for Sprint 10 orchestration behaviour |

---

## Verification

```bash
pnpm --filter @pcme/api test      # 45 tests pass
pnpm --filter @pcme/api lint      # no warnings
pnpm --filter @pcme/database test # 64 tests pass (unchanged)
pnpm --filter @pcme/media test    # 38 tests pass (unchanged)
pnpm build                        # 26/26 packages succeed
```

---

## What Sprint 11 Should Do

1. **Implement a worker** (in-process poller or BullMQ consumer) that picks up `ProcessingJob` rows with `status = pending`.
2. **Execute thumbnail generation** using Sharp for images.
3. On success: create a `ProcessingArtifact`, write `storageKey`, mark the job `completed`.
4. On failure: create a `ProcessingJobAttempt` record with failure reason, increment retry logic.
5. Expose a `GET /media/:id` endpoint that returns asset details including artifact URLs.

---

## Intentionally Deferred

- Queue / BullMQ / Redis — Sprint 11+
- Thumbnail generation (Sharp) — Sprint 11+
- `ProcessingArtifact` creation — Sprint 11+
- `ProcessingJobAttempt` creation — Sprint 11+
- Job priority and retry configuration — Sprint 11+
- Per-project processing type configuration — Sprint 12+
- Auth / multi-tenant project selection — future sprint
