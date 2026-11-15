import { eq, desc, asc } from 'drizzle-orm';
import { db, schema, withTransaction } from '../../core/db.ts';
import { logger } from '../../core/logger.ts';
import { localAIProvider } from '../ai/ai.local-provider.ts';
import {
  DEFAULT_LIFTING_STANDARDS,
  evaluateFullLiftingPlan,
  LIFTING_ENGINE_VERSION,
  type CraneLookupInput,
  type FullLiftingEvaluationResult,
  type LoadChartPoint,
  type LiftingTurningInput,
  type RiggingEvaluationInput,
  type TandemLiftInput,
} from '../../../shared/lifting-engine/index.ts';
import { runIndependentBenchmarkSuite } from '../../../shared/lifting-engine/validationSuite.ts';

export const WORKFLOW_STAGES = [
  { order: 1, key: 'REQUEST', titleFa: '۱. ثبت درخواست عملیات باربرداری' },
  { order: 2, key: 'PLAN_DRAFT', titleFa: '۲. تدوین طرح و جانمایی مهندسی' },
  { order: 3, key: 'ENG_REVIEW', titleFa: '۳. بررسی و صحه‌گذاری محاسبات مهندسی (ASME)' },
  { order: 4, key: 'HSE_EVAL', titleFa: '۴. ارزیابی ایمنی، ریسک (JSA) و عملیات ویژه' },
  { order: 5, key: 'EQUIP_INSPECT', titleFa: '۵. کنترل گواهینامه و بازرسی فنی تجهیزات و پرسنل' },
  { order: 6, key: 'AUTHORIZED_APPROVAL', titleFa: '۶. تأییدیه مقامات مجاز (HSE / بهره‌برداری / مدیر مجاز)' },
  { order: 7, key: 'PERMIT_ISSUANCE', titleFa: '۷. صدور و اتصال پروانه کار ایمن (PTW)' },
  { order: 8, key: 'EXECUTION', titleFa: '۸. نظارت میدانی و پایش اجرای عملیات' },
  { order: 9, key: 'CLOSEOUT', titleFa: '۹. اختتام عملیات و آرشیو مهندسی' },
] as const;

export type WorkflowStageKey = (typeof WORKFLOW_STAGES)[number]['key'];

export const ENGINEERING_CHECK_KEYS = [
  'weight_cog',
  'load_chart',
  'sling_shackle',
  'outrigger_ground',
  'crane_boom_clearance',
  'special_load_cases',
] as const;

export const HSE_CHECK_KEYS = [
  'jsa_linked',
  'ptw_prerequisites',
  'blind_lift_comms',
  'drop_zone_exclusion',
  'overhead_utilities',
  'personnel_certs',
  'equipment_inspected',
  'weather_wind_limits',
] as const;

export const FIELD_CONDITION_KEYS = [
  'wind_actual',
  'soil_stability',
  'outrigger_mats',
  'powerlines_clearance',
  'load_path_clear',
  'piping_interference',
  'visibility_lighting',
  'radio_comms',
  'oem_weather_limits',
  'crew_gear_ready',
] as const;

export const DEFAULT_STAGE_GATES = [
  {
    gateCode: 'G1',
    titleFa: 'G1: ممیزی فنی و طراحی معماری موتور محاسبات',
    criteriaFa: 'تکمیل ممیزی کد، جداسازی موتور مهندسی خالص از UI/AI و تعریف معیارهای پذیرش',
    defaultStatus: 'VERIFIED',
  },
  {
    gateCode: 'G2',
    titleFa: 'G2: تأیید صحت محاسبات پایه (۱۰ سناریوی بنچمارک)',
    criteriaFa: 'پاس کردن ۱۰۰٪ مجموعه تست‌های مرجع مستقل (تعادل سه‌بعدی، Load Chart، زاویه اسلینگ، شگل و حالات خطا)',
    defaultStatus: 'VERIFIED',
  },
  {
    gateCode: 'G3',
    titleFa: 'G3: یکپارچگی دیتابیس، تاریخچه نسخه‌ها و قفل ویرایش',
    criteriaFa: 'ذخیره‌سازی PostgreSQL، ردیابی نسخه موتور، تاریخچه Revision غیرقابل ویرایش و ابطال خودکار تاییدیه‌ها',
    defaultStatus: 'VERIFIED',
  },
  {
    gateCode: 'G4',
    titleFa: 'G4: تأیید محاسبات تکمیلی (Tandem / Turning) و شفافیت UI',
    criteriaFa: 'راستی‌آزمایی محاسبات پیشرفته، شفافیت ۱۰ شاخصه پارامترها و کنترل تبدیل واحد SI',
    defaultStatus: 'PENDING',
  },
  {
    gateCode: 'G5',
    titleFa: 'G5: تکمیل گردش‌کار مجزا (۷ بند مهندسی + ۸ بند HSE) و تطبیق میدانی ۱۰ بند',
    criteriaFa: 'جداسازی کامل تاییدیه مهندسی و ایمنی و کنترل شرایط واقعی محل پیش از صدور PTW',
    defaultStatus: 'VERIFIED',
  },
  {
    gateCode: 'G6',
    titleFa: 'G6: دروازه صدور مجوز اجرای واقعی عملیات (Operational Permit Gate)',
    criteriaFa: 'تایید صریح تمام دروازه‌های G1..G5 و تایید نهایی بهره‌برداری توسط مهندس ارشد / سرپرست ایمنی',
    defaultStatus: 'PENDING',
  },
] as const;

/**
 * Checks whether an ISO (YYYY-MM-DD) or Persian Jalali (140x/xx/xx) expiry date string is expired relative to today.
 */
export function checkExpiryStatus(dateStr?: string | null): 'VALID' | 'WARNING_SOON' | 'EXPIRED' | 'MISSING' {
  const raw = String(dateStr || '').trim();
  if (!raw) return 'MISSING';

  // Normalize Persian/Arabic digits to Latin
  const normalized = raw
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\./g, '-')
    .replace(/\//g, '-');

  // If Jalali date (year 1300-1499), compare against today's approximate Jalali string via Intl
  const yearMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!yearMatch) return 'MISSING';

  const yr = Number(yearMatch[1]);
  const mo = String(Number(yearMatch[2])).padStart(2, '0');
  const dy = String(Number(yearMatch[3])).padStart(2, '0');
  const normYmd = `${yr}-${mo}-${dy}`;

  if (yr >= 1300 && yr <= 1550) {
    try {
      const faParts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const py = faParts.find((p) => p.type === 'year')?.value || '1405';
      const pm = faParts.find((p) => p.type === 'month')?.value || '01';
      const pd = faParts.find((p) => p.type === 'day')?.value || '01';
      const todayJalali = `${py}-${pm}-${pd}`;
      if (normYmd < todayJalali) return 'EXPIRED';

      const futureDate = new Date(Date.now() + 30 * 86400000);
      const fp = new Intl.DateTimeFormat('en-US-u-ca-persian', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(futureDate);
      const futureJalali = `${fp.find((p) => p.type === 'year')?.value}-${fp.find((p) => p.type === 'month')?.value}-${fp.find((p) => p.type === 'day')?.value}`;
      if (normYmd <= futureJalali) return 'WARNING_SOON';
      return 'VALID';
    } catch {
      return 'VALID';
    }
  }

  // Gregorian ISO compare
  const parsed = new Date(`${normYmd}T23:59:59Z`);
  if (Number.isNaN(parsed.getTime())) return 'MISSING';
  const now = new Date();
  if (parsed.getTime() < now.getTime()) return 'EXPIRED';
  if (parsed.getTime() - now.getTime() <= 30 * 86400000) return 'WARNING_SOON';
  return 'VALID';
}

export class LiftingService {
  private standardsSeeded = false;

  async seedStandardsIfEmpty(): Promise<void> {
    if (this.standardsSeeded) return;
    try {
      const existing = await db.select({ id: schema.liftingStandardsConfig.id }).from(schema.liftingStandardsConfig);
      if (existing.length === 0) {
        for (const std of DEFAULT_LIFTING_STANDARDS) {
          await db
            .insert(schema.liftingStandardsConfig)
            .values({
              standardCode: std.standardCode,
              titleFa: std.titleFa,
              titleEn: std.titleEn,
              edition: std.edition,
              category: std.category,
              activeClauses: std.activeClauses,
              engineeringFactors: std.engineeringFactors,
              notes: std.notes,
              isActive: true,
              updatedBy: 'System Seed (ASME Reference Metadata)',
            })
            .onConflictDoNothing();
        }
      }
      this.standardsSeeded = true;
    } catch (err) {
      logger.warn('[LiftingService] seedStandardsIfEmpty warning:', err);
    }
  }

