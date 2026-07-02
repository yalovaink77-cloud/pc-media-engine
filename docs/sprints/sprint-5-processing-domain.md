# Sprint 5 — Processing Domain Foundation

**Status:** Complete  
**Package:** `@pcme/database`

## Scope Boundaries

Sprint 5 adds the **processing intent and artifact** domain in `@pcme/database`.

**In scope:**

- `ProcessingJob` — intent record for processing an asset
- `ProcessingArtifact` — declared output produced by a job
- Three new enums: `ProcessingType`, `ProcessingStatus`, `ArtifactType`
- Repository methods for create, lookup, and status updates
- Validation helpers (priority, retry count, MIME, storage placeholder, compatibility)
- Unit tests (mocked Prisma — no live DB)
- Seed sample processing job + artifact placeholder for PiercingConnect

**Explicitly out of scope:**

- Queue engine, worker runtime, scheduler
- FFmpeg, Whisper, OCR, AI providers
- Thumbnail generation, transcoding, image manipulation
- File upload, real storage writes
- Dashboard, API routes, NestJS
- Database-backed integration tests

## Domain Model

| Concept | Persistence | Purpose |
| -------- | ----------- | ------- |
| ProcessingJob | `ProcessingJob` | Intent to process an asset — not an execution command |
| ProcessingArtifact | `ProcessingArtifact` | Declared output descriptor — not a real file |
| ProcessingType | `ProcessingType` | `metadata_extract`, `thumbnail`, `waveform`, `transcript`, `preview`, `ai_analysis` |
| ProcessingStatus | `ProcessingStatus` | `pending` → `queued` → `running` → `completed` / `failed` / `cancelled` |
| ArtifactType | `ArtifactType` | `thumbnail`, `transcript`, `waveform`, `preview`, `metadata` |

### Key design decisions

- `ProcessingJob` has a `@@unique([assetId, processingType])` constraint — one job per asset per type at a time; retries increment `retryCount` on the same row rather than creating duplicates.
- `ProcessingArtifact` has a `@@unique([processingJobId, artifactType])` constraint — one declared output per type per job.
- `ProcessingArtifact.storageKeyPlaceholder` follows the storage-strategy.md key convention (`{projectSlug}/{assetId}/{filename}`) but holds no real file reference. Workers fill in checksums and sizes when execution happens in a later sprint.
- `processingType × artifactType` compatibility is validated at record creation — e.g. `thumbnail` jobs cannot declare `transcript` artifacts.
- `priority` is bounded 0–100 to prevent future queue-weighting abuse.

### Why this sprint does not execute processing

- `ProcessingJob.status` defaults to `pending`; nothing in Sprint 5 changes it.
- No code calls FFmpeg, Whisper, AI, or any storage provider.
- `ProcessingArtifact.storageKeyPlaceholder` is a plain string — no file is written.
- Repositories validate and persist facts only; they have no side effects.

### PostgreSQL safety

All three enums are `CREATE TYPE` statements. No `ADD VALUE` is used on any existing enum. The migration is safe within a single transaction.

## Migration

**Name:** `20260704130000_sprint5_processing_domain`

## Local Setup

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:health
```

## Verification Commands

```bash
pnpm --filter @pcme/database test
pnpm --filter @pcme/database lint
pnpm build
```

## New Exports

From `@pcme/database`:

**Repositories:** `ProcessingJobRepository`, `ProcessingArtifactRepository`

**Validation:** `validatePriority`, `validateRetryCount`, `validateArtifactMimeType`, `validateStorageKeyPlaceholder`, `validateArtifactCompatibility`, `validateArtifactChecksum`, `PRIORITY_MIN`, `PRIORITY_MAX`

**Types:** `ProcessingJob`, `ProcessingArtifact`, `ProcessingType`, `ProcessingStatus`, `ArtifactType`

## Files Changed

| Path | Change |
| ---- | ------ |
| `packages/database/prisma/schema.prisma` | `ProcessingJob`, `ProcessingArtifact`, enums, relations |
| `packages/database/prisma/migrations/20260704130000_sprint5_processing_domain/` | Sprint 5 migration |
| `packages/database/prisma/seed.ts` | Sample processing job + artifact placeholder |
| `packages/database/src/domain/processing-validation.ts` | Validation helpers |
| `packages/database/src/domain/processing-validation.test.ts` | Validation unit tests |
| `packages/database/src/repositories/processing.repository.ts` | `ProcessingJobRepository`, `ProcessingArtifactRepository` |
| `packages/database/src/repositories/processing.repository.test.ts` | Repository unit tests |
| `packages/database/src/repositories/index.ts` | Export updates |
| `packages/database/src/index.ts` | Public API exports |
| `docs/sprints/sprint-5-processing-domain.md` | This document |

## Recommended Commit Message

```
feat(database): add processing domain foundation for intent and artifacts

Introduce ProcessingJob and ProcessingArtifact models with project-scoped
repositories, compatibility/priority/MIME validation, Sprint 5 migration,
and seed placeholders. No execution, no workers, no file I/O.
```
