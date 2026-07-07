# PC Media Engine — Beta Release Candidate Milestone (v0.50)

> Date: July 2026  
> Sprints completed: 1–49 (+ Sprint 50 release validation)  
> Tag: `v0.50.0-beta-rc`  
> Status: **Beta Release Candidate**

---

## Purpose

PC Media Engine (PCME) is a reusable media and content operating system. It ingests media, processes assets, and publishes content to external platforms via an asynchronous worker pipeline.

v0.50.0-beta-rc marks the transition to a **validated release candidate** ready for production beta deployments.

---

## Architecture

```
Clients → API (Fastify :3001) → PostgreSQL + Redis + Storage
              ↓
         Dashboard (SSR :3002)
              ↓
         Worker (BullMQ) → Publishers (mock, wordpress, ghost)
```

See [System Overview](../architecture/system-overview.md).

---

## Completed modules

| Area | Capabilities |
|------|-------------|
| API | Upload, assets, composer, bulk publish, scheduling, jobs, queue ops, calendar, RBAC, audit, notifications |
| Worker | Thumbnails, publishing, retry, duplicate detection |
| Dashboard | Full ops UI with RBAC-aware navigation |
| Deployment | Docker Compose, backup/restore, ops scripts |
| Performance | Benchmarks, pagination guards, extended metrics |

---

## Supported publishers

| Publisher | Status |
|-----------|--------|
| `mock` | Stable |
| `wordpress` | Stable |
| `ghost` | Beta |

---

## Operational capabilities

- Health: `/health`, `/dashboard/health`, `/publishing/health`, `/auth/health`
- Metrics: `GET /metrics` with performance fields
- Auth: JWT + API key with 4 RBAC roles
- Deployment: Docker Compose + ops scripts
- Smoke: 27 offline suites via `pnpm beta-rc:smoke`

---

## Known limitations

1. Single-node deployment only
2. Local filesystem storage (S3/R2 placeholders)
3. In-memory audit log and notifications
4. Ephemeral in-process metrics
5. No rate limiting
6. Social publisher plugins not implemented

---

## Roadmap to v1.0

| Phase | Goals |
|-------|-------|
| v0.51–0.55 | PostgreSQL audit persistence, S3 storage |
| v0.56–0.60 | Rate limiting, webhook notifications |
| v0.61–0.65 | Horizontal scaling implementation |
| v1.0 | Production GA with HA deployment docs |

---

## Verification

```bash
pnpm test
pnpm build
pnpm beta-rc:smoke
```

---

## Documentation

- [Beta Release Candidate](../releases/beta-release-candidate.md)
- [Changelog v0.50](../releases/changelog-v0.50.md)
- [Upgrade Guide v0.50](../releases/upgrade-guide-v0.50.md)