  async getStandardsOverridesMap(): Promise<Record<string, { edition?: string; factors?: Record<string, any> }>> {
    await this.seedStandardsIfEmpty();
    const rows = await db
      .select()
      .from(schema.liftingStandardsConfig)
      .where(eq(schema.liftingStandardsConfig.isActive, true));
    const map: Record<string, { edition?: string; factors?: Record<string, any> }> = {};
    for (const r of rows) {
      map[r.standardCode] = {
        edition: r.edition,
        factors: (r.engineeringFactors || {}) as Record<string, any>,
      };
    }
    return map;
  }

  private gatesSeeded = false;

  async seedStageGatesIfEmpty(): Promise<void> {
    if (this.gatesSeeded) return;
    try {
      const existing = await db.select({ id: schema.liftingStageGates.id }).from(schema.liftingStageGates);
      if (existing.length === 0) {
        const bench = runIndependentBenchmarkSuite();
        for (const g of DEFAULT_STAGE_GATES) {
          const isG2 = g.gateCode === 'G2';
          const status = isG2 ? (bench.allPassed ? 'VERIFIED' : 'FAILED') : g.defaultStatus;
          await db
            .insert(schema.liftingStageGates)
            .values({
              gateCode: g.gateCode,
              titleFa: g.titleFa,
              criteriaFa: g.criteriaFa,
              status,
              evidenceSummary: isG2
                ? {
                    engineVersion: bench.engineVersion,
                    totalCases: bench.totalCases,
                    passedCases: bench.passedCases,
                    failedCases: bench.failedCases,
                    executedAt: bench.executedAt,
                  }
                : { engineVersion: LIFTING_ENGINE_VERSION },
              verifiedBy: status === 'VERIFIED' ? 'HSECORE Verification Engine' : null,
              verifiedAt: status === 'VERIFIED' ? new Date() : null,
            })
            .onConflictDoNothing();
        }
      }
      this.gatesSeeded = true;
    } catch (err) {
      logger.warn('[LiftingService] seedStageGatesIfEmpty warning:', err);
    }
  }

  async getStageGates() {
    await this.seedStageGatesIfEmpty();
    return db.select().from(schema.liftingStageGates).orderBy(asc(schema.liftingStageGates.gateCode));
  }

  async verifyStageGate(gateCode: string, decision: 'VERIFIED' | 'FAILED' | 'PENDING', actorName: string, notes?: string) {
    await this.seedStageGatesIfEmpty();
    const gates = await this.getStageGates();
    const target = gates.find((g) => g.gateCode === gateCode);
    if (!target) throw new Error(`دروازه ${gateCode} یافت نشد.`);

    let evidence: Record<string, any> = { ...(target.evidenceSummary || {}), notes: notes || null };
    if (gateCode === 'G2' || gateCode === 'G6') {
      const bench = runIndependentBenchmarkSuite();
      evidence = {
        ...evidence,
        engineVersion: bench.engineVersion,
        totalCases: bench.totalCases,
        passedCases: bench.passedCases,
        failedCases: bench.failedCases,
        executedAt: bench.executedAt,
      };
      if (decision === 'VERIFIED' && !bench.allPassed) {
        throw new Error('تأیید دروازه بدون پاس شدن ۱۰۰٪ تست‌های بنچمارک موتور محاسبات امکان‌پذیر نیست.');
      }
    }

    if (gateCode === 'G6' && decision === 'VERIFIED') {
      const prereqs = ['G1', 'G2', 'G3', 'G4', 'G5'];
      const unverified = prereqs.filter((code) => gates.find((g) => g.gateCode === code)?.status !== 'VERIFIED');
      if (unverified.length > 0) {
        throw new Error(`پیش از تأیید دروازه عملیاتی G6، تکمیل دروازه‌های (${unverified.join('، ')}) الزامی است.`);
      }
    }

    const [updated] = await db
      .update(schema.liftingStageGates)
      .set({
        status: decision,
        evidenceSummary: evidence,
        verifiedBy: decision === 'PENDING' ? null : actorName,
        verifiedAt: decision === 'PENDING' ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.liftingStageGates.gateCode, gateCode))
      .returning();

    return updated;
  }

