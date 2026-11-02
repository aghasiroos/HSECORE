import assert from 'node:assert/strict';
import { normalizeOllamaModelName, localAIProvider } from '../server/modules/ai/ai.local-provider.ts';

async function main() {
  const validRefs = ['qwen2.5:1.5b', 'llama3.2', 'namespace/model:tag', 'hf.co/user/model:Q4_K_M'];
  for (const ref of validRefs) {
    assert.equal(normalizeOllamaModelName(ref), ref, `Expected valid Ollama model reference: ${ref}`);
  }
  const invalidRefs: unknown[] = ['', '   ', 'https://ollama.com/library/model', '../model',
    'namespace/../model', 'model:tag:extra', 'model:bad tag', 'namespace//model',
    'model;rm -rf /', null, 123];
  for (const ref of invalidRefs) {
    assert.equal(normalizeOllamaModelName(ref), null, `Expected invalid model reference: ${String(ref)}`);
  }

  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(JSON.stringify({ status: 'success' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const success = await localAIProvider.pullModel('hf.co/user/model:Q4_K_M');
    assert.equal(success.success, true);
    assert.equal(capturedUrl.endsWith('/api/pull'), true);
    assert.equal(capturedInit?.method, 'POST');
    assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
      model: 'hf.co/user/model:Q4_K_M', stream: false,
    });

    globalThis.fetch = (async () => new Response(
      JSON.stringify({ error: 'pull model manifest: file does not exist' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;
    const missing = await localAIProvider.pullModel('qwen2.5:1.7b');
    assert.equal(missing.success, false);
    assert.match(missing.message, /manifest: file does not exist/);
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('AI model-pull regression tests passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
