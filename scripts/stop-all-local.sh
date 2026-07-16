#!/usr/bin/env bash
# Stops everything started by start-all-local.sh: the 6 Node processes and
# the shared Postgres container. Does NOT remove the Postgres container by
# default (data survives) -- pass --wipe to also `docker compose down` it
# (see the "docker compose down deletes data" discussion -- this is deliberate,
# opt-in only).
set -euo pipefail
cd "$(dirname "$0")/.."

PORTS=(3001 3002 3003 3004 3005 3006)

echo "==> Stopping services"
for port in "${PORTS[@]}"; do
  pid=$(lsof -ti:"$port" || true)
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null || true
    echo "    - stopped process on port $port"
  fi
done

if [ "${1:-}" = "--wipe" ]; then
  echo "==> Also tearing down the shared Postgres container (data will be lost)"
  (cd services/tenant && docker compose -f docker-compose.test.yml down)
else
  echo "==> Shared Postgres container left running (data preserved)."
  echo "    Run with --wipe to also remove it: ./scripts/stop-all-local.sh --wipe"
fi
