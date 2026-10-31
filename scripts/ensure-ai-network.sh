#!/usr/bin/env bash
# Ensure the stable Docker bridge shared by HSECORE and its optional Local AI runtime.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_DIR}"

NETWORK_NAME="${DOCKER_NETWORK_NAME:-}"
if [[ -z "${NETWORK_NAME}" && -f .env ]]; then
  env_line="$(grep -E '^[[:space:]]*DOCKER_NETWORK_NAME=' .env | tail -n 1 || true)"
  if [[ -n "${env_line}" ]]; then
    NETWORK_NAME="${env_line#*=}"
    NETWORK_NAME="${NETWORK_NAME%$'\r'}"
    NETWORK_NAME="${NETWORK_NAME#\"}"
    NETWORK_NAME="${NETWORK_NAME%\"}"
    NETWORK_NAME="${NETWORK_NAME#\'}"
    NETWORK_NAME="${NETWORK_NAME%\'}"
  fi
fi
NETWORK_NAME="${NETWORK_NAME:-hse-network}"

if ! [[ "${NETWORK_NAME}" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]]; then
  echo "[AI Network] Invalid Docker network name: ${NETWORK_NAME}" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[AI Network] Docker CLI is not installed." >&2
  exit 1
fi

docker info >/dev/null

if docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1; then
  network_driver="$(docker network inspect --format '{{.Driver}}' "${NETWORK_NAME}")"
  network_internal="$(docker network inspect --format '{{.Internal}}' "${NETWORK_NAME}")"
  if [[ "${network_driver}" != "bridge" || "${network_internal}" != "false" ]]; then
    echo "[AI Network] Existing network '${NETWORK_NAME}' is incompatible (driver=${network_driver}, internal=${network_internal}); expected a non-internal bridge." >&2
    exit 1
  fi
  echo "[AI Network] Shared non-internal bridge '${NETWORK_NAME}' already exists."
else
  docker network create --driver bridge "${NETWORK_NAME}" >/dev/null
  echo "[AI Network] Created shared non-internal bridge network '${NETWORK_NAME}'."
fi
