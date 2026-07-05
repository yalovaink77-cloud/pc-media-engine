# Sprint 21 — End-to-End Automation Alpha

## Goal

Wire existing components into the first automated pipeline from upload to publish-ready draft. No new major features — only opt-in orchestration hooks and smoke coverage.

---

## Alpha pipeline

```
POST /media
  ↓ local storage + Asset + pending ProcessingJob
  ↓ (PCME_AUTO_ENQUEUE_PROCESSING=true) BullMQ `processing`
  ↓ worker thumbnail → ProcessingArtifact (webp)
  ↓ deterministic metadata (@pcme/seo) + optional AI (@pcme/ai)
  ↓ (PCME_AUTO_ENQUEUE_PUBLISHING=true) BullMQ `publishing`
  ↓ publishing worker → MockPublisher (default) → draft post result
```

---

## Offline defaults

| Variable | Default | Safe value |
|---|---|---|
| `AI_METADATA_PROVIDER` | `none` | `none` or `mock` |
| `PUBLISHER_DRIVER` | `mock` | `mock` |
| `PCME_AUTO_ENQUEUE_PROCESSING` | unset / false | opt-in `true` |
| `PCME_AUTO_ENQUEUE_PUBLISHING` | unset / false | opt-in `true` |

Without the auto-enqueue flags, behaviour matches earlier sprints: jobs are created but not executed automatically.

---

## Required env flags (automation alpha)

| Variable | Required for E2E | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres (Docker) |
| `REDIS_URL` | Yes | BullMQ queues |
| `STORAGE_LOCAL_ROOT` | Recommended | Defaults to tmp dir in smoke |
| `PCME_DEFAULT_ORG_ID` | Yes (API upload) | From `pnpm db:seed` |
| `PCME_DEFAULT_PROJECT_ID` | Yes (API upload) | From `pnpm db:seed` |
| `PCME_AUTO_ENQUEUE_PROCESSING` | Opt-in | API enqueues after upload |
| `PCME_AUTO_ENQUEUE_PUBLISHING` | Opt-in | Worker enqueues after thumbnail |

When `PCME_AUTO_ENQUEUE_PUBLISHING=true`, the worker process also starts the publishing worker in-process (alpha convenience).

---

## Smoke command

```bash
docker compose up -d
pnpm db:migrate && pnpm db:seed
pnpm e2e:smoke
```

Equivalent:

```bash
pnpm --filter @pcme/worker e2e:smoke
```

Smoke uses Docker Redis/Postgres, local storage, `AI_METADATA_PROVIDER=none`, and `PUBLISHER_DRIVER=mock`. No real WordPress or AI network calls.

---

## Why real WordPress / AI remain opt-in

- **Safety** — default paths must never hit production sites or paid LLM APIs.
- **Determinism** — unit tests and CI stay fast and credential-free.
- **Explicit ops** — real integrations use existing manual smokes (`publishing:smoke:wordpress`, OpenRouter provider smoke).

Set `PUBLISHER_DRIVER=wordpress` and WordPress env vars only when deliberately testing live publishing. Set `AI_METADATA_PROVIDER=openrouter` only with valid API keys.

---

## Sprint 22 recommendations

| Improvement | Rationale |
|---|---|
| Production orchestration | Replace alpha in-process worker pairing with dedicated deploy units |
| Persistent publish state | Store publishing results / external IDs on domain records |
| Retry / dead-letter policies | Harden queue failure handling across the chain |
| Config surface | Single documented `PCME_PIPELINE_MODE=offline|alpha|production` |
| Observability | Structured logs + correlation IDs across upload → publish |
| Dashboard / auth | Operator visibility and access control (explicitly deferred) |

---

## Verification

```bash
pnpm --filter @pcme/api test
pnpm --filter @pcme/worker test
pnpm --filter @pcme/seo test
pnpm --filter @pcme/ai test
pnpm --filter @pcme/publishing test
pnpm build
pnpm e2e:smoke
```
