#!/usr/bin/env bash
# ==============================================================================
# HSECORE Enterprise - Local AI Infrastructure Management Tool
# Manage, inspect, pull, test, and benchmark offline LLMs within Docker
# ==============================================================================

set -eo pipefail

CONTAINER_NAME="hse-ai-engine"
NETWORK_NAME="hse-network"
COMPOSE_FILE="docker-compose.server.yml"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

cd "${PROJECT_DIR}"

print_header() {
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
  echo -e " ${BOLD}${BLUE}HSECORE Enterprise${NC} ${BOLD}${GREEN}Local AI Infrastructure Manager${NC}"
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
}

check_docker() {
  if ! command -v docker &>/dev/null; then
    echo -e "${RED}[ERROR] Docker is not installed on this system.${NC}"
    exit 1
  fi
}

get_ai_container_id() {
  docker ps -q -f "name=^/${CONTAINER_NAME}$" 2>/dev/null || true
}

is_container_running() {
  local cid
  cid="$(get_ai_container_id)"
  [[ -n "${cid}" ]]
}

cmd_status() {
  print_header
  echo -e "${BOLD}1. Docker Container Status:${NC}"
  if is_container_running; then
    echo -e "  Container : ${GREEN}${CONTAINER_NAME} (RUNNING)${NC}"
    local status_line
    status_line="$(docker ps --filter "name=^/${CONTAINER_NAME}$" --format "table {{.Status}}\t{{.Ports}}")"
    echo -e "  ${status_line}"
    
    echo ""
    echo -e "${BOLD}2. Resource Usage (Real-time):${NC}"
    docker stats "${CONTAINER_NAME}" --no-stream --format "  CPU: {{.CPUPerc}} | RAM: {{.MemUsage}} ({{.MemPerc}}) | Net: {{.NetIO}}"
    
    echo ""
    echo -e "${BOLD}3. Healthcheck & Model Engine API:${NC}"
    if docker exec "${CONTAINER_NAME}" ollama list >/dev/null 2>&1; then
      echo -e "  Internal Engine : ${GREEN}HEALTHY (Ollama responding internally)${NC}"
    else
      echo -e "  Internal Engine : ${RED}UNHEALTHY (Ollama daemon not responding)${NC}"
    fi

    echo ""
    echo -e "${BOLD}4. Installed Models in Persistent Storage:${NC}"
    docker exec "${CONTAINER_NAME}" ollama list 2>/dev/null || echo "  (None or failed to query)"

  else
    echo -e "  Container : ${RED}${CONTAINER_NAME} (STOPPED or NOT CREATED)${NC}"
    echo -e "  To start the engine run: ${CYAN}./scripts/manage-ai.sh start${NC}"
  fi
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
}

cmd_start() {
  print_header
  check_docker
  echo -e "${BLUE}[*] Starting HSECORE Local AI Engine container...${NC}"
  docker compose -f "${COMPOSE_FILE}" up -d hse-ai-engine
  echo -e "${BLUE}[*] Waiting for engine healthcheck...${NC}"
  local attempts=0
  until docker exec "${CONTAINER_NAME}" ollama list >/dev/null 2>&1 || [ ${attempts} -ge 15 ]; do
    sleep 1
    attempts=$((attempts + 1))
    printf "."
  done
  echo ""
  if [ ${attempts} -lt 15 ]; then
    echo -e "${GREEN}[✓] Local AI Engine is ready and running!${NC}"
  else
    echo -e "${YELLOW}[!] Engine container started but healthcheck is taking longer than usual. Check logs with ./scripts/manage-ai.sh logs${NC}"
  fi
}

cmd_stop() {
  print_header
  check_docker
  echo -e "${BLUE}[*] Stopping Local AI Engine container...${NC}"
  docker compose -f "${COMPOSE_FILE}" stop hse-ai-engine
  echo -e "${GREEN}[✓] Engine stopped cleanly.${NC}"
}

cmd_restart() {
  print_header
  check_docker
  echo -e "${BLUE}[*] Restarting Local AI Engine container...${NC}"
  docker compose -f "${COMPOSE_FILE}" restart hse-ai-engine
  echo -e "${GREEN}[✓] Engine restarted.${NC}"
}

