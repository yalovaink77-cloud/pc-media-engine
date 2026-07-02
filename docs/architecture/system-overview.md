# PC Media Engine — System Overview

## Purpose

PC Media Engine is a reusable **media and content operating system**. It provides shared infrastructure for storing media, generating content with AI, optimizing for SEO, publishing to channels, and tracking performance over time.

It is **not** a single-purpose tool for one brand. PiercingConnect is the first consumer; future projects (Lumora, GagBox, Barber SaaS, and others) will run on the same engine with project-specific configuration.

## Hierarchy

```
Organization
  └── Project (e.g. piercingconnect)
        ├── Content / Media / SEO / Analytics
        ├── Integrations (WordPress, BMC, affiliate)
        └── PublishingOutbox → Worker → Renderer → Publisher → WordPress
```

## Design Principles

1. **Engine, not app** — Business logic lives in packages; projects are configuration + content types + plugins.
2. **Provider abstraction** — AI models and storage backends are swappable via interfaces.
3. **Plugin extensibility** — Publishing and monetization channels are plugins, not core code.
4. **Organization → Project isolation** — Every resource belongs to a Project; every Project belongs to an Organization.
5. **Local-first MVP** — Ship with local storage and one AI provider; expand without rewrites.
6. **Async by default** — Long-running work runs in a worker via BullMQ.
7. **Reliable publishing via outbox** — External publish never happens inside synchronous business logic.
8. **URLs, not paths** — Business logic resolves media via `MediaUrlResolver`, never raw storage keys.
9. **Auditable operations** — All significant actions append to an immutable audit log.
10. **Orchestration ≠ rendering ≠ publishing** — AI/content workflows, output rendering, and channel delivery are separate concerns.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        apps/dashboard (Next.js)                  │
│              Content ops UI · Media library · SEO · Publish      │
└────────────────────────────┬────────────────────────────────────┘
                              │ REST
┌────────────────────────────▼────────────────────────────────────┐
│                        apps/api (NestJS)                         │
│         Auth · Workspaces · Content CRUD · Outbox enqueue        │
└──────┬──────────────────────────────┬───────────────────────────┘
        │ Prisma                       │ BullMQ
        ▼                              ▼
┌──────────────┐              ┌──────────────────┐
│  PostgreSQL  │              │  apps/worker      │
│  (metadata)  │              │  Outbox · AI ·    │
└──────────────┘              │  Render · Publish │
                              └─────────┬─────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              ▼                         ▼                         ▼
      packages/ai              packages/publishing          packages/media
      (provider iface)         (Renderer · Publisher)       (Storage · URL resolver)
              │                         │                         │
              ▼                         ▼                         ▼
      providers/ai/*            plugins/wordpress              providers/storage/*
```

## Monorepo Layout

| Path                  | Role                                                 |
| --------------------- | ---------------------------------------------------- |
| `apps/dashboard`      | Operator-facing Next.js UI                           |
| `apps/api`            | HTTP API, auth, orchestration                        |
| `apps/worker`         | Background jobs (outbox, AI, analytics)              |
| `packages/core`       | Organization/Project context, plugin registry, audit |
| `packages/database`   | Prisma schema, migrations, repositories              |
| `packages/ai`         | AI pipeline orchestration                            |
| `packages/media`      | Asset upload, tagging, MediaUrlResolver              |
| `packages/content`    | Content types, lifecycle, orchestrator               |
| `packages/seo`        | Keywords, meta, schema, scoring                      |
| `packages/publishing` | Outbox, Renderer, Publisher                          |
| `packages/analytics`  | Performance tracking, stale content detection        |
| `packages/shared`     | Utilities, constants, shared types                   |
| `plugins/*`           | Channel and monetization integrations                |
| `providers/*`         | Concrete AI and storage implementations              |

## Tech Stack

| Layer                 | Choice                              |
| --------------------- | ----------------------------------- |
| Frontend              | Next.js                             |
| Backend               | NestJS                              |
| Database              | PostgreSQL                          |
| ORM                   | Prisma                              |
| Queue                 | BullMQ                              |
| Cache / queue backend | Redis                               |
| Storage               | Local (MVP) → R2 / S3               |
| AI                    | Provider abstraction (Claude first) |
| Publishing            | WordPress REST API                  |

## Cross-Cutting Concerns

| Concern                      | Document                                                       |
| ---------------------------- | -------------------------------------------------------------- |
| Organization & Project model | [project-workspace-model.md](./project-workspace-model.md)     |
| Content lifecycle & revision | [content-lifecycle.md](./content-lifecycle.md)                 |
| AI provider interface        | [ai-provider-interface.md](./ai-provider-interface.md)         |
| Storage & URL resolution     | [storage-strategy.md](./storage-strategy.md)                   |
| WordPress publishing         | [wordpress-publishing-flow.md](./wordpress-publishing-flow.md) |
| Module boundaries            | [module-map.md](./module-map.md)                               |

## First Project: PiercingConnect

Configured as workspace `piercingconnect`. Initial content: safety guides, aftercare articles, bump/granuloma/keloid explainers, printable PDFs, FAQ pages, affiliate sections, Buy Me a Coffee blocks.

## Related Documents

- [module-map.md](./module-map.md)
- [content-lifecycle.md](./content-lifecycle.md)
- [ai-provider-interface.md](./ai-provider-interface.md)
- [storage-strategy.md](./storage-strategy.md)
- [wordpress-publishing-flow.md](./wordpress-publishing-flow.md)
- [project-workspace-model.md](./project-workspace-model.md)
- [../decisions/001-monorepo.md](../decisions/001-monorepo.md)
- [../decisions/004-known-risks-before-sprint-1.md](../decisions/004-known-risks-before-sprint-1.md)
