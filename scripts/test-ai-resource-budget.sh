#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER="${ROOT}/scripts/ai-resource-budget.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT
MOCK_BIN="${TMP}/bin"
mkdir -p "${MOCK_BIN}"

cat > "${MOCK_BIN}/free" <<'MOCK_FREE'
#!/usr/bin/env bash
printf '              total        used        free      shared  buff/cache   available\n'
printf 'Mem: %s 1000 1000 0 1000 6000\n' "${MOCK_RAM_MB:?}"
printf 'Swap: 0 0 0\n'
MOCK_FREE
chmod +x "${MOCK_BIN}/free"

assert_value() {
  local file="$1" key="$2" expected="$3" actual
  actual="$(awk -F= -v key="$key" '$1 == key { value=substr($0,index($0,"=")+1) } END { print value }' "$file")"
  if [[ "$actual" != "$expected" ]]; then
    echo "[FAIL] $key expected '$expected', got '$actual'" >&2
    exit 1
  fi
}

run_budget() {
  local ram="$1" file="$2"
  PATH="${MOCK_BIN}:${PATH}" MOCK_RAM_MB="$ram" bash -c 'source "$1"; apply_ai_resource_budget "$2"' _ "$HELPER" "$file"
}

# 8GiB host: 70% is capped to RAM minus the 3GiB system/application reserve.
cat > "${TMP}/eight-gib.env" <<'ENV'
AI_MEMORY_LIMIT_AUTO=true
AI_CONTEXT_TOKENS_AUTO=true
ENV
run_budget 8192 "${TMP}/eight-gib.env" >/dev/null
assert_value "${TMP}/eight-gib.env" AI_MEMORY_LIMIT 5120M
assert_value "${TMP}/eight-gib.env" AI_CONTEXT_TOKENS 2048

# 11.7GiB host: budget is rounded down to a 512MiB boundary.
cat > "${TMP}/eleven-gib.env" <<'ENV'
AI_MEMORY_LIMIT_AUTO=true
AI_CONTEXT_TOKENS_AUTO=true
ENV
run_budget 11960 "${TMP}/eleven-gib.env" >/dev/null
assert_value "${TMP}/eleven-gib.env" AI_MEMORY_LIMIT 8192M

# Manual values are immutable unless the operator explicitly enables auto mode.
cat > "${TMP}/manual.env" <<'ENV'
AI_MEMORY_LIMIT=6144M
AI_MEMORY_LIMIT_AUTO=false
AI_CONTEXT_TOKENS=8192
AI_CONTEXT_TOKENS_AUTO=false
ENV
run_budget 8192 "${TMP}/manual.env" >/dev/null
assert_value "${TMP}/manual.env" AI_MEMORY_LIMIT 6144M
assert_value "${TMP}/manual.env" AI_CONTEXT_TOKENS 8192

# Explicit auto-tune must replace a previous manual ceiling with the safe budget.
sed -i 's/^AI_MEMORY_LIMIT_AUTO=false$/AI_MEMORY_LIMIT_AUTO=true/' "${TMP}/manual.env"
run_budget 8192 "${TMP}/manual.env" >/dev/null
assert_value "${TMP}/manual.env" AI_MEMORY_LIMIT 5120M
assert_value "${TMP}/manual.env" AI_CONTEXT_TOKENS 8192

echo "[PASS] AI resource budget: 8GiB, 11.7GiB, manual preservation, and explicit auto-tune."