cmd_pull() {
  local model="${1:-}" allowed chat embed
  if [[ -z "${model}" || ! "${model}" =~ ^[A-Za-z0-9._/-]+(:[A-Za-z0-9._-]+)?$ ]]; then
    echo -e "${RED}[ERROR] Invalid model reference.${NC}"
    return 1
  fi
  allowed="$(grep -E '^AI_ALLOWED_MODELS=' "${PROJECT_DIR}/.env" 2>/dev/null | tail -n1 | cut -d= -f2-)"
  chat="$(grep -E '^AI_DEFAULT_CHAT_MODEL=' "${PROJECT_DIR}/.env" 2>/dev/null | tail -n1 | cut -d= -f2-)"
  embed="$(grep -E '^AI_DEFAULT_EMBED_MODEL=' "${PROJECT_DIR}/.env" 2>/dev/null | tail -n1 | cut -d= -f2-)"
  chat="${chat:-qwen2.5:1.7b}"
  embed="${embed:-bge-m3}"
  if [[ "${model}" != "${chat}" && "${model}" != "${embed}" && "${model}" != "${chat}:latest" && "${model}" != "${embed}:latest" && ",${allowed}," != *",${model},"* ]]; then
    echo -e "${RED}[ERROR] Model is not allowlisted. Add its exact reference to AI_ALLOWED_MODELS in .env first.${NC}"
    return 1
  fi
  print_header
  check_docker
  if ! is_container_running; then cmd_start; fi
  echo -e "${BLUE}[*] Pulling explicitly allowlisted model '${model}' into persistent storage...${NC}"
  docker exec "${CONTAINER_NAME}" ollama pull "${model}"
  echo -e "${GREEN}[✓] Successfully pulled model '${model}'.${NC}"
}

cmd_list() {
  check_docker
  if ! is_container_running; then
    echo -e "${YELLOW}[!] Container is not running.${NC}"
    exit 1
  fi
  docker exec "${CONTAINER_NAME}" ollama list
}

cmd_rm() {
  local model="${1:-}" chat embed confirm
  if [[ -z "${model}" ]]; then
    echo -e "${RED}[ERROR] Model name required.${NC}"
    return 1
  fi
  chat="$(grep -E '^AI_DEFAULT_CHAT_MODEL=' "${PROJECT_DIR}/.env" 2>/dev/null | tail -n1 | cut -d= -f2-)"
  embed="$(grep -E '^AI_DEFAULT_EMBED_MODEL=' "${PROJECT_DIR}/.env" 2>/dev/null | tail -n1 | cut -d= -f2-)"
  chat="${chat:-qwen2.5:1.7b}"; embed="${embed:-bge-m3}"
  if [[ "${model}" == "${chat}" || "${model}" == "${embed}" || "${model}" == "${chat}:latest" || "${model}" == "${embed}:latest" ]]; then
    echo -e "${RED}[ERROR] Cannot delete a configured default chat/embedding model.${NC}"
    return 1
  fi
  check_docker
  if ! is_container_running; then echo -e "${YELLOW}[ERROR] AI container is not running.${NC}"; return 1; fi
  read -r -p "Type DELETE to permanently remove '${model}': " confirm
  [[ "${confirm}" == "DELETE" ]] || { echo "Cancelled."; return 0; }
  docker exec "${CONTAINER_NAME}" ollama rm "${model}"
  echo -e "${GREEN}[✓] Removed model '${model}'.${NC}"
}

cmd_bench() {
  local model="${1:-qwen2.5:1.7b}"
  print_header
  check_docker
  if ! is_container_running; then
    echo -e "${YELLOW}[*] Starting AI container first...${NC}"
    cmd_start
  fi
  echo -e "${BLUE}[*] Running inference benchmark on model '${model}'...${NC}"
  echo -e "${DIM}Prompt: تست تحلیل خطرات شغلی در کار در ارتفاع و الزامات PTW${NC}"
  echo ""
  local start_ts
  start_ts="$(date +%s)"
  docker exec "${CONTAINER_NAME}" ollama run "${model}" "در سه بند کوتاه خطرات اصلی کار در ارتفاع در پتروشیمی را نام ببر."
  local end_ts
  end_ts="$(date +%s)"
  echo ""
  echo -e "${GREEN}[✓] Benchmark completed in $((end_ts - start_ts)) seconds.${NC}"
}

cmd_embed() {
  local model="${1:-bge-m3}"
  print_header
  check_docker
  if ! is_container_running; then
    echo -e "${YELLOW}[*] Starting AI container first...${NC}"
    cmd_start
  fi
  echo -e "${BLUE}[*] Testing dense embedding generation with '${model}'...${NC}"
  docker exec "${CONTAINER_NAME}" curl -s -X POST http://127.0.0.1:11434/api/embeddings \
    -d "{\"model\": \"${model}\", \"prompt\": \"دستورالعمل صدور پروانه کار گرم در صنایع نفت و گاز\"}" | \
    head -c 200
  echo -e "\n${GREEN}[✓] Embedding vector generated successfully.${NC}"
}

