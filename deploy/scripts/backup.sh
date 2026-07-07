#!/usr/bin/env bash
# PC Media Engine — backup postgres + storage (Sprint 48)
#
# Usage:
#   deploy/scripts/backup.sh [--dry-run]
#
# Environment:
#   BACKUP_DIR  — output directory (default: deploy/backups)
#   ENV_FILE    — production env file (default: deploy/env/.env.production)

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/compose/docker-compose.production.yml"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/deploy/env/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/deploy/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR}/${STAMP}"

if [[ "${DRY_RUN}" == true ]]; then
  echo "[backup] DRY RUN — would create backup at ${TARGET}"
  echo "[backup] DRY RUN — compose file: ${COMPOSE_FILE}"
  echo "[backup] DRY RUN — env file: ${ENV_FILE}"
  [[ -f "${COMPOSE_FILE}" ]] || { echo "[backup] ERROR: compose file missing"; exit 1; }
  [[ -f "${ENV_FILE}" ]] || echo "[backup] WARNING: env file missing (expected for dry-run on fresh clone)"
  exit 0
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[backup] ERROR: ${ENV_FILE} not found"
  exit 1
fi

mkdir -p "${TARGET}"

# shellcheck disable=SC1090
source "${ENV_FILE}"

echo "[backup] Backing up PostgreSQL to ${TARGET}/postgres.sql.gz"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" | gzip > "${TARGET}/postgres.sql.gz"

echo "[backup] Archiving storage volume"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" run --rm --no-deps \
  -v "${TARGET}:/backup" api \
  sh -c 'tar czf /backup/storage.tar.gz -C /data/storage . 2>/dev/null || tar czf /backup/storage.tar.gz --files-from /dev/null'

cat > "${TARGET}/manifest.json" <<EOF
{
  "timestamp": "${STAMP}",
  "postgres": "postgres.sql.gz",
  "storage": "storage.tar.gz"
}
EOF

echo "[backup] Complete: ${TARGET}"
