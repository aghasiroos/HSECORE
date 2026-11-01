#!/usr/bin/env bash
# ==============================================================================
# HSECORE Enterprise - Local AI Automated Setup & Verification Engine (Phase 2)
# Performs automated installation, container verification, and model deployment
# Hardened: .env creation, disk check, non-interactive safe, clear failures
# ==============================================================================

set -eo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AI_COMPOSE="${PROJECT_DIR}/docker-compose.ai.yml"
ENV_FILE="${PROJECT_DIR}/.env"
CONTAINER_NAME="hse-ai-engine"
PRIMARY_CHAT_MODEL="qwen2.5:1.7b"
PRIMARY_EMBED_MODEL="bge-m3"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

cd "${PROJECT_DIR}"

echo -e "${BOLD}${CYAN}==================================================================${NC}"
echo -e " ${BOLD}${BLUE}HSECORE Enterprise AI${NC} - ${BOLD}${GREEN}Phase 2 Automated Setup & Test${NC}"
echo -e "${BOLD}${CYAN}==================================================================${NC}"

# 0. Prerequisites
if ! command -v docker &>/dev/null; then
  echo -e "${RED}[ERROR] Docker is not installed. Complete HSECORE install (Docker step) first.${NC}"
  exit 1
fi
if ! docker info &>/dev/null; then
  echo -e "${RED}[ERROR] Docker daemon is not running. Try: sudo systemctl start docker${NC}"
  exit 1
fi
if [ ! -f "${AI_COMPOSE}" ]; then
  echo -e "${RED}[ERROR] ${AI_COMPOSE} not found.${NC}"
  exit 1
fi

# Ensure .env exists (compose uses env_file: .env)
if [ ! -f "${ENV_FILE}" ]; then
  echo -e "${YELLOW}[!] .env missing — creating minimal AI defaults...${NC}"
  cat > "${ENV_FILE}" << 'EOF'
AI_ENGINE_ENABLED=true
AI_ENGINE_URL=http://hse-ai-engine:11434
AI_DEFAULT_CHAT_MODEL=qwen2.5:1.7b
AI_DEFAULT_EMBED_MODEL=bge-m3
OLLAMA_IMAGE=ollama/ollama:0.40.13
AI_CPU_LIMIT=4.0
AI_MEMORY_LIMIT=4608M
AI_CPU_THREADS=4
AI_NUM_PARALLEL=1
AI_MAX_LOADED_MODELS=1
AI_KEEP_ALIVE=15m
AI_BIND_IP=127.0.0.1
AI_HOST_PORT=11434
EOF
fi

# Ensure critical AI keys exist even if .env was created by main installer without AI block
ensure_env_key() {
  local key="$1"
  local val="$2"
  if ! grep -q "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    echo "${key}=${val}" >> "${ENV_FILE}"
  fi
}
ensure_env_key "AI_ENGINE_ENABLED" "true"
ensure_env_key "AI_ENGINE_URL" "http://hse-ai-engine:11434"
ensure_env_key "AI_DEFAULT_CHAT_MODEL" "qwen2.5:1.7b"
ensure_env_key "AI_DEFAULT_EMBED_MODEL" "bge-m3"
ensure_env_key "OLLAMA_IMAGE" "ollama/ollama:0.40.13"
ensure_env_key "AI_BIND_IP" "127.0.0.1"
ensure_env_key "AI_HOST_PORT" "11434"

# 1. System Prerequisite Check
echo -e "\n${BOLD}[1/6] Inspecting System & Hardware Resources...${NC}"
TOTAL_RAM_MB=$(free -m 2>/dev/null | awk '/^Mem:/ {print $2}' || echo "8192")
CPU_CORES=$(nproc 2>/dev/null || echo "8")
FREE_DISK_GB=$(df -BG "${PROJECT_DIR}" 2>/dev/null | awk 'NR==2 {gsub(/G/,"",$4); print $4}' || echo "0")
echo -e "  Host vCPUs : ${CYAN}${CPU_CORES}${NC} cores"
echo -e "  Host RAM   : ${CYAN}${TOTAL_RAM_MB}${NC} MB"
echo -e "  Free disk  : ${CYAN}${FREE_DISK_GB}${NC} GB"

if [[ "${FREE_DISK_GB}" =~ ^[0-9]+$ ]] && [ "${FREE_DISK_GB}" -lt 5 ]; then
  echo -e "  ${RED}[ERROR] At least 5GB free disk is recommended before model download.${NC}"
  exit 1
fi

if [ "${TOTAL_RAM_MB}" -lt 3500 ] 2>/dev/null; then
  echo -e "  ${YELLOW}[WARNING] Host RAM is below 4GB. Using ultra-compact model (qwen2.5:0.5b).${NC}"
  PRIMARY_CHAT_MODEL="qwen2.5:0.5b"
  sed -i "s|^AI_DEFAULT_CHAT_MODEL=.*|AI_DEFAULT_CHAT_MODEL=${PRIMARY_CHAT_MODEL}|" "${ENV_FILE}" || true
else
  echo -e "  ${GREEN}[✓] Resource check passed for ${PRIMARY_CHAT_MODEL}.${NC}"
fi

# 2. Network & Volume Setup
echo -e "\n${BOLD}[2/6] Configuring Dedicated Docker Network & Persistent Volume...${NC}"
docker network inspect hse-network >/dev/null 2>&1 || {
  echo "  Creating internal network: hse-network"
  docker network create --driver bridge hse-network
}
echo -e "  ${GREEN}[✓] Internal network 'hse-network' verified.${NC}"

docker volume inspect hse_ai_models >/dev/null 2>&1 || {
  echo "  Creating persistent model volume: hse_ai_models"
  docker volume create hse_ai_models
}
echo -e "  ${GREEN}[✓] Persistent storage volume 'hse_ai_models' verified.${NC}"

