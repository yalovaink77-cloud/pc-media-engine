# Sprint 41 — Multi-Publisher Publish Workflow

## Objective

Complete the first end-to-end publishing workflow. Operators can initiate
publishing from the Composer UI to one or more registered publishers using the
existing BullMQ queue and worker publishing pipeline.

No BullMQ architecture changes. No retry engine changes. No scheduler changes.
No Publisher SDK redesign. No new publishers. No RBAC.

---

## Workflow

```
Composer UI
    → POST /composer/publish (API)
    → per-publisher validate + duplicate check
    → enqueue one BullMQ job per accepted publisher
    → return 202 with summary (no wait for completion)
    → Worker processes jobs independently
```

| Step | Action |
|---|---|
| 1. Select asset | Operator picks a `ready` asset in Composer |
| 2. Select publishers | Multi-select checkboxes for compatible providers |
| 3. Publish | Two-step confirm → API publish |
| 4. Summary | Queued / Skipped / Validation failures shown |
| 5. Worker | Existing publishing processor handles each job |

The dashboard does **not** poll job progress in Sprint 41. Operators use the
Jobs page for follow-up.

---

## API — `POST /composer/publish`

**Input**

```json
{
  "assetId": "asset-001",
  "publisherIds": ["wordpress", "ghost"]
}
```

**Validation (per publisher)**

- Asset exists and is `ready`
- Publisher registered and enabled
- Publisher compatible (capabilities + env config)
- Duplicate detection (skip, not failure)

**Response — `202 Accepted`**

```json
{
  "assetId": "asset-001",
  "accepted": [{ "publisherId": "wordpress", "jobId": "42" }],
  "skipped": [{ "publisherId": "ghost", "reason": "Duplicate slug ..." }],
  "failures": [{ "publisherId": "unknown", "reason": "Publisher not registered" }]
}
```

The handler returns immediately after enqueue. It does not await worker completion.

---

## Queue Integration

Publishing jobs use the existing `publishing` BullMQ queue:

- API-side `PublishingQueueEnqueuer` calls `queue.add('publish', payload)`
- Payload includes `publisherId` for per-provider routing and duplicate keys
- Same retry/backoff options as auto-enqueue paths (`publishingMaxRetries`, `publishingBackoffMs`)
- Requires Redis (`REDIS_URL`); returns `503` when queue unavailable

Thumbnail media is loaded from storage at publish time and embedded in the job
payload (base64), matching the worker contract.

---

## Multi-Publisher Fan-Out

`ContentComposerService.publish()` iterates `publisherIds` independently:

```
for each publisherId:
  validate → duplicate? → skip
           → failure?  → record failure, continue
           → enqueue   → record accepted jobId
```

One provider failure **never** blocks another. Each accepted publisher gets its
own BullMQ job with a distinct `publisherId` in the payload.

The worker `publishing.processor` resolves the publisher driver from
`payload.publisherId` (WordPress, Ghost, mock).

---

## Duplicate Handling

Duplicate detection reuses the existing `findDuplicate(projectId, publisher, slug)`
hook — unchanged from Sprint 23.

| Context | Behaviour |
|---|---|
| `POST /composer/validate` | Warning only (`ready` may still be true) |
| `POST /composer/publish` | **Skip** — no job enqueued, listed in `skipped` |

Duplicate scope is per publisher: the same slug may publish to WordPress while
being skipped for Ghost if only Ghost has prior history.

---

## Dashboard

Composer page changes (Sprint 41):

- Publisher multi-select (checkboxes)
- **Publish** button with confirmation dialog
- Publish result summary: Queued / Skipped / Validation failures

Flow:

1. `POST /ops/composer/publish` without `confirm` → redirect to confirm dialog
2. `POST /ops/composer/publish` with `confirm=true` → `POST /composer/publish`
3. Redirect back with `publishSummary` JSON in query string

---

## Future Live Progress

Sprint 41 intentionally omits live polling. Planned follow-ups:

- WebSocket or SSE job status stream from Composer
- Per-publisher progress chips (queued → active → completed/failed)
- Link accepted `jobId` entries directly to Jobs detail page
- Toast notifications on completion without full page reload

The `accepted[].jobId` values are already returned for future wiring.

---

## Testing

| Layer | Coverage |
|---|---|
| API route | `composer-publish.test.ts` — auth, 202, 503, 400 |
| Service | `content-composer-service.test.ts` — fan-out, duplicate skip, failures |
| Dashboard | `composer-app.test.ts`, `composer-renderer.test.ts` |
| Smoke | `pnpm publish-workflow:smoke` — offline, mock publishers |

Smoke scenarios:

- Single publish
- Multi publish (independent jobs)
- Duplicate skip
- Validation failure
- Mixed success (accepted + skipped + failures)

---

## Verification

```bash
pnpm test
pnpm build
pnpm publish-workflow:smoke
```
