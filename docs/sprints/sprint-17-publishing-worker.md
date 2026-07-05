# Sprint 17 — Publishing Worker Foundation

## Goal

Introduce a BullMQ publishing queue and worker that executes `PublishingOrchestrator` using `MockPublisher` only. No real WordPress calls.

---

## Queue

| Property | Value |
|---|---|
| Name | `publishing` |
| Constant | `PUBLISHING_QUEUE` |

---

## Payload shape

```typescript
type PublishingJobPayload = {
  title: string;           // required
  slug: string;            // required
  body: string;            // required
  mediaMimeType?: string;
  mediaFilename?: string;
  mediaBuffer?: string;    // base64-encoded binary
  mediaData?: string;      // plain mock content (smoke/tests)
};
```

Exactly one of `mediaBuffer` or `mediaData` must be present.

---

## Worker flow

```
BullMQ job (publishing queue)
       ↓
validatePublishingJobPayload()
       ↓
processPublishingJob()
       ↓
PublishingOrchestrator + MockPublisher
       ↓
PublishingFlowResult (returned as job result + logged)
```

---

## MockPublisher-only behaviour

Sprint 17 hardcodes `MockPublisher` in `processPublishingJob()`. This guarantees:

- Zero external network calls
- Deterministic smoke/test results
- No WordPress credentials required

Results are logged and returned as the BullMQ job return value.

---

## Why real WordPress is deferred

Connecting `WordPressMediaPublisher` requires:

- Valid `WORDPRESS_*` credentials in the runtime environment
- Network access to a live WordPress instance
- Error handling for auth, quota, and taxonomy edge cases

The worker infrastructure must be proven with `MockPublisher` first so Sprint 18 can swap the provider via configuration without changing queue or orchestration logic.

---

## Sprint 18 preview

Sprint 18 will:

1. Add provider selection via env (`PUBLISHING_PROVIDER=mock|wordpress`)
2. Inject `WordPressMediaPublisher` when configured
3. Load asset binary from storage instead of inline `mediaData`
4. Keep the same queue payload validation and orchestrator flow

---

## Verification

```bash
pnpm --filter @pcme/worker test
pnpm --filter @pcme/worker publishing:smoke
pnpm build
```
