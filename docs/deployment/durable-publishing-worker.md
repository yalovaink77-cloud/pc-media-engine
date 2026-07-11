# Durable Publishing Worker

This document describes how the **durable handoff publishing worker** operates and how it differs from the default worker process.

## Default worker entry (`apps/worker`)

The main worker started by `apps/worker/src/index.ts` (container `worker` service, `pnpm --filter @pcme/worker start`) runs:

- **BullMQ processing queue** — media/thumbnail jobs
- **Legacy BullMQ publishing queue** — when `PCME_AUTO_ENQUEUE_PUBLISHING=true`

It does **not**:

- Poll the durable publishing outbox
- Run `createPublishingWorker().runOnce()` on a schedule
- Start a daemon, cron job, or background loop for handoff publishing

Durable handoff publishing (outbox → `PublishingTargetAdapter`) is a **separate, explicit** execution path.

## Explicit run-once command

To process **at most one** pending durable outbox record:

```bash
pnpm publishing-worker:run-once
```

Implementation: `apps/worker/scripts/publishing-worker-run-once.ts`  
Bootstrap: `apps/worker/src/durable-publishing/bootstrap.ts`

### Required configuration

| Variable | Required |
| -------- | -------- |
| `DATABASE_URL` | Yes |
| `PCME_DEFAULT_ORG_ID` | Yes |
| `PCME_DEFAULT_PROJECT_ID` | Yes |

If any required variable is missing, the script exits **safely** with status `0` and a short message — it does not connect to the database or publish.

### Optional configuration

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `PCME_DURABLE_PUBLISHING_WORKER_ID` | `pcme-durable-publishing-worker` | Worker identity for outbox claims |
| `PCME_DURABLE_PUBLISHING_LEASE_MS` | `60000` | Claim lease duration |
| `PCME_DURABLE_PUBLISHING_MAX_ATTEMPTS` | `5` | Max publish attempts per outbox record |
| `PCME_DURABLE_PUBLISHING_REGISTER_WORDPRESS` | `false` | Must be `true` to register WordPress adapter |

See `deploy/env/.env.production.example` for placeholders.

## Publishing safety defaults

- **Fake adapter** is always registered first (`FakePublishingTargetAdapter`).
- **WordPress** is registered only when `PCME_DURABLE_PUBLISHING_REGISTER_WORDPRESS=true` **and** WordPress credentials are present (`hasWordPressHandoffCredentials`).
- When WordPress is registered, bootstrap passes **`forceDraft: true`** — posts are created as drafts only; public auto-publishing is not enabled.
- No polling or scheduler is included; operators or external automation must invoke `pnpm publishing-worker:run-once` deliberately.

## Relationship to the content pipeline dry run

`pnpm pipeline:dry-run` exercises the full offline pipeline including enqueue and a single in-memory worker cycle. It does not replace production durable execution against PostgreSQL.

For production durable outbox processing, configure the database variables above and run `pnpm publishing-worker:run-once` explicitly.

## Related modules

| Layer | Path |
| ----- | ---- |
| Outbox repositories | `packages/database/src/repositories/publishing-outbox.repository.ts` |
| Enqueue service | `packages/publishing/src/enqueue/publishing-enqueue.service.ts` |
| Generic worker | `packages/publishing/src/worker/publishing-worker.ts` |
| Worker config loader | `apps/worker/src/durable-publishing/config.ts` |
