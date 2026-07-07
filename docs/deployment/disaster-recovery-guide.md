# Disaster Recovery Guide

## Recovery objectives (guidance)

| Metric | Target (single-node Compose) |
|--------|------------------------------|
| RPO | 24 hours (daily backup) or less with frequent backups |
| RTO | 1–2 hours (restore + verify) |

Adjust based on your backup schedule and team capacity.

## Scenario: Database corruption or data loss

1. Stop the stack:
   ```bash
   deploy/scripts/shutdown.sh
   ```

2. Identify latest good backup:
   ```bash
   ls -lt deploy/backups/
   ```

3. Restore:
   ```bash
   deploy/scripts/restore.sh deploy/backups/20260707-020000
   ```

4. Start full stack:
   ```bash
   deploy/scripts/startup.sh
   ```

5. Verify:
   - `GET /health` — database ok
   - Dashboard loads
   - Sample asset/publish history intact

## Scenario: Complete host loss

1. Provision new host with Docker + Compose
2. Clone repository at known release tag
3. Restore `deploy/env/.env.production` from secure secret store (not from backup)
4. Copy latest backup archive to new host
5. Run restore + startup scripts
6. Update DNS / load balancer to new host

## Scenario: API container unhealthy

1. Check logs: `docker compose -f deploy/compose/docker-compose.production.yml logs api`
2. Restart service: `docker compose ... restart api`
3. If persistent, rollback to previous image tag (see [Upgrade Guide](./upgrade-guide.md))

## Scenario: Worker stopped processing

1. Verify Redis: `docker compose exec redis redis-cli ping`
2. Verify worker health: `docker compose ps worker`
3. Restart worker: `docker compose restart worker`
4. Inspect failed jobs via Dashboard or `GET /jobs`

## Scenario: Storage volume lost

1. Restore `storage.tar.gz` from backup via `restore.sh`
2. If no storage backup, media files are lost — database records may reference missing files
3. Re-upload affected assets

## Testing DR

Quarterly drill:

1. Run backup on production/staging
2. Restore to isolated environment
3. Verify health endpoints and sample workflow
4. Document time taken and issues

## Contacts & escalation

Document your team contacts and hosting provider support here before production go-live.
