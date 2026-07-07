# PC Media Engine — Beta Release Candidate (v0.50.0-beta-rc)

> **Release date:** July 2026  
> **Sprints completed:** 1–49 (+ Sprint 50 release validation)  
> **Status:** Beta Release Candidate

---

## Overview

PC Media Engine (PCME) v0.50.0-beta-rc is the first **Beta Release Candidate** — a production-oriented media processing and publishing platform with a complete operational toolkit, RBAC, observability, and multi-publisher support.

This release consolidates 49 development sprints into a validated, documented, smoke-tested candidate suitable for real-world beta deployments.

---

## Release validation summary

Sprint 50 performed the following checks (automated via `pnpm beta-rc:smoke`):

| Area | Status |
|------|--------|
| Sprint 1–49 documentation | ✓ 48+ sprint docs + architecture/deployment guides |
| Public API route modules | ✓ 15 route modules verified |
| Health endpoints | ✓ `/health`, `/dashboard/health`, `/publishing/health`, `/auth/health` |
| Metrics endpoint | ✓ `/metrics` with Sprint 49 performance fields |
| Dashboard navigation | ✓ 10 primary nav routes |
| RBAC permissions | ✓ 17 permissions across 4 roles |
| Example env templates | ✓ `.env.example` + `.env.production.example` |
| Offline smoke suites | ✓ 27 suites aggregated |
| TODO/FIXME in source | ✓ None in production TypeScript |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Edge: Dashboard :3002  ·  API :3001                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  API (Fastify) — upload, assets, composer, publishing,      │
│  jobs, queue ops, calendar, RBAC, audit, notifications      │
└──────────┬───────────────────────────────┬──────────────────┘
           │                               │
┌──────────▼──────────┐         ┌──────────▼──────────┐
│  Worker (BullMQ)    │         │  PostgreSQL + Redis │
│  processing +       │         │  + local storage    │
│  publishing queues  │         └─────────────────────┘
└─────────────────────┘
```

See [System Overview](../architecture/system-overview.md) and [Module Map](../architecture/module-map.md).

---

## Completed modules

| Module | Capability |
|--------|------------|
| **API** | Upload, assets, composer, bulk publish, scheduling, jobs, queue ops |
| **Worker** | Thumbnail processing, publishing, retry, duplicate detection |
| **Dashboard** | SSR ops UI — jobs, assets, calendar, activity, notifications |
| **Database** | Prisma schema — assets, jobs, publishing history, audit |
| **Publisher SDK** | Shared publisher plugin framework |
| **Deployment** | Production Docker Compose, ops scripts, backup/restore |
| **Performance** | Benchmarks, pagination guards, extended metrics |

---

## Supported publishers

| Publisher | Status | Notes |
|-----------|--------|-------|
| `mock` | ✓ Production-ready | Default for development and testing |
| `wordpress` | ✓ Production-ready | Media upload + draft post creation |
| `ghost` | ✓ Beta | Admin API integration |

Plugin placeholders exist for Instagram, Pinterest, YouTube, X/Twitter, Amazon Affiliate, Buy Me a Coffee — not implemented.

---

## Smoke commands

| Command | Scope |
|---------|-------|
| `pnpm beta-rc:smoke` | **Full RC validation** — all offline suites + release checks |
| `pnpm beta:smoke` | Startup validation, health, metrics, graceful shutdown |
| `pnpm deployment:smoke` | Docker Compose + ops scripts |
| `pnpm performance:smoke` | Performance middleware + benchmarks |
| `pnpm rbac:smoke` | RBAC permissions and route guards |

Live-only (require DB/Redis): `pnpm e2e:smoke`, `pnpm publishing-history:smoke`

---

## Documentation index

- [Beta RC Milestone v0.50](../milestones/beta-rc-v0.50.md)
- [Changelog v0.50](./changelog-v0.50.md)
- [Upgrade Guide v0.50](./upgrade-guide-v0.50.md)
- [Beta Deployment Checklist](./beta-checklist.md)
- [Deployment Guide](../deployment/deployment-guide.md)
- [Performance Guide](../performance/performance-guide.md)

---

## Known limitations

- Single-node deployment (horizontal scaling documented, not implemented)
- Local filesystem storage only (S3/R2 providers are placeholders)
- In-memory audit log and notifications (Prisma audit model exists; API uses in-memory store)
- In-memory API metrics (reset on process restart)
- No built-in TLS termination (use reverse proxy)

See [Beta RC Milestone — Known Limitations](../milestones/beta-rc-v0.50.md#known-limitations).

---

## Upgrade path

From v0.49.0-alpha-sprint49 or earlier alpha/beta tags:

1. Pull v0.50.0-beta-rc
2. Apply database migrations: `pnpm db:migrate`
3. Review env changes in [Upgrade Guide v0.50](./upgrade-guide-v0.50.md)
4. Run `pnpm beta-rc:smoke` before deploying

---

## Verification

```bash
pnpm test
pnpm build
pnpm beta-rc:smoke
```
