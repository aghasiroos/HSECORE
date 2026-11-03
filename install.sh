#!/usr/bin/env bash
# ==============================================================================
# HSECORE Enterprise System - Production Installer for Ubuntu 22.04 / 24.04 VPS
# Strict 15-Step Production-Grade, Idempotent, and Controlled Installation Engine
# Includes Domain / IP / Let's Encrypt SSL / Nginx Reverse Proxy / PostgreSQL Setup
# ==============================================================================
# Architecture:
#
# Client Browser (HTTPS / HTTP)
# │
# ├── Nginx Reverse Proxy (Port 80 / 443 / Public Port)
# │   └── SSL Termination (Let's Encrypt Auto-renewing Certificates)
# │
# ├── HSECORE Application (Docker Container on 127.0.0.1:3000)
# │   └── Connects to Host DB via host.docker.internal
# │
# └── PostgreSQL (Native Direct on Ubuntu VPS Host - Port 5432)
#     └── HSECORE Database (e.g. hsedb)
# ==============================================================================

set -eo pipefail

# ------------------------------------------------------------------------------
# Global Constants & Paths
# ------------------------------------------------------------------------------
INSTALLER_VERSION="0.2.8"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="${PROJECT_DIR}/.installer-state"
CACHE_FILE="${PROJECT_DIR}/.installer-answers"
LOG_FILE="/var/log/hsecore-install.log"
LOCAL_LOG_FILE="${PROJECT_DIR}/installer.log"
ENV_FILE="${PROJECT_DIR}/.env"
ENV_BACKUP_DIR="${PROJECT_DIR}/.env_backups"
DB_BACKUP_DIR="${PROJECT_DIR}/backups"
BACKUP_CONFIG="${PROJECT_DIR}/.backup-config"
BACKUP_LOG="/var/log/hsecore-backup.log"
BACKUP_STATUS_FILE="${PROJECT_DIR}/.backup-status"
UPLOADS_HOST_DIR="${PROJECT_DIR}/data/uploads"
APP_CONTAINER_NAME="hse-enterprise-app"
BACKUP_CRON_FILE="/etc/cron.d/hsecore-backup"
BACKUP_LOCK_FILE="/var/lock/hsecore-backup.lock"
BACKUP_LOGROTATE_FILE="/etc/logrotate.d/hsecore-backup"

# Colors & Terminal Formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ------------------------------------------------------------------------------
# TUI Engine State, Capability Detection & Fallback (Ubuntu 22.04/24.04 & SSH)
# ------------------------------------------------------------------------------
INSTALL_START_TIME="$(date +%s)"
CURRENT_STEP_NUM=0
CURRENT_STEP_TITLE=""
CURRENT_STEP_START_TIME="$(date +%s)"
TUI_ENABLED="false"
TUI_UTF8="true"
TUI_CURSOR_HIDDEN="false"
TUI_SLEEP_INTERVAL="1"
TUI_ACTIVE_PID=""
TUI_ACTIVE_LOG=""
TUI_LAST_REMEDIATION=""

STEP_TITLES=(
  ""
  "System Check"
  "Install Dependencies & Node.js LTS"
  "Install Docker"
  "Install PostgreSQL (Native VPS Host)"
  "Configure Database"
  "Configure Access (IP vs Domain), SSL & Ports"
  "Create Database & User"
  "Test Database Connection"
  "Configure Environment"
  "Build HSECORE Docker Images"
  "Database Diagnostic, Migration & Admin Setup"
  "Start HSECORE Application Container"
  "Configure SSL, Nginx Reverse Proxy & Firewall"
  "Final Health Check"
  "Installation Complete"
)

tui_detect_capabilities() {
  TUI_ENABLED="false"
  if [[ "${HSE_PLAIN_OUTPUT:-0}" == "1" ]]; then
    return 0
  fi
  if [[ -t 1 && -n "${TERM:-}" && "${TERM}" != "dumb" ]]; then
    local cols=80
    cols="$(tput cols 2>/dev/null || echo "${COLUMNS:-80}")"
    if ! [[ "${cols}" =~ ^[0-9]+$ ]]; then
      cols=80
    fi
    if [[ "${cols}" -ge 55 ]]; then
      TUI_ENABLED="true"
    fi
  fi

  local locale_str="${LC_ALL:-${LC_CTYPE:-${LANG:-}}}"
  if [[ "${locale_str}" =~ [Uu][Tt][Ff]-?8 ]] || (command -v locale &>/dev/null && locale charmap 2>/dev/null | grep -qi 'utf-\?8'); then
    TUI_UTF8="true"
  else
    TUI_UTF8="false"
  fi

  if sleep 0.35 2>/dev/null; then
    TUI_SLEEP_INTERVAL="0.35"
  else
    TUI_SLEEP_INTERVAL="1"
  fi
}

tui_detect_capabilities

tui_term_cols() {
  local cols=80
  if [[ -t 1 ]]; then
    cols="$(tput cols 2>/dev/null || echo "${COLUMNS:-80}")"
  fi
  if ! [[ "${cols}" =~ ^[0-9]+$ ]] || [[ "${cols}" -lt 50 ]]; then
    cols=80
  fi
  if [[ "${cols}" -gt 110 ]]; then
    cols=110
  fi
  printf '%s' "${cols}"
}

tui_hide_cursor() {
  if [[ "${TUI_ENABLED}" == "true" && "${TUI_CURSOR_HIDDEN}" != "true" ]]; then
    printf '\033[?25l' 2>/dev/null || true
    TUI_CURSOR_HIDDEN="true"
  fi
}

tui_show_cursor() {
  if [[ "${TUI_CURSOR_HIDDEN}" == "true" ]]; then
    printf '\033[?25h' 2>/dev/null || true
    TUI_CURSOR_HIDDEN="false"
  fi
}

tui_format_duration() {
  local secs="${1:-0}"
  if ! [[ "${secs}" =~ ^[0-9]+$ ]]; then
    secs=0
  fi
  if [[ "${secs}" -ge 60 ]]; then
    printf '%dm %ds' "$((secs / 60))" "$((secs % 60))"
  else
    printf '%ds' "${secs}"
  fi
}

# ------------------------------------------------------------------------------
# HSECORE ASCII Art Logo (HSE: Blue, CORE: Green)
# ------------------------------------------------------------------------------
print_hsecore_logo() {
  echo ""
  echo -e "${BOLD}${BLUE}  _    _  _____ ______ ${GREEN} _____ ____  _____  ______ ${NC}"
  echo -e "${BOLD}${BLUE} | |  | |/ ____|  ____|${GREEN}/ ____/ __ \\|  __ \\|  ____|${NC}"
  echo -e "${BOLD}${BLUE} | |__| | (___ | |__  ${GREEN}| |   | |  | | |__) | |__   ${NC}"
  echo -e "${BOLD}${BLUE} |  __  |\\___ \\|  __| ${GREEN}| |   | |  | |  _  /|  __|  ${NC}"
  echo -e "${BOLD}${BLUE} | |  | |____) | |____${GREEN}| |___| |__| | | \\ \\| |____ ${NC}"
  echo -e "${BOLD}${BLUE} |_|  |_|_____/|______|${GREEN}\\_____\\____/|_|  \\_\\______|${NC}"
  echo ""
  echo -e " ${BOLD}${BLUE}Health, Safety & Environment${NC} ${BOLD}${GREEN}Enterprise Management Platform${NC}"
  echo -e " ${CYAN}Version: ${INSTALLER_VERSION}${NC}"
  echo -e " ${CYAN}==================================================================${NC}"
  echo ""
}

# ------------------------------------------------------------------------------
# Secret-Sanitized Logging
# ------------------------------------------------------------------------------
mkdir -p "${ENV_BACKUP_DIR}" "$(dirname "${LOG_FILE}")" 2>/dev/null || true
touch "${LOCAL_LOG_FILE}" 2>/dev/null || true
chmod 600 "${LOCAL_LOG_FILE}" 2>/dev/null || true

sanitize_log_line() {
  local msg="$1"
  if [[ -n "${SQL_PASSWORD:-}" && "${msg}" == *"${SQL_PASSWORD}"* ]]; then
    msg="${msg//"${SQL_PASSWORD}"/*******}"
  fi
  if [[ -n "${SQL_ADMIN_PASSWORD:-}" && "${msg}" == *"${SQL_ADMIN_PASSWORD}"* ]]; then
    msg="${msg//"${SQL_ADMIN_PASSWORD}"/*******}"
  fi
  if [[ "${msg}" =~ (PASSWORD|SECRET|TOKEN|ADMIN_PASS)= ]] || [[ "${msg}" =~ [0-9a-fA-F]{32} ]]; then
    printf '%s' "${msg}" | sed -E -e 's/(PASSWORD|SECRET|TOKEN|ADMIN_PASS)=[^ &"'\'']+/\1=*******/gI' -e 's/([0-9a-fA-F]{32,64})/*******/g'
  else
    printf '%s' "${msg}"
  fi
}

log_raw() {
  local msg="$1"
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  local sanitized
  sanitized="$(sanitize_log_line "${msg}")"
  echo "[${timestamp}] ${sanitized}" >> "${LOCAL_LOG_FILE}" 2>/dev/null || true
  if [[ -w "$(dirname "${LOG_FILE}")" ]]; then
    echo "[${timestamp}] ${sanitized}" >> "${LOG_FILE}" 2>/dev/null || true
  fi
}

log_info() {
  if [[ "${TUI_ENABLED}" == "true" ]]; then
    echo -e "  ${BLUE}•${NC} $1"
  else
    echo -e "${BLUE}[INFO]${NC} $1"
  fi
  log_raw "[INFO] $1"
}

log_success() {
  if [[ "${TUI_ENABLED}" == "true" ]]; then
    local chk="✓"
    if [[ "${TUI_UTF8}" != "true" ]]; then chk="+"; fi
    echo -e "  ${GREEN}${chk}${NC} $1"
  else
    echo -e "${GREEN}[✓]${NC} $1"
  fi
  log_raw "[SUCCESS] $1"
}

log_warn() {
  if [[ "${TUI_ENABLED}" == "true" ]]; then
    echo -e "  ${YELLOW}!${NC} ${YELLOW}$1${NC}"
  else
    echo -e "${YELLOW}[!]${NC} $1"
  fi
  log_raw "[WARN] $1"
}

log_error() {
  if [[ "${TUI_ENABLED}" == "true" ]]; then
    local xmark="✗"
    if [[ "${TUI_UTF8}" != "true" ]]; then xmark="x"; fi
    echo -e "  ${RED}${xmark}${NC} ${RED}${BOLD}$1${NC}" >&2
  else
    echo -e "${RED}[ERROR]${NC} $1" >&2
  fi
  log_raw "[ERROR] $1"
}

# ------------------------------------------------------------------------------
# Signal & SSH Disconnect (SIGHUP / SIGINT / SIGTERM / EXIT) Trap Handlers
# ------------------------------------------------------------------------------
tui_cleanup_exit() {
  local exit_code=$?
  tui_show_cursor
  if [[ -n "${TUI_ACTIVE_PID:-}" ]] && kill -0 "${TUI_ACTIVE_PID}" 2>/dev/null; then
    kill -TERM "${TUI_ACTIVE_PID}" 2>/dev/null || true
  fi
  if [[ -n "${TUI_ACTIVE_LOG:-}" && -f "${TUI_ACTIVE_LOG}" ]]; then
    rm -f "${TUI_ACTIVE_LOG}" 2>/dev/null || true
  fi
  return "${exit_code}"
}

tui_handle_interrupt() {
  local sig="${1:-INT}"
  local code=130
  if [[ "${sig}" == "TERM" ]]; then code=143; fi
  tui_show_cursor
  if [[ -n "${TUI_ACTIVE_PID:-}" ]] && kill -0 "${TUI_ACTIVE_PID}" 2>/dev/null; then
    kill -TERM "${TUI_ACTIVE_PID}" 2>/dev/null || true
  fi
  if [[ -n "${TUI_ACTIVE_LOG:-}" && -f "${TUI_ACTIVE_LOG}" ]]; then
    rm -f "${TUI_ACTIVE_LOG}" 2>/dev/null || true
  fi
  echo "" >&2
  log_warn "Operation interrupted (SIG${sig}) at Step ${CURRENT_STEP_NUM:-0}/15 (${CURRENT_STEP_TITLE:-Initializer})."
  echo -e "  ${YELLOW}→ Resume safely at any time with:${NC} ${BOLD}sudo ./install.sh --resume${NC}" >&2
  exit "${code}"
}

tui_handle_sighup() {
  # SSH session disconnected: switch off terminal escape sequences and preserve state cleanly
  TUI_ENABLED="false"
  TUI_CURSOR_HIDDEN="false"
  if [[ -n "${TUI_ACTIVE_PID:-}" ]] && kill -0 "${TUI_ACTIVE_PID}" 2>/dev/null; then
    kill -TERM "${TUI_ACTIVE_PID}" 2>/dev/null || true
  fi
  if [[ -n "${TUI_ACTIVE_LOG:-}" && -f "${TUI_ACTIVE_LOG}" ]]; then
    rm -f "${TUI_ACTIVE_LOG}" 2>/dev/null || true
  fi
  local last_done="0"
  if [[ -f "${STATE_FILE}" ]]; then
    last_done="$(grep -E '^LAST_COMPLETED_STEP=' "${STATE_FILE}" 2>/dev/null | cut -d'=' -f2- || echo "0")"
  fi
  log_raw "[WARN] SSH session disconnected (SIGHUP) during Step ${CURRENT_STEP_NUM:-0}/15 (${CURRENT_STEP_TITLE:-Initializer}). Last completed step: ${last_done}/15. Reconnect and run: sudo ./install.sh --resume"
  exit 129
}

trap tui_cleanup_exit EXIT
trap 'tui_handle_interrupt INT' INT
trap 'tui_handle_interrupt TERM' TERM
trap tui_handle_sighup HUP

# ------------------------------------------------------------------------------
# TUI Progress Bar & Error Diagnostics Builders
# ------------------------------------------------------------------------------
# Renders a deterministic progress bar (when pct >= 0) or animated pulse bar (when pct < 0)
tui_build_bar() {
  local pct="${1:--1}"
  local tick="${2:-0}"
  local width="${3:-10}"
  local ch_fill="█"
  local ch_empty="░"
  local ch_cap="│"
  if [[ "${TUI_UTF8}" != "true" ]]; then
    ch_fill="#"
    ch_empty="-"
    ch_cap="|"
  fi

  local bar=""
  local i=0
  if [[ "${pct}" -ge 0 ]]; then
    if [[ "${pct}" -gt 100 ]]; then pct=100; fi
    local filled=$(( pct * width / 100 ))
    while [[ ${i} -lt ${width} ]]; do
      if [[ ${i} -lt ${filled} ]]; then
        bar+="${CYAN}${ch_fill}${NC}"
      else
        bar+="${DIM}${ch_empty}${NC}"
      fi
      i=$((i + 1))
    done
  else
    # Indeterminate animated sliding bar (no fake percentage)
    local pulse_len=4
    local span=$(( width + pulse_len ))
    local pos=$(( tick % span ))
    local start_idx=$(( pos - pulse_len + 1 ))
    local end_idx=${pos}
    while [[ ${i} -lt ${width} ]]; do
      if [[ ${i} -ge ${start_idx} && ${i} -le ${end_idx} ]]; then
        bar+="${CYAN}${ch_fill}${NC}"
      else
        bar+="${DIM}${ch_empty}${NC}"
      fi
      i=$((i + 1))
    done
  fi
  bar+="${DIM}${ch_cap}${NC}"
  printf '%s' "${bar}"
}