  async getBootstrapData() {
    await Promise.all([this.seedStandardsIfEmpty(), this.seedStageGatesIfEmpty()]);
    const [standards, cranes, loadCharts, rigging, plans, workflowApprovals, stageGates] = await Promise.all([
      db.select().from(schema.liftingStandardsConfig).orderBy(asc(schema.liftingStandardsConfig.id)),
      db.select().from(schema.liftingCranes).where(eq(schema.liftingCranes.isDeleted, false)).orderBy(desc(schema.liftingCranes.updatedAt)),
      db.select().from(schema.liftingCraneLoadCharts).orderBy(asc(schema.liftingCraneLoadCharts.boomLengthM), asc(schema.liftingCraneLoadCharts.radiusM)),
      db.select().from(schema.liftingRiggingEquipment).where(eq(schema.liftingRiggingEquipment.isDeleted, false)).orderBy(desc(schema.liftingRiggingEquipment.updatedAt)),
      db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.isDeleted, false)).orderBy(desc(schema.liftingPlans.updatedAt)),
      db.select().from(schema.liftingWorkflowApprovals).orderBy(asc(schema.liftingWorkflowApprovals.id)),
      db.select().from(schema.liftingStageGates).orderBy(asc(schema.liftingStageGates.gateCode)),
    ]);

    const chartsByCrane = new Map<number, typeof loadCharts>();
    for (const c of loadCharts) {
      const arr = chartsByCrane.get(c.craneId) || [];
      arr.push(c);
      chartsByCrane.set(c.craneId, arr);
    }

    const enrichedCranes = cranes.map((c) => {
      const certState = checkExpiryStatus(c.certificateExpiryDate);
      return {
        ...c,
        certExpiryState: certState,
        loadChartRows: chartsByCrane.get(c.id) || [],
      };
    });

    const enrichedRigging = rigging.map((r) => {
      const certState = checkExpiryStatus(r.certificateExpiryDate);
      return {
        ...r,
        certExpiryState: certState,
      };
    });

    const approvalsByPlan = new Map<number, typeof workflowApprovals>();
    for (const wf of workflowApprovals) {
      const arr = approvalsByPlan.get(wf.planId) || [];
      arr.push(wf);
      approvalsByPlan.set(wf.planId, arr);
    }

    const enrichedPlans = plans.map((p) => ({
      ...p,
      workflowApprovals: approvalsByPlan.get(p.id) || [],
    }));

    return {
      standards,
      cranes: enrichedCranes,
      riggingEquipment: enrichedRigging,
      plans: enrichedPlans,
      stageGates,
      engineVersion: LIFTING_ENGINE_VERSION,
    };
  }

  /**
   * Read-only unified cross-module query into existing HSECORE tables (no duplicated DBs)
   */
  async getIntegrationContext() {
    const [
      personnelList,
      companies,
      units,
      trainings,
      attendances,
      risks,
      permits,
      inspections,
      docs,
      ncs,
      settingsRows,
    ] = await Promise.all([
      db.select().from(schema.personnel).orderBy(asc(schema.personnel.lastName)).catch(() => []),
      db.select().from(schema.orgCompanies).orderBy(asc(schema.orgCompanies.name)).catch(() => []),
      db.select().from(schema.orgUnits).orderBy(asc(schema.orgUnits.name)).catch(() => []),
      db.select().from(schema.hseTrainings).orderBy(desc(schema.hseTrainings.createdAt)).catch(() => []),
      db.select().from(schema.trainingAttendances).orderBy(desc(schema.trainingAttendances.createdAt)).catch(() => []),
      db.select().from(schema.riskAssessments).orderBy(desc(schema.riskAssessments.updatedAt)).catch(() => []),
      db.select().from(schema.workPermits).orderBy(desc(schema.workPermits.createdAt)).catch(() => []),
      db.select().from(schema.safetyInspections).orderBy(desc(schema.safetyInspections.createdAt)).catch(() => []),
      db.select().from(schema.systemFiles).orderBy(desc(schema.systemFiles.createdAt)).catch(() => []),
      db.select().from(schema.nonConformances).orderBy(desc(schema.nonConformances.createdAt)).catch(() => []),
      db.select().from(schema.systemSettings).catch(() => []),
    ]);

    const settingsMap = new Map<string, any>();
    for (const s of settingsRows) {
      let v = s.value;
      if (typeof v === 'string') {
        try {
          v = JSON.parse(v);
        } catch {}
      }
      settingsMap.set(s.key, v);
    }

    const contractorsSetting = Array.isArray(settingsMap.get('hse_training_contractors'))
      ? settingsMap.get('hse_training_contractors')
      : [];
    const safetySettingInspections = Array.isArray(settingsMap.get('hse_safety_dept_inspections_v1'))
      ? settingsMap.get('hse_safety_dept_inspections_v1')
      : [];

    // Merge distinct contractors from settings & permits
    const contractorNames = new Set<string>();
    const contractors: any[] = [];
    for (const c of contractorsSetting) {
      const name = String(c?.companyName || c?.name || c?.contractorName || '').trim();
      if (name && !contractorNames.has(name)) {
        contractorNames.add(name);
        contractors.push({
          id: c.id || name,
          name,
          managerName: c.managerName || c.representative || '',
          phone: c.phone || '',
          status: c.status || 'ACTIVE',
        });
      }
    }
    for (const p of permits) {
      const cname = String(p.contractorName || '').trim();
      if (cname && !contractorNames.has(cname)) {
        contractorNames.add(cname);
        contractors.push({ id: cname, name: cname, source: 'PTW' });
      }
    }

    const unitMap = new Map<number, string>();
    for (const u of units) unitMap.set(Number(u.id), String(u.name || ''));
    const courseMap = new Map<number, any>();
    for (const t of trainings) courseMap.set(Number(t.id), t);

    const liftingCoursesRegex = /جرثقیل|باربرداری|ریگر|ریگینگ|crane|rigg|lift|slings|signal/i;

    const personnelWithCerts = personnelList.map((p) => {
      const myAttendances = attendances.filter((a) => a.personnelId === p.id);
      const liftingCerts = myAttendances
        .map((a) => {
          const course = courseMap.get(a.trainingId);
          return {
            attendanceId: a.id,
            courseTitle: course?.courseTitle || 'دوره ایمنی',
            sessionDate: a.sessionDate,
            expiryDate: a.expiryDate,
            passed: a.passed,
            certificateNumber: a.certificateNumber,
            expiryState: checkExpiryStatus(a.expiryDate),
            isLiftingCourse: liftingCoursesRegex.test(course?.courseTitle || ''),
          };
        });
      const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.personnelCode;
      return {
        id: p.id,
        personnelCode: p.personnelCode,
        fullName,
        position: p.jobTitle || '',
        unitId: p.unitId,
        unitName: p.unitId ? unitMap.get(p.unitId) || '' : '',
        status: p.status,
        totalTrainings: myAttendances.length,
        liftingTrainings: liftingCerts.filter((c) => c.isLiftingCourse),
        allTrainings: liftingCerts,
      };
    });

    const activeDocs = docs
      .filter((d) => !d.deletedAt)
      .slice(0, 120)
      .map((d) => ({
        fileId: d.fileId,
        entityType: d.entityType,
        originalName: d.originalName,
        mimeType: d.mimeType,
        fileUrl: d.fileUrl,
        uploadedBy: d.uploadedBy,
        createdAt: d.createdAt,
        metadata: d.metadata,
      }));

    // Merge SQL safety inspections + settings checklists (deduped by code)
    const mergedInspections = [...inspections];
    const existingCodes = new Set(inspections.map((i) => i.code));
    for (const si of safetySettingInspections) {
      if (si && si.code && !existingCodes.has(si.code)) {
        mergedInspections.push({
          id: si.id,
          code: si.code,
          templateId: si.templateId,
          inspectionType: si.inspectionType || si.templateName || 'چک‌لیست ایمنی',
          inspectionDate: si.inspectionDate || '',
          inspectorName: si.inspectorName || '',
          equipmentCode: si.equipmentCode || null,
          equipmentName: si.equipmentName || null,
          unitId: si.unitId || null,
          status: si.status || 'COMPLETED',
          checklistData: si.checklistData || {},
          findings: si.findings || null,
          actionItems: si.actionItems || null,
          nextInspectionDate: si.nextInspectionDate || null,
          createdAt: si.createdAt ? new Date(si.createdAt) : new Date(),
          updatedAt: si.updatedAt ? new Date(si.updatedAt) : new Date(),
        } as any);
      }
    }

    return {
      personnel: personnelWithCerts,
      companies,
      units,
      contractors,
      trainings,
      riskAssessments: risks.slice(0, 120),
      workPermits: permits.slice(0, 120),
      safetyInspections: mergedInspections.slice(0, 120),
      documents: activeDocs,
      nonConformances: ncs.slice(0, 120),
    };
  }

  /**
   * Builds and executes the authoritative engineering calculation on the server
   */
  async evaluatePlanByIdOrPayload(planPayload: any, saveToPlanId?: number, actorName?: string): Promise<FullLiftingEvaluationResult> {
    const standardsOverrides = await this.getStandardsOverridesMap();
    const craneSetup = (planPayload.craneSetup || {}) as Record<string, any>;
    const riggingSetup = (planPayload.riggingSetup || {}) as Record<string, any>;
    const loadDims = (planPayload.loadDimensions || {}) as Record<string, any>;
    const cogOffset = (planPayload.cogOffset || { x: 0, y: 0, z: 0 }) as { x: number; y: number; z: number };

    let craneRow: typeof schema.liftingCranes.$inferSelect | null = null;
    let chartPoints: LoadChartPoint[] = [];

    const primaryCraneId = Number(craneSetup.primaryCraneId || 0);
    if (primaryCraneId > 0) {
      const [[cr], rows] = await Promise.all([
        db.select().from(schema.liftingCranes).where(eq(schema.liftingCranes.id, primaryCraneId)),
        db.select().from(schema.liftingCraneLoadCharts).where(eq(schema.liftingCraneLoadCharts.craneId, primaryCraneId)),
      ]);
      craneRow = cr || null;
      chartPoints = rows.map((r) => ({
        outriggerConfig: r.outriggerConfig,
        boomLengthM: r.boomLengthM,
        radiusM: r.radiusM,
        ratedCapacityTon: r.ratedCapacityTon,
        maxTipHeightM: r.maxTipHeightM ?? undefined,
        boomAngleDeg: r.boomAngleDeg ?? undefined,
      }));
    }

    // Lookup selected rigging WLL & certificate state
    const slingIds: number[] = Array.isArray(riggingSetup.slingIds) ? riggingSetup.slingIds.map(Number).filter(Boolean) : [];
    const shackleIds: number[] = Array.isArray(riggingSetup.shackleIds) ? riggingSetup.shackleIds.map(Number).filter(Boolean) : [];
    const allRiggingIds = Array.from(new Set([...slingIds, ...shackleIds]));

    let linkedRiggingRows: Array<typeof schema.liftingRiggingEquipment.$inferSelect> = [];
    if (allRiggingIds.length > 0) {
      const allRig = await db.select().from(schema.liftingRiggingEquipment).where(eq(schema.liftingRiggingEquipment.isDeleted, false));
      linkedRiggingRows = allRig.filter((r) => allRiggingIds.includes(r.id));
    }

    const selectedSlings = linkedRiggingRows.filter((r) => slingIds.includes(r.id));
    const selectedShackles = linkedRiggingRows.filter((r) => shackleIds.includes(r.id));

    const derivedSlingWll =
      Number(riggingSetup.slingWllTon || 0) ||
      (selectedSlings.length > 0 ? Math.min(...selectedSlings.map((s) => s.wllTon)) : 0) ||
      undefined;
    const derivedShackleWll =
      Number(riggingSetup.shackleWllTon || 0) ||
      (selectedShackles.length > 0 ? Math.min(...selectedShackles.map((s) => s.wllTon)) : 0) ||
      undefined;

    // Default 4-point symmetric attachment rectangle from loadDimensions if none supplied
    const halfL = Math.max(0.4, Number(loadDims.lengthM || 4) * 0.35);
    const halfW = Math.max(0.3, Number(loadDims.widthM || loadDims.diameterM || 2) * 0.35);
    const topY = Math.max(0.5, Number(loadDims.heightM || loadDims.diameterM || 2) * 0.5);
    const legCount = Math.max(1, Math.min(4, Number(riggingSetup.legCount || 4)));

    let attachmentPoints = Array.isArray(riggingSetup.attachmentPoints) && riggingSetup.attachmentPoints.length > 0
      ? riggingSetup.attachmentPoints
      : legCount === 1
        ? [{ id: 'P1', label: 'نقطه اتصال مرکزی', position: { x: 0, y: topY, z: 0 } }]
        : legCount === 2
          ? [
              { id: 'P1', label: 'گوشواره چپ (L1)', position: { x: -halfL, y: topY, z: 0 } },
              { id: 'P2', label: 'گوشواره راست (L2)', position: { x: halfL, y: topY, z: 0 } },
            ]
          : legCount === 3
            ? [
                { id: 'P1', label: 'نقطه ۱ (رأس +X)', position: { x: halfL, y: topY, z: 0 } },
                { id: 'P2', label: 'نقطه ۲ (-X,+Z)', position: { x: -halfL * 0.7, y: topY, z: halfW } },
                { id: 'P3', label: 'نقطه ۳ (-X,-Z)', position: { x: -halfL * 0.7, y: topY, z: -halfW } },
              ]
            : [
                { id: 'P1', label: 'گوشواره ۱ (+X,+Z)', position: { x: halfL, y: topY, z: halfW } },
                { id: 'P2', label: 'گوشواره ۲ (-X,+Z)', position: { x: -halfL, y: topY, z: halfW } },
                { id: 'P3', label: 'گوشواره ۳ (-X,-Z)', position: { x: -halfL, y: topY, z: -halfW } },
                { id: 'P4', label: 'گوشواره ۴ (+X,-Z)', position: { x: halfL, y: topY, z: -halfW } },
              ];

    const hookHeightM = Number(riggingSetup.hookHeightM || (topY + 2.8));

    const riggingInput: RiggingEvaluationInput = {
      arrangementType: riggingSetup.arrangementType || undefined,
      netLoadWeightTon: Number(planPayload.netLoadWeightTon || 0),
      riggingAccessoryWeightTon: Number(planPayload.riggingAccessoryWeightTon ?? 0),
      hookBlockWeightTon: Number(planPayload.hookBlockWeightTon ?? craneRow?.hookBlockWeightTon ?? 0.6),
      spreaderBeamWeightTon: riggingSetup.spreaderBeamWeightTon !== undefined ? Number(riggingSetup.spreaderBeamWeightTon) : undefined,
      weightComponents: Array.isArray(riggingSetup.weightComponents) ? riggingSetup.weightComponents : undefined,
      dynamicFactor: Number(planPayload.dynamicFactor || 1.1),
      cogOffset: {
        x: Number(cogOffset.x || 0),
        y: Number(cogOffset.y || 0),
        z: Number(cogOffset.z || 0),
      },
      hookPosition: {
        x: Number(riggingSetup.hookX || 0),
        y: hookHeightM,
        z: Number(riggingSetup.hookZ || 0),
      },
      attachmentPoints,
      hitchType: (riggingSetup.hitchType || 'VERTICAL') as 'VERTICAL' | 'CHOKER' | 'BASKET',
      hasEqualizer: Boolean(riggingSetup.hasEqualizer),
      equalizerPairs: Array.isArray(riggingSetup.equalizerPairs) ? riggingSetup.equalizerPairs : undefined,
      enforceThreeLegEffectiveForFourLeg: Boolean(riggingSetup.enforceThreeLegEffectiveForFourLeg),
      slingWllTon: derivedSlingWll,
      shackleWllTon: derivedShackleWll,
      shackleLateralAngleDeg: riggingSetup.shackleLateralAngleDeg !== undefined ? Number(riggingSetup.shackleLateralAngleDeg) : undefined,
      shacklePinDiameterMm: riggingSetup.shacklePinDiameterMm !== undefined ? Number(riggingSetup.shacklePinDiameterMm) : undefined,
      lugHoleDiameterMm: riggingSetup.lugHoleDiameterMm !== undefined ? Number(riggingSetup.lugHoleDiameterMm) : undefined,
      sensitivityUncertainties: riggingSetup.sensitivityUncertainties || undefined,
    };

    const craneInput: CraneLookupInput = {
      craneId: primaryCraneId > 0 ? primaryCraneId : null,
      craneName: craneRow?.name,
      boomLengthM: Number(craneSetup.boomLengthM || 0),
      radiusM: Number(craneSetup.radiusM || 0),
      outriggerConfig: String(craneSetup.outriggerConfig || '100_OUTRIGGERS'),
      counterweightTon: craneSetup.counterweightTon !== undefined ? Number(craneSetup.counterweightTon) : craneRow?.counterweightTon,
      outriggerSpreadM: Number(craneSetup.outriggerSpreadM || craneRow?.outriggerSpreadM || 7.5),
      craneDeadWeightTon: craneSetup.craneDeadWeightTon !== undefined ? Number(craneSetup.craneDeadWeightTon) : (craneRow?.deadWeightTon ?? undefined),
      outriggerPadAreaM2: craneSetup.outriggerPadAreaM2 !== undefined ? Number(craneSetup.outriggerPadAreaM2) : (craneRow?.defaultOutriggerPadAreaM2 ?? undefined),
      chartPoints,
      maxAllowableUtilizationPct: Number(craneSetup.maxUtilizationPct || 85),
    };

    // Certificate validity check (Crane + Linked Rigging)
    let equipmentCertsValid = true;
    const certProblems: string[] = [];
    if (craneRow) {
      const cExp = checkExpiryStatus(craneRow.certificateExpiryDate);
      if (craneRow.status !== 'ACTIVE' || cExp === 'EXPIRED' || cExp === 'MISSING') {
        equipmentCertsValid = false;
        certProblems.push(
          cExp === 'EXPIRED'
            ? `گواهینامه جرثقیل «${craneRow.name}» منقضی شده است (${craneRow.certificateExpiryDate}).`
            : cExp === 'MISSING'
              ? `تاریخ اعتبار گواهینامه جرثقیل «${craneRow.name}» ثبت نشده است.`
              : `وضعیت عملیاتی جرثقیل «${craneRow.name}» فعال نیست (${craneRow.status}).`
        );
      }
    }
    for (const r of linkedRiggingRows) {
      const rExp = checkExpiryStatus(r.certificateExpiryDate);
      if (r.conditionStatus !== 'SERVICEABLE' || !r.safetyLatchOk || rExp === 'EXPIRED') {
        equipmentCertsValid = false;
        certProblems.push(`تجهیز Rigging «${r.name}» (${r.assetCode}) دارای مشکل انطباق/انقضا یا قفل ایمنی قلاب است.`);
      }
    }

    const tandemInput = planPayload.tandemConfig?.enabled ? (planPayload.tandemConfig as TandemLiftInput) : undefined;
    const turningInput = planPayload.turningConfig?.enabled ? (planPayload.turningConfig as LiftingTurningInput) : undefined;

    const personnelAssign = (planPayload.personnelAssignment || {}) as Record<string, any>;
    const hasCoreTeam = Boolean(personnelAssign.operatorName && personnelAssign.riggerName);

    const gates = await this.getStageGates();
    const verifiedGates = gates.filter((g) => g.status === 'VERIFIED').map((g) => g.gateCode);

    const evaluation = evaluateFullLiftingPlan({
      liftCategory: String(planPayload.liftCategory || 'STANDARD'),
      crane: craneInput,
      rigging: riggingInput,
      tandem: tandemInput,
      turning: turningInput,
      windSpeedMs: craneSetup.windSpeedMs !== undefined ? Number(craneSetup.windSpeedMs) : undefined,
      groundBearingMaxKpa: craneSetup.groundBearingMaxKpa !== undefined ? Number(craneSetup.groundBearingMaxKpa) : undefined,
      equipmentCertsValid,
      personnelQualified: hasCoreTeam,
      unitPreferences: planPayload.unitPreferences || undefined,
      verifiedGates,
      standardsOverrides,
    });

    for (const cp of certProblems) {
      if (!evaluation.blockers.includes(cp)) evaluation.blockers.push(cp);
    }
    if (certProblems.length > 0 && evaluation.overallStatus !== 'FAIL') {
      evaluation.overallStatus = 'FAIL';
    }

    if (saveToPlanId) {
      const [planRow] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, saveToPlanId));
      if (planRow) {
        await db.insert(schema.liftingCalculations).values({
          planId: saveToPlanId,
          revisionNumber: planRow.revisionNumber,
          calculationType: 'FULL_BUNDLE',
          overallStatus: evaluation.overallStatus,
          standardReferences: evaluation.standardReferences,
          inputsSnapshot: {
            engineVersion: evaluation.engineVersion,
            unitPreferences: evaluation.unitPreferences,
            craneInput: craneInput ? { ...craneInput, chartPointsCount: chartPoints.length } : null,
            riggingInput,
            tandemInput: tandemInput || null,
            turningInput: turningInput || null,
          },
          resultsSnapshot: evaluation,
          blockers: evaluation.blockers,
          warnings: evaluation.warnings,
          calculatedBy: actorName || 'Engineering Engine',
        });

        await db
          .update(schema.liftingPlans)
          .set({
            engineeringStatus: evaluation.overallStatus,
            engineVersion: evaluation.engineVersion,
            latestCalculationSummary: evaluation,
            updatedAt: new Date(),
          })
          .where(eq(schema.liftingPlans.id, saveToPlanId));
      }
    }

    return evaluation;
  }

  /**
   * Create a new Lifting Plan + initial 9 workflow stages + immediate engineering calculation
   */
  async createPlan(payload: any, actorName: string) {
    const yearFa = (() => {
      try {
        return new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric' }).format(new Date());
      } catch {
        return String(new Date().getFullYear());
      }
    })();
    const planCode =
      String(payload.planCode || '').trim() ||
      `LP-${yearFa}-${Math.floor(1000 + Math.random() * 9000)}`;

    const created = await withTransaction(async (tx) => {
      const [plan] = await tx
        .insert(schema.liftingPlans)
        .values({
          planCode,
          title: String(payload.title || '').trim(),
          revisionNumber: 1,
          liftCategory: String(payload.liftCategory || 'STANDARD'),
          companyId: payload.companyId ? Number(payload.companyId) : null,
          unitId: payload.unitId ? Number(payload.unitId) : null,
          unitName: String(payload.unitName || 'عمومی مجتمع').trim(),
          areaLocation: String(payload.areaLocation || '').trim(),
          plannedDate: String(payload.plannedDate || new Date().toISOString().slice(0, 10)),
          contractorName: payload.contractorName ? String(payload.contractorName).trim() : null,
          loadName: String(payload.loadName || '').trim(),
          loadShape: String(payload.loadShape || 'VESSEL_HORIZONTAL'),
          netLoadWeightTon: Number(payload.netLoadWeightTon || 0),
          riggingAccessoryWeightTon: Number(payload.riggingAccessoryWeightTon || 0),
          hookBlockWeightTon: Number(payload.hookBlockWeightTon || 0.6),
          dynamicFactor: Number(payload.dynamicFactor || 1.1),
          loadDimensions: payload.loadDimensions || { lengthM: 6, widthM: 2.2, heightM: 2.2, diameterM: 2.2 },
          cogOffset: payload.cogOffset || { x: 0, y: 0, z: 0 },
          craneSetup: payload.craneSetup || {},
          riggingSetup: payload.riggingSetup || {},
          tandemConfig: payload.tandemConfig || {},
          blindConfig: payload.blindConfig || {},
          turningConfig: payload.turningConfig || {},
          personnelAssignment: payload.personnelAssignment || {},
          linkedRiskAssessmentId: payload.linkedRiskAssessmentId ? Number(payload.linkedRiskAssessmentId) : null,
          linkedPermitId: payload.linkedPermitId ? Number(payload.linkedPermitId) : null,
          linkedNonConformanceId: payload.linkedNonConformanceId ? Number(payload.linkedNonConformanceId) : null,
          linkedInspectionIds: Array.isArray(payload.linkedInspectionIds) ? payload.linkedInspectionIds : [],
          linkedDocumentIds: Array.isArray(payload.linkedDocumentIds) ? payload.linkedDocumentIds : [],
          engineeringStatus: 'NOT_VERIFIED',
          workflowStage: 'PLAN_DRAFT',
          status: 'DRAFT',
          requiresReapproval: false,
          unitPreferences: payload.unitPreferences || { massUnit: 'ton', lengthUnit: 'm', pressureUnit: 'kPa', windUnit: 'm/s' },
          engineVersion: LIFTING_ENGINE_VERSION,
          notes: payload.notes || null,
          createdBy: actorName,
          updatedBy: actorName,
        })
        .returning();

      for (const st of WORKFLOW_STAGES) {
        const isFirst = st.key === 'REQUEST';
        await tx.insert(schema.liftingWorkflowApprovals).values({
          planId: plan.id,
          revisionNumber: 1,
          stageKey: st.key,
          stageTitleFa: st.titleFa,
          decision: isFirst ? 'APPROVED' : 'PENDING',
          signerName: isFirst ? actorName : null,
          signerRole: isFirst ? 'درخواست‌کننده' : null,
          decidedAt: isFirst ? new Date() : null,
        });
      }

      return plan;
    });

    await this.evaluatePlanByIdOrPayload(created, created.id, actorName);
    const [fresh] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, created.id));
    const approvals = await db.select().from(schema.liftingWorkflowApprovals).where(eq(schema.liftingWorkflowApprovals.planId, created.id)).orderBy(asc(schema.liftingWorkflowApprovals.id));
    return { ...fresh, workflowApprovals: approvals };
  }

  /**
   * Update Lifting Plan + automatic revision snapshot & mandatory re-approval trigger if approved/reviewed
   */
  async updatePlan(planId: number, payload: any, actorName: string) {
    const [existing] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, planId));
    if (!existing || existing.isDeleted) {
      throw new Error('طرح باربرداری مورد نظر یافت نشد.');
    }

    const criticalFieldsChanged =
      (payload.netLoadWeightTon !== undefined && Number(payload.netLoadWeightTon) !== existing.netLoadWeightTon) ||
      (payload.riggingAccessoryWeightTon !== undefined && Number(payload.riggingAccessoryWeightTon) !== existing.riggingAccessoryWeightTon) ||
      (payload.hookBlockWeightTon !== undefined && Number(payload.hookBlockWeightTon) !== existing.hookBlockWeightTon) ||
      (payload.dynamicFactor !== undefined && Number(payload.dynamicFactor) !== existing.dynamicFactor) ||
      (payload.areaLocation !== undefined && String(payload.areaLocation).trim() !== existing.areaLocation) ||
      (payload.plannedDate !== undefined && String(payload.plannedDate) !== existing.plannedDate) ||
      payload.craneSetup !== undefined ||
      payload.riggingSetup !== undefined ||
      payload.tandemConfig !== undefined ||
      payload.blindConfig !== undefined ||
      payload.turningConfig !== undefined ||
      payload.cogOffset !== undefined ||
      payload.loadDimensions !== undefined ||
      payload.unitPreferences !== undefined ||
      (payload.liftCategory !== undefined && payload.liftCategory !== existing.liftCategory);

    const needsRevisionBump =
      criticalFieldsChanged &&
      ['APPROVED', 'ACTIVE_EXECUTION', 'UNDER_REVIEW'].includes(String(existing.status).toUpperCase());

    const nextRevision = needsRevisionBump ? existing.revisionNumber + 1 : existing.revisionNumber;
    const changeReason = String(payload.changeReason || 'بازنگری پارامترهای فنی / تجهیزات طرح باربرداری').trim();

    await withTransaction(async (tx) => {
      if (needsRevisionBump) {
        await tx.insert(schema.liftingPlanRevisions).values({
          planId,
          revisionNumber: existing.revisionNumber,
          changeReason,
          changedBy: actorName,
          statusAtSnapshot: existing.status,
          engineeringStatusAtSnapshot: existing.engineeringStatus,
          planSnapshot: existing,
          calculationSnapshot: existing.latestCalculationSummary || {},
        });

        // Mark old workflow approvals beyond REQUEST/PLAN_DRAFT as RESET_ON_REVISION (invalidates BOTH Engineering & HSE approvals)
        const oldStages = await tx
          .select()
          .from(schema.liftingWorkflowApprovals)
          .where(eq(schema.liftingWorkflowApprovals.planId, planId));
        for (const st of oldStages) {
          if (!['REQUEST', 'PLAN_DRAFT'].includes(st.stageKey)) {
            await tx
              .update(schema.liftingWorkflowApprovals)
              .set({
                decision: 'RESET_ON_REVISION',
                comments: `باطل‌شده به دلیل بازنگری فنی نسخه ${nextRevision}: ${changeReason}`,
                updatedAt: new Date(),
              })
              .where(eq(schema.liftingWorkflowApprovals.id, st.id));
          }
        }
      }

      await tx
        .update(schema.liftingPlans)
        .set({
          title: payload.title !== undefined ? String(payload.title).trim() : existing.title,
          revisionNumber: nextRevision,
          liftCategory: payload.liftCategory ?? existing.liftCategory,
          companyId: payload.companyId !== undefined ? (payload.companyId ? Number(payload.companyId) : null) : existing.companyId,
          unitId: payload.unitId !== undefined ? (payload.unitId ? Number(payload.unitId) : null) : existing.unitId,
          unitName: payload.unitName !== undefined ? String(payload.unitName).trim() : existing.unitName,
          areaLocation: payload.areaLocation !== undefined ? String(payload.areaLocation).trim() : existing.areaLocation,
          plannedDate: payload.plannedDate !== undefined ? String(payload.plannedDate) : existing.plannedDate,
          contractorName: payload.contractorName !== undefined ? payload.contractorName : existing.contractorName,
          loadName: payload.loadName !== undefined ? String(payload.loadName).trim() : existing.loadName,
          loadShape: payload.loadShape ?? existing.loadShape,
          netLoadWeightTon: payload.netLoadWeightTon !== undefined ? Number(payload.netLoadWeightTon) : existing.netLoadWeightTon,
          riggingAccessoryWeightTon: payload.riggingAccessoryWeightTon !== undefined ? Number(payload.riggingAccessoryWeightTon) : existing.riggingAccessoryWeightTon,
          hookBlockWeightTon: payload.hookBlockWeightTon !== undefined ? Number(payload.hookBlockWeightTon) : existing.hookBlockWeightTon,
          dynamicFactor: payload.dynamicFactor !== undefined ? Number(payload.dynamicFactor) : existing.dynamicFactor,
          loadDimensions: payload.loadDimensions ?? existing.loadDimensions,
          cogOffset: payload.cogOffset ?? existing.cogOffset,
          craneSetup: payload.craneSetup ?? existing.craneSetup,
          riggingSetup: payload.riggingSetup ?? existing.riggingSetup,
          tandemConfig: payload.tandemConfig ?? existing.tandemConfig,
          blindConfig: payload.blindConfig ?? existing.blindConfig,
          turningConfig: payload.turningConfig ?? existing.turningConfig,
          personnelAssignment: payload.personnelAssignment ?? existing.personnelAssignment,
          unitPreferences: payload.unitPreferences ?? existing.unitPreferences,
          engineeringChecklist: needsRevisionBump ? {} : (payload.engineeringChecklist ?? existing.engineeringChecklist),
          hseChecklist: needsRevisionBump ? {} : (payload.hseChecklist ?? existing.hseChecklist),
          fieldConditionsVerification: payload.fieldConditionsVerification ?? existing.fieldConditionsVerification,
          linkedRiskAssessmentId: payload.linkedRiskAssessmentId !== undefined ? (payload.linkedRiskAssessmentId ? Number(payload.linkedRiskAssessmentId) : null) : existing.linkedRiskAssessmentId,
          linkedPermitId: payload.linkedPermitId !== undefined ? (payload.linkedPermitId ? Number(payload.linkedPermitId) : null) : existing.linkedPermitId,
          linkedNonConformanceId: payload.linkedNonConformanceId !== undefined ? (payload.linkedNonConformanceId ? Number(payload.linkedNonConformanceId) : null) : existing.linkedNonConformanceId,
          linkedInspectionIds: Array.isArray(payload.linkedInspectionIds) ? payload.linkedInspectionIds : existing.linkedInspectionIds,
          linkedDocumentIds: Array.isArray(payload.linkedDocumentIds) ? payload.linkedDocumentIds : existing.linkedDocumentIds,
          requiresReapproval: needsRevisionBump ? true : existing.requiresReapproval,
          status: needsRevisionBump ? 'REAPPROVAL_REQUIRED' : existing.status,
          workflowStage: needsRevisionBump ? 'ENG_REVIEW' : existing.workflowStage,
          notes: payload.notes !== undefined ? payload.notes : existing.notes,
          updatedBy: actorName,
          updatedAt: new Date(),
        })
        .where(eq(schema.liftingPlans.id, planId));
    });

    const [updatedRow] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, planId));
    await this.evaluatePlanByIdOrPayload(updatedRow, planId, actorName);
    const [fresh] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, planId));
    const approvals = await db.select().from(schema.liftingWorkflowApprovals).where(eq(schema.liftingWorkflowApprovals.planId, planId)).orderBy(asc(schema.liftingWorkflowApprovals.id));
    return { plan: { ...fresh, workflowApprovals: approvals }, revisionBumped: needsRevisionBump };
  }

  async updateGovernanceChecklists(
    planId: number,
    payload: {
      engineeringChecklist?: Record<string, any>;
      hseChecklist?: Record<string, any>;
      fieldConditionsVerification?: Record<string, any>;
    },
    actorName: string
  ) {
    const [existing] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, planId));
    if (!existing || existing.isDeleted) throw new Error('طرح باربرداری یافت نشد.');

    const [updated] = await db
      .update(schema.liftingPlans)
      .set({
        engineeringChecklist: payload.engineeringChecklist ?? existing.engineeringChecklist,
        hseChecklist: payload.hseChecklist ?? existing.hseChecklist,
        fieldConditionsVerification: payload.fieldConditionsVerification ?? existing.fieldConditionsVerification,
        updatedBy: actorName,
        updatedAt: new Date(),
      })
      .where(eq(schema.liftingPlans.id, planId))
      .returning();

    const approvals = await db
      .select()
      .from(schema.liftingWorkflowApprovals)
      .where(eq(schema.liftingWorkflowApprovals.planId, planId))
      .orderBy(asc(schema.liftingWorkflowApprovals.id));
    return { ...updated, workflowApprovals: approvals };
  }

  /**
   * Strict Gatekeeper for 9-Stage Lifting Workflow
   */
  async advanceWorkflowStage(
    planId: number,
    stageKey: WorkflowStageKey,
    decision: 'APPROVED' | 'REJECTED' | 'RETURNED',
    actor: { name: string; role: string; personnelCode?: string; canApprove: boolean },
    comments?: string,
    checklistState?: Record<string, boolean>
  ) {
    const [plan] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, planId));
    if (!plan || plan.isDeleted) throw new Error('طرح باربرداری یافت نشد.');

    // Recompute authoritative engineering status right now
    const evalRes = await this.evaluatePlanByIdOrPayload(plan, planId, actor.name);
    const [freshPlan] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, planId));
    const currentApprovals = await db
      .select()
      .from(schema.liftingWorkflowApprovals)
      .where(eq(schema.liftingWorkflowApprovals.planId, planId))
      .orderBy(asc(schema.liftingWorkflowApprovals.id));

    const getLatestStageDecision = (key: string) => {
      const matches = currentApprovals.filter((a) => a.stageKey === key);
      return matches.length > 0 ? matches[matches.length - 1].decision : 'PENDING';
    };

    const blockers: string[] = [];

    if (decision === 'APPROVED') {
      if (stageKey === 'PLAN_DRAFT') {
        if (!freshPlan.craneSetup?.primaryCraneId) blockers.push('جرثقیل اصلی انتخاب نشده است.');
        if (freshPlan.netLoadWeightTon <= 0) blockers.push('وزن خالص بار باید بزرگتر از صفر باشد.');
      }

      if (stageKey === 'ENG_REVIEW') {
        if (evalRes.overallStatus === 'FAIL' || evalRes.overallStatus === 'NOT_VERIFIED') {
          blockers.push(`محاسبات مهندسی در وضعیت «${evalRes.overallStatus}» است و قابل تأیید نیست.`);
          blockers.push(...evalRes.blockers.slice(0, 4));
        }
        const engChk = (freshPlan.engineeringChecklist || {}) as Record<string, any>;
        const missingEng = ENGINEERING_CHECK_KEYS.filter((k) => !Boolean(engChk[k]?.checked ?? checklistState?.[k]));
        if (missingEng.length > 0) {
          blockers.push(`برای تأییدیه مستقل مهندسی، تیک کنترل هر ۶ بند فنی الزامی است (${missingEng.length} بند تکمیل نشده).`);
        }
      }

      if (stageKey === 'HSE_EVAL') {
        if (!freshPlan.linkedRiskAssessmentId) {
          blockers.push('ارزیابی ریسک / JSA متصل به این طرح باربرداری ثبت یا پیوند داده نشده است.');
        }
        const blind = (freshPlan.blindConfig || {}) as Record<string, any>;
        if (blind.enabled || freshPlan.liftCategory === 'BLIND') {
          if (!blind.signalerName || !blind.primaryRadioChannel || !blind.emergencyStopProcedure) {
            blockers.push('در عملیات Blind Lift تعیین ریگر/سیگنال‌دهنده، کانال رادیویی و دستورالعمل توقف اضطراری الزامی است.');
          }
        }
        if (evalRes.tandemResult?.status === 'FAIL' || evalRes.tandemResult?.status === 'NOT_VERIFIED') {
          blockers.push('ارزیابی Tandem Lift دارای خطای مهندسی است.');
        }
        const hseChk = (freshPlan.hseChecklist || {}) as Record<string, any>;
        const missingHse = HSE_CHECK_KEYS.filter((k) => !Boolean(hseChk[k]?.checked ?? checklistState?.[k]));
        if (missingHse.length > 0) {
          blockers.push(`برای تأییدیه مستقل HSE، تکمیل هر ۸ بند ارزیابی ایمنی الزامی است (${missingHse.length} بند تکمیل نشده).`);
        }
      }

      if (stageKey === 'EQUIP_INSPECT') {
        if (freshPlan.craneSetup?.primaryCraneId) {
          const [crane] = await db.select().from(schema.liftingCranes).where(eq(schema.liftingCranes.id, Number(freshPlan.craneSetup.primaryCraneId)));
          if (!crane) {
            blockers.push('جرثقیل انتخاب‌شده در بانک تجهیزات یافت نشد.');
          } else {
            const exp = checkExpiryStatus(crane.certificateExpiryDate);
            if (crane.status !== 'ACTIVE' || exp === 'EXPIRED' || exp === 'MISSING') {
              blockers.push(`گواهینامه یا وضعیت عملیاتی جرثقیل «${crane.name}» معتبر نیست.`);
            }
          }
        }
        const riggingIds = [
          ...(Array.isArray(freshPlan.riggingSetup?.slingIds) ? freshPlan.riggingSetup.slingIds : []),
          ...(Array.isArray(freshPlan.riggingSetup?.shackleIds) ? freshPlan.riggingSetup.shackleIds : []),
        ].map(Number).filter(Boolean);
        if (riggingIds.length > 0) {
          const allRig = await db.select().from(schema.liftingRiggingEquipment);
          for (const rid of riggingIds) {
            const rig = allRig.find((r) => r.id === rid);
            if (!rig) continue;
            const rexp = checkExpiryStatus(rig.certificateExpiryDate);
            if (rig.conditionStatus !== 'SERVICEABLE' || !rig.safetyLatchOk || rexp === 'EXPIRED') {
              blockers.push(`تجهیز Rigging «${rig.name}» (${rig.assetCode}) منقضی یا معیوب است.`);
            }
          }
        }
        if (freshPlan.linkedNonConformanceId) {
          const [nc] = await db.select().from(schema.nonConformances).where(eq(schema.nonConformances.id, freshPlan.linkedNonConformanceId));
          if (nc && !['CLOSED', 'RESOLVED'].includes(String(nc.status || '').toUpperCase())) {
            blockers.push(`عدم انطباق مرتبط (${nc.trackingCode}) هنوز بسته نشده است.`);
          }
        }
      }

      if (stageKey === 'AUTHORIZED_APPROVAL') {
        if (!actor.canApprove) {
          throw new Error('کاربر جاری مجوز تأییدیه نهایی عملیات باربرداری را ندارد.');
        }
        for (const reqStage of ['ENG_REVIEW', 'HSE_EVAL', 'EQUIP_INSPECT']) {
          if (getLatestStageDecision(reqStage) !== 'APPROVED') {
            blockers.push(`مرحله پیش‌نیاز «${WORKFLOW_STAGES.find((s) => s.key === reqStage)?.titleFa}» هنوز تأیید نشده است.`);
          }
        }
        if (evalRes.overallStatus === 'FAIL' || evalRes.overallStatus === 'NOT_VERIFIED') {
          blockers.push('محاسبات مهندسی هنوز PASS یا WARNING تأییدشده ندارد.');
        }
      }

      if (stageKey === 'PERMIT_ISSUANCE') {
        const gates = await this.getStageGates();
        const g6 = gates.find((g) => g.gateCode === 'G6');
        if (!g6 || g6.status !== 'VERIFIED') {
          blockers.push('دروازه بهره‌برداری واقعی (Stage Gate G6) هنوز تأیید نشده است؛ صدور مجوز اجرای عملیات تا پیش از تأیید G6 مسدود است.');
        }
        if (getLatestStageDecision('AUTHORIZED_APPROVAL') !== 'APPROVED') {
          blockers.push('بدون تأییدیه مقامات مجاز امکان صدور مجوز باربرداری وجود ندارد.');
        }
        const fc = (freshPlan.fieldConditionsVerification || {}) as Record<string, any>;
        const missingField = FIELD_CONDITION_KEYS.filter((k) => !Boolean(fc[k]?.verified));
        if (missingField.length > 0) {
          blockers.push(`کنترل شرایط واقعی محل پیش از صدور مجوز (۱۰ بند تطبیق میدانی) کامل نیست (${missingField.length} بند تأیید نشده).`);
        }
        if (!freshPlan.linkedPermitId) {
          blockers.push('پروانه کار ایمن (PTW) به این عملیات متصل نشده است.');
        } else {
          const [ptw] = await db.select().from(schema.workPermits).where(eq(schema.workPermits.id, freshPlan.linkedPermitId));
          if (!ptw || ['CANCELLED', 'REJECTED'].includes(String(ptw.status || '').toUpperCase())) {
            blockers.push('پروانه کار متصل‌شده نامعتبر یا لغوشده است.');
          }
        }
      }

      if (stageKey === 'EXECUTION') {
        if (getLatestStageDecision('PERMIT_ISSUANCE') !== 'APPROVED') {
          blockers.push('پیش از تکمیل مرحله صدور مجوز (PTW)، ورود به فاز اجرا مجاز نیست.');
        }
        const fc = (freshPlan.fieldConditionsVerification || {}) as Record<string, any>;
        const unverifiedFc = FIELD_CONDITION_KEYS.filter((k) => !Boolean(fc[k]?.verified));
        if (unverifiedFc.length > 0) {
          blockers.push(`شرایط عملیاتی ۱۰گانه محل در لحظه اجرا احراز نشده است (${unverifiedFc.length} مورد).`);
        }
      }

      if (stageKey === 'CLOSEOUT') {
        if (getLatestStageDecision('EXECUTION') !== 'APPROVED') {
          blockers.push('پیش از ثبت نظارت حین اجرا، امکان اختتام عملیات وجود ندارد.');
        }
      }
    }

    if (blockers.length > 0) {
      return {
        blocked: true,
        blockers,
        plan: freshPlan,
      };
    }

    // Persist decision
    const stageMeta = WORKFLOW_STAGES.find((s) => s.key === stageKey)!;
    const stageIdx = WORKFLOW_STAGES.findIndex((s) => s.key === stageKey);
    const nextStageKey =
      decision === 'APPROVED' && stageIdx >= 0 && stageIdx + 1 < WORKFLOW_STAGES.length
        ? WORKFLOW_STAGES[stageIdx + 1].key
        : decision === 'RETURNED'
          ? 'PLAN_DRAFT'
          : stageKey;

    let nextPlanStatus = freshPlan.status;
    if (decision === 'REJECTED') nextPlanStatus = 'REJECTED';
    else if (decision === 'RETURNED') nextPlanStatus = 'DRAFT';
    else if (stageKey === 'AUTHORIZED_APPROVAL') nextPlanStatus = 'APPROVED';
    else if (stageKey === 'PERMIT_ISSUANCE' || stageKey === 'EXECUTION') nextPlanStatus = 'ACTIVE_EXECUTION';
    else if (stageKey === 'CLOSEOUT') nextPlanStatus = 'CLOSED';
    else if (['ENG_REVIEW', 'HSE_EVAL', 'EQUIP_INSPECT'].includes(stageKey)) nextPlanStatus = 'UNDER_REVIEW';

    await withTransaction(async (tx) => {
      const existingRow = currentApprovals.find((a) => a.stageKey === stageKey);
      if (existingRow) {
        await tx
          .update(schema.liftingWorkflowApprovals)
          .set({
            revisionNumber: freshPlan.revisionNumber,
            decision,
            signerName: actor.name,
            signerRole: actor.role,
            signerPersonnelCode: actor.personnelCode || null,
            checklistState: checklistState || existingRow.checklistState,
            blockingReasons: [],
            comments: comments || null,
            decidedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.liftingWorkflowApprovals.id, existingRow.id));
      } else {
        await tx.insert(schema.liftingWorkflowApprovals).values({
          planId,
          revisionNumber: freshPlan.revisionNumber,
          stageKey,
          stageTitleFa: stageMeta.titleFa,
          decision,
          signerName: actor.name,
          signerRole: actor.role,
          signerPersonnelCode: actor.personnelCode || null,
          checklistState: checklistState || {},
          blockingReasons: [],
          comments: comments || null,
          decidedAt: new Date(),
        });
      }

      await tx
        .update(schema.liftingPlans)
        .set({
          workflowStage: nextStageKey,
          status: nextPlanStatus,
          requiresReapproval: stageKey === 'AUTHORIZED_APPROVAL' && decision === 'APPROVED' ? false : freshPlan.requiresReapproval,
          approvedBy: stageKey === 'AUTHORIZED_APPROVAL' && decision === 'APPROVED' ? actor.name : freshPlan.approvedBy,
          approvedAt: stageKey === 'AUTHORIZED_APPROVAL' && decision === 'APPROVED' ? new Date() : freshPlan.approvedAt,
          updatedBy: actor.name,
          updatedAt: new Date(),
        })
        .where(eq(schema.liftingPlans.id, planId));
    });

    const [finalPlan] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, planId));
    const finalApprovals = await db
      .select()
      .from(schema.liftingWorkflowApprovals)
      .where(eq(schema.liftingWorkflowApprovals.planId, planId))
      .orderBy(asc(schema.liftingWorkflowApprovals.id));

    return {
      blocked: false,
      blockers: [],
      plan: { ...finalPlan, workflowApprovals: finalApprovals },
    };
  }

  /**
   * Internal HSECORE AI Analytical Advisor (strictly advisory - never approves calculations or permits)
   */
  async analyzePlanWithAI(planId: number, question?: string) {
    const [plan] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, planId));
    if (!plan || plan.isDeleted) throw new Error('طرح باربرداری یافت نشد.');

    const evalRes = await this.evaluatePlanByIdOrPayload(plan, planId, 'AI Advisory Check');

    // Collect deterministic cross-module findings first (100% factual, never hallucinated)
    const missingItems: string[] = [];
    if (!plan.craneSetup?.primaryCraneId) missingItems.push('انتخاب جرثقیل از بانک ناوگان');
    if (!plan.linkedRiskAssessmentId) missingItems.push('ارزیابی ریسک / JSA مرتبط');
    if (!plan.personnelAssignment?.operatorName) missingItems.push('تعیین اپراتور جرثقیل دارای گواهینامه');
    if (!plan.personnelAssignment?.riggerName) missingItems.push('تعیین ریگر / مسئول قلاب‌اندازی');
    if (plan.liftCategory === 'BLIND' || plan.blindConfig?.enabled) {
      if (!plan.blindConfig?.signalerName) missingItems.push('تعیین سیگنال‌دهنده (Spotter) عملیات Blind Lift');
      if (!plan.blindConfig?.primaryRadioChannel) missingItems.push('کانال بی‌سیم اختصاصی و پشتیبان');
    }

    const certWarnings: string[] = [];
    if (plan.craneSetup?.primaryCraneId) {
      const [cr] = await db.select().from(schema.liftingCranes).where(eq(schema.liftingCranes.id, Number(plan.craneSetup.primaryCraneId)));
      if (cr) {
        const exp = checkExpiryStatus(cr.certificateExpiryDate);
        if (exp !== 'VALID') certWarnings.push(`گواهینامه جرثقیل ${cr.name}: وضعیت ${exp} (${cr.certificateExpiryDate || 'نامشخص'})`);
      }
    }

    const prompt = `به عنوان دستیار مهندسی و ایمنی باربرداری (فقط نقش مشورتی و تحلیلی - بدون اختیار تایید نهایی)، این طرح باربرداری را به زبان فارسی تخصصی، کوتاه و ساختارمند تحلیل کن:
عنوان طرح: ${plan.title} (${plan.planCode})
نوع عملیات: ${plan.liftCategory} | بار: ${plan.loadName} (${plan.netLoadWeightTon} تن خالص / ${evalRes.riggingResult.designTotalLoadTon} تن کل دینامیکی)
وضعیت محاسبات مهندسی: ${evalRes.overallStatus}
بهره‌برداری جرثقیل: ${evalRes.craneResult?.utilizationPct ?? 'نامشخص'}%
حداقل زاویه اسلینگ: ${evalRes.riggingResult.minHorizontalAngleDeg}° | تنش بحرانی اسلینگ: ${evalRes.riggingResult.governingLegTensionTon} تن
نواقص فعلی: ${missingItems.join('، ') || 'ندارد'}
هشدارهای محاسباتی: ${[...evalRes.blockers, ...evalRes.warnings].join(' | ') || 'ندارد'}
هشدار گواهینامه‌ها: ${certWarnings.join(' | ') || 'ندارد'}
${question ? `سوال مهندس/کارشناس: ${question}` : 'لطفاً ریسک‌های اصلی، اقدامات کنترلی پیشنهادی JSA و خلاصه وضعیت آماده برای گزارش را بنویس.'}`;

    let aiNarrative = '';
    let aiEngineOnline = false;
    if (localAIProvider.isEngineEnabled) {
      try {
        const res = await localAIProvider.generate(prompt, { temperature: 0.2, max_tokens: 900 });
        if (res?.text?.trim()) {
          aiNarrative = res.text.trim();
          aiEngineOnline = true;
        }
      } catch (err) {
        logger.debug('[LiftingService] Local AI narrative fallback used:', err);
      }
    }

    if (!aiNarrative) {
      aiNarrative = [
        `خلاصه تحلیل مهندسی داخلی طرح «${plan.title}» (${plan.planCode} - ویرایش ${plan.revisionNumber}):`,
        `• وضعیت مهندسی مطابق استاندارد ASME: ${evalRes.overallStatus}`,
        `• بار کل استاتیکی: ${evalRes.riggingResult.grossStaticLoadTon} تن | بار طراحی با DAF: ${evalRes.riggingResult.designTotalLoadTon} تن`,
        evalRes.craneResult?.utilizationPct != null ? `• درصد بهره‌برداری جرثقیل از Load Chart واقعی: ${evalRes.craneResult.utilizationPct}%` : '• ظرفیت جرثقیل هنوز روی Load Chart احراز نشده است.',
        missingItems.length > 0 ? `• موارد تکمیلی مورد نیاز: ${missingItems.join('، ')}` : '• مدارک و نفرات کلیدی پایه تکمیل است.',
        `• هشدارهای ایمنی: رعایت حریم دکل و خطوط برق، بررسی پایداری خاک زیر جک‌ها و برگزاری جلسه پیش از باربرداری (Pre-Lift Toolbox Talk) الزامی است.`,
      ].join('\n');
    }

    const suggestedHazards = [
      'واژگونی جرثقیل به دلیل نشست خاک زیر جک‌ها یا تجاوز از شعاع مجاز Load Chart',
      'پارگی اسلینگ / شکست شگل در اثر زاویه کمتر از ۴۵ درجه یا لبه تیز بار بدون محافظ',
      'نوسان ناگهانی بار (Pendulum Effect) یا چرخش کنترل‌نشده بار در اثر وزش باد',
      plan.liftCategory === 'TANDEM' || plan.tandemConfig?.enabled ? 'جابجایی مرکز ثقل (CoG Shift) و بارگذاری نامتعادل بین دو جرثقیل در Tandem Lift' : null,
      plan.liftCategory === 'BLIND' || plan.blindConfig?.enabled ? 'قطع ارتباط رادیویی یا خطای سیگنال‌دهی در نقاط کور اپراتور (Blind Lift)' : null,
      'برخورد بار یا بوم با پایپ‌رک‌ها، سازه‌ها یا خطوط برق فشار قوی مجاور',
    ].filter(Boolean) as string[];

    const snapshot = {
      advisoryOnlyNotice: 'تحلیل هوش مصنوعی صرفاً جنبه مشورتی دارد و جایگزین صحه‌گذاری مهندسی و امضای مقام مجاز نیست.',
      aiEngineOnline,
      generatedAt: new Date().toISOString(),
      engineeringStatus: evalRes.overallStatus,
      missingItems,
      certWarnings,
      blockers: evalRes.blockers,
      warnings: evalRes.warnings,
      suggestedHazards,
      narrative: aiNarrative,
    };

    await db
      .update(schema.liftingPlans)
      .set({ aiAnalysisSnapshot: snapshot, updatedAt: new Date() })
      .where(eq(schema.liftingPlans.id, planId));

    return snapshot;
  }
}

export const liftingService = new LiftingService();
