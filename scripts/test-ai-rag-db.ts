/**
 * Isolated PostgreSQL integration tests for the AI knowledge base ACL/RAG path.
 * Destructive table setup is allowed only against an explicitly named test DB.
 */
import assert from 'node:assert/strict';
import { db, sql } from '../server/core/db.ts';
import { pool } from '../src/db/index.ts';
import { aiRagService } from '../server/modules/ai/ai.rag.service.ts';
import type { UserContext } from '../server/core/middleware/auth.ts';

const databaseName = process.env.SQL_DB_NAME || process.env.PGDATABASE || '';
if (process.env.NODE_ENV !== 'test' || process.env.AI_ACL_DB_TEST !== 'true' || !/(test|ci)/i.test(databaseName)) {
  throw new Error('Refusing destructive AI RAG tests: use NODE_ENV=test, AI_ACL_DB_TEST=true and a test-only SQL_DB_NAME.');
}

async function run() {
  let authorizedDocId = 0;
  let deniedDocId = 0;

  try {
    await db.execute(sql`DROP TABLE IF EXISTS ai_knowledge_chunks CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS ai_knowledge_docs CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS user_personnel_assignments CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS personnel CASCADE`);

    await db.execute(sql`
      CREATE TABLE ai_knowledge_docs (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        doc_type TEXT NOT NULL DEFAULT 'REGULATION',
        category TEXT NOT NULL DEFAULT 'GENERAL',
        content TEXT NOT NULL DEFAULT '',
        summary TEXT,
        file_size INTEGER NOT NULL DEFAULT 0,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'INDEXED',
        uploaded_by TEXT,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(sql`
      CREATE TABLE ai_knowledge_chunks (
        id SERIAL PRIMARY KEY,
        doc_id INTEGER NOT NULL REFERENCES ai_knowledge_docs(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        token_count INTEGER NOT NULL DEFAULT 0,
        embedding JSONB,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(sql`
      CREATE TABLE personnel (
        id SERIAL PRIMARY KEY,
        personnel_code TEXT NOT NULL,
        department_id INTEGER,
        unit_id INTEGER
      )
    `);
    await db.execute(sql`
      CREATE TABLE user_personnel_assignments (
        id SERIAL PRIMARY KEY,
        user_uid TEXT NOT NULL,
        personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE
      )
    `);

    const personnel = await db.execute(sql`
      INSERT INTO personnel (personnel_code, department_id, unit_id)
      VALUES ('ACL-ORG-TEST', 10, 101)
      RETURNING id
    `);
    const personnelId = Number((personnel as any).rows[0].id);
    await db.execute(sql`
      INSERT INTO user_personnel_assignments (user_uid, personnel_id)
      VALUES ('user-org-test', ${personnelId})
    `);

    // Place more than 200 inaccessible chunks before the authorized document.
    // This proves ACL filtering happens before the retrieval LIMIT.
    await db.execute(sql`
      INSERT INTO ai_knowledge_docs (title, category, content, status, metadata)
      SELECT
        'Blocked document ' || series.value,
        'PTW',
        'blocked content',
        'INDEXED',
        jsonb_build_object(
          'accessControl',
          jsonb_build_object('userUids', jsonb_build_array('not-this-user'))
        )
      FROM generate_series(1, 205) AS series(value)
    `);
    await db.execute(sql`
      INSERT INTO ai_knowledge_chunks (doc_id, chunk_index, chunk_text, token_count, embedding, metadata)
      SELECT id, 0, 'blocked reference unrelated to the permitted permit', 8, NULL, '{}'::jsonb
      FROM ai_knowledge_docs
      WHERE title LIKE 'Blocked document %'
    `);

    const authorizedInsert = await db.execute(sql`
      INSERT INTO ai_knowledge_docs (title, category, content, status, metadata)
      VALUES (
        'Authorized PTW test document',
        'PTW',
        'authorized permit reference',
        'INDEXED',
        jsonb_build_object(
          'accessControl',
          jsonb_build_object(
            'userUids', jsonb_build_array('user-org-test'),
            'departmentIds', jsonb_build_array(10),
            'unitIds', jsonb_build_array(101)
          )
        )
      )
      RETURNING id
    `);
    authorizedDocId = Number((authorizedInsert as any).rows[0].id);

    const deniedInsert = await db.execute(sql`
      INSERT INTO ai_knowledge_docs (title, category, content, status, metadata)
      VALUES (
        'Wrong organization test document',
        'PTW',
        'not available to this personnel assignment',
        'INDEXED',
        jsonb_build_object(
          'accessControl',
          jsonb_build_object(
            'userUids', jsonb_build_array('user-org-test'),
            'departmentIds', jsonb_build_array(10),
            'unitIds', jsonb_build_array(202)
          )
        )
      )
      RETURNING id
    `);
    deniedDocId = Number((deniedInsert as any).rows[0].id);

    await db.execute(sql`
      INSERT INTO ai_knowledge_chunks (doc_id, chunk_index, chunk_text, token_count, embedding, metadata)
      VALUES (
        ${authorizedDocId},
        0,
        'authorizedpermit safe work instructions',
        5,
        NULL,
        '{}'::jsonb
      )
    `);

    const user: UserContext = {
      uid: 'user-org-test',
      role: 'SAFETY_OFFICER',
      permissions: ['ptw:read'],
    };

    assert.equal(await aiRagService.canAccessDocument(authorizedDocId, ['PTW'], user), true);
    assert.equal(await aiRagService.canAccessDocument(deniedDocId, ['PTW'], user), false);
    assert.equal(await aiRagService.canAccessDocument(authorizedDocId, ['HEALTH'], user), false);
    console.log('PASS PostgreSQL document ACL and category enforcement');

    const visibleDocs = await aiRagService.listDocuments(['PTW'], user);
    assert.ok(visibleDocs.some(doc => doc.id === authorizedDocId));
    assert.equal(visibleDocs.some(doc => doc.id === deniedDocId), false);
    assert.equal(visibleDocs.some(doc => doc.title.startsWith('Blocked document ')), false);
    assert.equal(Object.prototype.hasOwnProperty.call(visibleDocs[0] || {}, 'metadata'), false);
    console.log('PASS PostgreSQL knowledge listing applies ACL and omits metadata');

    const results = await aiRagService.queryRelevantChunks('authorizedpermit safe', {
      topK: 5,
      minScore: 0.1,
      allowedCategories: ['PTW'],
      userContext: user,
    });
    assert.ok(results.some(result => result.docId === authorizedDocId));
    assert.equal(results.some(result => result.docId === deniedDocId), false);
    assert.equal(results.some(result => result.docTitle.startsWith('Blocked document ')), false);
    console.log('PASS RAG filters ACL before applying the 200-chunk retrieval limit');

    await aiRagService.deleteDocument(authorizedDocId);
    const deletedDoc = await db.execute(sql`
      SELECT id FROM ai_knowledge_docs WHERE id = ${authorizedDocId}
    `);
    const deletedChunks = await db.execute(sql`
      SELECT id FROM ai_knowledge_chunks WHERE doc_id = ${authorizedDocId}
    `);
    assert.equal((deletedDoc as any).rows.length, 0);
    assert.equal((deletedChunks as any).rows.length, 0);
    console.log('PASS PostgreSQL document deletion cascades to its chunks');

    console.log('AI RAG PostgreSQL integration tests: 4/4 passed');
  } finally {
    await db.execute(sql`DROP TABLE IF EXISTS ai_knowledge_chunks CASCADE`).catch(() => undefined);
    await db.execute(sql`DROP TABLE IF EXISTS ai_knowledge_docs CASCADE`).catch(() => undefined);
    await db.execute(sql`DROP TABLE IF EXISTS user_personnel_assignments CASCADE`).catch(() => undefined);
    await db.execute(sql`DROP TABLE IF EXISTS personnel CASCADE`).catch(() => undefined);
    await pool.end();
  }
}

run().catch(error => {
  console.error('AI RAG PostgreSQL integration tests failed:', error);
  process.exitCode = 1;
});
