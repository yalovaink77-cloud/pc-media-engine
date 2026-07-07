# Backup Guide

## What is backed up

| Component | File | Method |
|-----------|------|--------|
| PostgreSQL | `postgres.sql.gz` | `pg_dump` via compose exec |
| Media storage | `storage.tar.gz` | Tar of `/data/storage` volume |
| Manifest | `manifest.json` | Timestamp + file list |

Redis queue state is **not** included by default — jobs are transient. Re-queue failed jobs after restore if needed.

## Create a backup

```bash
deploy/scripts/backup.sh
```

Output: `deploy/backups/YYYYMMDD-HHMMSS/`

### Custom backup directory

```bash
BACKUP_DIR=/mnt/backups/pcme deploy/scripts/backup.sh
```

## Schedule

Example cron (daily at 02:00):

```cron
0 2 * * * /opt/pc-media-engine/deploy/scripts/backup.sh >> /var/log/pcme-backup.log 2>&1
```

## Verify backup integrity

```bash
deploy/scripts/backup.sh --dry-run   # validates scripts and paths
gunzip -t deploy/backups/*/postgres.sql.gz
```

## Retention

- Keep daily backups for 14 days minimum
- Keep weekly backups for 3 months
- Test restore quarterly (see [Disaster Recovery Guide](./disaster-recovery-guide.md))

## Off-site copy

Copy the backup directory to object storage (S3, GCS, etc.) after each run:

```bash
rsync -av deploy/backups/ user@backup-host:/backups/pcme/
```

The backup script is intentionally simple — extend with your org's tooling as needed.
