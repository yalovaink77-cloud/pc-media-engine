#!/usr/bin/env bash
# PC Media Engine — restore from backup (Sprint 48)
#
# Usage:
#   deploy/scripts/restore.sh <backup-directory> [--dry-run]
#
# WARNING: Destructive — stops stack and overwrites database + storage.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-directory> [--dry-run]"
  exit 1
fi

BACKUP_PATH="$1"
DRY_RUN=false
if [[ "${2:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/compose/docker-compose.production.yml"
ENV_FILE="${ROOT_DIR}/deploy/env/.env.production"

if [[ ! -d "${BACKUP_PATH}" ]]; then
  echo "[restore] ERROR: backup directory not found: ${BACKUP_PATH}"
  exit 1
fi

if [[ ! -f "${BACKUP_PATH}/postgres.sql.gz" ]]; then
  echo "[restore] ERROR: postgres.sql.gz missing in backup"
  exit 1
fi

if [[ "${DRY_RUN}" == true ]]; then
  echo "[restore] DRY RUN — would restore from ${BACKUP_PATH}"
  echo "[restore] DRY RUN — postgres: ${BACKUP_PATH}/postgres.sql.gz"
  [[ -f "${BACKUP_PATH}/storage.tar.gz" ]] && echo "[restore] DRY RUN — storage: ${BACKUP_PATH}/storage.tar.gz"
  exit 0
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[restore] ERROR: ${ENV_FILE} not found"
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

echo "[restore] Stopping stack..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" down --timeout 30

echo "[restore] Starting postgres only..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d postgres
sleep 5

echo "[restore] Restoring PostgreSQL..."
gunzip -c "${BACKUP_PATH}/postgres.sql.gz" | \
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

if [[ -f "${BACKUP_PATH}/storage.tar.gz" ]]; then
  echo "[restore] Restoring storage volume..."
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d api
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T api \
    sh -c 'rm -rf /data/storage/* && tar xzf - -C /data/storage' < "${BACKUP_PATH}/storage.tar.gz"
fi

echo "[restore] Complete. Run deploy/scripts/startup.sh to bring up full stack."
