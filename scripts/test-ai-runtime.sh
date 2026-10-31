#!/usr/bin/env bash
# Runtime verification for the optional HSECORE Local LLM container.
# Does not download or execute any language/embedding model.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_DIR}"

CONTAINER_NAME="${AI_CONTAINER_NAME:-hse-ai-engine}"
NETWORK_NAME="${DOCKER_NETWORK_NAME:-}"
if [[ -z "${NETWORK_NAME}" && -f .env ]]; then
  NETWORK_NAME="$(awk -F= '$1 == "DOCKER_NETWORK_NAME" {sub(/^[^=]*=/, ""); print; exit}' .env | tr -d '\r')"
  NETWORK_NAME="${NETWORK_NAME#\"}"
  NETWORK_NAME="${NETWORK_NAME%\"}"
  NETWORK_NAME="${NETWORK_NAME#\'}"
  NETWORK_NAME="${NETWORK_NAME%\'}"
fi
NETWORK_NAME="${NETWORK_NAME:-hse-network}"
PEER_IMAGE="${AI_RUNTIME_TEST_PEER_IMAGE:-curlimages/curl:8.12.1}"
TIMEOUT_SECONDS="${AI_RUNTIME_TEST_TIMEOUT_SECONDS:-90}"

fail() {
  echo "[AI Runtime Test] FAIL: $*" >&2
  exit 1
}

read_dotenv_value() {
  local key="$1"
  local fallback="$2"
  local raw=""
  if [[ -f .env ]]; then
    raw="$(awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' .env 2>/dev/null | tr -d '\r' || true)"
  fi
  raw="${raw#\"}"
  raw="${raw%\"}"
  raw="${raw#\'}"
  raw="${raw%\'}"
  printf '%s' "${raw:-${fallback}}"
}

echo "[AI Runtime Test] Checking container state and health..."
docker inspect "${CONTAINER_NAME}" >/dev/null 2>&1 || fail "container '${CONTAINER_NAME}' does not exist"
health=""
for ((attempt=0; attempt<TIMEOUT_SECONDS; attempt++)); do
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${CONTAINER_NAME}" 2>/dev/null || true)"
  [[ "${health}" == "healthy" ]] && break
  [[ "${health}" == "unhealthy" ]] && fail "container healthcheck reports unhealthy"
  sleep 1
done
[[ "${health}" == "healthy" ]] || fail "container did not become healthy within ${TIMEOUT_SECONDS}s (state: ${health:-unknown})"
echo "[AI Runtime Test] PASS: Docker healthcheck is healthy."

echo "[AI Runtime Test] Checking that the Ollama API is not published on host interfaces..."
published_ports="$(docker port "${CONTAINER_NAME}" 2>/dev/null || true)"
[[ -z "${published_ports}" ]] || fail "unexpected host port publication: ${published_ports}"
echo "[AI Runtime Test] PASS: no host-published Ollama ports."

echo "[AI Runtime Test] Checking shared network membership..."
network_json="$(docker inspect --format '{{json .NetworkSettings.Networks}}' "${CONTAINER_NAME}")"
python3 -c 'import json,sys; d=json.loads(sys.argv[1]); n=sys.argv[2]; assert n in d, f"container is not attached to {n}"' "${network_json}" "${NETWORK_NAME}" || fail "container is not attached to '${NETWORK_NAME}'"
echo "[AI Runtime Test] PASS: container is attached to '${NETWORK_NAME}'."

echo "[AI Runtime Test] Checking persistent model volume..."
volume_mount="$(docker inspect --format '{{range .Mounts}}{{if eq .Name "hse_ai_models"}}{{.Destination}}{{end}}{{end}}' "${CONTAINER_NAME}")"
[[ "${volume_mount}" == "/root/.ollama" ]] || fail "hse_ai_models volume is not mounted at /root/.ollama"
docker volume inspect hse_ai_models >/dev/null 2>&1 || fail "persistent volume hse_ai_models is missing"
echo "[AI Runtime Test] PASS: persistent model volume is attached."

echo "[AI Runtime Test] Checking pinned Ollama image and exact CPU/memory limits..."
expected_image_version="${AI_OLLAMA_VERSION:-$(read_dotenv_value AI_OLLAMA_VERSION 0.34.0)}"
actual_image="$(docker inspect --format '{{.Config.Image}}' "${CONTAINER_NAME}")"
[[ "${actual_image}" == "ollama/ollama:${expected_image_version}" ]] || fail "unexpected image ${actual_image}; expected ollama/ollama:${expected_image_version}"
cpu_limit="${AI_CPU_LIMIT:-$(read_dotenv_value AI_CPU_LIMIT 4.0)}"
memory_limit="${AI_MEMORY_LIMIT:-$(read_dotenv_value AI_MEMORY_LIMIT 4096M)}"
expected_nano_cpus="$(python3 -c 'import sys; print(round(float(sys.argv[1]) * 1_000_000_000))' "${cpu_limit}")" || fail "invalid AI_CPU_LIMIT: ${cpu_limit}"
expected_memory_bytes="$(python3 -c 'import re,sys; s=sys.argv[1].strip().upper(); m=re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)(B|K|KB|M|MB|G|GB)?", s); assert m, "invalid memory limit"; n=float(m.group(1)); u=m.group(2) or "B"; print(int(n * {"B":1,"K":1024,"KB":1024,"M":1024**2,"MB":1024**2,"G":1024**3,"GB":1024**3}[u]))' "${memory_limit}")" || fail "invalid AI_MEMORY_LIMIT: ${memory_limit}"
nano_cpus="$(docker inspect --format '{{.HostConfig.NanoCpus}}' "${CONTAINER_NAME}")"
memory_bytes="$(docker inspect --format '{{.HostConfig.Memory}}' "${CONTAINER_NAME}")"
[[ "${nano_cpus}" == "${expected_nano_cpus}" ]] || fail "CPU limit mismatch: got ${nano_cpus}, expected ${expected_nano_cpus}"
[[ "${memory_bytes}" == "${expected_memory_bytes}" ]] || fail "memory limit mismatch: got ${memory_bytes}, expected ${expected_memory_bytes}"
echo "[AI Runtime Test] PASS: image ${actual_image}; CPU ${nano_cpus} NanoCPUs; memory ${memory_bytes} bytes."

echo "[AI Runtime Test] Checking cross-container API access..."
api_response="$(docker run --rm --pull=missing --network "${NETWORK_NAME}" "${PEER_IMAGE}" \
  --retry 20 --retry-delay 1 --retry-connrefused --connect-timeout 2 --max-time 5 \
  --fail --silent --show-error "http://${CONTAINER_NAME}:11434/api/version")" || fail "peer container could not reach Ollama API through Docker DNS/network"
python3 -c 'import json,sys; d=json.loads(sys.argv[1]); assert isinstance(d.get("version"), str) and d["version"], "missing Ollama version"' "${api_response}" || fail "Ollama API returned invalid version JSON"
echo "[AI Runtime Test] PASS: Ollama API is reachable from another container; version JSON is valid."

echo "[AI Runtime Test] All Local LLM runtime checks passed."
