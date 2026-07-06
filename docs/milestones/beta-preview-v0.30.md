# PC Media Engine — Beta Preview Milestone (v0.30)

> Date: July 2026  
> Sprints completed: 1–30  
> Status: **Beta Preview**

---

## Purpose

PC Media Engine (PCME) is a media processing and publishing platform for the
PiercingConnect project. It ingests media files via a REST API, generates thumbnails,
enriches metadata (SEO + optional AI), and publishes content to external platforms
(WordPress or mock) via an asynchronous worker pipeline.

This milestone marks the transition from Alpha (Sprint 1–24) to **Beta Preview**
(Sprint 25–30), reflecting production-grade reliability, observability, and
operational completeness.

---

## Sprint 25–30 Summary

### Sprint 25 — Publishing Scheduler Foundation
- Added `scheduledFor: ISO datetime` field to the publishing job payload.
- Jobs with a future `scheduledFor` are enqueued as BullMQ **delayed jobs**.
- Past or absent `scheduledFor` → immediate enqueue.
- Invalid datetime → validation error.
- Duplicate detection and retry engine remain transparent.

### Sprint 26 — Publishing Management API
- Read-only publishing history via REST:
  - `GET /publishing/history` (filter by project, asset, publisher; limit)
  - `GET /publishing/:id` (single record)
  - `GET /publishing/health` (publishing system status)
- Reuses `PublishedContentRepository`; zero database schema changes.

### Sprint 27 — Dashboard Backend API
- Read-only aggregate stats for a future dashboard UI:
  - `GET /dashboard/summary` (counts, latest publish, publisher breakdown, feature flags)
  - `GET /dashboard/recent` (newest published records)
  - `GET /dashboard/health` (API + DB + publishing system status)
- Added `getSummaryStats()` and `findRecent()` to `PublishedContentRepository`.

### Sprint 28 — Dashboard Web UI
- Minimal Server-Side Rendered (SSR) dashboard app at `apps/dashboard`.
- Displays: health badges, summary counts, capabilities, publisher breakdown,
  recent published content list.
- Fully offline-capable for tests; gracefully degrades when API is unavailable.
- No authentication, no mutations — read-only.

### Sprint 29 — Observability & Metrics
- In-process `MetricsService` tracks: uploads, processed, published, retries,
  failures, duplicate skips, scheduler jobs, queue gauges.
- `GET /metrics` returns a JSON snapshot (offline-capable, all-zero defaults).
- `GET /health` extended with `metricsEnabled` flag.
- Dashboard gains an **Observability & Metrics** section.
- Worker process instruments all publishing events via `WorkerMetricsService`.

### Sprint 30 — Beta Readiness & Hardening *(this milestone)*
- **Config validation** on startup — `validateApiConfig` / `validateWorkerConfig`
  fail fast on fatal errors (bad DB URL, invalid port, invalid Redis scheme) and
  warn on reduced-functionality configurations (missing Redis, storage, project IDs).
- **Health endpoint** extended with `startedAt` (process boot time).
- **Graceful shutdown** hardened — API, Worker, and Dashboard all handle SIGTERM /
  SIGINT cleanly. Worker catches `uncaughtException` / `unhandledRejection`.
- **Startup summary logs** — each process emits a structured diagnostic block at
  boot listing version, ports, feature flags, and connection status.
- **Beta deployment checklist** — `docs/releases/beta-checklist.md`.

---

