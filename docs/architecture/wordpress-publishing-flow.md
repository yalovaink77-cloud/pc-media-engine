# WordPress Publishing Flow

## Scope

WordPress is the first publishing channel via `plugins/wordpress`. Supports: create draft, publish, update existing post, sync featured image.

## Prerequisites (per project)

| Config key                    | Description                        |
| ----------------------------- | ---------------------------------- |
| `wordpress.siteUrl`           | e.g. `https://piercingconnect.com` |
| `wordpress.username`          | Application password user          |
| `wordpress.appPassword`       | WP application password            |
| `wordpress.defaultCategoryId` | Optional                           |
| `wordpress.seoPlugin`         | `yoast` or `rankmath`              |

Stored encrypted in project secrets; never in content body.

## Separation: Renderer vs Publisher

| Component     | Role                                                               |
| ------------- | ------------------------------------------------------------------ |
| **Renderer**  | Content + SEO + media URLs → `RenderedOutput` (HTML, meta, schema) |
| **Publisher** | `RenderedOutput` → WordPress REST API                              |

Renderer has no side effects. Publisher has no lifecycle logic.

## Outbox-Driven Flow

Publishing MUST NOT occur inside API handlers or domain services synchronously.

```
Dashboard → API: POST /content/:id/publish
  1. Validate state = approved, revision matches
  2. Create PublishingOutboxEntry (idempotencyKey)
  3. Audit: publish_attempted
  4. Return 202 Accepted + outboxEntryId

Worker: consume outbox entry
  1. Mark status = processing
  2. Re-validate content state + revision
  3. MediaUrlResolver → signed URLs for assets
  4. Renderer → RenderedOutput
  5. Publisher → plugins/wordpress.publish() | .update()
  6. Record provider response on outbox entry
  7. On success: PublishRecord, transition → published, audit: publish_succeeded
  8. On failure: outbox failed, state unchanged (approved), audit: publish_failed
```

## PublishingOutboxEntry (summary)

| Field              | Purpose                                                           |
| ------------------ | ----------------------------------------------------------------- |
| `idempotencyKey`   | `{projectId}:{contentId}:{contentVersionId}:{channel}:{action}`   |
| `status`           | `pending` → `processing` → `succeeded` \| `failed` \| `cancelled` |
| `attemptCount`     | Retry tracking                                                    |
| `providerResponse` | WP response body on success                                       |
| `errorLog`         | Last error message                                                |
| `externalId`       | WP post ID after first success                                    |

Duplicate enqueue with same key returns existing entry — no duplicate WP posts.

## Render Pipeline

1. Markdown → HTML with block handlers:
    - `AffiliateBlock` → affiliate plugin HTML
    - `BmcBlock` → Buy Me a Coffee embed
    - `FaqBlock` → `<details>` or schema-only
2. SEO meta → Yoast/Rank Math custom fields (project config)
3. FAQ schema → JSON-LD in post meta or inline

## WordPress REST API

| Action       | Endpoint                         |
| ------------ | -------------------------------- |
| Create post  | `POST /wp-json/wp/v2/posts`      |
| Update post  | `POST /wp-json/wp/v2/posts/{id}` |
| Upload media | `POST /wp-json/wp/v2/media`      |

Auth: HTTP Basic with application password.

## Idempotency & Updates

- First publish: no `externalId` → CREATE
- Re-publish / refresh: existing `externalId` → UPDATE
- `PublishRecord` stores: contentVersionId, externalId, url, publishedAt, channel=`wordpress`

## Retry Policy

| Error             | Action                                   |
| ----------------- | ---------------------------------------- |
| 5xx / timeout     | Retry with backoff (1m, 5m, 15m, 1h, 4h) |
| 401 / 403         | Fail; alert operator                     |
| 400 validation    | Fail; log WP error body                  |
| Revision conflict | Cancel job                               |

## Dashboard UX (planned)

- "Save as WP Draft" → `status: draft`
- "Publish" → `status: publish`
- "Update live post" when `PublishRecord` exists
- Outbox status polling

## Deferred

- Gutenberg block output (raw HTML acceptable for MVP)
- Scheduled publish
- Multi-site per project
- Social plugins (same `PublishingChannel` pattern)
