# Sprint 9 — Upload API Foundation

**Status:** Complete  
**Tag:** v0.9.0-alpha-sprint9 (pending)

## Goal

Add the first real media upload endpoint using the API, database, repository, and
local storage foundations built in Sprints 7 and 8. Sprint 9 stores a file on
disk and creates an `Asset` record in the database. No processing is triggered.

## Endpoint

### `POST /media`

Accept a multipart/form-data upload containing a single image file.

```
POST /media
Content-Type: multipart/form-data; boundary=...

[multipart body — field name "file"]
```

**Success response — 201 Created:**
```json
{
  "id": "f47ac10b58cc4372a5670e02b2c3d479",
  "filename": "product-photo.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 98304,
  "storageKey": "piercingconnect/f47ac10b58cc4372a5670e02b2c3d479/product-photo.jpg",
  "status": "active"
}
```

**Validation failures:**

| Condition | Status |
|---|---|
| No file part | 400 `File is required` |
| Empty filename | 400 `Filename is required` |
| Empty file (0 bytes) | 400 `File must not be empty` |
| Unsupported MIME type | 415 `Unsupported media type` + `allowed` list |

## Accepted MIME Types

| MIME type | Extension |
|---|---|
| `image/jpeg` | `.jpg`, `.jpeg` |
| `image/png` | `.png` |
| `image/webp` | `.webp` |

The MIME type is taken from the multipart `Content-Type` field, not inferred from
the filename extension. Callers must set it correctly.

## curl Example

```bash
# Minimal upload (JPEG)
curl -X POST http://localhost:3001/media \
  -F "file=@/path/to/photo.jpg;type=image/jpeg"

# PNG upload
curl -X POST http://localhost:3001/media \
  -F "file=@/path/to/image.png;type=image/png"
```

## Storage Behaviour

Files are stored using `LocalStorageProvider` with a deterministic storageKey:

```
{projectSlug}/{assetId}/{sanitizedFilename}
piercingconnect/f47ac10b.../product-photo.jpg
```

- `assetId` is a 32-character hex string (UUID without hyphens).
- `sanitizedFilename` is lowercased with unsafe characters replaced.
- The `LocalStorageProvider` creates the directory tree automatically.
- `LocalStorageProvider` is wired at startup with `STORAGE_LOCAL_ROOT`.

## Asset Record

After the file is written, an `Asset` row is created via `MediaAssetRepository`:

| Field | Value |
|---|---|
| `id` | Pre-generated 32-hex ID |
| `organizationId` | From `PCME_DEFAULT_ORG_ID` |
| `projectId` | From `PCME_DEFAULT_PROJECT_ID` |
| `filename` | Original filename from the upload |
| `originalFilename` | Same as `filename` |
| `mimeType` | Normalized lowercase MIME type |
| `storageProvider` | `'local'` |
| `storageKey` | `{slug}/{id}/{file}` |
| `sizeBytes` | Byte length of the uploaded buffer |
| `status` | `'active'` (file is stored) |
| `checksum` | Not computed in Sprint 9 (see deferred) |

No `ProcessingJob` or `ProcessingArtifact` is created.

## Default Project Context (Sprint 9 Limitation)

Authentication is not implemented yet. Sprint 9 uses a hardcoded default project
configured via environment variables. Every upload is credited to this project.

**Environment variables required to enable the upload route:**

| Variable | Description |
|---|---|
| `PCME_DEFAULT_ORG_ID` | Organization ID from `pnpm db:seed` output |
| `PCME_DEFAULT_PROJECT_ID` | Project ID from `pnpm db:seed` output |
| `PCME_DEFAULT_PROJECT_SLUG` | Project slug (default: `piercingconnect`) |
| `STORAGE_LOCAL_ROOT` | Absolute or relative path to local storage root |

If `PCME_DEFAULT_ORG_ID` or `PCME_DEFAULT_PROJECT_ID` is empty, the upload route
is not registered and the server logs a warning at startup.

## How to Run Locally

### Prerequisites

