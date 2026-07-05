# PC Media Engine — Alpha Milestone v0.24

**Tag:** `v0.24.0-alpha-sprint24`  
**Date:** 2026-07-06  
**Sprints completed:** 1 – 24  
**Status:** Alpha — functional end-to-end pipeline, not yet production-ready

---

## 1. What PC Media Engine is

PC Media Engine (PCME) is a self-hosted media processing and publishing automation platform. It accepts raw media uploads (images, documents), generates optimised derivatives (thumbnails, WebP), enriches content with deterministic SEO metadata and optional AI metadata, then publishes structured draft posts to one or more publishing destinations (currently WordPress, with a mock driver for offline development).

The system is designed as a **multi-tenant monorepo** built around three core concerns:

1. **Ingestion** — receiving and storing raw assets via a REST API.
2. **Processing** — asynchronous queue-driven thumbnail generation and metadata enrichment.
3. **Publishing** — queue-driven draft post creation at remote destinations, with history tracking, duplicate prevention, and automatic retry.

Everything runs behind **feature flags** (environment variables). All production-facing behaviours are opt-in; the system runs fully offline by default.

---

## 2. Completed sprint list

| Sprint | Title | Key deliverable |
|--------|-------|-----------------|
| 1 | Repository Foundation | Monorepo scaffold, pnpm workspaces, Turbo, ESLint, Prettier, Husky, commitlint |
| 2 | Database Setup | Prisma + PostgreSQL, `@pcme/database` package, seed script |
| 3 | Metadata Domain | `Organization`, `Project`, `ContentItem`, `SeoProfile`, `MetadataRecord` models |
| 4 | Ingestion Domain | `IngestionSource`, `IngestionJob` models and repository layer |
| 5 | Processing Domain | `ProcessingJob`, `ProcessingJobAttempt`, `ProcessingArtifact` models |
| 6 | Vertical Slice | Schema corrections, scoped query helpers, `requireProjectId` guard |
| 7 | Local Storage | `@pcme/media` — `LocalStorageProvider`, `StorageProvider` interface |
| 8 | API Foundation | `@pcme/api` — Fastify server, health/version/root routes |
| 9 | Upload API | `POST /media` — multipart upload, asset record creation, `AssetStatus` state machine |
| 10 | Processing Orchestration | `ProcessingJobRepository` orchestration layer, job state machine |
| 11 | Queue + Worker Foundation | BullMQ `processing` queue, `@pcme/worker` — `startWorker` |
| 12 | Thumbnail Generation | Sharp-based WebP thumbnail processor, `ProcessingArtifact` persistence |
| 13 | Publishing Foundation | `@pcme/publishing` — `Publisher` interface, `PublishingRequest/Result` types |
| 14 | WordPress Media Upload | `@pcme/plugin-wordpress` — `WordPressMediaPublisher.publishMedia()` |
| 15 | WordPress Draft Post | `WordPressMediaPublisher.publishPost()`, featured image wiring |
| 16 | Publishing Orchestrator | `PublishingOrchestrator` — media-then-post flow, partial failure handling |
| 17 | Publishing Worker | BullMQ `publishing` queue, `MockPublisher`, `startPublishingWorker` |
| 18 | Real WordPress Publishing | `PUBLISHER_DRIVER=wordpress` driver selection, WordPress smoke |
| 19 | Metadata Enrichment | `@pcme/seo` — deterministic slug/title/description; injected into publishing payload |
| 20 | AI Metadata Enrichment | `@pcme/ai` — optional AI provider layer (`AI_METADATA_PROVIDER`); OpenRouter, Claude, Gemini, OpenAI provider stubs |
| 21 | End-to-End Automation Alpha | Full opt-in pipeline: upload → processing → publishing; `PCME_AUTO_ENQUEUE_*` flags; `e2e:smoke` |
| 22 | Publishing History | `PublishedContent` table + repository; worker persists every successful publish |
| 23 | Duplicate Detection | `findDuplicate(projectId, publisher, slug)`; pre-publish gate; `duplicate:smoke` |
| 24 | Retry Engine | Exponential backoff via BullMQ `defaultJobOptions`; `executePublishingJobWithRetry`; duplicates never retry; `retry:smoke` |

---

## 3. Current system capabilities

### API (`@pcme/api`)
- `GET /health` — liveness probe
- `GET /version` — returns package version
- `POST /media` — multipart upload, stores asset, creates `ProcessingJob`, optionally enqueues to BullMQ `processing` queue

