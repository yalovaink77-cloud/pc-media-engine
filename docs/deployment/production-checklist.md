# Production Checklist

Use this checklist before every production deployment.

## Pre-deployment

- [ ] `pnpm test` passes
- [ ] `pnpm build` passes
- [ ] `pnpm deployment:smoke` passes
- [ ] `deploy/env/.env.production` created from example — **no placeholder secrets remain**
- [ ] `PCME_AUTH_ENABLED=true` with strong `PCME_JWT_SECRET` and `PCME_API_KEYS`
- [ ] `DASHBOARD_API_KEY` matches an entry in `PCME_API_KEYS`
- [ ] `PCME_DEFAULT_ORG_ID` and `PCME_DEFAULT_PROJECT_ID` set (run seed or use known UUIDs)
- [ ] Publisher credentials configured (`WORDPRESS_*` or `GHOST_*`)
- [ ] Durable handoff publishing understood — default worker does **not** run outbox polling ([Durable Publishing Worker](./durable-publishing-worker.md))
- [ ] TLS termination planned (reverse proxy in front of ports 3001/3002)
- [ ] Firewall allows only required ports (3001, 3002, or proxy 443)

## Infrastructure

- [ ] Docker Engine 24+ and Compose v2 installed
- [ ] Persistent volumes configured (postgres, redis, storage)
- [ ] Resource limits meet [recommendations](../../deploy/resources/recommendations.md)
- [ ] Log rotation configured (`deploy/logrotate/pcme.conf`)
- [ ] Backup schedule defined (see [Backup Guide](./backup-guide.md))

## Database

- [ ] Migrations reviewed in `packages/database/prisma/migrations/`
- [ ] `deploy/scripts/migrate.sh` tested on staging
- [ ] Connection string uses internal hostname `postgres` (not localhost)

## Startup verification

- [ ] `deploy/scripts/startup.sh` completes without errors
- [ ] `curl http://localhost:3001/health` returns `"database":"ok"`
- [ ] Dashboard loads at `http://localhost:3002`
- [ ] Worker container running: `docker compose ps worker`
- [ ] Queue operations work (pause/resume smoke or manual test)

## Security

- [ ] RBAC roles reviewed (`PCME_API_KEY_ROLES` if using multiple keys)
- [ ] Dashboard RBAC enabled if operators use different roles
- [ ] Secrets not committed to git
- [ ] `.env.production` file permissions restricted (`chmod 600`)

## Post-deployment

- [ ] Initial backup taken: `deploy/scripts/backup.sh`
- [ ] Monitoring/alerting on container health (optional external tooling)
- [ ] Upgrade and DR runbooks shared with team
