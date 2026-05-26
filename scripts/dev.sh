#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

API_PORT="${API_PORT:-8080}"
WEB_PORT="${WEB_PORT:-5173}"
ADMIN_PORT="${ADMIN_PORT:-5174}"
MONGO_PORT="${MONGO_PORT:-27017}"

pids=()
cleaned_up=0

port_open() {
  local port="$1"
  ss -ltn "sport = :${port}" 2>/dev/null | grep -q LISTEN
}

cleanup() {
  if [ "${cleaned_up}" -eq 1 ]; then
    return
  fi
  cleaned_up=1

  if [ "${#pids[@]}" -eq 0 ]; then
    return
  fi

  echo
  echo "Stopping Sansyar dev services..."
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}

require_port() {
  local port="$1"
  local name="$2"

  if port_open "${port}"; then
    echo "Port ${port} is already in use; ${name} cannot start."
    echo
    ss -ltnp "sport = :${port}" || true
    echo
    echo "Stop the existing process or override the port with ${name}_PORT."
    exit 1
  fi
}

start_service() {
  local name="$1"
  local dir="$2"
  shift 2

  echo "Starting ${name}..."
  (
    cd "${ROOT_DIR}/${dir}"
    exec "$@"
  ) &
  pids+=("$!")
}

trap 'cleanup; exit 130' INT TERM
trap cleanup EXIT

require_port "${API_PORT}" "API"
require_port "${WEB_PORT}" "WEB"
require_port "${ADMIN_PORT}" "ADMIN"

echo "Starting MongoDB..."
if port_open "${MONGO_PORT}"; then
  echo "MongoDB is already listening on port ${MONGO_PORT}; reusing it."
else
  docker compose -f "${ROOT_DIR}/deploy/docker-compose.yml" up -d mongo
fi

start_service "backend API" "backend" env PORT="${API_PORT}" go run ./cmd/api
start_service "customer web" "." npm --workspace apps/web run dev -- --port "${WEB_PORT}"
start_service "admin panel" "." npm --workspace apps/admin run dev -- --port "${ADMIN_PORT}"

echo
echo "Sansyar dev stack is running:"
echo "  API:          http://localhost:${API_PORT}"
echo "  Customer PWA: http://localhost:${WEB_PORT}"
echo "  Admin panel:  http://localhost:${ADMIN_PORT}"
echo
echo "Press Ctrl+C to stop all dev services."

wait -n "${pids[@]}"
