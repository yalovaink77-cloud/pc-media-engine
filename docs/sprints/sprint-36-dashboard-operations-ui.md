# Sprint 36 — Dashboard v2 Operations UI

## Objective

Upgrade the dashboard from read-only status display into an operations UI with
queue management controls. All actions call existing Sprint 32 queue APIs — no
new backend capabilities were added.

---

## UI Sections

The dashboard page renders six sections in order:

1. **System Health** — API, database, publisher driver, retry config
2. **Observability & Metrics** — counters and queue gauges from `/metrics`
3. **Publishing Summary** — totals, capabilities, publisher breakdown
4. **Recent Publishing History** — latest `PublishedContent` rows
5. **Queue Status** — live BullMQ counts from `/queue/status`
6. **Queue Operations Panel** — pause, resume, drain, retry, remove controls

Flash banners appear at the top after an operation completes (success or error).

---

## Queue Operations Panel

| Control | Dashboard route | API endpoint |
|---|---|---|
| Pause Queue | `POST /ops/queue/pause` | `POST /queue/pause` |
| Resume Queue | `POST /ops/queue/resume` | `POST /queue/resume` |
| Drain Queue | `POST /ops/queue/drain` | `POST /queue/drain` |
| Retry Job | `POST /ops/queue/retry` (form: `jobId`) | `POST /queue/jobs/:id/retry` |
| Remove Job | `POST /ops/queue/remove` (form: `jobId`) | `DELETE /queue/jobs/:id` |

### Flow

1. User clicks a button or submits a form on the dashboard.
2. Dashboard server receives the POST at `/ops/queue/*`.
3. Dashboard API client calls the PC Media Engine API with `DASHBOARD_API_KEY`.
4. Dashboard redirects to `/?flash=...&flashType=ok|err` (PRG pattern).
5. Page re-renders with a flash banner showing the result.

No client-side JavaScript framework — plain HTML forms only.

---

## API Endpoints Consumed

### Read-only (existing)

| Endpoint | Purpose |
|---|---|
| `GET /dashboard/health` | System health cards |
| `GET /dashboard/summary` | Publishing totals and capabilities |
| `GET /dashboard/recent` | Recent history table |
| `GET /metrics` | Observability counters |
| `GET /queue/status` | Queue status section |

### Mutations (Sprint 36)

| Endpoint | Purpose |
|---|---|
| `POST /queue/pause` | Pause publishing queue |
| `POST /queue/resume` | Resume publishing queue |
| `POST /queue/drain` | Drain waiting jobs |
| `POST /queue/jobs/:id/retry` | Re-queue a failed job |
| `DELETE /queue/jobs/:id` | Remove a job |

All mutation endpoints require authentication when `PCME_AUTH_ENABLED=true`.

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `DASHBOARD_API_BASE_URL` | No | API base URL (default: `http://localhost:3001`) |
| `DASHBOARD_API_KEY` | When auth enabled | Sent as `X-API-Key` for `/queue/*` endpoints |
| `DASHBOARD_PORT` | No | Dashboard listen port (default: `3002`) |

When `DASHBOARD_API_KEY` is not set, the operations panel shows a warning hint.
If an action returns HTTP 401, a clear error flash is displayed — the page does
not crash.

---

## Auth Limitation

This sprint adds **no login UI**. Authentication is env-var based only:

- Set `DASHBOARD_API_KEY` to one of the values in `PCME_API_KEYS`.
- The dashboard passes it as `X-API-Key` on queue endpoints.
- There is no user session, no password form, no token refresh.

This is intentional for the beta operations phase.

---

## Architecture

```
Browser ──POST /ops/queue/pause──▶ Dashboard (Fastify SSR)
                                      │
                                      └──POST /queue/pause + X-API-Key──▶ API
```

The dashboard acts as a thin proxy/UI layer. All queue logic remains in the API
and BullMQ — unchanged from Sprint 32.

---

## Testing

| File | Coverage |
|---|---|
| `renderer.test.ts` | Operations panel HTML, flash banners, API key hints |
| `app.test.ts` | POST action routes, redirects, unauthorized flash |
| `client.test.ts` | Queue API client methods, 401 mapping, network errors |

---

## Smoke

```
pnpm dashboard-ops:smoke
```

7 offline sections using mocked `DashboardApiClient`:
panel render, pause, resume, drain, retry form, remove form, unauthorized display.

---

## Future Work

- **Login UI** — browser-based authentication with session cookies
- **RBAC** — role-based access (viewer vs operator vs admin)
- **Queue detail pages** — per-job inspection, bulk retry, dead-letter queue view
- **Confirmation dialogs** — JavaScript confirm for destructive actions (drain, remove)
- **WebSocket live updates** — queue counts without page reload

---

## Verification

```
pnpm --filter @pcme/dashboard test
pnpm --filter @pcme/dashboard lint
pnpm build
pnpm dashboard-ops:smoke
```