cmd_sysinfo() {
  print_header
  echo -e "${BOLD}VPS Host System Hardware & AI Suitability:${NC}"
  local cpus ram_mb disk_gb
  cpus="$(nproc 2>/dev/null || echo "unknown")"
  ram_mb="$(free -m 2>/dev/null | awk '/^Mem:/ {print $2}' || echo "unknown")"
  disk_gb="$(df -h . 2>/dev/null | awk 'NR==2 {print $4}' || echo "unknown")"

  echo -e "  Available vCPUs    : ${BOLD}${cpus}${NC}"
  echo -e "  Total System RAM   : ${BOLD}${ram_mb} MB${NC}"
  echo -e "  Free Storage Space : ${BOLD}${disk_gb}${NC}"
  
  echo ""
  echo -e "${BOLD}Recommended Local AI Models for this Machine:${NC}"
  if [ "${ram_mb}" -ge 12000 ] 2>/dev/null; then
    echo -e "  ${GREEN}✓ Qwen 2.5 7B Q4_K_M${NC} (~5.0GB RAM) - High capacity & Deep HSE Reasoning"
    echo -e "  ${GREEN}✓ Qwen 2.5 3B Q4_K_M${NC} (~2.6GB RAM) - Optimal Balance"
    echo -e "  ${GREEN}✓ BGE-M3${NC} (~0.8GB RAM) - Persian RAG Vector Embeddings"
  elif [ "${ram_mb}" -ge 7000 ] 2>/dev/null; then
    echo -e "  ${GREEN}✓ Qwen 2.5 1.7B Q4_K_M${NC} (~1.5GB RAM) - ${BOLD}PRIMARY RECOMMENDED${NC} (Safe, Fast on 8GB RAM)"
    echo -e "  ${YELLOW}! Qwen 2.5 3B Q4_K_M${NC} (~2.6GB RAM) - Supported with single concurrency"
    echo -e "  ${GREEN}✓ BGE-M3${NC} (~0.8GB RAM) - Persian RAG Vector Embeddings"
  else
    echo -e "  ${YELLOW}! Qwen 2.5 0.5B Q4_K_M${NC} (~0.6GB RAM) - Minimal CPU footprint"
    echo -e "  ${YELLOW}! Low RAM detected. Run with strict concurrency limits.${NC}"
  fi
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
}

cmd_logs() {
  docker logs -f --tail 100 "${CONTAINER_NAME}"
}

cmd_set_default() {
  local model="$1"
  if [ -z "${model}" ]; then
    echo -e "${RED}[ERROR] Model name required. Example: ./scripts/manage-ai.sh set-default qwen2.5:1.7b${NC}"
    exit 1
  fi
  print_header
  echo -e "${BLUE}[*] Setting default AI chat model to '${model}' in .env...${NC}"
  if [[ -z "${model}" || ! "${model}" =~ ^[A-Za-z0-9._/-]+(:[A-Za-z0-9._-]+)?$ ]]; then
    echo -e "${RED}[ERROR] Invalid model reference.${NC}"
    return 1
  fi
  check_docker
  if ! is_container_running || ! docker exec "${CONTAINER_NAME}" ollama list | awk 'NR > 1 {print $1}' | grep -Fxq "${model}"; then
    echo -e "${RED}[ERROR] The selected model must already be installed before setting it as default.${NC}"
    return 1
  fi
  local env_file="${PROJECT_DIR}/.env"
  if [ -f "${env_file}" ]; then
    if grep -q "^AI_DEFAULT_CHAT_MODEL=" "${env_file}"; then
      sed -i "s|^AI_DEFAULT_CHAT_MODEL=.*|AI_DEFAULT_CHAT_MODEL=${model}|" "${env_file}"
    else
      echo "AI_DEFAULT_CHAT_MODEL=${model}" >> "${env_file}"
    fi
    echo -e "${GREEN}[✓] Default model updated to '${model}' in ${env_file}.${NC}"
  else
    echo -e "${YELLOW}[!] .env file not found at ${env_file}. Creating with AI_DEFAULT_CHAT_MODEL=${model}${NC}"
    echo "AI_DEFAULT_CHAT_MODEL=${model}" > "${env_file}"
  fi
}

cmd_toggle() {
  local env_file="${PROJECT_DIR}/.env"
  local current="true"
  if [ -f "${env_file}" ] && grep -q "^AI_ENGINE_ENABLED=" "${env_file}"; then
    current="$(grep "^AI_ENGINE_ENABLED=" "${env_file}" | cut -d'=' -f2 | tr -d '[:space:]')"
  fi
  local new_val="false"
  if [ "${current}" = "false" ]; then
    new_val="true"
  fi
  print_header
  echo -e "${BLUE}[*] Toggling AI_ENGINE_ENABLED from '${current}' to '${new_val}'...${NC}"
  if [ -f "${env_file}" ]; then
    if grep -q "^AI_ENGINE_ENABLED=" "${env_file}"; then
      sed -i "s/^AI_ENGINE_ENABLED=.*/AI_ENGINE_ENABLED=${new_val}/" "${env_file}"
    else
      echo "AI_ENGINE_ENABLED=${new_val}" >> "${env_file}"
    fi
  fi
  echo -e "${GREEN}[✓] AI Engine status set to: ${BOLD}${new_val}${NC}"
}

