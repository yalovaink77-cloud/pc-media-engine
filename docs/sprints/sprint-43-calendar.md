# Sprint 43 — Publishing Calendar & Timeline

## Objective

Expose scheduled publishing through a calendar and timeline interface, reusing
the Sprint 25 BullMQ delayed-job scheduler. No scheduler redesign, no recurring
schedules, no timezone management beyond ISO-8601.

---

## Calendar Model

Calendar events are derived from BullMQ publishing queue jobs that have a
`scheduledFor` timestamp (or `delayed` status) within the requested range.

```
GET /calendar/events?start=&end=&publisher=&status=
    → CalendarService.listEvents()
    → QueueService.listJobs()
    → filter by scheduledFor ∈ [start, end]
    → return CalendarEvent[]
```

Each `CalendarEvent` includes:

| Field | Source |
|---|---|
| `jobId` | BullMQ job id |
| `scheduledFor` | payload.scheduledFor or job delay time |
| `publisher` | payload.publisherId |
| `assetId` | payload.assetId |
| `status` | queue state (delayed, waiting, …) |
| `retryCount` | job.attemptsMade |

---

## Timeline Model

The timeline merges queue jobs and published content history into a single
chronological feed.

| Type | Source |
|---|---|
| `queued` | waiting / active jobs |
| `scheduled` | delayed jobs or jobs with `scheduledFor` |
| `published` | PublishedContent history + completed jobs with history match |
| `failed` | failed queue jobs |
| `duplicate_skipped` | completed jobs without matching published history |

```
GET /calendar/timeline?start=&end=&publisher=&limit=
    → CalendarService.listTimeline()
    → merge jobs + history → sort by timestamp
```

---

## Scheduled Workflow

Scheduling reuses Sprint 41 publish validation with Sprint 25 delayed enqueue:

```
POST /composer/schedule
    { assetId, publisherIds[], scheduledFor }
    → validate per publisher (Sprint 41)
    → duplicate check → skip
    → enqueue with scheduledFor in payload
    → BullMQ delay = max(0, scheduledFor - now)
    → HTTP 202 (no wait for execution)
```

`scheduledFor` must be valid ISO-8601 and in the future at schedule time.

Duplicate detection at schedule time skips enqueue (same as immediate publish).
Duplicate at execution time still applies when the delayed job runs (Sprint 25).

---

## Dashboard — Calendar Page

Route: `/calendar`

Views:

| View | Display |
|---|---|
| Month | Events grouped by day |
| Week | List table (same data, week range) |
| List | Tabular events with status and retries |
| Timeline | Chronological mixed-type feed |

Event detail panel shows: scheduled time, publisher, asset, status, retry count.

No live polling in Sprint 43 — data loaded on page request.

---

## Future Drag-Drop Scheduling

Deferred enhancements:

- Drag events on month grid to reschedule (`scheduledFor` update)
- Resize event duration for multi-step workflows
- Calendar create flow wired to `POST /composer/schedule`
- Live refresh when delayed jobs transition to active/completed
- Timezone display helpers (storage remains ISO-8601 UTC)

---

## Testing

| Layer | Coverage |
|---|---|
| API | `calendar.test.ts`, `calendar-service.test.ts`, schedule in `content-composer-service.test.ts` |
| Dashboard | `calendar-app.test.ts`, `calendar-renderer.test.ts` |
| Smoke | `pnpm calendar:smoke` |

---

## Verification

```bash
pnpm test
pnpm build
pnpm calendar:smoke
```
