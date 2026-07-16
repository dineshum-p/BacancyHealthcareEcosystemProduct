#!/usr/bin/env bash
# Starts every backend service (tenant, auth, patient, emr, billing,
# notification) locally, all pointed at ONE shared Postgres instance --
# `services/tenant`'s own docker-compose.test.yml -- so the shared
# `public.tenants` registry (and cross-service calls like admin-seed) actually
# work, instead of each service's default isolated per-service database.
#
# None of these services load `.env` files at runtime (no dotenv anywhere in
# their code -- only the migration CLI reads `.env` directly), so every
# setting below is exported into the environment before each service starts.
#
# Usage: ./scripts/start-all-local.sh
# Stop everything: ./scripts/stop-all-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

LOG_DIR=/tmp/hep-local
mkdir -p "$LOG_DIR"

echo "==> Installing/refreshing dependencies (picks up any new workspace)"
npm install --silent

DB_HOST=localhost
DB_PORT=5544
DB_USER=tenant_service
DB_PASSWORD=tenant_service
DB_NAME=tenant_service

JWT_ACCESS_SECRET=dev-insecure-access-secret-change-me
MFA_ENCRYPTION_KEY=dev-insecure-mfa-key-change-me
INTERNAL_SERVICE_KEY=dev-insecure-internal-service-key-change-me

# name:port -- apps/web's dev server owns port 3000, so every backend
# service starts from 3001.
SERVICES=(
  "tenant:3001"
  "auth:3002"
  "emr:3003"
  "notification:3004"
  "billing:3005"
  "patient:3006"
)

echo "==> Starting shared Postgres (services/tenant's docker-compose.test.yml, port $DB_PORT)"
(cd services/tenant && docker compose -f docker-compose.test.yml up -d)

echo "==> Waiting for Postgres to be healthy"
for _ in $(seq 1 30); do
  status=$(docker inspect -f '{{.State.Health.Status}}' tenant-postgres-1 2>/dev/null || echo "starting")
  [ "$status" = "healthy" ] && break
  sleep 1
done

echo "==> Running services/tenant's migrations (idempotent -- safe to re-run)"
(
  cd services/tenant
  export DATABASE_URL="postgres://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
  npm run migrate:up
)

echo "==> Starting each service"
for entry in "${SERVICES[@]}"; do
  name="${entry%%:*}"
  port="${entry##*:}"

  # Free up the port if a previous run is still holding it.
  lsof -ti:"$port" | xargs -r kill 2>/dev/null || true

  (
    cd "services/$name"
    export NODE_ENV=development
    export PORT="$port"
    export DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME
    export JWT_ACCESS_SECRET
    export MFA_ENCRYPTION_KEY
    export INTERNAL_SERVICE_KEY
    export AUTH_SERVICE_URL="http://localhost:3002"
    export NOTIFICATION_SERVICE_URL="http://localhost:3004"
    nohup npm run start:dev > "$LOG_DIR/$name.log" 2>&1 &
    disown
  )
  echo "    - $name -> http://localhost:$port  (log: $LOG_DIR/$name.log)"
done

echo
echo "==> All services launching in the background. Compiling/booting takes ~10-15s each."
echo "    Tail a log:    tail -f $LOG_DIR/<service>.log"
echo "    Stop everything: ./scripts/stop-all-local.sh"
