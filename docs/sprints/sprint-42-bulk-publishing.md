# Sprint 42 — Bulk Publishing & Batch Operations

## Objective

Enable operators to publish multiple assets to multiple publishers in a single
batch operation. Reuses the existing BullMQ queue, publisher SDK, duplicate
detection, retry engine, and scheduler from Sprints 23–41.

No BullMQ redesign. No Publisher SDK changes. No worker retry changes. No new
publishers. No scheduling UI. No RBAC.

---

## Batch Workflow

```
Bulk Publish UI
    → POST /composer/bulk-publish (API)
    → for each asset:
        publish(asset, publisherIds[])  [Sprint 41 logic]
    → flatten per-pair results
    → return 202 with summary counts
    → Worker processes each job independently
```

| Step | Action |
|---|---|
| 1. Select assets | Multi-select ready assets from composer list |
| 2. Select publishers | Multi-select enabled publishers from registry |
| 3. Review summary | Pair count = assets × publishers |
| 4. Confirm | Two-step confirmation dialog |
| 5. Enqueue | One BullMQ job per valid (asset × publisher) pair |
| 6. Results | Queued / Duplicates / Validation failures |

---

## API — `POST /composer/bulk-publish`

**Input**

```json
{
  "assetIds": ["asset-001", "asset-002"],
  "publisherIds": ["wordpress", "ghost"]
}
```

**Validation**

Per asset, per publisher, per (asset × publisher) pair — delegated to
`ContentComposerService.publish()` which already performs:

- Asset exists and is `ready`
- Publisher registered, enabled, compatible
- Duplicate detection per pair (skip)
- Thumbnail availability

**Response — `202 Accepted`**

```json
{
  "accepted": [
    { "assetId": "asset-001", "publisherId": "wordpress", "jobId": "42" }
  ],
  "skipped": [
    { "assetId": "asset-001", "publisherId": "ghost", "reason": "Duplicate slug ..." }
  ],
  "failures": [
    { "assetId": "asset-003", "publisherId": "unknown", "reason": "Publisher not registered" }
  ],
  "summary": {
    "assets": 2,
    "publishers": 2,
    "pairs": 4,
    "accepted": 1,
    "skipped": 1,
    "failures": 1
  }
}
```

Limits: max 100 assets, max 20 publishers per request.

---

## Fan-Out Strategy

`bulkPublish()` iterates unique `assetIds` and calls `publish()` for each:

```
for assetId in assetIds:
  publish({ assetId, publisherIds })
    → for publisherId in publisherIds:
        validate → duplicate? → skip
                 → failure?  → record, continue
                 → enqueue   → record jobId
```

Failures on one pair **never** block remaining pairs or assets. Each accepted
pair creates an independent BullMQ job with `publisherId` in the payload.

---

## Duplicate Behavior

Unchanged from Sprint 23/41. Scope is per (projectId, publisher, slug):

| Pair state | Bulk result |
|---|---|
| Slug already published to publisher | `skipped` |
| New slug for publisher | `accepted` (job enqueued) |

The same asset can be accepted for WordPress while skipped for Ghost if only
Ghost has prior history for that slug.

---

## Queue Scalability

- Each valid pair → one `publishing` queue job (same as single publish)
- Jobs use existing retry/backoff configuration
- API returns immediately (HTTP 202) — no synchronous worker wait
- Large batches (up to 100 × 20 = 2000 theoretical pairs) enqueue sequentially
  in-process; worker parallelism handles downstream throughput
- No new queues or workers introduced

---

## Dashboard — Bulk Publish Page

Route: `/bulk-publish`

Features:

- Multi-asset checkbox selector (ready assets from `/composer/assets`)
- Multi-publisher checkbox selector (from `/publishers`)
- Summary panel (assets, publishers, pair count)
- Confirmation dialog
- Results page with queued jobs, duplicates, validation failures

Flow mirrors Composer publish (Sprint 41): confirm → API call → redirect with
encoded result JSON.

---

## Future Progress Tracking

Sprint 42 omits live batch progress. Planned follow-ups:

- Batch job grouping / correlation ID across fan-out jobs
- Progress bar: N of M pairs queued/processed
- Bulk publish history audit log
- Retry failed pairs from results page
- WebSocket updates as worker completes each job

---

## Testing

| Layer | Coverage |
|---|---|
| API route | `composer-bulk-publish.test.ts` |
| Service | `content-composer-service.test.ts` — fan-out, duplicates, large batch |
| Dashboard | `bulk-publish-app.test.ts`, `bulk-publish-renderer.test.ts` |
| Smoke | `pnpm bulk-publish:smoke` |

---

## Verification

```bash
pnpm test
pnpm build
pnpm bulk-publish:smoke
```