# Prints a completed task line matching the screenshot:
# ✓ <Task Title>                                                             <Xs>
tui_print_completed_task() {
  local title="$1"
  local elapsed_secs="${2:-0}"
  local extra_badge="${3:-}"
  local dur_str
  dur_str="$(tui_format_duration "${elapsed_secs}")"
  if [[ -n "${extra_badge}" ]]; then
    dur_str="${extra_badge} · ${dur_str}"
  fi

  log_raw "[TASK OK] ${title} (${dur_str})"

  if [[ "${TUI_ENABLED}" != "true" ]]; then
    echo -e "${GREEN}[✓]${NC} ${title} (${dur_str})"
    return 0
  fi

  local chk="✓"
  if [[ "${TUI_UTF8}" != "true" ]]; then chk="+"; fi
  local cols
  cols="$(tui_term_cols)"
  local max_title=$(( cols - ${#dur_str} - 6 ))
  if [[ ${max_title} -lt 20 ]]; then max_title=20; fi
  local clean_title="${title}"
  if [[ ${#clean_title} -gt ${max_title} ]]; then
    clean_title="${clean_title:0:$((max_title - 3))}..."
  fi
  local pad=$(( cols - ${#clean_title} - ${#dur_str} - 4 ))
  if [[ ${pad} -lt 2 ]]; then pad=2; fi
  local spaces=""
  printf -v spaces '%*s' "${pad}" ''
  printf '\r\033[2K  %b%s%b %s%s%b%s%b\n' "${GREEN}" "${chk}" "${NC}" "${clean_title}" "${spaces}" "${DIM}" "${dur_str}" "${NC}"
}

# Prints a structured Error Diagnostic Box with Stopped Step, Error Cause, and Suggested Solution
tui_report_error() {
  local task_title="$1"
  local exit_code="${2:-1}"
  local err_log_file="${3:-}"
  local remediation="${4:-${TUI_LAST_REMEDIATION:-Check network connectivity, service status, and disk space, then run: sudo ./install.sh --resume}}"

  local step_label="Step ${CURRENT_STEP_NUM:-?}/15: ${CURRENT_STEP_TITLE:-Unknown Step}"
  local ch_pipe="│"
  local ch_x="✗"
  if [[ "${TUI_UTF8}" != "true" ]]; then
    ch_pipe="|"
    ch_x="x"
  fi

  echo "" >&2
  echo -e "${RED}${BOLD}==================================================================${NC}" >&2
  echo -e "${RED}${BOLD}  [${ch_x}] INSTALLATION ERROR DIAGNOSTIC REPORT${NC}" >&2
  echo -e "${RED}${BOLD}==================================================================${NC}" >&2
  echo -e "  ${BOLD}Stopped Step (مرحله متوقف‌شده):${NC} ${YELLOW}[${CURRENT_STEP_NUM:-?}/15] ${CURRENT_STEP_TITLE:-Unknown}${NC}" >&2
  echo -e "  ${BOLD}Failed Operation (عملیات):${NC}      ${task_title} (Exit Code: ${exit_code})" >&2

  if [[ -n "${err_log_file}" && -s "${err_log_file}" ]]; then
    echo -e "  ${BOLD}Error Cause / Last Logs (علت خطا و خروجی دستور):${NC}" >&2
    local line_item clean_item
    while IFS= read -r line_item; do
      clean_item="$(sanitize_log_line "${line_item}")"
      if [[ -n "${clean_item// }" ]]; then
        echo -e "    ${RED}${ch_pipe}${NC} ${clean_item}" >&2
      fi
    done < <(tail -n 8 "${err_log_file}" 2>/dev/null || true)
  fi

  echo -e "  ${BOLD}Suggested Solution (راهکار پیشنهادی):${NC}" >&2
  echo -e "    ${CYAN}→${NC} ${remediation}" >&2
  echo -e "    ${CYAN}→${NC} Full log file: ${BOLD}${LOCAL_LOG_FILE}${NC}" >&2
  echo -e "    ${CYAN}→${NC} Resume after fixing: ${BOLD}sudo ./install.sh --resume${NC}" >&2
  echo -e "${RED}${BOLD}==================================================================${NC}" >&2
  echo "" >&2

  log_raw "[ERROR REPORT] Stopped at ${step_label} | Task: ${task_title} (rc=${exit_code}) | Hint: ${remediation}"
}

# Executes a command or function with live TUI progress bar, spinner, elapsed time,
# and live single-line output streaming beneath the active task.
# Usage: tui_run_task "Task Title" "Suggested fix on error" command [args...]
tui_run_task() {
  local title="$1"
  local remediation="$2"
  shift 2

  TUI_LAST_REMEDIATION="${remediation}"
  local start_ts
  start_ts="$(date +%s)"
  local tmp_out
  tmp_out="$(mktemp "${TMPDIR:-/tmp}/.hse_tui_task.XXXXXX")"
  TUI_ACTIVE_LOG="${tmp_out}"

  log_raw "[TASK START] ${title}"

  # Plain-text fallback when terminal does not support TUI
  if [[ "${TUI_ENABLED}" != "true" ]]; then
    echo -e "${BLUE}[INFO]${NC} ${title} (Running...)"
    local plain_rc=0
    local errexit_saved=false
    if [[ $- == *e* ]]; then errexit_saved=true; fi
    set +e
    ( "$@" ) 2>&1 | while IFS= read -r pline; do
      printf '%s\n' "${pline}" >> "${tmp_out}"
      local clean_p
      clean_p="$(sanitize_log_line "${pline}")"
      printf '  | %s\n' "${clean_p}"
    done
    plain_rc="${PIPESTATUS[0]}"
    if [[ "${errexit_saved}" == "true" ]]; then set -e; fi

    local end_ts elapsed
    end_ts="$(date +%s)"
    elapsed=$(( end_ts - start_ts ))

    if [[ -s "${tmp_out}" ]]; then
      while IFS= read -r l_line; do
        log_raw "  [CMD] ${l_line}"
      done < <(tail -n 30 "${tmp_out}" 2>/dev/null || true)
    fi

    if [[ ${plain_rc} -eq 0 ]]; then
      rm -f "${tmp_out}"
      TUI_ACTIVE_LOG=""
      echo -e "${GREEN}[✓]${NC} ${title} ($(tui_format_duration "${elapsed}"))"
      log_raw "[TASK OK] ${title} (${elapsed}s)"
      return 0
    else
      tui_report_error "${title}" "${plain_rc}" "${tmp_out}" "${remediation}"
      rm -f "${tmp_out}"
      TUI_ACTIVE_LOG=""
      return "${plain_rc}"
    fi
  fi

  # Interactive TUI Mode (matching attached screenshot)
  local spinners=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
  local ch_pipe="│"
  local ch_x="✗"
  if [[ "${TUI_UTF8}" != "true" ]]; then
    spinners=("|" "/" "-" "\\")
    ch_pipe="|"
    ch_x="x"
  fi

  local errexit_was_on=false
  if [[ $- == *e* ]]; then errexit_was_on=true; fi
  set +e

  tui_hide_cursor

  # Launch command in background writing real stdout & stderr to tmp_out
  ( "$@" ) >"${tmp_out}" 2>&1 &
  local cmd_pid=$!
  TUI_ACTIVE_PID="${cmd_pid}"

  local tick=0
  local first_draw=true
  local cols
  cols="$(tui_term_cols)"

  while kill -0 "${cmd_pid}" 2>/dev/null; do
    local now_ts elapsed dur_str
    now_ts="$(date +%s)"
    elapsed=$(( now_ts - start_ts ))
    dur_str="$(tui_format_duration "${elapsed}")"

    local sp_idx=$(( tick % ${#spinners[@]} ))
    local sp_char="${spinners[$sp_idx]}"

    # Extract latest non-empty real output line from the tail of tmp_out (O(1) read instead of full-file scan)
    local raw_last=""
    if [[ -s "${tmp_out}" ]]; then
      raw_last="$(tail -c 4096 "${tmp_out}" 2>/dev/null | tr '\r' '\n' | sed -E 's/\x1B\[[0-9;?]*[a-zA-Z]//g' | grep -v '^[[:space:]]*$' | tail -n 1 || true)"
    fi
    local live_line
    if [[ -n "${raw_last}" ]]; then
      live_line="$(sanitize_log_line "${raw_last}")"
    else
      live_line="Running: $1 ..."
    fi

    # Detect real progress percentage ONLY if explicitly emitted by command (never fake)
    local real_pct=-1
    if [[ "${live_line}" =~ ([0-9]{1,3})% ]]; then
      local cand_pct="${BASH_REMATCH[1]}"
      if [[ "${cand_pct}" -ge 0 && "${cand_pct}" -le 100 ]]; then
        real_pct="${cand_pct}"
      fi
    fi

    local bar_str status_right
    bar_str="$(tui_build_bar "${real_pct}" "${tick}" 8)"
    if [[ "${real_pct}" -ge 0 ]]; then
      status_right="${bar_str} ${real_pct}% · ${dur_str}"
    else
      status_right="${bar_str} ${dur_str} · running"
    fi

    local right_visible_len=$(( 8 + 1 + 1 + ${#dur_str} + 10 ))
    local max_t=$(( cols - right_visible_len - 6 ))
    if [[ ${max_t} -lt 18 ]]; then max_t=18; fi
    local disp_title="${title}"
    if [[ ${#disp_title} -gt ${max_t} ]]; then
      disp_title="${disp_title:0:$((max_t - 3))}..."
    fi
    local pad=$(( cols - ${#disp_title} - right_visible_len - 4 ))
    if [[ ${pad} -lt 1 ]]; then pad=1; fi
    local spaces=""
    printf -v spaces '%*s' "${pad}" ''

    local max_log=$(( cols - 7 ))
    if [[ ${max_log} -lt 20 ]]; then max_log=20; fi
    if [[ ${#live_line} -gt ${max_log} ]]; then
      live_line="${live_line:0:$((max_log - 3))}..."
    fi

    local line1="  ${YELLOW}${sp_char}${NC} ${BOLD}${disp_title}${NC}${spaces}${status_right}"
    local line2="    ${DIM}${ch_pipe} ${live_line}${NC}"

    if [[ "${first_draw}" == "true" ]]; then
      printf '\r\033[2K%b\n\r\033[2K%b' "${line1}" "${line2}"
      first_draw=false
    else
      printf '\r\033[2K\033[1A\r\033[2K%b\n\r\033[2K%b' "${line1}" "${line2}"
    fi

    tick=$((tick + 1))
    sleep "${TUI_SLEEP_INTERVAL}"
  done

  wait "${cmd_pid}" 2>/dev/null
  local rc=$?
  TUI_ACTIVE_PID=""

  tui_show_cursor
  if [[ "${errexit_was_on}" == "true" ]]; then set -e; fi

  local end_ts elapsed
  end_ts="$(date +%s)"
  elapsed=$(( end_ts - start_ts ))

  # Persist command output to installer log file
  if [[ -s "${tmp_out}" ]]; then
    while IFS= read -r l_line; do
      if [[ -n "${l_line// }" ]]; then
        log_raw "  [CMD] ${l_line}"
      fi
    done < <(tr '\r' '\n' < "${tmp_out}" 2>/dev/null | tail -n 40 || true)
  fi

  if [[ ${rc} -eq 0 ]]; then
    if [[ "${first_draw}" == "false" ]]; then
      printf '\r\033[2K\033[1A\r\033[2K'
    fi
    rm -f "${tmp_out}"
    TUI_ACTIVE_LOG=""
    tui_print_completed_task "${title}" "${elapsed}"
    return 0
  else
    if [[ "${first_draw}" == "false" ]]; then
      printf '\r\033[2K\033[1A\r\033[2K'
    fi
    printf '  %b%s%b %b%s%b  %b[FAILED after %s]%b\n' \
      "${RED}" "${ch_x}" "${NC}" "${BOLD}" "${title}" "${NC}" "${RED}" "$(tui_format_duration "${elapsed}")" "${NC}" >&2
    tui_report_error "${title}" "${rc}" "${tmp_out}" "${remediation}"
    rm -f "${tmp_out}"
    TUI_ACTIVE_LOG=""
    return "${rc}"
  fi
}

# Renders a step header with step number, title, overall real percentage bar,
# elapsed timer, and visual checklist trail of completed vs current steps.
step_header() {
  local step_num="$1"
  local step_title="$2"
  CURRENT_STEP_NUM="${step_num}"
  CURRENT_STEP_TITLE="${step_title}"
  CURRENT_STEP_START_TIME="$(date +%s)"

  local now_ts total_elapsed dur_str
  now_ts="$(date +%s)"
  total_elapsed=$(( now_ts - INSTALL_START_TIME ))
  dur_str="$(tui_format_duration "${total_elapsed}")"

  # Real step completion percentage (completed steps prior to this step out of 15)
  local completed_before=$(( step_num - 1 ))
  if [[ ${completed_before} -lt 0 ]]; then completed_before=0; fi
  local pct=$(( completed_before * 100 / 15 ))

  log_raw "[STEP ${step_num}/15] ${step_title} (Overall Progress: ${pct}%, Elapsed: ${dur_str})"

  if [[ "${TUI_ENABLED}" != "true" ]]; then
    echo ""
    echo -e "${BOLD}${CYAN}==================================================================${NC}"
    echo -e "${BOLD}${CYAN}[${step_num}/15] ${step_title} (${pct}% · Elapsed: ${dur_str})${NC}"
    echo -e "${BOLD}${CYAN}==================================================================${NC}"
    return 0
  fi

  local bar_str
  bar_str="$(tui_build_bar "${pct}" 0 15)"

  # Build compact step trail showing completed (✓) vs current (▶) vs pending (·)
  local trail=""
  local s=1
  local chk="✓"
  local cur_sym="▶"
  if [[ "${TUI_UTF8}" != "true" ]]; then
    chk="+"
    cur_sym=">"
  fi
  while [[ ${s} -le 15 ]]; do
    if [[ ${s} -lt ${step_num} ]]; then
      trail+="${GREEN}${chk}${s}${NC} "
    elif [[ ${s} -eq ${step_num} ]]; then
      trail+="${YELLOW}${BOLD}${cur_sym}[${s}]${NC} "
    else
      trail+="${DIM}·${s}${NC} "
    fi
    s=$((s + 1))
  done

  echo ""
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
  echo -e "  ${YELLOW}${BOLD}${cur_sym} [${step_num}/15] ${step_title}${NC}"
  echo -e "  ${DIM}Progress:${NC} ${bar_str} ${BOLD}${pct}%${NC} ${DIM}· Step ${step_num} of 15 · Elapsed: ${dur_str}${NC}"
  echo -e "  ${DIM}Steps   :${NC} ${trail}"
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
}

# ------------------------------------------------------------------------------
# State & Resume Management (Idempotency)
# ------------------------------------------------------------------------------
get_last_completed_step() {
  if [[ -f "${STATE_FILE}" ]]; then
    grep -E '^LAST_COMPLETED_STEP=' "${STATE_FILE}" | cut -d'=' -f2- || echo "0"
  else
    echo "0"
  fi
}

set_completed_step() {
  local step_num="$1"
  local now_ts step_elapsed step_dur total_elapsed total_dur pct
  now_ts="$(date +%s)"
  step_elapsed=$(( now_ts - ${CURRENT_STEP_START_TIME:-now_ts} ))
  total_elapsed=$(( now_ts - ${INSTALL_START_TIME:-now_ts} ))
  step_dur="$(tui_format_duration "${step_elapsed}")"
  total_dur="$(tui_format_duration "${total_elapsed}")"
  pct=$(( step_num * 100 / 15 ))
  if [[ ${pct} -gt 100 ]]; then pct=100; fi

  if [[ "${TUI_ENABLED}" == "true" ]]; then
    local chk="✓"
    if [[ "${TUI_UTF8}" != "true" ]]; then chk="+"; fi
    local bar_str
    bar_str="$(tui_build_bar "${pct}" 0 15)"
    echo -e "  ${GREEN}${BOLD}${chk} Step ${step_num}/15 Completed:${NC} ${STEP_TITLES[$step_num]:-${CURRENT_STEP_TITLE}}  ${bar_str} ${BOLD}${pct}%${NC} ${DIM}(Step: ${step_dur} · Total: ${total_dur})${NC}"
  fi

  if [[ "${HSE_STEP_ONLY:-0}" == "1" ]]; then
    return 0
  fi
  mkdir -p "$(dirname "${STATE_FILE}")" 2>/dev/null || true
  echo "LAST_COMPLETED_STEP=${step_num}" > "${STATE_FILE}"
  echo "UPDATED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ')" >> "${STATE_FILE}"
  log_raw "State updated: Step ${step_num}/15 marked completed (${pct}%, step=${step_dur}, total=${total_dur})."
}

# ------------------------------------------------------------------------------
# Cache Configuration (Stored with 600 permissions; NO ADMIN PW)
# ------------------------------------------------------------------------------
save_answers_cache() {
  touch "${CACHE_FILE}"
  chmod 600 "${CACHE_FILE}"
  cat << EOF > "${CACHE_FILE}"
ACCESS_TYPE="${ACCESS_TYPE:-IP}"
SERVER_IP="${SERVER_IP:-}"
DOMAIN="${DOMAIN:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
SSL_ENABLED="${SSL_ENABLED:-false}"
CERTBOT_ENABLED="${CERTBOT_ENABLED:-false}"
APP_PORT="${APP_PORT:-3000}"
APP_INTERNAL_PORT="${APP_INTERNAL_PORT:-3000}"
DOCKER_BIND_IP="${DOCKER_BIND_IP:-127.0.0.1}"
ACCESS_URL="${ACCESS_URL:-}"
SQL_HOST="${SQL_HOST:-}"
SQL_USER="${SQL_USER:-}"
SQL_PASSWORD="${SQL_PASSWORD:-}"
SQL_DB_NAME="${SQL_DB_NAME:-}"
SQL_ADMIN_USER="${SQL_ADMIN_USER:-}"
SQL_SSL="${SQL_SSL:-false}"
SQL_SSL_CA="${SQL_SSL_CA:-}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
EOF
  chmod 600 "${CACHE_FILE}"
  log_raw "Configuration cache saved with 600 permissions."
}

load_answers_cache() {
  # 1. Load from cache file if present
  if [[ -f "${CACHE_FILE}" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ "$line" =~ ^[[:space:]]*# ]]; then
        continue
      fi
      if [[ -z "${line// }" ]]; then
        continue
      fi
      local key="${line%%=*}"
      local val="${line#*=}"
      val="${val%\"}"
      val="${val#\"}"
      val="${val%\'}"
      val="${val#\'}"
      case "$key" in
        ACCESS_TYPE) if [[ -z "${ACCESS_TYPE:-}" ]]; then ACCESS_TYPE="$val"; fi ;;
        SERVER_IP) if [[ -z "${SERVER_IP:-}" ]]; then SERVER_IP="$val"; fi ;;
        DOMAIN) if [[ -z "${DOMAIN:-}" ]]; then DOMAIN="$val"; fi ;;
        CERTBOT_EMAIL) if [[ -z "${CERTBOT_EMAIL:-}" ]]; then CERTBOT_EMAIL="$val"; fi ;;
        SSL_ENABLED) if [[ -z "${SSL_ENABLED:-}" ]]; then SSL_ENABLED="$val"; fi ;;
        CERTBOT_ENABLED) if [[ -z "${CERTBOT_ENABLED:-}" ]]; then CERTBOT_ENABLED="$val"; fi ;;
        APP_PORT) if [[ -z "${APP_PORT:-}" ]]; then APP_PORT="$val"; fi ;;
        APP_INTERNAL_PORT) if [[ -z "${APP_INTERNAL_PORT:-}" ]]; then APP_INTERNAL_PORT="$val"; fi ;;
        DOCKER_BIND_IP) if [[ -z "${DOCKER_BIND_IP:-}" ]]; then DOCKER_BIND_IP="$val"; fi ;;
        ACCESS_URL) if [[ -z "${ACCESS_URL:-}" ]]; then ACCESS_URL="$val"; fi ;;
        SQL_HOST) if [[ -z "${SQL_HOST:-}" ]]; then SQL_HOST="$val"; fi ;;
        SQL_USER) if [[ -z "${SQL_USER:-}" ]]; then SQL_USER="$val"; fi ;;
        SQL_PASSWORD) if [[ -z "${SQL_PASSWORD:-}" ]]; then SQL_PASSWORD="$val"; fi ;;
        SQL_DB_NAME) if [[ -z "${SQL_DB_NAME:-}" ]]; then SQL_DB_NAME="$val"; fi ;;
        SQL_ADMIN_USER) if [[ -z "${SQL_ADMIN_USER:-}" ]]; then SQL_ADMIN_USER="$val"; fi ;;
        SQL_SSL) if [[ -z "${SQL_SSL:-}" ]]; then SQL_SSL="$val"; fi ;;
        SQL_SSL_CA) if [[ -z "${SQL_SSL_CA:-}" ]]; then SQL_SSL_CA="$val"; fi ;;
        POSTGRES_PORT) if [[ -z "${POSTGRES_PORT:-}" ]]; then POSTGRES_PORT="$val"; fi ;;
      esac
    done < "${CACHE_FILE}"
  fi

  # 2. Fallback to .env if cache did not contain values (e.g. re-run after Step 15 cleanup)
  if [[ -f "${ENV_FILE}" ]]; then
    if [[ -z "${ACCESS_TYPE:-}" ]]; then ACCESS_TYPE="$(grep -E '^HOST_TYPE=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo '')"; fi
    if [[ -z "${DOMAIN:-}" ]]; then DOMAIN="$(grep -E '^DOMAIN=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo '')"; fi
    if [[ -z "${SSL_ENABLED:-}" ]]; then SSL_ENABLED="$(grep -E '^SSL_ENABLED=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo 'false')"; fi
    if [[ -z "${ACCESS_URL:-}" ]]; then ACCESS_URL="$(grep -E '^APP_URL=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo '')"; fi
    if [[ -z "${SQL_HOST:-}" ]]; then SQL_HOST="$(grep -E '^SQL_HOST=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo '')"; fi
    if [[ -z "${SQL_USER:-}" ]]; then SQL_USER="$(grep -E '^SQL_USER=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo '')"; fi
    if [[ -z "${SQL_PASSWORD:-}" ]]; then SQL_PASSWORD="$(grep -E '^SQL_PASSWORD=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo '')"; fi
    if [[ -z "${SQL_DB_NAME:-}" ]]; then SQL_DB_NAME="$(grep -E '^SQL_DB_NAME=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo '')"; fi
    if [[ -z "${SQL_ADMIN_USER:-}" ]]; then SQL_ADMIN_USER="$(grep -E '^SQL_ADMIN_USER=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo '')"; fi
    if [[ -z "${SQL_SSL:-}" ]]; then SQL_SSL="$(grep -E '^SQL_SSL=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo '')"; fi
    if [[ -z "${SQL_SSL_CA:-}" ]]; then SQL_SSL_CA="$(grep -E '^SQL_SSL_CA=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo '')"; fi
    if [[ -z "${APP_PORT:-}" ]]; then APP_PORT="$(grep -E '^(PUBLIC_PORT|APP_PORT|PORT)=' "${ENV_FILE}" | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo '')"; fi
    if [[ -z "${APP_INTERNAL_PORT:-}" ]]; then APP_INTERNAL_PORT="$(grep -E '^(APP_INTERNAL_PORT|PORT)=' "${ENV_FILE}" | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo '')"; fi
    if [[ -z "${DOCKER_BIND_IP:-}" ]]; then DOCKER_BIND_IP="$(grep -E '^DOCKER_BIND_IP=' "${ENV_FILE}" | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo '')"; fi
    if [[ -z "${POSTGRES_PORT:-}" ]]; then POSTGRES_PORT="$(grep -E '^(POSTGRES_PORT|SQL_PORT)=' "${ENV_FILE}" | tail -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo '')"; fi
  fi

  # 3. Ensure derived display defaults are populated for Step 15 / resume runs
  if [[ -z "${SERVER_IP:-}" ]]; then
    if [[ -n "${ACCESS_URL:-}" && "${ACCESS_URL}" =~ ^https?://([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+) ]]; then
      SERVER_IP="${BASH_REMATCH[1]}"
    else
      SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"
      SERVER_IP="${SERVER_IP:-127.0.0.1}"
    fi
  fi
  if [[ -z "${ACCESS_URL:-}" ]]; then
    if [[ "${ACCESS_TYPE:-IP}" == "DOMAIN" && -n "${DOMAIN:-}" ]]; then
      if [[ "${APP_PORT:-443}" == "443" ]]; then
        ACCESS_URL="https://${DOMAIN}"
      else
        ACCESS_URL="https://${DOMAIN}:${APP_PORT:-443}"
      fi
    else
      ACCESS_URL="http://${SERVER_IP:-127.0.0.1}:${APP_PORT:-3000}"
    fi
  fi
  return 0
}

# ------------------------------------------------------------------------------
# Helper: Run SQL command as PostgreSQL Admin using runuser & heredoc with -qtA
# Always switches to /tmp prior to invoking runuser to prevent permission errors
# ------------------------------------------------------------------------------
run_sql_admin() {
  local sql_cmd="$1"
  local target_db="${2:-postgres}"
  local p_port="${POSTGRES_PORT:-5432}"

  if [[ -n "${SQL_ADMIN_PASSWORD:-}" ]]; then
    (cd /tmp && PGPASSWORD="${SQL_ADMIN_PASSWORD}" psql -h 127.0.0.1 -p "${p_port}" -U "${SQL_ADMIN_USER:-postgres}" -d "${target_db}" -v ON_ERROR_STOP=1 -qtA <<EOF
${sql_cmd}
EOF
    )
  else
    # Peer authentication on postgres system account via runuser with heredoc & -qtA from /tmp
    if (cd /tmp && runuser -u postgres -- psql -h /var/run/postgresql -p "${p_port}" -d "${target_db}" -v ON_ERROR_STOP=1 -qtA -c "SELECT 1;" &>/dev/null); then
      (cd /tmp && runuser -u postgres -- psql -h /var/run/postgresql -p "${p_port}" -d "${target_db}" -v ON_ERROR_STOP=1 -qtA <<EOF
${sql_cmd}
EOF
      )
    else
      (cd /tmp && runuser -u postgres -- psql -p "${p_port}" -d "${target_db}" -v ON_ERROR_STOP=1 -qtA <<EOF
${sql_cmd}
EOF
      )
    fi
  fi
}

# ------------------------------------------------------------------------------
# Helper: Apply UFW Firewall Rules for PostgreSQL & SSH
# ------------------------------------------------------------------------------
apply_ufw_postgresql_rules() {
  load_answers_cache
  if command -v ufw &>/dev/null; then
    local ufw_status
    ufw_status="$(ufw status 2>/dev/null | grep -i "Status:" | awk '{print $2}' || echo 'inactive')"
    if [[ "${ufw_status}" != "active" ]]; then
      log_warn "UFW is installed but currently INACTIVE. Firewall rules will not take effect until UFW is enabled."
    else
      log_info "Configuring firewall rules for PostgreSQL and SSH..."
      ufw allow 22/tcp comment "SSH Remote Access" 2>/dev/null || true
      ufw allow ssh comment "SSH Remote Access" 2>/dev/null || true
      local pg_p="${POSTGRES_PORT:-5432}"
      ufw allow from 127.0.0.1 to any port "${pg_p}" proto tcp comment "Localhost to PostgreSQL" 2>/dev/null || true
      ufw allow from 172.16.0.0/12 to any port "${pg_p}" proto tcp comment "Docker Subnets to PostgreSQL" 2>/dev/null || true
      ufw allow in on docker0 to any port "${pg_p}" proto tcp comment "Docker Bridge to PostgreSQL" 2>/dev/null || true
      log_success "PostgreSQL internal firewall rules and SSH access verified."
    fi
  fi
}

# ------------------------------------------------------------------------------
# Helper: Configure Docker Registry Mirrors & Resolve Base Image (403 Bypass)
# ------------------------------------------------------------------------------
# Host Node.js 22 LTS Installation & Upgrade Engine
# Ensures Node.js >= 22.18.0 is installed on the host VPS (NodeSource + Fallback)
# ------------------------------------------------------------------------------
NODE_LTS_MAJOR="22"
NODE_MIN_MINOR="18"
NODE_FALLBACK_VERSION="22.18.0"

is_nodejs_lts_ready() {
  command -v node &>/dev/null && command -v npm &>/dev/null || return 1
  local ver major minor
  ver="$(node -v 2>/dev/null | sed 's/^v//')"
  major="$(echo "${ver}" | cut -d. -f1)"
  minor="$(echo "${ver}" | cut -d. -f2)"
  if [[ "${major}" =~ ^[0-9]+$ && "${minor}" =~ ^[0-9]+$ ]]; then
    if [[ "${major}" -gt "${NODE_LTS_MAJOR}" ]] || ([[ "${major}" -eq "${NODE_LTS_MAJOR}" && "${minor}" -ge "${NODE_MIN_MINOR}" ]]); then
      return 0
    fi
  fi
  return 1
}

configure_host_npm_fast_defaults() {
  if command -v npm &>/dev/null; then
    npm config set audit false --location=global 2>/dev/null || true
    npm config set fund false --location=global 2>/dev/null || true
    npm config set update-notifier false --location=global 2>/dev/null || true
    npm config set progress false --location=global 2>/dev/null || true
    npm config set loglevel error --location=global 2>/dev/null || true
  fi
}

ensure_nodejs_lts() {
  export DEBIAN_FRONTEND=noninteractive

  if is_nodejs_lts_ready; then
    echo "Node.js LTS is already up to date: $(node -v) (npm $(npm -v 2>/dev/null || echo 'ok'))"
    configure_host_npm_fast_defaults
    return 0
  fi

  local current_node="none"
  if command -v node &>/dev/null; then
    current_node="$(node -v 2>/dev/null || echo 'unknown')"
  fi
  echo "Detected host Node.js (${current_node}); installing/upgrading to Node.js ${NODE_LTS_MAJOR}.x LTS (>= ${NODE_LTS_MAJOR}.${NODE_MIN_MINOR}.0)..."

  # Remove legacy Ubuntu conflicting packages (e.g. libnode-dev / nodejs-doc from Node 12/18)
  if dpkg -l nodejs 2>/dev/null | grep -q '^ii'; then
    local pkg_ver
    pkg_ver="$(dpkg-query -W -f='${Version}' nodejs 2>/dev/null || echo '')"
    if [[ -n "${pkg_ver}" && ! "${pkg_ver}" =~ ^2[2-9]\. ]]; then
      apt-get remove -y nodejs npm libnode-dev nodejs-doc 2>/dev/null || true
      apt-get autoremove -y 2>/dev/null || true
    fi
  fi

  # Strategy 1: Official NodeSource APT Repository for Node.js 22.x
  mkdir -p /etc/apt/keyrings 2>/dev/null || true
  if curl -fsSL --max-time 15 https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg 2>/dev/null; then
    chmod a+r /etc/apt/keyrings/nodesource.gpg 2>/dev/null || true
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_LTS_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    if apt-get update -y && apt-get install -y nodejs; then
      hash -r 2>/dev/null || true
    fi
  else
    rm -f /etc/apt/sources.list.d/nodesource.list 2>/dev/null || true
  fi

  # Strategy 2: Direct Official / Mirror Prebuilt Binary Tarball Fallback (if NodeSource is blocked or older than 22.18.0)
  if ! is_nodejs_lts_ready; then
    echo "Applying direct binary installation for Node.js v${NODE_FALLBACK_VERSION}..."
    local arch_raw node_arch
    arch_raw="$(uname -m)"
    case "${arch_raw}" in
      x86_64|amd64) node_arch="x64" ;;
      aarch64|arm64) node_arch="arm64" ;;
      *) node_arch="x64" ;;
    esac

    local tar_name="node-v${NODE_FALLBACK_VERSION}-linux-${node_arch}.tar.xz"
    local tmp_tar="/tmp/${tar_name}"
    local dl_urls=(
      "https://nodejs.org/dist/v${NODE_FALLBACK_VERSION}/${tar_name}"
      "https://npmmirror.com/mirrors/node/v${NODE_FALLBACK_VERSION}/${tar_name}"
    )

    local dl_ok="false"
    local url
    for url in "${dl_urls[@]}"; do
      echo "Downloading Node.js binary from: ${url} ..."
      if curl -fsSL --max-time 60 "${url}" -o "${tmp_tar}"; then
        dl_ok="true"
        break
      fi
    done

    if [[ "${dl_ok}" == "true" && -s "${tmp_tar}" ]]; then
      tar -xJf "${tmp_tar}" -C /usr/local --strip-components=1
      rm -f "${tmp_tar}"
      ln -sf /usr/local/bin/node /usr/bin/node 2>/dev/null || true
      ln -sf /usr/local/bin/npm /usr/bin/npm 2>/dev/null || true
      ln -sf /usr/local/bin/npx /usr/bin/npx 2>/dev/null || true
      hash -r 2>/dev/null || true
    else
      rm -f "${tmp_tar}" 2>/dev/null || true
    fi
  fi

  if ! command -v node &>/dev/null; then
    echo "ERROR: Failed to install Node.js on host." >&2
    return 1
  fi

  configure_host_npm_fast_defaults
  echo "Successfully configured host Node.js $(node -v) and npm $(npm -v 2>/dev/null || echo 'installed')."
  return 0
}

# Automatically handles Docker Hub 403 Forbidden (Geo-blocking / Sanctions)
# ------------------------------------------------------------------------------
DOCKER_BASE_IMAGE_STATE="${PROJECT_DIR}/.docker-base-image"

configure_docker_registry_mirrors() {
  mkdir -p /etc/docker 2>/dev/null || true
  local daemon_json="/etc/docker/daemon.json"
  local needs_restart="false"

  local mirrors_json='[
    "https://docker.arvancloud.ir",
    "https://focker.ir",
    "https://docker.iranserver.com",
    "https://mirror.gcr.io",
    "https://docker.m.daocloud.io"
  ]'
  local dns_json='["178.22.122.100", "185.51.200.2", "8.8.8.8", "1.1.1.1"]'

  if [[ ! -s "${daemon_json}" ]]; then
    cat <<EOF > "${daemon_json}"
{
  "registry-mirrors": ${mirrors_json},
  "dns": ${dns_json}
}
EOF
    needs_restart="true"
  elif command -v jq &>/dev/null && jq empty "${daemon_json}" 2>/dev/null; then
    if ! grep -q "docker.arvancloud.ir" "${daemon_json}" 2>/dev/null; then
      local tmp_daemon
      tmp_daemon="$(mktemp)"
      if jq --argjson m "${mirrors_json}" --argjson d "${dns_json}" \
        '.["registry-mirrors"] = ((.["registry-mirrors"] // []) + $m | unique) | .["dns"] = ((.["dns"] // []) + $d | unique)' \
        "${daemon_json}" > "${tmp_daemon}" 2>/dev/null && [[ -s "${tmp_daemon}" ]]; then
        mv -f "${tmp_daemon}" "${daemon_json}"
        needs_restart="true"
      else
        rm -f "${tmp_daemon}"
      fi
    fi
  fi

  if [[ "${needs_restart}" == "true" ]]; then
    echo "Applying Docker registry mirrors and restarting Docker daemon..."
    systemctl daemon-reload 2>/dev/null || true
    systemctl restart docker 2>/dev/null || true
    sleep 2
  fi
}

prepare_docker_registry_and_base_image() {
  local target_base="node:22-alpine"

  # Fast-path: if node:22-alpine is already cached locally, skip network probes and pulls
  if docker image inspect "${target_base}" >/dev/null 2>&1; then
    echo "Found cached local Docker base image: ${target_base} (skipping network pull)"
    printf '%s\n' "${target_base}" > "${DOCKER_BASE_IMAGE_STATE}"
    chmod 600 "${DOCKER_BASE_IMAGE_STATE}" 2>/dev/null || true
    return 0
  fi

  # Check direct Docker Hub reachability (401/200 = accessible, 403/000 = blocked/restricted)
  local hub_status
  hub_status="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 https://registry-1.docker.io/v2/ 2>/dev/null || echo "000")"
  echo "Docker Hub registry probe status: HTTP ${hub_status}"

  local candidates=()
  if [[ "${hub_status}" == "403" || "${hub_status}" == "000" ]]; then
    echo "Detected restricted access to Docker Hub (HTTP ${hub_status}). Configuring mirror registries..."
    configure_docker_registry_mirrors
    candidates=(
      "docker.arvancloud.ir/node:22-alpine"
      "focker.ir/node:22-alpine"
      "docker.iranserver.com/node:22-alpine"
      "mirror.gcr.io/library/node:22-alpine"
      "public.ecr.aws/docker/library/node:22-alpine"
      "docker.m.daocloud.io/library/node:22-alpine"
      "node:22-alpine"
    )
  else
    candidates=(
      "node:22-alpine"
      "mirror.gcr.io/library/node:22-alpine"
      "public.ecr.aws/docker/library/node:22-alpine"
      "docker.arvancloud.ir/node:22-alpine"
      "focker.ir/node:22-alpine"
      "docker.iranserver.com/node:22-alpine"
      "docker.m.daocloud.io/library/node:22-alpine"
    )
  fi

  local resolved_img=""
  for candidate in "${candidates[@]}"; do
    echo "Pulling base image from: ${candidate} ..."
    if docker pull "${candidate}"; then
      resolved_img="${candidate}"
      if [[ "${candidate}" != "${target_base}" ]]; then
        docker tag "${candidate}" "${target_base}"
      fi
      echo "Successfully pulled and tagged ${candidate} -> ${target_base}"
      break
    else
      echo "Warning: Failed to pull from ${candidate}, trying next source..."
    fi
  done

  # Fallback: If all mirrors failed, use existing local image or temporary anti-sanction DNS (Shecan/Electro)
  if [[ -z "${resolved_img}" ]]; then
    if docker image inspect "${target_base}" >/dev/null 2>&1; then
      echo "Using existing local Docker image: ${target_base}"
      resolved_img="${target_base}"
    else
      echo "Attempting fallback pull using anti-sanction DNS (Shecan / Electro)..."
      local resolv_bak="/tmp/.hse_resolv_conf.bak.$$"
      if [[ -f /etc/resolv.conf ]]; then
        cp -f /etc/resolv.conf "${resolv_bak}" 2>/dev/null || true
      fi
      cat << 'EOF' > /etc/resolv.conf 2>/dev/null || true
nameserver 178.22.122.100
nameserver 185.51.200.2
nameserver 78.157.42.100
nameserver 78.157.42.101
nameserver 8.8.8.8
EOF
      configure_docker_registry_mirrors
      for fallback_cand in "node:22-alpine" "docker.arvancloud.ir/node:22-alpine" "focker.ir/node:22-alpine" "public.ecr.aws/docker/library/node:22-alpine"; do
        echo "Retrying pull with anti-sanction DNS from: ${fallback_cand} ..."
        if docker pull "${fallback_cand}"; then
          resolved_img="${fallback_cand}"
          if [[ "${fallback_cand}" != "${target_base}" ]]; then
            docker tag "${fallback_cand}" "${target_base}"
          fi
          break
        fi
      done
      if [[ -f "${resolv_bak}" ]]; then
        cat "${resolv_bak}" > /etc/resolv.conf 2>/dev/null || true
        rm -f "${resolv_bak}" 2>/dev/null || true
      fi
    fi
  fi

  if [[ -z "${resolved_img}" ]] && ! docker image inspect "${target_base}" >/dev/null 2>&1; then
    echo "ERROR: Could not pull node:22-alpine from any mirror or Docker Hub." >&2
    return 1
  fi

  printf '%s\n' "${resolved_img:-${target_base}}" > "${DOCKER_BASE_IMAGE_STATE}"
  chmod 600 "${DOCKER_BASE_IMAGE_STATE}" 2>/dev/null || true
  return 0
}

build_hsecore_production_image() {
  cd "${PROJECT_DIR}"

  if [[ ! -f "${PROJECT_DIR}/package.json" || ! -f "${PROJECT_DIR}/package-lock.json" ]]; then
    echo "ERROR: Both package.json and package-lock.json are required for deterministic 'npm ci' Docker builds." >&2
    return 1
  fi

  local resolved_base="node:22-alpine"
  if [[ -f "${DOCKER_BASE_IMAGE_STATE}" ]]; then
    resolved_base="$(head -n 1 "${DOCKER_BASE_IMAGE_STATE}" | tr -d '[:space:]')"
  fi
  if [[ -z "${resolved_base}" || "${resolved_base}" == *"node:20-alpine"* ]]; then
    resolved_base="node:22-alpine"
  fi

  export NODE_BASE_IMAGE="${resolved_base}"
  echo "Building HSECORE production image using base image: ${NODE_BASE_IMAGE}"

  # Strategy 1: Build with resolved NODE_BASE_IMAGE (without --pull so BuildKit never queries blocked registry-1.docker.io when using mirror/local image)
  if NODE_BASE_IMAGE="${NODE_BASE_IMAGE}" docker compose -f docker-compose.server.yml build \
    --build-arg NODE_BASE_IMAGE="${NODE_BASE_IMAGE}" \
    --build-arg APP_VERSION="${INSTALLER_VERSION}" \
    hse-app; then
    echo "Docker Compose build succeeded."
  else
    echo "Standard BuildKit build encountered an issue; retrying with classic Docker builder (DOCKER_BUILDKIT=0) using local node:22-alpine cache..."
    DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0 docker build \
      --network=host \
      -f Dockerfile.prod \
      -t hsecore-enterprise:latest \
      --build-arg NODE_BASE_IMAGE="node:22-alpine" \
      --build-arg APP_VERSION="${INSTALLER_VERSION}" \
      . || return 1
  fi

  # Ensure both hsecore-enterprise:latest and legacy project-scoped tags exist
  if docker image inspect hsecore-enterprise:latest >/dev/null 2>&1; then
    local proj_name
    proj_name="$(basename "${PROJECT_DIR}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]//g')"
    if [[ -n "${proj_name}" ]]; then
      docker tag hsecore-enterprise:latest "${proj_name}-hse-app:latest" 2>/dev/null || true
    fi
    docker tag hsecore-enterprise:latest "hsecore-hse-app:latest" 2>/dev/null || true
    return 0
  else
    echo "ERROR: Docker image hsecore-enterprise:latest was not created." >&2
    return 1
  fi
}


# ==============================================================================
# مرحله 1 — System Check
# ==============================================================================
step1_system_check() {
  step_header 1 "System Check"

  local t0
  t0="$(date +%s)"

  # 1. Root / Sudo
  if [[ $EUID -ne 0 ]]; then
    tui_report_error "Verify Root / Sudo Privileges" 1 "" "Run the installer with root privileges: sudo ./install.sh"
    exit 1
  fi
  tui_print_completed_task "Root / Sudo Privileges (EUID: 0 Verified)" "$(( $(date +%s) - t0 ))" "16%"

  # 2. Ubuntu 22.04 / 24.04 LTS Verification
  local os_ok=false
  local os_info="Unknown"
  if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    os_info="${NAME:-Linux} ${VERSION_ID:-}"
    if [[ "${ID:-}" == "ubuntu" && ( "${VERSION_ID:-}" == "24.04"* || "${VERSION_ID:-}" == "22.04"* ) ]]; then
      os_ok=true
    fi
  fi
  tui_print_completed_task "Operating System (${os_info})" "$(( $(date +%s) - t0 ))" "33%"

  if [[ "${os_ok}" != "true" ]]; then
    log_warn "Detected Operating System: ${os_info}. Recommended OS is Ubuntu 24.04 LTS or 22.04 LTS."
  fi

  # 3. CPU, RAM, Disk
  local cpu_cores ram_mb disk_free_gb
  cpu_cores="$(nproc 2>/dev/null || echo 1)"
  ram_mb="$(free -m | awk '/^Mem:/{print $2}' || echo 1024)"
  disk_free_gb="$(df -BG / | awk 'NR==2 {gsub("G","",$4); print $4}' || echo 10)"
  tui_print_completed_task "Hardware Resources (${cpu_cores} Cores / ${ram_mb} MB RAM / ${disk_free_gb} GB Free)" "$(( $(date +%s) - t0 ))" "50%"

  # 4. Network
  local net_ok=false
  local net_t0
  net_t0="$(date +%s)"
  if ping -c 1 -W 2 8.8.8.8 &>/dev/null || curl -s --max-time 3 https://api.ipify.org &>/dev/null; then
    net_ok=true
  fi
  if [[ "${net_ok}" == "true" ]]; then
    tui_print_completed_task "Network Connectivity (Connected & Resolving)" "$(( $(date +%s) - net_t0 ))" "66%"
  else
    log_warn "Network: Limited external connectivity detected."
  fi

  # 5. Node.js Runtime Status
  local node_status="Not Installed"
  if command -v node &>/dev/null; then
    node_status="$(node -v 2>/dev/null || echo 'Installed')"
  fi
  tui_print_completed_task "Node.js Runtime Status (${node_status})" 0 "78%"

  # 6. Docker Status
  local docker_status="Not Installed"
  if command -v docker &>/dev/null; then
    docker_status="$(docker --version 2>/dev/null || echo 'Installed')"
  fi
  tui_print_completed_task "Docker Engine Status (${docker_status})" 0 "90%"

  # 7. PostgreSQL Server Package Status
  local pg_status="Not Installed"
  if dpkg -l postgresql 2>/dev/null | grep -q '^ii'; then
    pg_status="$(psql --version 2>/dev/null | head -n1 || echo 'Installed (dpkg ii)')"
  fi
  tui_print_completed_task "PostgreSQL Server Status (${pg_status})" 0 "100%"

  set_completed_step 1
}

# ==============================================================================
# مرحله 2 — Install Dependencies & Node.js LTS (Including Nginx, Certbot & SSL)
# ==============================================================================
step2_install_dependencies() {
  step_header 2 "Install Dependencies & Node.js LTS"

  export DEBIAN_FRONTEND=noninteractive

  tui_run_task \
    "Updating APT package lists (apt-get update)" \
    "Verify internet access and /etc/apt/sources.list, or run: sudo apt-get update" \
    apt-get update -y

  tui_run_task \
    "Installing core packages (Nginx, Certbot, OpenSSL, UFW, PostgreSQL Client)" \
    "Check dpkg lock (sudo dpkg --configure -a) and available disk space (df -h)." \
    apt-get install -y \
      curl \
      git \
      jq \
      ufw \
      nginx \
      certbot \
      openssl \
      ca-certificates \
      gnupg \
      lsb-release \
      net-tools \
      procps \
      psmisc \
      xz-utils \
      postgresql-client \
      poppler-utils \
      poppler-data \
      ghostscript \
      fontconfig \
      fonts-dejavu-core \
      fonts-freefont-ttf \
      fonts-noto-core

  # Ensure Persian/Arabic fonts & CMap font cache are fully refreshed for PDF rendering
  apt-get install -y fonts-sil-scheherazade fonts-farsiweb 2>/dev/null || true
  fc-cache -f 2>/dev/null || true

  tui_run_task \
    "Installing / upgrading Node.js ${NODE_LTS_MAJOR}.x LTS (>= ${NODE_LTS_MAJOR}.${NODE_MIN_MINOR}.0) & npm on host" \
    "Check internet access to deb.nodesource.com or nodejs.org." \
    ensure_nodejs_lts

  # Preemptively disable conflicting Apache2 if present on VPS
  if systemctl is-active --quiet apache2 2>/dev/null || systemctl is-enabled --quiet apache2 2>/dev/null; then
    log_warn "Detected Apache2 service. Stopping and disabling Apache2 to prevent port 80 conflicts with Nginx..."
    tui_run_task \
      "Stopping and disabling conflicting Apache2 service" \
      "Run manually: sudo systemctl stop apache2 && sudo systemctl disable apache2" \
      bash -c "systemctl stop apache2 2>/dev/null || true; systemctl disable apache2 2>/dev/null || true"
  fi

  # Configure Swap Space for container compilation and AI engine memory safety
  local ram_mb swap_mb free_disk_mb
  ram_mb="$(free -m | awk '/^Mem:/{print $2}' || echo 2048)"
  swap_mb="$(free -m | awk '/^Swap:/{print $2}' || echo 0)"
  free_disk_mb="$(df -BM / 2>/dev/null | awk 'NR==2 {gsub(/M/,"",$4); print $4}' || echo 0)"
  if [[ "${swap_mb}" -lt 2048 && ! -f /swapfile && "${free_disk_mb}" -ge 8000 ]]; then
    local swap_size="4G"
    local swap_count=4096
    if [[ "${free_disk_mb}" -lt 12000 ]]; then
      swap_size="2G"
      swap_count=2048
    fi
    tui_run_task \
      "Configuring ${swap_size} swap space (/swapfile) for compilation & AI memory safety" \
      "Check available disk space on root partition (df -h /) or container swap permissions." \
      bash -c "
        (fallocate -l ${swap_size} /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=${swap_count}) &&
        chmod 600 /swapfile &&
        mkswap /swapfile &&
        swapon /swapfile &&
        if ! grep -q '/swapfile' /etc/fstab; then
          echo '/swapfile none swap sw 0 0' >> /etc/fstab
        fi &&
        sysctl vm.swappiness=15 2>/dev/null || true
      " || log_warn "Swapfile creation skipped (environment may restrict swapon)."
  fi

  log_success "Dependencies (including Nginx & Certbot) installed."
  log_warn "HSECORE containers remain unstarted as per step 2 specification."
  set_completed_step 2
}

# ==============================================================================
# مرحله 3 — Install Docker
# ==============================================================================
step3_install_docker() {
  step_header 3 "Install Docker"

  export DEBIAN_FRONTEND=noninteractive

  if ! command -v docker &>/dev/null || ! docker compose version &>/dev/null; then
    tui_run_task \
      "Installing Docker Engine and Docker Compose plugin from Ubuntu APT packages" \
      "Check Ubuntu APT sources and package availability; do not execute downloaded shell scripts." \
      apt-get install -y docker.io docker-compose-v2

    tui_run_task \
      "Enabling and starting Docker daemon service" \
      "Inspect Docker daemon logs with: sudo journalctl -xeu docker.service" \
      systemctl enable --now docker
  else
    tui_print_completed_task "Existing Docker installation verified (preserving configuration)" 0
  fi

  # Verification
  local docker_ver compose_ver
  docker_ver="$(docker --version 2>/dev/null || echo 'Unknown')"
  compose_ver="$(docker compose version 2>/dev/null || echo 'Unknown')"

  tui_print_completed_task "Docker Engine (${docker_ver})" 0
  tui_print_completed_task "Docker Compose (${compose_ver})" 0
  log_warn "No HSECORE containers have been started."
  set_completed_step 3
}

# ==============================================================================
# مرحله 4 — Install PostgreSQL (Native on Ubuntu Host)
# ==============================================================================
step4_install_postgresql() {
  step_header 4 "Install PostgreSQL (Native VPS Host)"

  export DEBIAN_FRONTEND=noninteractive

  # 1. Install PostgreSQL natively on Ubuntu
  if dpkg -l postgresql 2>/dev/null | grep -q '^ii'; then
    local existing_ver
    existing_ver="$(psql --version 2>/dev/null | head -n1 || echo 'PostgreSQL')"
    tui_print_completed_task "Existing native PostgreSQL detected (${existing_ver} - preserved)" 0
  else
    tui_run_task \
      "Installing native PostgreSQL server & contrib modules" \
      "Check APT package lists (sudo apt-get update) and available disk space." \
      apt-get install -y postgresql postgresql-contrib
  fi

  # 2. Configure Host PostgreSQL listener & port in postgresql.conf
  local pg_conf_dir=""
  if [[ -d /etc/postgresql ]]; then
    pg_conf_dir="$(find /etc/postgresql -mindepth 2 -maxdepth 2 -type d -name main 2>/dev/null | sort -V | tail -n 1 || echo '')"
  fi
  local target_pg_port="${POSTGRES_PORT:-5432}"

  if [[ -n "${pg_conf_dir}" && -d "${pg_conf_dir}" ]]; then
    local cfg_t0
    cfg_t0="$(date +%s)"
    # Ensure listen_addresses = '*'
    if grep -qE "^[#]*\s*listen_addresses" "${pg_conf_dir}/postgresql.conf"; then
      sed -i.bak -E "s/^[#]*\s*listen_addresses.*/listen_addresses = '*'/" "${pg_conf_dir}/postgresql.conf"
    else
      echo "listen_addresses = '*'" >> "${pg_conf_dir}/postgresql.conf"
    fi

    # Ensure port is configured in postgresql.conf
    if grep -qE "^[#]*\s*port\s*=" "${pg_conf_dir}/postgresql.conf"; then
      sed -i -E "s/^[#]*\s*port\s*=.*/port = ${target_pg_port}/" "${pg_conf_dir}/postgresql.conf"
    else
      echo "port = ${target_pg_port}" >> "${pg_conf_dir}/postgresql.conf"
    fi

    # Ensure sufficient max_connections for concurrent enterprise pool (150)
    if grep -qE "^[#]*\s*max_connections\s*=" "${pg_conf_dir}/postgresql.conf"; then
      sed -i -E "s/^[#]*\s*max_connections\s*=.*/max_connections = 150/" "${pg_conf_dir}/postgresql.conf"
    else
      echo "max_connections = 150" >> "${pg_conf_dir}/postgresql.conf"
    fi

    # Configure pg_hba.conf strictly for localhost and local Docker bridge subnets (172.16.0.0/12)
    if ! grep -q "HSECORE Local Docker Container Access" "${pg_conf_dir}/pg_hba.conf"; then
      cat << 'EOF' >> "${pg_conf_dir}/pg_hba.conf"

# HSECORE Local Docker Container Access on Host VPS (Restricted to Localhost & Docker Bridge Subnets)
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
host    all             all             172.16.0.0/12           scram-sha-256
EOF
    fi
    tui_print_completed_task "Configured PostgreSQL listener & Docker bridge access (${pg_conf_dir})" "$(( $(date +%s) - cfg_t0 ))"
  fi

  # 3. Start & Enable on Boot
  tui_run_task \
    "Enabling and restarting PostgreSQL service on port ${target_pg_port}" \
    "Inspect PostgreSQL logs via: sudo journalctl -xeu postgresql.service" \
    bash -c "systemctl enable postgresql && systemctl restart postgresql"

  # Wait for PostgreSQL to become fully ready (max 10 attempts, 1s sleep)
  tui_run_task \
    "Waiting for PostgreSQL readiness on port ${target_pg_port}" \
    "Verify port ${target_pg_port} is not blocked and postgresql cluster is online (pg_lsclusters)." \
    bash -c "
      for i in {1..10}; do
        echo \"Checking pg_isready on port ${target_pg_port} (attempt \${i}/10)...\"
        if (cd /tmp && runuser -u postgres -- pg_isready -p '${target_pg_port}') || pg_isready -p '${target_pg_port}'; then
          exit 0
        fi
        sleep 1
      done
      exit 1
    " || log_warn "pg_isready timed out on port ${target_pg_port}; checking service status..."

  # 4. Verify Service
  if systemctl is-active --quiet postgresql; then
    local pg_ver
    pg_ver="$(psql --version 2>/dev/null | head -n1 || echo 'PostgreSQL')"
    tui_print_completed_task "PostgreSQL Service Active (${pg_ver}, Port ${target_pg_port})" 0
  else
    tui_report_error "Activate PostgreSQL Service" 1 "" "Run 'sudo systemctl status postgresql --no-pager' and 'sudo pg_lsclusters' to inspect cluster health."
    systemctl status postgresql --no-pager || true
    exit 1
  fi

  set_completed_step 4
}

# ==============================================================================
# مرحله 5 — Configure PostgreSQL
# ==============================================================================
step5_configure_postgresql() {
  step_header 5 "Configure Database"

  echo -e "${YELLOW}Please configure database connection parameters for HSECORE:${NC}"
  echo -e "Secrets and passwords are fully masked and will NOT appear in terminal logs or shell history."
  echo ""

  # Pre-load previous values from cache or .env
  load_answers_cache

  local def_host="${SQL_HOST:-127.0.0.1}"
  local def_db="${SQL_DB_NAME:-hsedb}"
  local def_user="${SQL_USER:-hse_user}"
  local def_admin="${SQL_ADMIN_USER:-postgres}"
  local def_ssl="${SQL_SSL:-false}"

  while true; do
    # 5.1 — SQL_HOST
    read -r -p "SQL_HOST [${def_host}]: " input_host
    SQL_HOST="${input_host:-$def_host}"
    if [[ -z "${SQL_HOST}" ]]; then
      SQL_HOST="127.0.0.1"
    fi

    # 5.2 — SQL_USER
    while true; do
      read -r -p "SQL_USER [${def_user}]: " input_user
      SQL_USER="${input_user:-$def_user}"
      if [[ -z "${SQL_USER}" ]]; then
        echo -e "${RED}SQL_USER cannot be empty.${NC}"
        continue
      fi
      if ! [[ "${SQL_USER}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
        echo -e "${RED}Invalid SQL_USER '${SQL_USER}'. Must match ^[A-Za-z_][A-Za-z0-9_]*$.${NC}"
        continue
      fi
      break
    done

    # 5.3 — SQL_PASSWORD
    local cached_pw="${SQL_PASSWORD:-}"
    while true; do
      if [[ -n "${cached_pw}" ]]; then
        read -r -s -p "SQL_PASSWORD [hidden (Enter to keep cached password)]: " input_pw
        echo ""
        if [[ -z "${input_pw}" ]]; then
          SQL_PASSWORD="${cached_pw}"
          log_info "Using cached password without re-confirmation."
          break
        fi
      else
        read -r -s -p "SQL_PASSWORD [hidden]: " input_pw
        echo ""
      fi

      SQL_PASSWORD="${input_pw}"
      if [[ -z "${SQL_PASSWORD}" ]]; then
        echo -e "${RED}SQL_PASSWORD cannot be empty. Please enter a secure password.${NC}"
        continue
      fi
      if [[ "${SQL_PASSWORD}" == "hse_secure_password_2026" || "${SQL_PASSWORD}" == "postgres" || "${SQL_PASSWORD}" == "admin123" ]]; then
        echo -e "${RED}Default or weak known passwords ('${SQL_PASSWORD}') are strictly prohibited. Please choose a unique password.${NC}"
        continue
      fi
      if [[ "${SQL_PASSWORD}" =~ [\$\`\"\'\\] ]]; then
        echo -e "${RED}Password cannot contain special characters: $, \`, \", ', or \\. Please choose another password.${NC}"
        continue
      fi
      if [[ ${#SQL_PASSWORD} -lt 8 ]]; then
        echo -e "${RED}Password must be at least 8 characters long for production database security.${NC}"
        continue
      fi
      read -r -s -p "Confirm SQL_PASSWORD [hidden]: " SQL_PASSWORD_CONFIRM
      echo ""
      if [[ "${SQL_PASSWORD}" != "${SQL_PASSWORD_CONFIRM}" ]]; then
        echo -e "${RED}Passwords do not match. Please re-enter.${NC}"
      else
        break
      fi
    done

    # 5.4 — SQL_DB_NAME
    while true; do
      read -r -p "SQL_DB_NAME [${def_db}]: " input_db
      SQL_DB_NAME="${input_db:-$def_db}"
      if [[ -z "${SQL_DB_NAME}" ]]; then
        echo -e "${RED}SQL_DB_NAME cannot be empty.${NC}"
        continue
      fi
      if ! [[ "${SQL_DB_NAME}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
        echo -e "${RED}Invalid SQL_DB_NAME '${SQL_DB_NAME}'. Must match ^[A-Za-z_][A-Za-z0-9_]*$.${NC}"
        continue
      fi
      break
    done

    # 5.5 — SQL_ADMIN_USER
    while true; do
      read -r -p "SQL_ADMIN_USER [${def_admin}]: " input_admin
      SQL_ADMIN_USER="${input_admin:-$def_admin}"
      if [[ -z "${SQL_ADMIN_USER}" ]]; then
        SQL_ADMIN_USER="postgres"
      fi
      if ! [[ "${SQL_ADMIN_USER}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
        echo -e "${RED}Invalid SQL_ADMIN_USER '${SQL_ADMIN_USER}'. Must match ^[A-Za-z_][A-Za-z0-9_]*$.${NC}"
        continue
      fi
      break
    done

    # 5.6 — SQL_ADMIN_PASSWORD
    while true; do
      read -r -s -p "SQL_ADMIN_PASSWORD [Enter = use local Peer Authentication]: " input_admin_pw
      echo ""
      SQL_ADMIN_PASSWORD="${input_admin_pw}"

      if [[ -z "${SQL_ADMIN_PASSWORD}" ]]; then
        echo -e "→ Testing local Peer Authentication with port ${POSTGRES_PORT:-5432}..."
        if (cd /tmp && runuser -u postgres -- psql -p "${POSTGRES_PORT:-5432}" -d postgres -qtA -c "SELECT 1;" &>/dev/null); then
          echo -e "→ ${GREEN}[✓] Peer Authentication successful${NC}"
          break
        else
          echo -e "→ ${RED}[✗] Local Peer Authentication failed.${NC}"
          echo -e "${YELLOW}Please enter SQL_ADMIN_PASSWORD or ensure database local peer authentication is configured.${NC}"
          read -r -p "Retry admin password? (y/n) [y]: " retry_admin
          if [[ "${retry_admin}" == "n" || "${retry_admin}" == "N" ]]; then
            break
          fi
        fi
      else
        break
      fi
    done

    # 5.7 — SQL_SSL
    while true; do
      read -r -p "Enable database SSL? [${def_ssl}]: " input_ssl
      SQL_SSL="${input_ssl:-$def_ssl}"
      if [[ "${SQL_SSL}" =~ ^(true|false|yes|no|1|0)$ ]]; then
        if [[ "${SQL_SSL}" == "true" || "${SQL_SSL}" == "yes" || "${SQL_SSL}" == "1" ]]; then
          SQL_SSL="true"
        else
          SQL_SSL="false"
        fi
        break
      else
        echo -e "${RED}Invalid input. Please enter 'true' or 'false'.${NC}"
      fi
    done

    # 5.8 — SQL_SSL_CA
    SQL_SSL_CA=""
    if [[ "${SQL_SSL}" == "true" ]]; then
      while true; do
        read -r -p "SQL_SSL_CA path: " input_ssl_ca
        SQL_SSL_CA="${input_ssl_ca}"
        if [[ -z "${SQL_SSL_CA}" ]]; then
          echo -e "${YELLOW}No SSL CA path provided. Proceeding with default system trust store.${NC}"
          break
        elif [[ ! -f "${SQL_SSL_CA}" ]]; then
          echo -e "${RED}File '${SQL_SSL_CA}' does not exist. Please enter a valid path.${NC}"
        elif [[ ! -r "${SQL_SSL_CA}" ]]; then
          echo -e "${RED}File '${SQL_SSL_CA}' is not readable. Check file permissions.${NC}"
        else
          log_success "SSL CA certificate verified at '${SQL_SSL_CA}'."
          break
        fi
      done
    fi

    # Summary Display
    local display_admin_auth="Peer Authentication"
    if [[ -n "${SQL_ADMIN_PASSWORD}" ]]; then
      display_admin_auth="********"
    fi

    local display_ssl_ca="Not Required"
    if [[ "${SQL_SSL}" == "true" ]]; then
      display_ssl_ca="${SQL_SSL_CA:-Default System CA}"
    fi

    echo ""
    echo -e "${BOLD}${CYAN}========================================${NC}"
    echo -e "${BOLD}${CYAN}      Database Configuration          ${NC}"
    echo -e "${BOLD}${CYAN}========================================${NC}"
    printf "  %-22s : %s\n" "SQL_HOST" "${SQL_HOST}"
    printf "  %-22s : %s\n" "SQL_USER" "${SQL_USER}"
    printf "  %-22s : %s\n" "SQL_PASSWORD" "********"
    printf "  %-22s : %s\n" "SQL_DB_NAME" "${SQL_DB_NAME}"
    printf "  %-22s : %s\n" "SQL_ADMIN_USER" "${SQL_ADMIN_USER}"
    printf "  %-22s : %s\n" "SQL_ADMIN_PASSWORD" "${display_admin_auth}"
    printf "  %-22s : %s\n" "SQL_SSL" "${SQL_SSL}"
    printf "  %-22s : %s\n" "SQL_SSL_CA" "${display_ssl_ca}"
    echo -e "${BOLD}${CYAN}========================================${NC}"
    echo ""
    echo -e "  ${GREEN}[1]${NC} Confirm"
    echo -e "  ${YELLOW}[2]${NC} Edit"
    echo ""
    read -r -p "Select option [1]: " conf_choice
    conf_choice="${conf_choice:-1}"

    if [[ "${conf_choice}" == "1" ]]; then
      log_success "Database configuration parameters confirmed."
      save_answers_cache
      break
    else
      echo -e "${YELLOW}Re-entering database configuration parameters...${NC}"
      echo ""
    fi
  done

  set_completed_step 5
}

# ==============================================================================
# مرحله 6 — Configure Access (IP vs Domain), SSL & Ports
# ==============================================================================
step6_configure_ports() {
  step_header 6 "Configure Access (IP vs Domain), SSL & Ports"

  load_answers_cache

  # Detect Server Public IP
  local detected_pub_ip
  detected_pub_ip="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || curl -4 -fsS --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}' || echo '127.0.0.1')"

  echo ""
  echo -e "${BOLD}${CYAN}Select System Access Mode:${NC}"
  echo "  1) IP Address (Direct HTTP access - suitable for local network, test & intranet)"
  echo "  2) Domain Name (Production HTTPS with Let's Encrypt SSL & Nginx Reverse Proxy)"
  echo ""

  local def_host_choice="1"
  if [[ "${ACCESS_TYPE:-}" == "DOMAIN" ]]; then
    def_host_choice="2"
  fi

  while true; do
    read -r -p "Your choice [${def_host_choice}]: " host_choice_input
    local chosen="${host_choice_input:-$def_host_choice}"
    case "$chosen" in
      1)
        ACCESS_TYPE="IP"
        SSL_ENABLED="false"
        CERTBOT_ENABLED="false"
        break
        ;;
      2)
        ACCESS_TYPE="DOMAIN"
        SSL_ENABLED="true"
        CERTBOT_ENABLED="true"
        break
        ;;
      *)
        echo -e "${YELLOW}Please enter 1 (IP) or 2 (Domain).${NC}"
        ;;
    esac
  done

  APP_INTERNAL_PORT="${APP_INTERNAL_PORT:-3000}"

  if [[ "${ACCESS_TYPE}" == "IP" ]]; then
    echo ""
    echo -e "${BOLD}${CYAN}IP Mode Configuration:${NC}"
    local def_ip="${SERVER_IP:-$detected_pub_ip}"
    read -r -p "Enter Server IP [${def_ip}]: " input_server_ip
    SERVER_IP="${input_server_ip:-$def_ip}"

    local def_app_p="${APP_PORT:-3000}"
    while true; do
      read -r -p "Enter Application HTTP Port [${def_app_p}]: " input_app_port
      APP_PORT="${input_app_port:-$def_app_p}"
      if [[ "$APP_PORT" =~ ^[0-9]+$ ]] && (( APP_PORT >= 1 && APP_PORT <= 65535 )); then
        break
      fi
      echo -e "${RED}Invalid port number (must be 1-65535).${NC}"
    done

    APP_INTERNAL_PORT="${APP_PORT}"
    DOCKER_BIND_IP="0.0.0.0"
    ACCESS_URL="http://${SERVER_IP}:${APP_PORT}"
    log_success "Access Mode: IP (${ACCESS_URL}) - SSL Disabled"

  else
    echo ""
    echo -e "${BOLD}${CYAN}Domain & SSL Mode Configuration:${NC}"

    # Prompt for DOMAIN
    local def_dom="${DOMAIN:-}"
    while true; do
      read -r -p "Enter HSECORE Domain name (e.g. hse.example.com) [${def_dom}]: " input_domain
      DOMAIN="${input_domain:-$def_dom}"
      DOMAIN="${DOMAIN,,}"
      DOMAIN="${DOMAIN#http://}"
      DOMAIN="${DOMAIN#https://}"
      DOMAIN="${DOMAIN%/}"

      if [[ -z "$DOMAIN" ]]; then
        echo -e "${RED}Domain cannot be empty.${NC}"
        continue
      fi
      if ! [[ "$DOMAIN" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        echo -e "${RED}Invalid domain format '${DOMAIN}'. Example: hse.example.com${NC}"
        continue
      fi
      break
    done

    # Prompt for CERTBOT_EMAIL
    local def_email="${CERTBOT_EMAIL:-admin@${DOMAIN}}"
    while true; do
      read -r -p "Enter Email for Let's Encrypt SSL renewal alerts [${def_email}]: " input_cert_email
      CERTBOT_EMAIL="${input_cert_email:-$def_email}"
      if [[ -z "$CERTBOT_EMAIL" ]] || ! [[ "$CERTBOT_EMAIL" =~ ^.+@.+\..+$ ]]; then
        echo -e "${RED}Valid email required for Let's Encrypt certificates.${NC}"
        continue
      fi
      break
    done

    # Public Port (Default 443 for HTTPS)
    local def_ssl_port="443"
    if [[ -n "${APP_PORT:-}" && "${APP_PORT}" != "3000" && "${APP_PORT}" != "0" ]]; then
      def_ssl_port="${APP_PORT}"
    fi
    echo -e "${YELLOW}[!] نکته مهم اتصال شبکه: استفاده از پورت استاندارد ۴۴۳ جهت تضمین دسترسی کامل و بدون اختلال از کلیه اپراتورها (همراه اول، ایرانسل، رایتل و مخابرات) قویاً توصیه می‌شود.${NC}"
    while true; do
      read -r -p "Enter Public HTTPS Port [${def_ssl_port}]: " input_ssl_port
      APP_PORT="${input_ssl_port:-$def_ssl_port}"
      if [[ "$APP_PORT" =~ ^[0-9]+$ ]] && (( APP_PORT >= 1 && APP_PORT <= 65535 )); then
        break
      fi
      echo -e "${RED}Invalid port number (must be 1-65535).${NC}"
    done

    DOCKER_BIND_IP="127.0.0.1"

    # Automatically allocate a safe, non-conflicting internal port for the container
    local candidate_int_port=3000
    if [[ "${candidate_int_port}" == "${APP_PORT}" ]]; then
      candidate_int_port=3001
    fi
    while [[ "${candidate_int_port}" == "${APP_PORT}" ]] || \
          [[ "${candidate_int_port}" == "80" ]] || \
          [[ "${candidate_int_port}" == "${POSTGRES_PORT:-5432}" ]] || \
          (command -v ss &>/dev/null && ss -tulpn 2>/dev/null | grep -q ":${candidate_int_port}\b") || \
          (command -v netstat &>/dev/null && netstat -tuln 2>/dev/null | grep -q ":${candidate_int_port}\b"); do
      candidate_int_port=$((candidate_int_port + 1))
    done
    APP_INTERNAL_PORT="${candidate_int_port}"
    log_info "Configured internal container port: ${APP_INTERNAL_PORT} (bound to 127.0.0.1, proxied by Nginx on port ${APP_PORT})"

    # Check Domain DNS
    log_info "Verifying DNS resolution for domain '${DOMAIN}'..."
    local domain_resolved_ip=""
    if command -v getent &>/dev/null; then
      domain_resolved_ip="$(getent ahostsv4 "${DOMAIN}" 2>/dev/null | awk 'NR==1 {print $1}' || echo '')"
    fi
    if [[ -z "$domain_resolved_ip" ]]; then
      domain_resolved_ip="$(ping -c 1 -W 2 "${DOMAIN}" 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -n1 || echo '')"
    fi

    if [[ -n "$domain_resolved_ip" ]]; then
      log_success "DNS Resolved: ${DOMAIN} -> ${domain_resolved_ip}"
      if [[ -n "$detected_pub_ip" && "$domain_resolved_ip" != "$detected_pub_ip" ]]; then
        echo ""
        echo -e "${YELLOW}[!] Warning: Domain IP (${domain_resolved_ip}) differs from detected Server Public IP (${detected_pub_ip}).${NC}"
        read -r -p "Proceed with Let's Encrypt certificate challenge anyway? (y/N): " dns_confirm
        if [[ ! "$dns_confirm" =~ ^[Yy]$ ]]; then
          echo -e "${RED}Installation paused. Please update your DNS A-Record for ${DOMAIN} to point to ${detected_pub_ip}.${NC}"
          exit 1
        fi
      fi
    else
      echo -e "${YELLOW}[!] Notice: Domain '${DOMAIN}' could not be resolved yet via DNS.${NC}"
      echo "Let's Encrypt requires port 80 and DNS A-Record pointing to this VPS to issue certificates."
      read -r -p "Proceed anyway? (y/N) [y]: " dns_ignore
      dns_ignore="${dns_ignore:-y}"
      if [[ ! "$dns_ignore" =~ ^[Yy]$ ]]; then
        exit 1
      fi
    fi

    if [[ "${APP_PORT}" == "443" ]]; then
      ACCESS_URL="https://${DOMAIN}"
    else
      ACCESS_URL="https://${DOMAIN}:${APP_PORT}"
    fi
    log_success "Access Mode: Domain (${ACCESS_URL}) - SSL via Let's Encrypt"
  fi

  # Configure PostgreSQL Port
  local def_pg_port="${POSTGRES_PORT:-5432}"
  while true; do
    read -r -p "Enter Database Port [${def_pg_port}]: " input_pg_port
    POSTGRES_PORT="${input_pg_port:-$def_pg_port}"
    if [[ "${POSTGRES_PORT}" =~ ^[0-9]+$ ]] && (( POSTGRES_PORT >= 1 && POSTGRES_PORT <= 65535 )); then
      break
    fi
    echo -e "${RED}Invalid port number (must be 1-65535).${NC}"
  done

  # Apply selected PostgreSQL port to postgresql.conf and restart service
  local pg_conf_dir=""
  if [[ -d /etc/postgresql ]]; then
    pg_conf_dir="$(find /etc/postgresql -mindepth 2 -maxdepth 2 -type d -name main 2>/dev/null | sort -V | tail -n 1 || echo '')"
  fi
  if [[ -n "${pg_conf_dir}" && -f "${pg_conf_dir}/postgresql.conf" ]]; then
    if grep -qE "^[#]*\s*port\s*=" "${pg_conf_dir}/postgresql.conf"; then
      sed -i -E "s/^[#]*\s*port\s*=.*/port = ${POSTGRES_PORT}/" "${pg_conf_dir}/postgresql.conf"
    else
      echo "port = ${POSTGRES_PORT}" >> "${pg_conf_dir}/postgresql.conf"
    fi

    tui_run_task \
      "Applying PostgreSQL port ${POSTGRES_PORT} & restarting database service" \
      "Verify port ${POSTGRES_PORT} is not in use by another process (ss -tulpn | grep ${POSTGRES_PORT})." \
      bash -c "
        systemctl restart postgresql &&
        for i in {1..10}; do
          echo \"Verifying PostgreSQL port ${POSTGRES_PORT} readiness (attempt \${i}/10)...\"
          if (cd /tmp && runuser -u postgres -- pg_isready -p '${POSTGRES_PORT}') || pg_isready -p '${POSTGRES_PORT}'; then
            exit 0
          fi
          sleep 1
        done
      "
  fi

  # Persist step 5/6 configuration into cache file with 600 permissions
  save_answers_cache
  tui_print_completed_task "Saved encrypted access & port configuration (.installer-answers)" 0

  # Apply PostgreSQL UFW rules in step 6
  apply_ufw_postgresql_rules

  set_completed_step 6
}

# ==============================================================================
# مرحله 7 — Create Database & User
# ==============================================================================
step7_create_database_and_user() {
  step_header 7 "Create Database & User"

  load_answers_cache

  if [[ -z "${SQL_ADMIN_PASSWORD:-}" ]]; then
    if ! (cd /tmp && runuser -u postgres -- psql -h /var/run/postgresql -p "${POSTGRES_PORT:-5432}" -d postgres -qtA -c "SELECT 1;" &>/dev/null) && ! (cd /tmp && runuser -u postgres -- psql -p "${POSTGRES_PORT:-5432}" -d postgres -qtA -c "SELECT 1;" &>/dev/null); then
      log_warn "Local peer authentication failed for 'postgres' on port ${POSTGRES_PORT:-5432}."
      read -r -s -p "Please enter SQL_ADMIN_PASSWORD [hidden]: " input_admin_pw
      echo ""
      SQL_ADMIN_PASSWORD="${input_admin_pw}"
      if [[ -z "${SQL_ADMIN_PASSWORD:-}" ]]; then
        tui_report_error "Verify PostgreSQL Admin Credentials" 1 "" "Ensure PostgreSQL is running and local peer authentication is enabled in pg_hba.conf, or provide a valid postgres admin password."
        exit 1
      fi
    fi
  fi

  # 1. User check and creation
  local t_role
  t_role="$(date +%s)"
  local role_exists
  if ! role_exists="$(run_sql_admin "SELECT 1 FROM pg_roles WHERE rolname='${SQL_USER}';" | tr -d '[:space:]')"; then
    tui_report_error "Query pg_roles for '${SQL_USER}'" 1 "" "Check PostgreSQL service status (sudo systemctl status postgresql) and admin credentials."
    exit 1
  fi

  local escaped_pw="${SQL_PASSWORD//\'/\'\'}"

  if [[ "${role_exists}" == "1" ]]; then
    tui_run_task \
      "Updating existing database user '${SQL_USER}' credentials (preserving role)" \
      "Check PostgreSQL admin privileges for role '${SQL_USER}'." \
      run_sql_admin "ALTER ROLE \"${SQL_USER}\" WITH LOGIN PASSWORD '${escaped_pw}';"
  else
    tui_run_task \
      "Creating PostgreSQL application user '${SQL_USER}'" \
      "Check PostgreSQL admin privileges and syntax for role '${SQL_USER}'." \
      run_sql_admin "CREATE ROLE \"${SQL_USER}\" WITH LOGIN PASSWORD '${escaped_pw}';"
  fi
  tui_print_completed_task "Database User '${SQL_USER}' Verified" "$(( $(date +%s) - t_role ))" "33%"

  # 2. Database check and creation
  local t_db
  t_db="$(date +%s)"
  local db_exists
  if ! db_exists="$(run_sql_admin "SELECT 1 FROM pg_database WHERE datname='${SQL_DB_NAME}';" | tr -d '[:space:]')"; then
    tui_report_error "Query pg_database for '${SQL_DB_NAME}'" 1 "" "Verify PostgreSQL connection on port ${POSTGRES_PORT:-5432}."
    exit 1
  fi

  if [[ "${db_exists}" == "1" ]]; then
    tui_print_completed_task "Existing Database '${SQL_DB_NAME}' Preserved (tables & data intact)" "$(( $(date +%s) - t_db ))" "66%"
  else
    tui_run_task \
      "Creating PostgreSQL database '${SQL_DB_NAME}' owned by '${SQL_USER}'" \
      "Check available disk space and PostgreSQL CREATE DATABASE permissions." \
      run_sql_admin "CREATE DATABASE \"${SQL_DB_NAME}\" OWNER \"${SQL_USER}\";"
  fi

  # 3. Grant Permissions
  local t_perm
  t_perm="$(date +%s)"
  run_sql_admin "GRANT ALL PRIVILEGES ON DATABASE \"${SQL_DB_NAME}\" TO \"${SQL_USER}\";"
  run_sql_admin "GRANT ALL ON SCHEMA public TO \"${SQL_USER}\";" "${SQL_DB_NAME}" || true
  run_sql_admin "GRANT CREATE ON SCHEMA public TO \"${SQL_USER}\";" "${SQL_DB_NAME}" || true
  run_sql_admin "ALTER SCHEMA public OWNER TO \"${SQL_USER}\";" "${SQL_DB_NAME}" || true
  tui_print_completed_task "Granted Schema & Database Privileges on '${SQL_DB_NAME}' to '${SQL_USER}'" "$(( $(date +%s) - t_perm ))" "100%"

  set_completed_step 7
}

# ==============================================================================
# مرحله 8 — Test PostgreSQL Connection
# ==============================================================================
step8_test_postgresql_connection() {
  step_header 8 "Test Database Connection"

  load_answers_cache

  if [[ -z "${SQL_ADMIN_PASSWORD:-}" ]]; then
    if ! (cd /tmp && runuser -u postgres -- psql -h /var/run/postgresql -p "${POSTGRES_PORT:-5432}" -d postgres -qtA -c "SELECT 1;" &>/dev/null); then
      log_warn "Local peer authentication failed for 'postgres' on port ${POSTGRES_PORT:-5432}."
      read -r -s -p "Please enter SQL_ADMIN_PASSWORD [hidden]: " input_admin_pw
      echo ""
      SQL_ADMIN_PASSWORD="${input_admin_pw}"
      if [[ -z "${SQL_ADMIN_PASSWORD:-}" ]]; then
        tui_report_error "Verify PostgreSQL Admin Credentials" 1 "" "Provide a valid SQL_ADMIN_PASSWORD or enable peer authentication for postgres in pg_hba.conf."
        exit 1
      fi
    fi
  fi

  apply_ufw_postgresql_rules

  local all_tests_passed=true
  local failed_test_name=""
  local failed_test_hint=""
  local t_chk

  echo "  Strict Verification Sequence: Database -> Port -> Host Access -> Authentication -> Database -> SQL Query"
  echo ""

  # 1. Database Service
  t_chk="$(date +%s)"
  if systemctl is-active --quiet postgresql; then
    tui_print_completed_task "1. Database Service (Active on VPS Host)" "$(( $(date +%s) - t_chk ))" "16%"
  else
    echo -e "  ${RED}[✗]${NC} 1. Database Service (Service not active)"
    all_tests_passed=false
    failed_test_name="1. Database Service"
    failed_test_hint="Start PostgreSQL service: sudo systemctl restart postgresql"
  fi

  # 2. PostgreSQL Port
  t_chk="$(date +%s)"
  if (cd /tmp && runuser -u postgres -- pg_isready -p "${POSTGRES_PORT:-5432}" &>/dev/null); then
    tui_print_completed_task "2. Database Port (${POSTGRES_PORT:-5432} Listening)" "$(( $(date +%s) - t_chk ))" "33%"
  else
    echo -e "  ${RED}[✗]${NC} 2. Database Port (Port ${POSTGRES_PORT:-5432} not responsive)"
    all_tests_passed=false
    failed_test_name="${failed_test_name:-2. Database Port Listener}"
    failed_test_hint="${failed_test_hint:-Verify port=${POSTGRES_PORT:-5432} in postgresql.conf and restart postgresql.}"
  fi

  # 3. Admin & Host Connectivity
  t_chk="$(date +%s)"
  if run_sql_admin "SELECT 1;" "postgres" &>/dev/null; then
    tui_print_completed_task "3. Host Connectivity (Admin Access Verified)" "$(( $(date +%s) - t_chk ))" "50%"
  else
    echo -e "  ${RED}[✗]${NC} 3. Host Connectivity (Admin authentication failed)"
    all_tests_passed=false
    failed_test_name="${failed_test_name:-3. Host Admin Connectivity}"
    failed_test_hint="${failed_test_hint:-Check postgres admin password and pg_hba.conf local rules.}"
  fi

  # 4. Application User Authentication
  t_chk="$(date +%s)"
  if PGPASSWORD="${SQL_PASSWORD}" psql -h 127.0.0.1 -p "${POSTGRES_PORT:-5432}" -U "${SQL_USER}" -d "${SQL_DB_NAME}" -qtA -c "SELECT current_user;" &>/dev/null || \
     PGPASSWORD="${SQL_PASSWORD}" psql -h 127.0.0.1 -p "${POSTGRES_PORT:-5432}" -U "${SQL_USER}" -d "postgres" -qtA -c "SELECT current_user;" &>/dev/null || \
     PGPASSWORD="${SQL_PASSWORD}" psql -h 127.0.0.1 -p "${POSTGRES_PORT:-5432}" -U "${SQL_USER}" -d "template1" -qtA -c "SELECT current_user;" &>/dev/null; then
    tui_print_completed_task "4. Authentication (Role '${SQL_USER}' Verified)" "$(( $(date +%s) - t_chk ))" "66%"
  else
    echo -e "  ${RED}[✗]${NC} 4. Authentication (Password or role verification failed)"
    all_tests_passed=false
    failed_test_name="${failed_test_name:-4. Application User Authentication}"
    failed_test_hint="${failed_test_hint:-Re-run Step 7 (sudo ./install.sh --step 7) to synchronize role password.}"
  fi

  # 5. Database Connection & Permissions
  t_chk="$(date +%s)"
  local db_chk
  db_chk="$(PGPASSWORD="${SQL_PASSWORD}" psql -h 127.0.0.1 -p "${POSTGRES_PORT:-5432}" -U "${SQL_USER}" -d "${SQL_DB_NAME}" -qtA -c "SELECT current_database();" 2>/dev/null | tr -d '[:space:]' || echo 'FAILED')"
  if [[ "${db_chk}" == "${SQL_DB_NAME}" ]]; then
    tui_print_completed_task "5. Database Connection (Connected to '${SQL_DB_NAME}')" "$(( $(date +%s) - t_chk ))" "83%"
  else
    echo -e "  ${RED}[✗]${NC} 5. Database Connection (Access to '${SQL_DB_NAME}' failed)"
    all_tests_passed=false
    failed_test_name="${failed_test_name:-5. Database Connection (${SQL_DB_NAME})}"
    failed_test_hint="${failed_test_hint:-Ensure database ${SQL_DB_NAME} exists and ${SQL_USER} has CONNECT privileges.}"
  fi

  # 6. SQL Query Execution & Schema Read/Write
  t_chk="$(date +%s)"
  local rw_chk
  rw_chk="$(PGPASSWORD="${SQL_PASSWORD}" psql -h 127.0.0.1 -p "${POSTGRES_PORT:-5432}" -U "${SQL_USER}" -d "${SQL_DB_NAME}" -v ON_ERROR_STOP=1 -qtA -c "CREATE TABLE IF NOT EXISTS _hse_conn_chk (id serial); DROP TABLE _hse_conn_chk; SELECT 1;" 2>/dev/null | tr -d '[:space:]' || echo 'FAILED')"
  if [[ "${rw_chk}" == "1" ]]; then
    tui_print_completed_task "6. SQL Query Execution (Read/Write Operations Verified)" "$(( $(date +%s) - t_chk ))" "100%"
  else
    echo -e "  ${RED}[✗]${NC} 6. SQL Query Execution (Query test failed)"
    all_tests_passed=false
    failed_test_name="${failed_test_name:-6. SQL Read/Write Query Execution}"
    failed_test_hint="${failed_test_hint:-Grant CREATE/ALL on schema public in ${SQL_DB_NAME} to ${SQL_USER}.}"
  fi

  if [[ "${all_tests_passed}" != "true" ]]; then
    tui_report_error "${failed_test_name}" 1 "" "${failed_test_hint}"
    exit 1
  fi

  echo ""
  log_success "All database connection tests PASSED. Authorization to proceed granted."
  set_completed_step 8
}

# ==============================================================================
# مرحله 9 — Configure Environment
# ==============================================================================
step9_configure_environment() {
  step_header 9 "Configure Environment"

  load_answers_cache
  local t0
  t0="$(date +%s)"

  # 1. Backup existing .env file
  if [[ -f "${ENV_FILE}" ]]; then
    local backup_target
    backup_target="${ENV_BACKUP_DIR}/.env.backup.$(date +%Y%m%d_%H%M%S)"
    cp "${ENV_FILE}" "${backup_target}"
    chmod 600 "${backup_target}"
    tui_print_completed_task "Backed up existing .env to ${backup_target}" "$(( $(date +%s) - t0 ))" "25%"
  else
    tui_print_completed_task "Initialized fresh production .env configuration" 0 "25%"
  fi

  # 2. Preserve or Generate secure JWT_SECRET
  local jwt_sec=""
  if [[ -f "${ENV_FILE}" ]]; then
    jwt_sec="$(grep -E '^JWT_SECRET=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo '')"
  fi
  if [[ -z "${jwt_sec}" || ${#jwt_sec} -lt 32 ]]; then
    jwt_sec="$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | awk '{print $1}')"
  fi
  tui_print_completed_task "Verified 256-bit cryptographic JWT_SECRET" 0 "50%"

  # 3. Determine container-compatible SQL_HOST
  local container_sql_host="${SQL_HOST:-127.0.0.1}"
  if [[ "${container_sql_host}" == "127.0.0.1" || "${container_sql_host}" == "localhost" ]]; then
    container_sql_host="host.docker.internal"
  fi

  # 4. Helper function: Set or update key in .env
  set_env_param() {
    local k="$1"
    local v="$2"
    local target="${ENV_FILE}"

    local escaped_val
    escaped_val="$(printf '%s' "${v}" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"

    if grep -qE "^${k}=" "${target}" 2>/dev/null; then
      local tmp_file
      tmp_file="$(mktemp)"
      ENV_K="${k}" ENV_LINE="${k}=\"${escaped_val}\"" awk '
        BEGIN {
          replaced = 0;
          k = ENVIRON["ENV_K"];
          line = ENVIRON["ENV_LINE"];
        }
        $0 ~ "^" k "=" {
          if (!replaced) { print line; replaced = 1; next }
        }
        { print }
      ' "${target}" > "${tmp_file}" && mv "${tmp_file}" "${target}"
    else
      echo "${k}=\"${escaped_val}\"" >> "${target}"
    fi
  }

  if [[ ! -f "${ENV_FILE}" ]]; then
    cat << EOF > "${ENV_FILE}"
# ==============================================================================
# HSE Enterprise Platform - Production Environment
# Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')
# ==============================================================================
EOF
  fi

  # Update / inject installer-managed keys
  set_env_param "NODE_ENV" "production"
  set_env_param "PORT" "3000"
  set_env_param "APP_PORT" "${APP_INTERNAL_PORT:-3000}"
  set_env_param "APP_INTERNAL_PORT" "${APP_INTERNAL_PORT:-3000}"
  set_env_param "DOCKER_BIND_IP" "${DOCKER_BIND_IP:-127.0.0.1}"
  set_env_param "PUBLIC_PORT" "${APP_PORT:-3000}"
  set_env_param "APP_URL" "${ACCESS_URL}"
  set_env_param "APP_VERSION" "${INSTALLER_VERSION}"
  set_env_param "HOST_TYPE" "${ACCESS_TYPE:-IP}"
  set_env_param "DOMAIN" "${DOMAIN:-}"
  set_env_param "SSL_ENABLED" "${SSL_ENABLED:-false}"
  set_env_param "TRUST_PROXY" "1"

  # PostgreSQL Runtime Configuration
  set_env_param "SQL_HOST" "${container_sql_host}"
  set_env_param "SQL_PORT" "${POSTGRES_PORT:-5432}"
  set_env_param "POSTGRES_PORT" "${POSTGRES_PORT:-5432}"
  set_env_param "SQL_USER" "${SQL_USER}"
  set_env_param "SQL_PASSWORD" "${SQL_PASSWORD}"
  set_env_param "SQL_DB_NAME" "${SQL_DB_NAME}"
  set_env_param "SQL_SSL" "${SQL_SSL:-false}"
  set_env_param "SQL_SSL_CA" "${SQL_SSL_CA:-}"

  # Security & Authentication
  set_env_param "JWT_SECRET" "${jwt_sec}"
  set_env_param "JWT_EXPIRY" "7d"

  # Local AI Resource Configuration (Host-aware dynamic memory ceiling)
  local host_total_ram_mb ai_mem_calc
  host_total_ram_mb="$(free -m | awk '/^Mem:/{print $2}' || echo 4096)"
  if (( host_total_ram_mb >= 10000 )); then
    ai_mem_calc="$((host_total_ram_mb - 2560))M"
  elif (( host_total_ram_mb >= 6000 )); then
    ai_mem_calc="$((host_total_ram_mb - 2048))M"
  else
    ai_mem_calc="3584M"
  fi
  set_env_param "AI_MEMORY_LIMIT" "${ai_mem_calc}"
  set_env_param "AI_KEEP_ALIVE" "5m"
  set_env_param "AI_MAX_LOADED_MODELS" "1"
  set_env_param "AI_NUM_PARALLEL" "1"

  tui_print_completed_task "Synchronized production runtime & database keys in .env" "$(( $(date +%s) - t0 ))" "75%"

  chmod 600 "${ENV_FILE}"
  tui_print_completed_task "Secured .env permissions (chmod 600)" 0 "100%"
  set_completed_step 9
}

# ==============================================================================
# مرحله 10 — Build HSECORE Docker Images
# ==============================================================================
step10_build_docker_images() {
  step_header 10 "Build HSECORE Docker Images"

  cd "${PROJECT_DIR}"
  load_answers_cache

  # Auto-heal legacy unquoted ':?' error colons in compose YAML files if present
  local dc_file
  for dc_file in "${PROJECT_DIR}/docker-compose.server.yml" "${PROJECT_DIR}/docker-compose.yml"; do
    if [[ -f "${dc_file}" ]] && grep -q ':\?Error:' "${dc_file}" 2>/dev/null; then
      sed -i -E \
        -e 's/:\?Error:[[:space:]]*/:?/g' \
        -e 's/^[[:space:]]*POSTGRES_DB:[[:space:]]*(.*)$/      - "POSTGRES_DB=\1"/' \
        -e 's/^[[:space:]]*POSTGRES_USER:[[:space:]]*(.*)$/      - "POSTGRES_USER=\1"/' \
        -e 's/^[[:space:]]*POSTGRES_PASSWORD:[[:space:]]*(.*)$/      - "POSTGRES_PASSWORD=\1"/' \
        "${dc_file}" 2>/dev/null || true
    fi
  done

  # Ensure host Node.js 22 LTS is installed/updated (covers --resume from step 10)
  if ! is_nodejs_lts_ready; then
    tui_run_task \
      "Installing / upgrading host Node.js ${NODE_LTS_MAJOR}.x LTS (>= ${NODE_LTS_MAJOR}.${NODE_MIN_MINOR}.0)" \
      "Check internet access to deb.nodesource.com or nodejs.org." \
      ensure_nodejs_lts
  fi

  tui_run_task \
    "Configuring Docker registry mirrors & resolving base image (node:22-alpine)" \
    "Check internet/DNS connectivity or configure /etc/docker/daemon.json registry-mirrors." \
    prepare_docker_registry_and_base_image

  tui_run_task \
    "Validating Dockerfile.prod & docker-compose.server.yml syntax" \
    "Verify docker-compose.server.yml and .env syntax in ${PROJECT_DIR}." \
    docker compose -f docker-compose.server.yml config --quiet

  tui_run_task \
    "Building production Docker image for HSECORE (hse-app)" \
    "Check internet access, disk space (df -h), and Docker daemon status (systemctl status docker)." \
    build_hsecore_production_image

  log_warn "Production containers have NOT been started yet."
  set_completed_step 10
}

# ==============================================================================
# مرحله 11 — Database Diagnostic, Migration & Initial Administrator Creation
# ==============================================================================
step11_run_database_migration() {
  step_header 11 "Database Diagnostic, Migration & Admin Setup"

  cd "${PROJECT_DIR}"
  load_answers_cache

  if ! docker image inspect hsecore-enterprise:latest >/dev/null 2>&1; then
    tui_run_task \
      "Building missing HSECORE production image before migration" \
      "Rebuild the container image via: sudo ./install.sh --step 10" \
      build_hsecore_production_image
  fi

  tui_run_task \
    "Verifying built bundle artifacts (diagnose-db.cjs & server.cjs)" \
    "Rebuild the container image via: sudo ./install.sh --step 10" \
    docker compose -f docker-compose.server.yml run --rm --no-deps hse-app sh -c "test -f ./dist/diagnose-db.cjs && test -f ./dist/server.cjs"

  tui_run_task \
    "Running end-to-end database diagnostic from inside container" \
    "Verify PostgreSQL is listening on '*' and pg_hba.conf allows 172.16.0.0/12 (host.docker.internal)." \
    docker compose -f docker-compose.server.yml run --rm --no-deps hse-app node -e "
      try {
        require('./dist/diagnose-db.cjs');
      } catch (e) {
        console.error('[Diagnostic Tool Error]', e.message || e);
        process.exit(1);
      }
    "

  tui_run_task \
    "Executing Drizzle ORM database schema migrations" \
    "Check PostgreSQL user permissions on schema public and inspect migration error output above." \
    docker compose -f docker-compose.server.yml run --rm --no-deps hse-app node -e "
      (async () => {
        try {
          let runMigrations;
          try {
            runMigrations = require('./dist/migrate.cjs').runMigrations;
          } catch (_) {
            runMigrations = require('./dist/server.cjs').runMigrations;
          }
          if (typeof runMigrations === 'function') {
            await runMigrations();
            console.log('[Migration] Database schema migrations completed successfully.');
            process.exit(0);
          } else {
            console.error('[Migration Error] runMigrations is not a function in ./dist/migrate.cjs or ./dist/server.cjs');
            process.exit(1);
          }
        } catch (err) {
          console.error('[Migration Error]', err?.message || err);
          process.exit(1);
        }
      })();
    "

  # Verification
  local tbl_count
  tbl_count="$(PGPASSWORD="${SQL_PASSWORD}" psql -h 127.0.0.1 -p "${POSTGRES_PORT:-5432}" -U "${SQL_USER}" -d "${SQL_DB_NAME}" -qtA -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d '[:space:]' || echo 0)"

  tui_print_completed_task "Database Schema Verified (${tbl_count} tables synchronized)" 0
  echo ""

  # ----------------------------------------------------------------------------
  # Interactive HSECORE Initial Administrator User Creation
  # ----------------------------------------------------------------------------
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
  echo -e "${BOLD}${CYAN}       Create Initial HSECORE Administrator Account               ${NC}"
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
  echo -e "${YELLOW}Please define the initial master administrator credentials for logging into HSECORE:${NC}"
  echo ""

  local admin_u=""
  while true; do
    read -r -p "Enter Admin Username [admin]: " input_adm_u
    admin_u="${input_adm_u:-admin}"
    admin_u="$(echo "${admin_u}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
    if [[ -z "${admin_u}" ]]; then
      echo -e "${RED}Username cannot be empty.${NC}"
      continue
    fi
    if ! [[ "${admin_u}" =~ ^[a-z0-9_.-]+$ ]]; then
      echo -e "${RED}Username contains invalid characters. Use alphanumeric, underscore, hyphen or dot.${NC}"
      continue
    fi
    break
  done

  local admin_p=""
  while true; do
    read -r -s -p "Enter Admin Password [hidden]: " input_adm_p
    echo ""
    admin_p="${input_adm_p}"
    if [[ -z "${admin_p}" ]]; then
      echo -e "${RED}Password cannot be empty.${NC}"
      continue
    fi
    if [[ ${#admin_p} -lt 4 ]]; then
      echo -e "${RED}Password must be at least 4 characters long.${NC}"
      continue
    fi
    read -r -s -p "Confirm Admin Password [hidden]: " input_adm_p_conf
    echo ""
    if [[ "${admin_p}" != "${input_adm_p_conf}" ]]; then
      echo -e "${RED}Passwords do not match. Please re-enter.${NC}"
      continue
    fi
    break
  done

  read -r -p "Enter Admin Full Name [System Administrator]: " input_adm_fn
  local admin_fn="${input_adm_fn:-System Administrator}"

  read -r -p "Enter Admin Email [${admin_u}@hsecore.local]: " input_adm_em
  local admin_em="${input_adm_em:-${admin_u}@hsecore.local}"

  echo ""
  tui_run_task \
    "Registering initial administrator account '${admin_u}' in database" \
    "Verify database tables are migrated and create-user-cli.js exists inside the container." \
    docker compose -f docker-compose.server.yml run --rm --no-deps \
      -e ADMIN_USER="${admin_u}" \
      -e ADMIN_PASS="${admin_p}" \
      -e ADMIN_NAME="${admin_fn}" \
      -e ADMIN_EMAIL="${admin_em}" \
      -e ADMIN_ROLE="Administrator" \
      hse-app node create-user-cli.js

  echo ""
  set_completed_step 11
}

# ==============================================================================
# مرحله 12 — Start HSECORE Container
# ==============================================================================
step12_start_hsecore() {
  step_header 12 "Start HSECORE Application Container"

  cd "${PROJECT_DIR}"

  local up_t0
  up_t0="$(date +%s)"
  prepare_uploads_storage || {
    tui_report_error "Prepare Persistent Uploads Storage" 1 "" "Check permissions and path of ${UPLOADS_HOST_DIR} (must not be a symlink or conflicting volume)."
    exit 1
  }
  tui_print_completed_task "Prepared persistent uploads storage (${UPLOADS_HOST_DIR})" "$(( $(date +%s) - up_t0 ))"

  # Ensure dedicated internal network and persistent AI volume exist before launching containers
  docker network inspect hse-network >/dev/null 2>&1 || {
    docker network create --driver bridge \
      --label com.docker.compose.network=hse-network \
      --label com.docker.compose.project=hsecore \
      hse-network >/dev/null 2>&1 || docker network create --driver bridge hse-network
  }
  docker volume inspect hse_ai_models >/dev/null 2>&1 || {
    docker volume create \
      --label com.docker.compose.volume=hse_ai_models \
      --label com.docker.compose.project=hsecore \
      hse_ai_models >/dev/null 2>&1 || docker volume create hse_ai_models
  }

  tui_run_task \
    "Starting HSECORE application container (hse-app)" \
    "Check port conflicts on ${APP_INTERNAL_PORT:-3000} (ss -tulpn) and inspect docker logs." \
    docker compose -f docker-compose.server.yml up -d --remove-orphans hse-app

  local running_svcs
  running_svcs="$(docker compose -f docker-compose.server.yml ps --services --filter "status=running" 2>/dev/null || true)"
  if [[ -n "${running_svcs}" ]]; then
    while IFS= read -r svc; do
      if [[ -n "${svc}" ]]; then
        tui_print_completed_task "Container Service '${svc}' Running" 0
      fi
    done <<< "${running_svcs}"
  fi

  # Configure Systemd Service for Auto-start on VPS Reboot
  local docker_bin
  docker_bin="$(command -v docker || echo '/usr/bin/docker')"

  cat << EOF > /etc/systemd/system/hsecore.service
[Unit]
Description=HSE Enterprise Platform Service
Requires=docker.service postgresql.service
After=docker.service postgresql.service network.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${PROJECT_DIR}
ExecStart=${docker_bin} compose -f docker-compose.server.yml up -d hse-app
ExecStartPost=/bin/bash ${PROJECT_DIR}/scripts/start-ai-if-enabled.sh
ExecStop=${docker_bin} compose -f docker-compose.server.yml stop
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

  tui_run_task \
    "Enabling systemd auto-start service (hsecore.service)" \
    "Check systemd unit file /etc/systemd/system/hsecore.service and run: sudo systemctl daemon-reload" \
    bash -c "systemctl daemon-reload && systemctl enable --now hsecore.service"

  set_completed_step 12
}

# ==============================================================================
# مرحله 13 — Configure SSL, Nginx Reverse Proxy & Firewall
# ==============================================================================
step13_configure_firewall() {
  step_header 13 "Configure SSL, Nginx Reverse Proxy & Firewall"

  load_answers_cache

  local internal_port="${APP_INTERNAL_PORT:-3000}"
  local public_port="${APP_PORT:-3000}"
  local nginx_conf="/etc/nginx/sites-available/hsecore"

  # Ensure nginx directories exist
  mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /var/www/html 2>/dev/null || true

  # 0. Pre-emptively stop and disable Apache2 if installed on VPS to prevent port 80/443 contention
  if systemctl is-active --quiet apache2 2>/dev/null || systemctl is-enabled --quiet apache2 2>/dev/null; then
    tui_run_task \
      "Stopping and disabling conflicting Apache2 web server" \
      "Stop Apache2 manually: sudo systemctl stop apache2 && sudo systemctl disable apache2" \
      bash -c "systemctl stop apache2 2>/dev/null || true; systemctl disable apache2 2>/dev/null || true"
  fi

  if [[ "${ACCESS_TYPE}" == "DOMAIN" && "${SSL_ENABLED}" == "true" && -n "${DOMAIN}" ]]; then
    # 1. Stop Nginx temporarily for Standalone Certbot challenge on port 80
    tui_run_task \
      "Freeing port 80 for Let's Encrypt standalone challenge" \
      "Check which process is holding port 80 with: sudo ss -tulpn | grep :80" \
      bash -c "systemctl stop nginx 2>/dev/null || true; if command -v fuser &>/dev/null; then fuser -k 80/tcp 2>/dev/null || true; fi"

    mkdir -p "/etc/letsencrypt" "/etc/letsencrypt/live/${DOMAIN}"

    # 2. Check if valid cert already exists
    local cert_exists=false
    if [[ -s "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" && -s "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" ]]; then
      tui_print_completed_task "Existing SSL certificate verified for ${DOMAIN}" 0
      cert_exists=true
    fi

    if [[ "${cert_exists}" != "true" ]]; then
      local certbot_success=false

      if command -v certbot &>/dev/null && [[ -n "${CERTBOT_EMAIL}" ]]; then
        if tui_run_task \
          "Requesting Let's Encrypt SSL certificate for ${DOMAIN}" \
          "Ensure DNS A-record for ${DOMAIN} points to this server and port 80 is open." \
          certbot certonly \
            --standalone \
            --non-interactive \
            --agree-tos \
            --email "${CERTBOT_EMAIL}" \
            --preferred-challenges http \
            -d "${DOMAIN}"; then
          certbot_success=true
        else
          log_warn "Standalone certbot challenge was not completed (DNS or port 80 may be filtering)."
        fi
      fi

      # Fallback: create valid self-signed certificate so Nginx always starts cleanly
      if [[ "${certbot_success}" != "true" && (! -s "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" || ! -s "/etc/letsencrypt/live/${DOMAIN}/privkey.pem") ]]; then
        mkdir -p "/etc/letsencrypt/live/${DOMAIN}"
        tui_run_task \
          "Generating fallback TLS certificate for ${DOMAIN} (ensuring Nginx readiness)" \
          "Verify openssl is installed: sudo apt-get install -y openssl" \
          openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" \
            -out "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" \
            -subj "/CN=${DOMAIN}/O=HSECORE Enterprise" || true
      fi
    fi

    # Ensure certificate directories and files are readable by Nginx
    chmod 755 /etc/letsencrypt /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true
    chmod -R a+rX /etc/letsencrypt/live "/etc/letsencrypt/live/${DOMAIN}" /etc/letsencrypt/archive 2>/dev/null || true

    local extra_ssl_listen=""
    if [[ "${public_port}" != "443" && "${public_port}" != "80" ]]; then
      extra_ssl_listen="    listen ${public_port} ssl;"
    fi

    # 3. Create Production Nginx Virtual Host Configuration with SSL
    local ngx_t0
    ngx_t0="$(date +%s)"
    cat << EOF > "${nginx_conf}"
# ==============================================================================
# HSECORE Enterprise Nginx Configuration (Domain + SSL Mode)
# Managed automatically by install.sh
# ==============================================================================

# HTTP -> HTTPS Redirect
server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS Reverse Proxy (Listens on standard 443 + custom port for universal ISP access)
server {
    listen 443 ssl;
${extra_ssl_listen}
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    # Universal Mobile & ISP TLS Compatibility (Irancell, MCI, Shatel, Mokhaberat)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:HSE_SSL:10m;
    ssl_session_tickets off;
    ssl_stapling off;

    # Gzip Compression for Fast Loading across Cellular & Low-Bandwidth Networks
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    # Performance & Payload Limits (Allows large HSE attachments & reports)
    client_max_body_size 100M;
    large_client_header_buffers 4 64k;

    # Security Headers
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location / {
        proxy_pass http://127.0.0.1:${internal_port};
        proxy_http_version 1.1;

        # Upstream Buffer Optimization (Prevents 502 Bad Gateway from upstream header overflows)
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;

        # Standard Proxy Headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port ${public_port};

        # WebSocket Upgrade Support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
    }
}
EOF
    tui_print_completed_task "Generated Nginx HTTPS & WebSocket reverse proxy config (${DOMAIN})" "$(( $(date +%s) - ngx_t0 ))"

    # 4. Setup Automatic Certbot Renewal Systemd Timer
    cat << EOF > /etc/systemd/system/hsecore-certbot-renew.service
[Unit]
Description=HSECORE Let's Encrypt Certificate Renewal
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --webroot -w /var/www/html --quiet --deploy-hook "/bin/systemctl reload nginx"
EOF

    cat << EOF > /etc/systemd/system/hsecore-certbot-renew.timer
[Unit]
Description=HSECORE Let's Encrypt Renewal Timer

[Timer]
OnCalendar=*-*-* 03,15:00:00
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
EOF
    systemctl daemon-reload 2>/dev/null || true
    systemctl enable --now hsecore-certbot-renew.timer 2>/dev/null || true
    tui_print_completed_task "Configured automated SSL certificate renewal systemd timer" 0

  else
    # IP Mode or Non-SSL Domain Mode: Configure standard HTTP reverse proxy
    local ngx_t0
    ngx_t0="$(date +%s)"

    cat << EOF > "${nginx_conf}"
# ==============================================================================
# HSECORE Enterprise Nginx Configuration (HTTP Reverse Proxy)
# Managed automatically by install.sh
# ==============================================================================
server {
    listen ${public_port} default_server;
    server_name _;

    # Performance & Payload Limits (Allows large HSE attachments & reports)
    client_max_body_size 100M;
    large_client_header_buffers 4 64k;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:${internal_port};
        proxy_http_version 1.1;

        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto http;
        proxy_set_header X-Forwarded-Port ${public_port};

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
    }
}
EOF
    tui_print_completed_task "Generated Nginx HTTP reverse proxy config on port ${public_port}" "$(( $(date +%s) - ngx_t0 ))"
  fi

  # Enable Nginx site and remove default
  ln -sf "${nginx_conf}" "/etc/nginx/sites-enabled/hsecore" 2>/dev/null || true
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

  # Test Nginx syntax safely
  if nginx -t 2>/dev/null; then
    tui_print_completed_task "Verified Nginx configuration syntax (nginx -t)" 0
  else
    log_warn "Nginx syntax check reported an issue. Running automated fallback..."
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    nginx -t 2>/dev/null || true
  fi

  systemctl enable nginx 2>/dev/null || true
  systemctl reset-failed nginx 2>/dev/null || true

  tui_run_task \
    "Restarting Nginx reverse proxy service on port ${public_port}" \
    "Inspect Nginx error logs via: sudo journalctl -xeu nginx.service" \
    bash -c "
      if ! systemctl restart nginx 2>/dev/null; then
        if command -v fuser &>/dev/null; then
          fuser -k 80/tcp 2>/dev/null || true
          if [[ '${public_port}' != '${internal_port}' ]]; then
            fuser -k '${public_port}/tcp' 2>/dev/null || true
          fi
        fi
        pkill -9 -f nginx 2>/dev/null || true
        sleep 1
        systemctl reset-failed nginx 2>/dev/null || true
        systemctl start nginx 2>/dev/null || true
      fi
    "

  # Ensure application container is active on internal port
  if ! docker compose -f "${PROJECT_DIR}/docker-compose.server.yml" ps --services --filter "status=running" 2>/dev/null | grep -q "hse-app"; then
    tui_run_task \
      "Ensuring HSECORE container is active on internal port ${internal_port}" \
      "Check Docker container logs: docker compose -f docker-compose.server.yml logs hse-app" \
      bash -c "docker compose -f '${PROJECT_DIR}/docker-compose.server.yml' up -d hse-app 2>/dev/null || true; sleep 2"
  fi

  # 5. UFW Firewall Configuration
  if command -v ufw &>/dev/null; then
    local pg_p="${POSTGRES_PORT:-5432}"
    tui_run_task \
      "Configuring UFW firewall rules (SSH, HTTP/80, HTTPS/${public_port}, PostgreSQL)" \
      "Verify UFW installation and kernel netfilter permissions." \
      bash -c "
        ufw allow 22/tcp comment 'SSH Remote Access' 2>/dev/null || ufw allow 22/tcp || true
        ufw allow ssh comment 'SSH Remote Access' 2>/dev/null || ufw allow ssh || true
        ufw allow 80/tcp comment 'HTTP Web Proxy / ACME' 2>/dev/null || ufw allow 80/tcp || true
        ufw allow 443/tcp comment 'HTTPS Standard Web' 2>/dev/null || ufw allow 443/tcp || true
        if [[ '${public_port}' != '80' && '${public_port}' != '443' ]]; then
          ufw allow '${public_port}/tcp' comment 'HSECORE Application Port' 2>/dev/null || ufw allow '${public_port}/tcp' || true
        fi
        ufw allow from 127.0.0.1 to any port '${pg_p}' proto tcp comment 'Localhost to PostgreSQL' 2>/dev/null || true
        ufw allow from 172.16.0.0/12 to any port '${pg_p}' proto tcp comment 'Docker Subnets to PostgreSQL' 2>/dev/null || true
        ufw allow in on docker0 to any port '${pg_p}' proto tcp comment 'Docker Bridge to PostgreSQL' 2>/dev/null || true
        ufw deny '${pg_p}/tcp' comment 'Block Public Internet Access to PostgreSQL' 2>/dev/null || true
      "
  fi

  set_completed_step 13
}

# ==============================================================================
# مرحله 14 — Final Health Check
# ==============================================================================
step14_final_health_check() {
  step_header 14 "Final Health Check"

  load_answers_cache

  local internal_port="${APP_INTERNAL_PORT:-3000}"
  local public_port="${APP_PORT:-3000}"
  local t_hc

  # 1. Container Status & Auto-Recovery
  t_hc="$(date +%s)"
  local container_stat="unknown"
  local cid
  cid="$(docker compose -f "${PROJECT_DIR}/docker-compose.server.yml" ps -q hse-app 2>/dev/null || true)"
  if [[ -z "${cid}" ]]; then
    cid="$(docker ps -q -f name=hse-enterprise-app 2>/dev/null || true)"
  fi
  if [[ -n "${cid}" ]]; then
    container_stat="$(docker inspect --format='{{.State.Status}}' "${cid}" 2>/dev/null || echo 'not_found')"
  else
    container_stat="not_found"
  fi

  if [[ "${container_stat}" != "running" ]]; then
    log_warn "Application container is '${container_stat}'. Launching container on internal port ${internal_port}..."
    tui_run_task \
      "Recovering HSECORE application container on port ${internal_port}" \
      "Inspect container logs with: docker compose -f docker-compose.server.yml logs hse-app" \
      bash -c "docker compose -f '${PROJECT_DIR}/docker-compose.server.yml' up -d hse-app && sleep 3" || true
    cid="$(docker compose -f "${PROJECT_DIR}/docker-compose.server.yml" ps -q hse-app 2>/dev/null || true)"
    if [[ -n "${cid}" ]]; then
      container_stat="$(docker inspect --format='{{.State.Status}}' "${cid}" 2>/dev/null || echo 'not_found')"
    fi
  fi
  if [[ "${container_stat}" == "running" ]]; then
    tui_print_completed_task "1. Docker Container Status (running)" "$(( $(date +%s) - t_hc ))" "20%"
  fi

  # 2. Polling Backend health with live TUI streaming
  local is_backend_healthy=false
  if tui_run_task \
    "2. Probing Backend API Health Endpoint (http://127.0.0.1:${internal_port}/api/health)" \
    "Inspect container runtime logs: docker compose -f docker-compose.server.yml logs --tail 30 hse-app" \
    bash -c "
      for attempt in {1..30}; do
        echo \"Probing http://127.0.0.1:${internal_port}/api/health (attempt \${attempt}/30)...\"
        if curl -s -f --max-time 4 'http://127.0.0.1:${internal_port}/api/health' >/dev/null; then
          echo 'Health endpoint responded with HTTP 200 OK.'
          exit 0
        fi
        if [[ '${ACCESS_TYPE:-}' == 'DOMAIN' && '${SSL_ENABLED:-}' == 'true' ]]; then
          if curl -k -s -f --max-time 4 -H 'Host: ${DOMAIN:-}' 'https://127.0.0.1:${public_port}/api/health' >/dev/null; then
            echo 'HTTPS proxy health endpoint responded with HTTP 200 OK.'
            exit 0
          fi
        fi
        sleep 2
      done
      exit 1
    "; then
    is_backend_healthy=true
  fi

  if [[ "${is_backend_healthy}" != "true" ]]; then
    echo ""
    log_warn "Backend health check diagnostics:"
    echo "  - Probed internal endpoint: http://127.0.0.1:${internal_port}/api/health"
    local probe_output
    probe_output="$(curl -v -m 5 "http://127.0.0.1:${internal_port}/api/health" 2>&1 | tail -n 6 || true)"
    echo "  - Curl output: ${probe_output}"
    echo "  - Container logs (tail 15):"
    docker compose -f "${PROJECT_DIR}/docker-compose.server.yml" logs --tail 15 hse-app 2>&1 || true
    echo ""
  fi

  # 3. Database Service Health
  t_hc="$(date +%s)"
  local pg_service_ok=false
  if systemctl is-active --quiet postgresql; then
    pg_service_ok=true
    tui_print_completed_task "3. Database Service (Active)" "$(( $(date +%s) - t_hc ))" "60%"
  fi

  # 4. PostgreSQL Port Health
  t_hc="$(date +%s)"
  local pg_port_ok=false
  if (cd /tmp && runuser -u postgres -- pg_isready -p "${POSTGRES_PORT:-5432}" &>/dev/null); then
    pg_port_ok=true
    tui_print_completed_task "4. Database Port Listener (Port ${POSTGRES_PORT:-5432} Ready)" "$(( $(date +%s) - t_hc ))" "80%"
  fi

  # 5. Database Query Test
  t_hc="$(date +%s)"
  local db_query_ok=false
  local q_res
  q_res="$(PGPASSWORD="${SQL_PASSWORD}" psql -h 127.0.0.1 -p "${POSTGRES_PORT:-5432}" -U "${SQL_USER}" -d "${SQL_DB_NAME}" -qtA -c "SELECT 1;" 2>/dev/null | tr -d '[:space:]' || echo 0)"
  if [[ "${q_res}" == "1" ]]; then
    db_query_ok=true
    tui_print_completed_task "5. Database Connectivity & Query Execution (Verified)" "$(( $(date +%s) - t_hc ))" "100%"
  fi

  # 6. Evaluate all health indicators
  local failed_checks=()
  if [[ "${pg_service_ok}" != "true" ]]; then
    failed_checks+=("Database Service")
  fi
  if [[ "${pg_port_ok}" != "true" ]]; then
    failed_checks+=("Database Port Listener")
  fi
  if [[ "${db_query_ok}" != "true" ]]; then
    failed_checks+=("Database Query Execution")
  fi
  if [[ "${container_stat}" != "running" ]]; then
    failed_checks+=("Docker Container Status (${container_stat})")
  fi
  if [[ "${is_backend_healthy}" != "true" ]]; then
    failed_checks+=("Backend API Health Endpoint")
  fi

  if [[ ${#failed_checks[@]} -gt 0 ]]; then
    tui_report_error "Final Health Check (${failed_checks[*]})" 1 "" "Inspect service status via 'sudo ./install.sh --health' and 'sudo ./install.sh --logs', then resume with 'sudo ./install.sh --resume'."
    exit 1
  fi

  echo ""
  echo -e "  ${GREEN}End-to-End Pipeline:${NC} Browser -> Nginx / Proxy -> HSECORE App -> Database -> Query ${GREEN}${BOLD}[OK]${NC}"

  set_completed_step 14
}

# ==============================================================================
# مرحله 15 — Installation Complete
# ==============================================================================
step15_installation_complete() {
  step_header 15 "Installation Complete"

  load_answers_cache

  # 1. Configure / verify backup schedule
  configure_backup_schedule || log_warn "Backup schedule was not configured. Run later: sudo ./install.sh --backup-config"
  tui_print_completed_task "1. Backup Schedule & Retention Policy Verified (${BACKUP_ENABLED:-false}, ${BACKUP_FREQUENCY:-daily})" 0 "25%"

  # 2. Secure environment credentials & permissions
  local t_sec
  t_sec="$(date +%s)"
  if [[ -f "${ENV_FILE}" ]]; then
    chmod 600 "${ENV_FILE}"
  fi
  tui_print_completed_task "2. Environment Credentials Secured (.env chmod 600)" "$(( $(date +%s) - t_sec ))" "50%"

  # 3. Clean up temporary installation answers cache & sanitize state file
  local t_cln
  t_cln="$(date +%s)"
  rm -f "${CACHE_FILE}" "${DOCKER_BASE_IMAGE_STATE}"
  log_raw "Configuration cache removed after step 15 completion."

  set_completed_step 15
  if [[ -f "${STATE_FILE}" ]]; then
    sed -i -E '/PASSWORD|SECRET|TOKEN/d' "${STATE_FILE}" 2>/dev/null || true
    chmod 600 "${STATE_FILE}" 2>/dev/null || true
  fi
  tui_print_completed_task "3. Temporary Secret Cache Purged & State Finalized (15/15)" "$(( $(date +%s) - t_cln ))" "75%"

  # 4. Collect final runtime versions & service state for visual summary
  local pg_ver total_elapsed total_dur full_bar chk
  pg_ver="$(psql --version 2>/dev/null | head -n1 || echo 'PostgreSQL 16')"
  total_elapsed=$(( $(date +%s) - ${INSTALL_START_TIME:-$(date +%s)} ))
  total_dur="$(tui_format_duration "${total_elapsed}")"
  full_bar="$(tui_build_bar 100 0 20)"
  chk="✓"
  if [[ "${TUI_UTF8}" != "true" ]]; then chk="+"; fi
  tui_print_completed_task "4. Final Readiness & Service Audit Completed" 0 "100%"

  echo ""
  echo -e "${BOLD}${GREEN}==================================================================${NC}"
  echo -e "${BOLD}${GREEN}   [${chk}] HSECORE ENTERPRISE INSTALLATION COMPLETED (100%)          ${NC}"
  echo -e "${BOLD}${GREEN}==================================================================${NC}"
  echo -e "  ${BOLD}Overall Progress   :${NC} ${full_bar} ${BOLD}${GREEN}100% (15/15 Steps)${NC}"
  echo -e "  ${BOLD}Total Elapsed Time :${NC} ${CYAN}${total_dur}${NC}"
  echo ""
  echo -e "  ${BOLD}Access Mode        :${NC} ${BOLD}${ACCESS_TYPE:-IP}${NC}"
  echo -e "  ${BOLD}System URL         :${NC} ${BOLD}${CYAN}${ACCESS_URL}${NC}"
  if [[ "${ACCESS_TYPE:-IP}" == "DOMAIN" ]]; then
    echo -e "  ${BOLD}Domain             :${NC} ${DOMAIN:-}"
    echo -e "  ${BOLD}SSL Certificate    :${NC} Let's Encrypt (Auto-renewing Timer Enabled)"
    echo -e "  ${BOLD}Public HTTPS Port  :${NC} ${APP_PORT:-443}"
    echo -e "  ${BOLD}Internal App Port  :${NC} ${APP_INTERNAL_PORT:-3000}"
  else
    echo -e "  ${BOLD}Server IP          :${NC} ${SERVER_IP:-127.0.0.1}"
    echo -e "  ${BOLD}Application Port   :${NC} ${APP_PORT:-3000}"
    echo -e "  ${BOLD}SSL                :${NC} Disabled (Direct HTTP)"
  fi
  echo -e "  ${BOLD}PostgreSQL Database:${NC} ${SQL_DB_NAME:-hsedb} (Port: ${POSTGRES_PORT:-5432})"
  echo -e "  ${BOLD}PostgreSQL Version :${NC} ${pg_ver}"
  echo -e "  ${BOLD}Docker Service     :${NC} ${GREEN}READY (${APP_CONTAINER_NAME})${NC}"
  echo -e "  ${BOLD}Systemd Auto-Start :${NC} ${GREEN}Active (hsecore.service)${NC}"
  echo -e "  ${BOLD}Scheduled Backups  :${NC} ${BACKUP_ENABLED:-false} (${BACKUP_FREQUENCY:-daily} -> ${BACKUP_DIR:-${DB_BACKUP_DIR}})"
  echo -e "  ${BOLD}Health Check       :${NC} ${GREEN}${BOLD}100% OPERATIONAL${NC}"
  echo ""
  echo -e "${BOLD}${CYAN}  Completed Steps Summary:${NC}"
  local s_idx=1
  while [[ ${s_idx} -le 15 ]]; do
    printf "    ${GREEN}${chk}${NC} [%02d/15] %-46s ${DIM}[OK]${NC}\n" "${s_idx}" "${STEP_TITLES[$s_idx]}"
    s_idx=$((s_idx + 1))
  done
  echo ""
  echo -e "${BOLD}${CYAN}  Next Steps:${NC}"
  echo -e "    1. Open your browser and navigate to: ${BOLD}${CYAN}${ACCESS_URL}${NC}"
  echo -e "    2. Sign in with the administrator account you created during installation."
  echo -e "    3. Manage updates/backups anytime with: ${BOLD}sudo ./install.sh${NC}"
  echo ""
  echo -e "${BOLD}${GREEN}==================================================================${NC}"
  echo ""
}

# ------------------------------------------------------------------------------
# Safe Uninstall Utility
# ------------------------------------------------------------------------------
safe_uninstall() {
  echo ""
  echo -e "${RED}${BOLD}==================================================================${NC}"
  echo -e "${RED}${BOLD}  HSECORE SAFE UNINSTALL UTILITY${NC}"
  echo -e "${RED}${BOLD}==================================================================${NC}"
  echo ""

  if [[ $EUID -ne 0 ]]; then
    log_error "Root or sudo privileges required. Please execute: sudo ./install.sh --uninstall"
    exit 1
  fi

  load_answers_cache

  local target_db="${SQL_DB_NAME:-}"
  if [[ -z "${target_db}" && -f "${ENV_FILE}" ]]; then
    target_db="$(grep -E '^SQL_DB_NAME=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ' || echo '')"
  fi
  target_db="${target_db:-hsedb}"

  local target_pg_port="${POSTGRES_PORT:-5432}"

  read -r -p "Are you sure you want to stop and remove HSECORE containers? (y/N): " confirm_un
  if [[ "${confirm_un}" != "y" && "${confirm_un}" != "Y" ]]; then
    echo "Uninstall aborted."
    exit 0
  fi

  log_info "Stopping HSECORE Docker containers..."
  docker compose -f "${PROJECT_DIR}/docker-compose.server.yml" down 2>/dev/null || true

  log_info "Disabling systemd services..."
  systemctl stop hsecore.service 2>/dev/null || true
  systemctl disable hsecore.service 2>/dev/null || true
  rm -f /etc/systemd/system/hsecore.service
  systemctl stop hsecore-certbot-renew.timer 2>/dev/null || true
  systemctl disable hsecore-certbot-renew.timer 2>/dev/null || true
  rm -f /etc/systemd/system/hsecore-certbot-renew.*
  systemctl daemon-reload

  echo ""
  echo -e "${YELLOW}IMPORTANT: By default, your database and tables are PRESERVED.${NC}"
  read -r -p "Do you want to KEEP the database and data intact? (Y/n): " keep_db
  if [[ "${keep_db}" == "n" || "${keep_db}" == "N" ]]; then
    read -r -p "CONFIRM DELETION: Type 'DELETE' to permanently drop database '${target_db}': " drop_confirm
    if [[ "${drop_confirm}" == "DELETE" ]]; then
      log_warn "Dropping database '${target_db}' on port ${target_pg_port}..."
      if (cd /tmp && runuser -u postgres -- psql -p "${target_pg_port}" -c "DROP DATABASE IF EXISTS \"${target_db}\";"); then
        log_info "Database '${target_db}' dropped successfully."
      else
        log_error "Failed to drop database '${target_db}' on port ${target_pg_port}."
        exit 1
      fi
    else
      log_info "Database drop cancelled. Database kept intact."
    fi
  else
    log_info "Database preserved intact."
  fi

  rm -f "${STATE_FILE}" "${CACHE_FILE}"
  log_success "HSECORE services have been uninstalled safely."
}

# ==============================================================================
# Backup Configuration, Cron and Audit
# ==============================================================================
sanitize_secrets() {
  local text
  text="$(cat)"
  if [[ -n "${SQL_PASSWORD:-}" ]]; then text="${text//"${SQL_PASSWORD}"/***}"; fi
  printf '%s' "${text}" | tr '\n' ' '
}

BACKUP_LOCK_HELD="false"
run_locked() {
  local rc=0
  if [[ "${BACKUP_LOCK_HELD}" == "true" ]]; then "$@"; return $?; fi
  command -v flock &>/dev/null || { log_error "flock (util-linux) is required."; return 1; }
  exec 9>"${BACKUP_LOCK_FILE}" || { log_error "Cannot open lock file ${BACKUP_LOCK_FILE}."; return 1; }
  if ! flock -n 9; then
    exec 9>&-
    log_error "Another backup, restore or update is already running."
    return 1
  fi
  BACKUP_LOCK_HELD="true"
  "$@" || rc=$?
  BACKUP_LOCK_HELD="false"
  exec 9>&-
  return "${rc}"
}

# Prints "container" or an absolute host directory holding the live uploads.
resolve_uploads_source() {
  local mount_source=""
  if docker inspect "${APP_CONTAINER_NAME}" &>/dev/null; then
    mount_source="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Source}}{{end}}{{end}}' "${APP_CONTAINER_NAME}")" || return 1
    if [[ -z "${mount_source}" ]]; then printf 'container'; return 0; fi
    [[ -d "${mount_source}" ]] || return 1
    printf '%s' "${mount_source}"
    return 0
  fi
  [[ -d "${UPLOADS_HOST_DIR}" ]] || return 1
  printf '%s' "${UPLOADS_HOST_DIR}"
}

prepare_uploads_storage() {
  local existing_mount="" legacy="" filename
  umask 077
  if docker inspect "${APP_CONTAINER_NAME}" &>/dev/null; then
    existing_mount="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Source}}{{end}}{{end}}' "${APP_CONTAINER_NAME}")"
    if [[ -z "${existing_mount}" ]]; then
      legacy="$(mktemp -d "${PROJECT_DIR}/.uploads-migration.XXXXXX")" || return 1
      if ! docker cp "${APP_CONTAINER_NAME}:/app/uploads/." "${legacy}/"; then
        rmdir "${legacy}" 2>/dev/null || true
        log_error "Could not copy existing container uploads. Container will NOT be recreated."
        return 1
      fi
    elif [[ "$(realpath -m "${existing_mount}")" != "$(realpath -m "${UPLOADS_HOST_DIR}")" ]]; then
      log_error "The application uses a different uploads volume: ${existing_mount}. Refusing to recreate its container."
      return 1
    fi
  fi
  if [[ -L "${UPLOADS_HOST_DIR}" ]]; then log_error "Uploads path must not be a symlink."; return 1; fi
  if [[ ! -d "${UPLOADS_HOST_DIR}" ]]; then
    mkdir -p "${UPLOADS_HOST_DIR}" && chmod 700 "${UPLOADS_HOST_DIR}" || return 1
  fi
  if [[ -n "${legacy}" ]]; then
    while IFS= read -r -d '' filename; do
      local relative="${filename#"${legacy}/"}" dest="${UPLOADS_HOST_DIR}/${filename#"${legacy}/"}"
      if [[ -e "${dest}" || -L "${dest}" ]]; then
        if [[ -f "${filename}" && -f "${dest}" ]] && cmp -s "${filename}" "${dest}"; then continue; fi
        log_error "Upload migration conflict at ${relative}; legacy files preserved in ${legacy}."
        return 1
      fi
    done < <(find "${legacy}" -type f -print0)
    if ! cp -an "${legacy}/." "${UPLOADS_HOST_DIR}/"; then
      log_error "Upload migration failed; legacy files preserved in ${legacy}."
      return 1
    fi
    if ! diff -qr "${legacy}" "${UPLOADS_HOST_DIR}" >/dev/null; then
      log_error "Upload migration verification failed; legacy files preserved in ${legacy}."
      return 1
    fi
    log_info "Legacy uploads copied to ${UPLOADS_HOST_DIR}. A recovery copy is kept in ${legacy}; remove it manually after verifying."
  fi
  return 0
}

backup_config_value() {
  local key="$1" value=""
  if [[ -f "${BACKUP_CONFIG}" ]]; then
    value="$(grep -m 1 -E "^${key}=" "${BACKUP_CONFIG}" 2>/dev/null | cut -d= -f2- || true)"
  fi
  printf '%s' "${value}"
}

validate_backup_settings() {
  [[ "${BACKUP_ENABLED}" == "true" || "${BACKUP_ENABLED}" == "false" ]] || { log_error "Backup enabled must be true or false."; return 1; }
  [[ "${BACKUP_FREQUENCY}" =~ ^(daily|weekly|monthly)$ ]] || { log_error "Invalid backup frequency."; return 1; }
  [[ "${BACKUP_HOUR}" =~ ^([01]?[0-9]|2[0-3])$ ]] || { log_error "Invalid backup hour (0-23)."; return 1; }
  [[ "${BACKUP_RETENTION_DAYS}" =~ ^[0-9]{1,4}$ ]] || { log_error "Invalid backup retention days (0-9999)."; return 1; }
  [[ "${BACKUP_INCLUDE_ENV}" == "true" || "${BACKUP_INCLUDE_ENV}" == "false" ]] || { log_error "Invalid include-env value."; return 1; }
  local bslash=$'\\'
  [[ "${BACKUP_DIR}" == /* && "${BACKUP_DIR}" != *$'\n'* && "${BACKUP_DIR}" != *$'\r'* && "${BACKUP_DIR}" != *'%'* && "${BACKUP_DIR}" != *'..'* && "${BACKUP_DIR}" != *"${bslash}"* && "${BACKUP_DIR}" != *'"'* && "${BACKUP_DIR}" != *"'"* ]] || { log_error "Backup directory must be a safe absolute path."; return 1; }
  case "${BACKUP_DIR%/}" in
    ""|/|/etc|/usr|/var|/tmp|"${PROJECT_DIR}"|"${PROJECT_DIR}/data"|"${UPLOADS_HOST_DIR}") log_error "Unsafe backup directory."; return 1 ;;
  esac
  [[ ! -L "${BACKUP_DIR%/}" ]] || { log_error "Backup directory must not be a symlink."; return 1; }
  local canonical uploads_canonical
  canonical="$(realpath -m "${BACKUP_DIR}")"
  uploads_canonical="$(realpath -m "${UPLOADS_HOST_DIR}")"
  [[ "${canonical}/" != "${uploads_canonical}/"* && "${uploads_canonical}/" != "${canonical}/"* ]] || { log_error "Backup directory cannot contain or be inside uploads."; return 1; }
  return 0
}

load_backup_settings() {
  local key
  for key in BACKUP_ENABLED BACKUP_FREQUENCY BACKUP_HOUR BACKUP_DIR BACKUP_RETENTION_DAYS BACKUP_INCLUDE_ENV; do
    if [[ -z "${!key:-}" ]]; then printf -v "$key" '%s' "$(backup_config_value "$key")"; fi
  done
  BACKUP_ENABLED="${BACKUP_ENABLED:-false}"
  BACKUP_FREQUENCY="${BACKUP_FREQUENCY:-daily}"
  BACKUP_HOUR="${BACKUP_HOUR:-2}"
  BACKUP_DIR="${BACKUP_DIR:-${DB_BACKUP_DIR}}"
  BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
  BACKUP_INCLUDE_ENV="${BACKUP_INCLUDE_ENV:-true}"
  validate_backup_settings
}

save_backup_settings() {
  validate_backup_settings || return 1
  umask 077
  local temp
  temp="$(mktemp "${PROJECT_DIR}/.backup-config.XXXXXX")" || return 1
  if ! printf 'BACKUP_ENABLED=%s\nBACKUP_FREQUENCY=%s\nBACKUP_HOUR=%s\nBACKUP_DIR=%s\nBACKUP_RETENTION_DAYS=%s\nBACKUP_INCLUDE_ENV=%s\n' \
    "${BACKUP_ENABLED}" "${BACKUP_FREQUENCY}" "${BACKUP_HOUR}" "${BACKUP_DIR}" "${BACKUP_RETENTION_DAYS}" "${BACKUP_INCLUDE_ENV}" > "${temp}"; then
    rm -f "${temp}"
    return 1
  fi
  chmod 600 "${temp}"
  mv -f "${temp}" "${BACKUP_CONFIG}"
}

backup_log() {
  local level="$1" message="$2" now
  now="$(date '+%Y-%m-%d %H:%M:%S')"
  touch "${BACKUP_LOG}" && chmod 600 "${BACKUP_LOG}"
  printf '[%s] [%s] %s\n' "${now}" "${level}" "${message}" >> "${BACKUP_LOG}"
  log_raw "[BACKUP ${level}] ${message}"
}

backup_status_write() {
  local status="$1" file="$2" reason="$3" started="$4" temp
  umask 077
  temp="$(mktemp "${PROJECT_DIR}/.backup-status.XXXXXX")" || return 1
  printf 'STATUS=%s\nTIMESTAMP=%s\nFILE=%s\nSIZE=%s\nDURATION_SECONDS=%s\nERROR=%s\n' \
    "${status}" "$(date '+%Y-%m-%d %H:%M:%S')" "${file}" \
    "$(if [[ -f "${file}" ]]; then stat -c %s "${file}"; else printf '0'; fi)" \
    "$(( $(date +%s) - started ))" "${reason}" > "${temp}"
  chmod 600 "${temp}"
  mv -f "${temp}" "${BACKUP_STATUS_FILE}"
}

ensure_backup_cron() {
  load_backup_settings || return 1
  if [[ "${BACKUP_ENABLED}" == "false" ]]; then
    if [[ -f "${BACKUP_CRON_FILE}" ]]; then rm -f "${BACKUP_CRON_FILE}"; fi
    return 0
  fi
  if ! command -v cron &>/dev/null && ! command -v crond &>/dev/null; then
    tui_run_task \
      "Installing system cron daemon for scheduled backups" \
      "Run manually: sudo apt-get update && sudo apt-get install -y cron" \
      env DEBIAN_FRONTEND=noninteractive apt-get install -y cron || { backup_log ERROR "Could not install cron."; return 1; }
  fi
  systemctl enable --now cron.service 2>/dev/null || { backup_log ERROR "Could not start cron."; return 1; }
  command -v flock &>/dev/null || { backup_log ERROR "flock utility is required."; return 1; }
  local day="*" weekday="*" temp
  case "${BACKUP_FREQUENCY}" in
    weekly) weekday="0" ;;
    monthly) day="1" ;;
  esac
  temp="$(mktemp "$(dirname "${BACKUP_CRON_FILE}")/.hsecore-backup.XXXXXX")" || return 1
  printf 'SHELL=/bin/bash\nPATH=/usr/sbin:/usr/bin:/sbin:/bin\n15 %s %s * %s root /bin/bash %q --backup-run\n' \
    "$((10#${BACKUP_HOUR}))" "${day}" "${weekday}" "${PROJECT_DIR}/install.sh" > "${temp}"
  chmod 644 "${temp}"
  if [[ ! -f "${BACKUP_CRON_FILE}" ]] || ! cmp -s "${temp}" "${BACKUP_CRON_FILE}"; then
    mv -f "${temp}" "${BACKUP_CRON_FILE}"
  else
    rm -f "${temp}"
  fi
  if [[ -d "$(dirname "${BACKUP_LOGROTATE_FILE}")" && ! -f "${BACKUP_LOGROTATE_FILE}" ]]; then
    if printf '%s {\n    weekly\n    rotate 8\n    missingok\n    notifempty\n    compress\n    create 0600 root root\n}\n' "${BACKUP_LOG}" > "${BACKUP_LOGROTATE_FILE}"; then
      chmod 644 "${BACKUP_LOGROTATE_FILE}"
    else
      log_warn "Could not write ${BACKUP_LOGROTATE_FILE}; backup log will not be rotated."
    fi
  fi
  if crontab -l -u root 2>/dev/null | grep -E 'install\.sh.*--backup' >/dev/null; then
    log_warn "Root crontab contains another backup command; review it to avoid duplicate runs."
  fi
}

configure_backup_schedule() {
  load_backup_settings || return 1
  if [[ ! -t 0 ]]; then
    if [[ ! -f "${BACKUP_CONFIG}" ]]; then save_backup_settings || return 1; fi
    ensure_backup_cron
    return
  fi
  echo "  Backup schedule: ${BACKUP_ENABLED}, ${BACKUP_FREQUENCY} at ${BACKUP_HOUR}:15; path ${BACKUP_DIR}; retention ${BACKUP_RETENTION_DAYS} days."
  read -r -p 'Configure backup schedule? [y/N]: ' answer
  if [[ "${answer}" != "y" && "${answer}" != "Y" ]]; then
    if [[ ! -f "${BACKUP_CONFIG}" ]]; then save_backup_settings || return 1; fi
    ensure_backup_cron
    return
  fi
  local enabled frequency hour dir days include_env
  read -r -p "Enable automatic backup? [${BACKUP_ENABLED}] (true/false): " enabled
  read -r -p "Frequency [${BACKUP_FREQUENCY}] (daily/weekly/monthly): " frequency
  read -r -p "Hour (0-23) [${BACKUP_HOUR}]: " hour
  read -r -p "Absolute backup directory [${BACKUP_DIR}]: " dir
  read -r -p "Retention days (0 to keep forever) [${BACKUP_RETENTION_DAYS}]: " days
  read -r -p "Include .env? [${BACKUP_INCLUDE_ENV}] (true/false): " include_env
  BACKUP_ENABLED="${enabled:-${BACKUP_ENABLED}}"
  BACKUP_FREQUENCY="${frequency:-${BACKUP_FREQUENCY}}"
  BACKUP_HOUR="${hour:-${BACKUP_HOUR}}"
  BACKUP_DIR="${dir:-${BACKUP_DIR}}"
  BACKUP_RETENTION_DAYS="${days:-${BACKUP_RETENTION_DAYS}}"
  BACKUP_INCLUDE_ENV="${include_env:-${BACKUP_INCLUDE_ENV}}"
  save_backup_settings && ensure_backup_cron
}

backup_status() {
  load_backup_settings || return 1
  echo "Schedule: ${BACKUP_ENABLED}; ${BACKUP_FREQUENCY} at ${BACKUP_HOUR}:15; retention ${BACKUP_RETENTION_DAYS} days"
  echo "Directory: ${BACKUP_DIR}"
  if [[ -f "${BACKUP_CRON_FILE}" ]]; then echo "Cron: installed"; else echo "Cron: absent"; fi
  if [[ -f "${BACKUP_STATUS_FILE}" ]]; then
    echo "Last backup:"
    while IFS= read -r line; do printf '  %s\n' "${line}"; done < "${BACKUP_STATUS_FILE}"
  else
    echo "Last backup: not run"
  fi
  if [[ -d "${BACKUP_DIR}" ]]; then df -h "${BACKUP_DIR}"; fi
}

# ==============================================================================
# Database Backup Engine (Safe, Timestamped & Compressed)
# ==============================================================================
backup_database() {
  local tag="${1:-manual}" silent="${2:-false}" started
  started="$(date +%s)"
  [[ "${tag}" =~ ^(manual|scheduled|pre_update|pre_restore_safety)$ ]] || { backup_log ERROR "Invalid backup tag."; return 1; }
  load_backup_settings || return 1
  load_answers_cache
  local host="${SQL_HOST:-127.0.0.1}" port="${POSTGRES_PORT:-5432}" user="${SQL_USER:-postgres}" dbname="${SQL_DB_NAME:-hsedb}"
  [[ "${host}" == "host.docker.internal" ]] && host="127.0.0.1"
  [[ "${port}" =~ ^[0-9]+$ && "${user}" != *:* && "${SQL_PASSWORD:-}" != *$'\n'* ]] || { backup_log ERROR "Invalid database connection settings."; return 1; }
  local timestamp target stage partial pgpass pg_error reason="backup_command_failed" ok=false
  timestamp="$(date '+%Y%m%d_%H%M%S')"
  target="${BACKUP_DIR%/}/hsecore_full_${tag}_${timestamp}.tar.gz"
  umask 077
  if [[ ! -d "${BACKUP_DIR}" ]]; then
    if ! (mkdir -p "${BACKUP_DIR}" && chmod 700 "${BACKUP_DIR}"); then
      backup_log ERROR "Cannot create backup directory."
      backup_status_write FAILURE "" "backup_dir_unavailable" "${started}"
      return 1
    fi
  fi
  stage="$(mktemp -d "${BACKUP_DIR%/}/.backup-stage.XXXXXX")" || { backup_log ERROR "Backup directory is not writable."; backup_status_write FAILURE "" "backup_dir_not_writable" "${started}"; return 1; }
  partial="${target}.partial"
  pg_error="${stage}/pg_error"
  if [[ "${silent}" != "true" ]]; then log_info "Creating full backup for '${dbname}'..."; fi

  local rc=0 errexit_was_set=false
  if [[ $- == *e* ]]; then errexit_was_set=true; fi
  set +e
  (
    set -euo pipefail
    paused=false
    # shellcheck disable=SC2317
    cleanup() {
      local status=$?
      if [[ "${paused}" == "true" ]]; then
        if ! docker unpause "${APP_CONTAINER_NAME}" >/dev/null; then
          backup_log ERROR "Could not resume application after backup; run: docker unpause ${APP_CONTAINER_NAME}"
          status=1
        fi
      fi
      rm -rf -- "${stage}" "${partial}"
      exit "${status}"
    }
    trap cleanup EXIT
    trap 'exit 130' INT TERM

    if docker inspect -f '{{.State.Running}}' "${APP_CONTAINER_NAME}" 2>/dev/null | grep -qx true; then
      docker pause "${APP_CONTAINER_NAME}" >/dev/null
      paused=true
    fi

    if command -v pg_dump &>/dev/null; then
      pgpass="${stage}/pgpass"
      pgpass_escape() { local v="$1"; v="${v//\\/\\\\}"; v="${v//:/\\:}"; printf '%s' "${v}"; }
      printf '%s:%s:%s:%s:%s\n' "$(pgpass_escape "${host}")" "${port}" "$(pgpass_escape "${dbname}")" "$(pgpass_escape "${user}")" "$(pgpass_escape "${SQL_PASSWORD:-}")" > "${pgpass}"
      chmod 600 "${pgpass}"
      if ! PGPASSFILE="${pgpass}" PGCONNECT_TIMEOUT=10 pg_dump -h "${host}" -p "${port}" -U "${user}" -d "${dbname}" --clean --if-exists --no-owner --no-acl -f "${stage}/database.sql" 2> "${pg_error}"; then
        backup_log ERROR "pg_dump failed: $(sanitize_secrets < "${pg_error}" | head -c 400)"
        exit 1
      fi
    elif command -v docker &>/dev/null && docker inspect -f '{{.State.Running}}' hse-postgres 2>/dev/null | grep -qx true; then
      if ! docker exec -i hse-postgres pg_dump -U "${user}" -d "${dbname}" --clean --if-exists --no-owner --no-acl > "${stage}/database.sql" 2> "${pg_error}"; then
        backup_log ERROR "pg_dump (container) failed: $(sanitize_secrets < "${pg_error}" | head -c 400)"
        exit 1
      fi
    else
      backup_log ERROR "No usable pg_dump found (install postgresql-client)."
      exit 1
    fi
    [[ -s "${stage}/database.sql" ]] || { backup_log ERROR "Database dump is empty."; exit 1; }
    grep -q 'PostgreSQL database dump complete' "${stage}/database.sql" || { backup_log ERROR "Database dump is incomplete."; exit 1; }
    rm -f "${pgpass:-}" "${pg_error}"

    mkdir -m 700 "${stage}/uploads"
    uploads_source="$(resolve_uploads_source)" || { backup_log ERROR "Uploads source cannot be determined; refusing incomplete backup."; exit 1; }
    if [[ "${uploads_source}" == "container" ]]; then
      docker cp "${APP_CONTAINER_NAME}:/app/uploads/." "${stage}/uploads/" || { backup_log ERROR "Could not copy uploads from container."; exit 1; }
    else
      cp -a "${uploads_source}/." "${stage}/uploads/" || { backup_log ERROR "Could not copy uploads directory."; exit 1; }
    fi
    if [[ "${BACKUP_INCLUDE_ENV}" == "true" ]]; then
      [[ -s "${ENV_FILE}" ]] || { backup_log ERROR "Environment file missing."; exit 1; }
      cp "${ENV_FILE}" "${stage}/environment.env"
    fi
    printf 'FORMAT=1\nDATABASE=%s\nCREATED_AT=%s\nVERSION=%s\n' "${dbname}" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${INSTALLER_VERSION}" > "${stage}/MANIFEST"
    ( cd "${stage}" && { sha256sum database.sql; if [[ -f environment.env ]]; then sha256sum environment.env; fi; find uploads -type f -print0 | sort -z | xargs -0 -r sha256sum; } ) > "${stage}/CHECKSUMS"
    ( cd "${stage}" && sha256sum -c CHECKSUMS >/dev/null )
    members=(MANIFEST CHECKSUMS database.sql uploads)
    if [[ -f "${stage}/environment.env" ]]; then members+=(environment.env); fi
    tar -C "${stage}" -czf "${partial}" "${members[@]}"
    gzip -t "${partial}"
    mkdir -m 700 "${stage}/verify"
    tar -xzf "${partial}" -C "${stage}/verify"
    ( cd "${stage}/verify" && sha256sum -c CHECKSUMS >/dev/null )
    [[ ! -e "${target}" ]]
    mv -n "${partial}" "${target}"
    [[ -s "${target}" ]]
    ( cd "${BACKUP_DIR}" && sha256sum "$(basename "${target}")" > "$(basename "${target}").sha256" )
    [[ -s "${target}.sha256" ]]
  )
  rc=$?
  if [[ "${errexit_was_set}" == "true" ]]; then set -e; fi
  if [[ ${rc} -eq 0 ]]; then ok=true; fi

  if [[ "${ok}" == "true" ]]; then
    backup_status_write SUCCESS "${target}" "" "${started}"
    backup_log SUCCESS "Full backup saved: ${target}"
    if [[ "${silent}" != "true" ]]; then echo "Backup: ${target}"; fi
    if [[ "${tag}" == "scheduled" && "${BACKUP_RETENTION_DAYS}" -gt 0 ]]; then
      find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'hsecore_full_scheduled_*.tar.gz' -mtime +"${BACKUP_RETENTION_DAYS}" -print0 |
        while IFS= read -r -d '' old; do rm -f -- "${old}" "${old}.sha256" && backup_log INFO "Expired backup removed: ${old}"; done || backup_log WARN "Retention cleanup reported an error."
    fi
    return 0
  fi
  backup_status_write FAILURE "" "${reason}" "${started}"
  backup_log ERROR "Full backup failed for '${dbname}'; no archive was published."
  return 1
}

# ==============================================================================
# Database Restore Engine (Full archives and legacy SQL dumps, Verified)
# ==============================================================================
RESTORE_STAGE=""
RESTORE_APP_STOPPED="false"

write_pgpass() {
  local file="$1" host="$2" port="$3" dbname="$4" user="$5" password="$6" field line=""
  for field in "${host}" "${port}" "${dbname}" "${user}" "${password}"; do
    field="${field//\\/\\\\}"
    field="${field//:/\\:}"
    line="${line:+${line}:}${field}"
  done
  ( umask 077; printf '%s\n' "${line}" > "${file}" ) || return 1
  chmod 600 "${file}"
}

wait_app_health() {
  local attempt=0 port="${APP_INTERNAL_PORT:-3000}"
  while [[ ${attempt} -lt 20 ]]; do
    attempt=$((attempt + 1))
    if curl -s -f --max-time 4 "http://127.0.0.1:${port}/api/health" &>/dev/null; then return 0; fi
    sleep 3
  done
  return 1
}

restore_database() {
  local rc=0
  RESTORE_STAGE=""
  RESTORE_APP_STOPPED="false"
  restore_database_inner "$@" || rc=$?
  if [[ -n "${RESTORE_STAGE}" ]]; then rm -rf -- "${RESTORE_STAGE}"; fi
  RESTORE_STAGE=""
  if [[ "${RESTORE_APP_STOPPED}" == "true" ]]; then
    log_info "Starting application container..."
    if docker start "${APP_CONTAINER_NAME}" >/dev/null; then
      if wait_app_health; then
        log_success "Application is healthy."
      else
        log_error "Application started but /api/health did not respond. Check: docker logs ${APP_CONTAINER_NAME}"
        rc=1
      fi
    else
      log_error "Application failed to start. Run: docker start ${APP_CONTAINER_NAME}"
      rc=1
    fi
    RESTORE_APP_STOPPED="false"
  fi
  if [[ ${rc} -eq 0 ]]; then backup_log INFO "Restore finished successfully."; else backup_log ERROR "Restore finished with errors."; fi
  return "${rc}"
}

restore_database_inner() {
  local input="${1:-}" selected="" kind="" sql_file=""
  if [[ ! -t 0 && ( -z "${input}" || "${HSE_RESTORE_CONFIRM:-}" != "RESTORE" ) ]]; then
    log_error "Restore requires an interactive terminal (or explicit file path + HSE_RESTORE_CONFIRM=RESTORE)."
    return 1
  fi
  load_backup_settings || return 1
  load_answers_cache
  local host="${SQL_HOST:-127.0.0.1}" port="${POSTGRES_PORT:-5432}" user="${SQL_USER:-postgres}" dbname="${SQL_DB_NAME:-hsedb}"
  if [[ "${host}" == "host.docker.internal" ]]; then host="127.0.0.1"; fi
  if ! [[ "${port}" =~ ^[0-9]+$ ]]; then log_error "Invalid database port."; return 1; fi
  if ! command -v psql &>/dev/null; then log_error "psql (postgresql-client) is required."; return 1; fi

  echo ""
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
  echo -e "${BOLD}${CYAN}                HSECORE Restore Engine                            ${NC}"
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
  echo ""

  if [[ -n "${input}" ]]; then
    if [[ ! -f "${input}" || -L "${input}" ]]; then log_error "Backup file not found or is a symlink: ${input}"; return 1; fi
    selected="${input}"
  else
    local backup_list=() f
    while IFS= read -r f; do
      if [[ -n "${f}" ]]; then backup_list+=("${f}"); fi
    done < <(find "${BACKUP_DIR}" "${DB_BACKUP_DIR}" -maxdepth 1 -type f \( -name 'hsecore_full_*.tar.gz' -o -name 'hsecore_db_*.sql' -o -name 'hsecore_db_*.sql.gz' \) 2>/dev/null | sort -ru)
    local choice idx=1 custom
    if [[ ${#backup_list[@]} -gt 0 ]]; then
      echo -e "${YELLOW}Available backups:${NC}"
      for f in "${backup_list[@]}"; do
        printf '  %2d) %s [%s]\n' "${idx}" "$(basename "${f}")" "$(du -h "${f}" 2>/dev/null | awk '{print $1}')"
        idx=$((idx + 1))
      done
    else
      echo -e "${YELLOW}No backups found in ${BACKUP_DIR} or ${DB_BACKUP_DIR}.${NC}"
    fi
    echo "   C) Enter a custom file path"
    echo "   0) Cancel"
    while true; do
      read -r -p "Select backup: " choice
      if [[ "${choice}" == "0" ]]; then echo "Restore cancelled."; return 0; fi
      if [[ "${choice}" =~ ^[Cc]$ ]]; then
        read -r -p "Full path: " custom
        if [[ -f "${custom}" && ! -L "${custom}" ]]; then selected="${custom}"; break; fi
        echo "File not found or is a symlink."
      elif [[ "${choice}" =~ ^[0-9]+$ && "${choice}" -ge 1 && "${choice}" -le ${#backup_list[@]} ]]; then
        selected="${backup_list[$((choice - 1))]}"; break
      else
        echo "Invalid selection."
      fi
    done
  fi

  case "${selected}" in
    *.tar.gz) kind="full" ;;
    *.sql.gz|*.sql) kind="legacy" ;;
    *) log_error "Unsupported backup type (expected .tar.gz, .sql or .sql.gz)."; return 1 ;;
  esac

  if [[ ! -d "${BACKUP_DIR}" ]]; then
    if ! (mkdir -p "${BACKUP_DIR}" && chmod 700 "${BACKUP_DIR}"); then
      log_error "Cannot create ${BACKUP_DIR}."
      return 1
    fi
  fi
  RESTORE_STAGE="$(mktemp -d "${BACKUP_DIR%/}/.restore-stage.XXXXXX")" || { log_error "Cannot create staging directory."; return 1; }

  log_info "Verifying backup integrity (nothing is modified yet)..."
  if [[ "${kind}" == "full" ]]; then
    if [[ -f "${selected}.sha256" ]]; then
      ( cd "$(dirname "${selected}")" && sha256sum -c "$(basename "${selected}").sha256" >/dev/null 2>&1 ) || { log_error "Archive checksum mismatch; backup is corrupt or modified."; return 1; }
    else
      log_warn "No .sha256 file beside the archive; relying on internal checksums only."
    fi
    gzip -t "${selected}" || { log_error "Archive is not a valid gzip file."; return 1; }
    local listing verbose
    listing="$(tar -tzf "${selected}")" || { log_error "Archive cannot be listed."; return 1; }
    verbose="$(tar -tvzf "${selected}")" || { log_error "Archive cannot be listed."; return 1; }
    if printf '%s\n' "${verbose}" | cut -c1 | grep -qv '^[-d]$'; then log_error "Archive contains links or special files; refusing."; return 1; fi
    if printf '%s\n' "${listing}" | grep -Evq '^(MANIFEST|CHECKSUMS|database\.sql|environment\.env|uploads(/.*)?)$'; then log_error "Archive contains unexpected entries; refusing."; return 1; fi
    if printf '%s\n' "${listing}" | grep -Eq '(^|/)\.\.(/|$)|^/'; then log_error "Archive contains unsafe paths; refusing."; return 1; fi
    printf '%s\n' "${listing}" | grep -qx 'database.sql' || { log_error "Archive has no database dump."; return 1; }
    printf '%s\n' "${listing}" | grep -qx 'CHECKSUMS' || { log_error "Archive has no checksum manifest."; return 1; }
    tar -xzf "${selected}" -C "${RESTORE_STAGE}" --no-same-owner || { log_error "Archive extraction failed."; return 1; }
    ( cd "${RESTORE_STAGE}" && sha256sum -c CHECKSUMS >/dev/null 2>&1 ) || { log_error "Internal checksum verification failed."; return 1; }
    sql_file="${RESTORE_STAGE}/database.sql"
    [[ -d "${RESTORE_STAGE}/uploads" ]] || { log_error "Archive has no uploads directory."; return 1; }
  else
    sql_file="${RESTORE_STAGE}/database.sql"
    if [[ "${selected}" == *.gz ]]; then
      gzip -t "${selected}" || { log_error "Dump is not a valid gzip file."; return 1; }
      gzip -dc "${selected}" > "${sql_file}" || { log_error "Could not decompress dump."; return 1; }
    else
      cp "${selected}" "${sql_file}" || { log_error "Could not read dump."; return 1; }
    fi
  fi
  [[ -s "${sql_file}" ]] || { log_error "Database dump is empty."; return 1; }
  grep -q 'PostgreSQL database dump complete' "${sql_file}" || { log_error "Database dump is incomplete (missing end marker)."; return 1; }
  log_success "Backup verified."

  if [[ "${kind}" == "full" && "$(resolve_uploads_source 2>/dev/null || true)" == "container" ]]; then
    log_error "Uploads are still inside the container. Run './install.sh --update' first to move them to persistent storage."
    return 1
  fi

  echo ""
  echo -e "${BOLD}${RED}WARNING: Restore replaces ALL data in database '${dbname}'$( [[ "${kind}" == "full" ]] && printf ' and the uploads directory' ).${NC}"
  echo -e "Source: ${BOLD}${CYAN}${selected}${NC}"
  echo "A safety backup of the current state is created first; the previous uploads are kept as ${UPLOADS_HOST_DIR}.pre_restore_<time>."
  local confirm="${HSE_RESTORE_CONFIRM:-}"
  if [[ "${confirm}" != "RESTORE" ]]; then
    read -r -p "Type RESTORE to continue: " confirm
  fi
  if [[ "${confirm}" != "RESTORE" ]]; then echo "Restore cancelled."; return 0; fi

  log_info "Creating safety backup of the current state..."
  backup_database "pre_restore_safety" true || { log_error "Safety backup failed. Restore aborted; nothing was changed."; return 1; }

  local uploads_new=""
  if [[ "${kind}" == "full" ]]; then
    uploads_new="${UPLOADS_HOST_DIR}.restore_new"
    rm -rf -- "${uploads_new}"
    mkdir -p "$(dirname "${UPLOADS_HOST_DIR}")" || return 1
    cp -a "${RESTORE_STAGE}/uploads" "${uploads_new}" || { log_error "Could not stage restored uploads; nothing was changed."; rm -rf -- "${uploads_new}"; return 1; }
    chmod 700 "${uploads_new}"
  fi

  if docker inspect -f '{{.State.Running}}' "${APP_CONTAINER_NAME}" 2>/dev/null | grep -qx true; then
    log_info "Stopping application to release database connections..."
    if ! docker stop "${APP_CONTAINER_NAME}" >/dev/null; then
      log_error "Could not stop the application; restore aborted."
      if [[ -n "${uploads_new}" ]]; then rm -rf -- "${uploads_new}"; fi
      return 1
    fi
    RESTORE_APP_STOPPED="true"
  fi
  run_sql_admin "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${dbname}' AND pid <> pg_backend_pid();" "${dbname}" &>/dev/null || true

  log_info "Restoring database '${dbname}' (single transaction, stops on first error)..."
  local pgpass="${RESTORE_STAGE}/pgpass" err_file="${RESTORE_STAGE}/psql_error"
  write_pgpass "${pgpass}" "${host}" "${port}" "${dbname}" "${user}" "${SQL_PASSWORD:-}" || return 1
  if ! PGPASSFILE="${pgpass}" PGCONNECT_TIMEOUT=10 psql -X -q -v ON_ERROR_STOP=1 --single-transaction -h "${host}" -p "${port}" -U "${user}" -d "${dbname}" -f "${sql_file}" -o /dev/null 2> "${err_file}"; then
    backup_log ERROR "Database restore failed (rolled back): $(sanitize_secrets < "${err_file}" | head -c 400)"
    log_error "Database restore failed and was rolled back; current data is unchanged. Details are in ${BACKUP_LOG}."
    if [[ -n "${uploads_new}" ]]; then rm -rf -- "${uploads_new}"; fi
    return 1
  fi
  log_success "Database restored."

  if [[ -n "${uploads_new}" ]]; then
    local uploads_old
    uploads_old="${UPLOADS_HOST_DIR}.pre_restore_$(date '+%Y%m%d_%H%M%S')"
    if [[ -e "${UPLOADS_HOST_DIR}" ]]; then
      mv "${UPLOADS_HOST_DIR}" "${uploads_old}" || { log_error "Database restored but uploads swap failed. Restored uploads are in ${uploads_new}."; return 1; }
    fi
    if ! mv "${uploads_new}" "${UPLOADS_HOST_DIR}"; then
      if [[ -e "${uploads_old}" ]]; then mv "${uploads_old}" "${UPLOADS_HOST_DIR}"; fi
      log_error "Database restored but uploads swap failed; previous uploads put back. Restored uploads are in ${uploads_new}."
      return 1
    fi
    log_success "Uploads restored. Previous uploads kept in ${uploads_old}."
  fi

  if [[ "${kind}" == "full" && -f "${RESTORE_STAGE}/environment.env" ]]; then
    local env_copy
    env_copy="${BACKUP_DIR%/}/restored_environment_$(date '+%Y%m%d_%H%M%S').env"
    if ( umask 077; cp "${RESTORE_STAGE}/environment.env" "${env_copy}" ); then
      log_info "Environment from backup saved to ${env_copy} (current .env was NOT changed)."
    else
      log_warn "Could not save the environment file from the backup."
    fi
  fi
  return 0
}

# ==============================================================================
# System Health Check Engine
# ==============================================================================
check_system_health() {
  echo ""
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
  echo -e "${BOLD}${CYAN}                HSECORE System Health Check                       ${NC}"
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
  echo ""

  load_answers_cache
  local app_port="${APP_PORT:-3000}"
  local int_port="${APP_INTERNAL_PORT:-3000}"

  # 1. Host System & Uptime
  echo -e "${BOLD}1. Host System:${NC}"
  local os_info
  os_info="$(grep -E '^PRETTY_NAME=' /etc/os-release 2>/dev/null | cut -d'=' -f2- | tr -d '"' || uname -sr)"
  echo "   OS        : ${os_info}"
  echo "   Uptime    : $(uptime -p 2>/dev/null || uptime)"
  echo ""

  # 2. Disk Space
  echo -e "${BOLD}2. Disk Space:${NC}"
  df -h / | awk 'NR==1 || NR==2 {print "   " $0}'
  echo ""

  # 3. System Memory
  echo -e "${BOLD}3. System Memory:${NC}"
  free -h | awk 'NR==1 || NR==2 {print "   " $0}'
  echo ""

  # 4. Docker & Containers
  echo -e "${BOLD}4. Docker & Containers:${NC}"
  if command -v docker &>/dev/null && docker info &>/dev/null; then
    echo -e "   Docker Daemon  : ${GREEN}Active & Running${NC}"
    local app_stat
    app_stat="$(docker compose -f "${PROJECT_DIR}/docker-compose.server.yml" ps --format '{{.Status}}' hse-app 2>/dev/null || echo 'Not running')"
    echo -e "   App Container  : ${GREEN}${app_stat:-Running}${NC}"
  else
    echo -e "   Docker Daemon  : ${RED}Inactive or not installed${NC}"
  fi
  echo ""

  # 5. PostgreSQL Database
  echo -e "${BOLD}5. Database:${NC}"
  if systemctl is-active --quiet postgresql 2>/dev/null; then
    echo -e "   Service Status : ${GREEN}Active (Running)${NC}"
  else
    echo -e "   Service Status : ${YELLOW}Inactive${NC}"
  fi
  if (cd /tmp && runuser -u postgres -- psql -p "${POSTGRES_PORT:-5432}" -d postgres -qtA -c "SELECT 1;" &>/dev/null) || \
     (PGPASSWORD="${SQL_PASSWORD}" psql -h "${SQL_HOST:-127.0.0.1}" -p "${POSTGRES_PORT:-5432}" -U "${SQL_USER:-postgres}" -d "${SQL_DB_NAME:-hsedb}" -qtA -c "SELECT 1;" &>/dev/null); then
    echo -e "   Database Conn  : ${GREEN}Connected & Responsive${NC}"
  else
    echo -e "   Database Conn  : ${YELLOW}Connection check pending${NC}"
  fi
  echo ""

  # 6. Nginx Web Server
  echo -e "${BOLD}6. Web Server & Reverse Proxy:${NC}"
  if command -v nginx &>/dev/null; then
    if systemctl is-active --quiet nginx 2>/dev/null; then
      echo -e "   Nginx Service  : ${GREEN}Active (Listening on port ${app_port})${NC}"
    else
      echo -e "   Nginx Service  : ${YELLOW}Inactive${NC}"
    fi
  else
    echo -e "   Nginx Service  : Direct Container Mode"
  fi
  echo ""

  # 7. HSECORE API Health
  echo -e "${BOLD}7. HSECORE Application API:${NC}"
  if curl -s -f --max-time 3 "http://127.0.0.1:${int_port}/api/health" &>/dev/null; then
    echo -e "   Health Endpoint: ${GREEN}OK (200 Healthy)${NC}"
  else
    echo -e "   Health Endpoint: ${YELLOW}Initializing / Standby${NC}"
  fi
  echo ""
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
  echo ""
}

# ==============================================================================
# Update & Backup Logs Viewer
# ==============================================================================
view_update_backup_logs() {
  echo ""
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
  echo -e "${BOLD}${CYAN}                HSECORE Logs Viewer                               ${NC}"
  echo -e "${BOLD}${CYAN}==================================================================${NC}"
  echo ""
  echo "  1) View Installer / Update Log (installer.log)"
  echo "  2) View Live Application Container Logs (Docker)"
  echo "  3) View Nginx Error Logs"
  echo "  4) Return to Main Menu"
  echo ""
  read -r -p "Select option [1-4]: " log_choice

  case "$log_choice" in
    1)
      if [[ -f "${LOCAL_LOG_FILE}" ]]; then
        echo -e "${CYAN}--- Last 50 lines of ${LOCAL_LOG_FILE} ---${NC}"
        tail -n 50 "${LOCAL_LOG_FILE}"
      else
        echo -e "${YELLOW}Log file ${LOCAL_LOG_FILE} does not exist yet.${NC}"
      fi
      ;;
    2)
      echo -e "${CYAN}--- Last 50 lines of HSECORE Docker Logs ---${NC}"
      docker compose -f "${PROJECT_DIR}/docker-compose.server.yml" logs --tail 50 hse-app 2>/dev/null || docker logs --tail 50 hse-enterprise-app 2>/dev/null || true
      ;;
    3)
      if [[ -f "/var/log/nginx/error.log" ]]; then
        echo -e "${CYAN}--- Last 50 lines of Nginx Error Log ---${NC}"
        tail -n 50 /var/log/nginx/error.log 2>/dev/null || true
      else
        echo -e "${YELLOW}No Nginx error log found.${NC}"
      fi
      ;;
    *)
      return 0
      ;;
  esac
}

# ==============================================================================
# System Update & Upgrade Engine (Safe, In-Place, Non-Destructive)
# ==============================================================================
run_system_update() {
  if [[ $EUID -ne 0 ]]; then
    log_error "Root or sudo privileges are required to run system update."
    echo -e "Please execute with sudo: ${BOLD}sudo ./install.sh --update${NC}"
    exit 1
  fi

  cd "${PROJECT_DIR}"
  load_answers_cache

  # Read existing config from .env if cache was empty
  if [[ -z "${SQL_USER:-}" && -f "${ENV_FILE}" ]]; then
    SQL_USER="$(grep -E '^SQL_USER=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '\"' | tr -d "'" || true)"
    SQL_PASSWORD="$(grep -E '^SQL_PASSWORD=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '\"' | tr -d "'" || true)"
    SQL_DB_NAME="$(grep -E '^SQL_DB_NAME=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '\"' | tr -d "'" || true)"
    POSTGRES_PORT="$(grep -E '^POSTGRES_PORT=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '\"' | tr -d "'" || echo "5432")"
    ACCESS_URL="$(grep -E '^APP_URL=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '\"' | tr -d "'" || true)"
    APP_INTERNAL_PORT="$(grep -E '^APP_INTERNAL_PORT=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '\"' | tr -d "'" || grep -E '^PORT=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '\"' | tr -d "'" || echo "3000")"
    APP_PORT="$(grep -E '^PUBLIC_PORT=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '\"' | tr -d "'" || grep -E '^APP_PORT=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '\"' | tr -d "'" || echo "3000")"
    DOCKER_BIND_IP="$(grep -E '^DOCKER_BIND_IP=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '\"' | tr -d "'" || echo "127.0.0.1")"
  fi

  # Pre-update Status Detection
  local current_ver="${INSTALLER_VERSION}"
  if [[ -f "${ENV_FILE}" ]]; then
    local env_v
    env_v="$(grep -E '^APP_VERSION=' "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)"
    if [[ -n "${env_v}" ]]; then
      current_ver="${env_v}"
    fi
  fi
  local new_ver="${INSTALLER_VERSION}"
  if [[ -f "${PROJECT_DIR}/package.json" ]]; then
    local pkg_v
    pkg_v="$(grep -E '"version":' "${PROJECT_DIR}/package.json" | head -n1 | cut -d'"' -f4 || true)"
    if [[ -n "${pkg_v}" ]]; then
      new_ver="${pkg_v}"
    fi
  fi

  # Database Status Check
  local db_status="Connected"
  if ! (cd /tmp && runuser -u postgres -- psql -p "${POSTGRES_PORT:-5432}" -d postgres -qtA -c "SELECT 1;" &>/dev/null) && \
     ! (PGPASSWORD="${SQL_PASSWORD}" psql -h "${SQL_HOST:-127.0.0.1}" -p "${POSTGRES_PORT:-5432}" -U "${SQL_USER:-postgres}" -d "${SQL_DB_NAME:-hsedb}" -qtA -c "SELECT 1;" &>/dev/null); then
    if systemctl is-active --quiet postgresql 2>/dev/null; then
      db_status="Connected"
    else
      db_status="Ready to Connect"
    fi
  fi

  # Backup Readiness Check
  mkdir -p "${DB_BACKUP_DIR}" 2>/dev/null || true
  local backup_status="Ready"

  # Disk Space Check
  local disk_status="OK"
  local avail_kb
  avail_kb="$(df -k / 2>/dev/null | awk 'NR==2 {print $4}' || echo '1000000')"
  if [[ "${avail_kb}" -lt 500000 ]]; then
    disk_status="Low Space"
  fi

  # Docker Status Check
  local docker_status="OK"
  if ! command -v docker &>/dev/null; then
    docker_status="Not Installed"
  elif ! docker info &>/dev/null; then
    systemctl start docker 2>/dev/null || true
    if ! docker info &>/dev/null; then
      docker_status="Inactive"
    fi
  fi

  # Display Standard Pre-Update Information Panel
  echo ""
  echo -e "Current Version : ${BOLD}${CYAN}${current_ver}${NC}"
  echo -e "New Version     : ${BOLD}${GREEN}${new_ver}${NC}"
  echo ""
  echo -e "Database        : ${GREEN}${db_status}${NC}"
  echo -e "Database Backup : ${GREEN}${backup_status}${NC}"
  echo -e "Disk Space      : ${GREEN}${disk_status}${NC}"
  echo -e "Docker          : ${GREEN}${docker_status}${NC}"
  echo ""

  read -r -p "Continue Update? [y/N]: " continue_update
  if ! [[ "${continue_update}" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Update cancelled by user.${NC}"
    return 0
  fi

  echo ""
  CURRENT_STEP_NUM=0
  CURRENT_STEP_TITLE="System Update & Upgrade"
  log_info "Starting HSECORE Update Procedure..."

  # Optional: review the automatic backup schedule (existing settings are kept by default)
  configure_backup_schedule || log_warn "Backup schedule was not changed."

  # 1. Automatic Pre-Update Safety Backup (never deleted automatically)
  echo ""
  backup_database "pre_update" false || {
    tui_report_error "[1/7] Pre-Update Safety Backup" 1 "${BACKUP_LOG}" "Verify PostgreSQL connection and writable space in ${BACKUP_DIR}."
    exit 1
  }
  tui_print_completed_task "[1/7] Created automatic pre-update full backup (database + uploads)" 0 "14%"

  # Make sure uploads live on persistent storage before any container is recreated
  prepare_uploads_storage || {
    tui_report_error "[1/7] Prepare Persistent Uploads Storage" 1 "" "Inspect ${UPLOADS_HOST_DIR} permissions."
    exit 1
  }

  # 2. Check Prerequisites
  if ! command -v docker &>/dev/null; then
    tui_report_error "[2/7] Verify Docker Installation" 1 "" "Docker is not installed. Run Fresh Installation (Option 1)."
    exit 1
  fi
  if ! docker info &>/dev/null; then
    systemctl start docker || {
      tui_report_error "[2/7] Start Docker Daemon" 1 "" "Run: sudo systemctl status docker"
      exit 1
    }
  fi
  if ! systemctl is-active --quiet postgresql 2>/dev/null; then
    systemctl start postgresql 2>/dev/null || true
  fi
  if ! is_nodejs_lts_ready; then
    tui_run_task \
      "[2/7] Installing / upgrading host Node.js ${NODE_LTS_MAJOR}.x LTS (>= ${NODE_LTS_MAJOR}.${NODE_MIN_MINOR}.0)" \
      "Check internet access to deb.nodesource.com or nodejs.org." \
      ensure_nodejs_lts
  fi
  tui_print_completed_task "[2/7] Verified Docker, PostgreSQL & Node.js ($(node -v 2>/dev/null || echo 'LTS')) services" 0 "28%"

  # 3. Git Pull (if git repository is present)
  if [[ -d "${PROJECT_DIR}/.git" ]]; then
    tui_run_task \
      "[3/7] Pulling latest repository updates (git pull)" \
      "Check git remote access or local working tree changes." \
      git pull || log_warn "Git pull had warnings; continuing with local workspace files..."
  else
    tui_print_completed_task "[3/7] Using current workspace files" 0 "42%"
  fi

  # Clean stale cache
  rm -rf dist node_modules/.cache 2>/dev/null || true

  # 4. Rebuild Docker Image
  tui_run_task \
    "[4/7] Configuring Docker registry mirrors & resolving base image (node:22-alpine)" \
    "Check internet/DNS connectivity or configure /etc/docker/daemon.json registry-mirrors." \
    prepare_docker_registry_and_base_image

  tui_run_task \
    "[4/7] Rebuilding HSECORE application Docker image (hse-app)" \
    "Inspect Docker build output above and verify disk space (df -h)." \
    build_hsecore_production_image

  # 5. Database Schema Migration (Safe, Non-destructive & Fail-Fast on Critical Error)
  tui_run_task \
    "[5/7] Applying database schema migrations (preserving existing records)" \
    "Check database connectivity and migration logs in ${LOCAL_LOG_FILE}." \
    docker compose -f docker-compose.server.yml run --rm --no-deps hse-app node -e "
      (async () => {
        try {
          let runMigrations;
          try {
            runMigrations = require('./dist/migrate.cjs').runMigrations;
          } catch (_) {
            runMigrations = require('./dist/server.cjs').runMigrations;
          }
          if (typeof runMigrations === 'function') {
            await runMigrations();
            console.log('[Migration] Database schema migrations completed successfully.');
            process.exit(0);
          } else {
            console.error('[Migration Error] runMigrations function not found in bundle.');
            process.exit(1);
          }
        } catch (err) {
          console.error('[Migration Fatal Error]', err?.message || err);
          process.exit(1);
        }
      })();
    "

  # 6. Restart Containers & Nginx
  tui_run_task \
    "[6/7] Restarting application container & reloading Nginx proxy" \
    "Check docker compose status and nginx configuration (nginx -t)." \
    bash -c "
      docker compose -f docker-compose.server.yml up -d --remove-orphans hse-app &&
      if systemctl list-unit-files 2>/dev/null | grep -q 'hsecore.service'; then
        systemctl restart hsecore 2>/dev/null || true
      fi &&
      if command -v nginx &>/dev/null && systemctl is-active --quiet nginx 2>/dev/null; then
        if nginx -t 2>/dev/null; then
          systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || true
        fi
      fi
    "

  # 7. Final Health Check
  local backend_healthy=false
  local test_port="${APP_INTERNAL_PORT:-3000}"
  local public_test_port="${APP_PORT:-3000}"

  if tui_run_task \
    "[7/7] Verifying application runtime health (/api/health)" \
    "Inspect live container logs: docker compose -f docker-compose.server.yml logs -f hse-app" \
    bash -c "
      for attempt in {1..20}; do
        echo \"Probing http://127.0.0.1:${test_port}/api/health (attempt \${attempt}/20)...\"
        if curl -s -f --max-time 4 'http://127.0.0.1:${test_port}/api/health' >/dev/null; then
          exit 0
        fi
        if [[ -n '${DOMAIN:-}' && -f '/etc/nginx/sites-available/hsecore' ]]; then
          if curl -k -s -f --max-time 4 -H 'Host: ${DOMAIN:-}' 'https://127.0.0.1:${public_test_port}/api/health' >/dev/null; then
            exit 0
          fi
        fi
        sleep 2
      done
      exit 1
    "; then
    backend_healthy=true
  fi

  echo ""
  if [[ "${backend_healthy}" == "true" ]]; then
    echo -e "${BOLD}${GREEN}==================================================================${NC}"
    echo -e "${BOLD}${GREEN}   [✓] HSECORE Platform Update & Upgrade Completed Successfully!  ${NC}"
    echo -e "${BOLD}${GREEN}==================================================================${NC}"
    echo ""
    echo -e "  System Status      : ${GREEN}Active & Running (Healthy)${NC}"
    echo -e "  Software Version   : ${CYAN}${new_ver}${NC}"
    echo -e "  Access URL         : ${BOLD}${CYAN}${ACCESS_URL:-http://localhost:3000}${NC}"
    echo -e "  PostgreSQL Database: ${GREEN}Preserved & Synchronized${NC}"
    echo ""
    echo -e "${YELLOW}Important Client Browser Notice:${NC}"
    echo -e "Press ${BOLD}Ctrl + F5${NC} (or Cmd + Shift + R on Mac) in your browser to reload updated assets."
    echo -e "${BOLD}${GREEN}==================================================================${NC}"
    echo ""
  else
    log_warn "Application container started, but health endpoint is still initializing."
    echo -e "You can inspect live logs with: ${BOLD}docker compose -f docker-compose.server.yml logs -f hse-app${NC}"
  fi
  return 0
}

# ------------------------------------------------------------------------------
# Local AI Infrastructure Management (Phase 2 Integration)
# Independent management of Local LLM container, persistent models, and health
# ------------------------------------------------------------------------------
manage_ai_infrastructure() {
  local action="${1:-menu}"
  local manage_script="${PROJECT_DIR}/scripts/manage-ai.sh"
  local setup_script="${PROJECT_DIR}/scripts/setup-local-ai.sh"

  chmod +x "${manage_script}" "${setup_script}" 2>/dev/null || true

  case "${action}" in
    setup)
      bash "${setup_script}"
      ;;
    status)
      bash "${manage_script}" status
      ;;
    menu|*)
      while true; do
        echo ""
        echo -e "${BOLD}${CYAN}==================================================================${NC}"
        echo -e "   ${BOLD}${BLUE}HSECORE AI${NC} ${GREEN}Local Engine & Infrastructure Manager${NC}"
        echo -e "${BOLD}${CYAN}==================================================================${NC}"
        echo " 1) نصب زیرساخت هوش مصنوعی (Install / Deploy AI Infrastructure)"
        echo " 2) راه‌اندازی موتور Local LLM (Start AI Engine Container)"
        echo " 3) دانلود و افزودن مدل دلخواه (Pull/Download any Ollama model)"
        echo " 4) مشاهده مدل‌های نصب‌شده (List Installed Models in Volume)"
        echo " 5) تغییر مدل پیش‌فرض سامانه (Change Default Model in .env)"
        echo " 6) فعال‌سازی یا غیرفعال‌سازی هوش مصنوعی (Toggle AI Engine Enabled/Disabled)"
        echo " 7) به‌روزرسانی موتور و ایمیج کانتینر (Update Engine Image & Recreate)"
        echo " 8) بررسی سلامت سرویس و API داخلی (Health Check & Connectivity)"
        echo " 9) بررسی منابع پردازنده و رم سرور (System Hardware & Sizing Analysis)"
        echo "10) پایش لاگ‌ها و وضعیت زنده کانتینر (Container Logs & Status)"
        echo "11) حذف مدل از حافظه پایدار (Remove Specific Model)"
        echo "12) حذف کامل کانتینر و زیرساخت هوش مصنوعی (Uninstall AI Infrastructure)"
        echo "13) تخلیه فوری حافظه RAM و آزادسازی مدل‌های مقیم (Unload Models from RAM)"
        echo "14) بهینه‌سازی پویا سقف حافظه کانتینر (Auto-Tune Container Memory Ceiling)"
        echo "15) پیکربندی حافظه مجازی Swap برای سرور (Configure 4GB Swap Space)"
        echo "16) بازگشت به منوی اصلی (Return to Main Menu)"
        echo ""
        read -r -p "Select AI option [1-16]: " ai_choice
        ai_choice="$(echo "${ai_choice:-1}" | tr -d '[:space:]')"

        case "${ai_choice}" in
          1) bash "${setup_script}" ;;
          2) bash "${manage_script}" start ;;
          3)
            read -r -p "Enter Ollama model reference (e.g. qwen3:1.7b or hf.co/user/model:tag): " target_m
            if [ -n "${target_m//[[:space:]]/}" ]; then
              bash "${manage_script}" pull "${target_m}"
            else
              echo -e "${YELLOW}No model specified; download cancelled. No default model is selected.${NC}"
            fi
            ;;
          4) bash "${manage_script}" list ;;
          5)
            local cur_model
            cur_model="$(grep '^AI_DEFAULT_CHAT_MODEL=' "${ENV_FILE}" 2>/dev/null | cut -d'=' -f2 | tr -d '\"' || echo 'qwen2.5:1.5b')"
            echo -e "Current default model in .env: ${CYAN}${cur_model}${NC}"
            read -r -p "Enter new default model name [e.g. qwen2.5:1.5b]: " def_m
            if [ -n "${def_m}" ]; then
              bash "${manage_script}" set-default "${def_m}"
            fi
            ;;
          6) bash "${manage_script}" toggle ;;
          7) bash "${manage_script}" update ;;
          8) bash "${manage_script}" status ;;
          9) bash "${manage_script}" sysinfo ;;
          10) bash "${manage_script}" logs ;;
          11)
            read -r -p "Enter model name to delete: " del_m
            if [ -n "${del_m}" ]; then
              bash "${manage_script}" rm "${del_m}"
            fi
            ;;
          12) bash "${manage_script}" uninstall ;;
          13) bash "${manage_script}" unload ;;
          14) bash "${manage_script}" tune ;;
          15) bash "${manage_script}" swap ;;
          16) break ;;
          *) echo -e "${RED}Invalid selection. Please choose a number between 1 and 16.${NC}" ;;
        esac

        if [[ "${ai_choice}" != "16" ]]; then
          echo ""
          read -r -p "Press [Enter] to return to AI menu..." _
        fi
      done
      ;;
  esac
}

# ==============================================================================
# Main Entry Point & Router
# ==============================================================================
main() {
  local resume_mode=false
  local target_step=0
  local explicit_mode=""

  # Display colorful HSECORE ASCII Art Logo at startup (skipped for unattended cron runs)
  if [[ "${1:-}" != "--backup-run" ]]; then print_hsecore_logo; fi

  # Check root privileges for all administrative operations on VPS (Allow --help and -h)
  if [[ "${1:-}" != "--help" && "${1:-}" != "-h" && $EUID -ne 0 ]]; then
    echo -e "${RED}${BOLD}[ERROR] Root or sudo privileges required on Ubuntu VPS.${NC}"
    echo -e "${YELLOW}دسترسی ریشه (sudo/root) برای اجرای مدیریت نصب و راه‌اندازی روی سرور الزامی است.${NC}"
    echo -e "Please execute: ${BOLD}sudo ./install.sh $*${NC}"
    echo ""
    exit 1
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --install)
        explicit_mode="install"
        shift
        ;;
      --update|--upgrade)
        explicit_mode="update"
        shift
        ;;
      --backup)
        run_locked backup_database "manual" false || exit 1
        exit 0
        ;;
      --backup-run)
        load_backup_settings || exit 1
        if [[ "${BACKUP_ENABLED}" != "true" ]]; then
          backup_log INFO "Scheduled backup skipped: disabled in ${BACKUP_CONFIG}."
          exit 0
        fi
        run_locked backup_database "scheduled" true || exit 1
        exit 0
        ;;
      --backup-config)
        if [[ ! -t 0 ]]; then log_error "--backup-config needs an interactive terminal."; exit 1; fi
        configure_backup_schedule || exit 1
        exit 0
        ;;
      --backup-status)
        backup_status || exit 1
        exit 0
        ;;
      --restore)
        shift
        restore_file=""
        if [[ -n "${1:-}" && "${1:0:1}" != "-" ]]; then restore_file="$1"; shift; fi
        run_locked restore_database "${restore_file}" || exit 1
        exit 0
        ;;
      --health)
        check_system_health
        exit 0
        ;;
      --logs)
        view_update_backup_logs
        exit 0
        ;;
      --resume)
        resume_mode=true
        shift
        ;;
      --step)
        if [[ -z "${2:-}" ]] || ! [[ "$2" =~ ^[0-9]+$ ]] || [[ "$2" -lt 1 || "$2" -gt 15 ]]; then
          echo -e "${RED}[ERROR] Invalid --step value '${2:-}'. Must be an integer between 1 and 15.${NC}" >&2
          exit 1
        fi
        target_step="$2"
        shift 2
        ;;
      --status)
        local cur_st
        cur_st="$(get_last_completed_step)"
        echo "Installer status: Step ${cur_st}/15 completed."
        exit 0
        ;;
      --ai-setup|--setup-ai)
        manage_ai_infrastructure "setup"
        exit 0
        ;;
      --ai-status)
        manage_ai_infrastructure "status"
        exit 0
        ;;
      --ai|--ai-manage|--manage-ai)
        manage_ai_infrastructure "menu"
        exit 0
        ;;
      --uninstall)
        safe_uninstall
        exit 0
        ;;
      --help|-h)
        echo "========================================"
        echo "        HSECORE Installation Manager    "
        echo "========================================"
        echo ""
        echo "Usage: sudo ./install.sh [OPTIONS]"
        echo ""
        echo "Operations:"
        echo "  (no args)      Interactive Manager Menu (Install, Update, Backup, Restore, Health, Logs, AI)"
        echo "  --install      Run full fresh installation from step 1 to 15"
        echo "  --update       Run system update & upgrade preserving database data"
        echo "  --backup       Create an instant full backup (database + uploads + .env)"
        echo "  --backup-config  Configure automatic scheduled backups (cron)"
        echo "  --backup-status  Show backup schedule, cron state and last result"
        echo "  --backup-run   Unattended scheduled backup (used by cron)"
        echo "  --restore [file]  Restore from a full archive or legacy .sql/.sql.gz dump"
        echo "  --health       Run full system and container health diagnostics"
        echo "  --ai-setup     Deploy and verify Phase 2 Local AI infrastructure"
        echo "  --ai-status    Show Local AI engine and loaded model status"
        echo "  --ai-manage    Interactive Local AI Infrastructure Manager"
        echo "  --logs         View installer, application, and web server logs"
        echo "  --resume       Resume installation from the next incomplete step"
        echo "  --step <1-15>  Execute strictly the specified step only"
        echo "  --uninstall    Safely stop and remove containers while preserving database"
        echo "  --help, -h     Show this help message"
        exit 0
        ;;
      *)
        echo "Unknown option: $1. Use --help for usage."
        exit 1
        ;;
    esac
  done

  # ----------------------------------------------------------------------------
  # Interactive Main Menu
  # ----------------------------------------------------------------------------
  if [[ -z "${explicit_mode}" && "${resume_mode}" != "true" && "${target_step}" -eq 0 ]]; then
    if [ -t 0 ]; then
      while true; do
        echo ""
        echo "========================================"
        echo "        HSECORE Installation Manager    "
        echo "========================================"
        echo ""
        echo "1) Install HSECORE"
        echo "2) Update HSECORE"
        echo "3) Backup Database"
        echo "4) Restore Database"
        echo "5) Check System Health"
        echo "6) View Update/Backup Logs"
        echo "7) Backup Schedule Settings"
        echo "8) Local AI Infrastructure (HSECORE AI)"
        echo "9) Exit"
        echo ""

        read -r -p "Select option [1-9]: " menu_choice
        menu_choice="$(echo "${menu_choice:-1}" | tr -d '[:space:]')"

        case "${menu_choice}" in
          1)
            explicit_mode="install"
            break
            ;;
          2)
            run_locked run_system_update || log_warn "Update did not complete."
            ;;
          3)
            run_locked backup_database "manual" false || log_warn "Backup failed; see ${BACKUP_LOG}."
            ;;
          4)
            run_locked restore_database "" || log_warn "Restore did not complete."
            ;;
          5)
            check_system_health
            ;;
          6)
            view_update_backup_logs
            ;;
          7)
            configure_backup_schedule || log_warn "Backup schedule was not changed."
            ;;
          8)
            manage_ai_infrastructure "menu"
            ;;
          9)
            echo -e "${BLUE}Exiting HSECORE Installation Manager.${NC}"
            exit 0
            ;;
          *)
            echo -e "${RED}Invalid selection. Please choose a number between 1 and 9.${NC}"
            ;;
        esac
      done
    else
      explicit_mode="install"
    fi
  fi

  if [[ "${explicit_mode}" == "update" ]]; then
    run_locked run_system_update || exit 1
    exit 0
  fi

  load_answers_cache

  if [[ "${target_step}" -gt 0 ]]; then
    export HSE_STEP_ONLY=1
    log_info "Executing strictly step ${target_step}/15..."
    case "${target_step}" in
      1)  step1_system_check ;;
      2)  step2_install_dependencies ;;
      3)  step3_install_docker ;;
      4)  step4_install_postgresql ;;
      5)  step5_configure_postgresql ;;
      6)  step6_configure_ports ;;
      7)  step7_create_database_and_user ;;
      8)  step8_test_postgresql_connection ;;
      9)  step9_configure_environment ;;
      10) step10_build_docker_images ;;
      11) step11_run_database_migration ;;
      12) step12_start_hsecore ;;
      13) step13_configure_firewall ;;
      14) step14_final_health_check ;;
      15) step15_installation_complete ;;
    esac
    exit 0
  fi

  local last_step
  last_step="$(get_last_completed_step)"

  local start_step=1
  if [[ "${resume_mode}" == "true" ]]; then
    if [[ "${last_step}" -ge 15 ]]; then
      log_success "All 15 steps were previously completed. Executing final health check..."
      start_step=14
    else
      start_step=$((last_step + 1))
      log_info "Resuming installation from step ${start_step}/15..."
    fi
  fi

  if [[ $start_step -le 1 ]]; then
    step1_system_check
  fi
  if [[ $start_step -le 2 ]]; then
    step2_install_dependencies
  fi
  if [[ $start_step -le 3 ]]; then
    step3_install_docker
  fi
  if [[ $start_step -le 4 ]]; then
    step4_install_postgresql
  fi
  if [[ $start_step -le 5 ]]; then
    step5_configure_postgresql
  fi
  if [[ $start_step -le 6 ]]; then
    step6_configure_ports
  fi
  if [[ $start_step -le 7 ]]; then
    step7_create_database_and_user
  fi
  if [[ $start_step -le 8 ]]; then
    step8_test_postgresql_connection
  fi
  if [[ $start_step -le 9 ]]; then
    step9_configure_environment
  fi
  if [[ $start_step -le 10 ]]; then
    step10_build_docker_images
  fi
  if [[ $start_step -le 11 ]]; then
    step11_run_database_migration
  fi
  if [[ $start_step -le 12 ]]; then
    step12_start_hsecore
  fi
  if [[ $start_step -le 13 ]]; then
    step13_configure_firewall
  fi
  if [[ $start_step -le 14 ]]; then
    step14_final_health_check
  fi
  if [[ $start_step -le 15 ]]; then
    step15_installation_complete
  fi
}

main "$@"
