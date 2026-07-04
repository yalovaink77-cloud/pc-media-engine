# Sprint 13 — Publishing Foundation

## Goal

Introduce the publishing abstraction layer for PC Media Engine. This sprint establishes the interfaces, domain types, and a `MockPublisher` that can be used for development and testing without contacting any external service.

No external publishing destinations are implemented in this sprint. WordPress REST API integration is deferred to Sprint 14.

---

## What Was Built

### Package: `@pcme/publishing`

The package already existed as a scaffold (empty export, no scripts, no tests). Sprint 13 fills it with a complete publishing abstraction layer.

### Publisher Interface

`src/publisher.ts` defines the platform-agnostic contract all publishers must satisfy:

```typescript
interface Publisher {
  publishMedia(request: PublishingRequest): Promise<PublishingResult>;
  publishPost(request: PublishingRequest): Promise<PublishingResult>;
  publish(request: PublishingRequest): Promise<PublishingResult>;
  health(): Promise<HealthResult>;
  readonly name: string;
}
```

**Design decisions:**

- Three dispatch methods (`publishMedia`, `publishPost`, `publish`) let callers express intent explicitly. `publish()` routes internally based on whether `assetId`-only or `body` is present.
- `health()` must never throw — degraded / unreachable destinations return `{ status: 'down' }` rather than propagating exceptions.
- The interface is intentionally channel-agnostic so the same `PublishingRequest` can target WordPress, Pinterest, or any future destination without caller changes.

### PublishingRequest

```typescript
type PublishingRequest = {
  assetId?: string;
  title: string;        // required — drives validation
  slug: string;         // required — drives permalink + deterministic IDs
  excerpt?: string;
  body?: string;
  tags?: string[];
  categories?: string[];
  featuredAssetId?: string;
};
```

`title` and `slug` are the only required fields. All others are optional so the same type serves media-only publishes and full editorial posts.

### PublishingResult

```typescript
type PublishingResult = {
  success: boolean;
  externalId: string;   // platform-assigned ID (e.g. WordPress post ID)
  url: string;          // canonical public URL on the destination
  publishedAt: Date;
  message?: string;
};
```

### HealthResult

```typescript
type HealthResult = {
  status: 'ok' | 'degraded' | 'down';
  message?: string;
};
```

### PublishingValidationError

A typed error class thrown when a `PublishingRequest` fails validation before being dispatched to the remote. Extends `Error` with `name = 'PublishingValidationError'`.

### MockPublisher

`src/mock.publisher.ts` — deterministic, in-process publisher for development and tests.

**Guarantees:**

| Property | Behaviour |
|---|---|
| Network | Zero network requests, ever |
| Determinism | Same `slug` always produces the same `externalId` and `url` |
| Namespacing | `publishMedia` → `/media/{id}`, `publishPost` → `/posts/{id}` |
| Validation | Missing/blank `title` or `slug` → `PublishingValidationError` |
| Health | Always returns `{ status: 'ok' }` |

**Deterministic ID algorithm:**

```
SHA-1(slug).hex.slice(0, 12)
```

This is stable across Node versions and requires no external dependency.

**Routing in `publish()`:**

```
assetId set AND body absent → publishMedia
otherwise                   → publishPost
```

**Custom base URL:**

```typescript
const pub = new MockPublisher({ baseUrl: 'https://staging.example.com' });
```

---

## File Inventory

| File | Purpose |
|---|---|
| `packages/publishing/src/publisher.ts` | `Publisher` interface, `PublishingRequest`, `PublishingResult`, `HealthResult`, `PublishingValidationError` |
| `packages/publishing/src/mock.publisher.ts` | `MockPublisher` implementation |
| `packages/publishing/src/index.ts` | Package public exports |
| `packages/publishing/src/__tests__/mock.publisher.test.ts` | 23 unit tests |
| `packages/publishing/src/scripts/publishing-smoke.ts` | End-to-end smoke script |
| `packages/publishing/package.json` | Added `vitest`, `tsx`, `test` + `smoke` scripts, `exports` field |

---

## Tests

```
pnpm --filter @pcme/publishing test
```

23 tests, 0 failures:

| Suite | Tests |
|---|---|
| Publisher interface contract | 1 |
| MockPublisher.publishMedia | 8 |
| MockPublisher.publishPost | 3 |
| MockPublisher.publish routing | 3 |
| MockPublisher validation | 6 |
| MockPublisher.health | 2 |

---

## Smoke

```
pnpm --filter @pcme/publishing smoke
```

Exercises the full chain without any database, Redis, or HTTP:

```
PublishingRequest → MockPublisher → PublishingResult → deterministic URL
```

Steps verified:

1. `health()` returns `status=ok`
2. `publishMedia` — success, deterministic `externalId`, correct URL, `publishedAt` is a Date
3. `publishPost` — success, `post-` prefixed ID, `/posts/` URL
4. `publish()` routing — `assetId`-only → media, body-present → post
5. Deterministic stability — same slug, same IDs; different slugs, different IDs
6. Validation — empty title and empty slug each throw `PublishingValidationError`

---

## Why WordPress Is Deferred

WordPress publishing requires:
- HTTP connectivity to a WordPress instance
- Application Password or JWT authentication
- A media upload endpoint (`POST /wp/v2/media`) before the post can reference a featured image
- Draft / publish state management

None of these fit a "foundation" sprint that must work offline and in CI without external services. Introducing WordPress here would couple the abstraction layer to a specific platform's quirks before the interface is stable.

By shipping the `Publisher` interface and `MockPublisher` first, Sprint 14 can implement `WordPressPublisher` as a clean drop-in replacement — the rest of the codebase never needs to change.

---

## Sprint 14 — WordPress Media Upload (Preview)

Sprint 14 will add `WordPressPublisher` in `packages/publishing` (or a dedicated `providers/wordpress` package):

1. `WordPressPublisher` implements the `Publisher` interface.
2. Constructor accepts `{ baseUrl, username, applicationPassword }`.
3. `publishMedia(request)`:
   - Reads the `Asset` file from storage.
   - `POST /wp/v2/media` with the binary payload.
   - Returns `PublishingResult` with the WordPress attachment ID and URL.
4. `publishPost(request)`:
   - `POST /wp/v2/posts` with title, slug, excerpt, body, featured media ID.
   - Returns `PublishingResult` with the post ID and link.
5. `health()`: `GET /wp/v2/users/me` — returns `ok` / `down` based on 200 vs error.
6. Unit tests: all HTTP mocked with `msw` or `nock`.
7. Integration smoke: optional, guarded by `WP_BASE_URL` env var.
