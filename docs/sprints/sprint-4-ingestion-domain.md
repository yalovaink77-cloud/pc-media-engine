# Sprint 4 — Ingestion Domain Foundation

**Status:** Complete  
**Package:** `@pcme/database`

## Scope Boundaries

Sprint 4 adds the **ingestion intent and tracking** domain in `@pcme/database`.

**In scope:**

- `IngestionSource` — reusable source configuration per project
- `IngestionJob` — tracked ingestion attempt with status, counts, and timestamps
- Repository methods for create, lookup, progress updates, soft delete (sources)
- Validation helpers for source URIs and asset counts
- Unit tests (mocked Prisma — no live DB)
- Seed sample ingestion source + completed job for PiercingConnect

**Explicitly out of scope — unchanged from prior sprints:**

- NestJS, authentication, authorization
- Queues, workers, downloaders, FFmpeg, Whisper/OCR/AI
- File upload, media processing, production storage integration
- Dashboard, external API integration
- Runnable app shells (`/health`, dashboard placeholder)
- API routes
- Database-backed integration tests

## Domain Model (Minimum)

| Concept | Persistence | Purpose |
| -------- | ----------- | ------- |
| IngestionSource | `IngestionSource` | Persistent "where to ingest from" configuration |
| IngestionJob | `IngestionJob` | Single tracked ingestion attempt (intent + run lifecycle) |
| IngestionSourceType | `IngestionSourceType` | `local_folder`, `http_url`, `youtube`, `rss`, `s3_placeholder`, `manual` |
| IngestionStatus | `IngestionStatus` | `pending` → `running` → `completed` / `failed` / `canceled` |

### Why no separate IngestionRun table

Sprint 4 models **tracking records only**. `IngestionJob` carries run lifecycle fields (`startedAt`, `completedAt`, counts, `failureReason`) so a separate `IngestionRun` table would duplicate structure without enabling execution yet. When workers arrive, jobs may split into definition + runs if retry/history semantics require it.

### Why this does not download or process

- Tables store **URIs, identifiers, status, and counters** — not binary payloads or worker state
- Repositories validate input shape and persist facts; they never fetch URLs, scan folders, or create `Asset` rows
- `config` on `IngestionSource` is opaque JSON for future provider hints — no provider SDK coupling
- Seed records are metadata-only placeholders with zero discovered/imported assets

### Design principles applied

- Ingestion describes intent and tracking, not execution
- Provider-agnostic source types and URI validation
- Project-scoped repository APIs
- New enums created via `CREATE TYPE` (no unsafe PostgreSQL enum mutation)

## Migration

**Name:** `20260704120000_sprint4_ingestion_domain`

## Local Setup

```bash
cp .env.example .env          # if not already done
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate:dev           # or pnpm db:migrate
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

- **Repositories:** `IngestionSourceRepository`, `IngestionJobRepository`
- **Validation:** `validateIngestionSourceUri`, `validateIngestionCounts`, `validateSourceIdentifier`
- **Types:** `IngestionSource`, `IngestionJob`, `IngestionSourceType`, `IngestionStatus`

## Files Changed

| Path | Change |
| ---- | ------ |
| `packages/database/prisma/schema.prisma` | IngestionSource, IngestionJob, enums |
| `packages/database/prisma/migrations/20260704120000_sprint4_ingestion_domain/` | Sprint 4 migration |
| `packages/database/prisma/seed.ts` | Sample ingestion source + job |
| `packages/database/src/domain/ingestion-validation.ts` | URI and count validation |
| `packages/database/src/domain/ingestion-validation.test.ts` | Validation unit tests |
| `packages/database/src/repositories/ingestion.repository.ts` | Ingestion repositories |
| `packages/database/src/repositories/ingestion.repository.test.ts` | Repository unit tests |
| `packages/database/src/repositories/index.ts` | Export updates |
| `packages/database/src/index.ts` | Public API exports |
| `docs/sprints/sprint-4-ingestion-domain.md` | This document |

## Recommended Commit Message

```
feat(database): add ingestion domain foundation for intent and tracking

Introduce IngestionSource and IngestionJob models with project-scoped
repositories, URI/count validation helpers, Sprint 4 migration, and seed
placeholders. No download or processing execution.
```