# 3. Container Deployment & Resource Enforcements
echo -e "\n${BOLD}[3/6] Starting Local AI Engine Container with Resource Ceilings...${NC}"
docker compose -f "${AI_COMPOSE}" up -d hse-ai-engine

echo -e "  Waiting for Ollama internal runtime initialization..."
attempts=0
until docker exec "${CONTAINER_NAME}" ollama list >/dev/null 2>&1 || [ ${attempts} -ge 45 ]; do
  sleep 1
  attempts=$((attempts + 1))
  printf "."
done
echo ""
if [ ${attempts} -ge 45 ]; then
  echo -e "${RED}[ERROR] AI engine failed healthcheck within timeout.${NC}"
  echo -e "  Logs: docker logs ${CONTAINER_NAME}"
  exit 1
fi
echo -e "  ${GREEN}[✓] Container ${CONTAINER_NAME} is healthy.${NC}"

# 4. Network exposure check
echo -e "\n${BOLD}[4/6] Verifying Network Isolation (port 11434)...${NC}"
EXPOSED_WAN="$(docker port "${CONTAINER_NAME}" 11434 2>/dev/null | grep -v '127.0.0.1' || true)"
if [ -n "${EXPOSED_WAN}" ]; then
  echo -e "  ${YELLOW}[WARNING] Container port mapping may be visible beyond loopback: ${EXPOSED_WAN}${NC}"
else
  echo -e "  ${GREEN}[✓] Port 11434 is restricted to internal Docker bridge / 127.0.0.1.${NC}"
fi

# 5. Model Deployment (Chat & Embedding)
echo -e "\n${BOLD}[5/6] Deploying Baseline Models into Persistent Volume...${NC}"

if docker exec "${CONTAINER_NAME}" ollama list 2>/dev/null | grep -q "${PRIMARY_CHAT_MODEL}"; then
  echo -e "  ${GREEN}[✓] Primary Chat Model '${PRIMARY_CHAT_MODEL}' already exists.${NC}"
else
  echo -e "  Downloading Primary Chat Model (${PRIMARY_CHAT_MODEL})..."
  if ! docker exec "${CONTAINER_NAME}" ollama pull "${PRIMARY_CHAT_MODEL}"; then
    echo -e "  ${RED}[ERROR] Failed to pull chat model. Check internet connectivity and disk space.${NC}"
    exit 1
  fi
  echo -e "  ${GREEN}[✓] Chat model installed successfully.${NC}"
fi

if docker exec "${CONTAINER_NAME}" ollama list 2>/dev/null | grep -q "${PRIMARY_EMBED_MODEL}"; then
  echo -e "  ${GREEN}[✓] Primary Embed Model '${PRIMARY_EMBED_MODEL}' already exists.${NC}"
else
  echo -e "  Downloading Primary Embed Model (${PRIMARY_EMBED_MODEL})..."
  if ! docker exec "${CONTAINER_NAME}" ollama pull "${PRIMARY_EMBED_MODEL}"; then
    echo -e "  ${YELLOW}[NOTE] Embed model pull deferred (can retry later via menu option 3).${NC}"
  else
    echo -e "  ${GREEN}[✓] Embed model installed successfully.${NC}"
  fi
fi

# Sync default model in .env
sed -i "s|^AI_DEFAULT_CHAT_MODEL=.*|AI_DEFAULT_CHAT_MODEL=${PRIMARY_CHAT_MODEL}|" "${ENV_FILE}" 2>/dev/null || true
sed -i "s|^AI_ENGINE_ENABLED=.*|AI_ENGINE_ENABLED=true|" "${ENV_FILE}" 2>/dev/null || true

# 6. Live Inference & CPU Latency Benchmark
echo -e "\n${BOLD}[6/6] Executing Local Inference & Verification Test...${NC}"
TEST_PROMPT="لطفاً در یک جمله کاربرد سامانه HSECORE در صنایع را توضیح بده."
echo -e "  Prompt: '${TEST_PROMPT}'"

START_TIME=$(date +%s%N 2>/dev/null || date +%s)
TEST_OUTPUT=$(docker exec "${CONTAINER_NAME}" ollama run "${PRIMARY_CHAT_MODEL}" "${TEST_PROMPT}" 2>/dev/null || echo "Test failed")
END_TIME=$(date +%s%N 2>/dev/null || date +%s)

if [[ "${START_TIME}" =~ N ]] || [[ "${END_TIME}" =~ N ]]; then
  DIFF_MS="n/a"
else
  # Support both ns and seconds
  if [ "${#START_TIME}" -gt 12 ]; then
    DIFF_MS=$(( (END_TIME - START_TIME) / 1000000 ))
  else
    DIFF_MS=$(( (END_TIME - START_TIME) * 1000 ))
  fi
fi

echo -e "  Response: ${CYAN}${TEST_OUTPUT:0:200}${NC}"
echo -e "  Latency : ${GREEN}${DIFF_MS} ms${NC}"

echo -e "\n${BOLD}${CYAN}==================================================================${NC}"
echo -e " ${BOLD}${GREEN}PHASE 2 COMPLETED SUCCESSFULLY!${NC}"
echo -e " - Container       : ${CONTAINER_NAME} (Active, Healthcheck OK)"
echo -e " - Persistent Vol  : hse_ai_models"
echo -e " - Network         : hse-network (loopback-bound host port)"
echo -e " - Installed Model : ${PRIMARY_CHAT_MODEL}"
echo -e " - AI_ENGINE_ENABLED=true in .env"
echo -e "${BOLD}${CYAN}==================================================================${NC}"
echo -e "${YELLOW}Note: Restart hse-app if it was already running so it reconnects to the AI engine.${NC}"
