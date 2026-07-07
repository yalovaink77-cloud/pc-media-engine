# Upgrade Guide

## Standard upgrade (patch/minor release)

1. **Backup** before any upgrade:
   ```bash
   deploy/scripts/backup.sh
   ```

2. **Pull** the new release tag or commit:
   ```bash
   git fetch --tags
   git checkout v0.48.0-alpha-sprint48  # example
   ```

3. **Review** changelog and sprint docs for breaking env var changes.

4. **Stop** the running stack:
   ```bash
   deploy/scripts/shutdown.sh
   ```

5. **Rebuild** images and apply migrations:
   ```bash
   deploy/scripts/startup.sh
   ```
   (`startup.sh` runs migrations before `up -d --build`)

6. **Verify** health:
   ```bash
   curl http://localhost:3001/health
   pnpm deployment:smoke   # offline validation on the host
   ```

## Database-only migration

When only schema changes ship:

```bash
deploy/scripts/migrate.sh
docker compose -f deploy/compose/docker-compose.production.yml restart api worker
```

## Rollback

1. Stop stack: `deploy/scripts/shutdown.sh`
2. Checkout previous tag: `git checkout v0.47.0-alpha-sprint47`
3. Restore backup if schema changed: `deploy/scripts/restore.sh deploy/backups/<timestamp>`
4. Start: `deploy/scripts/startup.sh`

## Zero-downtime considerations

The current Compose toolkit performs a brief outage during `up -d --build`. For zero-downtime:

- Run blue/green with two Compose projects, or
- Place API behind a load balancer and scale horizontally (future sprint)

Architecture and application code are unchanged — only deployment orchestration is provided here.
