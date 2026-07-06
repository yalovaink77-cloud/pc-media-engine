# PC Media Engine — Beta Deployment Checklist

> Version: v0.30.0-beta  
> Date: July 2026  
> Use this checklist for every Beta environment deployment.

---

## 1. Pre-deployment

- [ ] All CI tests pass (`pnpm test`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Beta smoke passes (`pnpm beta:smoke`)
- [ ] Sprint docs for 25–30 reviewed
- [ ] Database migration scripts reviewed — `packages/database/prisma/migrations/`
- [ ] No uncommitted migration files

---

## 2. Environment Variables

### API (`apps/api`)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | Yes* | — | `postgresql://` or `postgres://` |
| `REDIS_URL` | Yes* | — | `redis://` or `rediss://` |
| `STORAGE_LOCAL_ROOT` | Yes* | `./storage/local` | Persistent volume path in prod |
| `API_PORT` | No | `3001` | TCP port |
| `API_HOST` | No | `0.0.0.0` | Bind address |
| `NODE_ENV` | No | `development` | Set to `production` in prod |
| `LOG_LEVEL` | No | `info` | `debug` / `info` / `warn` / `error` |
| `PCME_DEFAULT_ORG_ID` | Yes* | — | Seeded org UUID from `pnpm db:seed` |
| `PCME_DEFAULT_PROJECT_ID` | Yes* | — | Seeded project UUID |
| `PCME_DEFAULT_PROJECT_SLUG` | No | `piercingconnect` | URL-safe slug |
| `PUBLISHER_DRIVER` | No | `mock` | `mock` or `wordpress` |
| `PCME_AUTO_ENQUEUE_PUBLISHING` | No | `false` | Set `true` to auto-publish |

*Required for full functionality; missing values produce startup warnings.

### Worker (`apps/worker`)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `REDIS_URL` | **Fatal** | — | Worker will not start without this |
| `DATABASE_URL` | Recommended | — | History + duplicate detection |
| `STORAGE_LOCAL_ROOT` | Recommended | — | Thumbnail generation |
| `WORKER_CONCURRENCY` | No | `5` | Jobs processed in parallel |
| `LOG_LEVEL` | No | `info` | |
| `PUBLISHER_DRIVER` | No | `mock` | `mock` or `wordpress` |
| `PCME_AUTO_ENQUEUE_PUBLISHING` | No | `false` | |
| `PCME_PUBLISHING_MAX_RETRIES` | No | `3` | 0 to disable retries |
| `PCME_PUBLISHING_BACKOFF_MS` | No | `5000` | Initial backoff in ms |

### WordPress Publisher (when `PUBLISHER_DRIVER=wordpress`)

| Variable | Required | Default |
|---|---|---|
| `WORDPRESS_API_URL` | Yes | — |
| `WORDPRESS_USERNAME` | Yes | — |
| `WORDPRESS_PASSWORD` | Yes | — |

### Dashboard (`apps/dashboard`)

| Variable | Required | Default |
|---|---|---|
| `DASHBOARD_API_BASE_URL` | Yes | `http://localhost:3001` |
| `DASHBOARD_PORT` | No | `3002` |
| `DASHBOARD_HOST` | No | `0.0.0.0` |
| `LOG_LEVEL` | No | `info` |

### OpenRouter AI (when `AI_METADATA_PROVIDER=openrouter`)

| Variable | Required | Default |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | — |

---

## 3. Database

- [ ] PostgreSQL 14+ instance available
- [ ] Connection string set in `DATABASE_URL`
- [ ] Database created: `CREATE DATABASE pcme;`
- [ ] Migrations applied: `pnpm --filter @pcme/database db:migrate:deploy`
- [ ] Seed data created (first time only): `pnpm db:seed`
- [ ] Note the `PCME_DEFAULT_ORG_ID` and `PCME_DEFAULT_PROJECT_ID` from seed output

### Schema check

After migrations, verify the following tables exist:
- `media_assets`
- `processing_jobs`
- `published_content` (Sprint 22+)

---

## 4. Redis

- [ ] Redis 6+ instance available
- [ ] `REDIS_URL` correctly set (`redis://host:6379`)
- [ ] Connection test: `redis-cli -u $REDIS_URL ping` → `PONG`
- [ ] Worker connects successfully (check logs for `Processing worker online`)

### Queue names

The worker uses these BullMQ queues:
- `pcme:processing` — media processing jobs
- `pcme:publishing` — publishing jobs

---

## 5. Storage

- [ ] `STORAGE_LOCAL_ROOT` set to a persistent directory (e.g. `/data/media`)
- [ ] Directory exists and is writable by the API process
- [ ] In containers: mount a persistent volume at this path

---

## 6. WordPress (if `PUBLISHER_DRIVER=wordpress`)

- [ ] WordPress site URL configured in `WORDPRESS_API_URL`
- [ ] Application password created for the API user
- [ ] Test connection: `GET $WORDPRESS_API_URL/wp-json/wp/v2/users/me`
- [ ] Media upload permission verified: `POST /wp-json/wp/v2/media`

---

## 7. Service Startup Order

Start services in this order:

```
1. PostgreSQL
2. Redis
3. pnpm --filter @pcme/api start          → API (port 3001)
4. pnpm --filter @pcme/worker start       → Processing + Publishing Worker
5. pnpm --filter @pcme/dashboard start    → Dashboard (port 3002)
```

Verify each step before starting the next.

---

## 8. Post-startup Health Checks

```bash
# API health
curl http://localhost:3001/health
# Expected: { "status": "ok", "database": "ok", "metricsEnabled": true, ... }

# API metrics
curl http://localhost:3001/metrics
# Expected: { "uploadsTotal": 0, ... }

# Dashboard
curl http://localhost:3002/
# Expected: HTML page with "PC Media Engine — Dashboard"

# Worker (check logs)
# Expected: "Processing worker online" and "Publishing worker online"
```

---

## 9. Backup

### Database

```bash
# Full dump
pg_dump $DATABASE_URL > pcme-$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < pcme-20260706.sql
```

### Storage files

```bash
# Sync to S3 / backup
rsync -avz $STORAGE_LOCAL_ROOT backup-host:/backups/pcme/media/
```

### Redis

Redis is ephemeral in this architecture — BullMQ jobs are transient.
If jobs in the queue need to survive a restart, configure Redis persistence (AOF or RDB).

---

## 10. Monitoring

### Endpoints to monitor

| Endpoint | Expected | Alert if |
|---|---|---|
| `GET /health` | `200 { status: ok }` | Non-200 or `status != ok` |
| `GET /health` | `database: ok` | `database: unavailable` |
| `GET /metrics` | `200` | Non-200 |
| `GET /metrics` | `failuresTotal` stable | Rapid increase |

### Metrics to alert on

| Metric | Alert threshold |
|---|---|
| `failuresTotal` | > 10 in 5 minutes |
| `retriesTotal` | > 50 in 5 minutes |
| `queueFailed` | > 20 |
| API `uptime` | resets unexpectedly |

---

## 11. Recovery Procedures

### API is down

1. Check logs for startup errors
2. Verify `DATABASE_URL` and `REDIS_URL` are reachable
3. Run `pnpm beta:smoke` offline to verify config validation
4. Restart: `pnpm --filter @pcme/api start`

### Worker is down

1. Check logs for `Fatal configuration error(s)`
2. `REDIS_URL` is required — verify Redis is up
3. Restart: `pnpm --filter @pcme/worker start`
4. Jobs in Redis queue will resume automatically

### Publishing failures elevated

1. Check `GET /metrics` for `failuresTotal` and `retriesTotal`
2. Check `GET /publishing/history?limit=20` for recent failed records
3. If WordPress: verify `WORDPRESS_API_URL` and credentials
4. Jobs with exhausted retries can be requeued manually if needed

### Database unavailable

1. `GET /health` returns `database: unavailable`
2. API continues serving non-DB routes (version, metrics, health)
3. Restore DB, then verify `GET /health` returns `database: ok`

---

## 12. Known Limitations (Beta)

- No authentication on any endpoint (all read/write routes are public)
- Single-node only (no horizontal scaling)
- File storage is local filesystem only (no S3/GCS)
- Metrics are in-memory per-process (reset on restart)
- WordPress is the only non-mock publisher
- No rate limiting
- No request authentication or API keys
