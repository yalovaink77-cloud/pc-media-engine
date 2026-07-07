#!/usr/bin/env bash
# PC Media Engine — production startup (Sprint 48)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/compose/docker-compose.production.yml"
ENV_FILE="${ROOT_DIR}/deploy/env/.env.production"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[startup] ERROR: ${ENV_FILE} not found."
  echo "[startup] Copy deploy/env/.env.production.example and configure secrets."
  exit 1
fi

echo "[startup] Running database migrations..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" --profile tools run --rm migrate

echo "[startup] Starting PC Media Engine stack..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --build

echo "[startup] Waiting for API health..."
for i in $(seq 1 30); do
  if docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T api \
    node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    2>/dev/null; then
    echo "[startup] API is healthy."
    break
  fi
  if [[ "${i}" -eq 30 ]]; then
    echo "[startup] WARNING: API health check timed out — inspect logs with: docker compose logs api"
    exit 1
  fi
  sleep 2
done

echo "[startup] Stack is up."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps
