# Sprint 18 — Real WordPress Publishing Worker

## Goal

Connect the publishing worker to the real WordPress publisher via configuration, without adding new publishing features.

---

## PUBLISHER_DRIVER

| Value | Publisher | Network |
|---|---|---|
| `mock` (default) | `MockPublisher` | None |
| `wordpress` | `WordPressMediaPublisher` | WordPress REST API |

Set in environment:

```bash
PUBLISHER_DRIVER=mock        # default when unset
PUBLISHER_DRIVER=wordpress   # real WordPress
```

If `PUBLISHER_DRIVER=wordpress` and WordPress env vars are missing, the worker fails fast with:

```
PUBLISHER_DRIVER=wordpress requires WORDPRESS_BASE_URL, WORDPRESS_USERNAME, and WORDPRESS_APP_PASSWORD
```

---

## Required WordPress env vars

| Variable | Description |
|---|---|
| `WORDPRESS_BASE_URL` | Site URL, e.g. `https://example.com` |
| `WORDPRESS_USERNAME` | WordPress username |
| `WORDPRESS_APP_PASSWORD` | Application Password (not login password) |

Generate via WordPress Admin → Users → Profile → Application Passwords.

---

## Default mock behaviour

- `PUBLISHER_DRIVER` defaults to `mock` when unset
- `pnpm --filter @pcme/worker publishing:smoke` **always** forces `mock` driver regardless of `.env`
- No credentials required for default smoke or unit tests

---

## Architecture

```
BullMQ job
    ↓
processPublishingJob({ publisherDriver })
    ↓
createPublisher()  ← reads PUBLISHER_DRIVER
    ↓
MockPublisher  |  WordPressMediaPublisher
    ↓
PublishingOrchestrator.publish()
    ↓
PublishingFlowResult
```

---

## Manual real WordPress smoke

**Not for CI.** Requires live WordPress + credentials.

```bash
pnpm --filter @pcme/worker publishing:smoke:wordpress
```

Uploads mock media and creates a draft post on the configured WordPress site.

---

## Deferred

| Feature | Reason |
|---|---|
| SEO generation | Separate SEO package sprint |
| AI / OpenRouter | Separate AI sprint |
| Scheduling | Requires date handling + worker extensions |
| `status=publish` | Editorial workflow sprint |
| Retry backoff | Reliability sprint |
| Social publishing | Separate plugin sprints |

---

## Verification

```bash
pnpm --filter @pcme/worker test
pnpm --filter @pcme/worker publishing:smoke
pnpm build
```
