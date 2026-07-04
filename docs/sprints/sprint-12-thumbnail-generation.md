# Sprint 12 — Thumbnail Generation

**Status:** Complete  
**Tag:** _not yet tagged_ (pending user sign-off)  
**Depends on:** Sprint 11 — Queue & Worker Foundation

---

## Goal

Implement the first real media processor: generate a WebP thumbnail from an uploaded image asset using Sharp, write it to local storage, and record a `ProcessingArtifact`.

---

## Thumbnail Pipeline

```
Queue message { processingJobId }
        │
        ▼
dispatchJob()                      ← lifecycle wrapper
  ├─ Load ProcessingJob from DB    ← findByIdGlobal (no project scope)
  ├─ Mark job running
  ├─ Create ProcessingJobAttempt   (status = running)
  ├─ Record attempt startedAt
  │
  └─ thumbnailProcessor()          ← type-specific processor
       ├─ Load Asset from DB       ← findByIdGlobal
       ├─ Read source file         ← LocalStorageProvider.get(asset.storageKey)
       ├─ Sharp: resize + encode   ← webp, 512px wide, keep ratio, no enlarge, quality 80
       ├─ Write thumbnail          ← LocalStorageProvider.put(thumbKey, …)
       └─ Create ProcessingArtifact
            ├─ mimeType = image/webp
            ├─ storageKey = {dir}/{basename}_thumb.webp
            └─ storageKeyPlaceholder = {projectId}/{assetId}/thumbnail-pending
  │
  ├─ Mark attempt completed
  └─ Mark job completed

On error in thumbnailProcessor:
  ├─ Mark attempt failed  (failureReason = err.message)
  ├─ Mark job failed      (failureReason = err.message)
  └─ Re-throw → BullMQ marks queue job as failed
```

---

## Sharp Configuration

| Property          | Value                    |
|-------------------|--------------------------|
| Output format     | WebP                     |
| Width             | 512 px (max)             |
| Height            | proportional             |
| Aspect ratio      | preserved                |
| Enlargement       | disabled (`withoutEnlargement: true`) |
| Quality           | 80                       |
| MIME type         | `image/webp`             |

---

## Storage Key Format

| File         | Key pattern                               | Example |
|--------------|-------------------------------------------|---------|
| Source image | `{projectSlug}/{assetId}/{filename}`      | `piercingconnect/abc123/photo.jpg` |
| Thumbnail    | `{projectSlug}/{assetId}/{basename}_thumb.webp` | `piercingconnect/abc123/photo_thumb.webp` |

The thumbnail key is derived from the source key by replacing the extension with `_thumb.webp`. The directory (project + asset segments) is preserved.

---

## Artifact Lifecycle

1. `POST /media` creates an `Asset` and a pending `ProcessingJob` (Sprint 10 — unchanged).
2. When a worker picks up the job, `dispatchJob` runs the lifecycle.
3. `thumbnailProcessor` writes the thumbnail file and creates a `ProcessingArtifact` with:
   - `storageKeyPlaceholder` — records original intent (`{projectId}/{assetId}/thumbnail-pending`)
   - `storageKey` — the real path once the file is written
   - `sizeBytes` — exact byte length of the WebP output
4. `ProcessingJob.status` transitions: `pending → running → completed` (or `failed`).
5. `ProcessingJobAttempt` records the execution history for each run.

---

## Why Only One Thumbnail Size

Sprint 12 focuses on proving the end-to-end pipeline, not on configuration. A single 512 px wide WebP thumbnail satisfies the immediate need (preview images) and keeps the processor simple. Multiple sizes (e.g. 256 px, 1024 px) require a size-config system that belongs in Sprint 13+.

---

## How to Run the Smoke

```bash
docker compose up -d
pnpm --filter @pcme/database db:migrate
pnpm --filter @pcme/database db:seed
pnpm --filter @pcme/worker smoke
```

If `STORAGE_LOCAL_ROOT` is not set, the smoke creates a temporary directory, writes a test JPEG there, runs the pipeline, verifies the output WEBP, and cleans up.

