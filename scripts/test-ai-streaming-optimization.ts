import assert from 'node:assert/strict';
import http from 'node:http';
import {
  aiOrchestrator,
  cleanMixedScriptPersianArtifacts,
  computeDynamicTokenBudget,
  isTextStructurallyIncomplete,
} from '../server/modules/ai/ai.orchestrator.ts';
import { LocalAIProvider } from '../server/modules/ai/ai.local-provider.ts';
import { AIRequestQueue } from '../server/modules/ai/ai.queue.ts';
import { AIMemoryEstimator } from '../server/modules/ai/ai.memory-estimator.ts';
import { aiSessionService } from '../server/modules/ai/ai.sessions.ts';
import type { UserContext } from '../server/core/middleware/auth.ts';

const adminUser: UserContext = {
  id: 1,
  uid: 'admin-streaming-audit',
  username: 'admin',
  name: 'مصطفی سیروس',
  role: 'SUPER_ADMIN',
  permissions: ['*'],
};

async function createMockOllamaServer(): Promise<{
  url: string;
  close: () => Promise<void>;
  lastRequestPayload: () => any;
}> {
  let latestPayload: any = null;
  const server = http.createServer((req, res) => {
    if (req.url === '/api/tags' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          models: [
            {
              name: 'qwen2.5:7b',
              model: 'qwen2.5:7b',
              size: 4_700_000_000,
              details: { family: 'qwen2', parameter_size: '7B', quantization_level: 'Q4_K_M' },
            },
          ],
        })
      );
      return;
    }

    if (req.url === '/api/ps' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: [] }));
      return;
    }

    if (req.url === '/api/chat' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        latestPayload = JSON.parse(body || '{}');
        const messages: Array<{ role: string; content: string }> = latestPayload.messages || [];
        const lastUserMsg = messages[messages.length - 1]?.content || '';
        const prevAssistantMsg =
          messages.length >= 2 && messages[messages.length - 2]?.role === 'assistant'
            ? messages[messages.length - 2].content
            : '';

        res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' });

        // Scenario A: Continuation request from cutoff "**تح"
        if (prevAssistantMsg && prevAssistantMsg.trim().endsWith('**تح')) {
          const continuationTokens = [
            'لیل وضعیت معاینات ادواری و علائم حیاتی**:\n',
            '- بر اساس سوابق ثبت‌شده در سامانه، وضعیت سلامت شغلی آقا مصطفی سیروس (کد پرسنلی 11287) بررسی گردید.\n',
            '- توصیه نهایی: پایش منظم سالانه طبق ماده ۹۲ قانون کار ج.ا.ا انجام شود.',
          ];
          for (const tk of continuationTokens) {
            res.write(JSON.stringify({ model: 'qwen2.5:7b', message: { content: tk }, done: false }) + '\n');
          }
          res.write(
            JSON.stringify({ model: 'qwen2.5:7b', message: { content: '' }, done: true, done_reason: 'stop' }) + '\n'
          );
          res.end();
          return;
        }

        // Scenario B: Simulate truncated response hitting token length limit ("done_reason": "length")
        if (lastUserMsg.includes('[SIMULATE_LENGTH_CUTOFF]')) {
          const partialTokens = [
            '**تجزیه و تحلیل سلامت پرسنل آقا مصطفی سیروس (کد پersنال: 11287 - کد ملی: 5279930555)**\n\n',
            '- **اطلاعات شخصی**:\n  - نام: آقا مصطفی سیروس\n  - کد پرسنلی: 11287\n  - کد ملی: 5279930555\n\n',
            '**تح',
          ];
          for (const tk of partialTokens) {
            res.write(JSON.stringify({ model: 'qwen2.5:7b', message: { content: tk }, done: false }) + '\n');
          }
          res.write(
            JSON.stringify({ model: 'qwen2.5:7b', message: { content: '' }, done: true, done_reason: 'length' }) + '\n'
          );
          res.end();
          return;
        }

        // Scenario C: Standard streaming response (with split NDJSON packet test)
        const tokens = [
          'گزارش تحلیلی سلامت شغلی و ایمنی پرسنل (کد پersنال 11287):\n',
          '۱. وضعیت پرونده پرسنلی و معاینات ادواری بررسی شد.\n',
          '۲. شاخص‌های ایمنی و مجوزهای کار (PTW) مطابق استاندارد ISO 45001 و فصل چهارم قانون کار ارزیابی گردید.\n',
          '۳. جمع‌بندی نهایی: تمامی الزامات قانونی و پایش‌های دوره‌ای به‌طور کامل تکمیل شده‌اند.',
        ];
        for (let i = 0; i < tokens.length; i++) {
          const line = JSON.stringify({ model: 'qwen2.5:7b', message: { content: tokens[i] }, done: false }) + '\n';
          if (i === 1) {
            // Split NDJSON frame across two TCP writes to verify parser resilience
            const mid = Math.floor(line.length / 2);
            res.write(line.slice(0, mid));
            await new Promise(r => setTimeout(r, 8));
            res.write(line.slice(mid));
          } else {
            res.write(line);
          }
          await new Promise(r => setTimeout(r, 5));
        }
        res.write(
          JSON.stringify({ model: 'qwen2.5:7b', message: { content: '' }, done: true, done_reason: 'stop' }) + '\n'
        );
        res.end();
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as { port: number };
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
    lastRequestPayload: () => latestPayload,
  };
}