### Processing worker (`@pcme/worker`)
- Consumes BullMQ `processing` queue
- Generates WebP thumbnail via Sharp
- Persists `ProcessingArtifact`
- On thumbnail success, optionally enqueues to `publishing` queue with enriched metadata

### Publishing worker (`@pcme/worker`)
- Consumes BullMQ `publishing` queue
- Enriches payload with deterministic SEO metadata (`@pcme/seo`)
- Optionally enriches with AI metadata (`@pcme/ai`, provider-selectable)
- Runs `PublishingOrchestrator`: `publishMedia` → `publishPost`
- Checks `findDuplicate` before orchestrator — skips if already published
- Persists `PublishedContent` row on success
- Throws on genuine failure → BullMQ retries with exponential backoff
- Returns normally on duplicate → BullMQ marks job completed (no retry)

### Publisher drivers
| Driver | Status |
|--------|--------|
| `mock` (default) | Deterministic in-process mock; no network; safe for CI and development |
| `wordpress` | Live WordPress REST API via `@pcme/plugin-wordpress`; requires credentials |

### AI metadata providers
| Provider | Status |
|----------|--------|
| `none` (default) | No AI enrichment; deterministic SEO only |
| `openrouter` | Live via `@pcme/provider-ai-openrouter` |
| `claude`, `gemini`, `openai` | Provider stubs scaffolded, not fully wired |

---

## 4. Architecture overview

```
┌─────────────────────────────────────────────────────────┐
│                      Client / Browser                   │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP
┌────────────────────▼────────────────────────────────────┐
│                    @pcme/api  (Fastify)                  │
│  POST /media → LocalStorageProvider → Asset + Job       │
│              → [opt] BullMQ processing queue            │
└────────────────────┬────────────────────────────────────┘
                     │ BullMQ
┌────────────────────▼────────────────────────────────────┐
│              @pcme/worker  processing consumer          │
│  dispatchJob → thumbnailProcessor (Sharp)               │
│             → ProcessingArtifact stored                 │
│             → [opt] buildEnrichedPublishingPayload      │
│                       (@pcme/seo + @pcme/ai)            │
│             → [opt] BullMQ publishing queue             │
└────────────────────┬────────────────────────────────────┘
                     │ BullMQ
┌────────────────────▼────────────────────────────────────┐
│              @pcme/worker  publishing consumer          │
│  findDuplicate? → skip (no retry)                       │
│  PublishingOrchestrator                                 │
│    → publisher.publishMedia()                           │
│    → publisher.publishPost()                            │
│  persistPublishedContent (PublishedContent row)         │
│  on failure → throw → BullMQ exponential backoff retry  │
└─────────────────────────────────────────────────────────┘

Storage:  @pcme/media  (LocalStorageProvider / S3 / R2)
Database: @pcme/database  (Prisma + PostgreSQL)
Queue:    BullMQ + Redis
```

---

## 5. End-to-end pipeline

The full automated pipeline, when all opt-in flags are enabled:

```
1. Client uploads file
   POST /media  (multipart/form-data)

2. API handler
   ├── Store binary → LocalStorageProvider
   ├── Create Asset (status: pending)
   ├── Create ProcessingJob (status: pending)
   └── Enqueue → BullMQ `processing`  [PCME_AUTO_ENQUEUE_PROCESSING=true]

3. Processing worker
   ├── Validate payload
   ├── dispatchJob → thumbnailProcessor
   │     ├── Download source from storage
   │     ├── Sharp resize → WebP
   │     ├── Upload thumbnail to storage
   │     └── Create ProcessingArtifact
   └── onThumbnailComplete hook
         ├── buildEnrichedPublishingPayload
         │     ├── @pcme/seo  → slug, title, description (deterministic)
         │     └── @pcme/ai   → enriched title/description (optional)
         └── Enqueue → BullMQ `publishing`  [PCME_AUTO_ENQUEUE_PUBLISHING=true]

4. Publishing worker
   ├── validatePublishingJobPayload
   ├── findDuplicate(projectId, publisher, slug)
   │     ├── found  → return { skipped: true, reason: "duplicate" }  (no retry)
   │     └── not found → continue
   ├── PublishingOrchestrator.publish()
   │     ├── publisher.publishMedia()  → externalId + url
   │     └── publisher.publishPost()   → externalId + url
   ├── persistPublishedContent()  → PublishedContent row (status: draft)
   └── on failure → throw → BullMQ retry (exponential backoff, max 3 retries)
```

