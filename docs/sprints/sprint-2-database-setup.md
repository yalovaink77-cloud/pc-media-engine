# Sprint 2 — Database Foundation

**Status:** Complete  
**Package:** `@pcme/database`

## Scope Boundaries

Sprint 2 is **strictly limited to the database foundation** in `@pcme/database`.

**In scope:** Prisma schema, migrations, seed, env validation, client lifecycle, `db:health` smoke script, repositories, unit tests (no live DB).

**Explicitly out of scope — do not add in Sprint 2:**

- NestJS, authentication, authorization
- Queues, workers, business logic
- Media processing, dashboard implementation
- Runnable app shells (`/health`, dashboard placeholder) — **deferred from Sprint 1 DoD; not addressed here**
- Postgres service in CI
- Database-backed integration tests (planned Sprint 2+)

**Environment:**

- Local: database scripts load the **repo root `.env`** via `dotenv-cli` — run `cp .env.example .env` first
- CI: placeholder `DATABASE_URL` only for `prisma generate` (no Postgres container)

## Overview

Sprint 2 adds PostgreSQL persistence via Prisma in `packages/database`:

- Initial schema aligned with Sprint 0 architecture
- Environment validation for `DATABASE_URL` (fail fast)
- Singleton Prisma client with connect/disconnect lifecycle
- Database health check (`SELECT 1`)
- Repository layer with mandatory `projectId` scoping
- Append-only audit log helper
- Seed script for `default-operator` + `piercingconnect`

## Local Setup

```bash
# 1. Environment
cp .env.example .env

# 2. Start PostgreSQL
docker compose up -d

# 3. Install dependencies
pnpm install

# 4. Generate Prisma client
pnpm db:generate

# 5. Apply migrations
pnpm db:migrate:dev

# 6. Seed bootstrap data
pnpm db:seed

# 7. Verify connectivity
pnpm db:health
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate:dev` | Create/apply migrations (development) |
| `pnpm db:migrate` | Apply migrations (CI/production-style) |
| `pnpm db:seed` | Seed default organization and PiercingConnect project |
| `pnpm db:health` | Run connectivity smoke check |

## Entities

- `Organization`, `Project`
- `ContentItem`, `ContentVersion`, `SeoProfile`
- `Asset` (soft delete via `deletedAt`)
- `PublishingOutboxEntry`, `PublishRecord`
- `AiJob`, `AuditLogEntry`, `AnalyticsSnapshot`

## Repository Usage

```typescript
import {
  appendAuditLog,
  OrganizationRepository,
  ProjectRepository,
  requireProjectId,
} from '@pcme/database';
```

All project-scoped queries require an explicit `projectId`. Empty values throw `ProjectScopeError`.

## Out of Scope (Sprint 2)

- NestJS API integration, auth, authorization
- Queues (BullMQ), workers, business logic
- Media upload, AI pipeline, dashboard UI
- Runnable app shells (`GET /health`, dashboard placeholder) — remains deferred
- Postgres RLS (deferred per ADR 004)
- CI Postgres service and DB integration tests (Sprint 2+)
