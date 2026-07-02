# Module Map

Defines package boundaries, responsibilities, and allowed dependencies.

## Dependency Rules

1. `apps/*` may depend on any `packages/*` and register `plugins/*` / `providers/*`.
2. `packages/*` must **not** depend on `apps/*`.
3. `packages/core` has no dependency on other domain packages.
4. **Core packages must not depend on plugins or providers.**
5. **Plugins may depend on public package interfaces only** — no deep imports.
6. **Apps compose plugins** at bootstrap.
7. All repository queries MUST scope by `projectId`.
8. Domain packages MUST NOT construct storage paths or URLs — use `MediaUrlResolver`.
9. Domain packages MUST NOT call external publish APIs — enqueue via `PublishingOutbox`.
10. `packages/content` MUST NOT render final channel output — delegate to `Renderer`.

## Cross-Cutting Components

### Organization & Project Context (`packages/core`)

- `OrganizationContext` and `ProjectContext` propagated from API middleware / worker job payload
- Every entity carries `organizationId` + `projectId`

### Content Orchestrator (`packages/content`)

- Coordinates AI jobs, lifecycle transitions, SEO analysis triggers
- Does NOT render HTML or call WordPress

### Renderer (`packages/publishing/rendering`)

- Input: `ContentVersion` + `SeoProfile` + resolved media URLs + monetization config
- Output: `RenderedOutput` (HTML, meta, schema, asset refs)
- Block handlers: affiliate, Buy Me a Coffee, FAQ

### Publisher (`packages/publishing/channels`)

- Input: `RenderedOutput` + channel config
- Output: `PublishResult` written back to outbox record
- Implements `PublishingChannel` (WordPress first)

### PublishingOutbox (`packages/publishing` + `packages/database`)

- API/domain writes outbox rows; worker consumes and invokes Renderer → Publisher
- Idempotent keys, status tracking, retries, provider response logging

### MediaUrlResolver (`packages/media`)

- Resolves `Asset` records to URLs by purpose: `public`, `private`, `signed`, `temporary`

### AuditLog (`packages/core` + `packages/database`)

- Append-only log: actor, project, action, entity type, entity id, timestamp, metadata

## Package Responsibilities

### packages/core

Organization/Project context, plugin registry, domain events, error types, audit interface.

### packages/database

Prisma schema, migrations, repositories. Entities: `Organization`, `Project`, `Asset`, `ContentItem`, `ContentVersion`, `SeoProfile`, `PublishingOutboxEntry`, `PublishRecord`, `AnalyticsSnapshot`, `AiJob`, `AuditLogEntry`.

### packages/media

Asset upload, tagging, linking, soft delete. Delegates blobs to `StorageProvider`; URLs via `MediaUrlResolver`.

### packages/ai

Prompt registry, job orchestration (draft, rewrite, summarize, seo-optimize, refresh-suggest). Uses `AiProvider` interface only.

### packages/content

Content types, lifecycle state machine, revision control, version history, block-based formats, orchestrator.

### packages/seo

Focus keyword, meta, slug, internal links, FAQ schema, content score, search intent, refresh scheduling.

### packages/publishing

Outbox, Renderer, Publisher, channel abstraction. Plugin loading for WordPress.

### packages/analytics

Published URL tracking, stale content detection, refresh recommendations. Future: GSC / GA4 adapters.

### packages/shared

Date/time helpers, slugify, markdown utilities, constants.

## Plugins

| Plugin                                           | Responsibility                        |
| ------------------------------------------------ | ------------------------------------- |
| `wordpress`                                      | WP REST API: posts, media, categories |
| `buy-me-a-coffee`                                | Support block rendering               |
| `amazon-affiliate`                               | Product block markup                  |
| `pinterest`, `instagram`, `x-twitter`, `youtube` | Future social publish                 |

## Providers

| Provider                                      | Implements                 |
| --------------------------------------------- | -------------------------- |
| `providers/ai/claude`                         | `AiProvider` (MVP)         |
| `providers/ai/openai`, `gemini`, `openrouter` | `AiProvider` (stubs)       |
| `providers/storage/local`                     | `StorageProvider` (MVP)    |
| `providers/storage/s3`, `cloudflare-r2`       | `StorageProvider` (future) |

## Publish Flow (example)

```
Dashboard → API: POST /content/:id/publish
  → content: validate state = approved, check revision
  → publishing: create PublishingOutboxEntry (idempotencyKey)
  → audit: publish_attempted

Worker: process outbox entry
  → media: MediaUrlResolver.resolve() for linked assets
  → Renderer: produce RenderedOutput
  → Publisher: plugins/wordpress.publish() | .update()
  → outbox: mark succeeded/failed
  → analytics: record PublishRecord
  → content: transition → published (revision check)
  → audit: publish_succeeded | publish_failed
```
