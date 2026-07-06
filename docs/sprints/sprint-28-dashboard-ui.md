# Sprint 28 — Dashboard Web UI

## Goal

Create the first read-only dashboard UI that consumes the Sprint 27 dashboard API endpoints.
This sprint is **frontend only** — no publishing pipeline changes, no worker changes, no auth.

---

## UI Scope

The dashboard is a **server-side rendered (SSR) HTML page** served by a minimal Fastify application
inside `apps/dashboard`. On every `GET /` request, the server fetches the three dashboard API
endpoints concurrently, assembles the page data, and returns a fully rendered HTML document.

There is no client-side JavaScript and no external CSS framework. All styles are inline.

### Sections displayed

| Section | Data source |
|---------|-------------|
| System Health | `GET /dashboard/health` |
| Publishing Summary (counts, lastPublished, AI provider, driver) | `GET /dashboard/summary` |
| System Capabilities (duplicate detection, scheduler, retry) | `GET /dashboard/summary` |
| Publisher Breakdown table | `GET /dashboard/summary` |
| Recent Published Content table | `GET /dashboard/recent` |

### Graceful degradation

If any API endpoint returns an error or is unreachable, the dashboard still returns HTTP 200 with:
- An error banner listing which endpoints failed
- Each failed section shows an "unavailable" message
- Sections with available data render normally

---

## API Endpoints Consumed

| Method | Path | Used for |
|--------|------|---------|
| GET | `http://<apiBase>/dashboard/health` | health cards, version, env |
| GET | `http://<apiBase>/dashboard/summary` | count cards, publishers, capabilities |
| GET | `http://<apiBase>/dashboard/recent` | recent content table (limit 10) |

---

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `DASHBOARD_API_BASE_URL` | `http://localhost:3001` | Base URL of the API server |
| `DASHBOARD_PORT` | `3002` | Port the dashboard listens on |
| `DASHBOARD_HOST` | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | `info` | Pino log level |

---

## Local Run

Start the API first:
```bash
cd /path/to/pc-media-engine
pnpm --filter @pcme/api dev
# or: pnpm --filter @pcme/api start
```

Then start the dashboard:
```bash
pnpm --filter @pcme/dashboard dev
# or: node apps/dashboard/dist/index.js
```

Open [http://localhost:3002](http://localhost:3002) in a browser.

---

## Architecture

```
Browser
  │  GET /
  ▼
apps/dashboard (Fastify SSR — port 3002)
  │  fetchAllDashboardData()
  │    ├── GET /dashboard/health
  │    ├── GET /dashboard/summary
  │    └── GET /dashboard/recent
  ▼
apps/api (Fastify — port 3001)
  │  reads from
  ▼
packages/database (PostgreSQL via Prisma)
```

The `DashboardApiClient` interface is injected into `buildDashboardApp()`, enabling
full offline testing without a running API server.

---

## Implementation

| File | Purpose |
|------|---------|
| `src/types.ts` | Response type definitions (mirrors Sprint 27 API shapes) |
| `src/config.ts` | `loadDashboardConfig()` — reads env vars |
| `src/client.ts` | `DashboardApiClient` interface + HTTP implementation + `fetchAllDashboardData()` |
| `src/renderer.ts` | `renderDashboardPage(data)` → HTML string with inline CSS |
| `src/app.ts` | `buildDashboardApp(options)` — Fastify app; `GET /` handler |
| `src/index.ts` | Server entrypoint |
| `src/__tests__/renderer.test.ts` | 26 unit tests for `renderDashboardPage` |
| `src/__tests__/app.test.ts` | 12 integration tests via `fastify.inject()` |
| `scripts/smoke.ts` | Offline smoke script |

---

## Smoke

```bash
pnpm --filter @pcme/dashboard smoke
```

Fully offline — no API server required.
Uses `buildDashboardApp()` with an in-memory fixture client and `fastify.inject()`.

Covers: full data, summary cards, health section, publisher table, recent table, empty recent,
API error state (all down), capabilities flags.

---

## Limitations

- **No real-time updates** — page data is a snapshot at request time; reload to refresh.
- **No client-side JavaScript** — no live polling, no WebSocket. Deferred to a later sprint.
- **No authentication** — the dashboard is accessible to anyone who can reach the port.
- **No pagination UI** — `GET /dashboard/recent` always requests 10 items.
- **No search or filtering** — history filtering is available via the API but not exposed in the UI yet.
- **No loading spinner** — SSR means the page either renders fully or shows unavailable messages; there is no intermediate loading state.

---

## Why Auth, Mutations, and Queue Controls Are Deferred

| Concern | Why deferred |
|---------|-------------|
| **Authentication** | Auth adds cross-cutting infrastructure (API keys, session storage, middleware). Adding it without a proper auth strategy would produce throwaway code. Planned for a dedicated auth sprint. |
| **Write operations / mutations** | The API only exposes read-only endpoints in Sprint 27. Write endpoints (retry, soft-delete, queue drain) require auth to be safe and belong in separate sprints. |
| **Queue controls** | BullMQ pause/resume/drain are destructive operations affecting the live worker. They must be gated behind auth and proper role checks before being surfaced in a UI. |
| **Client-side JS / live polling** | Requires either a bundler (webpack/vite) or a SPA framework, both of which significantly expand the dependency footprint. The SSR-only approach keeps `apps/dashboard` minimal and aligned with the current repo conventions. |
