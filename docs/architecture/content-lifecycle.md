# Content Lifecycle

## States

```
idea → researching → drafted → reviewing → approved → published
                                                      ↓
                                              refresh_needed → (researching | drafted)
                                                      ↓
                                                  archived
```

| State            | Description                  | Exit criteria                                |
| ---------------- | ---------------------------- | -------------------------------------------- |
| `idea`           | Raw topic or brief           | Promoted to research or archived             |
| `researching`    | Sources, outline, keywords   | Outline and focus keyword set                |
| `drafted`        | Full draft exists            | Ready for review                             |
| `reviewing`      | Editorial QA, SEO check      | Approved or back to drafted                  |
| `approved`       | Cleared for publish          | Publish job succeeds                         |
| `published`      | Live on at least one channel | Stale rules or manual flag                   |
| `refresh_needed` | Outdated or underperforming  | Refresh workflow complete                    |
| `archived`       | Retired                      | Terminal (may unarchive to `refresh_needed`) |

## Valid Transitions

| From             | Allowed to                                        |
| ---------------- | ------------------------------------------------- |
| `idea`           | `researching`, `archived`                         |
| `researching`    | `drafted`, `idea`, `archived`                     |
| `drafted`        | `reviewing`, `researching`, `archived`            |
| `reviewing`      | `approved`, `drafted`, `archived`                 |
| `approved`       | `published`, `reviewing`, `archived`              |
| `published`      | `refresh_needed`, `archived`                      |
| `refresh_needed` | `researching`, `drafted`, `published`, `archived` |
| `archived`       | `refresh_needed`, `idea`                          |

Invalid transitions throw `InvalidTransitionError` and are recorded in the audit log.

## State Machine Rules

1. Only forward transitions unless explicitly rolling back.
2. `published` requires at least one successful `PublishRecord`.
3. `approved` → `published` is performed by the worker after remote publish succeeds.
4. `archived` suppresses publish and refresh recommendations.

## Concurrency Control

Every `ContentItem` carries a monotonically increasing **`revision`** integer (starts at 1, increments on every successful write).

### Optimistic Locking

All lifecycle transitions and content updates MUST include the expected `revision`. Mismatch → `ConflictError`; caller must refresh and retry.

### Publish Guard

- Only one in-flight outbox entry per `(contentId, channel, contentVersionId)`.
- Worker re-checks `revision` and `state === approved` before invoking Publisher.
- Revision changed during job → abort without state transition.

### Collision Scenarios

| Scenario                       | Behavior                                                 |
| ------------------------------ | -------------------------------------------------------- |
| User edits while AI draft runs | First commit wins; loser gets `ConflictError`            |
| Two publish requests           | Second rejected if outbox already `pending`/`processing` |
| Refresh job vs manual edit     | Revision check prevents stale overwrite                  |

## Versioning

- Transitions to `drafted` or later create immutable `ContentVersion` snapshots.
- SEO profile versioned alongside content body.
- Publish always references a specific `contentVersionId`.

## Content Types

| Type                | Format                      |
| ------------------- | --------------------------- |
| `guide`             | Long-form markdown + blocks |
| `faq`               | FAQ blocks + schema         |
| `aftercare-card`    | Short printable             |
| `printable`         | PDF-oriented                |
| `affiliate-section` | Product block embed         |
| `bmc-block`         | Buy Me a Coffee embed       |
| `social-post`       | Future                      |
| `newsletter`        | Future                      |
| `video-script`      | Future                      |

## AI Touchpoints by State

| State            | AI tasks                           |
| ---------------- | ---------------------------------- |
| `idea`           | Topic expansion                    |
| `researching`    | Outline, keyword suggestions       |
| `drafted`        | Rewrite, expand, tone adjust       |
| `reviewing`      | SEO optimize, readability          |
| `refresh_needed` | Refresh suggest, diff preview      |
| `published`      | Social repurpose (no state change) |

## Domain Events

| Event                       | Subscribers          |
| --------------------------- | -------------------- |
| `content.state_changed`     | audit log, analytics |
| `content.version_created`   | —                    |
| `content.revision_conflict` | audit log            |
| `content.published`         | analytics            |
