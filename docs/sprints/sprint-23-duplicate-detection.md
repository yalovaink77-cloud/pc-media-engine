# Sprint 23 — Duplicate Detection Foundation

## Goal

Prevent the same article from being published twice to the same destination.

No scheduler, retry engine, dashboard, or analytics. Duplicate detection only.

---

## Schema change

Added a `slug` column to `published_content`.  
Migration: `20260705130000_sprint23_add_slug`.

```sql
ALTER TABLE "published_content" ADD COLUMN "slug" TEXT NOT NULL DEFAULT '';
CREATE INDEX "published_content_project_id_publisher_slug_idx"
    ON "published_content"("project_id", "publisher", "slug");
```

`slug` is now stored in every `PublishedContent` row and is part of
`CreatePublishedContentInput`.

---

## Repository

`PublishedContentRepository.findDuplicate(projectId, publisher, slug)`

Queries the composite index `(project_id, publisher, slug)` and returns the
latest matching row, or `null` when no record exists.

```typescript
findDuplicate(projectId, publisher, slug): Promise<PublishedContent | null>
```

---

## Worker flow

Before `PublishingOrchestrator` runs, `processPublishingJob` calls
`findDuplicate`. If a match is found:

- The `Publisher` is **never called**.
- No `PublishedContent` row is created.
- The function returns immediately with:

```typescript
{ success: false, skipped: true, reason: 'duplicate' }
```

The BullMQ job completes successfully because a duplicate is an expected
condition, not an error. No retry is triggered.

When no duplicate is found, the flow continues exactly as before.

```
BullMQ job received
        │
        ▼
findDuplicate(projectId, publisher, slug)
        │
  ┌─────┴──────┐
found           not found
  │                │
  ▼                ▼
return           PublishingOrchestrator.publish()
{ skipped }            │
                       ▼
               persistPublishedContent()
```

---

## PublishingFlowResult extension

Added two optional fields to `PublishingFlowResult` in `@pcme/publishing`:

| Field     | Type      | Meaning                                         |
|-----------|-----------|-------------------------------------------------|
| `skipped` | `boolean` | `true` when the job was intentionally bypassed  |
| `reason`  | `string`  | Machine-readable skip reason (`"duplicate"`)    |

These fields are absent for normal success/failure flows.

---

## MockPublisher

`MockPublisher` produces deterministic, slug-based IDs.  
Because the duplicate check runs before the publisher is invoked,
`MockPublisher` is **never called** when a duplicate is detected.
This is verified in the processor tests.

---

## Verification

```bash
pnpm --filter @pcme/database test   # 76 tests
pnpm --filter @pcme/publishing test # 37 tests
pnpm --filter @pcme/worker test     # 99 tests
pnpm build                          # 26 tasks
pnpm duplicate:smoke                # 7 checks
```

---

## Future: hash-based duplicate detection

The current check matches on `(projectId, publisher, slug)`. This prevents
re-publishing the same slug to the same publisher, but it does not detect:

- The same content published under a different slug.
- Content that was edited and re-slugged.

A future sprint can add a `contentHash` column (SHA-256 of title + body)
and check `findByContentHash(projectId, publisher, hash)` in the same
pre-publish gate.

---

## Future: semantic duplicate detection

For near-duplicate content (paraphrased articles, translated variants),
a semantic similarity check using embeddings would be required. This is a
larger undertaking involving a vector store and is explicitly out of scope
for this sprint.

---

## Recommended commit message

```
feat(worker): add duplicate detection before publishing (Sprint 23)

- Add slug column to published_content (migration 20260705130000)
- Add PublishedContentRepository.findDuplicate(projectId, publisher, slug)
- Gate PublishingOrchestrator behind duplicate check in processPublishingJob
- Extend PublishingFlowResult with skipped/reason fields
- Publisher is never called when a duplicate is detected
- No history row is created for skipped duplicates
- Add duplicate:smoke (in-process, no Redis required)
```
