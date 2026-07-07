# Performance Guide

Operational guidance for measuring, tuning, and scaling PC Media Engine under load.

## Benchmark methodology

All Sprint 49 benchmarks are designed to run **offline** by default (no live server, database, or Redis required).

| Script | Command | What it measures |
|--------|---------|------------------|
| API benchmark | `pnpm --filter @pcme/api exec tsx scripts/benchmark-api.ts --offline` | `/health`, `/version`, `/metrics` latency (avg + p95) via `fastify.inject()` |
| Light load test | `pnpm --filter @pcme/api exec tsx scripts/load-test-light.ts --offline` | 200 concurrent `/health` requests (20 workers × 10) |
| Worker throughput | `pnpm --filter @pcme/worker exec tsx scripts/throughput-benchmark.ts --offline` | Concurrency validation + simulated `processedPerMinute` |
| Dashboard render | `pnpm --filter @pcme/dashboard exec tsx scripts/render-benchmark.ts --offline` | HTML render time for 50-row list pages |

For **live** benchmarks against a running API, set `API_BASE_URL=http://127.0.0.1:3001` and omit `--offline`.

Run the full offline validation suite:

```bash
pnpm performance:smoke
```

## Safe limits

### API pagination

| Endpoint | Default | Maximum |
|----------|---------|---------|
| `/jobs`, `/assets`, `/composer/assets` | 50 | 200 |
| `/activity`, `/notifications`, `/publishing/history` | 50 | 200 |
| `/dashboard/recent` | 10 | 50 |
| `/calendar/timeline` | 100 | 500 |

Limits are enforced via shared `clampLimit()` / `parseStrictLimit()` helpers. Values above the maximum are clamped or rejected with HTTP 400 (strict routes).

### Dashboard fetches

The dashboard client applies a defensive cap of **200 items** (`MAX_DASHBOARD_LIST_LIMIT`) on composer asset lists and notification detail lookups.

## Pagination policy

- All list endpoints accept a `limit` query parameter.
- Offset-based pagination is supported on `/jobs`, `/assets`, and `/composer/assets`.
- Filter-then-slice endpoints (jobs from Redis, assets from DB) retain existing behaviour; limits prevent unbounded response sizes.
- DB-backed routes (`/publishing/history`, `/dashboard/recent`) use `take` at the repository layer.

## Index review (Sprint 49)

| Domain | Existing indexes | Sprint 49 addition |
|--------|------------------|-------------------|
| **Assets** | `projectId`, `projectId+status`, `projectId+mimeType`, `projectId+deletedAt` | None — adequate for current queries |
| **Processing jobs** | `projectId+status`, `status+priority`, `assetId` | None — adequate |
| **Publishing history** | `publishedAt`, `projectId`, `projectId+assetId` | `(projectId, publishedAt DESC)` for filtered history |
| **Dashboard summary** | status/publisher groupBy scans | `status` index for aggregate counts |
| **Activity** | Prisma `AuditLogEntry(projectId, createdAt)` exists; API uses in-memory store | No migration — document only |
| **Notifications** | In-memory only | No migration — document only |

Migration: `20260707120000_sprint49_performance_indexes`

## Concurrency recommendations

| Setting | Env var | Default | Safe range |
|---------|---------|---------|------------|
| Worker concurrency | `WORKER_CONCURRENCY` | 5 | 1–20 (recommended 3–10 single-node) |

Both processing and publishing BullMQ workers share the same concurrency value. Increase gradually while monitoring:

- `queueDepthTotal` on `GET /metrics`
- `workerProcessedPerMinute`
- PostgreSQL connection pool and Redis memory

**Single-node guidance:** start at 5, increase to 10 only if CPU < 70% and queue depth stays elevated.

## Monitoring fields (Sprint 49)

`GET /metrics` now includes:

| Field | Description |
|-------|-------------|
| `apiResponseTimeMs` | Last recorded API response duration |
| `workerProcessedPerMinute` | `processedTotal / uptime minutes` (approximate) |
| `publishSuccessRate` | `publishedTotal / (published + failed) × 100` |
| `queueDepthTotal` | `queueWaiting + queueActive` |

Additional headers:

- `x-response-time-ms` on every response
- `Cache-Control: no-store` on operational endpoints
- `Cache-Control: public, max-age=60` on `/version`

Database health probes are cached for 5 seconds to reduce load from frequent `/health` polling.

## Future horizontal scaling

Current architecture is single-node Docker Compose. Horizontal scaling path (not implemented in Sprint 49):

1. **Stateless API** — run multiple API replicas behind a load balancer; shared PostgreSQL + Redis
2. **Worker pool** — scale worker containers independently; BullMQ distributes jobs
3. **Read replicas** — route asset list and publishing history to PostgreSQL read replicas
4. **Redis Cluster** — required when queue depth exceeds single-instance Redis capacity
5. **Object storage** — replace local `STORAGE_LOCAL_ROOT` with S3-compatible storage for multi-node media access

No application redesign is required for steps 1–2; configuration and infrastructure changes only.
