#!/usr/bin/env bash
# HSECORE Local AI runtime verification.
# The main installer owns the application environment; this script never
# overwrites credentials, downloads models, or changes the configured model.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.server.yml"
ENV_FILE="${PROJECT_DIR}/.env"
CONTAINER_NAME="hse-ai-engine"
APP_CONTAINER_NAME="hse-enterprise-app"
source "${PROJECT_DIR}/scripts/ai-resource-budget.sh"

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
ensure_env_key "AI_ENGINE_ENABLED" "false"
ensure_env_key "AI_ENGINE_URL" "http://hse-ai-engine:11434"
ensure_env_key "OLLAMA_IMAGE" "ollama/ollama:0.40.13"
ensure_env_key "AI_BIND_IP" "127.0.0.1"
ensure_env_key "AI_HOST_PORT" "11434"
# The shared resource-budget helper initializes automatic context defaults safely.
ensure_env_key "AI_NUM_PARALLEL" "1"
ensure_env_key "AI_MAX_LOADED_MODELS" "1"
ensure_env_key "AI_KEEP_ALIVE" "5m"

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
apply_ai_resource_budget "${ENV_FILE}"

PRIMARY_CHAT_MODEL="$(get_env_value AI_DEFAULT_CHAT_MODEL)"
PRIMARY_EMBED_MODEL="$(get_env_value AI_DEFAULT_EMBED_MODEL)"

# Resource and disk preflight.
TOTAL_RAM_MB="$(free -m | awk '/^Mem:/ {print $2}')"
CPU_CORES="$(nproc)"
FREE_DISK_GB="$(df -BG "${PROJECT_DIR}" | awk 'NR==2 {gsub(/G/,"",$4); print $4}')"
SWAP_MB="$(free -m | awk '/^Swap:/ {print $2}' || echo 0)"
echo "Host vCPUs : ${CPU_CORES}"
echo "Host RAM   : ${TOTAL_RAM_MB} MB"
echo "Host Swap  : ${SWAP_MB} MB"
echo "Free disk  : ${FREE_DISK_GB} GB"
[[ "${FREE_DISK_GB}" =~ ^[0-9]+$ ]] || fail "Could not determine available disk space."
(( FREE_DISK_GB >= 3 )) || fail "At least 3GB free disk space is required for the runtime image."

# The shared resource-budget helper above is the sole source of automatic sizing.
# Do not recalculate or overwrite a manually configured memory ceiling here.

if (( SWAP_MB < 2048 )); then
  echo -e "${YELLOW}[NOTE] Host swap is low or zero (${SWAP_MB} MB). To prevent sudden kernel OOM kills on big models, consider running: sudo ./scripts/manage-ai.sh swap${NC}"
fi

docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" config --quiet

# Do not silently take over a container created from another Compose file.
EXISTING_ID="$(docker ps -aq --filter "name=^/${CONTAINER_NAME}$" | head -n1 || true)"
if [[ -n "${EXISTING_ID}" ]]; then
  EXISTING_CONFIG="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "${EXISTING_ID}" 2>/dev/null || true)"
  [[ "${EXISTING_CONFIG}" == *"docker-compose.server.yml"* ]] || fail "Existing ${CONTAINER_NAME} belongs to another Compose configuration (${EXISTING_CONFIG:-unknown}). No container was changed; perform a planned migration with rollback."
fi

# The running application must be recreated from this Compose project so it
# receives the updated AI_ENGINE_ENABLED / AI_ENGINE_URL environment.
APP_ID="$(docker ps -q --filter "name=^/${APP_CONTAINER_NAME}$" | head -n1 || true)"
[[ -n "${APP_ID}" ]] || fail "The HSECORE app container is not running. Start/repair the main application before enabling Local AI."
APP_CONFIG="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "${APP_ID}" 2>/dev/null || true)"
[[ "${APP_CONFIG}" == *"docker-compose.server.yml"* ]] || fail "Existing ${APP_CONTAINER_NAME} belongs to another Compose configuration (${APP_CONFIG:-unknown}). No application container was changed."

echo -e "\n${BOLD}[1/4] Starting only the Local AI Engine service...${NC}"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --no-deps hse-ai-engine

echo -e "\n${BOLD}[2/4] Waiting for Ollama health...${NC}"
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

echo -e "\n${BOLD}[3/4] Checking configured models (no downloads are performed)...${NC}"
MODEL_LIST="$(docker exec "${CONTAINER_NAME}" ollama list)"
if [[ -n "${PRIMARY_CHAT_MODEL}" ]]; then
  if printf '%s\n' "${MODEL_LIST}" | awk 'NR > 1 {print $1}' | grep -Fxq "${PRIMARY_CHAT_MODEL}"; then
    echo -e "${GREEN}[✓] Configured chat model is installed: ${PRIMARY_CHAT_MODEL}${NC}"
    echo -e "${CYAN}Running a short inference check...${NC}"
    TEST_PROMPT="لطفاً در یک جمله کاربرد سامانه HSECORE را توضیح بده."
    TEST_OUTPUT="$(docker exec "${CONTAINER_NAME}" ollama run "${PRIMARY_CHAT_MODEL}" "${TEST_PROMPT}" 2>&1)" || fail "Inference test failed for ${PRIMARY_CHAT_MODEL}: ${TEST_OUTPUT}"
    echo -e "Inference response: ${TEST_OUTPUT:0:200}"
  else
    fail "Configured chat model is not installed: ${PRIMARY_CHAT_MODEL}. Install/select any supported model through HSECORE AI Model Management. No model was downloaded or changed."
  fi
