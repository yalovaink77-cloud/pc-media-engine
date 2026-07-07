#!/usr/bin/env bash
# PC Media Engine — graceful production shutdown (Sprint 48)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/compose/docker-compose.production.yml"
ENV_FILE="${ROOT_DIR}/deploy/env/.env.production"

if [[ ! -f "${ENV_FILE}" ]]; then
  ENV_FILE="${ROOT_DIR}/deploy/env/.env.production.example"
fi

echo "[shutdown] Stopping PC Media Engine stack..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" down --timeout 30

echo "[shutdown] Stack stopped."
