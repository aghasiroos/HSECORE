import assert from 'node:assert/strict';
import { config } from '../server/core/config.ts';
import { AIRequestQueue } from '../server/modules/ai/ai.queue.ts';
import { LocalAIProvider } from '../server/modules/ai/ai.local-provider.ts';

const originalConcurrency = config.aiEngine.maxConcurrency;
const originalQueueLength = config.aiEngine.maxQueueLength;
const originalTimeout = config.aiEngine.timeoutMs;
const originalAllowedModels = config.aiEngine.allowedModels;
const originalFetch = globalThis.fetch;

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

async function run() {
  config.aiEngine.maxConcurrency = 1;
  config.aiEngine.maxQueueLength = 1;

  // A request that expires while waiting must be removed and never executed later.
  {
    const queue = new AIRequestQueue();
    const releaseFirst = deferred();
    const firstStarted = deferred();
    let expiredTaskExecutions = 0;

    const first = queue.enqueue(async () => {
      firstStarted.resolve();
      await releaseFirst.promise;
      return 'first';
    }, { timeoutMs: 1000 });

    await firstStarted.promise;

    const expired = queue.enqueue(async () => {
      expiredTaskExecutions++;
      return 'must-not-run';
    }, { timeoutMs: 40 });

    await assert.rejects(expired, /مهلت انتظار در صف هوش مصنوعی/);
    assert.equal(queue.telemetry.queuedRequests, 0);

    releaseFirst.resolve();
    assert.equal((await first).data, 'first');
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(expiredTaskExecutions, 0);
    console.log('PASS queued request expires and is removed without later execution');
  }

  // Queue capacity must reject excess waiting work without affecting the active task.
  {
    const queue = new AIRequestQueue();
    const releaseFirst = deferred();
    const firstStarted = deferred();

    const first = queue.enqueue(async () => {
      firstStarted.resolve();
      await releaseFirst.promise;
      return 'first';
    }, { timeoutMs: 1000 });

    await firstStarted.promise;

    const waiting = queue.enqueue(async () => 'second', { timeoutMs: 1000 });
    await assert.rejects(
      queue.enqueue(async () => 'third', { timeoutMs: 1000 }),
      /ظرفیت صف پردازش هوش مصنوعی تکمیل است/
    );

    releaseFirst.resolve();
    assert.equal((await first).data, 'first');
    assert.equal((await waiting).data, 'second');
    console.log('PASS queue capacity rejects excess waiting work and drains normally');
  }

  // Model downloads must be explicitly allowlisted; defaults cannot be deleted.
  {
    config.aiEngine.allowedModels = [config.aiEngine.defaultChatModel, config.aiEngine.defaultEmbedModel];
    const provider = new LocalAIProvider();
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error('fetch must not be called for a blocked model');
    }) as typeof fetch;

    const blockedPull = await provider.pullModel('attacker/unknown-model:latest');
    assert.equal(blockedPull.success, false);
    assert.equal(fetchCalls, 0);

    const protectedDelete = await provider.deleteModel(config.aiEngine.defaultChatModel);
    assert.equal(protectedDelete.success, false);
    assert.equal(fetchCalls, 0);
    console.log('PASS model pull allowlist and default-model deletion protection');
  }

  // Reachable Ollama without installed models must not be reported inference-ready.
  {
    const provider = new LocalAIProvider();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/tags')) {
        return new Response(JSON.stringify({ models: [] }), { status: 200 });
      }
      if (url.endsWith('/api/version')) {
        return new Response(JSON.stringify({ version: 'test' }), { status: 200 });
      }
      throw new Error('unexpected URL');
    }) as typeof fetch;
    const status = await provider.checkHealth();
    assert.equal(status.isAvailable, true);
    assert.equal(status.localInferenceReady, false);
    assert.equal(status.chatModelInstalled, false);
    assert.equal(status.embeddingModelInstalled, false);
    console.log('PASS empty Ollama inventory is not inference-ready');
  }

  console.log('AI request queue and model safety tests: 4/4 passed');
}

run()
  .catch(error => {
    console.error('AI request queue tests failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    config.aiEngine.maxConcurrency = originalConcurrency;
    config.aiEngine.maxQueueLength = originalQueueLength;
    config.aiEngine.timeoutMs = originalTimeout;
    config.aiEngine.allowedModels = originalAllowedModels;
    globalThis.fetch = originalFetch;
  });
