# HSECORE AI Phase 2 — Spark-X2.6-4B Local Deployment

## Scope

This change prepares the existing Ollama-backed AI path for CPU-only deployment of
`SparkLLM/Spark-X2.6-4B:q4_k_m` on the CPU-only HSECORE VPS. The inspected host reported approximately 11 GiB RAM and 6 visible CPUs; the active Ollama container had a 4 GiB memory limit at the time of audit. Re-check actual host and container limits before deployment.
It does not change the production default chat model, database schema, RAG
embedding model, or business modules. Spark remains an explicit, administrator-
selected model until runtime acceptance tests pass.

## Runtime profile

Recommended initial test profile (not a claim of validated production capacity):

- Chat model: `SparkLLM/Spark-X2.6-4B:q4_k_m` (Q4_K_M, approximately 3.5 GB download).
- Context: 4096 tokens; do not use the model's advertised 1M context on this VPS.
- Ollama parallel requests: 1.
- Loaded models: 1.
- AI request timeout: 180 seconds.
- The request deadline includes waiting time in both the orchestrator queue and the local Ollama provider queue; expired waiting tasks are removed before execution.
- AI queue: at most 10 waiting requests per queue layer.
- Cloud fallback: disabled unless explicitly enabled.
- Ollama image: pinned by default to `ollama/ollama:0.40.13`, matching the
  previously inspected VPS runtime. Change `OLLAMA_IMAGE` only after validating
  the replacement version against the model and application.
- CPU allocation: start with 4 threads and a 4-CPU limit to leave capacity for
  the HSECORE application and PostgreSQL on the observed 6-CPU host.
- Memory limit: 4608M as a measured-test starting point, not a capacity guarantee.
- Ollama HTTP API: internal Docker network only; host port remains loopback-bound.
- Both Compose files explicitly clear `OLLAMA_ORIGINS`, including when an old
  wildcard value remains in `.env`.

The model file size is not the same as total resident memory. Runtime overhead,
context cache, the application, PostgreSQL, the OS and other services all consume
RAM. Start with a low context and monitor host memory, swap and OOM events before
increasing limits or concurrency. A 4608 MB container limit is a test starting
point, not a guarantee that the approximately 11 GiB host has sufficient headroom.

## Install and select the model

1. Confirm the pinned Ollama image and the container are healthy:
   
   The Compose default is `ollama/ollama:0.40.13`. Keep this exact version for
   the first validation cycle; do not use the floating `:latest` tag.

   ```bash
   docker exec hse-ai-engine ollama --version
   docker exec hse-ai-engine ollama list
   ```

2. Pull the Q4_K_M model:

   ```bash
   docker exec hse-ai-engine ollama pull SparkLLM/Spark-X2.6-4B:q4_k_m
   docker exec hse-ai-engine ollama show SparkLLM/Spark-X2.6-4B:q4_k_m
   ```

3. In the deployment `.env`, set:

   ```dotenv
   AI_DEFAULT_CHAT_MODEL=SparkLLM/Spark-X2.6-4B:q4_k_m
   AI_DEFAULT_EMBED_MODEL=bge-m3
   AI_CONTEXT_TOKENS=4096
   AI_MAX_CONCURRENCY=1
   AI_NUM_PARALLEL=1
   AI_MAX_LOADED_MODELS=1
   AI_MAX_QUEUE_LENGTH=10
   AI_REQUEST_TIMEOUT_MS=180000
   OLLAMA_IMAGE=ollama/ollama:0.40.13
   AI_CPU_THREADS=4
   AI_CPU_LIMIT=4.0
   AI_MEMORY_LIMIT=4608M
   AI_CLOUD_FALLBACK_ENABLED=false
   AI_ALLOWED_MODELS=SparkLLM/Spark-X2.6-4B:q4_k_m
   AI_MODEL_PULL_TIMEOUT_MS=1800000
   ```

4. If using the HSECORE administrator API to download a model, `AI_ALLOWED_MODELS` must contain the exact Ollama model reference before the pull request is accepted. The API refuses unlisted model references, prevents concurrent pulls, applies a bounded timeout, and protects the configured chat/embedding models from deletion. A manual `ollama pull` from an authorized server shell bypasses the application API allowlist and must therefore be treated as a privileged server operation.

