# Sprint 8 — API Foundation

**Status:** Complete  
**Tag:** v0.8.0-alpha-sprint8 (pending)

## Goal

Introduce a minimal, production-ready API service shell that exposes health and
version information, wires existing infrastructure cleanly, and establishes the
patterns that future route sprints will extend.

Sprint 8 is API foundation only. No upload, no processing, no queue, no auth.

## Stack Decisions

| Decision | Choice | Reason |
|---|---|---|
| HTTP framework | Fastify v4 | Lightweight, Pino logging built-in, `inject()` for in-process testing, zero boilerplate |
| Logger | Pino (via Fastify) | Structured JSON logging; pino-pretty in development |
| Request ID | Fastify native `genReqId` + `onSend` hook | UUID v4 generated or echoed from `X-Request-Id`; no extra package |
| Config | Plain env reader `loadConfig()` | No heavy config libraries; env vars from root `.env` via `dotenv` at startup |
| Tests | Vitest + `fastify.inject()` | In-process, no real port, no database needed |

## Endpoints

### `GET /health`

```json
HTTP 200 OK
{
  "status": "ok",
  "uptime": 12.345,
  "env": "development",
  "version": "0.0.0",
  "database": "ok" | "unavailable" | "skipped"
}
```

- Always returns 200 — the service is healthy if it can respond at all.
- `database: "ok"` — Prisma `SELECT 1` succeeded.
- `database: "unavailable"` — Prisma query failed; DB is down or misconfigured.
- `database: "skipped"` — `DATABASE_URL` is not set; check was not attempted.

### `GET /version`

```json
HTTP 200 OK
{
  "name": "pc-media-engine-api",
  "version": "0.0.0",
  "env": "development"
}
```

### `GET /`

```json
HTTP 200 OK
{
  "service": "PC Media Engine API",
  "docs": "/health, /version"
}
```

## Request ID

Every response carries `X-Request-Id`.

- If the caller sends `X-Request-Id: <value>`, it is echoed back unchanged.
- If absent, a UUID v4 is generated for that request.
- The request ID appears in all Pino log lines for the request lifecycle.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `API_PORT` | `3001` | TCP port |
| `API_HOST` | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | `info` | Pino log level |
| `NODE_ENV` | `development` | Runtime environment |
| `DATABASE_URL` | _(unset)_ | If set, health check queries the database |

All variables are read from the monorepo root `.env` at startup (via `dotenv`
with `override: false` so platform-injected env takes precedence in production).

## How to Run Locally

### Prerequisites

```bash
docker compose up -d          # Start Postgres + Redis
pnpm install                  # Install dependencies
```

### Development (watch mode)

```bash
pnpm --filter @pcme/api dev
# or from repo root:
# pnpm -C apps/api dev
```

Server starts at `http://localhost:3001`.

```bash
curl http://localhost:3001/health
curl http://localhost:3001/version
curl http://localhost:3001/
```

### Production build

```bash
pnpm build
node apps/api/dist/index.js
```

## Graceful Shutdown

The server handles `SIGTERM` and `SIGINT`:

1. Logs the shutdown signal.
2. Calls `fastify.close()` to drain in-flight requests.
3. Exits with code 0 on success, 1 on error.

This makes the server compatible with Kubernetes graceful termination and
`docker stop`.

## Application Structure

```
apps/api/src/
  config.ts                   — Config type + loadConfig() from env
  app.ts                      — buildApp(options) → FastifyInstance (testable)
  server.ts                   — startServer(config): listen + graceful shutdown
  index.ts                    — Entry point: load dotenv → startServer
  routes/
    health.ts                 — GET /health
    version.ts                — GET /version
    root.ts                   — GET /
  __tests__/
    health.test.ts            — 10 tests
    version.test.ts           — 7 tests
    request-id.test.ts        — 6 tests
```

## Test Coverage

```
__tests__/health.test.ts      (10 tests)
  - returns 200
  - status: ok
  - uptime is a number
  - env from config
  - version from config
  - database: skipped when no checkDatabase
  - database: ok when checkDatabase returns ok
  - database: unavailable propagated
  - always 200 even when database unavailable
  - Content-Type: application/json

__tests__/version.test.ts     (7 tests)
  - /version returns 200, name, version, env, content-type
  - / returns 200, service identity

__tests__/request-id.test.ts  (6 tests)
  - response always has X-Request-Id
  - generated ID is a UUID v4
  - caller's X-Request-Id is echoed back
  - two concurrent requests get different IDs
  - X-Request-Id on /version
  - X-Request-Id on /

Total: 23 tests, 0 failures
```

## Intentionally Deferred

| Deferred | Reason |
|---|---|
| File upload (`POST /assets`) | Sprint 9+ — requires storage integration and auth |
| Media processing | Sprint 10+ — requires worker + queue |
| Authentication / JWT | Deferred until auth sprint |
| Rate limiting | Deferred — no public surface yet |
| CORS | Deferred — no frontend integration yet |
| Helmet (security headers) | Deferred — foundation first |
| OpenAPI / Swagger | Deferred — add when business routes land |
| Dashboard integration | Deferred — Next.js app not started |
| Signed URLs | Deferred — storage cloud sprint |

## Changed Files

```
apps/api/
  package.json                    — added fastify, dotenv, vitest, tsx; dev/start scripts
  src/config.ts                   — NEW: Config type + loadConfig()
  src/app.ts                      — NEW: buildApp factory
  src/server.ts                   — NEW: startServer + graceful shutdown
  src/index.ts                    — replaced stub: dotenv load + startServer
  src/routes/health.ts            — NEW: GET /health
  src/routes/version.ts           — NEW: GET /version
  src/routes/root.ts              — NEW: GET /
  src/__tests__/health.test.ts    — NEW: 10 tests
  src/__tests__/version.test.ts   — NEW: 7 tests
  src/__tests__/request-id.test.ts — NEW: 6 tests

docs/sprints/sprint-8-api-foundation.md   — this file
```

## Verification Results

```
pnpm --filter @pcme/api test    →  23/23 pass
pnpm --filter @pcme/api lint    →  0 errors
pnpm build                      →  26/26 packages successful
```

## Recommended Git Commit Message

```
feat(api): implement API foundation with health and version endpoints (Sprint 8)

- Fastify v4 app with structured Pino logging
- GET /health: uptime, env, version, optional database connectivity check
- GET /version: service name, version, env
- GET /: service identity
- X-Request-Id on every response (echo or UUID v4 generated)
- Graceful shutdown on SIGTERM / SIGINT
- Config loaded from env (API_PORT, LOG_LEVEL, NODE_ENV, DATABASE_URL)
- buildApp factory separates construction from listen for testability
- 23-test vitest suite using fastify.inject() — no real port, no database
```