---

## 6. Packages, apps, plugins, providers

### Apps

| Package | Description |
|---------|-------------|
| `@pcme/api` | Fastify REST API — upload endpoint and future admin routes |
| `@pcme/worker` | BullMQ worker — processing and publishing consumers |
| `@pcme/dashboard` | Scaffolded (placeholder, not yet implemented) |

### Core packages

| Package | Description |
|---------|-------------|
| `@pcme/database` | Prisma client, all repositories, schema migrations |
| `@pcme/publishing` | `Publisher` interface, `PublishingOrchestrator`, `MockPublisher`, `PublishingFlowResult` |
| `@pcme/media` | `StorageProvider` interface, `LocalStorageProvider` |
| `@pcme/seo` | Deterministic slug/title/description generation |
| `@pcme/ai` | AI metadata provider interface + `buildAiEnrichedMetadata` |
| `@pcme/core` | Shared domain primitives |
| `@pcme/shared` | Cross-cutting utilities |
| `@pcme/content` | Content item domain layer (scaffolded) |
| `@pcme/analytics` | Analytics snapshot domain layer (scaffolded) |

### Plugins

| Package | Status | Description |
|---------|--------|-------------|
| `@pcme/plugin-wordpress` | **Active** | WordPress REST API publisher (media upload + draft post) |
| `@pcme/plugin-amazon-affiliate` | Scaffolded | Not yet implemented |
| `@pcme/plugin-buy-me-a-coffee` | Scaffolded | Not yet implemented |
| `@pcme/plugin-instagram` | Scaffolded | Not yet implemented |
| `@pcme/plugin-pinterest` | Scaffolded | Not yet implemented |
| `@pcme/plugin-x-twitter` | Scaffolded | Not yet implemented |
| `@pcme/plugin-youtube` | Scaffolded | Not yet implemented |

### Providers

| Package | Status | Description |
|---------|--------|-------------|
| `@pcme/provider-storage-local` | **Active** | Local filesystem storage |
| `@pcme/provider-storage-s3` | Scaffolded | AWS S3 |
| `@pcme/provider-storage-r2` | Scaffolded | Cloudflare R2 |
| `@pcme/provider-ai-openrouter` | **Active** | OpenRouter AI provider |
| `@pcme/provider-ai-claude` | Scaffolded | Anthropic Claude direct |
| `@pcme/provider-ai-gemini` | Scaffolded | Google Gemini |
| `@pcme/provider-ai-openai` | Scaffolded | OpenAI |

---

## 7. Important commands

### Development

```bash
pnpm install          # install all workspace dependencies
pnpm build            # build all packages (Turbo)
pnpm test             # run all test suites (Turbo)
pnpm typecheck        # TypeScript type-check (no emit)
pnpm lint             # ESLint across all packages
pnpm format           # Prettier write
```

### Database

```bash
pnpm db:migrate       # run pending Prisma migrations (production)
pnpm db:migrate:dev   # run migrations in dev mode (generates client)
pnpm db:generate      # regenerate Prisma client after schema change
pnpm db:seed          # seed default organization + project
pnpm db:health        # check database connectivity
```

### Smoke tests (all offline unless noted)

```bash
pnpm duplicate:smoke          # offline — duplicate detection (no Redis)
pnpm retry:smoke              # offline — retry engine simulation (no Redis)
pnpm e2e:smoke                # requires Redis + DB — full upload→publish pipeline
pnpm publishing-history:smoke # requires Redis + DB — history persistence
```

### Per-package tests

```bash
pnpm --filter @pcme/database test
pnpm --filter @pcme/publishing test
pnpm --filter @pcme/worker test
```

---

## 8. Current safety defaults

All production-facing behaviours are **opt-out-safe by default**:

| Flag / Env var | Default | Effect when unset |
|----------------|---------|-------------------|
| `PCME_AUTO_ENQUEUE_PROCESSING` | `false` | Upload stores asset; does NOT enqueue processing |
| `PCME_AUTO_ENQUEUE_PUBLISHING` | `false` | Processing completes; does NOT enqueue publishing |
| `PUBLISHER_DRIVER` | `mock` | Publishing uses `MockPublisher` (no network, no WordPress calls) |
| `AI_METADATA_PROVIDER` | `none` | No AI API calls; deterministic SEO metadata only |
| `PCME_PUBLISHING_MAX_RETRIES` | `3` | Up to 3 retries for failed publishing jobs |
| `PCME_PUBLISHING_BACKOFF_MS` | `5000` | Initial backoff 5 s, doubling each attempt |
| `REDIS_URL` | `redis://localhost:6379` | Local Redis assumed |
| `DATABASE_URL` | *(required for any DB op)* | Prisma throws if unset when a query runs |
| `STORAGE_LOCAL_ROOT` | *(warns if unset)* | Worker logs a warning; thumbnail processor will fail |

