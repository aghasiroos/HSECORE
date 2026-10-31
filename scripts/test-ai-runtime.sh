#!/usr/bin/env bash
# Runtime verification for the optional HSECORE Local LLM container.
# Does not download or execute any language/embedding model.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_DIR}"

CONTAINER_NAME="${AI_CONTAINER_NAME:-hse-ai-engine}"
NETWORK_NAME="${DOCKER_NETWORK_NAME:-}"
if [[ -z "${NETWORK_NAME}" && -f .env ]]; then
  env_line="$(grep -E '^[[:space:]]*DOCKER_NETWORK_NAME=' .env | tail -n 1 || true)"
  if [[ -n "${env_line}" ]]; then
    NETWORK_NAME="${env_line#*=}"
    NETWORK_NAME="${NETWORK_NAME%$'\r'}"
    NETWORK_NAME="${NETWORK_NAME#\"}"
    NETWORK_NAME="${NETWORK_NAME%\"}"
    NETWORK_NAME="${NETWORK_NAME#\'}"
    NETWORK_NAME="${NETWORK_NAME%\'}"
  fi
fi
NETWORK_NAME="${NETWORK_NAME:-hse-network}"
PEER_IMAGE="${AI_RUNTIME_TEST_PEER_IMAGE:-curlimages/curl:8.12.1}"
TIMEOUT_SECONDS="${AI_RUNTIME_TEST_TIMEOUT_SECONDS:-90}"

fail() {
  echo "[AI Runtime Test] FAIL: $*" >&2
  exit 1
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
grep -Fq "\" ${NETWORK_NAME}\"" <<< "${network_json}" || grep -Fq "${NETWORK_NAME}" <<< "${network_json}" || fail "container is not attached to '${NETWORK_NAME}'"
echo "[AI Runtime Test] PASS: container is attached to '${NETWORK_NAME}'."

echo "[AI Runtime Test] Checking persistent model volume..."
volume_mount="$(docker inspect --format '{{range .Mounts}}{{if eq .Name "hse_ai_models"}}{{.Destination}}{{end}}{{end}}' "${CONTAINER_NAME}")"
[[ "${volume_mount}" == "/root/.ollama" ]] || fail "hse_ai_models volume is not mounted at /root/.ollama"
docker volume inspect hse_ai_models >/dev/null 2>&1 || fail "persistent volume hse_ai_models is missing"
echo "[AI Runtime Test] PASS: persistent model volume is attached."

echo "[AI Runtime Test] Checking CPU and memory limits..."
nano_cpus="$(docker inspect --format '{{.HostConfig.NanoCpus}}' "${CONTAINER_NAME}")"
memory_bytes="$(docker inspect --format '{{.HostConfig.Memory}}' "${CONTAINER_NAME}")"
[[ "${nano_cpus}" =~ ^[0-9]+$ ]] && (( nano_cpus > 0 )) || fail "CPU limit was not applied by Docker Compose"
[[ "${memory_bytes}" =~ ^[0-9]+$ ]] && (( memory_bytes > 0 )) || fail "memory limit was not applied by Docker Compose"
echo "[AI Runtime Test] PASS: Docker reports CPU limit ${nano_cpus} NanoCPUs and memory limit ${memory_bytes} bytes."

echo "[AI Runtime Test] Checking cross-container API access..."
api_response="$(docker run --rm --pull=missing --network "${NETWORK_NAME}" "${PEER_IMAGE}" \
  --retry 20 --retry-delay 1 --retry-connrefused --connect-timeout 2 --max-time 5 \
  --fail --silent --show-error "http://${CONTAINER_NAME}:11434/api/version")" || fail "peer container could not reach Ollama API through Docker DNS/network"
python3 -c 'import json,sys; d=json.loads(sys.argv[1]); assert isinstance(d.get("version"), str) and d["version"], "missing Ollama version"' "${api_response}" || fail "Ollama API returned invalid version JSON"
echo "[AI Runtime Test] PASS: Ollama API is reachable from another container; version JSON is valid."

echo "[AI Runtime Test] All Local LLM runtime checks passed."
