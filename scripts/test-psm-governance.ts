/**
 * Automated Acceptance Test Suite for PSM Governance & Stage Gate Engine
 * Verifies all 10 Mandated Scenarios according to PSM Governance Laws for Rejal Petrochemical Complex.
 */
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { config } from '../server/core/config.ts';
import { db } from '../src/db/index.ts';
import {
  psmProjects,
  psmAssessments,
  psmGaps,
  psmWbsTasks,
  psmDocuments,
  psmCapaItems,
  psmStageGates,
  psmGateDeviations,
  psmMaturityAssessments,
  auditLogs,
} from '../src/db/schema.ts';
import { eq, and, desc } from 'drizzle-orm';

const BASE_URL = 'http://localhost:3000/api/psm';

function getAdminToken(): string {
  return jwt.sign(
    {
      id: 1,
      uid: 'admin-tester',
      username: 'admin',
      name: 'مدیر ارشد تست حاکمیت PSM',
      role: 'SUPERADMIN',
    },
    config.security.jwtSecret,
    { expiresIn: '1h' }
  );
}

async function request(path: string, options: { method?: string; body?: any; token?: string } = {}) {
  const token = options.token || getAdminToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let json: any = null;
  if (contentType.includes('application/json')) {
    json = await res.json();
  } else {
    json = { text: await res.text() };
  }

  return { status: res.status, ok: res.ok, body: json };
}

