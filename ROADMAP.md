# PC Media Engine — Roadmap

**Version:** v0.1.0-alpha  
**First project:** PiercingConnect  
**Status:** Sprint 0 complete · Sprint 1 next

---

## Overview

| Milestone    | Sprints | Outcome                                   |
| ------------ | ------- | ----------------------------------------- |
| v0.1.0-alpha | 0–8     | PiercingConnect MVP on staging            |
| v0.1.0       | 9       | Production-ready single-operator deploy   |
| v1.0         | Post-9  | General availability, multi-project ready |

---

## Sprint 0 — Architecture ✅

**Status:** Complete

### Deliverables

- System overview, module map, content lifecycle
- AI provider interface, storage strategy, WordPress publishing flow
- Organization → Project workspace model
- Publishing outbox, MediaUrlResolver, audit log, revision control
- Renderer / Publisher / Orchestrator separation
- ADRs 001–004 (monorepo, local storage, provider abstraction, known risks)
- Engineering principles

### Exit criteria

- Architecture documented and reviewed
- Known risks explicitly recorded
- No production application code

---

## Sprint 1 — Repository Foundation

**Goal:** Monorepo scaffold, package boundaries, dev tooling — no feature logic.

### Deliverables

- pnpm workspaces + Turborepo
- Folder structure: `apps/`, `packages/`, `plugins/`, `providers/`
- Empty package stubs with `@pcme/*` naming
- Shared TypeScript, ESLint, Prettier, EditorConfig
- Docker Compose: Postgres + Redis
- `.env.example`, CONTRIBUTING.md, LICENSE (MIT)
- CI: lint + typecheck + build
- README bootstrap instructions

See [docs/sprints/sprint-1-plan.md](docs/sprints/sprint-1-plan.md).

---

## Sprint 2 — Database Foundation

**Goal:** Prisma schema, core entities, repositories, Organization/Project bootstrap.

### Deliverables

- Entities: Organization, Project, ContentItem, ContentVersion, Asset, SeoProfile, PublishingOutboxEntry, PublishRecord, AiJob, AuditLogEntry, AnalyticsSnapshot
- Migrations + seed (default org + PiercingConnect)
- Repository layer with mandatory `projectId` scoping
- Audit log append helper
- Soft delete on Asset, ContentItem

---

## Sprint 3 — AI Layer

**Goal:** Provider abstraction, prompt registry, AI job pipeline.

### Deliverables

- `AiProvider` interface + Claude implementation
- Prompt template registry
- AiPipeline: draft, rewrite, summarize, seo-optimize, refresh-suggest
- BullMQ `ai.run` job in worker
- AiJob logging + audit events

---

## Sprint 4 — Media Library

**Goal:** Upload, store, tag, resolve URLs — local storage MVP.

### Deliverables

- `StorageProvider` + local implementation
- `MediaUrlResolver` (public, private, signed, temporary)
- MediaService: upload, tag, link, soft delete
- Async thumbnail / PDF preview derivatives
- API routes for upload and metadata

---

## Sprint 5 — Content Engine

**Goal:** Content types, lifecycle, orchestration, SEO foundation.

### Deliverables

- Content types: guide, faq, aftercare-card, printable, affiliate-section, bmc-block
- Lifecycle state machine + revision optimistic locking
- ContentOrchestrator
- Block model + blockSchemaVersion
- Basic SEO package
- PiercingConnect content templates

---

## Sprint 6 — Publishing

**Goal:** Renderer, Publisher, outbox — WordPress end-to-end.

### Deliverables

- Renderer: markdown + blocks → HTML + meta + FAQ schema
- Publisher + WordPress plugin
- PublishingOutbox: idempotency, retries, error logging
- Buy Me a Coffee + affiliate block rendering
- Audit: publish_attempted / succeeded / failed

---

## Sprint 7 — Dashboard MVP

**Goal:** Operator UI for daily content operations.

### Deliverables

- Project switcher, media library, content list/editor
- SEO sidebar, lifecycle actions, publish panel
- Outbox status, job polling, audit timeline

---

## Sprint 8 — PiercingConnect MVP

**Goal:** Real content, real site — end-to-end validation.

### Deliverables

- PiercingConnect config finalized
- P0/P1 content catalog published to WordPress staging
- Printable PDF flow validated
- Operator runbook

---

## Sprint 9 — Production

**Goal:** Harden for single-operator production deploy.

### Deliverables

- Production deploy config
- Backup runbook
- Error monitoring + structured logging
- Basic rate limits
- Revisit ADR 004 minimum bar before multi-tenant

### v0.1.0 tag

First production-capable release for single-operator, single-org use.

---

## v1.0 — General Availability

**Goal:** Multi-project engine ready for Lumora, GagBox, Barber SaaS, and future tenants.

### Scope

- Postgres RLS
- RBAC
- Secrets vault abstraction
- SearchProvider (Meilisearch / OpenSearch)
- Quota enforcement per Organization
- AI governance: provider allowlist, redaction
- Cloudflare R2 / S3 storage
- Analytics: stale content, refresh recommendations
- Gutenberg rendering (if required)
- Block schema migration tooling
- Optional: GSC / GA4, social publishing plugins
- Cross-region DR

---

## Dependency Graph

```
Sprint 0 (Architecture) ✅
    └── Sprint 1 (Repo)
            └── Sprint 2 (Database)
                    ├── Sprint 3 (AI)
                    ├── Sprint 4 (Media)
                    └── Sprint 5 (Content) ← needs 3, 4
                            └── Sprint 6 (Publishing) ← needs 4, 5
                                    └── Sprint 7 (Dashboard) ← needs 3–6
                                            └── Sprint 8 (PiercingConnect MVP)
                                                    └── Sprint 9 (Production)
                                                            └── v1.0 (GA)
```

---

## Version Mapping

| Version      | Sprints | Audience                     |
| ------------ | ------- | ---------------------------- |
| v0.1.0-alpha | 0–8     | Internal / staging           |
| v0.1.0       | 9       | Single-operator production   |
| v1.0         | Post-9  | Multi-project, multi-user GA |

---

## Risk Revisit Schedule

See [docs/decisions/004-known-risks-before-sprint-1.md](docs/decisions/004-known-risks-before-sprint-1.md).

| Risk               | Revisit by                    |
| ------------------ | ----------------------------- |
| Postgres RLS       | Multi-org staging or v1.0     |
| RBAC               | Sprint 7 stretch or v1.0      |
| Secrets vault      | Sprint 9 production prep      |
| SearchProvider     | Sprint 6+ or v1.0             |
| AI data governance | v1.0 or multi-provider config |
| Gutenberg path     | First block-only WP theme     |
| Quota enforcement  | v1.0 or second org onboarded  |
