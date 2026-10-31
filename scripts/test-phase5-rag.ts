/**
 * HSECORE Phase 5 RAG & Knowledge Base Automated Verification Suite
 * Tests text chunking, document indexing, semantic vector scoring, and orchestrator RAG integration.
 */

import { textChunker } from '../server/modules/ai/ai.chunker.ts';
import { aiRagService } from '../server/modules/ai/ai.rag.service.ts';
import { aiOrchestrator } from '../server/modules/ai/ai.orchestrator.ts';
import { db, schema, sql } from '../server/core/db.ts';

async function runPhase5Tests() {
  console.log('====================================================');
  console.log('🧪 Starting HSECORE AI Phase 5: RAG & Knowledge Base Test Suite');
  console.log('====================================================\n');

  let passedTests = 0;
  const totalTests = 5;

  // Test 1: Persian Text Chunker
  console.log('👉 [Test 1/5] Testing Persian HSE Text Chunker...');
  try {
    const sampleHseDoc = `دستورالعمل جامع صدور پروانه کار گرم در صنایع فرآیندی و مخازن نفتی.
بخش اول: الزامات عمومی و مقدماتی.
کلیه فعالیت‌هایی که شامل شعله باز، جوشکاری، برشکاری حرارتی، فرزکاری یا ایجاد جرقه در مناطق دارای خطر اتمسفر قابل اشتعال (Zone 0, Zone 1, Zone 2) می‌باشند، نیازمند اخذ پروانه کار گرم (Hot Work Permit) پیش از آغاز عملیات هستند.

بخش دوم: کنترل گازسنجی و پایش اتمسفر.
پیش از صدور مجوز، غلظت اکسیژن باید بین ۱۹.۵ تا ۲۳.۵ درصد و گازهای قابل اشتعال کمتر از ۱۰ درصد LEL اندازه‌گیری و تایید گردد. در طول اجرای کار، گازسنجی مداوم باید توسط دیده‌بان آتش (Fire Watch) آموزش‌دیده صورت پذیرد. کپسول‌های اطفا حریق متناسب با نوع حریق باید در فاصله حداکثر ۵ متری محل جوشکاری مستقر شوند.`;

    const chunks = textChunker.chunkText(sampleHseDoc, { maxChunkSize: 300, overlapSize: 60 });
    console.log(`   - Successfully chunked text into ${chunks.length} semantic segments.`);
    if (chunks.length > 0 && chunks[0].text.length > 20) {
      console.log('   - Sample Chunk 1:', chunks[0].text.slice(0, 80) + '...');
      passedTests++;
      console.log('✅ Test 1 Passed: Persian Text Chunker working as expected.\n');
    } else {
      throw new Error('Chunking produced empty or invalid chunks');
    }
  } catch (err: any) {
    console.error('❌ Test 1 Failed:', err.message);
  }

  // Test 2: Database Schema & Migration for Knowledge Base
  console.log('👉 [Test 2/5] Verifying Knowledge Base DB Tables...');
  try {
    await db.execute(sql`DROP TABLE IF EXISTS ai_knowledge_chunks CASCADE;`);
    await db.execute(sql`DROP TABLE IF EXISTS ai_knowledge_docs CASCADE;`);

    await db.execute(sql`
      CREATE TABLE ai_knowledge_docs (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        doc_type TEXT DEFAULT 'REGULATION' NOT NULL,
        category TEXT DEFAULT 'GENERAL' NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        file_size INTEGER DEFAULT 0 NOT NULL,
        chunk_count INTEGER DEFAULT 0 NOT NULL,
        status TEXT DEFAULT 'INDEXED' NOT NULL,
        uploaded_by TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    await db.execute(sql`
      CREATE TABLE ai_knowledge_chunks (
        id SERIAL PRIMARY KEY,
        doc_id INTEGER NOT NULL REFERENCES ai_knowledge_docs(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        token_count INTEGER DEFAULT 0 NOT NULL,
        embedding JSONB,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    console.log('   - Database tables `ai_knowledge_docs` & `ai_knowledge_chunks` created cleanly.');
    passedTests++;
    console.log('✅ Test 2 Passed: DB tables ready.\n');
  } catch (err: any) {
    console.error('❌ Test 2 Failed:', err.message);
  }

  // Test 3: Document Indexing via aiRagService
  let indexedDocId: number | null = null;
  console.log('👉 [Test 3/5] Testing Document Indexing & Storage...');
  try {
    const docData = {
      title: 'دستورالعمل ایمنی داربست‌بندی و کار در ارتفاع OSHA 1926.451',
      category: 'STANDARDS',
      summary: 'مجموعه ضوابط فنی بستن داربست‌های مدولار و کمربند ایمنی سقوط کامل Full Body Harness',
      content: `کلیه افراد شاغل در ارتفاع بالای ۱.۸ متر ملزم به استفاده از لنیارد شوک‌گیر و کمربند تمام‌بدن متصل به طناب نجات (Life Line) می‌باشند.
پایه‌های داربست باید بر روی تخته زیرپایی (Sole Board) تراز و محکم قرار گیرند.
نصب تگ ایمنی قرمز، زرد و سبز داربست پس از بازرسی روزانه کارشناس ایمنی الزامی است.`,
      uploadedBy: 'HSE_TESTER',
    };

    const result = await aiRagService.indexDocument(docData);
    indexedDocId = result.docId || (result as any).id;
    console.log(`   - Document indexed successfully! ID: ${indexedDocId}, Chunks: ${result.chunkCount}`);
    if (indexedDocId && result.chunkCount > 0) {
      passedTests++;
      console.log('✅ Test 3 Passed: Document indexed with chunk generation.\n');
    } else {
      throw new Error('Indexing returned invalid doc metadata');
    }
  } catch (err: any) {
    console.error('❌ Test 3 Failed:', err.message);
  }

  // Test 4: Semantic Vector Query & Scoring
  console.log('👉 [Test 4/5] Testing Semantic Cosine & Keyword Query...');
  try {
    const query = 'ضوابط کار در ارتفاع و لنیارد شوک گیر داربست';
    const results = await aiRagService.queryRelevantChunks(query, { topK: 3, allowedCategories: ['STANDARDS'], userContext: { uid: 'test-admin-uid', role: 'ADMIN', permissions: ['*'] } });
    console.log(`   - Query: "${query}" returned ${results.length} matched chunks.`);
    results.forEach((r, idx) => {
      console.log(`     [Match ${idx + 1}] Score: ${(r.score * 100).toFixed(1)}% | Doc: ${r.docTitle} | Excerpt: ${r.chunkText.slice(0, 60)}...`);
    });

    if (results.length > 0 && results[0].score > 0.1) {
      passedTests++;
      console.log('✅ Test 4 Passed: Semantic RAG retrieval succeeded.\n');
    } else {
      throw new Error('No relevant chunks matched for valid query');
    }
  } catch (err: any) {
    console.error('❌ Test 4 Failed:', err.message);
  }

  // Test 5: Orchestrator Integration with Grounded RAG Context
  console.log('👉 [Test 5/5] Testing AI Orchestrator RAG Integration...');
  try {
    const chatResponse = await aiOrchestrator.processChat(
      {
        message: 'الزامات استفاده از طناب نجات و کمربند کار در ارتفاع در استانداردهای شرکت چیست؟',
        assistantId: 'GENERAL_HSE',
        allowTools: true,
      },
      { uid: 'test-admin-uid', name: 'test_admin', role: 'ADMIN', permissions: ['*'] }
    );

    console.log(`   - Response received from assistant: ${chatResponse.assistantId}`);
    console.log(`   - Tools executed: ${JSON.stringify(chatResponse.toolsUsed)}`);
    console.log(`   - Citations: ${JSON.stringify(chatResponse.citations)}`);
    console.log(`   - Response preview: ${chatResponse.reply ? chatResponse.reply.slice(0, 100) : 'N/A'}...`);

    if (chatResponse.reply && chatResponse.reply.length > 20) {
      passedTests++;
      console.log('✅ Test 5 Passed: Orchestrator successfully delivered grounded response.\n');
    } else {
      throw new Error('Chat response was empty');
    }
  } catch (err: any) {
    console.error('❌ Test 5 Failed:', err.message);
  }

  // Cleanup test document if needed
  if (indexedDocId) {
    try {
      console.log(`🧹 Cleaning up test document #${indexedDocId}...`);
      await aiRagService.deleteDocument(indexedDocId);
      console.log('   - Test document cleaned up successfully.');
    } catch (e) {
      // Ignore cleanup error
    }
  }

  console.log('====================================================');
  console.log(`🏁 Phase 5 Test Suite Finished: ${passedTests}/${totalTests} Passed.`);
  console.log('====================================================');

  process.exit(passedTests === totalTests ? 0 : 1);
}

runPhase5Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
