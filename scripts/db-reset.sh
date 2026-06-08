#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="homejobboard-postgres"

echo "Removing ${CONTAINER_NAME} container + data volume..."
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
docker volume rm "${CONTAINER_NAME}-data" >/dev/null 2>&1 || true
echo "✓ wiped — run ./scripts/db-start.sh to recreate"

exec "$(dirname "$0")/db-start.sh"