```bash
docker compose up -d
pnpm install
pnpm --filter @pcme/database db:migrate
pnpm --filter @pcme/database db:seed
```

### Add upload config to `.env`

After `db:seed`, copy the IDs from the output:
```
Seeded organization: default-operator (cmr44dq4m0000npqx0xo9sh4l)
Seeded project: piercingconnect (cmr44dq720002npqxq7vqy5iz)
```

Add to `.env`:
```
PCME_DEFAULT_ORG_ID=cmr44dq4m0000npqx0xo9sh4l
PCME_DEFAULT_PROJECT_ID=cmr44dq720002npqxq7vqy5iz
PCME_DEFAULT_PROJECT_SLUG=piercingconnect
STORAGE_LOCAL_ROOT=./storage/local
```

### Start the API

```bash
pnpm --filter @pcme/api dev
```

### Test with curl

```bash
curl -X POST http://localhost:3001/media \
  -F "file=@/path/to/photo.jpg;type=image/jpeg"
```

## Testability Architecture

The upload handler receives `assetRepository` and `storageProvider` through
`AppOptions` (constructor injection). This allows tests to:

- Pass a mocked `AssetCreator` — no Prisma, no database required.
- Pass a real `LocalStorageProvider` with a temporary directory — fast, no network.

All 15 upload tests run in ~1s without Docker.

## Intentionally Deferred

| Deferred | Reason |
|---|---|
| Authentication / per-request project context | Sprint N (auth sprint) |
| SHA-256 checksum computation | Sprint 10+ (adds CPU cost; noted in field) |
| Duplicate detection by checksum | Depends on checksum |
| ProcessingJob creation | Sprint 10+ (processing pipeline sprint) |
| `GET /media/:id` retrieval | Sprint 10+ |
| Multi-file batch upload | Sprint 10+ |
| Cloud storage (S3, GCS, R2) | Deferred — use provider interface to swap |
| File type sniffing (magic bytes) | Deferred — trust client MIME for now |
| Rate limiting | Deferred — no public surface yet |

## Changed Files

```
apps/api/
  package.json                          + @fastify/multipart, @pcme/media
  src/config.ts                         + storageLocalRoot, defaultOrgId, defaultProjectId, defaultProjectSlug
  src/routes/media.ts                   NEW — POST /media route + AssetCreator/FileStorer interfaces
  src/app.ts                            + assetRepository/storageProvider injection; register mediaRoutes
  src/server.ts                         + wire MediaAssetRepository + LocalStorageProvider
  src/__tests__/media.test.ts           NEW — 15 upload tests (no DB)
  src/__tests__/health.test.ts          + new Config fields in baseConfig
  src/__tests__/version.test.ts         + new Config fields in baseConfig
  src/__tests__/request-id.test.ts      + new Config fields in baseConfig

docs/sprints/sprint-9-upload-api.md    — this file
```

## Verification Results

```
pnpm --filter @pcme/api test     →  38/38 pass (15 new upload tests)
pnpm --filter @pcme/api lint     →  0 errors
pnpm --filter @pcme/media test   →  38/38 pass (unchanged)
pnpm --filter @pcme/database test →  64/64 pass (unchanged)
pnpm build                       →  26/26 packages successful
```

## Recommended Git Commit Message

```
feat(api): add POST /media upload endpoint (Sprint 9)

- POST /media accepts multipart/form-data image upload (jpeg/png/webp)
- Validates file presence, filename, MIME type, and non-zero size
- Generates deterministic storageKey: {projectSlug}/{assetId}/{filename}
- Writes file via LocalStorageProvider; creates Asset record via MediaAssetRepository
- Returns 201 with id, filename, mimeType, sizeBytes, storageKey, status
- No ProcessingJob created — processing pipeline deferred to Sprint 10
- AssetCreator/FileStorer injection interfaces enable fast no-DB tests
- 15 vitest tests covering success, all validation failures, response shape
- Config extended: storageLocalRoot, defaultOrgId, defaultProjectId, defaultProjectSlug
```
