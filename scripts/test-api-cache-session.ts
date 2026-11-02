import assert from 'node:assert/strict';
import { apiDb, setAuthToken } from '../src/services/apiDatabaseClient.ts';

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
let resolveFirstSessionRequest!: (response: Response) => void;
let resolveStaleRead!: (response: Response) => void;
const firstSessionResponse = new Promise<Response>((resolve) => {
  resolveFirstSessionRequest = resolve;
});
const staleReadResponse = new Promise<Response>((resolve) => {
  resolveStaleRead = resolve;
});

const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

try {
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    if (fetchCalls === 1) return firstSessionResponse;
    if (fetchCalls === 3) return staleReadResponse;
    return jsonResponse([{ id: fetchCalls === 2 ? 'session-B' : 'fresh-after-write' }]);
  }) as typeof fetch;

  setAuthToken('session-A');
  const oldSessionRequest = apiDb.getPersonnel();
  assert.equal(fetchCalls, 1, 'the first session should start one request');

  // Switching accounts must bypass both the old cache and old in-flight request.
  setAuthToken('session-B');
  const newSessionRequest = apiDb.getPersonnel();
  assert.equal(fetchCalls, 2, 'the new session must start its own request');
  assert.deepEqual(await newSessionRequest, [{ id: 'session-B' }]);

  // A late response from the previous session must be rejected and never cached.
  resolveFirstSessionRequest(jsonResponse([{ id: 'session-A' }]));
  await assert.rejects(
    oldSessionRequest,
    /authenticated session changed/,
    'a stale response must not reach a caller after account switching',
  );
  assert.deepEqual(await apiDb.getPersonnel(), [{ id: 'session-B' }]);
  assert.equal(fetchCalls, 2, 'the new session cache must remain isolated');

  // A write invalidation must also prevent an older in-flight read from repopulating cache.
  apiDb.invalidateCache('personnel'); // Remove the valid session-B cache before starting the stale read.
  const staleRead = apiDb.getPersonnel();
  assert.equal(fetchCalls, 3, 'the stale read should start before invalidation');
  apiDb.invalidateCache('personnel');
  const freshRead = apiDb.getPersonnel();
  assert.equal(fetchCalls, 4, 'a read after invalidation must not join the stale request');
  assert.deepEqual(await freshRead, [{ id: 'fresh-after-write' }]);

  resolveStaleRead(jsonResponse([{ id: 'stale-before-write' }]));
  await assert.rejects(
    staleRead,
    /cached data was invalidated/,
    'a pre-invalidation response must be discarded',
  );
  assert.deepEqual(await apiDb.getPersonnel(), [{ id: 'fresh-after-write' }]);
  assert.equal(fetchCalls, 4, 'the fresh post-invalidation cache must remain intact');

  console.log('PASS: API cache isolates auth sessions and rejects stale reads after invalidation.');
} finally {
  setAuthToken(null);
  globalThis.fetch = originalFetch;
}
