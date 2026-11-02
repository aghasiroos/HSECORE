#!/usr/bin/env bash
# HSECORE Local AI runtime verification.
# The main installer owns the application environment; this script never
# overwrites credentials, downloads models, or changes the configured model.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.server.yml"
ENV_FILE="${PROJECT_DIR}/.env"
CONTAINER_NAME="hse-ai-engine"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

fail() { echo -e "${RED}[ERROR] $* ${NC}" >&2; exit 1; }
get_env_value() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { value=substr($0,index($0,"=")+1) } END { gsub(/\r/,"",value); print value }' "${ENV_FILE}"
}
ensure_env_key() {
  local key="$1" value="$2"
  if ! grep -q "^${key}=" "${ENV_FILE}"; then
    printf '%s=%s\n' "$key" "$value" >> "${ENV_FILE}"
  fi
}

echo -e "${BOLD}${CYAN}============================================================${NC}"
echo -e " ${BOLD}HSECORE AI — Runtime Verification${NC}"
echo -e "${BOLD}${CYAN}============================================================${NC}"

command -v docker >/dev/null 2>&1 || fail "Docker CLI is not installed."
docker info >/dev/null 2>&1 || fail "Docker daemon is not running."
[[ -f "${ENV_FILE}" ]] || fail ".env is missing. Complete the main HSECORE installation first."
[[ -f "${COMPOSE_FILE}" ]] || fail "docker-compose.server.yml is missing."

# Add only missing AI keys; never replace values already configured by the installer.
ensure_env_key "AI_ENGINE_ENABLED" "true"
ensure_env_key "AI_ENGINE_URL" "http://hse-ai-engine:11434"
ensure_env_key "AI_DEFAULT_CHAT_MODEL" "qwen2.5:1.7b"
ensure_env_key "AI_DEFAULT_EMBED_MODEL" "bge-m3"
ensure_env_key "OLLAMA_IMAGE" "ollama/ollama:0.40.13"
ensure_env_key "AI_BIND_IP" "127.0.0.1"
ensure_env_key "AI_HOST_PORT" "11434"

AI_ENABLED="$(get_env_value AI_ENGINE_ENABLED | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]\"')"
if [[ "${AI_ENABLED}" != "true" ]]; then
  if [[ -t 0 ]]; then
    read -r -p "Local AI is disabled. Enable it now and start the optional runtime? [y/N]: " enable_ai
    if [[ "${enable_ai}" =~ ^[Yy]$ ]]; then
      if grep -q "^AI_ENGINE_ENABLED=" "${ENV_FILE}"; then
        sed -i "s|^AI_ENGINE_ENABLED=.*|AI_ENGINE_ENABLED=true|" "${ENV_FILE}"
      else
        echo "AI_ENGINE_ENABLED=true" >> "${ENV_FILE}"
      fi
      AI_ENABLED="true"
    else
      echo "Local AI setup cancelled; the existing disabled setting was preserved."
      exit 0
    fi
  else
    fail "AI_ENGINE_ENABLED is false. Enable it explicitly in the AI management menu or .env before non-interactive setup."
  fi
fi
PRIMARY_CHAT_MODEL="$(get_env_value AI_DEFAULT_CHAT_MODEL)"
PRIMARY_EMBED_MODEL="$(get_env_value AI_DEFAULT_EMBED_MODEL)"
PRIMARY_CHAT_MODEL="${PRIMARY_CHAT_MODEL:-qwen2.5:1.7b}"
PRIMARY_EMBED_MODEL="${PRIMARY_EMBED_MODEL:-bge-m3}"

# Resource and disk preflight.
TOTAL_RAM_MB="$(free -m | awk '/^Mem:/ {print $2}')"
CPU_CORES="$(nproc)"
FREE_DISK_GB="$(df -BG "${PROJECT_DIR}" | awk 'NR==2 {gsub(/G/,"",$4); print $4}')"
echo "Host vCPUs : ${CPU_CORES}"
echo "Host RAM   : ${TOTAL_RAM_MB} MB"
echo "Free disk  : ${FREE_DISK_GB} GB"
[[ "${FREE_DISK_GB}" =~ ^[0-9]+$ ]] || fail "Could not determine available disk space."
(( FREE_DISK_GB >= 3 )) || fail "At least 3GB free disk space is required for the runtime image."

docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" config --quiet

# Do not silently take over a container created from another Compose file.
EXISTING_ID="$(docker ps -aq --filter "name=^/${CONTAINER_NAME}$" | head -n1 || true)"
if [[ -n "${EXISTING_ID}" ]]; then
  EXISTING_CONFIG="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "${EXISTING_ID}" 2>/dev/null || true)"
  [[ "${EXISTING_CONFIG}" == *"docker-compose.server.yml"* ]] || fail "Existing ${CONTAINER_NAME} belongs to another Compose configuration (${EXISTING_CONFIG:-unknown}). No container was changed; perform a planned migration with rollback."
fi

echo -e "\n${BOLD}[1/3] Starting only the Local AI Engine service...${NC}"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --no-deps hse-ai-engine

echo -e "\n${BOLD}[2/3] Waiting for Ollama health...${NC}"
attempts=0
until docker exec "${CONTAINER_NAME}" ollama list >/dev/null 2>&1 || (( attempts >= 60 )); do
  sleep 1
  attempts=$((attempts + 1))
  printf "."
done
echo
(( attempts < 60 )) || fail "Ollama did not become ready within 60 seconds. Inspect docker logs ${CONTAINER_NAME}."

# Port 11434 must never be published on a non-loopback interface.
EXPOSED_WAN="$(docker port "${CONTAINER_NAME}" 11434 2>/dev/null | grep -v '127\.0\.0\.1' || true)"
[[ -z "${EXPOSED_WAN}" ]] || fail "Ollama is exposed beyond loopback: ${EXPOSED_WAN}. Correct AI_BIND_IP before continuing."
echo -e "${GREEN}[✓] Ollama is running and its host binding is loopback-only (or internal-only).${NC}"

echo -e "\n${BOLD}[3/3] Checking configured models (no downloads are performed)...${NC}"
MODEL_LIST="$(docker exec "${CONTAINER_NAME}" ollama list)"
if printf '%s\n' "${MODEL_LIST}" | awk 'NR > 1 {print $1}' | grep -Fxq "${PRIMARY_CHAT_MODEL}"; then
  echo -e "${GREEN}[✓] Chat model is installed: ${PRIMARY_CHAT_MODEL}${NC}"
  echo -e "${CYAN}Running a short inference check...${NC}"
  TEST_PROMPT="لطفاً در یک جمله کاربرد سامانه HSECORE را توضیح بده."
  TEST_OUTPUT="$(docker exec "${CONTAINER_NAME}" ollama run "${PRIMARY_CHAT_MODEL}" "${TEST_PROMPT}" 2>&1)" || fail "Inference test failed for ${PRIMARY_CHAT_MODEL}: ${TEST_OUTPUT}"
  echo -e "Inference response: ${TEST_OUTPUT:0:200}"
else
  echo -e "${YELLOW}[NOTE] Chat model is not installed: ${PRIMARY_CHAT_MODEL}. Use the AI model-management menu to pull an allowlisted model.${NC}"
fi

if printf '%s\n' "${MODEL_LIST}" | awk 'NR > 1 {print $1}' | grep -Fxq "${PRIMARY_EMBED_MODEL}"; then
  echo -e "${GREEN}[✓] Embedding model is installed: ${PRIMARY_EMBED_MODEL}${NC}"
else
  echo -e "${YELLOW}[NOTE] Embedding model is not installed: ${PRIMARY_EMBED_MODEL}. Install it explicitly when RAG is enabled.${NC}"
fi

echo -e "\n${BOLD}${GREEN}Local AI runtime verification completed.${NC}"
echo "Container : ${CONTAINER_NAME}"
echo "Chat model: ${PRIMARY_CHAT_MODEL} (not downloaded or changed by this script)"
echo "Embed model: ${PRIMARY_EMBED_MODEL} (not downloaded or changed by this script)"
echo -e "${YELLOW}No model was downloaded, no existing model was deleted, and AI_ENGINE_ENABLED was not overwritten.${NC}"
