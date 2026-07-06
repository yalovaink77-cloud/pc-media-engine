# Sprint 39 — Asset Library

## Objective

Provide a read-only Asset Library for browsing and inspecting uploaded media used
by the publishing pipeline. No changes to upload processing, publishing, scheduler,
or retry engine.

---

## Asset Lifecycle

Assets enter the system through the existing upload path (`POST /media`):

```
Upload (POST /media)
    → pending
    → processing (worker jobs: thumbnail, metadata, etc.)
    → ready
    → failed (processing exhausted)
```

| Status | Meaning |
|---|---|
| `pending` | Record created; processing not yet started or queued |
| `processing` | One or more processing jobs active |
| `ready` | Processing complete; asset available for publishing |
| `failed` | Processing failed; asset may not be publishable |

Assets are stored in PostgreSQL (`Asset` model) with binary content in the
configured storage provider (`storageKey`). The Asset Library reads this data
but does not modify it.

---

## Processing Relationship

Processing jobs (`ProcessingJob`) and artifacts (`ProcessingArtifact`) are linked
to assets by `assetId`. The library surfaces:

- **Processing timeline** — job type, status, retries, timestamps, failure reason
- **Thumbnails** — `ProcessingArtifact` rows with `artifactType === 'thumbnail'`
- **Dimensions** — `MetadataRecord` namespace `dimensions` (`width_px`, `height_px`)

The library does not enqueue, retry, or cancel processing jobs.

---

## Publishing Relationship

Published content (`PublishedContent`) links to assets via `assetId`. The library
aggregates:

- **Publisher count** — unique publishers that have published this asset
- **Publishing history summary** — publisher, status, URL, slug, published date
- **Publishing summary** — total publishes and per-publisher counts

Publishing jobs in BullMQ (Sprint 38) reference `assetId` in their payload but
are separate from the asset record. The Asset Library shows database publishing
history, not queue state.

---

## API Endpoints

Public read-only endpoints (no auth required when database is configured).

| Endpoint | Purpose |
|---|---|
| `GET /assets` | Paginated asset list with filters |
| `GET /assets/:id` | Full asset detail |
| `GET /assets/:id/download` | Stream original file (when storage available) |
| `GET /assets/:id/thumbnail` | Stream thumbnail artifact (when available) |

### Query parameters (`GET /assets`)

| Param | Description |
|---|---|
| `projectId` | Filter by project (defaults to `DEFAULT_PROJECT_ID`) |
| `status` | Asset status: pending, processing, ready, failed |
| `mimeType` | Exact MIME type filter |
| `limit` | Page size (default 50, max 200) |
| `offset` | Pagination offset |

### Response fields

**List item:** id, filename, mimeType, size, dimensions, thumbnail URL, status,
publisher count, timestamps

**Detail:** metadata namespaces, storage info, tags, processing timeline,
publishing history, download URL

Returns `503` when the asset library service is not configured (no database).

---

## Dashboard

| Route | Purpose |
|---|---|
| `GET /assets` | Asset Library table with filters and pagination |
| `GET /assets/:id` | Asset detail with timeline, history, download link |

Navigation adds an **Assets** tab alongside Dashboard, Publishers, and Jobs.

Thumbnail and download links resolve against `DASHBOARD_API_BASE_URL` so the
dashboard can proxy media from the API without storing blobs locally.

All pages are read-only — no edit or delete actions.

---

## Future Asset Editing

Sprint 39 intentionally excludes mutation workflows. Future sprints may add:

- Metadata editing (alt text, tags)
- Soft delete / archive
- Re-processing triggers
- Asset replacement with version history

The current API and dashboard structure separate list/detail DTOs from storage
keys to support these extensions without breaking read clients.

---

## Testing

| Layer | Coverage |
|---|---|
| API | Route tests, pagination, filters, 404/503 |
| Service | List/filter/paginate, detail aggregation |
| Dashboard | Renderer tests, app route tests |
| Smoke | `pnpm assets:smoke` (offline, mocked repositories) |

---

## Verification

```bash
pnpm test
pnpm build
pnpm assets:smoke
```

---

## Non-goals (confirmed)

- No upload workflow changes
- No publishing / scheduler / retry changes
- No asset editing or deletion
- No database migrations
