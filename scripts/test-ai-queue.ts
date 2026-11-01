import assert from 'node:assert/strict';
import { config } from '../server/core/config.ts';
import { AIRequestQueue } from '../server/modules/ai/ai.queue.ts';
import { LocalAIProvider } from '../server/modules/ai/ai.local-provider.ts';

const originalConcurrency = config.aiEngine.maxConcurrency;
const originalQueueLength = config.aiEngine.maxQueueLength;
const originalTimeout = config.aiEngine.timeoutMs;
const originalAllowedModels = config.aiEngine.allowedModels;
const originalDefaultChatModel = config.aiEngine.defaultChatModel;
const originalDefaultEmbedModel = config.aiEngine.defaultEmbedModel;
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

  // Model downloads must be explicitly allowlisted; :latest aliases cannot bypass
  // protection of configured defaults or the exact allowlist.
  {
    config.aiEngine.defaultChatModel = 'qwen2.5';
    config.aiEngine.defaultEmbedModel = 'bge-m3';
    config.aiEngine.allowedModels = ['qwen2.5', 'bge-m3'];
    const provider = new LocalAIProvider();
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;

    const blockedPull = await provider.pullModel('attacker/unknown-model:latest');
    assert.equal(blockedPull.success, false);
    assert.equal(fetchCalls, 0);

    const allowedAliasPull = await provider.pullModel('qwen2.5:latest');
    assert.equal(allowedAliasPull.success, true);
    assert.equal(fetchCalls, 1);

    const protectedAliasDelete = await provider.deleteModel('qwen2.5:latest');
    assert.equal(protectedAliasDelete.success, false);
    assert.equal(fetchCalls, 1);
    console.log('PASS model allowlist and default protection normalize omitted/:latest tags');
  }

  // Reachable Ollama without installed models must not be reported inference-ready.
  {
    const provider = new LocalAIProvider();
    let inventory: Array<{ name: string; model: string; size: number; digest: string }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/tags')) {
        return new Response(JSON.stringify({ models: inventory }), { status: 200 });
      }
      if (url.endsWith('/api/version')) {
        return new Response(JSON.stringify({ version: 'test' }), { status: 200 });
      }
      throw new Error('unexpected URL');
    }) as typeof fetch;
    const emptyStatus = await provider.checkHealth();
    assert.equal(emptyStatus.isAvailable, true);
    assert.equal(emptyStatus.localInferenceReady, false);
    assert.equal(emptyStatus.chatModelInstalled, false);
    assert.equal(emptyStatus.embeddingModelInstalled, false);

    inventory = [
      { name: 'qwen2.5:latest', model: 'qwen2.5:latest', size: 1, digest: 'chat-test' },
      { name: 'bge-m3:latest', model: 'bge-m3:latest', size: 1, digest: 'embed-test' },
    ];
    const aliasStatus = await provider.checkHealth();
    assert.equal(aliasStatus.chatModelInstalled, true);
    assert.equal(aliasStatus.embeddingModelInstalled, true);
    assert.equal(aliasStatus.localInferenceReady, true);
    console.log('PASS empty inventory readiness and canonical :latest inventory matching');
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
    config.aiEngine.defaultChatModel = originalDefaultChatModel;
    config.aiEngine.defaultEmbedModel = originalDefaultEmbedModel;
    globalThis.fetch = originalFetch;
  });
