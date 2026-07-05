# Sprint 25 — Publishing Scheduler Foundation

## Goal

Add scheduled publishing support using BullMQ delayed jobs.
No dashboard, calendar UI, cron UI, analytics, or new publisher providers.

---

## Delayed job model

BullMQ supports delayed jobs natively via a `delay` option on `queue.add()`.
When `delay > 0`, BullMQ holds the job in a sorted set keyed by scheduled
timestamp and moves it to the active queue only when the delay has elapsed.

No new Redis data structures are needed. No schema changes were required.

The `delay` value is computed from the payload's `scheduledFor` field at
enqueue time:

```
delay (ms) = max(0, Date.parse(scheduledFor) - Date.now())
```

If the result is zero the job is added without a delay option (immediate).

---

## `scheduledFor` behaviour

| Condition | Result |
|-----------|--------|
| `scheduledFor` absent | immediate enqueue (existing behaviour, unchanged) |
| `scheduledFor` in the past | immediate enqueue (delay clamped to 0) |
| `scheduledFor` now or within a few ms | immediate enqueue |
| `scheduledFor` in the future | delayed enqueue; job runs when wall-clock reaches that time |
| `scheduledFor` is an invalid date string | `PublishingPayloadValidationError` thrown before enqueueing |
| `scheduledFor` is empty or whitespace | treated as absent; no error |

Validation rejects any string that does not produce a valid `Date` (i.e.
`Date.parse()` returns `NaN`).

---

## Immediate fallback behaviour

When `scheduledFor` is absent, past, or exactly now:

```typescript
computeScheduleDelay(undefined)    // → 0
computeScheduleDelay('2020-01-01') // → 0  (past)
```

`createPublishingEnqueuer.enqueue()` passes no `delay` option to
`queue.add()`, so the job is treated as immediately runnable — identical to
pre-Sprint-25 behaviour.

---

## Processor transparency

`scheduledFor` is stored in the job payload for observability (visible in
BullMQ dashboard tools, logs). Once the delayed job starts executing, the
processor (`executePublishingJobWithRetry`) does not inspect `scheduledFor`
— it publishes normally.

```
[enqueuer] now + 30s → queue.add('publish', payload, { delay: 30000 })
                           ↓ 30 seconds later
[BullMQ worker] picks up job
                           ↓
[processor] runs: findDuplicate → orchestrate → persist
```

---

## Duplicate detection interaction

Duplicate detection runs at **processor execution time**, not at enqueue
time. This means:

- If article A is published immediately, and then a *scheduled* job for
  article A fires later, the scheduled job will be detected as a duplicate
  and skipped (`{ skipped: true, reason: "duplicate" }`).
- The delayed job completes successfully (no retry, no error).
- No additional `PublishedContent` row is written.

This is the correct production behaviour: the scheduler does not bypass
duplicate protection.

---

## Retry interaction

The retry engine (Sprint 24) is unchanged. If a delayed publishing job
fails when it eventually runs, BullMQ applies the same exponential backoff
policy as immediate jobs.

Duplicates still never retry, regardless of whether the original job was
immediate or delayed.

---

## Why dashboard and calendar UI are deferred

The scheduler foundation deliberately stops at the BullMQ layer.
A user-facing calendar UI, cron management, or scheduling dashboard
requires:

1. A persistence layer for "scheduled intents" (separate from BullMQ state).
2. An API surface for creating, editing, and cancelling scheduled jobs.
3. A UI component with date-picker and timezone support.

These are intentionally deferred to maintain sprint focus and avoid
introducing partially-complete features.

---

## New exported API

### `computeScheduleDelay(scheduledFor?: string): number`
(`apps/worker/src/queue/publishing-enqueue.ts`)

Pure function. Returns delay in ms (≥ 0). Returns 0 for absent or past input.
Callers must ensure the string has already been validated before passing it.

### `PublishingJobPayload.scheduledFor?: string`
Optional ISO 8601 datetime string. Read by `validatePublishingJobPayload`
(rejected if invalid) and by `createPublishingEnqueuer.enqueue`.

---

## Verification

```bash
pnpm --filter @pcme/worker test   # 134 tests
pnpm --filter @pcme/publishing test
pnpm build                        # 26/26 tasks
pnpm scheduler:smoke              # 5 scenarios, all offline
```

---

## Recommended commit message

```
feat(worker): add scheduled publishing via BullMQ delayed jobs (Sprint 25)

- Add scheduledFor (ISO 8601) to PublishingJobPayload with validation
- Export computeScheduleDelay(); clamps past/absent to 0
- createPublishingEnqueuer.enqueue() applies delay when scheduledFor is future
- Processor is transparent to scheduledFor; duplicate/retry unchanged
- Add scheduler.test.ts (21 tests) and scheduler:smoke (5 offline scenarios)
```