Duplicates are **never retried** — a `skipped=true` result always completes the job immediately regardless of retry configuration.

---

## 9. What is intentionally not production-ready yet

The following areas are explicitly deferred and known to be incomplete:

- **Authentication & authorisation** — no auth layer exists on any API route.
- **Multi-tenancy enforcement** — `organizationId` is stored but not enforced at the API boundary; any request can write to any project.
- **Dashboard** — `@pcme/dashboard` is a scaffolded placeholder with no implemented routes.
- **Dead-letter queue** — permanently failed publishing jobs (retries exhausted) are not persisted to a `PublishedContent` row with `status: 'failed'`, not alerted, and not requeue-able.
- **Scheduler** — no cron or scheduled publishing; all jobs are triggered by uploads.
- **Storage providers** — S3 and R2 providers are scaffolded but not wired into the pipeline.
- **AI providers** — only OpenRouter is active; Claude, Gemini, and OpenAI stubs exist but are not fully wired.
- **Plugin ecosystem** — only WordPress is implemented; all other plugins (Instagram, Pinterest, YouTube, X/Twitter, Amazon Affiliate, Buy Me a Coffee) are empty scaffolds.
- **Analytics** — `@pcme/analytics` and `AnalyticsSnapshot` model exist but nothing writes to them.
- **Content management** — `@pcme/content`, `ContentItem`, `ContentVersion` models exist but no CRUD API routes are wired.
- **Semantic duplicate detection** — current duplicate check is exact `(projectId, publisher, slug)` match only; no hash-based or vector-similarity detection.
- **`PublishedContent.status`** — only `draft` is ever written; `published` and `failed` states are reserved but not used.
- **Rate limiting, request validation, and error normalisation** — not implemented at the API layer.
- **Observability** — structured logging exists; no metrics, tracing, or alerting.
- **Horizontal scaling** — BullMQ concurrency is configurable but no deployment manifests, load balancing, or queue sharding strategy exists.

---

## 10. Roadmap for Sprint 25–30 (suggested)

| Sprint | Title | Goal |
|--------|-------|------|
| 25 | Dead-Letter Queue | Persist `PublishedContent` with `status: failed` on retry exhaustion; alert hook |
| 26 | Content Hash Deduplication | SHA-256 of `title + body`; detect re-slugged reposts; `contentHash` column |
| 27 | Storage Provider Selection | Wire S3/R2 providers; `STORAGE_DRIVER` env var; smoke tests |
| 28 | Scheduler Foundation | Cron-triggered publishing jobs; `scheduled_at` field; `PCME_ENABLE_SCHEDULER` flag |
| 29 | API Authentication | JWT / API key middleware; route protection; `organizationId` from token |
| 30 | Dashboard Alpha | Read-only dashboard: asset list, published content, job status |

---

## 11. Known constraints and deferred items

### Technical debt
- `WorkerConfig` and API `Config` load environment variables independently — no shared config package.
- `PCME_DEFAULT_ORG_ID` / `PCME_DEFAULT_PROJECT_ID` are injected at smoke time rather than derived from a proper auth layer.
- `PublishedContentStatus` has `published` and `failed` variants reserved but unused; the persistence layer always writes `draft`.
- `publisherDriver` is stored as the string `"mock"` or `"wordpress"` in the `publisher` column of `published_content` — not a formal enum.

### Schema / migrations
- The `published_content.slug` column was added as `NOT NULL DEFAULT ''` (Sprint 23); existing rows before that migration will have an empty slug and will not participate in duplicate detection until backfilled.
- `PublishingOutboxEntry` and `PublishRecord` models exist in the schema but are not used by any application code.

### Testing
- No integration tests against a real database (all repository tests use mocked Prisma clients).
- No end-to-end tests in CI (smoke scripts require Redis and PostgreSQL; they are run manually).
- WordPress publishing tests mock HTTP — no live credential tests in CI.

### Operations
- No `docker-compose.yml` or deployment manifests committed to the repository.
- No automated DB migration step in any CI pipeline.
- No secret rotation, credential vault integration, or environment variable validation at startup.
