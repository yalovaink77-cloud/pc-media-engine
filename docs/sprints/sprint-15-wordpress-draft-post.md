# Sprint 15 — WordPress Draft Post Creation

## Goal

Implement WordPress draft post creation via `WordPressMediaPublisher.publishPost()`. Posts are always created with `status = draft`. No publish, scheduling, or SEO in this sprint.

---

## Endpoint

```
POST {WORDPRESS_BASE_URL}/wp-json/wp/v2/posts
Authorization: Basic base64(username:appPassword)
Content-Type: application/json
```

### Request body (always draft)

```json
{
  "title": "Aftercare Guide",
  "slug": "aftercare-guide",
  "content": "<p>Body HTML</p>",
  "status": "draft",
  "excerpt": "Optional teaser",
  "categories": [12],
  "tags": ["aftercare", "industrial"],
  "featured_media": 1337
}
```

### Response mapping

| `PublishingResult` | WordPress field |
|---|---|
| `externalId` | `String(response.id)` |
| `url` | `response.link` |
| `publishedAt` | `new Date(response.date)` |
| `message` | `"Draft post created in WordPress (id=…, status=draft)"` |

---

## Required fields

| Field | Required | Notes |
|---|---|---|
| `title` | Yes | Non-empty string |
| `slug` | Yes | Non-empty string |
| `body` | Yes | Mapped to WordPress `content` |
| `excerpt` | No | Omitted when empty |
| `tags` | No | Sent as tag name strings |
| `categories` | No | Numeric category IDs only (parsed from string array) |
| `featuredMediaId` | No | WordPress attachment id from prior `publishMedia` |
| `featuredAssetId` | No | Used when numeric (e.g. `externalId` from media upload) |

---

## Featured media behavior

1. `featuredMediaId` takes precedence when set.
2. Otherwise, numeric `featuredAssetId` is parsed as `featured_media`.
3. When neither is provided, `featured_media` is omitted from the payload.

Typical flow:

```
publishMedia() → PublishingResult.externalId = "1337"
publishPost({ ..., featuredMediaId: 1337 }) → featured_media: 1337
```

---

## Draft-only behavior

`status` is hardcoded to `'draft'` in `buildPostPayload()`. The publisher never sends `publish`, `future`, or `pending` statuses.

---

## Interface extension

`PublishingRequest` in `@pcme/publishing` gained:

```typescript
featuredMediaId?: number;
```

---

## Tests

All HTTP is mocked via injected `fetchFn`. No real WordPress credentials.

```
pnpm --filter @pcme/plugin-wordpress test
```

Covers: draft creation, `status=draft`, auth header, validation (title/slug/body), `featured_media` mapping, WP error responses, network failure, response mapping.

---

## Smoke

```
pnpm --filter @pcme/plugin-wordpress smoke
```

Fake HTTP only. Verifies `publishPost()` draft creation, 401 error path, and missing-body validation.

---

## Deferred to later sprints

| Feature | Reason |
|---|---|
| Publish status (`publish`) | Separate editorial workflow sprint |
| Scheduling (`future` + `date`) | Requires date handling + worker |
| SEO generation | Separate SEO package sprint |
| Category slug resolution | Requires taxonomy lookup API calls |
| Background publishing worker | Orchestration sprint |
