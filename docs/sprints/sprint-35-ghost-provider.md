# Sprint 35 — Ghost Publisher

## Objective

Implement the first non-WordPress publishing provider using the Publisher SDK
from Sprint 34. Validates that the provider framework supports multiple
destinations without SDK or pipeline changes.

---

## Package

```
plugins/ghost/
├── src/
│   ├── auth.ts           — Ghost Admin API JWT (HS256, kid header)
│   ├── config.ts         — GHOST_URL, GHOST_ADMIN_API_KEY validation
│   ├── errors.ts         — GhostApiError, retry classification
│   ├── validator.ts      — HTML post + image upload validation
│   ├── ghost.publisher.ts — GhostPublisher (PublisherProvider)
│   ├── registration.ts   — ghostRegistration for PublisherRegistry
│   └── index.ts
```

Package name: `@pcme/plugin-ghost`

---

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `GHOST_URL` | Yes | — | Ghost site URL (`https://blog.example.com`) |
| `GHOST_ADMIN_API_KEY` | Yes | — | Admin API key from Integrations (`{id}:{hex-secret}`) |
| `GHOST_REQUEST_TIMEOUT_MS` | No | `30000` | Per-request timeout |

Create an Admin API key:
Ghost Admin → Settings → Integrations → Add custom integration → copy API key.

---

## Ghost Architecture

### Authentication

Ghost Admin API uses short-lived JWTs signed with the hex secret from the API key:

```
Authorization: Ghost {jwt}
```

JWT payload: `{ iat, exp (+5min), aud: "/admin/" }`  
JWT header includes `kid` matching the key id.

### Endpoints

| Operation | Method | Path |
|---|---|---|
| Health / site info | GET | `/ghost/api/admin/site/` |
| Image upload | POST | `/ghost/api/admin/images/upload/` |
| Draft post (HTML) | POST | `/ghost/api/admin/posts/?source=html` |

### Publishing flow

**`publishPost(request)`**
1. Validate title, slug (URL-safe), HTML body
2. Build payload: `{ title, slug, html, status: "draft", tags, feature_image }`
3. Tags mapped to `[{ name: "tag" }]`
4. Feature image via `featuredAssetId` when it is an absolute URL
5. Return `PublishingResult` with `externalId`, `permalink`, `postStatus`

**`publishMedia(request)`**
1. Validate image MIME (jpeg/png/gif/webp) and size (≤ 10 MB)
2. Upload via multipart `FormData`
3. Return image URL as `externalId` and `permalink`

**`publish(request)`** — routes to media or post based on `mediaBuffer` presence.

---

## Provider Metadata

```typescript
id: 'ghost'
name: 'Ghost'
capabilities: {
  mediaUpload: true,
  postCreation: true,
  drafts: true,
  tags: true,
  categories: false,      // Ghost uses tags, not hierarchical categories
  featuredImages: true,
  scheduling: false,
  update: false,
  delete: false,
}
```

### Registry usage

```typescript
import { PublisherRegistry } from '@pcme/publisher-sdk';
import { ghostRegistration } from '@pcme/plugin-ghost';

const registry = new PublisherRegistry();
registry.register(ghostRegistration);

const provider = registry.create('ghost', loadGhostConfig());
await provider.publishPost(request);
```

---

## Differences vs WordPress

| Aspect | WordPress | Ghost |
|---|---|---|
| Auth | Basic (username + app password) | JWT from Admin API key |
| Post content field | `content` (HTML) | `html` (with `?source=html`) |
| Media upload | Raw bytes + Content-Type | Multipart FormData |
| Feature image | `featured_media` (numeric WP id) | `feature_image` (absolute URL) |
| Tags | String array or numeric ids | `[{ name: "tag" }]` objects |
| Categories | Hierarchical (numeric ids) | Not supported (tags only) |
| Health endpoint | `/wp/v2/users/me` | `/ghost/api/admin/site/` |
| Post ID type | Numeric | String (Ghost post id) |

Both providers implement `PublisherProvider` and return compatible `PublishingResult` objects.

---

## Error Handling

`GhostApiError` carries `status`, `code`, `category`, compatible with SDK `isRetryableError()` duck-typing.

| Category | Retry? | Example |
|---|---|---|
| `auth` | No | Invalid API key (401) |
| `rate_limit` | Yes | 429 |
| `server_error` | Yes | 5xx |
| `validation` | No | Bad payload (400) |
| `network` | Yes | fetch failure, timeout |

Structured log events: `ghost.health.*`, `ghost.image.upload.*`, `ghost.post.create.*`

---

## Future Provider Compatibility

Ghost validates the Sprint 34 registry pattern:

1. New plugin package under `plugins/<name>/`
2. Implement `PublisherProvider`
3. Export `<name>Registration: ProviderRegistration<TConfig>`
4. Register at startup — no SDK changes required

Next providers (Medium, Dev.to, Hashnode, LinkedIn) follow the same template.

The worker still uses `PUBLISHER_DRIVER` for WordPress/Mock — Ghost is available via registry for future driver wiring.

---

## Testing

| File | Tests |
|---|---|
| `auth.test.ts` | JWT generation, key parsing |
| `config.test.ts` | Env loading, URL/key validation |
| `errors.test.ts` | HTTP mapping, retry classification |
| `ghost.publisher.test.ts` | Health, media, post, routing, logging |
| `ghost-provider.test.ts` | SDK compatibility, registry integration |

---

## Smoke

```
pnpm ghost:smoke
```

9 offline sections: config, JWT auth, errors, health, media upload, HTML draft post, provider introspection, registry, 401 error path.

---

## Verification

```
pnpm test
pnpm build
pnpm ghost:smoke
```
