# Sprint 40 — Content Composer

## Objective

Provide a read-only, draft-first Content Composer that lets operators inspect,
prepare, and validate publishable content before it enters the publishing
pipeline. This is the final major product module before Beta RC.

No automatic publishing. No upload, queue, scheduler, or retry changes.

---

## Composer Workflow

The composer sits between the Asset Library (Sprint 39) and the publishing
pipeline (BullMQ worker):

```
Upload → Processing → Asset (ready)
                          ↓
                   Content Composer
                   (inspect + validate)
                          ↓
              [Future] Manual publish enqueue
                          ↓
                   Publishing pipeline
```

| Step | Action |
|---|---|
| 1. Select asset | Operator picks a `ready` asset from eligible list |
| 2. Preview | Deterministic title/slug/body + thumbnail preview |
| 3. Review SEO | `@pcme/seo` generates slug, title, excerpt, meta description |
| 4. Review AI | `@pcme/ai` optionally merges provider suggestions |
| 5. Check publishers | Capability matrix shows compatible providers |
| 6. Validate | `POST /composer/validate` checks readiness for a publisher |
| 7. [Future] Publish | Not in Sprint 40 — no enqueue or publish button |

All composer operations are read-only except the validation POST, which performs
no database mutations and does not enqueue jobs.

---

## Validation Pipeline

Validation aggregates checks from multiple layers:

```
Asset status (ready?)
    → SEO slug URL-safe?
    → Thumbnail present?
    → Publisher enabled?
    → Publisher capabilities (postCreation, mediaUpload, featuredImages)
    → Required env configuration present?
    → Duplicate slug in publishing history? (warning)
```

**Blockers** prevent `ready: true` (e.g. asset not ready, publisher disabled).

**Warnings** are informational (e.g. duplicate slug, missing tags for tag-capable publisher).

The same logic powers both:
- `GET /composer/assets/:id` → `readiness` + `validationWarnings`
- `POST /composer/validate` → full result for a specific publisher

---

## Publisher Compatibility

Compatibility is derived from Sprint 37 publisher registry capabilities:

| Capability | Composer check |
|---|---|
| `postCreation` | Required for publishing |
| `mediaUpload` / `featuredImages` | Media asset support |
| `tags` / `categories` | Warns when metadata empty |
| `enabled` | Env config complete for provider |

Each publisher in the detail view shows:
- Enabled/disabled status
- Compatible / gaps
- Specific gap messages (e.g. "Provider does not support post creation")

`POST /composer/validate` adds per-publisher `missingRequirements` from
`configurationRequirements` (e.g. `WORDPRESS_URL`).

---

## API Endpoints

Public read-only endpoints (no auth required when configured).

| Endpoint | Purpose |
|---|---|
| `GET /composer/assets` | List assets eligible for publishing (`status=ready`) |
| `GET /composer/assets/:id` | Full composer view for one asset |
| `POST /composer/validate` | Validate asset + publisher combination |

### `GET /composer/assets/:id` response

- Asset metadata (filename, MIME, dimensions, thumbnail)
- `seo` — generated `PublishMetadata` from `@pcme/seo`
- `ai` — provider name, applied flag, message from `@pcme/ai`
- `readiness` — ready flag, blockers, warnings
- `compatiblePublishers` — per-publisher compatibility matrix
- `publishingHistory` — existing `PublishedContent` records
- `preview` — title, slug, body draft

### `POST /composer/validate` body

```json
{
  "assetId": "asset-001",
  "publisherId": "wordpress",
  "projectId": "optional-override"
}
```

Returns `ready`, `messages`, `warnings`, `publisherCompatibility`, `missingRequirements`.

Returns `503` when composer service is not configured.

---

## Dashboard

| Route | Purpose |
|---|---|
| `GET /composer` | Composer page with asset selector |
| `GET /composer?assetId=…` | Selected asset detail |
| `POST /ops/composer/validate` | Proxy validation → redirect with result |

**UI sections:**
- Asset selector dropdown
- Thumbnail preview + draft title/slug/body
- SEO metadata panel
- AI metadata panel
- Publisher compatibility table
- Validation warnings
- Publishing history summary
- Readiness badge
- Validate button (no Publish button)

Navigation adds **Composer** tab.

---

## Future Publish Workflow

Sprint 40 intentionally stops at validation. A future sprint will add:

1. **Compose & confirm** — operator reviews validation result
2. **Enqueue** — `POST /composer/publish` creates BullMQ job (not Sprint 40)
3. **Track** — link to Sprint 38 jobs page for queue monitoring

The composer DTOs (`preview`, `seo`, `readiness`) are shaped to feed directly
into `buildEnrichedPublishingPayload()` without rework.

---

## Testing

| Layer | Coverage |
|---|---|
| API routes | List, detail, validate, 400/404/503 |
| Service | SEO/AI composition, readiness, compatibility, duplicates |
| Dashboard | Renderer, app routes, validation form |
| Smoke | `pnpm composer:smoke` (offline mocks) |

---

## Verification

```bash
pnpm test
pnpm build
pnpm composer:smoke
```

---

## Non-goals (confirmed)

- No upload/processing changes
- No BullMQ / scheduler / retry changes
- No automatic publishing
- No rich text editors or AI generation UI
- No database mutations