Expected output (abridged):
```
═══ Sprint 12 Worker Smoke (thumbnail generation) ═══

▶ Step 1 — Connecting to database...
  ✓ Postgres reachable
▶ Step 2 — Resolving a pending ProcessingJob...
  ✓ Using existing pending job (id=..., type=thumbnail)
▶ Step 3 — Ensuring source image exists in storage...
  ✓ Source image already exists at piercingconnect/...
▶ Step 4 — Connecting to Redis...
  ✓ Redis reachable
▶ Step 5 — Starting in-process worker...
  ✓ Worker ready
▶ Step 6 — Enqueueing processing job...
  ✓ Enqueued BullMQ job
▶ Step 7 — Waiting for worker to process...
  ✓ Worker completed
▶ Step 8 — Verifying database state...
  ✓ ProcessingJob status = completed
  ✓ ProcessingJobAttempt (number=1) status = completed
  ✓ ProcessingArtifact created (mimeType=image/webp)
    storageKey = piercingconnect/.../photo_thumb.webp
  ✓ Thumbnail file exists (N bytes)
  ✓ Thumbnail is valid WEBP (512×...)

╔════════════════════════════════════════════════════════════════════╗
║ ✅ Smoke PASSED — Sprint 12 thumbnail generation verified          ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## Changed Files

| File | Change |
|------|--------|
| `packages/database/src/repositories/media.repository.ts` | Added `findByIdGlobal(assetId)` — internal worker lookup without project scope |
| `apps/worker/package.json` | Added `@pcme/media`, `sharp`; updated scripts |
| `apps/worker/src/config.ts` | Added `storageLocalRoot` to `WorkerConfig` and `loadWorkerConfig()` |
| `apps/worker/src/processors/thumbnail.processor.ts` | **NEW** — `thumbnailProcessor`, `buildThumbnailKey`, `AssetNotFoundError`, `ThumbnailDeps` |
| `apps/worker/src/processors/dispatch.ts` | **NEW** — `dispatchJob` lifecycle wrapper + type router (replaces noop in worker.ts) |
| `apps/worker/src/worker.ts` | Updated — creates `MediaAssetRepository`, `ProcessingArtifactRepository`, `LocalStorageProvider`; calls `dispatchJob` |
| `apps/worker/src/scripts/worker-smoke.ts` | Updated — creates test source image, verifies artifact and WEBP file |
| `apps/worker/src/__tests__/thumbnail.processor.test.ts` | **NEW** — 16 tests (real Sharp, mocked repos/storage) |
| `apps/worker/src/__tests__/dispatch.test.ts` | **NEW** — 11 tests (mocked thumbnailProcessor, lifecycle assertions) |
| `docs/sprints/sprint-12-thumbnail-generation.md` | **NEW** — this document |

---

## Verification

```
pnpm --filter @pcme/worker test     50 tests — 4 files pass
pnpm --filter @pcme/worker lint     clean
pnpm --filter @pcme/media test      38 tests pass (unchanged)
pnpm --filter @pcme/database test   64 tests pass (findByIdGlobal added)
pnpm build                          26/26 packages succeed
```

---

## What Sprint 13 Should Do

1. **Multiple thumbnail sizes** — add a size-config system (256 px, 512 px, 1024 px).
2. **`GET /media/:id`** endpoint — return asset + artifact URLs (public URL via `storageProvider.getPublicUrl`).
3. **Retry backoff** — configure BullMQ `attempts` and exponential backoff on the `processing` queue.
4. **Auto-enqueue from `POST /media`** — enqueue immediately after `ProcessingJob` creation so uploads start processing without a manual smoke trigger.
5. **Checksum** — compute SHA-256 of the thumbnail and store it on `ProcessingArtifact.checksum`.
6. **Video thumbnails** — add FFmpeg-based processor for `video/mp4` assets.

---

## Intentionally Deferred

- Multiple thumbnail sizes — Sprint 13+
- `GET /media/:id` with artifact URL — Sprint 13+
- Auto-enqueue from `POST /media` — Sprint 13+
- Retry backoff — Sprint 13+
- Checksum on artifact — Sprint 13+
- Video / audio processing (FFmpeg) — Sprint 14+
- Cloud storage (S3/R2) — future sprint
- Auth / multi-tenant — future sprint
