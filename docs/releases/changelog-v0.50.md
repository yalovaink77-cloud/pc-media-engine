# Changelog — v0.50.0-beta-rc

> Release date: July 2026  
> Previous tag: v0.49.0-alpha-sprint49

---

## Beta Release Candidate (Sprint 50)

### Added
- `pnpm beta-rc:smoke` — aggregated offline smoke validation with release summary
- Release documentation: beta RC guide, changelog, upgrade guide, milestone doc
- `release/metadata.json` — central release metadata

### Quality
- Sprint 1–49 documentation review
- Public API, dashboard nav, RBAC, metrics, and health endpoint validation
- Example env template validation
- TODO/FIXME source review (none found)

---

## v0.49 — Performance & Scalability (Sprint 49)

- Response timing middleware (`x-response-time-ms`)
- Extended metrics: `apiResponseTimeMs`, `workerProcessedPerMinute`, `publishSuccessRate`, `queueDepthTotal`
- Shared pagination helpers with consistent limits
- Cached database health probes (5s TTL)
- Publishing history indexes (`projectId+publishedAt`, `status`)
- Offline benchmark scripts (API, load test, worker throughput, dashboard render)
- `pnpm performance:smoke`

---

## v0.48 — Production Deployment Toolkit (Sprint 48)

- Production Docker Compose with three-tier network isolation
- Ops scripts: startup, shutdown, backup, restore, migrate
- Deployment documentation and production checklist
- `pnpm deployment:smoke`

---

## v0.47 — Notification Center (Sprint 47)

- Notifications derived from audit events
- `GET /notifications`, mark read endpoints
- Dashboard notification bell with unread badge

---

## v0.46 — Audit Log (Sprint 46)

- Activity/audit API and dashboard page
- In-memory audit store with notification integration

---

## v0.45 — RBAC (Sprint 45)

- JWT + API key authentication
- Four roles: admin, operator, publisher, viewer
- 17 permissions across API and dashboard

---

## Earlier releases (Sprints 1–44)

See individual sprint docs in [docs/sprints/](../sprints/) and [Beta Preview Milestone v0.30](../milestones/beta-preview-v0.30.md).

Key milestones:
- **Alpha (1–24):** Domain model, upload, worker, WordPress publishing, retry, duplicates
- **Beta preview (25–30):** Scheduler, dashboard, metrics, config validation
- **Feature completion (31–44):** Auth, queue ops, composer, calendar, provider config

---

## Breaking changes (v0.50)

None. v0.50.0-beta-rc is additive over v0.49.

---

## Migration notes

One database migration from v0.49:

- `20260707120000_sprint49_performance_indexes` — additive indexes on `published_content`

Run: `pnpm db:migrate`
