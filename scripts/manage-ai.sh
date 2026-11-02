#!/usr/bin/env bash
# ==============================================================================
# HSECORE Enterprise - Local AI Infrastructure Management Tool
# Manage, inspect, pull, test, and benchmark offline LLMs within Docker
# Hardened for Ubuntu VPS install via install.sh (no-TTY safe, .env aware)
# ==============================================================================

set -eo pipefail

CONTAINER_NAME="hse-ai-engine"
NETWORK_NAME="hse-network"
COMPOSE_FILE="docker-compose.server.yml"
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
    echo -e "${RED}[ERROR] .env not found. Complete the main HSECORE installation first.${NC}" >&2
    exit 1
  fi
}
ensure_compose_file() {
  if [ ! -f "${PROJECT_DIR}/${COMPOSE_FILE}" ]; then
    echo -e "${RED}[ERROR] ${COMPOSE_FILE} not found in ${PROJECT_DIR}${NC}"
    exit 1
  fi
}

verify_container_compose_owner() {
  local cid config_files
  cid="$(docker ps -aq --filter "name=^/${CONTAINER_NAME}$" | head -n1 || true)"
  [[ -z "${cid}" ]] && return 0
  config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "${cid}" 2>/dev/null || true)"
  if [[ "${config_files}" != *"docker-compose.server.yml"* ]]; then
    echo -e "${RED}[ERROR] Existing ${CONTAINER_NAME} belongs to a different Compose configuration (${config_files:-unknown}). No container was changed; plan a separate migration with rollback.${NC}" >&2
    return 1
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
  verify_container_compose_owner || return 1
  echo -e "${BLUE}[*] Starting HSECORE Local AI Engine container...${NC}"
  docker compose -f "${PROJECT_DIR}/${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --no-deps hse-ai-engine
  echo -e "${BLUE}[*] Waiting for engine healthcheck...${NC}"
  local attempts=0
  until docker exec "${CONTAINER_NAME}" ollama list >/dev/null 2>&1 || [ ${attempts} -ge 45 ]; do
    sleep 1
    attempts=$((attempts + 1))
    printf "."
  done
  echo ""
  if [ ${attempts} -lt 45 ]; then
    echo -e "${GREEN}[✓] Local AI Engine is ready and running!${NC}"
  else
    echo -e "${RED}[ERROR] AI Engine healthcheck timed out. Inspect: docker logs ${CONTAINER_NAME}${NC}"
    return 1
  fi
}
cmd_stop() {
  print_header
  check_docker
  ensure_env_file
  ensure_compose_file
  verify_container_compose_owner || return 1
  echo -e "${BLUE}[*] Stopping Local AI Engine container...${NC}"
  docker compose -f "${PROJECT_DIR}/${COMPOSE_FILE}" --env-file "${ENV_FILE}" stop hse-ai-engine
  echo -e "${GREEN}[✓] Engine stopped cleanly.${NC}"
}

cmd_restart() {
  print_header
  check_docker
  ensure_env_file
  ensure_compose_file
  verify_container_compose_owner || return 1
  echo -e "${BLUE}[*] Restarting Local AI Engine container...${NC}"
  docker compose -f "${PROJECT_DIR}/${COMPOSE_FILE}" --env-file "${ENV_FILE}" restart hse-ai-engine
  echo -e "${GREEN}[✓] Engine restarted.${NC}"
}

