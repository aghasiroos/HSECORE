#!/usr/bin/env bash
# ==============================================================================
# HSECORE Enterprise - Local AI Infrastructure Management Tool
# Manage, inspect, pull, test, and benchmark offline LLMs within Docker
# Hardened for Ubuntu VPS install via install.sh (no-TTY safe, .env aware)
# ==============================================================================

set -eo pipefail

CONTAINER_NAME="hse-ai-engine"
NETWORK_NAME="hse-network"
COMPOSE_FILE="docker-compose.ai.yml"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"

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
    echo -e "${YELLOW}Run: sudo ./install.sh  (or complete Docker installation first)${NC}"
    exit 1
  fi
  if ! docker info &>/dev/null; then
    echo -e "${RED}[ERROR] Docker daemon is not running or not accessible.${NC}"
    echo -e "${YELLOW}Try: sudo systemctl start docker${NC}"
    exit 1
  fi
}

ensure_env_file() {
  if [ ! -f "${ENV_FILE}" ]; then
    echo -e "${YELLOW}[!] .env not found. Creating minimal AI-related .env...${NC}"
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
    echo -e "${GREEN}[✓] Created ${ENV_FILE} with AI defaults.${NC}"
  fi
}

ensure_compose_file() {
  if [ ! -f "${PROJECT_DIR}/${COMPOSE_FILE}" ]; then
    echo -e "${RED}[ERROR] ${COMPOSE_FILE} not found in ${PROJECT_DIR}${NC}"
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

disk_free_gb() {
  df -BG "${PROJECT_DIR}" 2>/dev/null | awk 'NR==2 {gsub(/G/,"",$4); print $4}' || echo "0"
}

cmd_status() {
  print_header
  check_docker
  echo -e "${BOLD}1. Docker Container Status:${NC}"
  if is_container_running; then
    echo -e "  Container : ${GREEN}${CONTAINER_NAME} (RUNNING)${NC}"
    local status_line
    status_line="$(docker ps --filter "name=^/${CONTAINER_NAME}$" --format "table {{.Status}}\t{{.Ports}}")"
    echo -e "  ${status_line}"

    echo ""
    echo -e "${BOLD}2. Resource Usage (Real-time):${NC}"
    docker stats "${CONTAINER_NAME}" --no-stream --format "  CPU: {{.CPUPerc}} | RAM: {{.MemUsage}} ({{.MemPerc}}) | Net: {{.NetIO}}" || true

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
  ensure_env_file
  ensure_compose_file
  echo -e "${BLUE}[*] Starting HSECORE Local AI Engine container...${NC}"
  docker compose -f "${COMPOSE_FILE}" up -d hse-ai-engine
  echo -e "${BLUE}[*] Waiting for engine healthcheck...${NC}"
  local attempts=0
  until docker exec "${CONTAINER_NAME}" ollama list >/dev/null 2>&1 || [ ${attempts} -ge 30 ]; do
    sleep 1
    attempts=$((attempts + 1))
    printf "."
  done
  echo ""
  if [ ${attempts} -lt 30 ]; then
    echo -e "${GREEN}[✓] Local AI Engine is ready and running!${NC}"
  else
    echo -e "${YELLOW}[!] Engine container started but healthcheck is taking longer than usual.${NC}"
    echo -e "    Check logs with: ${CYAN}./scripts/manage-ai.sh logs${NC}"
  fi
}

cmd_stop() {
  print_header
  check_docker
  echo -e "${BLUE}[*] Stopping Local AI Engine container...${NC}"
  docker compose -f "${COMPOSE_FILE}" stop hse-ai-engine 2>/dev/null || docker stop "${CONTAINER_NAME}" 2>/dev/null || true
  echo -e "${GREEN}[✓] Engine stopped cleanly.${NC}"
}

cmd_restart() {
  print_header
  check_docker
  ensure_env_file
  ensure_compose_file
  echo -e "${BLUE}[*] Restarting Local AI Engine container...${NC}"
  docker compose -f "${COMPOSE_FILE}" restart hse-ai-engine 2>/dev/null || {
    docker compose -f "${COMPOSE_FILE}" up -d hse-ai-engine
  }
  echo -e "${GREEN}[✓] Engine restarted.${NC}"
}

cmd_pull() {
  local model="$1"
  if [ -z "${model}" ]; then
    echo -e "${RED}[ERROR] Model name required. Example: ./scripts/manage-ai.sh pull qwen2.5:1.7b${NC}"
    exit 1
  fi
  print_header
  check_docker
  ensure_env_file
  ensure_compose_file

  local free_gb
  free_gb="$(disk_free_gb)"
  if [[ "${free_gb}" =~ ^[0-9]+$ ]] && [ "${free_gb}" -lt 3 ]; then
    echo -e "${RED}[ERROR] Less than 3GB free disk space (detected: ${free_gb}GB). Aborting model pull.${NC}"
    exit 1
  fi
  echo -e "  Free disk space: ${CYAN}${free_gb}GB${NC}"

  if ! is_container_running; then
    echo -e "${YELLOW}[*] Engine container not running. Starting it now...${NC}"
    cmd_start
  fi
  echo -e "${BLUE}[*] Pulling model '${model}' into persistent storage (hse_ai_models)...${NC}"
  # No -t flag: safe for non-interactive SSH / install.sh menus
  docker exec "${CONTAINER_NAME}" ollama pull "${model}"
  echo -e "${GREEN}[✓] Successfully pulled model '${model}'.${NC}"
}

cmd_list() {
  check_docker
  if ! is_container_running; then
    echo -e "${YELLOW}[!] Container is not running. Starting it to list models...${NC}"
    cmd_start
  fi
  docker exec "${CONTAINER_NAME}" ollama list
}

cmd_rm() {
  local model="$1"
  if [ -z "${model}" ]; then
    echo -e "${RED}[ERROR] Model name required. Example: ./scripts/manage-ai.sh rm qwen2.5:1.7b${NC}"
    exit 1
  fi
  check_docker
  if ! is_container_running; then
    echo -e "${YELLOW}[!] Container is not running. Starting it first...${NC}"
    cmd_start
  fi
  echo -e "${YELLOW}[!] About to remove model '${model}' from persistent storage.${NC}"
  read -r -p "Confirm deletion? [y/N]: " confirm
  if ! [[ "${confirm}" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Cancelled.${NC}"
    return 0
  fi
  echo -e "${BLUE}[*] Removing model '${model}'...${NC}"
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
  local start_ts end_ts
  start_ts="$(date +%s)"
  docker exec "${CONTAINER_NAME}" ollama run "${model}" "در سه بند کوتاه خطرات اصلی کار در ارتفاع در پتروشیمی را نام ببر."
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
  docker exec "${CONTAINER_NAME}" ollama run "${model}" "test embedding" 2>/dev/null || \
    echo -e "${YELLOW}[!] Embedding test completed with warnings (model may need pull).${NC}"
}

cmd_sysinfo() {
  print_header
  echo -e "${BOLD}Host Hardware Analysis:${NC}"
  local cores ram_mb
  cores="$(nproc 2>/dev/null || echo '?')"
  ram_mb="$(free -m 2>/dev/null | awk '/^Mem:/ {print $2}' || echo '0')"
  echo -e "  vCPU cores : ${CYAN}${cores}${NC}"
  echo -e "  Total RAM  : ${CYAN}${ram_mb} MB${NC}"
  echo -e "  Free disk  : ${CYAN}$(disk_free_gb) GB${NC}"
  echo ""
  echo -e "${BOLD}Recommended models for this host:${NC}"
  if [[ "${ram_mb}" =~ ^[0-9]+$ ]] && [ "${ram_mb}" -ge 7000 ]; then
    echo -e "  ${GREEN}• Qwen 2.5 1.7B / 3B quantized${NC} — suitable for 8GB RAM class"
  elif [[ "${ram_mb}" =~ ^[0-9]+$ ]] && [ "${ram_mb}" -ge 3500 ]; then
    echo -e "  ${GREEN}• Qwen 2.5 0.5B / 1.7B Q4_K_M${NC} — tight but workable"
  else
    echo -e "  ${YELLOW}• Qwen 2.5 0.5B Q4_K_M only${NC} — low RAM; keep concurrency=1"
  fi
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
}

cmd_logs() {
  check_docker
  if ! docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
    echo -e "${RED}[ERROR] Container ${CONTAINER_NAME} does not exist. Deploy AI first (option 1).${NC}"
    exit 1
  fi
  echo -e "${DIM}Showing last 100 lines. Press Ctrl+C to return to menu.${NC}"
  docker logs -f --tail 100 "${CONTAINER_NAME}"
}

cmd_set_default() {
  local model="$1"
  if [ -z "${model}" ]; then
    echo -e "${RED}[ERROR] Model name required. Example: ./scripts/manage-ai.sh set-default qwen2.5:1.7b${NC}"
    exit 1
  fi
  print_header
  ensure_env_file
  echo -e "${BLUE}[*] Setting default AI chat model to '${model}' in .env...${NC}"
  if grep -q "^AI_DEFAULT_CHAT_MODEL=" "${ENV_FILE}"; then
    sed -i "s|^AI_DEFAULT_CHAT_MODEL=.*|AI_DEFAULT_CHAT_MODEL=${model}|" "${ENV_FILE}"
  else
    echo "AI_DEFAULT_CHAT_MODEL=${model}" >> "${ENV_FILE}"
  fi
  echo -e "${GREEN}[✓] Default model updated to '${model}' in ${ENV_FILE}.${NC}"
  echo -e "${YELLOW}[!] Restart the main app container for the change to take effect:${NC}"
  echo -e "    ${CYAN}sudo docker compose -f docker-compose.yml up -d hse-app${NC}"
  echo -e "    (or from install.sh: Update / restart services)"
}

cmd_toggle() {
  ensure_env_file
  local current="true"
  if grep -q "^AI_ENGINE_ENABLED=" "${ENV_FILE}"; then
    current="$(grep "^AI_ENGINE_ENABLED=" "${ENV_FILE}" | cut -d'=' -f2 | tr -d '[:space:]\"' | tr '[:upper:]' '[:lower:]')"
  fi
  local new_val="false"
  if [ "${current}" = "false" ]; then
    new_val="true"
  fi
  print_header
  echo -e "${BLUE}[*] Toggling AI_ENGINE_ENABLED from '${current}' to '${new_val}'...${NC}"
  if grep -q "^AI_ENGINE_ENABLED=" "${ENV_FILE}"; then
    sed -i "s|^AI_ENGINE_ENABLED=.*|AI_ENGINE_ENABLED=${new_val}|" "${ENV_FILE}"
  else
    echo "AI_ENGINE_ENABLED=${new_val}" >> "${ENV_FILE}"
  fi
  echo -e "${GREEN}[✓] AI Engine status set to: ${BOLD}${new_val}${NC}"
  echo -e "${YELLOW}[!] Restart the main app container for the change to take effect:${NC}"
  echo -e "    ${CYAN}sudo docker compose -f docker-compose.yml up -d hse-app${NC}"
}

cmd_update() {
  print_header
  check_docker
  ensure_env_file
  ensure_compose_file
  # Keep image tag aligned with compose default unless OLLAMA_IMAGE is set in .env
  local image_tag
  image_tag="$(grep -E '^OLLAMA_IMAGE=' "${ENV_FILE}" 2>/dev/null | cut -d'=' -f2- | tr -d '\"' | tr -d \"'\" || true)"
  if [ -z "${image_tag}" ]; then
    image_tag="ollama/ollama:0.40.13"
    if grep -q "^OLLAMA_IMAGE=" "${ENV_FILE}"; then
      sed -i "s|^OLLAMA_IMAGE=.*|OLLAMA_IMAGE=${image_tag}|" "${ENV_FILE}"
    else
      echo "OLLAMA_IMAGE=${image_tag}" >> "${ENV_FILE}"
    fi
  fi
  echo -e "${BLUE}[*] Updating Local AI Engine image: ${CYAN}${image_tag}${NC}"
  docker pull "${image_tag}"
  echo -e "${BLUE}[*] Recreating AI container with updated image...${NC}"
  docker compose -f "${COMPOSE_FILE}" up -d --force-recreate hse-ai-engine
  echo -e "${GREEN}[✓] Local AI Engine updated and running.${NC}"
  echo -e "${DIM}Models volume (hse_ai_models) was preserved.${NC}"
}

cmd_uninstall() {
  print_header
  check_docker
  echo -e "${RED}${BOLD}[WARNING] You are about to remove the Local AI Infrastructure container.${NC}"
  echo -e "The main HSECORE application will continue to run."
  read -r -p "Do you want to proceed with stopping and removing the AI container? [y/N]: " confirm
  if ! [[ "${confirm}" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Uninstallation cancelled.${NC}"
    return 0
  fi
  echo -e "${BLUE}[*] Stopping and removing hse-ai-engine container...${NC}"
  docker compose -f "${COMPOSE_FILE}" down 2>/dev/null || true
  docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true

  read -r -p "Do you ALSO want to delete the persistent models volume (hse_ai_models)? [y/N]: " del_vol
  if [[ "${del_vol}" =~ ^[Yy]$ ]]; then
    docker volume rm hse_ai_models 2>/dev/null || true
    echo -e "${YELLOW}[✓] Persistent volume hse_ai_models deleted.${NC}"
  else
    echo -e "${GREEN}[✓] Preserved models volume hse_ai_models for future use.${NC}"
  fi

  # Reflect disabled state in .env
  ensure_env_file
  if grep -q "^AI_ENGINE_ENABLED=" "${ENV_FILE}"; then
    sed -i "s|^AI_ENGINE_ENABLED=.*|AI_ENGINE_ENABLED=false|" "${ENV_FILE}"
  else
    echo "AI_ENGINE_ENABLED=false" >> "${ENV_FILE}"
  fi
  echo -e "${GREEN}[✓] AI Infrastructure uninstallation complete. AI_ENGINE_ENABLED=false${NC}"
  echo -e "${YELLOW}[!] Restart hse-app if it is running so it picks up AI_ENGINE_ENABLED=false.${NC}"
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
    echo "  update               Pull configured engine image and recreate container"
    echo "  uninstall            Stop container and optionally wipe models volume"
    echo "  bench [model]        Run CPU inference benchmark test"
    echo "  embed [model]        Test vector embedding generation"
    echo "  sysinfo              Analyze VPS hardware specs and model sizing"
    echo "  logs                 View live container logs (Ctrl+C to exit)"
    echo ""
    ;;
esac
