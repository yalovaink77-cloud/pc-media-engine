# Sprint 22 — Publishing History

## Goal

Persist every successful publishing operation so the system knows exactly what was published, where, and when. This is the production foundation for retries, analytics, scheduling, and duplicate prevention (Sprint 23).

---

## Schema

### `PublishedContentStatus`

| Value | Meaning |
|---|---|
| `draft` | Successful draft post created (current orchestrator default) |
| `published` | Reserved for future live publish flows |
| `failed` | Reserved for explicit failure persistence (not written today) |

### `PublishedContent`

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | Primary key |
| `organizationId` | string | Tenant scope |
| `projectId` | string | Project scope |
| `assetId` | string | Source asset from upload pipeline |
| `publisher` | string | `mock` or `wordpress` (driver name) |
| `externalId` | string | Remote post ID from publisher |
| `url` | string | Remote post URL |
| `status` | enum | Currently `draft` on success |
| `publishedAt` | DateTime | From orchestrator result |
| `createdAt` / `updatedAt` | DateTime | Audit timestamps |

**Indexes:** `assetId`, `projectId`, `publisher`, `publishedAt`, `(projectId, assetId)`, `(publisher, externalId)`.

**Migration:** `20260705120000_sprint22_published_content`

---

## Repository

`PublishedContentRepository` (`packages/database`)

| Method | Purpose |
|---|---|
| `create()` | Insert a history row |
| `findByAsset()` | All rows for an asset (newest first) |
| `findLatestByAsset()` | Most recent publish for an asset |
| `findByExternalId()` | Lookup by publisher + remote ID |
| `findLatestByProject()` | Most recent publish in a project |

---

## Worker integration

After `PublishingOrchestrator.publish()` returns **success**:

1. Map `PublishingFlowResult.post` → `externalId` + `url`
2. Require scope fields on queue payload: `organizationId`, `projectId`, `assetId`
3. Persist via `PublishedContentRepository.create()`
4. Status = `draft` (orchestrator creates draft posts)

**Not persisted:**

- Media-only failures
- Draft failures after partial media upload
- Jobs missing scope fields (legacy/manual enqueue)

Publishing queue payload is populated automatically by the Sprint 21 thumbnail → publish chain.

---

## Offline defaults

Unchanged from Sprint 21:

- `PUBLISHER_DRIVER=mock`
- `AI_METADATA_PROVIDER=none`

History rows are written for **successful** mock and WordPress flows alike.

---

## Smoke command

```bash
docker compose up -d
pnpm db:migrate && pnpm db:seed
pnpm publishing-history:smoke
```

Verifies: upload → processing → publishing → `published_content` row with `publisher`, `externalId`, `url`, `publishedAt`, `status`.

---

## Future: duplicate detection (Sprint 23)

`findLatestByAsset()` and `findByExternalId()` provide the lookup surface for:

- Skip re-publish when asset already has a draft
- Idempotent retries keyed by `(publisher, externalId)`

No duplicate logic is implemented in Sprint 22.

---

## Future: analytics

`findByAsset()` and `findLatestByProject()` enable:

- Publish counts per project
- Time-to-publish metrics (asset upload → `publishedAt`)
- Publisher breakdown by `publisher` field

---

## Future: scheduler integration

Scheduled republish jobs can query history to:

- Avoid duplicate drafts
- Resume failed assets only when no successful row exists
- Target specific `externalId` for update flows (deferred)

---

## Verification

```bash
pnpm --filter @pcme/database test
pnpm --filter @pcme/worker test
pnpm --filter @pcme/publishing test
pnpm build
pnpm publishing-history:smoke
```
