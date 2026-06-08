#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="homejobboard-postgres"

if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Stopping ${CONTAINER_NAME}..."
  docker stop "${CONTAINER_NAME}" >/dev/null
  echo "✓ stopped"
else
  echo "✓ ${CONTAINER_NAME} not running"
fi
