import assert from 'node:assert/strict';
import { config } from '../server/core/config.ts';
import { AIRequestQueue } from '../server/modules/ai/ai.queue.ts';

const originalConcurrency = config.aiEngine.maxConcurrency;
const originalQueueLength = config.aiEngine.maxQueueLength;
const originalTimeout = config.aiEngine.timeoutMs;

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

  console.log('AI request queue tests: 2/2 passed');
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
  });
