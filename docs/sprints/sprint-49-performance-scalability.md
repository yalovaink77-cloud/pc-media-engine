# Sprint 49 — Performance & Scalability

## Objective

Prepare PC Media Engine for higher load and larger production usage through measurement, safe optimization, and scalability readiness — without changing product behaviour.

## Deliverables

| Category | Artifacts |
|----------|-----------|
| Performance tools | `apps/api/scripts/benchmark-api.ts`, `load-test-light.ts`, worker `throughput-benchmark.ts`, dashboard `render-benchmark.ts` |
| API optimizations | Response timing middleware, cache headers, cached DB health checks, shared pagination helpers |
| Database | Sprint 49 migration — publishing history + status indexes |
| Worker | Concurrency validation documented; throughput benchmark script |
| Dashboard | Defensive list limits on composer/notifications fetches |
| Monitoring | Extended `/metrics`: `apiResponseTimeMs`, `workerProcessedPerMinute`, `publishSuccessRate`, `queueDepthTotal` |
| Docs | [Performance Guide](../performance/performance-guide.md) |

## Architecture (unchanged)

```
Client → API (Fastify) → PostgreSQL / Redis / Storage
              ↓
           Worker (BullMQ)
```

Sprint 49 adds observability and guardrails around this existing architecture.

## Key optimisations

1. **Response timing** — `x-response-time-ms` header + `apiResponseTimeMs` metric
2. **Health probe cache** — 5-second TTL on database liveness checks
3. **Queue metrics wiring** — `queueMetricsProvider` connected in production `server.ts`
4. **Pagination consistency** — shared `apps/api/src/pagination.ts` used across list routes
5. **Indexes** — `(projectId, publishedAt DESC)` and `(status)` on `published_content`

## Smoke & verification

```bash
pnpm performance:smoke
pnpm test
pnpm build
```

## Non-goals (Sprint 49)

- No API, worker, dashboard, or Publisher SDK redesign
- No publishing logic or retry/scheduler semantic changes
- No new providers
- No horizontal scaling implementation (documented only)

See [Performance Guide](../performance/performance-guide.md) for benchmark methodology, safe limits, and concurrency recommendations.
