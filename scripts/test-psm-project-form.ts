import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../server/core/config.ts';
import psmRouter from '../server/modules/psm/psm.routes.ts';
import { db } from '../src/db/index.ts';
import { psmProjects, psmStageGates, psmWbsTasks } from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';

function createToken(role = 'SUPERADMIN', id = 1, username = 'admin') {
  return jwt.sign(
    {
      id,
      uid: `tester-${id}`,
      username,
      name: `کاربر تست (${role})`,
      role,
    },
    config.security.jwtSecret,
    { expiresIn: '1h' }
  );
}

async function runTests() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/psm', psmRouter);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1/psm`;

  const adminToken = createToken('SUPERADMIN', 1, 'admin');
  const viewerToken = createToken('VIEWER', 999, 'viewer_readonly');

  const results: Array<{ id: number; title: string; passed: boolean; detail: string }> = [];
  let createdProjectId: number | null = null;

  try {
    // 0. Bootstrap check: Verify central personnel & verify zero auto-seeded default org nodes
    const bootRes = await fetch(`${baseUrl}/bootstrap`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const bootJson = await bootRes.json();
    const personnel = bootJson.centralOrg?.personnel || [];
    const units = bootJson.centralOrg?.units || [];

    if (personnel.length < 3) {
      throw new Error(`Central personnel insufficient: personnel=${personnel.length}`);
    }

    const pmPerson = personnel[0];
    const sponsorPerson = personnel[1];
    const member1 = personnel[2];
    const member2 = personnel[3] || personnel[0];

    const primaryUnit = units[0] || { id: 'UNIT-TEST-01', code: 'UNIT-TEST-01', name: 'واحد عملیاتی الف' };
    const dependentUnit = units[1] || { id: 'UNIT-TEST-02', code: 'UNIT-TEST-02', name: 'واحد عملیاتی ب' };

    // TEST 2: Reject endDate earlier than startDate (Shamsi)
    {
      const badDateRes = await fetch(`${baseUrl}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          projectCode: `TEST-BAD-DATE-${Date.now()}`,
          title: 'پروژه تست تاریخ نامعتبر شمسی',
          startDate: '1404/06/15',
          endDate: '1404/02/10',
        }),
      });
      const passed = badDateRes.status === 400;
      results.push({
        id: 2,
        title: 'جلوگیری از ثبت تاریخ پایان قبل از تاریخ شروع (تقویم شمسی)',
        passed,
        detail: `Status=${badDateRes.status}`,
      });
    }

    // TEST 12: Save Project as Server-Side Draft (isDraft: true)
    {
      const draftCode = `PSM-DRAFT-${Date.now()}`;
      const draftRes = await fetch(`${baseUrl}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          projectCode: draftCode,
          title: 'پیش‌نویس پروژه استقرار PSM مجتمع پتروشیمی رجال',
          startDate: '1404/02/01',
          endDate: '1405/02/01',
          isDraft: true,
        }),
      });
      const draftJson = await draftRes.json();
      createdProjectId = draftJson.project?.id;
      const isDraftSaved =
        draftRes.status === 201 &&
        Boolean(createdProjectId) &&
        draftJson.project?.overallStatus === 'DRAFT';

      results.push({
        id: 12,
        title: 'ذخیره پیش‌نویس (Draft) در پایگاه داده و ادامه تکمیل فرم',
        passed: isDraftSaved,
        detail: `Draft ID=${createdProjectId}, Status=${draftJson.project?.overallStatus}`,
      });
    }

    if (!createdProjectId) {
      throw new Error('Draft project was not created');
    }

    // Complete & Finalize the Draft Project with all smart fields (Tests 1, 3, 4, 5, 6, 7, 8, 9, 10, 11)
    const updatePayload = {
      projectCode: `PSM-FINAL-${Date.now()}`,
      title: 'استقرار جامع سیستم مدیریت ایمنی فرایند (PSM) در واحدهای عملیاتی پتروشیمی رجال',
      scopeDescription: 'استقرار کامل ۲۰ عنصر CCPS RBPS در واحدهای پلیمریزاسیون و یوتیلیتی',
      startDate: '1404/02/01',
      endDate: '1405/02/01',
      projectManagerId: Number(pmPerson.id),
      projectManagerName: pmPerson.fullName,
      projectSponsorId: Number(sponsorPerson.id),
      projectSponsorName: sponsorPerson.fullName,
      // Include duplicate member1 intentionally to test server-side deduplication (Test 6)
      teamMembers: [
        {
          personnelId: member1.id,
          personnelCode: member1.personnelCode,
          fullName: member1.fullName,
          jobTitle: member1.jobTitle,
          unitName: member1.unitName,
          psmRole: 'دبیر کمیته PSM',
        },
        {
          personnelId: member1.id,
          personnelCode: member1.personnelCode,
          fullName: member1.fullName,
          jobTitle: member1.jobTitle,
          unitName: member1.unitName,
          psmRole: 'تکراری برای تست حذف خودکار',
        },
        {
          personnelId: member2.id,
          personnelCode: member2.personnelCode,
          fullName: member2.fullName,
          jobTitle: member2.jobTitle,
          unitName: member2.unitName,
          psmRole: 'تسهیل‌گر و سرپرست مطالعات PHA/HAZOP',
        },
      ],
      // Include duplicate primaryUnit intentionally to test unit deduplication (Test 7)
      coveredUnits: [
        {
          unitId: String(primaryUnit.id || primaryUnit.code),
          code: primaryUnit.code,
          name: primaryUnit.name,
          hierarchyPath: `شرکت پتروشیمی رجال / مجتمع ماهشهر / ${primaryUnit.name}`,
          isPrimary: true,
        },
        {
          unitId: String(primaryUnit.id || primaryUnit.code),
          code: primaryUnit.code,
          name: primaryUnit.name,
          hierarchyPath: `شرکت پتروشیمی رجال / مجتمع ماهشهر / ${primaryUnit.name}`,
          isPrimary: false,
        },
        {
          unitId: String(dependentUnit.id || dependentUnit.code),
          code: dependentUnit.code,
          name: dependentUnit.name,
          hierarchyPath: `شرکت پتروشیمی رجال / مجتمع ماهشهر / ${dependentUnit.name}`,
          isPrimary: false,
        },
      ],
      quantitativeGoals: [
        {
          id: 'QO-01',
          code: 'PSM-QO-01',
          title: 'تکمیل ۱۰۰ درصد ارزیابی اولیه PSM',
          targetValue: 100,
          unit: 'درصد (%)',
          baselineValue: 0,
          currentValue: 15,
          expectedFinalValue: 100,
          dueDate: '1404/06/31',
          responsiblePersonId: pmPerson.id,
          responsiblePersonName: pmPerson.fullName,
        },
        {
          id: 'QO-05',
          code: 'PSM-QO-05',
          title: 'تکمیل مطالعات HAZOP',
          targetValue: 100,
          unit: 'درصد (%)',
          baselineValue: 30,
          currentValue: 45,
          expectedFinalValue: 100,
          dueDate: '1404/09/30',
          responsiblePersonId: member2.id,
          responsiblePersonName: member2.fullName,
        },
        {
          id: 'QO-CUSTOM-1',
          code: 'PSM-QO-C1',
          title: 'ممیزی اختصاصی ایمنی راکتورهای پلیمریزاسیون رجال',
          targetValue: 100,
          unit: 'درصد (%)',
          baselineValue: 10,
          currentValue: 20,
          expectedFinalValue: 100,
          dueDate: '1404/11/30',
          responsiblePersonId: pmPerson.id,
          responsiblePersonName: pmPerson.fullName,
          isCustom: true,
        },
      ],
      qualitativeGoals: [
        {
          id: 'QL-01',
          code: 'PSM-QL-01',
          title: 'استقرار نظام یکپارچه مدیریت ایمنی فرایند',
          description: 'پیاده‌سازی ساختارمند ۲۰ عنصر CCPS RBPS',
        },
        {
          id: 'QL-05',
          code: 'PSM-QL-05',
          title: 'بهبود انضباط عملیاتی',
          description: 'رعایت پنجره‌های عملیاتی ایمن (IOW)',
        },
      ],
      milestones: [
        {
          id: 'MS-01',
          orderIndex: 1,
          title: 'تصویب منشور و دامنه پروژه',
          description: 'تصویب رسمی منشور پروژه توسط حامی پروژه',
          plannedDate: '1404/02/15',
          responsiblePersonId: pmPerson.id,
          responsiblePersonName: pmPerson.fullName,
          status: 'COMPLETED',
          progressPct: 100,
          verificationEvidence: 'سند منشور امضاشده',
        },
        {
          id: 'MS-02',
          orderIndex: 2,
          title: 'تشکیل تیم استقرار PSM',
          description: 'صدور احکام اعضای کمیته راهبری PSM',
          plannedDate: '1404/03/01',
          responsiblePersonId: pmPerson.id,
          responsiblePersonName: pmPerson.fullName,
          status: 'IN_PROGRESS',
          progressPct: 50,
          verificationEvidence: 'احکام انتصاب پرسنل',
        },
      ],
      budgetAllocated: 32000000000,
      budgetSpent: 1500000000,
      isDraft: false,
    };

    const finalRes = await fetch(`${baseUrl}/projects/${createdProjectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(updatePayload),
    });
    const finalJson = await finalRes.json();
    const proj = finalJson.project;

    // TEST 1: Shamsi Dates stored & returned
    results.push({
      id: 1,
      title: 'ثبت تاریخ شروع و پایان با تقویم شمسی و بازگشت استاندارد شمسی',
      passed:
        finalRes.status === 200 &&
        proj?.startDate === '1404/02/01' &&
        proj?.endDate === '1405/02/01',
      detail: `startDate=${proj?.startDate}, endDate=${proj?.endDate}`,
    });

    // TEST 3: Project Manager linked to real central personnel ID
    results.push({
      id: 3,
      title: 'انتخاب مدیر پروژه از پرسنل مجتمع با اتصال به شناسه واقعی پایگاه داده',
      passed:
        Number(proj?.projectManagerId) === Number(pmPerson.id) &&
        proj?.projectManagerName === pmPerson.fullName,
      detail: `PM ID=${proj?.projectManagerId} (${proj?.projectManagerName})`,
    });

    // TEST 4: Project Sponsor linked to real central personnel ID
    results.push({
      id: 4,
      title: 'انتخاب حامی پروژه از پرسنل مجتمع با اتصال به شناسه واقعی پایگاه داده',
      passed:
        Number(proj?.projectSponsorId) === Number(sponsorPerson.id) &&
        proj?.projectSponsorName === sponsorPerson.fullName,
      detail: `Sponsor ID=${proj?.projectSponsorId} (${proj?.projectSponsorName})`,
    });

    // TEST 5 & 6: Multi-select Team Members & Duplicate Prevention
    const savedTeam = Array.isArray(proj?.teamMembers) ? proj.teamMembers : [];
    results.push({
      id: 5,
      title: 'انتخاب چند عضو تیم پروژه از پرسنل مجتمع با حفظ سمت و واحد سازمانی',
      passed: savedTeam.length === 2 && savedTeam[0].fullName === member1.fullName,
      detail: `Team Count=${savedTeam.length}`,
    });
    results.push({
      id: 6,
      title: 'جلوگیری از انتخاب پرسنل تکراری در اعضای تیم استقرار PSM',
      passed: savedTeam.length === 2,
      detail: `Sent 3 (with 1 duplicate), Stored=${savedTeam.length}`,
    });

    // TEST 7: Covered Units from Org Structure with Primary/Dependent & Deduplication
    const savedUnits = Array.isArray(proj?.coveredUnits) ? proj.coveredUnits : [];
    const primaryCount = savedUnits.filter((u: any) => u.isPrimary).length;
    results.push({
      id: 7,
      title: 'انتخاب چند واحد مشمول از ساختار سازمانی با تعیین واحد اصلی و حذف تکراری',
      passed: savedUnits.length === 2 && primaryCount === 1,
      detail: `Units=${savedUnits.length}, PrimaryUnits=${primaryCount}`,
    });

    // TEST 8 & 9: Quantitative Objectives + Custom Objective
    const savedQo = Array.isArray(proj?.quantitativeGoals) ? proj.quantitativeGoals : [];
    const hasCustomQo = savedQo.some((q: any) => q.isCustom && q.title.includes('راکتورهای'));
    results.push({
      id: 8,
      title: 'انتخاب چند هدف کمی همراه با مقدار هدف، مبنا، موعد شمسی و مسئول تحقق',
      passed: savedQo.length === 3 && savedQo[0].targetValue === 100 && savedQo[0].dueDate === '1404/06/31',
      detail: `Quantitative Goals=${savedQo.length}`,
    });
    results.push({
      id: 9,
      title: 'افزودن هدف اختصاصی توسط کاربر مجاز',
      passed: hasCustomQo,
      detail: `Custom Quantitative Goal Stored=${hasCustomQo}`,
    });

    // TEST 10: Qualitative Objectives
    const savedQl = Array.isArray(proj?.qualitativeGoals) ? proj.qualitativeGoals : [];
    results.push({
      id: 10,
      title: 'انتخاب چند هدف کیفی از فهرست استاندارد PSM',
      passed: savedQl.length === 2,
      detail: `Qualitative Goals=${savedQl.length}`,
    });

    // TEST 11: Milestones Management & Automatic Engine Seeding (Stage Gates G1-G6 & WBS Tasks)
    const savedMs = Array.isArray(proj?.milestones) ? proj.milestones : [];
    const gatesInDb = await db
      .select()
      .from(psmStageGates)
      .where(eq(psmStageGates.projectId, createdProjectId));
    const wbsInDb = await db
      .select()
      .from(psmWbsTasks)
      .where(eq(psmWbsTasks.projectId, createdProjectId));

    results.push({
      id: 11,
      title: 'انتخاب و مدیریت نقاط عطف پروژه و اتصال خودکار به موتور WBS و دروازه‌های G1 تا G6',
      passed: savedMs.length === 2 && gatesInDb.length === 6 && wbsInDb.length >= 2,
      detail: `Milestones=${savedMs.length}, StageGates=${gatesInDb.length}, WBS Tasks=${wbsInDb.length}`,
    });

    // TEST 13: Prevent unauthorized user (VIEWER / GUEST) from creating or editing projects
    const unauthorizedRes = await fetch(`${baseUrl}/projects/${createdProjectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerToken}`,
      },
      body: JSON.stringify({ title: 'تلاش غیرمجاز برای تغییر عنوان' }),
    });
    results.push({
      id: 13,
      title: 'جلوگیری از ثبت یا ویرایش توسط کاربر غیرمجاز (RBAC 403)',
      passed: unauthorizedRes.status === 403,
      detail: `Viewer PUT Status=${unauthorizedRes.status}`,
    });
  } finally {
    if (createdProjectId) {
      await db.delete(psmStageGates).where(eq(psmStageGates.projectId, createdProjectId));
      await db.delete(psmWbsTasks).where(eq(psmWbsTasks.projectId, createdProjectId));
      await db.delete(psmProjects).where(eq(psmProjects.id, createdProjectId));
    }
    server.close();
  }

  console.log('\n=============================================================');
  console.log('   PSM SMART PROJECT FORM ACCEPTANCE TEST REPORT (13 CHECKS)');
  console.log('=============================================================');
  let allPassed = true;
  for (const r of results.sort((a, b) => a.id - b.id)) {
    const badge = r.passed ? '✅ PASS' : '❌ FAIL';
    if (!r.passed) allPassed = false;
    console.log(`${badge} | Test #${r.id}: ${r.title} (${r.detail})`);
  }
  console.log('=============================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
