/**
 * PostgreSQL integration tests for persistent AI chat sessions.
 * Runs only against an explicitly named local test database; never drops tables.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db, sql } from '../server/core/db.ts';
import { pool } from '../src/db/index.ts';
import { AISessionService } from '../server/modules/ai/ai.sessions.ts';
import type { UserContext } from '../server/core/middleware/auth.ts';

const databaseName = process.env.SQL_DB_NAME || process.env.PGDATABASE || '';
const databaseHost = (process.env.SQL_HOST || process.env.PGHOST || '').trim().toLowerCase();
const connectionStringKeys = ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRESQL_URL', 'PG_URL'];
const hasConnectionString = connectionStringKeys.some(key => Boolean(process.env[key]?.trim()));
if (
  process.env.NODE_ENV !== 'test' ||
  process.env.AI_ACL_DB_TEST !== 'true' ||
  !/(test|ci)/i.test(databaseName) ||
  !['localhost', '127.0.0.1', '::1'].includes(databaseHost) ||
  hasConnectionString
) {
  throw new Error('Refusing AI session integration tests: require NODE_ENV=test, AI_ACL_DB_TEST=true, a test-only SQL_DB_NAME, a local SQL_HOST, and no external connection string.');
}

const suffix = randomUUID().replace(/-/g, '');
const sessionId = `ai-session-test-${suffix}`;
const insertFunction = `hsecore_reject_ai_message_${suffix}`;
const insertTrigger = `hsecore_reject_ai_message_trigger_${suffix}`;
const deleteFunction = `hsecore_reject_ai_session_delete_${suffix}`;
const deleteTrigger = `hsecore_reject_ai_session_delete_trigger_${suffix}`;
const sharedLegacyUsername = `same-login-${suffix}`;
const userA: UserContext = { uid: `ai-session-user-a-${suffix}`, username: sharedLegacyUsername, role: 'SAFETY_OFFICER', permissions: [] };
const userB: UserContext = { uid: `ai-session-user-b-${suffix}`, username: sharedLegacyUsername, role: 'SAFETY_OFFICER', permissions: [] };

async function cleanup() {
  await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${insertTrigger} ON ai_chat_messages`)).catch(() => undefined);
  await db.execute(sql.raw(`DROP FUNCTION IF EXISTS ${insertFunction}()`)).catch(() => undefined);
  await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${deleteTrigger} ON ai_chat_sessions`)).catch(() => undefined);
  await db.execute(sql.raw(`DROP FUNCTION IF EXISTS ${deleteFunction}()`)).catch(() => undefined);
  await db.execute(sql`DELETE FROM ai_chat_sessions WHERE id = ${sessionId}`).catch(() => undefined);
}

async function run() {
  const service = new AISessionService();
  const freshService = new AISessionService();
  try {
    const created = await service.createSession(userA, 'AI session persistence regression', 'GENERAL_HSE', sessionId);
    assert.equal(created.id, sessionId);
    assert.equal((await service.listSessions(userA)).some(item => item.id === sessionId), true);
    assert.equal((await service.listSessions(userB)).some(item => item.id === sessionId), false);
    await assert.rejects(service.createSession(userB, 'Attempted session takeover', 'GENERAL_HSE', sessionId), /تعلق/);
    console.log('PASS stable-identity isolation, shared-username denial, and session-ID takeover prevention');

    await service.appendMessage(sessionId, userA, {
      id: `user-message-${suffix}`,
      role: 'user',
      content: 'Test user prompt',
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    await service.appendMessage(sessionId, userA, {
      id: `assistant-message-${suffix}`,
      role: 'assistant',
      content: 'Test assistant response',
      model: 'test-model',
      durationMs: 123,
    });

    const restored = await freshService.getMessages(sessionId, userA);
    assert.deepEqual(restored.map(item => item.role), ['user', 'assistant']);
    assert.equal(restored[1].content, 'Test assistant response');
    assert.equal(restored[1].model, 'test-model');
    assert.equal(restored[1].durationMs, 123);
    console.log('PASS user and assistant messages survive a fresh service instance');

    await assert.rejects(freshService.getMessages(sessionId, userB), /دسترسی/);
    console.log('PASS cross-user message access is denied');

    await db.execute(sql.raw(`
      CREATE FUNCTION ${insertFunction}() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'simulated AI chat message persistence failure'; END;
      $$ LANGUAGE plpgsql
    `));
    await db.execute(sql.raw(`
      CREATE TRIGGER ${insertTrigger}
      BEFORE INSERT ON ai_chat_messages FOR EACH ROW EXECUTE FUNCTION ${insertFunction}()
    `));
    await assert.rejects(
      service.appendMessage(sessionId, userA, { role: 'user', content: 'Must not be acknowledged as saved' }),
      /ذخیره پیام/
    );
    await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${insertTrigger} ON ai_chat_messages`));
    await db.execute(sql.raw(`DROP FUNCTION IF EXISTS ${insertFunction}()`));
    const afterFailedWrite = await service.getMessages(sessionId, userA);
    assert.equal(afterFailedWrite.length, 2);
    console.log('PASS failed message writes are rejected and do not appear in history');

    await db.execute(sql.raw(`
      CREATE FUNCTION ${deleteFunction}() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'simulated AI chat session delete failure'; END;
      $$ LANGUAGE plpgsql
    `));
    await db.execute(sql.raw(`
      CREATE TRIGGER ${deleteTrigger}
      BEFORE DELETE ON ai_chat_sessions FOR EACH ROW EXECUTE FUNCTION ${deleteFunction}()
    `));
    await assert.rejects(freshService.deleteSession(sessionId, userA), /حذف گفتگو/);
    const retained = await db.execute(sql`SELECT id FROM ai_chat_sessions WHERE id = ${sessionId}`);
    assert.equal((retained as any).rows.length, 1);
    await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${deleteTrigger} ON ai_chat_sessions`));
    await db.execute(sql.raw(`DROP FUNCTION IF EXISTS ${deleteFunction}()`));
    await freshService.deleteSession(sessionId, userA);
    const deleted = await db.execute(sql`SELECT id FROM ai_chat_sessions WHERE id = ${sessionId}`);
    assert.equal((deleted as any).rows.length, 0);
    console.log('PASS failed deletes preserve history and successful deletes remove it');

    console.log('AI chat session PostgreSQL integration tests: 5/5 passed');
  } finally {
    await cleanup();
    await pool.end();
  }
}

run().catch(error => {
  console.error('AI chat session PostgreSQL integration tests failed:', error);
  process.exitCode = 1;
});
