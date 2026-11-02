import assert from 'node:assert/strict';
import { apiDb, setAuthToken } from '../src/services/apiDatabaseClient.ts';

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
let resolveFirstRequest!: (response: Response) => void;
const firstResponse = new Promise<Response>((resolve) => {
  resolveFirstRequest = resolve;
});

const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

try {
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    if (fetchCalls === 1) return firstResponse;
    return jsonResponse([{ id: 'session-B' }]);
  }) as typeof fetch;

  setAuthToken('session-A');
  const oldSessionRequest = apiDb.getPersonnel();
  assert.equal(fetchCalls, 1, 'the first session should start one request');

  // Switching accounts must bypass both the old cache and old in-flight request.
  setAuthToken('session-B');
  const newSessionRequest = apiDb.getPersonnel();
  assert.equal(fetchCalls, 2, 'the new session must start its own request');

  assert.deepEqual(await newSessionRequest, [{ id: 'session-B' }]);

  // A late response from the previous session may resolve for its original caller,
  // but it must not repopulate the shared cache for the new session.
  resolveFirstRequest(jsonResponse([{ id: 'session-A' }]));
  await assert.rejects(
    oldSessionRequest,
    /authenticated session changed/,
    'a stale response must not reach a caller after account switching',
  );
  assert.deepEqual(await apiDb.getPersonnel(), [{ id: 'session-B' }]);
  assert.equal(fetchCalls, 2, 'the new session cache must remain isolated');

  console.log('PASS: API cache and in-flight requests are isolated across auth sessions.');
} finally {
  setAuthToken(null);
  globalThis.fetch = originalFetch;
}
