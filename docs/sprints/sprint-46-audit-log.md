# Sprint 46 — Audit Log & Activity Center

## Objective

Introduce a centralized audit log and Activity Center that records operational events across the platform for traceability, compliance, and operational visibility.

## Event model

Each audit event is a structured record:

| Field | Description |
|-------|-------------|
| `id` | UUID — unique event identifier |
| `type` | Dot-notation event type (e.g. `queue.pause`, `auth.rbac_denied`) |
| `category` | `auth`, `publishing`, `queue`, `provider`, `composer`, or `system` |
| `severity` | `info`, `warn`, `error`, or `critical` |
| `actor` | Who triggered the event — `{ type, id, role? }` |
| `target` | Optional affected resource — `{ type, id }` |
| `correlationId` | Request ID (`X-Request-Id`) for tracing related events |
| `metadata` | Free-form JSON context |
| `timestamp` | ISO 8601 UTC |

### Event types

**Authentication**
- `auth.login_success` — JWT authenticated
- `auth.login_failure` — missing or invalid credentials
- `auth.api_key_authenticated` — API key authenticated
- `auth.rbac_denied` — permission check failed (403)

**Publishing**
- `publishing.requested`, `publishing.queued`, `publishing.completed`, `publishing.failed`, `publishing.duplicate_skipped`

**Queue**
- `queue.pause`, `queue.resume`, `queue.drain`, `queue.retry`, `queue.remove`

**Provider**
- `provider.config_updated`, `provider.validation`, `provider.health_check`

**Composer**
- `composer.validation`, `composer.publish`, `composer.bulk_publish`, `composer.schedule`

**System**
- `system.startup`, `system.shutdown`, `system.fatal_error`

## Architecture

```
apps/api/src/audit/
  types.ts                 — AuditEvent, AuditRepository, AuditService interfaces
  in-memory-repository.ts  — Default in-process store (Sprint 46)
  audit-service.ts         — createAuditService() — fire-and-forget record()
  helpers.ts               — actorFromRequest(), auditRecord(), publish helpers
```

### Repository abstraction

`AuditRepository` defines `append`, `list`, and `findById`. Sprint 46 ships an in-memory implementation. Production can swap in a PostgreSQL-backed repository (the `@pcme/database` `AuditLogRepository` is available for future wiring) without changing route handlers.

### Non-blocking guarantee

`AuditService.record()` is fire-and-forget. Repository failures are swallowed — audit logging never blocks or fails publishing, queue operations, or any other workflow.

## Correlation IDs

Every HTTP request receives an `X-Request-Id` (echoed from the client or generated as UUID v4). Audit events on that request include `correlationId: request.id`, enabling operators to trace a publish workflow from API request through queue events.

## API

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/activity` | `activity:read` | List events with filters (`type`, `actor`, `target`, `start`, `end`, `limit`) |
| GET | `/activity/:id` | `activity:read` | Full event detail |

RBAC: `activity:read` granted to Admin, Operator, Publisher, and Viewer.

## Dashboard — Activity Center

Route: `GET /activity`

Features:
- Timeline table with severity badges
- Filter form (type, actor, target, date range, limit)
- Event detail panel with correlation ID and JSON metadata viewer
- Nav link visible when `activity:read` permission is granted

## Future external sinks

The repository abstraction allows plugging in:
- PostgreSQL (`AuditLogRepository` in `@pcme/database`)
- Structured log shipping (e.g. JSON lines to stdout for log aggregators)
- Webhook or message-bus fan-out for SIEM integration

No external systems are wired in Sprint 46 — all events stay in-process.

## Smoke & verification

```bash
pnpm audit:smoke   # API + dashboard offline smoke
pnpm test
pnpm build
```

## Non-goals (Sprint 46)

- No redesign of auth, RBAC, queue, scheduler, or Publisher SDK
- No external logging systems or realtime streaming
- No business logic changes to existing workflows