else
  echo -e "${YELLOW}[NOTE] No default chat model is configured. Select or install any supported model in HSECORE AI Model Management; model verification is skipped.${NC}"
fi

if [[ -n "${PRIMARY_EMBED_MODEL}" ]]; then
  if printf '%s\n' "${MODEL_LIST}" | awk 'NR > 1 {print $1}' | grep -Fxq "${PRIMARY_EMBED_MODEL}"; then
    echo -e "${GREEN}[✓] Configured embedding model is installed: ${PRIMARY_EMBED_MODEL}${NC}"
  else
    echo -e "${YELLOW}[NOTE] Configured embedding model is not installed: ${PRIMARY_EMBED_MODEL}. Install/select it explicitly when RAG is enabled.${NC}"
  fi
else
  echo -e "${YELLOW}[NOTE] No default embedding model is configured; select one only when required by the chosen RAG workflow.${NC}"
fi

echo -e "\n${BOLD}[4/4] Applying AI settings to the HSECORE application... ${NC}"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --no-deps hse-app

APP_ENABLED="$(docker exec "${APP_CONTAINER_NAME}" printenv AI_ENGINE_ENABLED 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]\"' || true)"
[[ "${APP_ENABLED}" == "true" ]] || fail "HSECORE app did not receive AI_ENGINE_ENABLED=true. Inspect its Compose environment before retrying."

# Verify the app container can reach the exact Ollama endpoint configured for it.
docker exec "${APP_CONTAINER_NAME}" node -e '
const base = (process.env.AI_ENGINE_URL || "").replace(/\/$/, "");
if (!base) throw new Error("AI_ENGINE_URL is empty");
fetch(base + "/api/tags", { signal: AbortSignal.timeout(8000) })
  .then(async response => {
    if (!response.ok) throw new Error("Ollama returned HTTP " + response.status);
    const payload = await response.json();
    const models = Array.isArray(payload.models) ? payload.models : [];
    console.log("HSECORE-to-Ollama connection: OK");
    console.log("Installed models visible to HSECORE: " + models.length);
    for (const model of models) console.log(" - " + (model.name || model.model || "unknown"));
  })
  .catch(error => { console.error("HSECORE-to-Ollama connection failed: " + error.message); process.exit(1); });
' || fail "The HSECORE application cannot reach Ollama. Check AI_ENGINE_URL and the shared Docker network."

# Verify real inference from inside the HSECORE app container, not only from
# inside the Ollama container. This catches wrong model tags and app-network issues.
if [[ -n "${PRIMARY_CHAT_MODEL}" ]]; then
  docker exec "${APP_CONTAINER_NAME}" node -e '
  const base = (process.env.AI_ENGINE_URL || "").replace(/\/$/, "");
  const model = (process.env.AI_DEFAULT_CHAT_MODEL || "").trim();
  if (!base || !model) throw new Error("Configured chat model or AI_ENGINE_URL is empty");
  fetch(base + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with the single word OK." }],
      stream: false,
      options: { num_predict: 8, num_ctx: 1024, temperature: 0 }
    }),
    signal: AbortSignal.timeout(120000)
  }).then(async response => {
    if (!response.ok) throw new Error("Ollama chat returned HTTP " + response.status + ": " + (await response.text()));
    const payload = await response.json();
    const answer = payload?.message?.content?.trim();
    if (!answer) throw new Error("Ollama returned an empty chat response");
    console.log("HSECORE app-to-Ollama inference: OK");
    console.log("Model: " + (payload.model || model));
    console.log("Test response: " + answer.slice(0, 120));
  }).catch(error => { console.error("HSECORE app-to-Ollama inference failed: " + error.message); process.exit(1); });
  ' || fail "Ollama is reachable but real inference from HSECORE failed. Check selected model availability, RAM/swap, and Ollama logs."
else
  echo -e "${YELLOW}[NOTE] No chat model selected; application connectivity was verified, while inference awaits an explicit model selection.${NC}"
fi

echo -e "\n${BOLD}${GREEN}Local AI runtime verification completed.${NC}"
echo "Container : ${CONTAINER_NAME}"
echo "Application: ${APP_CONTAINER_NAME} (recreated to apply AI settings)"
echo "Chat model: ${PRIMARY_CHAT_MODEL:-not selected}"
echo "Embed model: ${PRIMARY_EMBED_MODEL:-not selected}"
echo -e "${YELLOW}No model was downloaded or deleted. Existing model data and volumes were preserved.${NC}"
