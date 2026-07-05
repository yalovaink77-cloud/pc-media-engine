# Sprint 16 — Publishing Orchestrator

## Goal

Introduce a platform-independent `PublishingOrchestrator` that coordinates the complete publishing flow using the existing `Publisher` interface. No new provider capabilities are added.

---

## Orchestration flow

```
PublishingRequest
       ↓
PublishingOrchestrator.publish()
       ↓
Publisher.publishMedia()   ← media upload
       ↓ (on success)
Publisher.publishPost()    ← draft creation (receives media id)
       ↓
PublishingFlowResult       ← combined outcome
```

The orchestrator depends only on `Publisher`. It has no knowledge of WordPress, HTTP, or any destination-specific details.

---

## PublishingFlowResult

```typescript
type PublishingFlowResult = {
  success: boolean;
  media?: { externalId: string; url: string };
  post?:  { externalId: string; url: string };
  publishedAt?: Date;
  message?: string;
};
```

---

## Failure behaviour

| Scenario | Behaviour |
|---|---|
| Media upload throws or returns `success=false` | Stop immediately. No draft created. Return `success=false` with error message. |
| Draft creation throws or returns `success=false` | Return media result. Return empty/failed post. Error message is not hidden. |

---

## Why orchestration is separated from providers

Providers (`WordPressMediaPublisher`, future `MockPublisher`, etc.) implement single destination operations. The orchestrator encodes the **business workflow** — the ordered sequence of media-then-post — without coupling that workflow to any one platform.

This allows:

- Swapping providers without changing orchestration logic
- Testing the workflow with `MockPublisher` (no HTTP)
- Adding background workers in Sprint 17 that call the same orchestrator

---

## Required request fields

The orchestrator requires a full publish request:

| Field | Required |
|---|---|
| `title` | Yes |
| `slug` | Yes |
| `body` | Yes |
| `mediaBuffer` | Yes |

Optional fields (`excerpt`, `tags`, `categories`) are forwarded to `publishPost`.

After media upload, the orchestrator passes `featuredAssetId` (and numeric `featuredMediaId` when applicable) to `publishPost`.

---

## Deferred

| Feature | Sprint |
|---|---|
| Scheduling | Future |
| Publish status (`publish`) | Future |
| SEO generation | Future |
| Background publishing worker | Sprint 17 |
| Retry logic | Sprint 17+ |

---

## Sprint 17 preview

Sprint 17 will introduce background publishing via the existing queue/worker infrastructure. A worker will load an asset, build a `PublishingRequest`, and call `PublishingOrchestrator.publish()` — reusing this sprint's orchestration without changes.

---

## Verification

```bash
pnpm --filter @pcme/publishing test
pnpm --filter @pcme/publishing smoke
pnpm build
```
