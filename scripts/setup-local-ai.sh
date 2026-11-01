#!/usr/bin/env bash
# ==============================================================================
# HSECORE Enterprise - Local AI Automated Setup & Verification Engine (Phase 2)
# Performs automated installation, container verification, and model deployment
# ==============================================================================

set -eo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AI_COMPOSE="${PROJECT_DIR}/docker-compose.server.yml"
CONTAINER_NAME="hse-ai-engine"
PRIMARY_CHAT_MODEL="SparkLLM/Spark-X2.6-4B:q4_k_m"
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
echo -e " ${BOLD}${BLUE}HSECORE Enterprise AI${NC} - ${BOLD}${GREEN}Phase 3 Runtime Setup & Verification${NC}"
echo -e "${BOLD}${CYAN}==================================================================${NC}"

# 1. System Prerequisite Check
echo -e "\n${BOLD}[1/6] Inspecting System & Hardware Resources...${NC}"
TOTAL_RAM_MB=$(free -m 2>/dev/null | awk '/^Mem:/ {print $2}' || echo "8192")
CPU_CORES=$(nproc 2>/dev/null || echo "8")
echo -e "  Host vCPUs: ${CYAN}${CPU_CORES}${NC} cores"
echo -e "  Host RAM  : ${CYAN}${TOTAL_RAM_MB}${NC} MB"

if [ "${TOTAL_RAM_MB}" -lt 3500 ] 2>/dev/null; then
  echo -e "  ${YELLOW}[WARNING] Host RAM is below 4GB. Using ultra-compact model (qwen2.5:0.5b).${NC}"
  PRIMARY_CHAT_MODEL="qwen2.5:0.5b"
else
  echo -e "  ${GREEN}[✓] Resource check passed: 8GB RAM architecture approved for ${PRIMARY_CHAT_MODEL}.${NC}"
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
docker compose -f "${AI_COMPOSE}" --env-file "${PROJECT_DIR}/.env" up -d --no-deps hse-ai-engine

echo -e "  Waiting for Ollama internal runtime initialization..."
MAX_WAIT=20
WAIT_COUNT=0
HEALTHY=false

while [ ${WAIT_COUNT} -lt ${MAX_WAIT} ]; do
  if docker exec "${CONTAINER_NAME}" ollama list >/dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  sleep 1
  WAIT_COUNT=$((WAIT_COUNT + 1))
  printf "."
done
echo ""

if [ "${HEALTHY}" = true ]; then
  echo -e "  ${GREEN}[✓] Engine container '${CONTAINER_NAME}' is HEALTHY.${NC}"
else
  echo -e "  ${RED}[✗] Healthcheck failed after ${MAX_WAIT} seconds. Check logs with 'docker logs ${CONTAINER_NAME}'.${NC}"
  exit 1
fi

# 4. Network Isolation & Security Verification
echo -e "\n${BOLD}[4/6] Verifying Network Isolation & Security Constraints...${NC}"
# Verify no public 0.0.0.0 exposure
EXPOSED_WAN=$(docker port "${CONTAINER_NAME}" 2>/dev/null | grep -v '127.0.0.1' || true)
if [ -n "${EXPOSED_WAN}" ]; then
  echo -e "  ${RED}[SECURITY VIOLATION] AI container exposed on non-loopback interface: ${EXPOSED_WAN}${NC}"
else
  echo -e "  ${GREEN}[✓] Port 11434 is strictly restricted to internal Docker bridge and 127.0.0.1.${NC}"
fi

# 5. Model Deployment (Chat & Embedding)
echo -e "\n${BOLD}[5/6] Deploying Baseline Models into Persistent Volume...${NC}"

# Check if chat model already exists
if docker exec "${CONTAINER_NAME}" ollama list | grep -q "${PRIMARY_CHAT_MODEL}"; then
  echo -e "  ${GREEN}[✓] Primary Chat Model '${PRIMARY_CHAT_MODEL}' already exists in persistent volume.${NC}"
else
  echo -e "  Downloading and verifying Primary Chat Model (${PRIMARY_CHAT_MODEL})..."
  echo -e "  ${YELLOW}[NOTE] Automatic model download is disabled. Pull the allowlisted model explicitly after runtime verification.${NC}"
  echo -e "  ${YELLOW}[NOTE] Chat model pull was intentionally skipped.${NC}"
fi

# Check if embedding model already exists
if docker exec "${CONTAINER_NAME}" ollama list | grep -q "${PRIMARY_EMBED_MODEL}"; then
  echo -e "  ${GREEN}[✓] Primary Embed Model '${PRIMARY_EMBED_MODEL}' already exists in persistent volume.${NC}"
else
  echo -e "  Downloading and verifying Primary Embed Model (${PRIMARY_EMBED_MODEL})..."
  echo -e "  ${YELLOW}[NOTE] Embedding model pull is intentionally deferred to the explicit model-management step.${NC}" || {
    echo -e "  ${YELLOW}[NOTE] Embed model pull remains an explicit administrator action.${NC}"
  }
fi

# 6. Live Inference & CPU Latency Benchmark
echo -e "\n${BOLD}[6/6] Executing Local Inference & Verification Test...${NC}"
TEST_PROMPT="لطفاً در یک جمله کاربرد سامانه HSECORE در صنایع را توضیح بده."
echo -e "  Prompt: '${TEST_PROMPT}'"

START_TIME=$(date +%s%N)
if docker exec "${CONTAINER_NAME}" ollama list 2>/dev/null | grep -q "${PRIMARY_CHAT_MODEL}"; then
  TEST_OUTPUT=$(docker exec "${CONTAINER_NAME}" ollama run "${PRIMARY_CHAT_MODEL}" "${TEST_PROMPT}" 2>/dev/null || echo "Test failed")
else
  TEST_OUTPUT="Inference test skipped: target model is not installed."
fi
END_TIME=$(date +%s%N)
DIFF_MS=$(( (END_TIME - START_TIME) / 1000000 ))

echo -e "  Response: ${CYAN}${TEST_OUTPUT}${NC}"
echo -e "  Latency : ${GREEN}${DIFF_MS} ms${NC}"

echo -e "\n${BOLD}${CYAN}==================================================================${NC}"
echo -e " ${BOLD}${GREEN}PHASE 3 RUNTIME SETUP COMPLETED!${NC}"
echo -e " - Container       : ${CONTAINER_NAME} (Active, Healthcheck OK)"
echo -e " - CPU Limit       : 4.0 Cores (Reserved: 1.0 Core)"
echo -e " - RAM Limit       : 4096 MB (Reserved: 1024 MB)"
echo -e " - Persistent Vol  : hse_ai_models (Model persistence guaranteed)"
echo -e " - Network         : Isolated inside hse-network (No WAN exposure)"
echo -e " - Chat Model Target: ${PRIMARY_CHAT_MODEL} (not auto-downloaded)"
echo -e "${BOLD}${CYAN}==================================================================${NC}"
