# Sprint 14 — WordPress Media Upload Foundation

## Goal

Implement the first real publishing provider: upload binary media files to a WordPress site via the WordPress REST API. This sprint delivers `WordPressMediaPublisher` inside the `@pcme/plugin-wordpress` package.

No posts are created in this sprint. WordPress post creation is deferred to Sprint 15.

---

## What Was Built

### Package: `@pcme/plugin-wordpress` (formerly empty scaffold)

#### `WordPressMediaPublisher`

Implements the `Publisher` interface from `@pcme/publishing`.

| Method | Status | Notes |
|---|---|---|
| `health()` | ✅ Implemented | `GET /wp-json/wp/v2/users/me` |
| `publishMedia()` | ✅ Implemented | `POST /wp-json/wp/v2/media` |
| `publishPost()` | ⏸ Deferred | Throws "not implemented" — Sprint 15 |
| `publish()` | ✅ Implemented | Delegates to `publishMedia` when `mediaBuffer` is present |

#### HTTP client design

`WordPressMediaPublisher` accepts a `FetchFunction` parameter in its constructor:

```typescript
new WordPressMediaPublisher(config, fetchFn?)
```

- In production: `fetchFn` defaults to `globalThis.fetch` (Node.js 18+ native fetch)
- In tests: a mock function is injected — no global patching, no extra libraries

This is dependency injection at its simplest; it makes the publisher fully testable without `msw`, `nock`, or any HTTP interceptor library.

---

## Required Environment Variables

| Variable | Description | Example |
|---|---|---|
| `WORDPRESS_BASE_URL` | Full URL of the WordPress site | `https://piercingconnect.com` |
| `WORDPRESS_USERNAME` | WordPress username | `admin` |
| `WORDPRESS_APP_PASSWORD` | WordPress Application Password | `xxxx yyyy zzzz wwww` |

### Generating an Application Password

1. Log in to WordPress Admin.
2. Go to **Users → Your Profile**.
3. Scroll to **Application Passwords**.
4. Enter a name (e.g. "PC Media Engine") and click **Add New Application Password**.
5. Copy the generated password (shown only once; spaces are part of the password and are preserved in the `Authorization` header).
6. Set `WORDPRESS_APP_PASSWORD` to the copied value.

**Important:** Application Passwords are different from your WordPress login password. They are scoped and can be revoked independently. Never commit credentials to version control.

---

## Media Upload Endpoint

```
POST {WORDPRESS_BASE_URL}/wp-json/wp/v2/media
Authorization: Basic base64(username:appPassword)
Content-Type:  {mimeType}
Content-Disposition: attachment; filename="{filename}"

[binary body]
```

### Success response (201 Created)

```json
{
  "id": 42,
  "link": "https://site.com/?attachment_id=42",
  "source_url": "https://site.com/wp-content/uploads/2024/01/photo.jpg",
  "date": "2024-01-01T12:00:00"
}
```

### Mapped to `PublishingResult`

| `PublishingResult` field | WordPress field |
|---|---|
| `externalId` | `String(response.id)` |
| `url` | `source_url ?? link` |
| `publishedAt` | `new Date(response.date)` |
| `message` | `"Media uploaded to WordPress (id=…)"` |

---

## `PublishingRequest` Extension

Sprint 14 extends `PublishingRequest` in `@pcme/publishing` with three optional fields for binary-upload publishers:

```typescript
type PublishingRequest = {
  // ... existing fields ...
  mediaBuffer?:   Buffer;   // binary file content
  mediaMimeType?: string;   // defaults to application/octet-stream
  mediaFilename?: string;   // defaults to request.slug
};
```

These fields are ignored by `MockPublisher` (they were not added to its logic). `WordPressMediaPublisher.publishMedia()` requires a non-empty `mediaBuffer` and throws `PublishingValidationError` if it is absent.

---

## Configuration Loading

```typescript
import { loadWordPressConfig } from '@pcme/plugin-wordpress';

const config = loadWordPressConfig(process.env);
// throws WordPressConfigError if any variable is missing
```

