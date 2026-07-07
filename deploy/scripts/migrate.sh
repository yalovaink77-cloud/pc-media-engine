#!/usr/bin/env bash
# PC Media Engine — database migration helper (Sprint 48)
#
# Runs prisma migrate deploy against the production postgres service.
# Usage: deploy/scripts/migrate.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/compose/docker-compose.production.yml"
ENV_FILE="${ROOT_DIR}/deploy/env/.env.production"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[migrate] ERROR: ${ENV_FILE} not found"
  exit 1
fi

echo "[migrate] Ensuring postgres is healthy..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d postgres
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
  sh -c 'until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do sleep 1; done'

echo "[migrate] Applying migrations..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" --profile tools run --rm migrate

echo "[migrate] Done."
