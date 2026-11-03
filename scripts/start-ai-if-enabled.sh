#!/usr/bin/env bash
# Start the optional Ollama service only when explicitly enabled in .env.
# Do not source .env: values are configuration data, not shell code.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.server.yml"
CONTAINER_NAME="hse-ai-engine"
source "${PROJECT_DIR}/scripts/ai-resource-budget.sh"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[AI] .env not found; skipping optional local AI startup."
  exit 0
fi

AI_ENABLED="$(awk -F= '$1 == "AI_ENGINE_ENABLED" { value=substr($0,index($0,"=")+1) } END { gsub(/\r/,"",value); print tolower(value) }' "${ENV_FILE}" | tr -d '[:space:]\"')"
if [[ "${AI_ENABLED}" != "true" && "${AI_ENABLED}" != "1" && "${AI_ENABLED}" != "yes" ]]; then
  echo "[AI] Local AI is disabled in .env; skipping Ollama startup."
  exit 0
fi

[[ -f "${COMPOSE_FILE}" ]] || { echo "[AI] docker-compose.server.yml not found." >&2; exit 1; }
apply_ai_resource_budget "${ENV_FILE}"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" config --quiet

EXISTING_ID="$(docker ps -aq --filter "name=^/${CONTAINER_NAME}$" | head -n1 || true)"
if [[ -n "${EXISTING_ID}" ]]; then
  EXISTING_CONFIG="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "${EXISTING_ID}" 2>/dev/null || true)"
  if [[ "${EXISTING_CONFIG}" != *"docker-compose.server.yml"* ]]; then
    echo "[AI] Existing container belongs to another Compose configuration (${EXISTING_CONFIG:-unknown}); refusing automatic takeover." >&2
    exit 1
  fi
fi

docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --no-deps hse-ai-engine