`loadWordPressConfig` reads the three env vars, validates them, and strips trailing slashes from `baseUrl`. A `WordPressConfigError` is thrown listing the specific missing variables.

---

## Error Types

| Error | When |
|---|---|
| `WordPressConfigError` | `loadWordPressConfig()` finds missing env vars |
| `PublishingValidationError` | `publishMedia()` called with empty config or missing `mediaBuffer`/`title`/`slug` |
| `WordPressApiError` | WordPress REST API returns a non-2xx response (carries `.status` and `.code`) |

---

## File Inventory

| File | Purpose |
|---|---|
| `plugins/wordpress/src/config.ts` | `WordPressConfig` type, `loadWordPressConfig`, `WordPressConfigError`, `isConfigComplete` |
| `plugins/wordpress/src/errors.ts` | `WordPressApiError` |
| `plugins/wordpress/src/auth.ts` | `buildBasicAuth` — Base64 credential encoding |
| `plugins/wordpress/src/wordpress-media.publisher.ts` | `WordPressMediaPublisher` |
| `plugins/wordpress/src/index.ts` | Package public exports |
| `plugins/wordpress/src/__tests__/wordpress-media.publisher.test.ts` | 32 unit tests |
| `plugins/wordpress/src/scripts/wordpress-smoke.ts` | Smoke script (fake HTTP) |
| `plugins/wordpress/package.json` | Added `@pcme/publishing` dependency, vitest, tsx |
| `packages/publishing/src/publisher.ts` | Extended `PublishingRequest` with `mediaBuffer?`, `mediaMimeType?`, `mediaFilename?` |

---

## Tests

```
pnpm --filter @pcme/plugin-wordpress test
```

32 tests, 0 failures:

| Suite | Tests | What is mocked |
|---|---|---|
| `buildBasicAuth` | 2 | none (pure function) |
| `loadWordPressConfig` | 6 | none (reads provided env object) |
| `publishMedia` — success | 5 | `fetch` returns 201 with WP media body |
| auth header formation | 4 | `fetch` capture — inspect call arguments |
| validation / missing config | 5 | `fetch` is never called (throws before) |
| WordPress error responses | 3 | `fetch` returns 401, 403, 500 |
| network failure | 2 | `fetch` rejects with `TypeError` |
| `health()` | 4 | `fetch` returns 200, 401, rejects |

**Nothing contacts a real WordPress instance.** All HTTP is replaced by a `vi.fn()` mock passed to the constructor.

---

## Smoke

```
pnpm --filter @pcme/plugin-wordpress smoke
```

Uses a fully in-process fake HTTP server — no credentials, no network. The fake responds exactly as a real WordPress REST API would:

| Step | What is verified |
|---|---|
| 1 | `health()` returns `ok` with authenticated username |
| 2 | `health()` returns `down` when fake WP returns 401 |
| 3 | `health()` returns `down` when config fields are empty |
| 4 | `publishMedia()` returns correct `PublishingResult` from fake 201 response |
| 5 | `publishMedia()` throws `WordPressApiError` on fake 401 |
| 6 | `publishMedia()` throws `PublishingValidationError` when `mediaBuffer` is absent |
| 7 | (opt-in) Real WordPress health check — enabled with `WP_REAL_SMOKE=1` |

---

## Why Post Creation Is Deferred to Sprint 15

Creating a WordPress post after uploading media requires:

1. **Media upload first** (this sprint) to obtain an attachment ID.
2. **Post creation** (`POST /wp/v2/posts`) referencing the attachment ID as the featured image.
3. **Tag and category taxonomy resolution** — WP needs integer IDs, not slugs.
4. **State management** — draft vs. publish, post date control.
5. **Error rollback** — if post creation fails after media upload, orphan media must be handled.

Each of these is a distinct concern. Separating media upload (Sprint 14) from post creation (Sprint 15) keeps each sprint small, independently testable, and reversible.

Sprint 15 will add `publishPost()` to `WordPressMediaPublisher`, wire the media attachment ID from Step 1 into the post body, and handle taxonomy resolution.
