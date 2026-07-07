# PC Media Engine — Deployment Guide

> Sprint 48 — Production Deployment Toolkit

## Overview

PC Media Engine runs as three application services (API, Worker, Dashboard) backed by PostgreSQL and Redis. The production toolkit uses Docker Compose with network isolation, health checks, persistent volumes, and operational scripts.

## Architecture

```
                    ┌─────────────┐
   Internet ───────►│  Dashboard  │  :3002 (edge)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │     API     │  :3001 (edge + internal)
                    └──┬──────┬───┘
                       │      │
              ┌────────▼──┐ ┌─▼────────┐
              │  Worker   │ │ Postgres │
              │ (internal)│ │ (internal)│
              └─────┬─────┘ └──────────┘
                    │
              ┌─────▼─────┐
              │   Redis   │
              │ (internal)│
              └───────────┘
```

- **pcme_internal** — database, cache, worker (no public access)
- **pcme_edge** — API and Dashboard ports exposed to host/load balancer

## Quick start

1. Copy environment template:
   ```bash
   cp deploy/env/.env.production.example deploy/env/.env.production
   ```
2. Edit secrets, org/project IDs, and publisher credentials.
3. Start the stack:
   ```bash
   chmod +x deploy/scripts/*.sh
   deploy/scripts/startup.sh
   ```
4. Verify:
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3002/
   ```

## Development vs production

| Concern | Development | Production |
|---------|-------------|------------|
| Compose file | `docker-compose.yml` (infra only) | `deploy/compose/docker-compose.production.yml` |
| Apps | Run on host via `pnpm dev` | Containerized |
| Networks | Single `pcme_dev` bridge | Internal + edge isolation |
| Auth | Optional (`PCME_AUTH_ENABLED=false`) | Recommended `true` |
| Storage | `./storage/local` | Docker volume `/data/storage` |

## Files

| Path | Purpose |
|------|---------|
| `deploy/docker/Dockerfile.*` | Production images |
| `deploy/compose/docker-compose.production.yml` | Full production stack |
| `deploy/env/.env.production.example` | Environment template |
| `deploy/scripts/startup.sh` | Migrate + start |
| `deploy/scripts/shutdown.sh` | Graceful stop |
| `deploy/scripts/migrate.sh` | Database migrations only |
| `deploy/scripts/backup.sh` | PostgreSQL + storage backup |
| `deploy/scripts/restore.sh` | Restore from backup |
| `deploy/logrotate/pcme.conf` | Host log rotation |
| `deploy/resources/recommendations.md` | CPU/memory guidance |

## Monitoring

All production services define Docker health checks:

- **API** — HTTP `GET /health` (readiness includes database)
- **Dashboard** — HTTP `GET /` 
- **Worker** — process liveness probe
- **PostgreSQL / Redis** — native readiness probes

See [Production Checklist](./production-checklist.md) before go-live.

## Related guides

- [Production Checklist](./production-checklist.md)
- [Upgrade Guide](./upgrade-guide.md)
- [Backup Guide](./backup-guide.md)
- [Disaster Recovery Guide](./disaster-recovery-guide.md)
