#!/usr/bin/env bash
# HSECORE AI resource budget helper.
# Reads .env as data (never sources it) and applies conservative host-aware defaults.
ai_env_get() {
  local key="$1" file="$2"
  awk -F= -v key="$key" '$1 == key { value=substr($0,index($0,"=")+1) } END {
    gsub(/\r/, "", value); gsub(/^[[:space:]]*["'\''"]|["'\''"][[:space:]]*$/, "", value); print value
  }' "$file"
}

ai_env_set() {
  local key="$1" value="$2" file="$3" tmp
  tmp="$(mktemp "${file}.XXXXXX")"
  if grep -qE "^${key}=" "$file"; then
    awk -v key="$key" -v value="$value" '
      BEGIN { replaced=0 }
      index($0, key "=") == 1 {
        if (!replaced) { print key "=" value; replaced=1 }
        next
      }
      { print }
      END { if (!replaced) print key "=" value }
    ' "$file" > "$tmp"
  else
    cat "$file" > "$tmp"
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi
  chmod 600 "$tmp"
  mv "$tmp" "$file"
}

apply_ai_resource_budget() {
  local file="${1:-.env}" total_mb reserve_mb budget_mb max_mb auto limit context_auto context
  [[ -f "$file" ]] || { echo "[AI] Environment file not found; skipping resource auto-tuning."; return 0; }

  limit="$(ai_env_get AI_MEMORY_LIMIT "$file")"
  auto="$(ai_env_get AI_MEMORY_LIMIT_AUTO "$file")"
  if [[ -z "$auto" ]]; then
    # Migrate only the known legacy default; preserve any non-default manual value.
    if [[ -z "$limit" || "$limit" == "4608M" || "$limit" == "4608m" ]]; then auto=true; else auto=false; fi
    ai_env_set AI_MEMORY_LIMIT_AUTO "$auto" "$file"
  fi

  local host_ram_mb host_swap_mb host_cpus
  host_ram_mb="$(free -m 2>/dev/null | awk '/^Mem:/ {print $2}' || true)"
  host_swap_mb="$(free -m 2>/dev/null | awk '/^Swap:/ {print $2}' || true)"
  host_cpus="$(nproc 2>/dev/null || grep -c '^processor' /proc/cpuinfo 2>/dev/null || echo 1)"
  [[ "$host_ram_mb" =~ ^[0-9]+$ ]] && ai_env_set HOST_TOTAL_RAM_MB "${host_ram_mb}" "$file"
  [[ "$host_swap_mb" =~ ^[0-9]+$ ]] && ai_env_set HOST_TOTAL_SWAP_MB "${host_swap_mb}" "$file"
  [[ "$host_cpus" =~ ^[0-9]+$ ]] && ai_env_set HOST_CPU_CORES "${host_cpus}" "$file"

  if [[ "${auto,,}" == "true" || "$auto" == "1" || "${auto,,}" == "yes" ]]; then
    total_mb="${host_ram_mb}"
    [[ "$total_mb" =~ ^[0-9]+$ ]] || { echo "[AI] Could not determine host RAM; preserving AI_MEMORY_LIMIT."; return 0; }
    reserve_mb=3072
    budget_mb=$(( total_mb * 70 / 100 ))
    max_mb=$(( total_mb - reserve_mb ))
    (( max_mb < 1024 )) && max_mb=1024
    (( budget_mb > max_mb )) && budget_mb=$max_mb
    budget_mb=$(( budget_mb / 512 * 512 ))
    (( budget_mb < 1024 )) && budget_mb=1024
    ai_env_set AI_MEMORY_LIMIT "${budget_mb}M" "$file"
    echo "[AI] Automatic container memory budget: ${budget_mb}M (host RAM: ${total_mb}M; at least 3GiB reserved where available)."
  else
    echo "[AI] Manual AI_MEMORY_LIMIT preserved: ${limit:-compose default}."
  fi

  context="$(ai_env_get AI_CONTEXT_TOKENS "$file")"
  context_auto="$(ai_env_get AI_CONTEXT_TOKENS_AUTO "$file")"
  if [[ -z "$context_auto" ]]; then
    if [[ -z "$context" || "$context" == "4096" ]]; then context_auto=true; else context_auto=false; fi
    ai_env_set AI_CONTEXT_TOKENS_AUTO "$context_auto" "$file"
  fi
  if [[ "${context_auto,,}" == "true" || "$context_auto" == "1" || "${context_auto,,}" == "yes" ]]; then
    ai_env_set AI_CONTEXT_TOKENS 2048 "$file"
    echo "[AI] Automatic safe context default applied: 2048 tokens."
  else
    echo "[AI] Manual AI_CONTEXT_TOKENS preserved: ${context:-compose default}."
  fi

  # Prevent llama.cpp crash: "quantized V cache requires flash_attn to be enabled"
  local kv_cache flash_attn
  kv_cache="$(ai_env_get AI_KV_CACHE_TYPE "$file")"
  flash_attn="$(ai_env_get AI_FLASH_ATTENTION "$file")"
  if [[ -z "$kv_cache" || "$kv_cache" == "q8_0" || "$kv_cache" == "q4_0" ]]; then
    ai_env_set AI_KV_CACHE_TYPE "f16" "$file"
  fi
  if [[ -z "$flash_attn" || "$flash_attn" == "0" ]]; then
    ai_env_set AI_FLASH_ATTENTION "1" "$file"
  fi

  # Ensure multi-user and multi-model concurrency defaults are active
  local num_parallel max_loaded max_conc keep_alive
  num_parallel="$(ai_env_get AI_NUM_PARALLEL "$file")"
  max_loaded="$(ai_env_get AI_MAX_LOADED_MODELS "$file")"
  max_conc="$(ai_env_get AI_MAX_CONCURRENCY "$file")"
  keep_alive="$(ai_env_get AI_KEEP_ALIVE "$file")"
  if [[ -z "$num_parallel" || "$num_parallel" == "1" ]]; then
    ai_env_set AI_NUM_PARALLEL "4" "$file"
  fi
  if [[ -z "$max_loaded" || "$max_loaded" == "1" ]]; then
    ai_env_set AI_MAX_LOADED_MODELS "3" "$file"
  fi
  if [[ -z "$max_conc" || "$max_conc" == "1" ]]; then
    ai_env_set AI_MAX_CONCURRENCY "4" "$file"
  fi
  if [[ -z "$keep_alive" || "$keep_alive" == "5m" ]]; then
    ai_env_set AI_KEEP_ALIVE "15m" "$file"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  apply_ai_resource_budget "${1:-.env}"
fi
