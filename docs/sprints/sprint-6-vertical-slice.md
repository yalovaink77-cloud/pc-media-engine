# Sprint 6 — Schema Corrections + Local Domain Smoke

## Goal

Apply all schema-level corrections from the post-Sprint-5 architecture review
and prove the corrected domain chain with a local CLI smoke command. No API,
no queue, no worker, no events package.

---

## What was NOT in scope

| Deferred to future sprint | Reason |
|---|---|
| `apps/api` implementation | API shell not ready; no NestJS or Fastify wiring |
| `apps/worker` implementation | No queue infrastructure in Sprint 6 |
| `packages/events` | Event infrastructure; deferred until both publisher and consumer exist |
| `ProjectSecret` repository | Secrets infrastructure deferred until pre-publishing sprint |

---

## Schema Corrections (migration `20260703200000_sprint6_schema_corrections`)

Three targeted changes from the architecture review:

| Finding | Fix |
|---|---|
| No FK from `Asset` → `IngestionJob` | Added `ingestionJobId String? @map("ingestion_job_id")` to `Asset`; `ON DELETE SET NULL` |
| `ProcessingJob` had no retry history model | Added `ProcessingJobAttempt` table. Job stays canonical (unique per asset+type); each attempt is a new row with its own `startedAt`, `completedAt`, `failureReason`. |
| `ProcessingArtifact.storageKeyPlaceholder` lifecycle undefined | Added `storageKey String? @map("storage_key")`. Null until set by worker via `finalise()`. |

### Models updated

- `Asset`: `ingestionJobId?`, FK to `IngestionJob`, `@@index([ingestionJobId])`
- `IngestionJob`: `assets Asset[]` relation
- `ProcessingJob`: `@@unique([assetId, processingType])` **kept**; `attempts ProcessingJobAttempt[]` relation added
- `ProcessingJobAttempt`: new model — `(processingJobId, attemptNumber)` unique; `status`, `startedAt`, `completedAt`, `failureReason`
- `ProcessingArtifact`: `storageKey String?` added
- `ProcessingJobAttemptRepository`: `create`, `update`, `listByJob`, `nextAttemptNumber`
- `ProcessingArtifactRepository`: new `finalise()` method sets `storageKey` post-write
- `MediaAssetRepository`: accepts optional `id` and `ingestionJobId` on create

---

## Storage abstraction (`packages/media`)

Minimal `StorageProvider` interface and `LocalStorageProvider`. No dependencies
on any app or queue package. Used only for URL resolution and future file I/O.

```typescript
export interface StorageProvider {
  put(key: string, buffer: Buffer, mimeType: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
  readonly name: string;
}
```

`MediaUrlResolver` wraps `getPublicUrl()` — the only way to convert a
`storageKey` to a URL throughout the rest of the codebase.

---

## Smoke command (`pnpm --filter @pcme/database db:smoke`)

Proves the full domain chain against the real local database:

```
IngestionJob (seeded)
  → Asset (new, ingestionJobId set)
    → ProcessingJob (canonical, @@unique([assetId, processingType]) intact)
        → ProcessingJobAttempt 1  (status=failed, failure reason preserved)
        → ProcessingJobAttempt 2  (status=completed, retry under same Job)
        → ProcessingArtifact      (storageKeyPlaceholder + storageKey set)
```

Assertions checked:
- `Asset.ingestionJobId` → seeded `IngestionJob`
- Single canonical `ProcessingJob` for asset+type (unique constraint enforced — second create is rejected)
- Two `ProcessingJobAttempt` rows under the same job (failure history retained)
- `attemptRepo.nextAttemptNumber()` returns sequential numbers
- `ProcessingArtifact.storageKey` set immediately on creation
- `ProcessingArtifact.storageKeyPlaceholder` preserved as audit trail
- `artifactRepo.listByJob()` returns the artifact with the real `storageKey`

---

## Verification commands

```bash
# 1. Start database
docker compose up -d

# 2. Apply Sprint 6 migration
pnpm --filter @pcme/database db:migrate

# 3. Seed
pnpm --filter @pcme/database db:seed

# 4. Health check
pnpm --filter @pcme/database db:health

# 5. Unit tests (64 tests, no DB needed)
pnpm --filter @pcme/database test

# 6. Lint (all packages)
pnpm --filter @pcme/database lint
pnpm --filter @pcme/media lint

# 7. Build (all packages)
pnpm build

# 8. Smoke (requires DB)
pnpm --filter @pcme/database db:smoke
```

---

## Files changed

### packages/database
- `prisma/schema.prisma` — schema corrections (see above)
- `prisma/migrations/20260703200000_sprint6_schema_corrections/migration.sql`
- `src/repositories/media.repository.ts` — `CreateMediaAssetInput.id?`, `ingestionJobId?`
- `src/repositories/processing.repository.ts` — `storageKey` on artifact, `FinaliseProcessingArtifactInput`, `finalise()` method
- `src/repositories/processing-attempt.repository.ts` — `ProcessingJobAttemptRepository`
- `src/repositories/index.ts` — export new attempt types
- `src/index.ts` — export `ProcessingJobAttempt`, `ProcessingJobAttemptRepository`, attempt input types
- `src/scripts/smoke.ts` — domain chain smoke script
- `package.json` — added `db:smoke` script

### packages/media (new, minimal)
- `src/storage/provider.ts` — `StorageProvider` interface + lifecycle documentation
- `src/storage/local.provider.ts` — `LocalStorageProvider` (local dev only)
- `src/storage/url-resolver.ts` — `MediaUrlResolver`
- `src/index.ts` — exports
- `package.json` — added `exports` field, `@types/node` devDep

### docs
- `docs/architecture/storage-key-lifecycle.md` — storageKey two-phase lifecycle
- `docs/architecture/metadata-record-query-patterns.md` — EAV supported patterns + GIN index plan + materialized view template
- `docs/sprints/sprint-6-vertical-slice.md` — this file

---

## Recommended git commit message

```
feat(sprint-6): schema corrections + local domain smoke

- Add ProcessingJobAttempt table; ProcessingJob unique constraint preserved
- Add ProcessingArtifact.storageKey (null until set via finalise())
- Add Asset.ingestionJobId FK to IngestionJob (nullable lineage)
- Add ProcessingArtifactRepository.finalise() to set real storageKey
- Add packages/media: StorageProvider interface + LocalStorageProvider
- Add db:smoke command proving ingestion→asset→job→retry→artifact chain
- Document MetadataRecord EAV query patterns and storage key lifecycle

Deferred: events package, API routes, worker, secrets infrastructure.
```