cmd_update() {
  print_header
  check_docker
  local image
  image="$(grep -E '^OLLAMA_IMAGE=' "${PROJECT_DIR}/.env" 2>/dev/null | tail -n1 | cut -d= -f2-)"
  image="${image:-ollama/ollama:0.40.13}"
  if [[ "${image}" == *":latest" ]]; then
    echo -e "${RED}[ERROR] Floating :latest image is blocked. Pin an explicit version in .env.${NC}"
    return 1
  fi
  echo -e "${BLUE}[*] Updating configured Ollama image: ${image}${NC}"
  docker compose -f "${PROJECT_DIR}/docker-compose.server.yml" pull hse-ai-engine
  docker compose -f "${PROJECT_DIR}/docker-compose.server.yml" up -d --no-deps hse-ai-engine
  echo -e "${GREEN}[✓] Configured Ollama image update completed.${NC}"
}

cmd_uninstall() {
  print_header
  check_docker
  echo -e "${RED}${BOLD}[WARNING] You are about to remove the Local AI Infrastructure container.${NC}"
  read -r -p "Do you want to proceed with stopping and removing the AI container? [y/N]: " confirm
  if ! [[ "${confirm}" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Uninstallation cancelled.${NC}"
    return 0
  fi
  echo -e "${BLUE}[*] Stopping and removing hse-ai-engine container...${NC}"
  docker compose -f "${COMPOSE_FILE}" stop hse-ai-engine 2>/dev/null || true
  docker compose -f "${COMPOSE_FILE}" rm -f hse-ai-engine 2>/dev/null || true
  read -r -p "Do you ALSO want to delete the persistent models volume (hse_ai_models)? [y/N]: " del_vol
  if [[ "${del_vol}" =~ ^[Yy]$ ]]; then
    docker volume rm hse_ai_models 2>/dev/null || true
    echo -e "${YELLOW}[✓] Persistent volume hse_ai_models deleted.${NC}"
  else
    echo -e "${GREEN}[✓] Preserved models volume hse_ai_models for future use.${NC}"
  fi
  echo -e "${GREEN}[✓] AI Infrastructure uninstallation complete.${NC}"
}

# Main Command Dispatcher
case "${1:-}" in
  status)
    cmd_status
    ;;
  start)
    cmd_start
    ;;
  stop)
    cmd_stop
    ;;
  restart)
    cmd_restart
    ;;
  pull)
    cmd_pull "${2:-}"
    ;;
  list|ls)
    cmd_list
    ;;
  rm|delete)
    cmd_rm "${2:-}"
    ;;
  bench|benchmark)
    cmd_bench "${2:-}"
    ;;
  embed|embedding)
    cmd_embed "${2:-}"
    ;;
  sysinfo|hardware)
    cmd_sysinfo
    ;;
  logs)
    cmd_logs
    ;;
  set-default)
    cmd_set_default "${2:-}"
    ;;
  toggle)
    cmd_toggle
    ;;
  update)
    cmd_update
    ;;
  uninstall)
    cmd_uninstall
    ;;
  *)
    print_header
    echo -e "Usage: ${BOLD}./scripts/manage-ai.sh <command> [args]${NC}"
    echo ""
    echo "Commands:"
    echo "  status               Show container status, memory usage, and loaded models"
    echo "  start                Start the local AI engine container"
    echo "  stop                 Stop the local AI engine container"
    echo "  restart              Restart the local AI engine container"
    echo "  pull <model>         Pull an LLM model into persistent volume (e.g. qwen2.5:1.7b)"
    echo "  list                 List all installed models in persistent volume"
    echo "  rm <model>           Remove a model from persistent storage"
    echo "  set-default <model>  Change default AI model in .env"
    echo "  toggle               Toggle AI_ENGINE_ENABLED (true/false)"
    echo "  update               Pull latest engine image and restart"
    echo "  uninstall            Stop container and optionally wipe models volume"
    echo "  bench [model]        Run CPU inference benchmark test"
    echo "  embed [model]        Test vector embedding generation"
    echo "  sysinfo              Analyze VPS hardware specs and model sizing"
    echo "  logs                 View live container logs"
    echo ""
    ;;
esac