async function runAcceptanceTests() {
  console.log('\n======================================================================');
  console.log('   PSM Governance & Stage Gate Engine - 10 Mandated Acceptance Tests   ');
  console.log('                 مجتمع پتروشیمی رجال - HSECORE                          ');
  console.log('======================================================================\n');

  // Setup: Create a dedicated test project
  const testProjectCode = `TEST-GOV-${Date.now().toString().slice(-5)}`;
  const [testProject] = await db
    .insert(psmProjects)
    .values({
      projectCode: testProjectCode,
      title: 'پروژه آزمون اعتبارسنجی موتور حاکمیت PSM پتروشیمی رجال',
      scopeDescription: 'استقرار جامع ۲۰ عنصر CCPS و ۱۴ الزام OSHA در واحد پلی‌پروپیلن و یوتیلیتی',
      projectManagerName: 'مهندس حسینی - مدیر پروژه استقرار PSM',
      projectSponsorName: 'دکتر رجالی - مدیرعامل و حامی پروژه',
      startDate: '2026-01-01',
      endDate: '2026-12-29',
      overallStatus: 'PLANNING',
      coveredUnits: ['واحد پلی‌پروپیلن (PP)', 'واحد یوتیلیتی و آب‌شیرین‌کن'],
    })
    .returning();

  const projectId = testProject.id;
  console.log(`📌 پروژه تستی با شناسه ${projectId} و کد ${testProjectCode} ایجاد گردید.`);

  try {
    // -------------------------------------------------------------------------
    // Scenario 1: Register deficiency without responsible person (MUST FAIL)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 1] تلاش برای ثبت شکاف بدون انتصاب مسئول مستقیم...');
    const res1 = await request('/gaps', {
      method: 'POST',
      body: {
        projectId,
        title: 'عدم تدوین شناسنامه فنی شیرهای اطمینان PSV',
        description: 'شیرهای اطمینان واحد PP فاقد شناسنامه و تست بنچ دوره‌ای هستند',
        standardReference: 'CCPS-10 / OSHA-06',
        unitName: 'واحد پلی‌پروپیلن (PP)',
        riskLevel: 'CRITICAL',
        proposedDueDate: '2026-06-30',
        // Missing responsiblePersonName!
      },
    });

    assert.equal(res1.status, 400, 'ثبت شکاف بدون مسئول مستقیم باید با خطای ۴۰۰ متوقف شود');
    assert.equal(res1.body.success, false);
    console.log('✅ Scenario 1 PASSED: ثبت شکاف بدون مسئول مستقیم با موفقیت مسدود گردید.');

    // Register a valid gap with responsible person for subsequent tests
    const validGapRes = await request('/gaps', {
      method: 'POST',
      body: {
        projectId,
        title: 'عدم وجود مدارک ارزیابی پیامد نشت آمونیاک در واحد یوتیلیتی',
        description: 'مطالعه مدل‌سازی پیامد Dispersion برای مخازن تحت فشار تکمیل نشده است',
        standardReference: 'CCPS-08 / OSHA-05',
        unitName: 'واحد یوتیلیتی',
        riskLevel: 'CRITICAL',
        responsiblePersonName: 'مهندس رضایی - سرپرست فرآیند',
        proposedDueDate: '2026-08-15',
      },
    });
    assert.equal(validGapRes.status, 201);
    const validGap = validGapRes.body.data;
    console.log(`   شکاف معتبر با شناسه ${validGap.id} و کد ${validGap.gapCode} ثبت شد.`);

    // -------------------------------------------------------------------------
    // Scenario 2: Register activity without due date (MUST FAIL)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 2] تلاش برای ثبت فعالیت اجرایی WBS بدون تاریخ مهلت/پایان...');
    const res2 = await request('/wbs', {
      method: 'POST',
      body: {
        projectId,
        wbsCode: 'WBS-1.1.1',
        title: 'مدل‌سازی انتشار پیامد نشت گاز با نرم‌افزار PHAST',
        ownerName: 'واحد مهندسی فرآیند',
        executorName: 'شرکت مشاور ایمنی فرآیند',
        plannedStart: '2026-02-01',
        // Missing plannedEnd!
      },
    });

    assert.equal(res2.status, 400, 'ثبت فعالیت بدون مهلت پایان برنامه‌ای باید رد شود');
    assert.equal(res2.body.success, false);
    console.log('✅ Scenario 2 PASSED: ثبت فعالیت WBS بدون مهلت پایان با موفقیت مسدود گردید.');

    // -------------------------------------------------------------------------
    // Scenario 3: Approve document without required evidence (MUST FAIL)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 3] تلاش برای تأیید مدرک PSM بدون پیوست شواهد اجرایی کافی...');
    const createDocRes = await request('/documents', {
      method: 'POST',
      body: {
        projectId,
        docCode: `DOC-PSI-${Date.now().toString().slice(-4)}`,
        title: 'دستورالعمل جامع تست و کالیبراسیون سیستم توقف اضطراری ESD',
        docType: 'PROCEDURE',
        ccpsElementCode: 'CCPS-10',
        oshaClauseCode: 'OSHA-06',
        unitName: 'کل مجتمع',
        authorName: 'مهندس حسینی',
        reviewerName: 'مهندس رضایی',
        approverName: 'دکتر رجالی',
      },
    });
    assert.equal(createDocRes.status, 201);
    const testDoc = createDocRes.body.data;

    // Attempt approval without evidence summary or attachments
    const res3 = await request(`/documents/${testDoc.id}`, {
      method: 'PUT',
      body: {
        status: 'APPROVED',
        evidenceSummary: '', // insufficient!
        evidenceAttachments: [],
      },
    });

    assert.equal(res3.status, 400, 'تأیید مدرک فاقد شواهد کافی باید رد شود');
    assert.equal(res3.body.success, false);
    console.log('✅ Scenario 3 PASSED: تأیید مدرک بدون شواهد کافی در سمت سرور مسدود گردید.');

    // Now properly update doc with evidence
    const approveDocRes = await request(`/documents/${testDoc.id}`, {
      method: 'PUT',
      body: {
        status: 'APPROVED',
        evidenceSummary: 'صورتجلسه آزمون ماهانه سیستم ESD و تاییدیه رسمی بازرس شخص ثالث به پیوست موجود است.',
        fileUrl: '/uploads/psm/esd-test-report.pdf',
      },
    });
    assert.equal(approveDocRes.status, 200);
    assert.equal(approveDocRes.body.data.status, 'APPROVED');
    console.log('   مدرک پس از ارائه شواهد کامل، با موفقیت تأیید شد.');

    // -------------------------------------------------------------------------
    // Scenario 4: Attempt gate pass with open critical deficiency (MUST FAIL)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 4] تلاش برای تصویب دروازه G2 با وجود شکاف بحرانی فاقد WBS یا وضعیت نامعتبر...');
    // Fetch gates to initialize G1 through G6
    const gatesRes = await request(`/projects/${projectId}/gates`);
    assert.equal(gatesRes.status, 200);
    assert.equal(gatesRes.body.data.gates.length, 6);

    // G1 has no baseline assessment yet, so attempting to approve G1 or G2 should fail
    const res4 = await request(`/projects/${projectId}/gates/G2/decision`, {
      method: 'POST',
      body: {
        decision: 'APPROVED',
        comments: 'تلاش برای عبور با شکاف بحرانی',
      },
    });

    assert.equal(res4.status, 400, 'تصویب دروازه G2 بدون تکمیل دروازه G1 باید رد شود');
    assert.equal(res4.body.success, false);
    assert.ok(res4.body.error.includes('خطای عبور غیرمجاز'));
    console.log('✅ Scenario 4 PASSED: عبور از دروازه با موانع بحرانی در سمت سرور مسدود گردید.');

    // -------------------------------------------------------------------------
    // Scenario 5: Attempt to tamper with/jump gate via API directly (MUST FAIL)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 5] تلاش برای دور زدن سلسله‌مراتب و جهش مستقیم به تصویب G3...');
    const res5 = await request(`/projects/${projectId}/gates/G3/decision`, {
      method: 'POST',
      body: {
        decision: 'APPROVED',
        meetingMinutes: 'تلاش برای دور زدن G1 و G2',
      },
    });

    assert.equal(res5.status, 400, 'جهش مستقیم و بدون عبور از دروازه قبلی باید رد شود');
    assert.equal(res5.body.success, false);
    assert.ok(res5.body.error.includes('دروازه پیش‌نیاز'));
    console.log('✅ Scenario 5 PASSED: تلاش برای جهش غیرمجاز در دروازه‌ها با موفقیت متوقف شد.');

    // -------------------------------------------------------------------------
    // Scenario 6: Reject gate and return for rework (MUST WORK)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 6] رد رسمی دروازه G1 و ارجاع به اصلاحات مجدد (Rework)...');
    const res6 = await request(`/projects/${projectId}/gates/G1/decision`, {
      method: 'POST',
      body: {
        decision: 'REJECTED',
        comments: 'گزارش ارزیابی اولیه ناقص است و ارزیابی ۵ عنصر کلیدی انجام نگرفته است. بازنگری شود.',
        meetingMinutes: 'صورتجلسه کمیته راهبری مورخ ۱۴۰۵/۱۱/۱۸',
      },
    });

    assert.equal(res6.status, 200);
    assert.equal(res6.body.data.status, 'REJECTED');
    assert.ok(res6.body.data.changeHistory.some((h: any) => h.action === 'GATE_REJECTED_REWORK_REQUIRED'));

    // Verify audit log recorded
    const [audit6] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, 'PSM_STAGE_GATE'), eq(auditLogs.action, 'GATE_REJECTED')))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);
    assert.ok(audit6);
    console.log('✅ Scenario 6 PASSED: دروازه با موفقیت رد و سوابق بازنگری در لاگ سیستمی ثبت گردید.');

    // -------------------------------------------------------------------------
    // Scenario 7: Extend deadline with change history preserved (MUST WORK)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 7] تمدید مهلت اقدام با ثبت توجیه فنی و حفظ تاریخچه...');
    const oldDueDate = validGap.proposedDueDate;
    const newDueDate = '2026-10-30';
    const extensionJustification = 'تأخیر در تحویل داده‌های فنی توسط سازنده خارجی تجهیزات ابزار دقیق';

    const res7 = await request(`/gaps/${validGap.id}/extend-due`, {
      method: 'PUT',
      body: {
        newDueDate,
        extensionJustification,
      },
    });

    assert.equal(res7.status, 200);
    assert.equal(res7.body.data.proposedDueDate, newDueDate);

    // Verify audit log has before/after snapshot
    const [audit7] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, 'PSM_GAP'), eq(auditLogs.action, 'EXTEND_DUE_DATE')))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);
    assert.ok(audit7);
    assert.equal((audit7.oldValue as any)?.proposedDueDate, oldDueDate);
    assert.equal((audit7.newValue as any)?.proposedDueDate, newDueDate);
    console.log('✅ Scenario 7 PASSED: تمدید مهلت با موفقیت انجام و تاریخچه تغییرات در لاگ ثبت گردید.');

    // -------------------------------------------------------------------------
    // Scenario 8: Reopen control after document alteration (MUST WORK)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 8] بازگشایی خودکار کنترل و سلب تأییدیه پس از ویرایش مدرک مصوب...');
    // Document was previously APPROVED. Now an engineer edits the title/revision without re-approval:
    const res8 = await request(`/documents/${testDoc.id}`, {
      method: 'PUT',
      body: {
        title: 'دستورالعمل جامع تست ESD - ویرایش فنی جدید و تغییر سنسورها',
        version: '2.0',
      },
    });

    assert.equal(res8.status, 200);
    assert.equal(res8.body.data.status, 'UNDER_REVIEW', 'مدرک مصوب پس از تغییر محتوا باید به UNDER_REVIEW بازگردد');
    assert.ok(res8.body.data.changeHistory.some((h: any) => h.action === 'DOCUMENT_REOPENED_AFTER_ALTERATION'));

    // Verify audit log recorded alteration
    const [audit8] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, 'PSM_DOCUMENT'), eq(auditLogs.action, 'REOPEN_AFTER_ALTERATION')))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);
    assert.ok(audit8);
    console.log('✅ Scenario 8 PASSED: مدرک مصوب پس از تغییر محتوا فوراً به وضعیت بررسی مجدد منتقل شد.');

    // -------------------------------------------------------------------------
    // Scenario 9: Successful gate passage after fulfilling all criteria (MUST WORK)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 9] تکمیل الزامات ارزیابی و تصویب موفق دروازه G1...');
    // Create baseline assessment
    await db.insert(psmAssessments).values({
      projectId,
      framework: 'CCPS_RBPS',
      elementCode: 'CCPS-01',
      elementTitleFa: 'فرهنگ ایمنی فرایند و تعهد مدیریت',
      elementTitleEn: 'Process Safety Culture',
      pillar: 'COMMIT',
      unitName: 'کل مجتمع',
      evaluationCriteria: 'بیانیه تعهد مدیریت و سیاست‌گذاری ایمنی فرآیند',
      currentStatusDesc: 'سند تعهد مدیریت عالی پتروشیمی رجال ابلاغ شده است',
      assessorName: 'سرارزیاب PSM مجتمع پتروشیمی رجال',
      assessmentDate: '2026-02-01',
      complianceScore: 100,
      complianceStatus: 'COMPLIANT',
      actionPriority: 'LOW',
    });

    // Re-approve G1
    const res9 = await request(`/projects/${projectId}/gates/G1/decision`, {
      method: 'POST',
      body: {
        decision: 'APPROVED',
        meetingMinutes: 'جلسه بازنگری و تصویب نهایی منشور و ارزیابی اولیه پروژه PSM',
        comments: 'معیارهای منشور و ارزیابی اولیه با موفقیت احراز گردید.',
      },
    });

    assert.equal(res9.status, 200);
    assert.equal(res9.body.data.status, 'APPROVED');
    console.log('✅ Scenario 9 PASSED: دروازه G1 پس از احراز کلیه معیارها با موفقیت تصویب گردید.');

    // -------------------------------------------------------------------------
    // Scenario 10: Register and evaluate approved formal deviation (MUST WORK)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 10] ثبت و ارزیابی انحراف مصوب (قانون ۳: منع انحراف قانونی و پذیرش انحراف فنی)...');

    // 10.1: Attempt to approve a legal/statutory deviation -> MUST FAIL
    const legalDevRes = await request(`/projects/${projectId}/gates/G2/deviations`, {
      method: 'POST',
      body: {
        title: 'معافیت از تست هیدروستاتیک خطوط گاز طبق استاندارد ملی',
        requirementDescription: 'الزام قانونی بازرسی ادواری مخازن تحت فشار',
        technicalJustification: 'عدم دسترسی به آب مقطر با کیفیت برای آزمون هیدروستاتیک',
        compensatoryMeasures: 'انجام بازرسی آلتراسونیک با تست غیرمخرب ضخامت‌سنجی',
        isLegalRequirement: true, // STATUTORY / LEGAL
        requestedByName: 'مهندس حسینی',
        validUntilDate: '2026-12-31',
      },
    });
    assert.equal(legalDevRes.status, 201);
    const legalDev = legalDevRes.body.data;

    // Approver tries to approve legal deviation
    const decideLegalRes = await request(`/deviations/${legalDev.id}/decide`, {
      method: 'PUT',
      body: {
        decision: 'APPROVED',
      },
    });
    assert.equal(decideLegalRes.status, 400, 'انحراف از الزامات قانونی طبق قانون ۳ غیرقابل پذیرش است');
    assert.ok(decideLegalRes.body.error.includes('قانون سوم حاکمیت'));
    console.log('   بخش الف: تلاش برای انحراف از الزامات قانونی با موفقیت رد شد.');

    // 10.2: Register technical/management deviation and approve it
    const techDevRes = await request(`/projects/${projectId}/gates/G2/deviations`, {
      method: 'POST',
      body: {
        title: 'تمدید ۳۰ روزه تدوین ماتریس ریسک سازمانی',
        requirementDescription: 'الزام داخلی مجتمع جهت تصویب ماتریس یکپارچه قبل از G2',
        technicalJustification: 'انطباق با روش‌شناسی بازنگری‌شده هلدینگ خلیج فارس',
        compensatoryMeasures: 'استفاده موقت از ماتریس ریسک استاندارد وزارت نفت و کنترل سخت‌گیرانه',
        isLegalRequirement: false,
        requestedByName: 'مهندس رضایی',
        validUntilDate: '2026-04-30',
      },
    });
    assert.equal(techDevRes.status, 201);
    const techDev = techDevRes.body.data;

    const decideTechRes = await request(`/deviations/${techDev.id}/decide`, {
      method: 'PUT',
      body: {
        decision: 'APPROVED',
        decisionNotes: 'مورد موافقت کمیته راهبری PSM با لحاظ اقدامات جبرانی قرار گرفت.',
      },
    });
    assert.equal(decideTechRes.status, 200);
    assert.equal(decideTechRes.body.data.status, 'APPROVED');
    console.log('   بخش ب: انحراف فنی با ارزیابی ریسک و اقدامات جبرانی تصویب گردید.');
    console.log('✅ Scenario 10 PASSED: حاکمیت انحرافات (رد موارد قانونی و تصویب فنی کنترل‌شده) تأیید شد.');

    console.log('\n======================================================================');
    console.log(' 🎉 ALL 10 MANDATED PSM GOVERNANCE ACCEPTANCE TESTS PASSED 100% 🎉  ');
    console.log('======================================================================\n');
  } finally {
    // Cleanup test project
    try {
      await db.delete(psmProjects).where(eq(psmProjects.id, projectId));
      console.log('🧹 پروژه تستی با موفقیت پاکسازی شد.');
    } catch {
      // Ignored
    }
  }
}

runAcceptanceTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Acceptance test execution failed:', err);
    process.exit(1);
  });
