# Sprint 3 — Metadata Domain Foundation

**Status:** Complete  
**Package:** `@pcme/database`

## Scope Boundaries

Sprint 3 adds the **first real domain foundation** for media metadata in `@pcme/database`.

**In scope:**

- Extend the existing `Asset` model (Sprint 2) with metadata-focused fields
- Add `MediaSource` (provenance facts) and `MetadataRecord` (extensible key/value metadata)
- Repository methods for create, lookup, update metadata, soft delete
- Small validation utilities (MIME type, checksum, storage key, metadata keys)
- Unit tests (mocked Prisma — no live DB)
- Seed sample metadata-only asset for PiercingConnect

**Explicitly out of scope — unchanged from Sprint 2:**

- NestJS, authentication, authorization
- Queues, workers, business logic
- Media processing pipeline, file upload, binary storage integration
- Dashboard, external AI integration
- Runnable app shells (`/health`, dashboard placeholder)
- API routes
- Database-backed integration tests

## Domain Model (Minimum)

Sprint 3 builds on Sprint 2's `Asset` table rather than introducing a parallel `MediaAsset` table. The domain concept **MediaAsset** maps to `Asset` in persistence.

| Concept | Persistence | Purpose |
| -------- | ----------- | ------- |
| MediaAsset | `Asset` | Canonical media record: filename, MIME, storage reference, checksum, status |
| MediaSource | `MediaSource` | Where media came from (upload, URL, AI, stock, import) — facts only |
| MetadataRecord | `MetadataRecord` | Namespaced extensible metadata (EXIF, dimensions, custom) |
| ProcessingStatus | `AssetStatus` | `pending` → `processing` → `ready` / `failed` |

### Asset extensions

- `originalFilename` — upload name distinct from sanitized `filename`
- `checksumAlgorithm` — defaults to `sha256`
- Unique `(projectId, storageKey)` — provider-agnostic storage reference
- Removed vague `source` string → replaced by `MediaSource` relation

### Design principles applied

- Metadata describes media; it does not process it
- Store references and facts, not binary files
- Storage provider remains a string field (`local`, `s3`, etc.) — no provider lock-in
- Repository APIs stay small and project-scoped

### AssetStatus migration note

PostgreSQL cannot `ADD VALUE` to an enum and use that value (e.g. as a column default) in the same transaction. Prisma `migrate deploy` runs each migration atomically, so Sprint 3 **recreates** `AssetStatus` via rename-and-replace rather than incremental `ADD VALUE`.

## Local Setup

```bash
# 1. Environment (if not already done)
cp .env.example .env

# 2. Start PostgreSQL
docker compose up -d

# 3. Install dependencies
pnpm install

# 4. Generate Prisma client
pnpm db:generate

# 5. Apply migrations (includes Sprint 3)
pnpm db:migrate:dev

# 6. Seed bootstrap + sample media metadata
pnpm db:seed

# 7. Verify connectivity
pnpm db:health
```

## Verification Commands

```bash
# Monorepo build
pnpm build

# Package unit tests (no Postgres required)
pnpm --filter @pcme/database test

# Lint database package
pnpm --filter @pcme/database lint
```

## New Exports

From `@pcme/database`:

- **Repositories:** `MediaAssetRepository`, `MediaSourceRepository`, `MetadataRecordRepository` (`AssetRepository` alias retained)
- **Validation:** `validateMimeType`, `validateChecksum`, `validateStorageKey`, `buildStorageKeyPlaceholder`, etc.
- **Types:** `MediaSource`, `MediaSourceType`, `MetadataRecord`, `AssetStatus`

## Files Changed

| Path | Change |
| ---- | ------ |
| `packages/database/prisma/schema.prisma` | Asset extensions, MediaSource, MetadataRecord |
| `packages/database/prisma/migrations/20260703120000_sprint3_metadata_domain/` | Sprint 3 migration |
| `packages/database/prisma/seed.ts` | Sample metadata-only asset |
| `packages/database/src/domain/media-validation.ts` | Validation utilities |
| `packages/database/src/domain/media-validation.test.ts` | Validation unit tests |
| `packages/database/src/repositories/media.repository.ts` | Media domain repositories |
| `packages/database/src/repositories/media.repository.test.ts` | Repository unit tests |
| `packages/database/src/repositories/content.repository.ts` | AssetRepository moved out |
| `packages/database/src/repositories/index.ts` | Export updates |
| `packages/database/src/index.ts` | Public API exports |
| `docs/sprints/sprint-3-metadata-domain.md` | This document |

## Recommended Commit Message

```
feat(database): add metadata domain foundation for media assets

Extend Asset with originalFilename and checksumAlgorithm; add MediaSource
and MetadataRecord tables with project-scoped repositories and validation
helpers. Includes Sprint 3 migration and seed metadata sample.
```
