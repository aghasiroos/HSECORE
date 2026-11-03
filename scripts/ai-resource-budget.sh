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

  if [[ "${auto,,}" == "true" || "$auto" == "1" || "${auto,,}" == "yes" ]]; then
    total_mb="$(free -m | awk '/^Mem:/ {print $2}')"
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
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  apply_ai_resource_budget "${1:-.env}"
fi
