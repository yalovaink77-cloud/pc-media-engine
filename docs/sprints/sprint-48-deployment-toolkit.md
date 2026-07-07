# Sprint 48 — Production Deployment Toolkit

## Objective

Prepare PC Media Engine for real production deployment with Docker Compose, operational scripts, monitoring probes, and documentation — without changing application architecture.

## Deployment architecture

```
┌─────────────────────────────────────────────────────────┐
│  pcme_edge (public-facing)                              │
│    Dashboard :3002    API :3001                         │
└────────────┬────────────────────────────────────────────┘
             │ pcme_app (application tier, outbound OK)
┌────────────▼────────────────────────────────────────────┐
│  API + Worker                                           │
└────────────┬────────────────────────────────────────────┘
             │ pcme_data (internal — no direct host ports)
┌────────────▼────────────────────────────────────────────┐
│  PostgreSQL + Redis                                     │
└─────────────────────────────────────────────────────────┘
```

- **Three-tier networking** — data layer isolated (`internal: true`), app tier with outbound access for publishers, edge tier for HTTP ports
- **Persistent volumes** — postgres, redis AOF, media storage
- **Health checks** — all services; API uses `/health` readiness
- **Restart policies** — `unless-stopped` on all long-running services

## Components delivered

| Category | Artifacts |
|----------|-----------|
| Docker images | `deploy/docker/Dockerfile.{api,worker,dashboard}` |
| Production compose | `deploy/compose/docker-compose.production.yml` |
| Dev compose | Enhanced root `docker-compose.yml` |
| Environment | `deploy/env/.env.production.example` |
| Operations | `deploy/scripts/{startup,shutdown,migrate,backup,restore}.sh` |
| Log rotation | `deploy/logrotate/pcme.conf` |
| Resources | `deploy/resources/recommendations.md` |
| Docs | `docs/deployment/*.md` |

## Backup strategy

- **PostgreSQL** — `pg_dump` compressed to timestamped directory
- **Storage** — tar archive of `/data/storage` volume
- **Schedule** — daily cron recommended; 14-day retention minimum
- **Off-site** — rsync/object storage after each backup
- See [Backup Guide](../deployment/backup-guide.md)

## Upgrade process

1. Backup → pull tag → shutdown → `startup.sh` (migrate + rebuild)
2. Rollback via previous tag + restore if schema changed
3. See [Upgrade Guide](../deployment/upgrade-guide.md)

## Production recommendations

- Enable auth (`PCME_AUTH_ENABLED=true`) with strong secrets
- Use TLS reverse proxy in front of edge ports
- Minimum ~3 vCPU / 3 GB RAM; recommended ~8 vCPU / 6 GB RAM
- See [recommendations.md](../../deploy/resources/recommendations.md)

## Smoke & verification

```bash
pnpm deployment:smoke   # offline asset + health validation
pnpm test
pnpm build
```

## Non-goals (Sprint 48)

- No Kubernetes operators or Helm charts
- No application code redesign (API, Worker, Dashboard unchanged)
- No changes to auth, RBAC, queue, or Publisher SDK behavior