## Current Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Client / CLI                          │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼───────────────────────────────────────┐
│                 apps/api  (Fastify, port 3001)                │
│  POST /media  │ GET /health  │ GET /metrics                  │
│  GET /publishing/*  │ GET /dashboard/*  │ GET /version        │
└──────┬──────────────────────────────────────┬────────────────┘
       │ BullMQ                               │ Prisma
       │ (pcme:processing)                    │
┌──────▼──────────────────────┐   ┌──────────▼────────────────┐
│      apps/worker             │   │   packages/database        │
│  Processing Worker           │   │   (PostgreSQL via Prisma)  │
│  → thumbnail generation      │   │   media_assets             │
│  → metadata enrichment       │   │   processing_jobs          │
│  → publishing enqueue        │   │   published_content        │
│                              │   └───────────────────────────┘
│  Publishing Worker           │
│  → duplicate detection       │
│  → PublishingOrchestrator    │
│  → persist history           │
│  → retry (exponential)       │
└──────┬──────────────────────┘
       │ HTTP (WordPress REST API)
┌──────▼──────────────────────┐
│  WordPress / MockPublisher   │
└─────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│              apps/dashboard  (Fastify SSR, port 3002)         │
│  Consumes: /dashboard/* and /metrics from apps/api            │
└──────────────────────────────────────────────────────────────┘
```

---

## Package Inventory

| Package | Role |
|---|---|
| `apps/api` | REST API — upload, history, dashboard, metrics |
| `apps/worker` | Processing + Publishing background workers |
| `apps/dashboard` | Read-only SSR dashboard UI |
| `packages/database` | Prisma client, repositories, migrations |
| `packages/media` | Thumbnail generation, storage abstraction |
| `packages/publishing` | Publisher interface, orchestrator, MockPublisher |
| `packages/provider-wordpress` | WordPress REST API publisher |
| `packages/seo` | Deterministic SEO metadata generation |
| `packages/ai` | AI metadata provider interface |
| `packages/provider-ai-openrouter` | OpenRouter AI provider |

---

## End-to-End Pipeline

```
1.  POST /media                 → file stored, MediaAsset created (pending)
2.  BullMQ: pcme:processing     → thumbnail generated, metadata enriched
3.  BullMQ: pcme:publishing     → duplicate check → publish → persist history
4.  GET /publishing/history     → query published records
5.  GET /dashboard/summary      → aggregate stats
6.  GET /metrics                → real-time counters
```

---

## Current Capabilities

### Media Processing
- JPEG / PNG / WebP upload via `POST /media`
- Thumbnail generation (`@pcme/media`)
- Deterministic SEO metadata (`@pcme/seo`)
- Optional AI-driven title/description enrichment (`@pcme/ai`)

### Publishing
- Mock publisher (always succeeds — offline/test)
- WordPress publisher (`@pcme/provider-wordpress`)
- Scheduled publishing via BullMQ delayed jobs
- Duplicate detection via `slug × publisher × projectId`
- Exponential retry (configurable max retries + backoff)

### History & Observability
- Full publishing history in `published_content` table
- Read-only history API (`GET /publishing/*`)
- Dashboard API (`GET /dashboard/*`)
- Metrics endpoint (`GET /metrics`) — uploads, publishes, retries, failures, queue

### Operational
- Startup config validation — fail fast on fatal errors
- Graceful SIGTERM / SIGINT shutdown on all processes
- `GET /health` with DB status, `metricsEnabled`, `startedAt`, `uptime`
- Structured startup diagnostic log block on every boot

---

## Important Commands

```bash
# Development
pnpm dev                         # start all services in watch mode
pnpm build                       # compile all TypeScript
pnpm test                        # run all test suites

# Database
pnpm --filter @pcme/database db:migrate:deploy  # apply migrations
pnpm db:seed                                    # seed initial data

# Smoke tests (all offline-capable)
pnpm beta:smoke                  # startup + health + config validation
pnpm metrics:smoke               # metrics service + GET /metrics
pnpm publishing-api:smoke        # publishing history API
pnpm dashboard-api:smoke         # dashboard API
pnpm --filter @pcme/dashboard smoke  # dashboard UI

# Production
pnpm --filter @pcme/api start
pnpm --filter @pcme/worker start
pnpm --filter @pcme/dashboard start
```

---

## Safety Defaults

| Feature | Default | Override |
|---|---|---|
| Publisher | `mock` (never calls real APIs) | `PUBLISHER_DRIVER=wordpress` |
| Auto-enqueue processing | `false` | `PCME_AUTO_ENQUEUE_PROCESSING=true` |
| Auto-enqueue publishing | `false` | `PCME_AUTO_ENQUEUE_PUBLISHING=true` |
| AI enrichment | `none` | `AI_METADATA_PROVIDER=openrouter` |
| Max retries | `3` | `PCME_PUBLISHING_MAX_RETRIES=N` |
| Authentication | none | (deferred to Sprint 31+) |

---

## Known Limitations

- **No authentication** — all API endpoints are public. Auth is deferred.
- **In-memory metrics** — counters reset on process restart.
- **No horizontal scaling** — single-node only; Redis-backed counter aggregation deferred.
- **Local file storage only** — S3 / GCS adapters deferred.
- **No rate limiting** — deferred.
- **Worker metrics not exposed via HTTP** — worker counters are in-process only.
- **No dead-letter queue** — jobs exhausting all retries disappear from queue view.
- **No cron/recurring scheduler** — BullMQ delayed jobs only; no `setInterval` pattern.

---

## Roadmap (Sprint 31+)

| Sprint | Theme |
|---|---|
| 31 | Authentication & API keys |
| 32 | S3 / cloud storage adapter |
| 33 | Multi-project / multi-tenant support |
| 34 | Dead-letter queue + manual requeue UI |
| 35 | Prometheus metrics export + Grafana dashboard |
| 36 | Rate limiting + abuse protection |
| 37 | Real-time publishing status via WebSocket / SSE |
| 38 | Production deployment guide (Docker Compose + Kubernetes) |

---

## Test Coverage Summary (v0.30)

| Package | Test files | Tests |
|---|---|---|
| `@pcme/api` | 8 | 129 |
| `@pcme/dashboard` | 2 | 45 |
| `@pcme/worker` | 15 | 160 |
| `@pcme/database` | 2 | ~20 |
| `@pcme/publishing` | ~6 | ~40 |
| `@pcme/seo` | ~3 | ~15 |
| **Total** | **~36** | **~409** |
