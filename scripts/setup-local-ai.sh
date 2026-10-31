#!/usr/bin/env bash
# Phase 2: provision and verify the optional Ollama runtime only.
# Model downloads and model selection remain separate operations.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AI_COMPOSE="${PROJECT_DIR}/docker-compose.ai.yml"
MIN_HOST_RAM_MB="${AI_MIN_HOST_RAM_MB:-6144}"
MIN_FREE_DISK_GB="${AI_MIN_FREE_DISK_GB:-8}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

cd "${PROJECT_DIR}"

echo -e "${BOLD}${CYAN}============================================================${NC}"
echo -e " ${BOLD}HSECORE AI — Phase 2 Local Runtime Provisioning${NC}"
echo -e "${BOLD}${CYAN}============================================================${NC}"

command -v docker >/dev/null 2>&1 || { echo -e "${RED}[ERROR] Docker CLI is not installed.${NC}" >&2; exit 1; }
docker info >/dev/null
docker compose version >/dev/null

RAM_MB="$(free -m | awk '/^Mem:/ {print $2}')"
CPU_CORES="$(nproc)"
FREE_DISK_KB="$(df -Pk "${PROJECT_DIR}" | awk 'NR==2 {print $4}')"
FREE_DISK_GB="$((FREE_DISK_KB / 1024 / 1024))"

echo "Host CPU cores : ${CPU_CORES}"
echo "Host RAM       : ${RAM_MB} MB"
echo "Free disk      : ${FREE_DISK_GB} GB"

if (( RAM_MB < MIN_HOST_RAM_MB )); then
  echo -e "${RED}[ERROR] At least ${MIN_HOST_RAM_MB} MB host RAM is required for the configured AI resource ceiling.${NC}" >&2
  exit 1
fi
if (( CPU_CORES < 4 )); then
  echo -e "${YELLOW}[WARNING] Fewer than 4 CPU cores detected; inference throughput may be limited.${NC}"
fi
echo -e "${CYAN}[1/4] Ensuring shared Docker network...${NC}"
bash "${PROJECT_DIR}/scripts/ensure-ai-network.sh"

echo -e "${CYAN}[2/4] Validating runtime Compose configuration, image cache and persistent volume...${NC}"
docker compose -f "${AI_COMPOSE}" config --quiet
IMAGE_REF="$(docker compose -f "${AI_COMPOSE}" config --images | head -n 1)"
if [[ -z "${IMAGE_REF}" || "${IMAGE_REF}" != ollama/ollama:* ]]; then
  echo -e "${RED}[ERROR] Could not resolve a pinned official Ollama image from Compose configuration.${NC}" >&2
  exit 1
fi
docker volume inspect hse_ai_models >/dev/null 2>&1 || docker volume create hse_ai_models >/dev/null

IMAGE_ALREADY_AVAILABLE=false
if docker image inspect "${IMAGE_REF}" >/dev/null 2>&1; then
  IMAGE_ALREADY_AVAILABLE=true
  echo -e "${GREEN}[✓] Runtime image ${IMAGE_REF} is already cached; no image download is needed.${NC}"
fi

# The 8GB free-space guard is required only for the first image download.
# Re-running setup must not fail merely because the already-downloaded image occupies disk.
if [[ "${IMAGE_ALREADY_AVAILABLE}" != true ]] && (( FREE_DISK_GB < MIN_FREE_DISK_GB )); then
  echo -e "${RED}[ERROR] At least ${MIN_FREE_DISK_GB} GB free disk space is required before the first Ollama image download.${NC}" >&2
  exit 1
fi

echo -e "${CYAN}[3/4] Starting the pinned Ollama runtime...${NC}"
if [[ "${IMAGE_ALREADY_AVAILABLE}" != true ]]; then
  docker compose -f "${AI_COMPOSE}" pull hse-ai-engine
fi
docker compose -f "${AI_COMPOSE}" up -d hse-ai-engine

echo -e "${CYAN}[4/4] Running runtime integration checks...${NC}"
bash "${PROJECT_DIR}/scripts/test-ai-runtime.sh"

echo -e "${BOLD}${GREEN}Phase 2 Local LLM runtime provisioning completed successfully.${NC}"
echo "Ollama API is available to HSECORE containers at http://hse-ai-engine:11434."
echo "No host port is published. No language or embedding model was downloaded."
echo "Use the separate model-management operation after completing model selection."
