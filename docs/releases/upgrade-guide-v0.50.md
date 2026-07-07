# Upgrade Guide — v0.50.0-beta-rc

> From: v0.49.0-alpha-sprint49 (or any earlier alpha/beta tag)  
> To: v0.50.0-beta-rc

---

## Pre-upgrade checklist

- [ ] Backup PostgreSQL and storage volume (see [Backup Guide](../deployment/backup-guide.md))
- [ ] Note current env configuration
- [ ] Ensure Node.js ≥ 20 and pnpm 9.15.0

---

## Step 1 — Pull release

```bash
git fetch --tags
git checkout v0.50.0-beta-rc
pnpm install
```

---

## Step 2 — Database migrations

Sprint 49 added performance indexes (safe, additive):

```bash
pnpm db:migrate
```

Expected migration: `20260707120000_sprint49_performance_indexes`

No Sprint 50 schema changes.

---

## Step 3 — Environment review

| Variable | Sprint | Notes |
|----------|--------|-------|
| `PCME_AUTH_ENABLED` | 31 | Set `true` for production |
| `PCME_JWT_SECRET` | 31 | Required when auth enabled |
| `PCME_API_KEYS` | 31 | Comma-separated API keys |
| `DASHBOARD_RBAC_ENABLED` | 45 | Dashboard role enforcement |
| `DASHBOARD_API_KEY` | 36 | Required for queue ops from dashboard |

See [deploy/env/.env.production.example](../../deploy/env/.env.production.example).

---

## Step 4 — Build and verify

```bash
pnpm build
pnpm beta-rc:smoke
```

---

## Step 5 — Deploy

```bash
cp deploy/env/.env.production.example deploy/env/.env.production
deploy/scripts/startup.sh
```

See [Deployment Guide](../deployment/deployment-guide.md).

---

## Rollback

1. `deploy/scripts/shutdown.sh`
2. Restore database backup
3. `git checkout v0.49.0-alpha-sprint49 && pnpm install && pnpm build`

Sprint 49 indexes are additive — no index removal required on rollback.

---

## What changed in Sprint 50

Release validation only — no API, schema, or behaviour changes.
