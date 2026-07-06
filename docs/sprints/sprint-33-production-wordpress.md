# Sprint 33 — Production WordPress Publishing

## Objective

Promote the WordPress publishing driver from a functional prototype to a
production-ready provider. The sprint adds configuration validation, request
timeout, structured logging, media/post field validation, enriched error
classification, and an extended `PublishingResult` — all without breaking
existing API contracts.

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `WORDPRESS_URL` | Yes* | — | WordPress site URL (`https://example.com`) |
| `WORDPRESS_BASE_URL` | Legacy | — | Accepted if `WORDPRESS_URL` absent |
| `WORDPRESS_USERNAME` | Yes | — | WordPress username |
| `WORDPRESS_APP_PASSWORD` | Yes | — | WordPress Application Password |
| `WORDPRESS_REQUEST_TIMEOUT_MS` | No | `30000` | Per-request timeout in milliseconds |

`WORDPRESS_URL` takes precedence over `WORDPRESS_BASE_URL` when both are set.
Trailing slashes are stripped automatically.

### URL Validation

`loadWordPressConfig()` validates that the URL has a valid `http://` or
`https://` scheme. An invalid URL fails fast at startup with a descriptive
`WordPressConfigError` message.

### Production Validation

`validateWordPressConfigStrict(config)` returns `{ errors, warnings }`:

- **Errors** (break publishing): missing fields, invalid URL format.
- **Warnings** (runtime risk): HTTP instead of HTTPS, very short passwords,
  very low request timeout.

Call this at worker startup when `PUBLISHER_DRIVER=wordpress` to surface
configuration problems before the first job is processed.

---

## Publishing Lifecycle

### `publishMedia(request)`

1. `assertConfigComplete()` — fails fast if any required field is empty.
2. `validateMediaRequest(request)` — checks title, slug, non-empty buffer,
   MIME type against the allowlist, and buffer size ≤ 50 MB.
3. Log `wp.media.upload.start` with slug, MIME, filename, size.
4. `POST /wp-json/wp/v2/media` with `AbortSignal.timeout(requestTimeoutMs)`.
5. On network error: log `wp.media.upload.network_error` + re-throw.
6. On non-2xx: `parseWordPressErrorResponse()` → log `wp.media.upload.api_error` + throw `WordPressApiError`.
7. On success: log `wp.media.upload.success`.
8. Return `PublishingResult` with `wpMediaId`, `permalink`.

### `publishPost(request)`

1. `assertConfigComplete()`.
2. `validatePostRequest(request)` — checks title, slug (URL-safe pattern), body.
3. Log `wp.post.create.start`.
4. `POST /wp-json/wp/v2/posts` (status always `draft`) with timeout.
5. Error handling as above → `wp.post.create.api_error`.
6. On success: log `wp.post.create.success`.
7. Return `PublishingResult` with `wpPostId`, `postStatus`, `permalink`.

### `health()`

1. Returns `{ status: 'down' }` immediately if config is incomplete.
2. Log `wp.health.check`.
3. `GET /wp-json/wp/v2/users/me` with timeout.
4. `status: 'ok'` on 200, `status: 'down'` on HTTP error or network failure.

---

## Failure Handling

### Error Categories

`WordPressApiError` now carries a `category: WordPressErrorCategory` field.

| Category | HTTP Status | Description |
|---|---|---|
| `auth` | 401, 403 | Bad credentials; do NOT retry |
| `not_found` | 404 | Resource gone; do NOT retry |
| `rate_limit` | 429 | Server throttling; retry with backoff |
| `validation` | 400, 422 | Bad request payload; do NOT retry |
| `server_error` | 5xx | Transient server fault; retry |
| `network` | — | Connectivity / DNS failure; retry |
| `unknown` | other | Conservative — do NOT retry |

WP-specific error codes (e.g. `rest_not_logged_in`) override the HTTP status
categorisation for more accurate classification.

### Retry Safety

`isRetryableError(err)` returns `true` for `rate_limit`, `server_error`, and
`network` categories, and for `TypeError` and `AbortError` (timeout).  The
existing BullMQ retry engine calls this to decide whether to schedule a
retry or mark the job as permanently failed.

### Request Timeout

Every fetch call wraps the request in `AbortSignal.timeout(requestTimeoutMs)`.
A timed-out request throws an `AbortError` — classified as retryable.

---

## Enhanced Publishing Result

`PublishingResult` now carries optional platform-specific fields:

