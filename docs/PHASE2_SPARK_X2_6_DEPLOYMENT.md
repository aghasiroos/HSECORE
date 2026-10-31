# HSECORE AI Phase 2 — Spark-X2.6-4B Local Deployment

## Scope

This change prepares the existing Ollama-backed AI path for CPU-only deployment of
`SparkLLM/Spark-X2.6-4B:q4_k_m` on the 8 GB RAM / 16 vCPU HSECORE VPS.
It does not change the production default chat model, database schema, RAG
embedding model, business modules, or the `main` branch.

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
- Ollama HTTP API: internal Docker network only; host port remains loopback-bound.

The model file size is not the same as total resident memory. Runtime overhead,
context cache, the application, PostgreSQL, the OS and other services all consume
RAM. Start with a low context and monitor host memory, swap and OOM events before
increasing limits or concurrency. A 4608 MB container limit is a test starting
point, not a guarantee that the whole 8 GB host has sufficient headroom.

## Install and select the model

1. Confirm the Ollama image is at least v0.34.1 and the container is healthy:

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
   AI_CPU_THREADS=8
   AI_CPU_LIMIT=6.0
   AI_MEMORY_LIMIT=4608M
   AI_CLOUD_FALLBACK_ENABLED=false
   ```

4. Recreate the AI and app services, then check status:

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
- Wildcard Ollama CORS is removed. The application reaches Ollama over the
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
   may respond instead.
5. A user without the relevant HSECORE permission cannot retrieve restricted
   RAG documents or invoke restricted module tools.
6. Queue saturation is rejected with a controlled Persian error; expired tasks
   are removed from both queue layers and are not executed after their deadline.
7. Measure cold-start and warm inference latency, peak RSS, host available RAM,
   swap activity and OOM events using 1, 2 and 5 sequential requests.
8. Run the existing AI regression suite:
   `npm run test:ai-acl`,
   `npm run test:ai-auth`,
   `npm run test:ai-routes`,
   `npm run test:ai-rag-db`,
   and `npm run lint`.

Do not enable multiple concurrent inference requests on the 8 GB host unless
load testing demonstrates safe memory headroom. The existing HSECORE module
tools and RAG access checks remain the source of truth; the model must not gain
direct database access or authority to bypass application permissions.

## Rollback

Restore the previous values of `AI_DEFAULT_CHAT_MODEL` and resource variables
in `.env`, then recreate `hse-ai-engine` and `hse-app`. No database migration
is introduced by this phase. Keep the downloaded model until rollback is
confirmed; deleting a model is a separate administrator action.