async function runTests() {
  console.log('🚀 شروع اجرای ۹ سناریوی ممیزی سرعت، استریم و رفع توقف زودهنگام HSECORE AI...\n');
  const mockServer = await createMockOllamaServer();

  try {
    // 1. Test 1: Short Persian query & TTFT measurement
    const t0 = Date.now();
    let firstTokenAt = 0;
    const shortReply = await aiOrchestrator.processChat(
      {
        message: 'وضعیت کلی ایمنی و دما در مجتمع چگونه است؟',
        model: 'hsecore-analytical-engine',
        onToken: () => {
          if (!firstTokenAt) firstTokenAt = Date.now();
        },
      },
      adminUser
    );
    const ttftMs = (firstTokenAt || Date.now()) - t0;
    assert.equal(shortReply.completed, true, 'پاسخ کوتاه باید در وضعیت تکمیل‌شده باشد.');
    assert.ok(shortReply.reply.length > 50, 'پاسخ کوتاه باید محتوای معتبر داشته باشد.');
    assert.ok(ttftMs < 2000, `زمان دریافت اولین توکن (TTFT=${ttftMs}ms) باید سریع باشد.`);
    console.log(`✅ تست ۱ (پرسش کوتاه فارسی و سرعت شروع پاسخ): TTFT = ${ttftMs}ms`);

    // 2. Test 2: Long analytical query, sentence completion & mixed-script cleanup ("پersنال" -> "پرسنلی")
    const mockProvider = new LocalAIProvider(mockServer.url);
    const streamedChunks: string[] = [];
    const streamRes = await mockProvider.chatStream(
      [{ role: 'user', content: 'تحلیل جامع سلامت پرسنل مصطفی سیروس کد پرسنلی 11287' }],
      { model: 'qwen2.5:7b', max_tokens: 2048, skipQueue: true },
      token => streamedChunks.push(cleanMixedScriptPersianArtifacts(token))
    );
    const cleanedFullText = cleanMixedScriptPersianArtifacts(streamRes.text);
    assert.equal(streamRes.completed, true, 'سیگنال پایان واقعی مدل باید دریافت شود.');
    assert.equal(streamRes.doneReason, 'stop', 'دلیل پایان باید stop باشد.');
    assert.ok(!cleanedFullText.includes('پersنال'), 'تداخل حروف انگلیسی در کلمه فارسی (پersنال) باید اصلاح شده باشد.');
    assert.ok(cleanedFullText.includes('کد پرسنلی 11287'), 'عبارت کد پرسنلی 11287 باید به فارسی صحیح درج شود.');
    assert.equal(
      isTextStructurallyIncomplete(cleanedFullText),
      false,
      'انتهای جملات پاسخ طولانی باید کاملاً بسته و معنادار باشد.'
    );
    console.log('✅ تست ۲ (پرسش تحلیلی طولانی، کامل بودن جملات و حذف تداخل حروف پersنال): موفق');

    // 3. Test 3: Multi-part query & dynamic token budget scaling
    const shortBudget = computeDynamicTokenBudget({
      query: 'سلام وضعیت PTW چطور است؟',
      toolCount: 1,
      ragChunkCount: 0,
      requestAllScope: false,
    });
    const multiPartBudget = computeDynamicTokenBudget({
      query:
        'اول وضعیت معاینات ادواری را تحلیل کن؟ دوم آمار حوادث و اخطارها را مقایسه کن؟ سوم راهکار تفصیلی و جامع قانونی ارائه بده.',
      toolCount: 4,
      ragChunkCount: 3,
      requestAllScope: false,
    });
    assert.ok(
      multiPartBudget.maxTokens > shortBudget.maxTokens,
      `بودجه توکن پرسش چندبخشی (${multiPartBudget.maxTokens}) باید بیشتر از پرسش کوتاه (${shortBudget.maxTokens}) باشد.`
    );
    assert.equal(multiPartBudget.maxTokens, 3584, 'سقف توکن پرسش چندبخشی پیچیده باید 3584 باشد.');
    console.log(
      `✅ تست ۳ (پرسش چندبخشی و تخصیص پویا max_tokens): کوتاه=${shortBudget.maxTokens}، چندبخشی=${multiPartBudget.maxTokens}`
    );

    // 4. Test 4: Information extraction from HSECORE documents & live modules (Personnel 11287 / 5279930555)
    const dossierResult = await aiOrchestrator.processChat(
      {
        message: 'تجزیه تحلیل کن سلامت پرسنل آقا مصطفی سیروس به کد پرسنلی 11287 و کد ملی 5279930555 یک تجزیه و تحلیل کلی واسم انجام بده',
        model: 'hsecore-analytical-engine',
      },
      adminUser
    );
    assert.equal(dossierResult.completed, true);
    assert.ok(
      dossierResult.toolsUsed.length <= 4,
      `پرسش پرونده فردی همراه با عبارت «تحلیل کلی» نباید تمام ۲۰ ماژول سامانه را فراخوانی کند (تعداد فراخوانی: ${dossierResult.toolsUsed.length}).`
    );
    assert.ok(
      dossierResult.toolsUsed[0]?.includes('۳۶۰ درجه') || dossierResult.toolsUsed[0]?.includes('پرسنل'),
      'ابزار پرونده جامع ۳۶۰ درجه پرسنل باید به عنوان اولین و اصلی‌ترین منبع استخراج شود.'
    );
    assert.ok(
      dossierResult.reply.includes('مصطفی سیروس') || dossierResult.reply.includes('11287'),
      'اطلاعات واقعی آقا مصطفی سیروس (کد 11287) باید در پاسخ استخراج شود.'
    );
    console.log('✅ تست ۴ (استخراج هدفمند پرونده پرسنلی 11287 بدون فراخوانی کاذب ۲۰ ماژول): موفق');

    // 5. Test 5: /ALL comprehensive system-wide analysis
    const allResult = await aiOrchestrator.processChat(
      {
        message: '/ALL',
        model: 'hsecore-analytical-engine',
        selectedModules: ['all'],
      },
      adminUser
    );
    assert.equal(allResult.completed, true);
    assert.ok(allResult.reply.length > 200, 'گزارش /ALL باید جامع و کامل باشد.');
    console.log('✅ تست ۵ (تحلیل کلی و یکپارچه سامانه با دستور /ALL): موفق');

    // 6. Test 6: Sequential & concurrent multi-request test with sliding activity watchdog
    const testQueue = new AIRequestQueue();
    const concurrentTasks = Array.from({ length: 4 }, (_, idx) =>
      testQueue.enqueue(
        async (_rem, touchActivity) => {
          // Task runs for 180ms total (> 120ms static timeout) but touches activity every 50ms!
          for (let step = 0; step < 3; step++) {
            await new Promise(r => setTimeout(r, 50));
            touchActivity();
          }
          return `task-${idx}-ok`;
        },
        { userId: idx + 1, role: 'HSE_EXPERT', timeoutMs: 120 }
      )
    );
    const concurrentResults = await Promise.all(concurrentTasks);
    assert.equal(concurrentResults.length, 4, 'هر ۴ درخواست هم‌زمان باید بدون قطع شدن کامل شوند.');
    console.log('✅ تست ۶ (ارسال چند درخواست هم‌زمان و بازنشانی تایمر فعال حین استریم بدون تایم‌اوت کاذب): موفق');

    // 7. Test 7: Truncated response detection (**تح) & seamless continuation without repeating prior text
    const cutoffStream = await mockProvider.chatStream(
      [{ role: 'user', content: '[SIMULATE_LENGTH_CUTOFF] تحلیل سلامت پرسنل 11287' }],
      { model: 'qwen2.5:7b', max_tokens: 64, skipQueue: true },
      () => {}
    );
    const cleanedCutoffText = cleanMixedScriptPersianArtifacts(cutoffStream.text);
    assert.equal(cutoffStream.completed, false, 'پاسخ متوقف‌شده در سقف توکن نباید تکمیل‌شده تلقی شود.');
    assert.equal(
      isTextStructurallyIncomplete(cleanedCutoffText),
      true,
      'متن ختم‌شده به «**تح» باید به‌عنوان پاسخ ناقص شناسایی شود.'
    );

    // Now resume generation from exact cutoff point
    const continuationStream = await mockProvider.chatStream(
      [
        { role: 'user', content: 'تحلیل سلامت پرسنل 11287' },
        { role: 'assistant', content: cleanedCutoffText },
        {
          role: 'user',
          content: 'پاسخ قبلی در نقطه «**تح» ناتمام ماند. لطفاً دقیقاً از ادامه همین عبارت دنباله متن را بنویس.',
        },
      ],
      { model: 'qwen2.5:7b', max_tokens: 1024, skipQueue: true },
      () => {}
    );
    assert.equal(continuationStream.completed, true, 'ادامه تولید پاسخ باید به پایان کامل برسد.');
    const mergedContinuation = `${cleanedCutoffText}${continuationStream.text}`;
    assert.ok(
      mergedContinuation.includes('**تحلیل وضعیت معاینات ادواری و علائم حیاتی**'),
      'ادامه متن باید دقیقاً کلمه ناتمام «**تح» را به «**تحلیل وضعیت معاینات ادواری و علائم حیاتی**» تکمیل کند.'
    );
    const headerOccurrences = mergedContinuation.split('اطلاعات شخصی').length - 1;
    assert.equal(headerOccurrences, 1, 'بخش‌های قبلی نباید در ادامه پاسخ تکرار شوند.');
    console.log('✅ تست ۷ (تشخیص پاسخ ناتمام «**تح» و ادامه تولید دقیق از محل توقف بدون تکرار متن قبلی): موفق');

    // 8. Test 8: Session history persistence & in-place message continuation update
    const createdSession = await aiSessionService.createSession(adminUser, 'تست پایداری و ادامه پاسخ');
    const savedUserMsg = await aiSessionService.appendMessage(createdSession.id, adminUser, {
      role: 'user',
      content: 'تحلیل سلامت پرسنل 11287',
    });
    assert.ok(savedUserMsg.id);
    const assistantMsgId = `msg-cont-${Date.now()}`;
    await aiSessionService.appendMessage(createdSession.id, adminUser, {
      id: assistantMsgId,
      role: 'assistant',
      content: cleanedCutoffText,
      model: 'qwen2.5:7b',
    });
    // Upsert continuation into the same message ID
    await aiSessionService.appendMessage(createdSession.id, adminUser, {
      id: assistantMsgId,
      role: 'assistant',
      content: mergedContinuation,
      model: 'qwen2.5:7b',
    });
    const historyMessages = await aiSessionService.getMessages(createdSession.id, adminUser);
    const persistedAssistantMsgs = historyMessages.filter(m => m.id === assistantMsgId);
    assert.equal(persistedAssistantMsgs.length, 1, 'پیام ادامه یافته باید در همان حباب قبلی ذخیره شود و تکراری نسازد.');
    assert.equal(persistedAssistantMsgs[0].content, mergedContinuation);
    await aiSessionService.deleteSession(createdSession.id, adminUser);
    console.log('✅ تست ۸ (حفظ تاریخچه گفتگو و بروزرسانی یکپارچه پیام ادامه‌یافته در پایگاه داده): موفق');

    // 9. Test 9: RAM, CPU & Ollama inference parameter stability audit
    const sentPayload = mockServer.lastRequestPayload();
    assert.equal(sentPayload?.options?.repeat_penalty, 1.06, 'repeat_penalty باید روی 1.06 تنظیم شود تا توکن‌های فارسی تخریب نشوند.');
    assert.equal(sentPayload?.options?.repeat_last_n, 64, 'repeat_last_n باید روی 64 تنظیم شود.');
    assert.equal(sentPayload?.options?.num_batch, 512, 'num_batch باید روی 512 تنظیم شود.');
    assert.ok(sentPayload?.options?.num_thread >= 2, 'num_thread باید متناسب با هسته‌های پردازنده تنظیم شود.');
    const safeCtx = AIMemoryEstimator.getSafeContextTokens('qwen2.5:7b', 4096);
    assert.ok(safeCtx >= 1024 && safeCtx <= 4096, `محاسبه ضد-OOM کانتکست (${safeCtx}) باید در محدوده ایمن RAM باشد.`);
    console.log(
      `✅ تست ۹ (پایداری مصرف RAM/CPU و پارامترهای بهینه Ollama: repeat_penalty=${sentPayload?.options?.repeat_penalty}, num_thread=${sentPayload?.options?.num_thread}, safeCtx=${safeCtx}): موفق`
    );

    console.log('\n🎯 تمامی ۹ سناریوی ممیزی و پذیرش نهایی با موفقیت ۱۰۰٪ 통과 شدند.');
  } finally {
    await mockServer.close();
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ خطا در تست‌های بهینه‌سازی استریم:', err);
    process.exit(1);
  });
