#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

API_PORT="${API_PORT:-8080}"
WEB_PORT="${WEB_PORT:-5173}"
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

port_pids() {
  local port="$1"
  ss -ltnp "sport = :${port}" 2>/dev/null | grep -oE 'pid=[0-9]+' | sed 's/pid=//' | sort -u
}

free_port() {
  local port="$1"
  local name="$2"

  if ! port_open "${port}"; then
    return
  fi

  echo "Port ${port} is in use; stopping existing ${name} process(es)..."
  local pids=()
  while IFS= read -r pid; do
    if [ -n "${pid}" ]; then
      pids+=("${pid}")
    fi
  done < <(port_pids "${port}")

  if [ "${#pids[@]}" -eq 0 ]; then
    echo "Could not identify process on port ${port}."
    ss -ltnp "sport = :${port}" || true
    exit 1
  fi

  for pid in "${pids[@]}"; do
    if kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
    fi
  done

  local i
  for i in $(seq 1 10); do
    if ! port_open "${port}"; then
      return
    fi
    sleep 0.2
  done

  for pid in "${pids[@]}"; do
    if kill -0 "${pid}" 2>/dev/null; then
      kill -9 "${pid}" 2>/dev/null || true
    fi
  done

  sleep 0.2
  if port_open "${port}"; then
    echo "Port ${port} is still in use after stopping ${name}."
    ss -ltnp "sport = :${port}" || true
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

free_port "${API_PORT}" "API"
free_port "${WEB_PORT}" "WEB"

echo "Starting MongoDB and MinIO..."
if port_open "${MONGO_PORT}"; then
  echo "MongoDB is already listening on port ${MONGO_PORT}; reusing it."
else
  docker compose -f "${ROOT_DIR}/deploy/docker-compose.yml" up -d mongo
fi
docker compose -f "${ROOT_DIR}/deploy/docker-compose.yml" up -d minio

if [ ! -f "${ROOT_DIR}/backend/.env" ]; then
  cp "${ROOT_DIR}/backend/.env.example" "${ROOT_DIR}/backend/.env"
fi

if [ ! -d "${ROOT_DIR}/front/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd "${ROOT_DIR}/front" && npm install)
fi

start_service "backend API" "backend" env PORT="${API_PORT}" go run ./cmd/api
start_service "frontend" "front" npm run dev -- --port "${WEB_PORT}"

echo
echo "Sansyar dev stack is running:"
echo "  API:          http://localhost:${API_PORT}"
echo "  Frontend:     http://localhost:${WEB_PORT}"
echo "  Admin panel:  http://localhost:${WEB_PORT}/admin/login"
echo "  MinIO:        http://localhost:9001"
echo
echo "Press Ctrl+C to stop all dev services."

wait -n "${pids[@]}"