is_valid_model_ref() {
  local model="${1:-}"
  [[ -n "${model}" && ${#model} -le 160 ]] || return 1
  [[ "${model}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}(/[A-Za-z0-9][A-Za-z0-9._-]{0,63}){0,2}(:[A-Za-z0-9][A-Za-z0-9._-]{0,63})?$ ]] || return 1
  [[ "${model}" != *..* ]] || return 1
  return 0
}

cmd_pull() {
  local model="${1:-}"
  if ! is_valid_model_ref "${model}"; then
    echo -e "${RED}[ERROR] Model reference is required. Use a valid Ollama model name, namespace/model, or namespace/model:tag (maximum 160 characters). ${NC}" >&2
    return 1
  fi
  print_header
  check_docker
  ensure_env_file
  ensure_compose_file
  local free_gb
  free_gb="$(disk_free_gb)"
  if [[ "${free_gb}" =~ ^[0-9]+$ ]] && [ "${free_gb}" -lt 3 ]; then
    echo -e "${RED}[ERROR] Less than 3GB free disk space (detected: ${free_gb}GB). Aborting model pull.${NC}"
    return 1
  fi
  echo -e "  Free disk space: ${CYAN}${free_gb}GB${NC}"
  if ! is_container_running; then
    echo -e "${YELLOW}[*] Engine container not running. Starting it now...${NC}"
    cmd_start || return 1
  fi
  echo -e "${BLUE}[*] Pulling model '${model}' into persistent storage (no model allowlist is applied)...${NC}"
  if ! docker exec "${CONTAINER_NAME}" ollama pull "${model}"; then
    echo -e "${RED}[ERROR] Ollama could not download '${model}'. Check the exact model name/tag and the Ollama registry response above.${NC}" >&2
    return 1
  fi
  echo -e "${GREEN}[✓] Successfully pulled model '${model}'.${NC}"
}
cmd_list() {
  check_docker
  ensure_compose_file
  verify_container_compose_owner || return 1
  if ! is_container_running; then
    echo -e "${YELLOW}[!] Container is not running. Starting it to list models...${NC}"
    cmd_start
  fi
  docker exec "${CONTAINER_NAME}" ollama list
}

cmd_rm() {
  local model="${1:-}" chat embed confirm
  if ! is_valid_model_ref "${model}"; then
    echo -e "${RED}[ERROR] Invalid model reference.${NC}" >&2
    return 1
  fi
  ensure_env_file
  chat="$(grep -E '^AI_DEFAULT_CHAT_MODEL=' "${ENV_FILE}" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '[:space:]' || true)"
  embed="$(grep -E '^AI_DEFAULT_EMBED_MODEL=' "${ENV_FILE}" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '[:space:]' || true)"
  chat="${chat:-qwen2.5:1.5b}"
  embed="${embed:-bge-m3}"
  if [[ "${model}" == "${chat}" || "${model}" == "${embed}" || "${model}" == "${chat}:latest" || "${model}" == "${embed}:latest" ]]; then
    echo -e "${RED}[ERROR] Cannot remove a configured default chat or embedding model.${NC}" >&2
    return 1
  fi
  check_docker
  if ! is_container_running; then
    echo -e "${YELLOW}[!] Container is not running. Starting it first...${NC}"
    cmd_start || return 1
  fi
  echo -e "${YELLOW}[!] About to permanently remove model '${model}'.${NC}"
  read -r -p "Type DELETE to confirm: " confirm
  [[ "${confirm}" == "DELETE" ]] || { echo -e "${BLUE}Cancelled.${NC}"; return 0; }
  docker exec "${CONTAINER_NAME}" ollama rm "${model}"
  echo -e "${GREEN}[✓] Removed model '${model}'.${NC}"
}
cmd_bench() {
  local model="${1:-}"
  if ! is_valid_model_ref "${model}"; then
    echo -e "${RED}[ERROR] Specify an installed model reference to benchmark.${NC}" >&2
    return 1
  fi
  print_header
  check_docker
  if ! is_container_running; then
    echo -e "${YELLOW}[*] Starting AI container first...${NC}"
    cmd_start || return 1
  fi
  if ! docker exec "${CONTAINER_NAME}" ollama list | awk 'NR > 1 {print $1}' | grep -Fxq "${model}"; then
    echo -e "${RED}[ERROR] Model '${model}' is not installed. Download it explicitly with: ./scripts/manage-ai.sh pull ${model}${NC}" >&2
    return 1
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
  local model="${1:-}"
  if ! is_valid_model_ref "${model}"; then
    echo -e "${RED}[ERROR] Specify an installed model reference to test embeddings.${NC}" >&2
    return 1
  fi
  print_header
  check_docker
  if ! is_container_running; then
    echo -e "${YELLOW}[*] Starting AI container first...${NC}"
    cmd_start || return 1
  fi
  if ! docker exec "${CONTAINER_NAME}" ollama list | awk 'NR > 1 {print $1}' | grep -Fxq "${model}"; then
    echo -e "${RED}[ERROR] Model '${model}' is not installed. Download it explicitly with: ./scripts/manage-ai.sh pull ${model}${NC}" >&2
    return 1
  fi
  echo -e "${BLUE}[*] Testing dense embedding generation with '${model}'...${NC}"
  docker exec "${CONTAINER_NAME}" ollama run "${model}" "test embedding"
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
    echo -e "  ${GREEN}• Qwen 2.5 1.5B / 3B quantized${NC} — suitable for 8GB RAM class"
  elif [[ "${ram_mb}" =~ ^[0-9]+$ ]] && [ "${ram_mb}" -ge 3500 ]; then
    echo -e "  ${GREEN}• Qwen 2.5 0.5B / 1.5B Q4_K_M${NC} — tight but workable"
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
  local model="${1:-}"
  if ! is_valid_model_ref "${model}"; then
    echo -e "${RED}[ERROR] Invalid model reference.${NC}" >&2
    return 1
  fi
  print_header
  check_docker
  ensure_env_file
  ensure_compose_file
  if ! is_container_running; then cmd_start || return 1; fi
  if ! docker exec "${CONTAINER_NAME}" ollama list | awk 'NR > 1 {print $1}' | grep -Fxq "${model}"; then
    echo -e "${RED}[ERROR] The selected model must already be installed before setting it as default.${NC}" >&2
    return 1
  fi
  echo -e "${BLUE}[*] Setting default AI chat model to '${model}' in .env...${NC}"
  if grep -q "^AI_DEFAULT_CHAT_MODEL=" "${ENV_FILE}"; then
    sed -i "s|^AI_DEFAULT_CHAT_MODEL=.*|AI_DEFAULT_CHAT_MODEL=${model}|" "${ENV_FILE}"
  else
    echo "AI_DEFAULT_CHAT_MODEL=${model}" >> "${ENV_FILE}"
  fi
  echo -e "${GREEN}[✓] Default model updated to '${model}' in ${ENV_FILE}.${NC}"
  echo -e "${YELLOW}[!] Restart the main app container for the change to take effect:${NC}"
  echo -e "    ${CYAN}sudo docker compose -f docker-compose.server.yml up -d --no-deps hse-app${NC}"
}
cmd_toggle() {
  check_docker
  ensure_env_file
  ensure_compose_file
  verify_container_compose_owner || return 1
  local current="false"
  if grep -q "^AI_ENGINE_ENABLED=" "${ENV_FILE}"; then
    current="$(grep "^AI_ENGINE_ENABLED=" "${ENV_FILE}" | tail -n1 | cut -d'=' -f2 | tr -d '[:space:]\"' | tr '[:upper:]' '[:lower:]')"
  fi
  local new_val="false"
  if [ "${current}" = "false" ]; then new_val="true"; fi
  print_header
  echo -e "${BLUE}[*] Toggling AI_ENGINE_ENABLED from '${current}' to '${new_val}'...${NC}"
  if grep -q "^AI_ENGINE_ENABLED=" "${ENV_FILE}"; then
    sed -i "s|^AI_ENGINE_ENABLED=.*|AI_ENGINE_ENABLED=${new_val}|" "${ENV_FILE}"
  else
    echo "AI_ENGINE_ENABLED=${new_val}" >> "${ENV_FILE}"
  fi
  if [[ "${new_val}" == "false" ]]; then
    docker compose -f "${PROJECT_DIR}/${COMPOSE_FILE}" --env-file "${ENV_FILE}" stop hse-ai-engine
  else
    cmd_start || return 1
  fi
  echo -e "${GREEN}[✓] AI Engine status set to: ${BOLD}${new_val}${NC}"
  echo -e "${YELLOW}[!] Restart the main app container for the change to take effect:${NC}"
  echo -e "    ${CYAN}sudo docker compose -f docker-compose.server.yml up -d --no-deps hse-app${NC}"
}
cmd_update() {
  print_header
  check_docker
  ensure_env_file
  ensure_compose_file
  local image_tag
  image_tag="$(grep -E '^OLLAMA_IMAGE=' "${ENV_FILE}" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '[:space:]' || true)"
  image_tag="${image_tag:-ollama/ollama:0.40.13}"
  if [[ "${image_tag}" == "ollama/ollama" || "${image_tag}" == *":latest" ]]; then
    echo -e "${RED}[ERROR] Floating :latest Ollama images are blocked. Pin an explicit version in .env.${NC}" >&2
    return 1
  fi
  verify_container_compose_owner || return 1
  echo -e "${BLUE}[*] Updating configured Ollama image: ${image_tag}${NC}"
  docker compose -f "${PROJECT_DIR}/${COMPOSE_FILE}" --env-file "${ENV_FILE}" pull hse-ai-engine
  docker compose -f "${PROJECT_DIR}/${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --no-deps hse-ai-engine
  echo -e "${GREEN}[✓] Configured Ollama image update completed.${NC}"
  echo -e "${DIM}Models volume (hse_ai_models) was preserved.${NC}"
}
cmd_uninstall() {
  print_header
  check_docker
  ensure_env_file
  ensure_compose_file
  verify_container_compose_owner || return 1
  echo -e "${RED}${BOLD}[WARNING] You are about to remove the Local AI Infrastructure container.${NC}"
  echo -e "The main HSECORE application will continue to run."
  read -r -p "Do you want to proceed with stopping and removing the AI container? [y/N]: " confirm
  if ! [[ "${confirm}" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Uninstallation cancelled.${NC}"
    return 0
  fi
  echo -e "${BLUE}[*] Stopping and removing only hse-ai-engine...${NC}"
  docker compose -f "${PROJECT_DIR}/${COMPOSE_FILE}" --env-file "${ENV_FILE}" stop hse-ai-engine
  docker compose -f "${PROJECT_DIR}/${COMPOSE_FILE}" --env-file "${ENV_FILE}" rm -f hse-ai-engine
  read -r -p "Do you ALSO want to delete the persistent models volume (hse_ai_models)? [y/N]: " del_vol
  if [[ "${del_vol}" =~ ^[Yy]$ ]]; then
    docker volume rm hse_ai_models
    echo -e "${YELLOW}[✓] Persistent volume hse_ai_models deleted.${NC}"
  else
    echo -e "${GREEN}[✓] Preserved models volume hse_ai_models for future use.${NC}"
  fi
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
    echo "  pull <model>         Pull any valid Ollama model reference into persistent storage"
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