5. Build the application image from the exact Git commit and verify its embedded
   provenance before deploying it. Run these commands from the checked-out
   release directory after taking the database, uploads and configuration backups:

   ```bash
   export GIT_COMMIT="$(git rev-parse HEAD)"
   export BUILD_ID="$(date -u +%Y%m%dT%H%M%SZ)"
   export RELEASE_ID="0.2.8-${GIT_COMMIT:0:12}"
   docker compose -f docker-compose.server.yml build --pull hse-app
   docker image inspect hsecore-enterprise:latest --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}'
   ```

   The inspected revision must exactly match `git rev-parse HEAD`. The production
   Dockerfile now uses `npm ci` only; it will not silently fall back to
   `npm install` and change the dependency graph.

6. Recreate the AI and app services, then check status:

   ```bash
   docker compose -f docker-compose.server.yml up -d --force-recreate hse-ai-engine hse-app
   docker exec hse-ai-engine ollama list
   docker logs --tail=150 hse-ai-engine
   docker logs --tail=150 hse-enterprise-app
   ```

Do not run model pull during normal application startup. Model download is an
explicit administrator operation and should be performed once.

## Privacy and network controls

- Cloud Gemini fallback is now opt-in through `AI_CLOUD_FALLBACK_ENABLED=true`.
  Keep it false for the default local-only deployment.
- The `GEMINI_API_KEY` may remain in an existing `.env`, but is not used for
  chat/BPMN fallback while cloud fallback is disabled.
- Remove any `OLLAMA_ORIGINS=*` entry from the deployment `.env`; wildcard CORS is not required for backend-to-backend Docker communication. Compose now explicitly overrides this variable with an empty value. The application reaches Ollama over the
  private Docker network; the host-published port remains bound to 127.0.0.1
  unless an operator deliberately overrides it.
- Keep Ollama out of public reverse-proxy routes and firewall inbound access
  to port 11434.

## Acceptance tests before production

1. `docker compose config` succeeds and no AI port is publicly bound.
2. Ollama reports the expected model and quantization.
3. Authenticated AI chat returns the selected local model name.
4. Disconnect/stop Ollama: HSECORE must not send prompts or retrieved records to
   Gemini while cloud fallback is false; the built-in deterministic fallback
   may respond instead. The AI status must separately report engine reachability,
   chat-model installation and local inference readiness; a healthy empty Ollama
   inventory is not an inference-ready state.
5. A user without the relevant HSECORE permission cannot retrieve restricted
   RAG documents or invoke restricted module tools.
6. Queue saturation is rejected with a controlled Persian error; expired tasks
   are removed from both queue layers and are not executed after their deadline.
7. Measure cold-start and warm inference latency, peak RSS, host available RAM,
   swap activity and OOM events using 1, 2 and 5 sequential requests.
8. Run the AI regression suite, including model-tag alias protection, RAG
   transaction rollback and Compose configuration validation:
   `npm run test:ai-acl`,
   `npm run test:ai-auth`,
   `npm run test:ai-routes`,
   `npm run test:ai-rag-db`,
   `npm run test:ai-queue`,
   `npm run lint`,
   and `npm run build`.

Do not enable multiple concurrent inference requests on the observed host unless
load testing demonstrates safe memory headroom. The orchestrator and local
provider still maintain separate queue layers; their combined capacity must be
measured before any concurrency increase. The existing HSECORE module
tools and RAG access checks remain the source of truth; the model must not gain
direct database access or authority to bypass application permissions.

## Compose file selection

Use `docker-compose.server.yml` as the production source of truth because it
defines both the HSECORE application and Ollama on the same Docker network.
`docker-compose.ai.yml` is an aligned standalone AI-only alternative for isolated
testing; do not start it alongside the server Compose project because both define
the same container name and persistent model volume.

## Rollback

Restore the previous values of `AI_DEFAULT_CHAT_MODEL` and resource variables
in `.env`, then recreate `hse-ai-engine` and `hse-app`. No database migration
is introduced by this phase. Keep the downloaded model until rollback is
confirmed; deleting a model is a separate administrator action.