```typescript
type PublishingResult = {
  // existing fields unchanged ...

  /** WordPress media attachment ID (set by publishMedia). */
  wpMediaId?: number;
  /** WordPress post ID (set by publishPost). */
  wpPostId?: number;
  /** Final permalink URL. */
  permalink?: string;
  /** WordPress post status, e.g. "draft". */
  postStatus?: string;
};
```

These fields are optional — existing code that ignores them is unaffected.

---

## Structured Logging

Inject a `WordPressPublisherLogger` at construction time:

```typescript
import { createConsoleLogger, WordPressMediaPublisher } from '@pcme/plugin-wordpress';

const publisher = new WordPressMediaPublisher(config, fetch, {
  logger: createConsoleLogger('[wp]'),
});
```

Available implementations:

| Export | Description |
|---|---|
| `noopLogger` | Silent (default when no logger is injected) |
| `createConsoleLogger(prefix?)` | Logs to stdout/stderr — useful for dev/scripts |

For production, pass a pino/winston logger shaped to the `WordPressPublisherLogger` interface.

Log events emitted:

| Event | Level | Trigger |
|---|---|---|
| `wp.health.check` | info | `health()` called |
| `wp.health.ok` | info | health check passed |
| `wp.health.degraded` | warn | health check returned non-200 |
| `wp.health.error` | error | health check threw |
| `wp.media.upload.start` | info | `publishMedia()` begins HTTP call |
| `wp.media.upload.success` | info | media uploaded |
| `wp.media.upload.api_error` | error | WP returned non-2xx |
| `wp.media.upload.network_error` | error | fetch threw |
| `wp.post.create.start` | info | `publishPost()` begins HTTP call |
| `wp.post.create.success` | info | post created |
| `wp.post.create.api_error` | error | WP returned non-2xx |
| `wp.post.create.network_error` | error | fetch threw |

---

## Media Validation

`validateMediaRequest()` enforces:

- `title` — non-empty
- `slug` — non-empty
- `mediaBuffer` — non-empty, ≤ 50 MB (configurable via `maxSizeBytes`)
- `mediaMimeType` — must be in `ALLOWED_MEDIA_MIME_TYPES`:
  `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/avif`,
  `video/mp4`, `video/webm`, `application/pdf`, `application/octet-stream`

Pass `{ allowedMimeTypes, maxSizeBytes }` options to override defaults.

## Post Validation

`validatePostRequest()` enforces:

- `title` — non-empty
- `slug` — URL-safe: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`
- `body` — non-empty

---

## Testing

| File | Tests |
|---|---|
| `plugins/wordpress/src/__tests__/config.test.ts` | 25 — URL validation, WORDPRESS_URL alias, timeoutMs, strict validation |
| `plugins/wordpress/src/__tests__/errors.test.ts` | 30 — categorization, parsing, isRetryable |
| `plugins/wordpress/src/__tests__/validator.test.ts` | 24 — MIME allowlist, size, slug pattern |
| `plugins/wordpress/src/__tests__/wordpress-media.publisher.test.ts` | 61 — full publisher (includes Sprint 33 additions) |

Total: **140 tests** in the WordPress plugin.

---

## Smoke

```
pnpm wordpress:smoke
```

Runs 16 offline sections (no real WordPress needed):

1. `WORDPRESS_URL` env var alias
2. `requestTimeoutMs` from env
3. URL format validation
4. `validateWordPressConfigStrict`
5. Error categorization
6. `isRetryableError`
7. Media validator — MIME allowlist
8. Media validator — size limit
9. Post validator — URL-safe slug
10. `publishMedia` — enhanced result fields
11. `publishPost` — enhanced result fields
12. Logger injection — info events emitted
13. Error category on rate limit (429)
14. Error category on server error (500)
15. `createConsoleLogger` does not throw
16. `health()` logs check event

---

## Future: Multi-Publisher Compatibility

The changes in this sprint are confined to `@pcme/plugin-wordpress` and do
not affect the `Publisher` interface contract.

Future publisher implementations (e.g. Webflow, Ghost, Medium) can:

- Adopt the same `WordPressPublisherLogger` interface or define their own.
- Use the existing `PublishingResult` extended fields as a pattern for
  platform-specific metadata (add new optional fields as needed).
- Implement their own `isRetryableError` using `WordPressErrorCategory` as
  a reference for how to classify HTTP errors.

The `PublishingResult` extensibility model (optional extra fields) keeps
downstream consumers (worker, API, dashboard) decoupled from
platform-specific details while still making richer data available.
