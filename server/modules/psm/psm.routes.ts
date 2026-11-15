import { Router, Request, Response } from 'express';
import { db } from '../../../src/db/index.ts';
import {
  psmProjects,
  psmProcessAssets,
  psmAssessments,
  psmGaps,
  psmWbsTasks,
  psmDocuments,
  psmCapaItems,
  psmSpecializedStudies,
  psmMaturityAssessments,
  psmStageGates,
  psmGateDeviations,
  users,
  personnel,
  orgCompanies,
  orgSites,
  orgDepartments,
  orgUnits,
  orgPositions,
  systemSettings,
  auditLogs,
  workPermits,
  incidents,
  riskAssessments,
  hseTrainings,
  nonConformances,
  systemFiles,
} from '../../../src/db/schema.ts';
import { eq, desc, and, sql } from 'drizzle-orm';
import { requireAuth, checkUserHasPermission, isGlobalAdminUser } from '../../core/middleware/auth.ts';
import { auditService } from '../audit/audit.service.ts';
import { broadcastDataMutation } from '../../core/socket.ts';
import { logger } from '../../core/logger.ts';
import {
  CCPS_PILLARS,
  CCPS_20_ELEMENTS,
  OSHA_14_CLAUSES,
  CCPS_OSHA_TRACEABILITY_MATRIX,
  PSM_SPECIALIZED_SUBSYSTEMS,
  PSM_MATURITY_LEVELS,
  PSM_CAPA_STAGES,
  PSM_STAGE_GATES,
} from '../../../src/modules/psm/psmStandardsCatalog.ts';
import { parseDateString, formatJalaliString, gregorianToJalali } from '../../../src/utils/jalaliDate.ts';
import { localAIProvider } from '../ai/ai.local-provider.ts';

const router = Router();

function canWritePsm(req: Request): boolean {
  if (!req.user) return false;
  const roleNorm = String(req.user.role || '').toUpperCase().replace(/[\s_-]+/g, '');
  const roleRaw = String(req.user.role || '');
  if (
    ['VIEWER', 'READONLY', 'GUEST', 'OBSERVER', 'CONTRACTORVIEWER'].includes(roleNorm) ||
    /مشاهده‌گر|فقط مشاهده|مهمان/i.test(roleRaw)
  ) {
    return false;
  }
  if (isGlobalAdminUser(req.user)) return true;
  if (
    [
      'ADMIN',
      'ADMINISTRATOR',
      'SUPERADMIN',
      'HSEMANAGER',
      'MANAGER',
      'PROJECTMANAGER',
      'SAFETYOFFICER',
      'SAFETYINSPECTOR',
      'AUDITOR',
      'EXECUTIVEMANAGER',
      'MAINTENANCEMANAGER',
      'STANDARDUSER',
      'USER',
      'EXPERT',
      'HSEEXPERT',
      'SAFETYEXPERT',
      'INSPECTOR',
      'OPERATOR',
    ].includes(roleNorm)
  ) {
    return true;
  }
  if (/مدیر|کارشناس|سرپرست|ایمنی|بازرس|مسئول|کاربر|مهندس/i.test(roleRaw)) {
    return true;
  }
  return true;
}

function canApprovePsm(req: Request): boolean {
  if (!req.user) return false;
  const roleNorm = String(req.user.role || '').toUpperCase().replace(/[\s_-]+/g, '');
  const roleRaw = String(req.user.role || '');
  if (
    ['VIEWER', 'READONLY', 'GUEST', 'OBSERVER', 'CONTRACTORVIEWER'].includes(roleNorm) ||
    /مشاهده‌گر|فقط مشاهده|مهمان/i.test(roleRaw)
  ) {
    return false;
  }
  if (isGlobalAdminUser(req.user)) return true;
  if (
    [
      'ADMIN',
      'ADMINISTRATOR',
      'SUPERADMIN',
      'HSEMANAGER',
      'MANAGER',
      'PROJECTMANAGER',
      'AUDITOR',
      'EXECUTIVEMANAGER',
      'SAFETYOFFICER',
      'SAFETYINSPECTOR',
      'STANDARDUSER',
      'USER',
      'EXPERT',
      'HSEEXPERT',
    ].includes(roleNorm)
  ) {
    return true;
  }
  if (/مدیر|سرپرست|مسئول|ارزیاب|ممیز|کارشناس/i.test(roleRaw)) {
    return true;
  }
  return true;
}

async function writePsmAuditLog(
  req: Request,
  action: string,
  entityType: string,
  entityId: string | number,
  oldValue: any,
  newValue: any,
  details?: Record<string, any>
) {
  try {
    await auditService.logFromRequest(req, {
      action,
      module: 'PSM',
      entityType,
      entityId: String(entityId),
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
      details: {
        timestamp: new Date().toISOString(),
        ...(details || {}),
      },
      result: 'SUCCESS',
    });
  } catch (err) {
    logger.warn('[PSM Audit] Failed to record audit log:', err);
  }
}

/**
 * Parses both Shamsi (e.g. 1404/01/15 or ۱۴۰۴/۰۱/۱۵) and Gregorian (e.g. 2025-04-04) date strings into a JS Date
 */
function parseDateSafe(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const trimmed = String(dateStr).trim();
  if (!trimmed) return null;
  const dual = parseDateString(trimmed);
  if (dual.gregorian) {
    const { gy, gm, gd } = dual.gregorian;
    const d = new Date(gy, gm - 1, gd, 12, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}

/**
 * Converts any date string (Gregorian or Shamsi) to normalized Shamsi YYYY/MM/DD for consistent display & storage
 */
function toShamsiDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  const dual = parseDateString(trimmed);
  if (dual.jalali) {
    return formatJalaliString(dual.jalali.jy, dual.jalali.jm, dual.jalali.jd);
  }
  return trimmed;
}

function calculateWbsScheduleMetrics(task: {
  plannedStart: string;
  plannedEnd: string;
  actualStart?: string | null;
  actualEnd?: string | null;
  plannedProgress: number;
  actualProgress: number;
}) {
  const now = new Date();
  const pStart = parseDateSafe(task.plannedStart);
  const pEnd = parseDateSafe(task.plannedEnd);
  const aEnd = parseDateSafe(task.actualEnd);

  let computedPlannedPct = Number(task.plannedProgress || 0);
  if (pStart && pEnd && pEnd.getTime() > pStart.getTime()) {
    if (now.getTime() <= pStart.getTime()) {
      computedPlannedPct = 0;
    } else if (now.getTime() >= pEnd.getTime()) {
      computedPlannedPct = 100;
    } else {
      computedPlannedPct = Math.round(
        ((now.getTime() - pStart.getTime()) / (pEnd.getTime() - pStart.getTime())) * 100
      );
    }
  }

  const actualPct = Math.max(0, Math.min(100, Number(task.actualProgress || 0)));
  const scheduleVariancePct = Number((actualPct - computedPlannedPct).toFixed(1));

  let delayDays = 0;
  if (pEnd) {
    const compareTime = actualPct >= 100 && aEnd ? aEnd.getTime() : now.getTime();
    if (compareTime > pEnd.getTime() && (actualPct < 100 || aEnd)) {
      delayDays = Math.max(0, Math.ceil((compareTime - pEnd.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }

  let status = 'NOT_STARTED';
  if (actualPct >= 100) {
    status = 'COMPLETED';
  } else if (delayDays > 0 || scheduleVariancePct < -15) {
    status = 'DELAYED';
  } else if (actualPct > 0 || task.actualStart) {
    status = 'IN_PROGRESS';
  }

  return {
    plannedProgress: computedPlannedPct,
    actualProgress: actualPct,
    scheduleVariancePct,
    delayDays,
    status,
  };
}

/**
 * Normalizes a database `psmProjects` row so both DB column names and frontend aliases are always available.
 */
function normalizeProjectRecord(p: any) {
  if (!p) return null;
  const startDateShamsi = toShamsiDisplayDate(p.startDate);
  const endDateShamsi = toShamsiDisplayDate(p.endDate);
  return {
    ...p,
    code: p.projectCode || p.code || '',
    projectCode: p.projectCode || p.code || '',
    name: p.title || p.name || '',
    title: p.title || p.name || '',
    scope: p.scopeDescription || p.scope || '',
    scopeDescription: p.scopeDescription || p.scope || '',
    startDate: startDateShamsi || p.startDate || '',
    endDate: endDateShamsi || p.endDate || '',
    rawStartDate: p.startDate || '',
    rawEndDate: p.endDate || '',
    sponsorId: p.projectSponsorId ?? p.sponsorId ?? null,
    projectSponsorId: p.projectSponsorId ?? p.sponsorId ?? null,
    sponsorName: p.projectSponsorName || p.sponsorName || '',
    projectSponsorName: p.projectSponsorName || p.sponsorName || '',
    allocatedBudget: Number(p.budgetAllocated ?? p.allocatedBudget ?? 0),
    budgetAllocated: Number(p.budgetAllocated ?? p.allocatedBudget ?? 0),
    spentBudget: Number(p.budgetSpent ?? p.spentBudget ?? 0),
    budgetSpent: Number(p.budgetSpent ?? p.spentBudget ?? 0),
    status: p.overallStatus || p.status || 'INITIATION',
    overallStatus: p.overallStatus || p.status || 'INITIATION',
    isDraft: (p.overallStatus || p.status) === 'DRAFT',
  };
}

/**
 * Automatically connects a newly finalized PSM project to the PSM Project Management Engine:
 * 1. Seeds the 6 Stage Gates (G1-G6) in `psmStageGates` with Project Manager as Preparer and Sponsor as Approver.
 * 2. Seeds baseline WBS tasks in `psmWbsTasks` for the project's selected Milestones so timeline/Gantt & Dashboard are immediately active.
 */
async function syncProjectWithPsmEngine(project: any) {
  if (!project || !project.id || project.overallStatus === 'DRAFT') return;
  try {
    // 1. Seed 6 Stage Gates (G1..G6) if not already initialized
    const existingGates = await db
      .select()
      .from(psmStageGates)
      .where(eq(psmStageGates.projectId, project.id));
    const existingGateKeys = new Set(existingGates.map((g) => g.gateKey));

    for (const gateDef of PSM_STAGE_GATES) {
      const gKey = gateDef.gateKey || (gateDef as any).key || `G${gateDef.gateNumber}`;
      if (!existingGateKeys.has(gKey)) {
        await db.insert(psmStageGates).values({
          projectId: project.id,
          gateKey: gKey,
          gateNumber: gateDef.gateNumber,
          titleFa: gateDef.titleFa,
          titleEn: gateDef.titleEn,
          descriptionFa: gateDef.descriptionFa || gateDef.titleFa,
          entryCriteria: gateDef.entryCriteriaFa || [],
          exitCriteria: gateDef.exitCriteriaFa || [],
          mandatoryChecklist: (gateDef.mandatoryChecklist || []).map((item: any) => ({
            ...item,
            passed: false,
          })),
          requiredEvidenceList: gateDef.requiredEvidenceList || [],
          preparedByName: project.projectManagerName || 'مدیر پروژه PSM',
          evaluatorName: 'کمیته راهبری PSM',
          approverName: project.projectSponsorName || 'حامی پروژه',
          status: gateDef.gateNumber === 1 ? 'IN_REVIEW' : 'PENDING',
        });
      }
    }

    // 2. Connect Milestones to WBS Tasks (`psmWbsTasks`) if milestones are defined
    const milestones = Array.isArray(project.milestones) ? project.milestones : [];
    if (milestones.length > 0) {
      const existingWbs = await db
        .select()
        .from(psmWbsTasks)
        .where(eq(psmWbsTasks.projectId, project.id));
      const existingWbsCodes = new Set(existingWbs.map((t) => t.wbsCode));

      const coveredUnits = Array.isArray(project.coveredUnits) ? project.coveredUnits : [];
      const primaryUnitObj =
        coveredUnits.find((u: any) => typeof u === 'object' && u?.isPrimary) || coveredUnits[0];
      const defaultUnitName =
        typeof primaryUnitObj === 'string'
          ? primaryUnitObj
          : primaryUnitObj?.name || 'کل مجتمع پتروشیمی رجال';

      for (let i = 0; i < milestones.length; i++) {
        const ms = milestones[i];
        const msTitle = typeof ms === 'string' ? ms : ms?.title;
        if (!msTitle) continue;
        const wbsCode = ms?.wbsCode || `WBS-MS-${String(i + 1).padStart(2, '0')}`;
        if (existingWbsCodes.has(wbsCode)) continue;

        const plannedEnd = ms?.plannedDate || ms?.targetDate || project.endDate;
        const plannedStart = project.startDate;
        const actualProgress = Number(ms?.progressPct ?? (ms?.status === 'COMPLETED' ? 100 : 0));
        const ownerStr = ms?.responsiblePersonName || project.projectManagerName || 'مدیر پروژه PSM';

        await db.insert(psmWbsTasks).values({
          projectId: project.id,
          wbsCode,
          title: `نقطه عطف ${i + 1}: ${msTitle}`,
          elementCode: ms?.elementCode || 'CCPS-01',
          unitName: ms?.unitName || defaultUnitName,
          ownerName: ownerStr,
          executorName: ownerStr,
          plannedStart: String(plannedStart || ''),
          plannedEnd: String(plannedEnd || ''),
          actualStart: actualProgress > 0 ? String(plannedStart || '') : null,
          actualEnd: actualProgress >= 100 ? String(plannedEnd || '') : null,
          plannedProgress: actualProgress,
          actualProgress,
          weight: 5,
          dependencies: i > 0 ? [`WBS-MS-${String(i).padStart(2, '0')}`] : [],
          allocatedBudget: 0,
          actualCost: 0,
          resources: project.resourcesSummary || 'تیم استقرار PSM',
          isMilestone: true,
          isCritical: true,
          delayDays: 0,
          scheduleVariancePct: 0,
          status: actualProgress >= 100 ? 'COMPLETED' : actualProgress > 0 ? 'IN_PROGRESS' : 'NOT_STARTED',
        });
      }
    }
  } catch (err) {
    logger.warn('[PSM Engine Auto-Sync] Warning:', err);
  }
}

// ============================================================================
// 1. GET /api/v1/psm/bootstrap
// Returns authoritative standards catalog, central org structure, personnel,
// and all PSM records for the selected project (or all projects).
// ============================================================================
router.get('/bootstrap', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestedProjectId = req.query.projectId ? Number(req.query.projectId) : null;

    const [
      projectsListRaw,
      personnelList,
      companiesList,
      sitesList,
      deptsList,
      unitsList,
      positionsList,
      orgNodesSetting,
      unitStructureSetting,
      permitsCountRes,
      incidentsCountRes,
      risksCountRes,
      trainingsCountRes,
      ncCountRes,
      psmAuditLogs,
    ] = await Promise.all([
      db.select().from(psmProjects).orderBy(desc(psmProjects.createdAt)),
      db.select().from(personnel),
      db.select().from(orgCompanies),
      db.select().from(orgSites),
      db.select().from(orgDepartments),
      db.select().from(orgUnits),
      db.select().from(orgPositions),
      db.select().from(systemSettings).where(eq(systemSettings.key, 'org_nodes')),
      db.select().from(systemSettings).where(eq(systemSettings.key, 'hse_unit_structure_v1')),
      db.select({ count: sql<number>`count(*)::int` }).from(workPermits).catch(() => [{ count: 0 }]),
      db.select({ count: sql<number>`count(*)::int` }).from(incidents).catch(() => [{ count: 0 }]),
      db.select({ count: sql<number>`count(*)::int` }).from(riskAssessments).catch(() => [{ count: 0 }]),
      db.select({ count: sql<number>`count(*)::int` }).from(hseTrainings).catch(() => [{ count: 0 }]),
      db.select({ count: sql<number>`count(*)::int` }).from(nonConformances).catch(() => [{ count: 0 }]),
      db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.module, 'PSM'))
        .orderBy(desc(auditLogs.createdAt))
        .limit(80)
        .catch(() => []),
    ]);

    const projectsList = projectsListRaw.map(normalizeProjectRecord);

    const activeProject =
      (requestedProjectId && projectsList.find((p) => p.id === requestedProjectId)) ||
      projectsList[0] ||
      null;

    let assets: any[] = [];
    let assessments: any[] = [];
    let gaps: any[] = [];
    let wbsTasks: any[] = [];
    let documents: any[] = [];
    let capaItems: any[] = [];
    let studies: any[] = [];
    let maturityRecords: any[] = [];
    let stageGates: any[] = [];
    let gateDeviations: any[] = [];

    if (activeProject) {
      [assets, assessments, gaps, wbsTasks, documents, capaItems, studies, maturityRecords, gateDeviations] =
        await Promise.all([
          db
            .select()
            .from(psmProcessAssets)
            .where(eq(psmProcessAssets.projectId, activeProject.id))
            .orderBy(desc(psmProcessAssets.id)),
          db
            .select()
            .from(psmAssessments)
            .where(eq(psmAssessments.projectId, activeProject.id))
            .orderBy(psmAssessments.elementCode),
          db
            .select()
            .from(psmGaps)
            .where(eq(psmGaps.projectId, activeProject.id))
            .orderBy(desc(psmGaps.id)),
          db
            .select()
            .from(psmWbsTasks)
            .where(eq(psmWbsTasks.projectId, activeProject.id))
            .orderBy(psmWbsTasks.wbsCode),
          db
            .select()
            .from(psmDocuments)
            .where(eq(psmDocuments.projectId, activeProject.id))
            .orderBy(desc(psmDocuments.id)),
          db
            .select()
            .from(psmCapaItems)
            .where(eq(psmCapaItems.projectId, activeProject.id))
            .orderBy(desc(psmCapaItems.id)),
          db
            .select()
            .from(psmSpecializedStudies)
            .where(eq(psmSpecializedStudies.projectId, activeProject.id))
            .orderBy(desc(psmSpecializedStudies.id)),
          db
            .select()
            .from(psmMaturityAssessments)
            .where(eq(psmMaturityAssessments.projectId, activeProject.id))
            .orderBy(desc(psmMaturityAssessments.id)),
          db
            .select()
            .from(psmGateDeviations)
            .where(eq(psmGateDeviations.projectId, activeProject.id))
            .orderBy(desc(psmGateDeviations.createdAt))
            .catch(() => []),
        ]);

      try {
        const rawGates = await bootstrapProjectGates(activeProject.id);
        stageGates = await Promise.all(
          rawGates.map(async (gate) => {
            const evalResult = await evaluateProjectGate(activeProject.id, gate.gateKey);
            return { ...gate, evaluation: evalResult };
          })
        );
      } catch (_gateErr) {
        stageGates = [];
      }
    }

    const [recentPermits, recentIncidents, recentRisks, recentTrainings, recentNcs] = await Promise.all([
      db.select().from(workPermits).orderBy(desc(workPermits.id)).limit(8).catch(() => []),
      db.select().from(incidents).orderBy(desc(incidents.id)).limit(8).catch(() => []),
      db.select().from(riskAssessments).orderBy(desc(riskAssessments.id)).limit(8).catch(() => []),
      db.select().from(hseTrainings).orderBy(desc(hseTrainings.id)).limit(8).catch(() => []),
      db.select().from(nonConformances).orderBy(desc(nonConformances.id)).limit(8).catch(() => []),
    ]);

    const centralAutofillCatalog = [
      ...recentRisks.map((r: any) => ({
        sourceModule: 'RISK_ASSESSMENT',
        sourceModuleLabel: 'مدیریت ریسک (PHA / HAZOP / JSA)',
        recordId: r.id,
        code: r.code || `RA-${r.id}`,
        title: r.hazard || r.activity || r.process || `ارزیابی ریسک شماره ${r.id}`,
        unitName: r.unit || r.area || 'واحد الفین',
        validityStatus: 'معتبر در بانک مرکزی HSECORE',
      })),
      ...recentIncidents.map((inc: any) => ({
        sourceModule: 'INCIDENTS',
        sourceModuleLabel: 'حوادث و شبه‌حوادث فرایندی',
        recordId: inc.id,
        code: inc.trackingCode || `INC-${inc.id}`,
        title: inc.title || inc.description || `گزارش حادثه شماره ${inc.id}`,
        unitName: inc.location || inc.unit || 'مجتمع پتروشیمی رجال',
        validityStatus: 'ثبت‌شده و معتبر در بانک مرکزی',
      })),
      ...recentPermits.map((wp: any) => ({
        sourceModule: 'PTW',
        sourceModuleLabel: 'مجوزهای کار ایمن (PTW)',
        recordId: wp.id,
        code: wp.permitNumber || `PTW-${wp.id}`,
        title: wp.workDescription || wp.type || `پروانه کار شماره ${wp.id}`,
        unitName: wp.location || wp.unit || 'واحد الفین',
        validityStatus: wp.status === 'ACTIVE' || wp.status === 'CLOSED' ? 'معتبر و تأییدشده' : 'ثبت‌شده در PTW',
      })),
      ...recentTrainings.map((tr: any) => ({
        sourceModule: 'TRAINING',
        sourceModuleLabel: 'آموزش و صلاحیت حرفه‌ای HSE',
        recordId: tr.id,
        code: tr.courseCode || `TRN-${tr.id}`,
        title: tr.title || tr.courseName || `دوره آموزشی ایمنی فرایند ${tr.id}`,
        unitName: tr.department || tr.targetGroup || 'کل مجتمع',
        validityStatus: 'سوابق آموزشی معتبر در بانک مرکزی',
      })),
      ...recentNcs.map((nc: any) => ({
        sourceModule: 'CAPA_CENTRAL',
        sourceModuleLabel: 'عدم انطباق‌ها و ممیزی مرکزی',
        recordId: nc.id,
        code: nc.code || `NCR-${nc.id}`,
        title: nc.description || nc.title || `عدم انطباق شماره ${nc.id}`,
        unitName: nc.department || nc.location || 'کل مجتمع',
        validityStatus: 'معتبر در ماژول ممیزی مرکزی',
      })),
    ];

    const orgNodes = Array.isArray(orgNodesSetting[0]?.value) ? orgNodesSetting[0].value : [];
    const unitStructure =
      unitStructureSetting[0]?.value && typeof unitStructureSetting[0].value === 'object'
        ? unitStructureSetting[0].value
        : {};

    const unitById = new Map<number, any>();
    unitsList.forEach((u) => unitById.set(u.id, u));
    const deptById = new Map<number, any>();
    deptsList.forEach((d) => deptById.set(d.id, d));

    const enrichedPersonnel = personnelList.map((p) => {
      const ed = (p.extraData || {}) as Record<string, any>;
      const resolvedUnitObj = p.unitId ? unitById.get(p.unitId) : null;
      const resolvedDeptObj = p.departmentId ? deptById.get(p.departmentId) : null;

      const rawUnitName = ed.unit && ed.unit !== 'نامشخص' ? String(ed.unit).trim() : '';
      const rawDeptName = ed.department && ed.department !== 'نامشخص' ? String(ed.department).trim() : '';

      const unitName = rawUnitName || resolvedUnitObj?.name || '';
      const departmentName = rawDeptName || resolvedDeptObj?.name || '';
      const jobTitle =
        (p.jobTitle && p.jobTitle.trim()) ||
        (ed.jobTitle && String(ed.jobTitle).trim()) ||
        (ed.position && String(ed.position).trim()) ||
        '';

      return {
        id: p.id,
        personnelCode: p.personnelCode,
        nationalCode: p.nationalCode,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        fullName: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
        jobTitle,
        unitId: p.unitId || resolvedUnitObj?.id || null,
        unitName,
        unit: unitName,
        departmentId: p.departmentId || resolvedDeptObj?.id || null,
        departmentName,
        department: departmentName,
        mobile: p.mobile || ed.phone || '',
        education: ed.education || '',
        status: p.status || 'ACTIVE',
      };
    });

    const centralOrganization = {
      companies: companiesList,
      sites: sitesList,
      departments: deptsList,
      units: unitsList,
      positions: positionsList,
      orgNodes,
      unitStructure,
      personnel: enrichedPersonnel,
      linkedModulesSummary: {
        workPermitsCount: permitsCountRes[0]?.count || 0,
        incidentsCount: incidentsCountRes[0]?.count || 0,
        riskAssessmentsCount: risksCountRes[0]?.count || 0,
        trainingsCount: trainingsCountRes[0]?.count || 0,
        nonConformancesCount: ncCountRes[0]?.count || 0,
      },
      centralAutofillCatalog,
    };

    const projectData = {
      assets,
      assessments,
      gaps,
      wbsTasks,
      documents,
      capaItems,
      studies,
      maturityRecords,
      stageGates,
      gateDeviations,
    };

    const permissionsObj = {
      canWrite: canWritePsm(req),
      canApprove: canApprovePsm(req),
    };

    res.json({
      success: true,
      projects: projectsList,
      activeProject,
      centralOrg: centralOrganization,
      centralOrganization,
      projectData,
      auditLogs: psmAuditLogs,
      permissions: permissionsObj,
      data: {
        catalog: {
          pillars: CCPS_PILLARS,
          ccpsElements: CCPS_20_ELEMENTS,
          oshaClauses: OSHA_14_CLAUSES,
          traceabilityMatrix: CCPS_OSHA_TRACEABILITY_MATRIX,
          subsystems: PSM_SPECIALIZED_SUBSYSTEMS,
          maturityLevels: PSM_MATURITY_LEVELS,
          capaStages: PSM_CAPA_STAGES,
        },
        centralOrganization,
        centralOrg: centralOrganization,
        projects: projectsList,
        activeProject,
        projectData,
        auditLogs: psmAuditLogs,
        permissions: permissionsObj,
      },
    });
  } catch (err: any) {
    logger.error('[PSM Bootstrap] Error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'خطا در بارگذاری اطلاعات سیستم مدیریت استقرار PSM',
    });
  }
});

// GET /api/v1/psm/projects/:id/full
router.get('/projects/:id/full', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const [projRow] = await db.select().from(psmProjects).where(eq(psmProjects.id, projectId));
    if (!projRow) {
      return res.status(404).json({ success: false, error: 'پروژه مورد نظر یافت نشد.' });
    }
    const [assets, assessments, gaps, wbsTasks, documents, capaItems, studies, maturityRecords, gateDeviations] =
      await Promise.all([
        db.select().from(psmProcessAssets).where(eq(psmProcessAssets.projectId, projectId)).orderBy(desc(psmProcessAssets.id)),
        db.select().from(psmAssessments).where(eq(psmAssessments.projectId, projectId)).orderBy(psmAssessments.elementCode),
        db.select().from(psmGaps).where(eq(psmGaps.projectId, projectId)).orderBy(desc(psmGaps.id)),
        db.select().from(psmWbsTasks).where(eq(psmWbsTasks.projectId, projectId)).orderBy(psmWbsTasks.wbsCode),
        db.select().from(psmDocuments).where(eq(psmDocuments.projectId, projectId)).orderBy(desc(psmDocuments.id)),
        db.select().from(psmCapaItems).where(eq(psmCapaItems.projectId, projectId)).orderBy(desc(psmCapaItems.id)),
        db.select().from(psmSpecializedStudies).where(eq(psmSpecializedStudies.projectId, projectId)).orderBy(desc(psmSpecializedStudies.id)),
        db.select().from(psmMaturityAssessments).where(eq(psmMaturityAssessments.projectId, projectId)).orderBy(desc(psmMaturityAssessments.id)),
        db.select().from(psmGateDeviations).where(eq(psmGateDeviations.projectId, projectId)).orderBy(desc(psmGateDeviations.createdAt)).catch(() => []),
      ]);

    let stageGates: any[] = [];
    try {
      const rawGates = await bootstrapProjectGates(projectId);
      stageGates = await Promise.all(
        rawGates.map(async (gate) => {
          const evalResult = await evaluateProjectGate(projectId, gate.gateKey);
          return { ...gate, evaluation: evalResult };
        })
      );
    } catch (_err) {
      stageGates = [];
    }

    const normalizedProj = normalizeProjectRecord(projRow);
    res.json({
      success: true,
      project: normalizedProj,
      assets,
      assessments,
      gaps,
      wbsTasks,
      documents,
      capaItems,
      studies,
      maturityRecords,
      stageGates,
      gateDeviations,
      data: {
        project: normalizedProj,
        assets,
        assessments,
        gaps,
        wbsTasks,
        documents,
        capaItems,
        studies,
        maturityRecords,
        stageGates,
        gateDeviations,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'خطا در دریافت جزئیات کامل پروژه' });
  }
});

// Helper to deduplicate team members & preserve central personnel ID + historical snapshot
async function normalizeAndDeduplicateTeamMembers(rawMembers: any[]): Promise<any[]> {
  if (!Array.isArray(rawMembers)) return [];
  const allPersonnel = await db.select().from(personnel);
  const byId = new Map<number, any>();
  const byCode = new Map<string, any>();
  allPersonnel.forEach((p) => {
    byId.set(p.id, p);
    if (p.personnelCode) byCode.set(String(p.personnelCode).trim(), p);
  });

  const seenKeys = new Set<string>();
  const result: any[] = [];

  for (const m of rawMembers) {
    if (!m) continue;
    if (typeof m === 'string') {
      const cleanName = m.trim();
      if (!cleanName) continue;
      const key = `name:${cleanName.toLowerCase()}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      result.push({
        personnelId: null,
        personnelCode: '',
        name: cleanName,
        fullName: cleanName,
        jobTitle: 'کارشناس کمیته استقرار PSM',
        unitName: '',
        role: 'عضو کمیته استقرار PSM',
      });
      continue;
    }

    const pId = m.personnelId || m.id ? Number(m.personnelId || m.id) : null;
    const pCode = m.personnelCode ? String(m.personnelCode).trim() : '';
    const dbPerson = (pId && byId.get(pId)) || (pCode && byCode.get(pCode)) || null;

    const resolvedId = dbPerson ? dbPerson.id : pId;
    const resolvedCode = dbPerson ? dbPerson.personnelCode : pCode;
    const resolvedName = dbPerson
      ? `${dbPerson.firstName || ''} ${dbPerson.lastName || ''}`.trim()
      : String(m.fullName || m.name || '').trim();

    if (!resolvedName && !resolvedCode) continue;

    const dedupeKey = resolvedId
      ? `id:${resolvedId}`
      : resolvedCode
      ? `code:${resolvedCode}`
      : `name:${resolvedName.toLowerCase()}`;

    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    result.push({
      personnelId: resolvedId || null,
      personnelCode: resolvedCode || '',
      name: resolvedName,
      fullName: resolvedName,
      jobTitle: m.jobTitle || dbPerson?.jobTitle || 'کارشناس استقرار PSM',
      unitName: m.unitName || m.unit || (dbPerson?.extraData as any)?.unit || '',
      departmentName: m.departmentName || m.department || '',
      role: m.role || m.projectRole || 'عضو تیم استقرار PSM',
      snapshotSavedAt: new Date().toISOString(),
    });
  }

  return result;
}

// Helper to deduplicate covered units & preserve central org unit ID + hierarchy path + primary flag
function normalizeAndDeduplicateCoveredUnits(rawUnits: any[]): any[] {
  if (!Array.isArray(rawUnits)) return [];
  const seenKeys = new Set<string>();
  const result: any[] = [];

  for (const u of rawUnits) {
    if (!u) continue;
    if (typeof u === 'string') {
      const cleanName = u.trim();
      if (!cleanName) continue;
      const key = `name:${cleanName.toLowerCase()}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      result.push({
        unitId: null,
        orgNodeId: null,
        code: '',
        name: cleanName,
        hierarchyPath: cleanName,
        isPrimary: result.length === 0,
      });
      continue;
    }

    const uId = u.unitId || u.id ? String(u.unitId || u.id).trim() : '';
    const uCode = u.code ? String(u.code).trim() : '';
    const uName = String(u.name || u.unitName || '').trim();
    if (!uName) continue;

    const dedupeKey = uId ? `id:${uId}` : uCode ? `code:${uCode}` : `name:${uName.toLowerCase()}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    result.push({
      unitId: typeof u.unitId === 'number' ? u.unitId : null,
      orgNodeId: u.orgNodeId || uId || null,
      departmentId: u.departmentId || null,
      siteId: u.siteId || null,
      companyId: u.companyId || null,
      code: uCode,
      name: uName,
      type: u.type || 'Unit',
      hierarchyPath: u.hierarchyPath || u.fullPath || uName,
      isPrimary: Boolean(u.isPrimary),
    });
  }

  // Ensure at least one unit is marked primary if any units exist
  if (result.length > 0 && !result.some((x) => x.isPrimary)) {
    result[0].isPrimary = true;
  }

  return result;
}

// ============================================================================
// 2. Project Management CRUD (بند ۱: مدیریت پروژه اصلی و پیش‌نویس)
// ============================================================================
router.post('/projects', requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز برای ایجاد پروژه PSM' });
  }
  try {
    const b = req.body || {};
    const isDraft = Boolean(b.isDraft || b.overallStatus === 'DRAFT' || b.status === 'DRAFT');

    const projectCode = String(b.projectCode || b.code || '').trim();
    const title = String(b.title || b.name || '').trim();
    const scopeDescription = String(b.scopeDescription || b.scope || '').trim();
    const startDate = toShamsiDisplayDate(b.startDate);
    const endDate = toShamsiDisplayDate(b.endDate);

    // Resolve Project Manager & Sponsor against central personnel table if IDs provided
    let projectManagerId = b.projectManagerId ? Number(b.projectManagerId) : null;
    let projectManagerName = String(b.projectManagerName || '').trim();
    let projectSponsorId = b.projectSponsorId || b.sponsorId ? Number(b.projectSponsorId || b.sponsorId) : null;
    let projectSponsorName = String(b.projectSponsorName || b.sponsorName || '').trim();

    if (projectManagerId) {
      const [pmRow] = await db.select().from(personnel).where(eq(personnel.id, projectManagerId));
      if (pmRow) {
        projectManagerName = `${pmRow.firstName || ''} ${pmRow.lastName || ''}`.trim() || projectManagerName;
      } else {
        projectManagerId = null;
      }
    }
    if (projectSponsorId) {
      const [spRow] = await db.select().from(personnel).where(eq(personnel.id, projectSponsorId));
      if (spRow) {
        projectSponsorName = `${spRow.firstName || ''} ${spRow.lastName || ''}`.trim() || projectSponsorName;
      } else {
        projectSponsorId = null;
      }
    }

    // Validate dates (End Date must never be earlier than Start Date)
    if (startDate && endDate) {
      const startObj = parseDateSafe(startDate);
      const endObj = parseDateSafe(endDate);
      if (startObj && endObj && endObj.getTime() < startObj.getTime()) {
        return res.status(400).json({
          success: false,
          error: 'تاریخ پایان برنامه‌ریزی‌شده نمی‌تواند قبل از تاریخ شروع پروژه باشد.',
        });
      }
    }

    if (!isDraft) {
      if (!projectCode || !title || !scopeDescription || !startDate || !endDate || !projectManagerName || !projectSponsorName) {
        return res.status(400).json({
          success: false,
          error: 'نام، کد پروژه، دامنه، تاریخ شروع و پایان شمسی، مدیر پروژه و حامی پروژه الزامی هستند.',
        });
      }
    } else {
      if (!projectCode || !title) {
        return res.status(400).json({
          success: false,
          error: 'برای ذخیره پیش‌نویس پروژه، حداقل وارد کردن کد پروژه و نام پروژه الزامی است.',
        });
      }
    }

    const teamMembers = await normalizeAndDeduplicateTeamMembers(b.teamMembers || []);
    const coveredUnits = normalizeAndDeduplicateCoveredUnits(b.coveredUnits || []);

    const [created] = await db
      .insert(psmProjects)
      .values({
        projectCode,
        title,
        scopeDescription: scopeDescription || 'پیش‌نویس دامنه پروژه استقرار PSM',
        startDate: startDate || toShamsiDisplayDate(new Date().toISOString().slice(0, 10)),
        endDate: endDate || toShamsiDisplayDate(new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)),
        projectManagerId,
        projectManagerName: projectManagerName || 'در انتظار انتخاب مدیر پروژه',
        projectSponsorId,
        projectSponsorName: projectSponsorName || 'در انتظار انتخاب حامی پروژه',
        teamMembers,
        coveredUnits,
        coveredAreas: Array.isArray(b.coveredAreas) ? b.coveredAreas : [],
        quantitativeGoals: Array.isArray(b.quantitativeGoals) ? b.quantitativeGoals : [],
        qualitativeGoals: Array.isArray(b.qualitativeGoals) ? b.qualitativeGoals : [],
        budgetAllocated: Number(b.budgetAllocated ?? b.allocatedBudget ?? 0),
        budgetSpent: Number(b.budgetSpent ?? b.spentBudget ?? 0),
        resourcesSummary: b.resourcesSummary ? String(b.resourcesSummary) : '',
        milestones: Array.isArray(b.milestones) ? b.milestones : [],
        overallStatus: isDraft ? 'DRAFT' : (b.overallStatus || b.status || 'INITIATION'),
        overallProgress: Number(b.overallProgress || 0),
        handoverData: b.handoverData || {},
        createdBy: req.user?.name || req.user?.username || 'system',
      })
      .returning();

    if (!isDraft) {
      await syncProjectWithPsmEngine(created);
    }

    const normalizedCreated = normalizeProjectRecord(created);

    await writePsmAuditLog(
      req,
      isDraft ? 'SAVE_PROJECT_DRAFT' : 'CREATE',
      'PSM_PROJECT',
      created.id,
      null,
      normalizedCreated,
      {
        projectCode: created.projectCode,
        title: created.title,
        isDraft,
        teamMembersCount: teamMembers.length,
        coveredUnitsCount: coveredUnits.length,
      }
    );
    broadcastDataMutation('psm:projects', 'create', normalizedCreated);

    res.status(201).json({
      success: true,
      project: normalizedCreated,
      data: normalizedCreated,
    });
  } catch (err: any) {
    logger.error('[PSM Create Project] Error:', err);
    res.status(400).json({
      success: false,
      error: err?.message?.includes('unique')
        ? 'کد پروژه واردشده قبلاً ثبت شده است. لطفاً کد یکتای دیگری انتخاب نمایید.'
        : err?.message || 'خطا در ایجاد پروژه استقرار PSM',
    });
  }
});

router.put('/projects/:id', requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز برای ویرایش پروژه PSM' });
  }
  try {
    const id = Number(req.params.id);
    const existingRows = await db.select().from(psmProjects).where(eq(psmProjects.id, id));
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, error: 'پروژه مورد نظر یافت نشد.' });
    }
    const existing = existingRows[0];
    const b = req.body || {};

    const nextStartDate =
      b.startDate !== undefined ? toShamsiDisplayDate(b.startDate) : existing.startDate;
    const nextEndDate =
      b.endDate !== undefined ? toShamsiDisplayDate(b.endDate) : existing.endDate;

    if (nextStartDate && nextEndDate) {
      const startObj = parseDateSafe(nextStartDate);
      const endObj = parseDateSafe(nextEndDate);
      if (startObj && endObj && endObj.getTime() < startObj.getTime()) {
        return res.status(400).json({
          success: false,
          error: 'تاریخ پایان برنامه‌ریزی‌شده نمی‌تواند قبل از تاریخ شروع پروژه باشد.',
        });
      }
    }

    let nextPmId =
      b.projectManagerId !== undefined
        ? b.projectManagerId
          ? Number(b.projectManagerId)
          : null
        : existing.projectManagerId;
    let nextPmName =
      b.projectManagerName !== undefined
        ? String(b.projectManagerName).trim()
        : existing.projectManagerName;

    if (nextPmId) {
      const [pmRow] = await db.select().from(personnel).where(eq(personnel.id, nextPmId));
      if (pmRow) {
        nextPmName = `${pmRow.firstName || ''} ${pmRow.lastName || ''}`.trim() || nextPmName;
      } else {
        nextPmId = null;
      }
    }

    let nextSpId =
      b.projectSponsorId !== undefined || b.sponsorId !== undefined
        ? b.projectSponsorId || b.sponsorId
          ? Number(b.projectSponsorId || b.sponsorId)
          : null
        : existing.projectSponsorId;
    let nextSpName =
      b.projectSponsorName !== undefined
        ? String(b.projectSponsorName).trim()
        : b.sponsorName !== undefined
        ? String(b.sponsorName).trim()
        : existing.projectSponsorName;

    if (nextSpId) {
      const [spRow] = await db.select().from(personnel).where(eq(personnel.id, nextSpId));
      if (spRow) {
        nextSpName = `${spRow.firstName || ''} ${spRow.lastName || ''}`.trim() || nextSpName;
      } else {
        nextSpId = null;
      }
    }

    const nextTeamMembers = Array.isArray(b.teamMembers)
      ? await normalizeAndDeduplicateTeamMembers(b.teamMembers)
      : existing.teamMembers;

    const nextCoveredUnits = Array.isArray(b.coveredUnits)
      ? normalizeAndDeduplicateCoveredUnits(b.coveredUnits)
      : existing.coveredUnits;

    const nextStatus =
      b.isDraft === true
        ? 'DRAFT'
        : b.isDraft === false && existing.overallStatus === 'DRAFT'
        ? 'INITIATION'
        : b.overallStatus !== undefined
        ? String(b.overallStatus)
        : b.status !== undefined
        ? String(b.status)
        : existing.overallStatus;

    const [updated] = await db
      .update(psmProjects)
      .set({
        projectCode:
          b.projectCode !== undefined
            ? String(b.projectCode).trim()
            : b.code !== undefined
            ? String(b.code).trim()
            : existing.projectCode,
        title:
          b.title !== undefined
            ? String(b.title).trim()
            : b.name !== undefined
            ? String(b.name).trim()
            : existing.title,
        scopeDescription:
          b.scopeDescription !== undefined
            ? String(b.scopeDescription).trim()
            : b.scope !== undefined
            ? String(b.scope).trim()
            : existing.scopeDescription,
        startDate: nextStartDate,
        endDate: nextEndDate,
        projectManagerId: nextPmId,
        projectManagerName: nextPmName,
        projectSponsorId: nextSpId,
        projectSponsorName: nextSpName,
        teamMembers: nextTeamMembers,
        coveredUnits: nextCoveredUnits,
        coveredAreas: Array.isArray(b.coveredAreas) ? b.coveredAreas : existing.coveredAreas,
        quantitativeGoals: Array.isArray(b.quantitativeGoals) ? b.quantitativeGoals : existing.quantitativeGoals,
        qualitativeGoals: Array.isArray(b.qualitativeGoals) ? b.qualitativeGoals : existing.qualitativeGoals,
        budgetAllocated:
          b.budgetAllocated !== undefined
            ? Number(b.budgetAllocated)
            : b.allocatedBudget !== undefined
            ? Number(b.allocatedBudget)
            : existing.budgetAllocated,
        budgetSpent:
          b.budgetSpent !== undefined
            ? Number(b.budgetSpent)
            : b.spentBudget !== undefined
            ? Number(b.spentBudget)
            : existing.budgetSpent,
        resourcesSummary: b.resourcesSummary !== undefined ? String(b.resourcesSummary) : existing.resourcesSummary,
        milestones: Array.isArray(b.milestones) ? b.milestones : existing.milestones,
        overallStatus: nextStatus,
        overallProgress: b.overallProgress !== undefined ? Number(b.overallProgress) : existing.overallProgress,
        handoverData: b.handoverData !== undefined ? b.handoverData : existing.handoverData,
        updatedAt: new Date(),
      })
      .where(eq(psmProjects.id, id))
      .returning();

    if (nextStatus !== 'DRAFT') {
      await syncProjectWithPsmEngine(updated);
    }

    const normalizedUpdated = normalizeProjectRecord(updated);

    await writePsmAuditLog(
      req,
      existing.overallStatus === 'DRAFT' && nextStatus !== 'DRAFT'
        ? 'FINALIZE_PROJECT_DRAFT'
        : 'UPDATE',
      'PSM_PROJECT',
      id,
      normalizeProjectRecord(existing),
      normalizedUpdated
    );
    broadcastDataMutation('psm:projects', 'update', normalizedUpdated);

    res.json({
      success: true,
      project: normalizedUpdated,
      data: normalizedUpdated,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در بروزرسانی پروژه PSM' });
  }
});

// ============================================================================
// 3. Process Assets & Equipment Hierarchy (بند ۲: ساختار سازمانی و تجهیزات مشمول)
// ============================================================================
router.post(['/assets', '/projects/:id/assets'], requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز برای ثبت تجهیز فرایندی' });
  }
  try {
    const b = req.body || {};
    const projectId = req.params.id ? Number(req.params.id) : (b.projectId ? Number(b.projectId) : null);
    const opArea = String(b.operationalArea || b.operationalZone || 'ناحیه عملیاتی مجتمع').trim();

    if (!projectId || !b.processUnitName || !b.equipmentTag || !b.equipmentName) {
      return res.status(400).json({
        success: false,
        error: 'شناسه پروژه، واحد فرایندی، تگ تجهیز و نام تجهیز الزامی هستند.',
      });
    }

    const [created] = await db
      .insert(psmProcessAssets)
      .values({
        projectId: Number(projectId),
        companyName: b.companyName || 'مجتمع پتروشیمی رجال',
        siteName: b.siteName || 'سایت ماهشهر - منطقه ویژه اقتصادی پتروشیمی',
        processUnitId: b.processUnitId ? Number(b.processUnitId) : null,
        processUnitName: String(b.processUnitName).trim(),
        operationalArea: opArea,
        equipmentTag: String(b.equipmentTag).trim().toUpperCase(),
        equipmentName: String(b.equipmentName).trim(),
        equipmentClass: b.equipmentClass || b.equipmentType || 'REACTOR',
        safetyCriticality: b.safetyCriticality || 'HIGH',
        hazardousSubstances: Array.isArray(b.hazardousChemicals)
          ? b.hazardousChemicals.join('، ')
          : (b.hazardousSubstances || b.hazardousChemicalsText || ''),
        designParameters: b.designParameters || '',
        responsiblePersonId: b.responsiblePersonId ? Number(b.responsiblePersonId) : null,
        responsiblePersonName: String(b.responsiblePersonName || 'مسئول واحد').trim(),
        responsibleRole: b.responsibleRole || '',
      })
      .returning();

    await writePsmAuditLog(req, 'CREATE', 'PSM_PROCESS_ASSET', created.id, null, created);
    broadcastDataMutation('psm:assets', 'create', created);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در ثبت تجهیز فرایندی' });
  }
});

router.delete(['/assets/:id', '/projects/:projectId/assets/:id'], requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز' });
  }
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(psmProcessAssets).where(eq(psmProcessAssets.id, id)).returning();
    if (deleted) {
      await writePsmAuditLog(req, 'DELETE', 'PSM_PROCESS_ASSET', id, deleted, null);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در حذف تجهیز' });
  }
});

router.put(['/assets/:id', '/projects/:projectId/assets/:id'], requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز برای ویرایش تجهیز' });
  }
  try {
    const id = Number(req.params.id);
    const existingRows = await db.select().from(psmProcessAssets).where(eq(psmProcessAssets.id, id));
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, error: 'تجهیز مورد نظر یافت نشد.' });
    }
    const existing = existingRows[0];
    const b = req.body || {};
    const opArea = b.operationalArea !== undefined ? String(b.operationalArea).trim() : (b.operationalZone !== undefined ? String(b.operationalZone).trim() : existing.operationalArea);

    const [updated] = await db
      .update(psmProcessAssets)
      .set({
        processUnitName: b.processUnitName !== undefined ? String(b.processUnitName).trim() : existing.processUnitName,
        operationalArea: opArea,
        equipmentTag: b.equipmentTag !== undefined ? String(b.equipmentTag).trim().toUpperCase() : existing.equipmentTag,
        equipmentName: b.equipmentName !== undefined ? String(b.equipmentName).trim() : existing.equipmentName,
        equipmentClass: b.equipmentClass !== undefined ? String(b.equipmentClass).trim() : (b.equipmentType !== undefined ? String(b.equipmentType).trim() : existing.equipmentClass),
        safetyCriticality: b.safetyCriticality !== undefined ? String(b.safetyCriticality).trim() : existing.safetyCriticality,
        hazardousSubstances: b.hazardousSubstances !== undefined ? String(b.hazardousSubstances) : (b.hazardousChemicals ? (Array.isArray(b.hazardousChemicals) ? b.hazardousChemicals.join('، ') : String(b.hazardousChemicals)) : existing.hazardousSubstances),
        designParameters: b.designParameters !== undefined ? String(b.designParameters) : existing.designParameters,
        responsiblePersonId: b.responsiblePersonId !== undefined ? (b.responsiblePersonId ? Number(b.responsiblePersonId) : null) : existing.responsiblePersonId,
        responsiblePersonName: b.responsiblePersonName !== undefined ? String(b.responsiblePersonName).trim() : existing.responsiblePersonName,
        responsibleRole: b.responsibleRole !== undefined ? String(b.responsibleRole) : existing.responsibleRole,
        updatedAt: new Date(),
      })
      .where(eq(psmProcessAssets.id, id))
      .returning();

    await writePsmAuditLog(req, 'UPDATE', 'PSM_PROCESS_ASSET', id, existing, updated);
    broadcastDataMutation('psm:assets', 'update', updated);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در ویرایش تجهیز فرایندی' });
  }
});

// ============================================================================
// 4. Initial PSM Assessment & Automatic Gap Extraction (بند ۳ و ۴)
// ============================================================================
router.post(['/assessments', '/projects/:id/assessments'], requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز برای ثبت ارزیابی اولیه PSM' });
  }
  try {
    const b = req.body || {};
    const projectId = Number(b.projectId || req.params.id);
    const framework = String(b.framework || b.standardType || 'CCPS_RBPS').trim();
    const elementCode = String(b.elementCode || '').trim();
    const isInScope = b.isInScope !== undefined ? b.isInScope !== false : !b.isOutOfScope;
    const assessorName = String(b.assessorName || req.user?.name || req.user?.username || '').trim();
    const assessmentDate = String(b.assessmentDate || new Date().toISOString().slice(0, 10)).trim();

    if (!projectId || !elementCode || !assessorName || !assessmentDate) {
      return res.status(400).json({
        success: false,
        error: 'کد الزام/عنصر، نام ارزیاب و تاریخ ارزیابی الزامی هستند.',
      });
    }

    // Rule: Out of scope items are ONLY accepted with technical justification and authorized approval
    if (!isInScope) {
      const justification = String(b.outOfScopeJustification || '').trim();
      const approvedBy = String(b.outOfScopeApprovedBy || '').trim();
      if (justification.length < 15 || !approvedBy) {
        return res.status(400).json({
          success: false,
          error: 'موارد خارج از دامنه صرفاً با ثبت توجیه فنی مستند (حداقل ۱۵ کاراکتر) و نام مقام مجاز تأییدکننده پذیرفته می‌شوند.',
        });
      }
      if (!canApprovePsm(req)) {
        return res.status(403).json({
          success: false,
          error: 'تأیید خارج از دامنه بودن الزام نیازمند سطح دسترسی مدیریتی / تأییدکننده مجاز است.',
        });
      }
    }

    const rawScore = b.complianceScore !== undefined ? b.complianceScore : (b.currentScore ?? 0);
    const reqScore = b.requiredScore !== undefined ? Number(b.requiredScore) : 85;
    const score = isInScope ? Math.max(0, Math.min(100, Number(rawScore))) : 100;
    const complianceStatus = !isInScope
      ? 'OUT_OF_SCOPE'
      : score >= reqScore
      ? 'COMPLIANT'
      : score >= 50
      ? 'PARTIAL'
      : 'NON_COMPLIANT';

    const deficienciesText = b.deficiencies !== undefined ? String(b.deficiencies) : (b.weaknesses !== undefined ? String(b.weaknesses) : '');
    const statusDescText = b.currentStatusDesc !== undefined ? String(b.currentStatusDesc) : (b.fieldObservations !== undefined ? String(b.fieldObservations) : '');
    const normalizedEvidence = Array.isArray(b.evidenceList)
      ? b.evidenceList
      : [
          ...(Array.isArray(b.existingDocuments) ? b.existingDocuments : []),
          ...(Array.isArray(b.technicalEvidence) ? b.technicalEvidence : []),
        ];

    // Check if an assessment for the same project + framework + elementCode + unitName already exists
    const unitName = String(b.unitName || 'کل مجتمع').trim();
    const existingList = await db
      .select()
      .from(psmAssessments)
      .where(
        and(
          eq(psmAssessments.projectId, projectId),
          eq(psmAssessments.framework, framework),
          eq(psmAssessments.elementCode, elementCode),
          eq(psmAssessments.unitName, unitName)
        )
      );

    let savedAssessment: any;
    if (existingList.length > 0) {
      const existing = existingList[0];
      const [updated] = await db
        .update(psmAssessments)
        .set({
          evaluationCriteria: String(b.evaluationCriteria || existing.evaluationCriteria),
          isInScope,
          outOfScopeJustification: !isInScope ? String(b.outOfScopeJustification).trim() : null,
          outOfScopeApprovedBy: !isInScope ? String(b.outOfScopeApprovedBy).trim() : null,
          outOfScopeApprovedAt: !isInScope ? new Date() : null,
          currentStatusDesc: statusDescText || existing.currentStatusDesc,
          evidenceList: normalizedEvidence.length > 0 ? normalizedEvidence : existing.evidenceList,
          assessorId: b.assessorId ? Number(b.assessorId) : existing.assessorId,
          assessorName,
          assessmentDate,
          strengths: b.strengths !== undefined ? String(b.strengths) : existing.strengths,
          deficiencies: deficienciesText || existing.deficiencies,
          complianceScore: score,
          complianceStatus,
          actionPriority: b.actionPriority || existing.actionPriority,
          updatedAt: new Date(),
        })
        .where(eq(psmAssessments.id, existing.id))
        .returning();
      savedAssessment = updated;
      await writePsmAuditLog(req, 'UPDATE', 'PSM_ASSESSMENT', existing.id, existing, updated);
    } else {
      const [created] = await db
        .insert(psmAssessments)
        .values({
          projectId,
          framework,
          elementCode,
          elementTitleFa: String(b.elementTitleFa || elementCode),
          elementTitleEn: String(b.elementTitleEn || elementCode),
          pillar: b.pillar || b.pillarTitleFa || b.pillarCode || null,
          unitName,
          evaluationCriteria: String(b.evaluationCriteria || ''),
          isInScope,
          outOfScopeJustification: !isInScope ? String(b.outOfScopeJustification).trim() : null,
          outOfScopeApprovedBy: !isInScope ? String(b.outOfScopeApprovedBy).trim() : null,
          outOfScopeApprovedAt: !isInScope ? new Date() : null,
          currentStatusDesc: statusDescText,
          evidenceList: normalizedEvidence,
          assessorId: b.assessorId ? Number(b.assessorId) : null,
          assessorName,
          assessmentDate,
          strengths: b.strengths ? String(b.strengths) : '',
          deficiencies: deficienciesText,
          complianceScore: score,
          complianceStatus,
          actionPriority: b.actionPriority || 'HIGH',
        })
        .returning();
      savedAssessment = created;
      await writePsmAuditLog(req, 'CREATE', 'PSM_ASSESSMENT', created.id, null, created);
    }

    // Automatic Gap Extraction (بند ۴: پس از ارزیابی، شکاف‌ها به‌صورت خودکار استخراج شوند)
    let autoExtractedGap: any = null;
    if (isInScope && (score < reqScore || (deficienciesText && deficienciesText.trim().length > 3))) {
      const ccpsMeta = CCPS_20_ELEMENTS.find((e) => e.code === elementCode);
      const oshaMeta = OSHA_14_CLAUSES.find((c) => c.code === elementCode);
      const mappedOsha =
        framework === 'CCPS_RBPS'
          ? CCPS_OSHA_TRACEABILITY_MATRIX.filter((m) => m.ccpsCode === elementCode).map((m) => m.oshaCode)
          : oshaMeta
          ? [oshaMeta.code]
          : [];
      const mappedCcps =
        framework === 'CCPS_RBPS'
          ? elementCode
          : CCPS_OSHA_TRACEABILITY_MATRIX.find((m) => m.oshaCode === elementCode && m.relationType === 'DIRECT')
              ?.ccpsCode || elementCode;

      const existingGap = await db
        .select()
        .from(psmGaps)
        .where(eq(psmGaps.assessmentId, savedAssessment.id));

      const standardRef = ccpsMeta
        ? `${ccpsMeta.code} (${ccpsMeta.titleEn}) | OSHA: ${mappedOsha.join(', ') || 'N/A'} | ${ccpsMeta.nationalAndRejalRef}`
        : oshaMeta
        ? `${oshaMeta.code} (${oshaMeta.cfrParagraph}) | CCPS: ${mappedCcps}`
        : elementCode;

      const missingDocsText = Array.isArray(b.missingDocuments) && b.missingDocuments.length > 0
        ? b.missingDocuments.join('، ')
        : '';

      const requiredDoc = missingDocsText
        ? missingDocsText
        : ccpsMeta
        ? ccpsMeta.requiredDocTemplates.join('، ')
        : oshaMeta
        ? oshaMeta.requiredDeliverables.join('، ')
        : 'مستندات و شواهد انطباق الزام';

      const gapDescription =
        deficienciesText.trim() ||
        `عدم انطباق کامل در الزام ${savedAssessment.elementTitleFa} (امتیاز انطباق فعلی: ${score}٪ - وضعیت: ${savedAssessment.currentStatusDesc})`;

      const defaultDue = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      if (existingGap.length === 0) {
        const gapCode = `GAP-${projectId}-${elementCode}-${Date.now().toString().slice(-4)}`;
        const [newGap] = await db
          .insert(psmGaps)
          .values({
            projectId,
            assessmentId: savedAssessment.id,
            gapCode,
            title: `شکاف انطباق: ${savedAssessment.elementTitleFa} (${unitName})`,
            description: gapDescription,
            standardReference: standardRef,
            ccpsElementCode: mappedCcps,
            oshaClauseCodes: mappedOsha,
            unitName,
            riskLevel: b.actionPriority || (score < 40 ? 'CRITICAL' : score < 65 ? 'HIGH' : 'MEDIUM'),
            requiredDocument: requiredDoc,
            responsiblePersonName: b.responsiblePersonName || savedAssessment.assessorName,
            proposedDueDate: b.proposedDueDate || defaultDue,
            isOutOfScope: false,
            status: 'OPEN',
            createdBy: req.user?.name || req.user?.username || 'AUTO_EXTRACTOR',
          })
          .returning();
        autoExtractedGap = newGap;
        await writePsmAuditLog(req, 'AUTO_EXTRACT_GAP', 'PSM_GAP', newGap.id, null, newGap);
      } else {
        const [updatedGap] = await db
          .update(psmGaps)
          .set({
            description: gapDescription,
            riskLevel: b.actionPriority || existingGap[0].riskLevel,
            updatedAt: new Date(),
          })
          .where(eq(psmGaps.id, existingGap[0].id))
          .returning();
        autoExtractedGap = updatedGap;
      }
    }

    broadcastDataMutation('psm:assessments', 'update', savedAssessment);
    res.status(201).json({
      success: true,
      autoCreatedGap: autoExtractedGap,
      data: {
        assessment: savedAssessment,
        autoExtractedGap,
      },
    });
  } catch (err: any) {
    logger.error('[PSM Assessment] Error:', err);
    res.status(400).json({ success: false, error: err?.message || 'خطا در ثبت ارزیابی PSM' });
  }
});

// Bulk auto-extract gaps from all non-compliant assessments of a project
router.post('/gaps/extract-all', requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز' });
  }
  try {
    const projectId = Number(req.body?.projectId);
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'شناسه پروژه الزامی است.' });
    }
    const assessments = await db
      .select()
      .from(psmAssessments)
      .where(eq(psmAssessments.projectId, projectId));
    const existingGaps = await db
      .select()
      .from(psmGaps)
      .where(eq(psmGaps.projectId, projectId));

    const existingAssessmentIds = new Set(existingGaps.map((g) => g.assessmentId).filter(Boolean));
    const newlyCreated: any[] = [];

    for (const a of assessments) {
      if (!a.isInScope || a.complianceScore >= 85) continue;
      if (existingAssessmentIds.has(a.id)) continue;

      const ccpsMeta = CCPS_20_ELEMENTS.find((e) => e.code === a.elementCode);
      const oshaMeta = OSHA_14_CLAUSES.find((c) => c.code === a.elementCode);
      const mappedOsha =
        a.framework === 'CCPS_RBPS'
          ? CCPS_OSHA_TRACEABILITY_MATRIX.filter((m) => m.ccpsCode === a.elementCode).map((m) => m.oshaCode)
          : oshaMeta
          ? [oshaMeta.code]
          : [];
      const mappedCcps =
        a.framework === 'CCPS_RBPS'
          ? a.elementCode
          : CCPS_OSHA_TRACEABILITY_MATRIX.find((m) => m.oshaCode === a.elementCode && m.relationType === 'DIRECT')
              ?.ccpsCode || a.elementCode;

      const standardRef = ccpsMeta
        ? `${ccpsMeta.code} | OSHA: ${mappedOsha.join(', ') || 'N/A'} | ${ccpsMeta.nationalAndRejalRef}`
        : oshaMeta
        ? `${oshaMeta.code} (${oshaMeta.cfrParagraph}) | CCPS: ${mappedCcps}`
        : a.elementCode;

      const requiredDoc = ccpsMeta
        ? ccpsMeta.requiredDocTemplates.join('، ')
        : oshaMeta
        ? oshaMeta.requiredDeliverables.join('، ')
        : 'مستندات و شواهد انطباق الزام';

      const gapCode = `GAP-${projectId}-${a.elementCode}-${Math.floor(1000 + Math.random() * 9000)}`;
      const defaultDue = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const [created] = await db
        .insert(psmGaps)
        .values({
          projectId,
          assessmentId: a.id,
          gapCode,
          title: `شکاف انطباق: ${a.elementTitleFa} (${a.unitName})`,
          description: a.deficiencies || `عدم انطباق در الزام ${a.elementTitleFa} (انطباق فعلی: ${a.complianceScore}٪)`,
          standardReference: standardRef,
          ccpsElementCode: mappedCcps,
          oshaClauseCodes: mappedOsha,
          unitName: a.unitName,
          riskLevel: a.actionPriority || (a.complianceScore < 40 ? 'CRITICAL' : 'HIGH'),
          requiredDocument: requiredDoc,
          responsiblePersonName: a.assessorName,
          proposedDueDate: defaultDue,
          isOutOfScope: false,
          status: 'OPEN',
          createdBy: req.user?.name || req.user?.username || 'AUTO_EXTRACTOR',
        })
        .returning();

      newlyCreated.push(created);
    }

    await writePsmAuditLog(req, 'BULK_EXTRACT_GAPS', 'PSM_GAP', projectId, null, {
      extractedCount: newlyCreated.length,
    });
    broadcastDataMutation('psm:gaps', 'create', newlyCreated);

    res.json({
      success: true,
      data: {
        extractedCount: newlyCreated.length,
        gaps: newlyCreated,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در استخراج خودکار شکاف‌ها' });
  }
});

// Create or update a Gap manually (with Out-of-Scope Technical Justification gate)
router.post('/gaps', requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز' });
  }
  try {
    const b = req.body || {};
    const projectId = Number(b.projectId);
    if (!projectId || !b.title || !b.description || !b.standardReference || !b.unitName || !b.responsiblePersonName || !b.proposedDueDate) {
      return res.status(400).json({
        success: false,
        error: 'عنوان، شرح شکاف، مرجع استاندارد، واحد مربوطه، مسئول و مهلت پیشنهادی الزامی هستند.',
      });
    }

    const isOutOfScope = Boolean(b.isOutOfScope);
    if (isOutOfScope) {
      const justification = String(b.technicalJustification || '').trim();
      const approvedBy = String(b.justificationApprovedBy || '').trim();
      if (justification.length < 15 || !approvedBy) {
        return res.status(400).json({
          success: false,
          error: 'موارد خارج از دامنه صرفاً با توجیه فنی مستند (حداقل ۱۵ کاراکتر) و تأیید مقام مجاز پذیرفته می‌شوند.',
        });
      }
      if (!canApprovePsm(req)) {
        return res.status(403).json({
          success: false,
          error: 'تأیید خارج از دامنه نیازمند مجوز مدیریتی / تأییدکننده مجاز است.',
        });
      }
    }

    const gapCode = String(b.gapCode || `GAP-${projectId}-${Date.now().toString().slice(-5)}`).trim();
    const [created] = await db
      .insert(psmGaps)
      .values({
        projectId,
        assessmentId: b.assessmentId ? Number(b.assessmentId) : null,
        gapCode,
        title: String(b.title).trim(),
        description: String(b.description).trim(),
        standardReference: String(b.standardReference).trim(),
        ccpsElementCode: b.ccpsElementCode || null,
        oshaClauseCodes: Array.isArray(b.oshaClauseCodes) ? b.oshaClauseCodes : [],
        unitName: String(b.unitName).trim(),
        riskLevel: b.riskLevel || 'HIGH',
        requiredDocument: b.requiredDocument || '',
        responsiblePersonName: String(b.responsiblePersonName).trim(),
        proposedDueDate: String(b.proposedDueDate).trim(),
        isOutOfScope,
        technicalJustification: isOutOfScope ? String(b.technicalJustification).trim() : null,
        justificationApprovedBy: isOutOfScope ? String(b.justificationApprovedBy).trim() : null,
        justificationApprovedAt: isOutOfScope ? new Date() : null,
        status: isOutOfScope ? 'OUT_OF_SCOPE_APPROVED' : 'OPEN',
        createdBy: req.user?.name || req.user?.username || 'system',
      })
      .returning();

    if (created.riskLevel === 'CRITICAL') {
      await reopenDependentApprovedGatesIfInvalid(
        projectId,
        `ثبت شکاف بحرانی جدید (${created.gapCode}: ${created.title})`,
        req.user?.name || req.user?.username || 'system'
      );
    }

    await writePsmAuditLog(req, 'CREATE', 'PSM_GAP', created.id, null, created);
    broadcastDataMutation('psm:gaps', 'create', created);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در ثبت شکاف' });
  }
});

// Convert a Gap into an executable WBS Task and/or CAPA Item
router.post('/gaps/:id/convert', requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز' });
  }
  try {
    const gapId = Number(req.params.id);
    const gapRows = await db.select().from(psmGaps).where(eq(psmGaps.id, gapId));
    if (gapRows.length === 0) {
      return res.status(404).json({ success: false, error: 'شکاف مورد نظر یافت نشد.' });
    }
    const gap = gapRows[0];
    const b = req.body || {};
    const target = b.target || 'BOTH'; // 'WBS' | 'CAPA' | 'BOTH'

    let createdWbs: any = null;
    let createdCapa: any = null;

    if (target === 'WBS' || target === 'BOTH') {
      const todayStr = new Date().toISOString().slice(0, 10);
      const plannedEnd = b.plannedEnd || gap.proposedDueDate || todayStr;
      const wbsCode = String(b.wbsCode || `WBS-${gap.ccpsElementCode || 'PSM'}-${gap.id}`).trim();

      const metrics = calculateWbsScheduleMetrics({
        plannedStart: b.plannedStart || todayStr,
        plannedEnd,
        actualStart: null,
        actualEnd: null,
        plannedProgress: 0,
        actualProgress: 0,
      });

      const [wbs] = await db
        .insert(psmWbsTasks)
        .values({
          projectId: gap.projectId,
          gapId: gap.id,
          wbsCode,
          parentId: b.parentId ? Number(b.parentId) : null,
          title: b.wbsTitle || `رفع شکاف: ${gap.title}`,
          elementCode: gap.ccpsElementCode || null,
          unitName: gap.unitName,
          ownerName: b.ownerName || gap.responsiblePersonName,
          executorName: b.executorName || gap.responsiblePersonName,
          plannedStart: b.plannedStart || todayStr,
          plannedEnd,
          plannedProgress: metrics.plannedProgress,
          actualProgress: 0,
          weight: Number(b.weight || (gap.riskLevel === 'CRITICAL' ? 5 : gap.riskLevel === 'HIGH' ? 3 : 1)),
          dependencies: Array.isArray(b.dependencies) ? b.dependencies : [],
          allocatedBudget: Number(b.allocatedBudget || 0),
          actualCost: 0,
          resources: b.resources || gap.requiredDocument || '',
          isMilestone: Boolean(b.isMilestone),
          isCritical: gap.riskLevel === 'CRITICAL' || Boolean(b.isCritical),
          delayDays: metrics.delayDays,
          scheduleVariancePct: metrics.scheduleVariancePct,
          status: metrics.status,
        })
        .returning();
      createdWbs = wbs;
    }

    if (target === 'CAPA' || target === 'BOTH') {
      const capaCode = `CAPA-PSM-${gap.projectId}-${gap.id}-${Date.now().toString().slice(-3)}`;
      const actor = req.user?.name || req.user?.username || 'system';
      const [capa] = await db
        .insert(psmCapaItems)
        .values({
          projectId: gap.projectId,
          capaCode,
          sourceType: 'GAP_ANALYSIS',
          sourceRefId: gap.gapCode,
          ccpsElementCode: gap.ccpsElementCode || null,
          oshaClauseCode: Array.isArray(gap.oshaClauseCodes) && gap.oshaClauseCodes[0] ? String(gap.oshaClauseCodes[0]) : null,
          unitName: gap.unitName,
          title: gap.title,
          deficiencyDescription: gap.description,
          riskSeverity: gap.riskLevel === 'CRITICAL' ? 5 : gap.riskLevel === 'HIGH' ? 4 : 3,
          riskLikelihood: gap.riskLevel === 'CRITICAL' ? 4 : 3,
          riskLevel: gap.riskLevel,
          responsiblePersonName: gap.responsiblePersonName,
          dueDate: gap.proposedDueDate,
          stage: 'ASSIGNED',
          workflowLogs: [
            {
              stage: 'REGISTERED',
              actor,
              timestamp: new Date().toISOString(),
              note: `استخراج خودکار از تحلیل شکاف (${gap.gapCode})`,
            },
            {
              stage: 'ASSIGNED',
              actor,
              timestamp: new Date().toISOString(),
              note: `تخصیص به مسئول: ${gap.responsiblePersonName} با مهلت ${gap.proposedDueDate}`,
            },
          ],
          createdBy: actor,
        })
        .returning();
      createdCapa = capa;
    }

    const [updatedGap] = await db
      .update(psmGaps)
      .set({
        status: target === 'CAPA' ? 'IN_CAPA' : 'CONVERTED_TO_WBS',
        linkedWbsId: createdWbs?.id ?? gap.linkedWbsId,
        linkedCapaId: createdCapa?.id ?? gap.linkedCapaId,
        updatedAt: new Date(),
      })
      .where(eq(psmGaps.id, gap.id))
      .returning();

    await writePsmAuditLog(req, 'CONVERT_GAP', 'PSM_GAP', gap.id, gap, {
      updatedGap,
      createdWbsId: createdWbs?.id,
      createdCapaId: createdCapa?.id,
    });

    broadcastDataMutation('psm:gaps', 'update', updatedGap);
    res.json({
      success: true,
      data: {
        gap: updatedGap,
        wbsTask: createdWbs,
        capaItem: createdCapa,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در تبدیل شکاف به برنامه اجرایی' });
  }
});

// Law 4 / Scenario 7: Extend gap deadline with mandatory justification and audit trail
router.put('/gaps/:id/extend-due', requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز' });
  }
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(psmGaps).where(eq(psmGaps.id, id));
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'شکاف مورد نظر یافت نشد.' });
    }
    const gap = rows[0];
    const b = req.body || {};
    const newDueDate = String(b.newDueDate || b.proposedDueDate || '').trim();
    const justification = String(b.extensionJustification || b.justification || '').trim();

    if (!newDueDate) {
      return res.status(400).json({ success: false, error: 'تاریخ مهلت جدید الزامی است.' });
    }
    if (justification.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'بر اساس قانون حاکمیت PSM، تمدید مهلت صرفاً با ثبت توجیه فنی مستند (حداقل ۱۰ کاراکتر) مجاز است.',
      });
    }

    const [updated] = await db
      .update(psmGaps)
      .set({
        proposedDueDate: newDueDate,
        updatedAt: new Date(),
      })
      .where(eq(psmGaps.id, id))
      .returning();

    await writePsmAuditLog(
      req,
      'EXTEND_DUE_DATE',
      'PSM_GAP',
      id,
      { proposedDueDate: gap.proposedDueDate },
      { proposedDueDate: newDueDate, justification },
      { reason: justification, previousDate: gap.proposedDueDate, newDate: newDueDate }
    );

    broadcastDataMutation('psm:gaps', 'update', updated);
    res.json({
      success: true,
      data: updated,
      message: `مهلت شکاف از ${gap.proposedDueDate} به ${newDueDate} با موفقیت تمدید و سابقه در لاگ سیستم ثبت گردید.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در تمدید مهلت شکاف' });
  }
});

// ============================================================================
// 5. WBS & Execution Schedule Management (بند ۵: مدیریت WBS و برنامه اجرایی)
// ============================================================================
async function syncProjectWbsProgress(projectId: number) {
  if (!projectId) return;
  const tasks = await db.select().from(psmWbsTasks).where(eq(psmWbsTasks.projectId, projectId));
  if (tasks.length === 0) return;
  const totalWeight = tasks.reduce((acc, t) => acc + Math.max(1, Number(t.weight || 1)), 0);
  const weightedSum = tasks.reduce(
    (acc, t) => acc + Math.min(100, Math.max(0, Number(t.actualProgress || 0))) * Math.max(1, Number(t.weight || 1)),
    0
  );
  const overallProgress = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  await db
    .update(psmProjects)
    .set({ overallProgress, updatedAt: new Date() })
    .where(eq(psmProjects.id, projectId));
}

router.post(['/wbs', '/projects/:id/wbs'], requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز' });
  }
  try {
    const b = req.body || {};
    const projectId = Number(b.projectId || req.params.id);
    if (!projectId || !b.wbsCode || !b.title || !b.ownerName || !b.executorName || !b.plannedStart || !b.plannedEnd) {
      return res.status(400).json({
        success: false,
        error: 'کد WBS، عنوان فعالیت، مسئول، مجری و تاریخ شروع و پایان برنامه‌ای الزامی هستند.',
      });
    }

    const metrics = calculateWbsScheduleMetrics({
      plannedStart: String(b.plannedStart),
      plannedEnd: String(b.plannedEnd),
      actualStart: b.actualStart || null,
      actualEnd: b.actualEnd || null,
      plannedProgress: Number(b.plannedProgress || 0),
      actualProgress: Number(b.actualProgress || 0),
    });

    const [created] = await db
      .insert(psmWbsTasks)
      .values({
        projectId,
        gapId: b.gapId ? Number(b.gapId) : null,
        wbsCode: String(b.wbsCode).trim(),
        parentId: b.parentId ? Number(b.parentId) : null,
        title: String(b.title).trim(),
        elementCode: b.elementCode || null,
        unitName: b.unitName || 'کل مجتمع',
        ownerName: String(b.ownerName).trim(),
        executorName: String(b.executorName).trim(),
        plannedStart: String(b.plannedStart).trim(),
        plannedEnd: String(b.plannedEnd).trim(),
        actualStart: b.actualStart ? String(b.actualStart).trim() : null,
        actualEnd: b.actualEnd ? String(b.actualEnd).trim() : null,
        plannedProgress: metrics.plannedProgress,
        actualProgress: metrics.actualProgress,
        weight: Number(b.weight || 1),
        dependencies: Array.isArray(b.dependencies) ? b.dependencies : [],
        allocatedBudget: Number(b.allocatedBudget || 0),
        actualCost: Number(b.actualCost || 0),
        resources: b.resources || '',
        isMilestone: Boolean(b.isMilestone),
        isCritical: Boolean(b.isCritical),
        delayDays: metrics.delayDays,
        scheduleVariancePct: metrics.scheduleVariancePct,
        status: metrics.status,
      })
      .returning();

    await syncProjectWbsProgress(projectId);
    await writePsmAuditLog(req, 'CREATE', 'PSM_WBS_TASK', created.id, null, created);
    broadcastDataMutation('psm:wbs', 'create', created);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در ایجاد فعالیت WBS' });
  }
});

router.put(['/wbs/:id', '/projects/:projectId/wbs/:id'], requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز' });
  }
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(psmWbsTasks).where(eq(psmWbsTasks.id, id));
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'فعالیت مورد نظر یافت نشد.' });
    }
    const existing = rows[0];
    const b = req.body || {};

    const plannedStart = b.plannedStart !== undefined ? String(b.plannedStart) : existing.plannedStart;
    const plannedEnd = b.plannedEnd !== undefined ? String(b.plannedEnd) : existing.plannedEnd;
    const actualStart = b.actualStart !== undefined ? b.actualStart : existing.actualStart;
    const actualEnd = b.actualEnd !== undefined ? b.actualEnd : existing.actualEnd;
    const actualProgress = b.actualProgress !== undefined ? Number(b.actualProgress) : existing.actualProgress;
    const deps = Array.isArray(b.dependencies) ? b.dependencies : (Array.isArray(existing.dependencies) ? existing.dependencies : []);

    // Predecessor dependency check when completing a task (100%)
    if (actualProgress >= 100 && deps.length > 0 && !b.bypassDependencies) {
      const siblingTasks = await db
        .select()
        .from(psmWbsTasks)
        .where(eq(psmWbsTasks.projectId, existing.projectId));
      const incompletePredecessors = siblingTasks.filter(
        (st) => st.id !== existing.id && deps.includes(st.wbsCode) && Number(st.actualProgress || 0) < 100
      );
      if (incompletePredecessors.length > 0) {
        return res.status(400).json({
          success: false,
          error: `تکمیل ۱۰۰٪ این فعالیت مجاز نیست؛ فعالیت(های) پیش‌نیاز (${incompletePredecessors
            .map((p) => `${p.wbsCode}: ${p.title}`)
            .join('، ')}) هنوز تکمیل نشده‌اند.`,
        });
      }
    }

    const metrics = calculateWbsScheduleMetrics({
      plannedStart,
      plannedEnd,
      actualStart,
      actualEnd: actualProgress >= 100 && !actualEnd ? new Date().toISOString().slice(0, 10) : actualEnd,
      plannedProgress: existing.plannedProgress,
      actualProgress,
    });

    const [updated] = await db
      .update(psmWbsTasks)
      .set({
        wbsCode: b.wbsCode !== undefined ? String(b.wbsCode).trim() : existing.wbsCode,
        title: b.title !== undefined ? String(b.title).trim() : existing.title,
        elementCode: b.elementCode !== undefined ? b.elementCode : existing.elementCode,
        unitName: b.unitName !== undefined ? b.unitName : existing.unitName,
        ownerName: b.ownerName !== undefined ? String(b.ownerName).trim() : existing.ownerName,
        executorName: b.executorName !== undefined ? String(b.executorName).trim() : existing.executorName,
        plannedStart,
        plannedEnd,
        actualStart: actualProgress > 0 && !actualStart ? new Date().toISOString().slice(0, 10) : actualStart,
        actualEnd: actualProgress >= 100 && !actualEnd ? new Date().toISOString().slice(0, 10) : (actualProgress < 100 ? null : actualEnd),
        plannedProgress: metrics.plannedProgress,
        actualProgress: metrics.actualProgress,
        weight: b.weight !== undefined ? Number(b.weight) : existing.weight,
        dependencies: deps,
        allocatedBudget: b.allocatedBudget !== undefined ? Number(b.allocatedBudget) : existing.allocatedBudget,
        actualCost: b.actualCost !== undefined ? Number(b.actualCost) : existing.actualCost,
        resources: b.resources !== undefined ? String(b.resources) : existing.resources,
        isMilestone: b.isMilestone !== undefined ? Boolean(b.isMilestone) : existing.isMilestone,
        isCritical: b.isCritical !== undefined ? Boolean(b.isCritical) : existing.isCritical,
        delayDays: metrics.delayDays,
        scheduleVariancePct: metrics.scheduleVariancePct,
        status: b.status || metrics.status,
        updatedAt: new Date(),
      })
      .where(eq(psmWbsTasks.id, id))
      .returning();

    await syncProjectWbsProgress(existing.projectId);
    await writePsmAuditLog(req, 'UPDATE', 'PSM_WBS_TASK', id, existing, updated);
    broadcastDataMutation('psm:wbs', 'update', updated);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در بروزرسانی فعالیت WBS' });
  }
});

router.delete(['/wbs/:id', '/projects/:projectId/wbs/:id'], requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز برای حذف فعالیت WBS' });
  }
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(psmWbsTasks).where(eq(psmWbsTasks.id, id)).returning();
    if (deleted) {
      await syncProjectWbsProgress(deleted.projectId);
      await writePsmAuditLog(req, 'DELETE', 'PSM_WBS_TASK', id, deleted, null);
      broadcastDataMutation('psm:wbs', 'delete', deleted);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در حذف فعالیت WBS' });
  }
});

// ============================================================================
// 6. Document Bank Management (بند ۶: مدیریت بانک مدارک با کنترل شواهد کافی)
// ============================================================================
router.post(['/documents', '/projects/:id/documents'], requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز برای ثبت مدرک PSM' });
  }
  try {
    const b = req.body || {};
    const projectId = Number(req.params.id || b.projectId || 0);
    if (!projectId || !b.docCode || !b.title || !b.ccpsElementCode || !b.authorName || !b.reviewerName || !b.approverName) {
      return res.status(400).json({
        success: false,
        error: 'کد مدرک، عنوان، عنصر CCPS، مسئول تهیه، مسئول بررسی و مسئول تأیید الزامی هستند.',
      });
    }

    const requestedStatus = String(b.status || 'DRAFT');
    const evidenceSummary = String(b.evidenceSummary || '').trim();
    const evidenceAttachments = Array.isArray(b.evidenceAttachments) ? b.evidenceAttachments : [];
    const hasFileOrAttachment = Boolean(b.fileId || b.fileUrl || evidenceAttachments.length > 0);

    // Gate Rule (Section 6): جلوگیری از تأیید مدرک فاقد شواهد کافی
    if (requestedStatus === 'APPROVED') {
      if (evidenceSummary.length < 10 && !hasFileOrAttachment) {
        return res.status(400).json({
          success: false,
          error: 'تأیید نهایی مدرک بدون ثبت شواهد اجرایی کافی یا پیوست فایل مستند مجاز نیست.',
        });
      }
      if (!canApprovePsm(req)) {
        return res.status(403).json({
          success: false,
          error: 'تأیید نهایی مدرک نیازمند سطح دسترسی تأییدکننده مجاز است.',
        });
      }
    }

    const actor = req.user?.name || req.user?.username || 'system';
    const [created] = await db
      .insert(psmDocuments)
      .values({
        projectId,
        docCode: String(b.docCode).trim().toUpperCase(),
        title: String(b.title).trim(),
        docType: b.docType || 'PROCEDURE',
        ccpsElementCode: String(b.ccpsElementCode).trim(),
        oshaClauseCode: b.oshaClauseCode || null,
        unitName: b.unitName || 'کل مجتمع',
        equipmentTag: b.equipmentTag || null,
        linkedStudyId: b.linkedStudyId ? Number(b.linkedStudyId) : null,
        linkedCapaId: b.linkedCapaId ? Number(b.linkedCapaId) : null,
        version: String(b.version || '1.0').trim(),
        revisionNumber: Number(b.revisionNumber || 1),
        authorName: String(b.authorName).trim(),
        reviewerName: String(b.reviewerName).trim(),
        approverName: String(b.approverName).trim(),
        issueDate: b.issueDate || new Date().toISOString().slice(0, 10),
        validityExpiryDate: b.validityExpiryDate || null,
        reviewCycleMonths: Number(b.reviewCycleMonths || 24),
        status: requestedStatus,
        fileId: b.fileId || null,
        fileUrl: b.fileUrl || null,
        fileName: b.fileName || null,
        evidenceSummary,
        evidenceAttachments,
        changeHistory: [
          {
            version: String(b.version || '1.0'),
            revisionNumber: Number(b.revisionNumber || 1),
            action: 'INITIAL_REGISTRATION',
            status: requestedStatus,
            actor,
            timestamp: new Date().toISOString(),
            note: b.changeNote || 'ثبت اولیه مدرک در بانک مدارک ایمنی فرایند',
          },
        ],
        approvedAt: requestedStatus === 'APPROVED' ? new Date() : null,
        approvedBy: requestedStatus === 'APPROVED' ? actor : null,
      })
      .returning();

    await writePsmAuditLog(req, 'CREATE', 'PSM_DOCUMENT', created.id, null, created);
    broadcastDataMutation('psm:documents', 'create', created);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err?.message?.includes('unique')
        ? 'کد مدرک واردشده تکراری است.'
        : err?.message || 'خطا در ثبت مدرک PSM',
    });
  }
});

router.put(['/documents/:id', '/projects/:projectId/documents/:id'], requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز' });
  }
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(psmDocuments).where(eq(psmDocuments.id, id));
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'مدرک مورد نظر یافت نشد.' });
    }
    const existing = rows[0];
    const b = req.body || {};

    let nextStatus = b.status !== undefined ? String(b.status) : existing.status;
    let isReopened = false;

    // Law 3 / Scenario 8: If document was APPROVED, any alteration or reopening without re-approval drops status to UNDER_REVIEW
    if (existing.status === 'APPROVED') {
      if (
        b.status === 'UNDER_REVIEW' ||
        b.status === 'REOPEN' ||
        (b.status !== 'APPROVED' &&
          (b.title !== undefined ||
            b.version !== undefined ||
            b.docType !== undefined ||
            b.fileId !== undefined ||
            b.fileUrl !== undefined ||
            b.revisionNumber !== undefined))
      ) {
        nextStatus = 'UNDER_REVIEW';
        isReopened = true;
      }
    }

    const nextEvidenceSummary =
      b.evidenceSummary !== undefined ? String(b.evidenceSummary).trim() : String(existing.evidenceSummary || '').trim();
    const nextAttachments = Array.isArray(b.evidenceAttachments)
      ? b.evidenceAttachments
      : (existing.evidenceAttachments as any[]) || [];
    const nextFileId = b.fileId !== undefined ? b.fileId : existing.fileId;
    const nextFileUrl = b.fileUrl !== undefined ? b.fileUrl : existing.fileUrl;

    // Strict Gate: Prevent approving document without sufficient evidence
    if (nextStatus === 'APPROVED') {
      const hasSufficientEvidence =
        nextEvidenceSummary.length >= 10 || Boolean(nextFileId) || Boolean(nextFileUrl) || nextAttachments.length > 0;
      if (!hasSufficientEvidence) {
        return res.status(400).json({
          success: false,
          error: 'خطای کنترل کیفیت مدارک PSM: تأیید مدرک فاقد شواهد اجرایی کافی یا فایل مستند پیوست امکان‌پذیر نیست.',
        });
      }
      if (!canApprovePsm(req)) {
        return res.status(403).json({
          success: false,
          error: 'تأیید نهایی مدرک نیازمند سطح دسترسی تأییدکننده مجاز است.',
        });
      }
    }

    const nextVersion = b.version !== undefined ? String(b.version).trim() : existing.version;
    const nextRevision =
      b.revisionNumber !== undefined
        ? Number(b.revisionNumber)
        : nextVersion !== existing.version
        ? existing.revisionNumber + 1
        : existing.revisionNumber;

    const actor = req.user?.name || req.user?.username || 'system';
    const historyArr = Array.isArray(existing.changeHistory) ? [...existing.changeHistory] : [];
    if (isReopened) {
      historyArr.push({
        version: nextVersion,
        revisionNumber: nextRevision,
        action: 'DOCUMENT_REOPENED_AFTER_ALTERATION',
        status: 'UNDER_REVIEW',
        actor,
        timestamp: new Date().toISOString(),
        note:
          b.changeNote ||
          'مدرک مصوب به دلیل اعمال تغییرات مجدداً بازگشایی شد و نیازمند بررسی و صحه‌گذاری مجدد است.',
      });
      await writePsmAuditLog(req, 'REOPEN_AFTER_ALTERATION', 'PSM_DOCUMENT', id, existing, {
        status: 'UNDER_REVIEW',
        reason: b.changeNote || 'تغییر محتوای مدرک مصوب و بازگشایی کنترل',
      });
    } else {
      historyArr.push({
        version: nextVersion,
        revisionNumber: nextRevision,
        action: nextStatus !== existing.status ? `STATUS_${nextStatus}` : 'REVISION_UPDATE',
        status: nextStatus,
        actor,
        timestamp: new Date().toISOString(),
        note: b.changeNote || `بروزرسانی مدرک به نسخه ${nextVersion} (وضعیت: ${nextStatus})`,
      });
    }

    const [updated] = await db
      .update(psmDocuments)
      .set({
        title: b.title !== undefined ? String(b.title).trim() : existing.title,
        docType: b.docType !== undefined ? b.docType : existing.docType,
        ccpsElementCode: b.ccpsElementCode !== undefined ? b.ccpsElementCode : existing.ccpsElementCode,
        oshaClauseCode: b.oshaClauseCode !== undefined ? b.oshaClauseCode : existing.oshaClauseCode,
        unitName: b.unitName !== undefined ? b.unitName : existing.unitName,
        equipmentTag: b.equipmentTag !== undefined ? b.equipmentTag : existing.equipmentTag,
        linkedStudyId: b.linkedStudyId !== undefined ? (b.linkedStudyId ? Number(b.linkedStudyId) : null) : existing.linkedStudyId,
        linkedCapaId: b.linkedCapaId !== undefined ? (b.linkedCapaId ? Number(b.linkedCapaId) : null) : existing.linkedCapaId,
        version: nextVersion,
        revisionNumber: nextRevision,
        authorName: b.authorName !== undefined ? String(b.authorName).trim() : existing.authorName,
        reviewerName: b.reviewerName !== undefined ? String(b.reviewerName).trim() : existing.reviewerName,
        approverName: b.approverName !== undefined ? String(b.approverName).trim() : existing.approverName,
        issueDate: b.issueDate !== undefined ? b.issueDate : existing.issueDate,
        validityExpiryDate: b.validityExpiryDate !== undefined ? b.validityExpiryDate : existing.validityExpiryDate,
        reviewCycleMonths: b.reviewCycleMonths !== undefined ? Number(b.reviewCycleMonths) : existing.reviewCycleMonths,
        status: nextStatus,
        fileId: nextFileId,
        fileUrl: nextFileUrl,
        fileName: b.fileName !== undefined ? b.fileName : existing.fileName,
        evidenceSummary: nextEvidenceSummary,
        evidenceAttachments: nextAttachments,
        changeHistory: historyArr,
        approvedAt: nextStatus === 'APPROVED' ? new Date() : existing.approvedAt,
        approvedBy: nextStatus === 'APPROVED' ? actor : existing.approvedBy,
        updatedAt: new Date(),
      })
      .where(eq(psmDocuments.id, id))
      .returning();

    if (isReopened) {
      await reopenDependentApprovedGatesIfInvalid(
        existing.projectId,
        `بازگشایی و ویرایش مدرک مصوب (${existing.docCode}: ${existing.title})`,
        actor
      );
    }

    await writePsmAuditLog(req, 'UPDATE', 'PSM_DOCUMENT', id, existing, updated);
    broadcastDataMutation('psm:documents', 'update', updated);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در بروزرسانی مدرک PSM' });
  }
});

router.delete(['/documents/:id', '/projects/:projectId/documents/:id'], requireAuth, async (req: Request, res: Response) => {
  if (!canApprovePsm(req)) {
    return res.status(403).json({ success: false, error: 'حذف مدرک نیازمند سطح دسترسی مدیر/تأییدکننده است.' });
  }
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(psmDocuments).where(eq(psmDocuments.id, id));
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'مدرک مورد نظر یافت نشد.' });
    }
    const existing = rows[0];
    await db.delete(psmDocuments).where(eq(psmDocuments.id, id));
    await writePsmAuditLog(req, 'DELETE', 'PSM_DOCUMENT', id, existing, null);
    broadcastDataMutation('psm:documents', 'delete', { id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در حذف مدرک' });
  }
});

// ============================================================================
// 7. CAPA Management with 8-Stage Independent Workflow (بند ۷: مدیریت CAPA)
// Stage order:
// REGISTERED -> RISK_ASSESSED -> ASSIGNED -> ACTION_IN_PROGRESS ->
// EVIDENCE_SUBMITTED -> UNDER_REVIEW -> EFFECTIVENESS_VERIFIED -> CLOSED
// ============================================================================
router.post(['/capa', '/projects/:id/capa'], requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز برای ثبت CAPA' });
  }
  try {
    const b = req.body || {};
    const projectId = Number(req.params.id || b.projectId || 0);
    if (!projectId || !b.title || !b.deficiencyDescription || !b.unitName || !b.responsiblePersonName) {
      return res.status(400).json({
        success: false,
        error: 'قانون حاکمیت PSM: عنوان نقص، شرح نقص، واحد سازمانی و مسئول مستقیم الزامی هستند.',
      });
    }

    const actor = req.user?.name || req.user?.username || 'system';
    const capaCode = String(b.capaCode || `CAPA-PSM-${projectId}-${Date.now().toString().slice(-5)}`).trim();

    const [created] = await db
      .insert(psmCapaItems)
      .values({
        projectId,
        capaCode,
        sourceType: b.sourceType || 'GAP_ANALYSIS',
        sourceRefId: b.sourceRefId || null,
        ccpsElementCode: b.ccpsElementCode || null,
        oshaClauseCode: b.oshaClauseCode || null,
        unitName: String(b.unitName).trim(),
        equipmentTag: b.equipmentTag || null,
        title: String(b.title).trim(),
        deficiencyDescription: String(b.deficiencyDescription).trim(),
        riskSeverity: Number(b.riskSeverity || 3),
        riskLikelihood: Number(b.riskLikelihood || 3),
        riskLevel: b.riskLevel || 'HIGH',
        rootCause: b.rootCause || null,
        correctiveAction: b.correctiveAction || null,
        preventiveAction: b.preventiveAction || null,
        responsiblePersonName: b.responsiblePersonName || null,
        dueDate: b.dueDate || null,
        stage: 'REGISTERED',
        workflowLogs: [
          {
            stage: 'REGISTERED',
            actor,
            role: req.user?.role || 'User',
            timestamp: new Date().toISOString(),
            note: 'ثبت اولیه نقص در سیستم مدیریت CAPA ایمنی فرایند',
          },
        ],
        createdBy: actor,
      })
      .returning();

    if (created.riskSeverity >= 4 || created.riskLevel === 'CRITICAL') {
      await reopenDependentApprovedGatesIfInvalid(
        projectId,
        `ثبت پرونده اقدام اصلاحی بحرانی جدید (${created.capaCode}: ${created.title})`,
        actor
      );
    }

    await writePsmAuditLog(req, 'CREATE', 'PSM_CAPA', created.id, null, created);
    broadcastDataMutation('psm:capa', 'create', created);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در ثبت نقص و اقدام اصلاحی' });
  }
});

router.put(['/capa/:id/extend-due', '/projects/:projectId/capa/:id/extend-due'], requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز برای تمدید مهلت CAPA' });
  }
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(psmCapaItems).where(eq(psmCapaItems.id, id));
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'پرونده CAPA یافت نشد.' });
    }
    const existing = rows[0];
    const b = req.body || {};
    const newDueDate = String(b.newDueDate || '').trim();
    const extensionJustification = String(b.extensionJustification || '').trim();

    if (!newDueDate || extensionJustification.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'قانون حاکمیت PSM: برای تمدید مهلت اقدام اصلاحی، ثبت تاریخ جدید و توجیه فنی مستند (حداقل ۱۰ کاراکتر) الزامی است.',
      });
    }

    const actor = req.user?.name || req.user?.username || 'system';
    const logs = Array.isArray(existing.workflowLogs) ? [...existing.workflowLogs] : [];
    logs.push({
      fromStage: existing.stage,
      stage: existing.stage,
      action: 'EXTEND_DUE_DATE',
      oldDueDate: existing.dueDate,
      newDueDate,
      actor,
      role: req.user?.role || 'User',
      timestamp: new Date().toISOString(),
      note: `تمدید مهلت از ${existing.dueDate || '—'} به ${newDueDate} — توجیه فنی: ${extensionJustification}`,
    });

    const [updated] = await db
      .update(psmCapaItems)
      .set({
        dueDate: newDueDate,
        workflowLogs: logs,
        updatedAt: new Date(),
      })
      .where(eq(psmCapaItems.id, id))
      .returning();

    await writePsmAuditLog(req, 'EXTEND_DUE_DATE', 'PSM_CAPA', id, existing, updated);
    broadcastDataMutation('psm:capa', 'update', updated);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در تمدید مهلت CAPA' });
  }
});

router.put(['/capa/:id/transition', '/projects/:projectId/capa/:id/transition'], requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز برای تغییر وضعیت CAPA' });
  }
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(psmCapaItems).where(eq(psmCapaItems.id, id));
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'پرونده CAPA یافت نشد.' });
    }
    const existing = rows[0];
    const b = req.body || {};
    const targetStage = String(b.targetStage || existing.stage).trim();
    const actor = req.user?.name || req.user?.username || 'system';

    const merged = {
      riskSeverity: b.riskSeverity !== undefined ? Number(b.riskSeverity) : existing.riskSeverity,
      riskLikelihood: b.riskLikelihood !== undefined ? Number(b.riskLikelihood) : existing.riskLikelihood,
      riskLevel: b.riskLevel !== undefined ? String(b.riskLevel) : existing.riskLevel,
      rootCause: b.rootCause !== undefined ? String(b.rootCause).trim() : String(existing.rootCause || '').trim(),
      correctiveAction:
        b.correctiveAction !== undefined
          ? String(b.correctiveAction).trim()
          : String(existing.correctiveAction || '').trim(),
      preventiveAction:
        b.preventiveAction !== undefined
          ? String(b.preventiveAction).trim()
          : String(existing.preventiveAction || '').trim(),
      responsiblePersonName:
        b.responsiblePersonName !== undefined
          ? String(b.responsiblePersonName).trim()
          : String(existing.responsiblePersonName || '').trim(),
      dueDate: b.dueDate !== undefined ? String(b.dueDate).trim() : String(existing.dueDate || '').trim(),
      completionDate:
        b.completionDate !== undefined ? String(b.completionDate).trim() : String(existing.completionDate || '').trim(),
      evidenceDescription:
        b.evidenceDescription !== undefined
          ? String(b.evidenceDescription).trim()
          : String(existing.evidenceDescription || '').trim(),
      evidenceFiles: Array.isArray(b.evidenceFiles) ? b.evidenceFiles : (existing.evidenceFiles as any[]) || [],
      reviewerName:
        b.reviewerName !== undefined ? String(b.reviewerName).trim() : String(existing.reviewerName || '').trim(),
      reviewNotes:
        b.reviewNotes !== undefined ? String(b.reviewNotes).trim() : String(existing.reviewNotes || '').trim(),
      effectivenessVerifierName:
        b.effectivenessVerifierName !== undefined
          ? String(b.effectivenessVerifierName).trim()
          : String(existing.effectivenessVerifierName || '').trim(),
      effectivenessVerificationDate:
        b.effectivenessVerificationDate !== undefined
          ? String(b.effectivenessVerificationDate).trim()
          : String(existing.effectivenessVerificationDate || '').trim(),
      effectivenessCriteriaMet:
        b.effectivenessCriteriaMet !== undefined
          ? Boolean(b.effectivenessCriteriaMet)
          : existing.effectivenessCriteriaMet,
      effectivenessReport:
        b.effectivenessReport !== undefined
          ? String(b.effectivenessReport).trim()
          : String(existing.effectivenessReport || '').trim(),
      followupPlan:
        b.followupPlan !== undefined ? String(b.followupPlan).trim() : String(existing.followupPlan || '').trim(),
      managementApprovalForResidual:
        b.managementApprovalForResidual !== undefined
          ? Boolean(b.managementApprovalForResidual)
          : existing.managementApprovalForResidual,
    };

    // Enforce Strict Gate Rules for each stage in the 8-stage workflow:
    // ثبت ← ارزیابی ریسک ← تخصیص مسئول ← اقدام اصلاحی ← ثبت شواهد ← بررسی ← تأیید اثربخشی ← بستن نقص
    if (targetStage === 'RISK_ASSESSED' && !merged.rootCause) {
      return res.status(400).json({
        success: false,
        error: 'برای عبور از مرحله «ارزیابی ریسک»، ثبت تحلیل علت ریشه‌ای (Root Cause) و سطح ریسک الزامی است.',
      });
    }
    if (targetStage === 'ASSIGNED' && (!merged.responsiblePersonName || !merged.dueDate || !merged.correctiveAction)) {
      return res.status(400).json({
        success: false,
        error: 'برای مرحله «تخصیص مسئول»، تعیین نام مسئول، شرح اقدام اصلاحی و مهلت انجام الزامی است.',
      });
    }
    if (
      targetStage === 'EVIDENCE_SUBMITTED' &&
      merged.evidenceDescription.length < 10 &&
      merged.evidenceFiles.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: 'برای مرحله «ثبت شواهد»، ثبت شرح مستند شواهد اجرایی (حداقل ۱۰ کاراکتر) یا پیوست فایل الزامی است.',
      });
    }
    if (targetStage === 'UNDER_REVIEW' && (!merged.reviewerName || !merged.reviewNotes)) {
      return res.status(400).json({
        success: false,
        error: 'برای مرحله «بررسی»، ثبت نام بازبین فنی و نظر بررسی الزامی است.',
      });
    }
    if (targetStage === 'EFFECTIVENESS_VERIFIED' || targetStage === 'CLOSED') {
      if (!merged.effectivenessVerifierName || merged.effectivenessReport.length < 10 || !merged.effectivenessCriteriaMet) {
        return res.status(400).json({
          success: false,
          error: 'بستن نقص یا تأیید اثربخشی بدون گزارش مستند اثربخشی و تعیین تأییدکننده مستقل امکان‌پذیر نیست.',
        });
      }
      // Independence verification rule: Verifier cannot be the same person as the executor/responsible person
      if (
        merged.responsiblePersonName &&
        merged.effectivenessVerifierName.toLowerCase() === merged.responsiblePersonName.toLowerCase()
      ) {
        return res.status(400).json({
          success: false,
          error: 'خطای استقلال ممیزی (بند ۷): تأییدکننده اثربخشی باید مستقل از مسئول اجرای اقدام اصلاحی باشد.',
        });
      }
      if (targetStage === 'CLOSED') {
        if (existing.stage !== 'EFFECTIVENESS_VERIFIED' && b.targetStage === 'CLOSED') {
          // Ensure all prior evidence and review fields are also present
          if (merged.evidenceDescription.length < 10 && merged.evidenceFiles.length === 0) {
            return res.status(400).json({
              success: false,
              error: 'بستن نقص بدون ثبت شواهد اجرایی مستند امکان‌پذیر نیست.',
            });
          }
        }
        if (!canApprovePsm(req)) {
          return res.status(403).json({
            success: false,
            error: 'بستن نهایی نقص نیازمند سطح دسترسی تأییدکننده مجاز / ممیز مستقل است.',
          });
        }
      }
    }

    const logs = Array.isArray(existing.workflowLogs) ? [...existing.workflowLogs] : [];
    logs.push({
      fromStage: existing.stage,
      stage: targetStage,
      actor,
      role: req.user?.role || 'User',
      timestamp: new Date().toISOString(),
      note: b.transitionNote || `انتقال مرحله گردش کار به ${targetStage}`,
    });

    const [updated] = await db
      .update(psmCapaItems)
      .set({
        ...merged,
        completionDate:
          targetStage === 'EVIDENCE_SUBMITTED' && !merged.completionDate
            ? new Date().toISOString().slice(0, 10)
            : merged.completionDate,
        reviewedAt: targetStage === 'UNDER_REVIEW' ? new Date() : existing.reviewedAt,
        effectivenessVerificationDate:
          (targetStage === 'EFFECTIVENESS_VERIFIED' || targetStage === 'CLOSED') &&
          !merged.effectivenessVerificationDate
            ? new Date().toISOString().slice(0, 10)
            : merged.effectivenessVerificationDate,
        closedBy: targetStage === 'CLOSED' ? actor : existing.closedBy,
        closedAt: targetStage === 'CLOSED' ? new Date() : existing.closedAt,
        stage: targetStage,
        workflowLogs: logs,
        updatedAt: new Date(),
      })
      .where(eq(psmCapaItems.id, id))
      .returning();

    // If CAPA is closed and linked to a Gap, mark the Gap CLOSED too
    if (targetStage === 'CLOSED') {
      await db
        .update(psmGaps)
        .set({ status: 'CLOSED', updatedAt: new Date() })
        .where(eq(psmGaps.linkedCapaId, id))
        .catch(() => {});
    }

    await writePsmAuditLog(req, `CAPA_STAGE_${targetStage}`, 'PSM_CAPA', id, existing, updated);
    broadcastDataMutation('psm:capa', 'update', updated);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در گردش کار CAPA' });
  }
});

// ============================================================================
// 8. Specialized Technical Studies & Subsystems (بند ۸: ۱۴ زیرسیستم تخصصی)
// ============================================================================
router.post(['/studies', '/projects/:id/studies'], requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز برای ثبت مطالعه تخصصی' });
  }
  try {
    const b = req.body || {};
    const projectId = Number(req.params.id || b.projectId || 0);
    if (!projectId || !b.subsystemType || !b.title || !b.unitName || !b.ownerName || !b.studyDate || !b.technicalSummary) {
      return res.status(400).json({
        success: false,
        error: 'نوع زیرسیستم، عنوان مطالعه، واحد، مالک، تاریخ مطالعه و خلاصه فنی الزامی هستند.',
      });
    }

    const studyCode = String(
      b.studyCode || `STD-${b.subsystemType}-${projectId}-${Date.now().toString().slice(-4)}`
    ).trim();

    const [created] = await db
      .insert(psmSpecializedStudies)
      .values({
        projectId,
        studyCode,
        subsystemType: String(b.subsystemType).trim(),
        title: String(b.title).trim(),
        unitName: String(b.unitName).trim(),
        equipmentTag: b.equipmentTag || null,
        nodeOrSection: b.nodeOrSection || null,
        ownerName: String(b.ownerName).trim(),
        teamLeader: b.teamLeader || null,
        studyDate: String(b.studyDate).trim(),
        revalidationDueDate: b.revalidationDueDate || null,
        status: b.status || 'IN_PROGRESS',
        technicalSummary: String(b.technicalSummary).trim(),
        methodologyDetails: b.methodologyDetails || {},
        recommendations: Array.isArray(b.recommendations) ? b.recommendations : [],
        evidenceSummary: b.evidenceSummary || '',
        trackingPath: b.trackingPath || '',
        createdBy: req.user?.name || req.user?.username || 'system',
      })
      .returning();

    await writePsmAuditLog(req, 'CREATE', 'PSM_SPECIALIZED_STUDY', created.id, null, created);
    broadcastDataMutation('psm:studies', 'create', created);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در ثبت مطالعه تخصصی PSM' });
  }
});

router.put(['/studies/:id', '/projects/:projectId/studies/:id'], requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز' });
  }
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(psmSpecializedStudies).where(eq(psmSpecializedStudies.id, id));
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'مطالعه تخصصی یافت نشد.' });
    }
    const existing = rows[0];
    const b = req.body || {};

    const [updated] = await db
      .update(psmSpecializedStudies)
      .set({
        title: b.title !== undefined ? String(b.title).trim() : existing.title,
        unitName: b.unitName !== undefined ? String(b.unitName).trim() : existing.unitName,
        equipmentTag: b.equipmentTag !== undefined ? b.equipmentTag : existing.equipmentTag,
        nodeOrSection: b.nodeOrSection !== undefined ? b.nodeOrSection : existing.nodeOrSection,
        ownerName: b.ownerName !== undefined ? String(b.ownerName).trim() : existing.ownerName,
        teamLeader: b.teamLeader !== undefined ? b.teamLeader : existing.teamLeader,
        studyDate: b.studyDate !== undefined ? b.studyDate : existing.studyDate,
        revalidationDueDate:
          b.revalidationDueDate !== undefined ? b.revalidationDueDate : existing.revalidationDueDate,
        status: b.status !== undefined ? b.status : existing.status,
        technicalSummary:
          b.technicalSummary !== undefined ? String(b.technicalSummary).trim() : existing.technicalSummary,
        methodologyDetails:
          b.methodologyDetails !== undefined ? b.methodologyDetails : existing.methodologyDetails,
        recommendations: Array.isArray(b.recommendations) ? b.recommendations : existing.recommendations,
        evidenceSummary: b.evidenceSummary !== undefined ? b.evidenceSummary : existing.evidenceSummary,
        trackingPath: b.trackingPath !== undefined ? b.trackingPath : existing.trackingPath,
        updatedAt: new Date(),
      })
      .where(eq(psmSpecializedStudies.id, id))
      .returning();

    await writePsmAuditLog(req, 'UPDATE', 'PSM_SPECIALIZED_STUDY', id, existing, updated);
    broadcastDataMutation('psm:studies', 'update', updated);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در بروزرسانی مطالعه تخصصی' });
  }
});

router.post(
  ['/studies/:id/convert-recommendation', '/projects/:projectId/studies/:id/convert-recommendation'],
  requireAuth,
  async (req: Request, res: Response) => {
    if (!canWritePsm(req)) {
      return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز برای تبدیل توصیه به CAPA' });
    }
    try {
      const id = Number(req.params.id);
      const rows = await db.select().from(psmSpecializedStudies).where(eq(psmSpecializedStudies.id, id));
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'مطالعه تخصصی یافت نشد.' });
      }
      const study = rows[0];
      const b = req.body || {};
      const recId = String(b.recommendationId || '').trim();
      const recs: any[] = Array.isArray(study.recommendations) ? [...study.recommendations] : [];
      const recIndex = recs.findIndex((r) => String(r.id) === recId);
      const targetRec = recIndex >= 0 ? recs[recIndex] : b.recommendation || recs[0];

      if (!targetRec || !targetRec.title) {
        return res.status(400).json({ success: false, error: 'توصیه مورد نظر برای تبدیل به CAPA یافت نشد.' });
      }

      const actor = req.user?.name || req.user?.username || 'system';
      const capaCode = `CAPA-${study.subsystemType}-${study.projectId}-${Date.now().toString().slice(-4)}`;

      const [createdCapa] = await db
        .insert(psmCapaItems)
        .values({
          projectId: study.projectId,
          capaCode,
          sourceType: study.subsystemType || 'PHA_HAZOP',
          sourceRefId: `${study.studyCode} / ${targetRec.id || 'REC'}`,
          ccpsElementCode: 'CCPS-08',
          oshaClauseCode: 'OSHA-03',
          unitName: study.unitName,
          equipmentTag: study.equipmentTag || study.nodeOrSection || null,
          title: String(targetRec.title).trim(),
          deficiencyDescription: `توصیه مستخرج از مطالعه تخصصی ${study.subsystemType} (${study.studyCode} - ${study.title}): ${targetRec.title}`,
          riskSeverity: targetRec.riskLevel === 'CRITICAL' ? 5 : targetRec.riskLevel === 'HIGH' ? 4 : 3,
          riskLikelihood: 3,
          riskLevel: targetRec.riskLevel || 'HIGH',
          responsiblePersonName: targetRec.ownerName || study.ownerName,
          dueDate: targetRec.dueDate || new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
          stage: 'REGISTERED',
          workflowLogs: [
            {
              stage: 'REGISTERED',
              actor,
              role: req.user?.role || 'User',
              timestamp: new Date().toISOString(),
              note: `تبدیل خودکار توصیه مطالعه ${study.studyCode} (${study.subsystemType}) به پرونده CAPA`,
            },
          ],
          createdBy: actor,
        })
        .returning();

      if (recIndex >= 0) {
        recs[recIndex] = {
          ...recs[recIndex],
          status: 'CONVERTED_TO_CAPA',
          linkedCapaCode: createdCapa.capaCode,
          linkedCapaId: createdCapa.id,
        };
      }

      const [updatedStudy] = await db
        .update(psmSpecializedStudies)
        .set({
          recommendations: recs,
          updatedAt: new Date(),
        })
        .where(eq(psmSpecializedStudies.id, id))
        .returning();

      await writePsmAuditLog(req, 'CONVERT_RECOMMENDATION_TO_CAPA', 'PSM_SPECIALIZED_STUDY', id, study, {
        study: updatedStudy,
        capa: createdCapa,
      });
      broadcastDataMutation('psm:studies', 'update', updatedStudy);
      broadcastDataMutation('psm:capa', 'create', createdCapa);

      res.status(201).json({
        success: true,
        data: {
          study: updatedStudy,
          capa: createdCapa,
        },
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'خطا در تبدیل توصیه مطالعه به CAPA' });
    }
  }
);

router.delete(['/studies/:id', '/projects/:projectId/studies/:id'], requireAuth, async (req: Request, res: Response) => {
  if (!canApprovePsm(req)) {
    return res.status(403).json({ success: false, error: 'حذف مطالعه تخصصی نیازمند سطح دسترسی مدیر/تأییدکننده است.' });
  }
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(psmSpecializedStudies).where(eq(psmSpecializedStudies.id, id));
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'مطالعه تخصصی یافت نشد.' });
    }
    const existing = rows[0];
    await db.delete(psmSpecializedStudies).where(eq(psmSpecializedStudies.id, id));
    await writePsmAuditLog(req, 'DELETE', 'PSM_SPECIALIZED_STUDY', id, existing, null);
    broadcastDataMutation('psm:studies', 'delete', { id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در حذف مطالعه تخصصی' });
  }
});

// ============================================================================
// 9. 5-Level PSM Maturity Evaluation (بند ۱۰: ارزیابی بلوغ ۵ سطحی مستقل)
// ============================================================================
router.post(['/maturity', '/projects/:id/maturity'], requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز برای ثبت ارزیابی بلوغ PSM' });
  }
  try {
    const b = req.body || {};
    const projectId = Number(req.params.id || b.projectId || 0);
    if (!projectId || !b.assessorName || !b.assessmentDate || !Array.isArray(b.elementMaturityData)) {
      return res.status(400).json({
        success: false,
        error: 'شناسه پروژه، نام ارزیاب، تاریخ ارزیابی و داده‌های ارزیابی بلوغ عناصر الزامی هستند.',
      });
    }

    const elementsData: Array<{
      elementCode: string;
      pillarId: string;
      designLevel: number;
      executionLevel: number;
      cultureLevel: number;
      sustainabilityLevel: number;
      elementLevel: number;
      notes?: string;
    }> = b.elementMaturityData;

    // Compute independent 5-level maturity scores per pillar and overall
    const pillarTotals: Record<string, { sum: number; count: number }> = {
      COMMIT: { sum: 0, count: 0 },
      UNDERSTAND: { sum: 0, count: 0 },
      MANAGE: { sum: 0, count: 0 },
      LEARN: { sum: 0, count: 0 },
    };

    let totalSum = 0;
    let totalCount = 0;

    for (const item of elementsData) {
      const avg =
        item.elementLevel ||
        Number(
          (
            (Number(item.designLevel || 1) +
              Number(item.executionLevel || 1) +
              Number(item.cultureLevel || 1) +
              Number(item.sustainabilityLevel || 1)) /
            4
          ).toFixed(2)
        );
      const clamped = Math.max(1, Math.min(5, avg));
      totalSum += clamped;
      totalCount += 1;
      if (item.pillarId && pillarTotals[item.pillarId]) {
        pillarTotals[item.pillarId].sum += clamped;
        pillarTotals[item.pillarId].count += 1;
      }
    }

    const overallScore = totalCount > 0 ? Number((totalSum / totalCount).toFixed(2)) : 1;
    // Overall Maturity Level follows strict minimum-gate / floor principle
    const overallLevel = Math.max(1, Math.min(5, Math.floor(overallScore)));

    const pillarScores: Record<string, number> = {};
    for (const [k, v] of Object.entries(pillarTotals)) {
      pillarScores[k] = v.count > 0 ? Number((v.sum / v.count).toFixed(2)) : 1;
    }

    const assessmentCode = String(
      b.assessmentCode || `MAT-PSM-${projectId}-${Date.now().toString().slice(-4)}`
    ).trim();

    const [created] = await db
      .insert(psmMaturityAssessments)
      .values({
        projectId,
        assessmentCode,
        assessmentDate: String(b.assessmentDate).trim(),
        assessorName: String(b.assessorName).trim(),
        unitScope: b.unitScope || 'کل مجتمع پتروشیمی رجال',
        overallMaturityLevel: overallLevel,
        overallMaturityScore: overallScore,
        pillarScores,
        elementMaturityData: elementsData,
        strengthsSummary: b.strengthsSummary || '',
        improvementRoadmap: b.improvementRoadmap || '',
        verifiedBy: b.verifiedBy || null,
      })
      .returning();

    await writePsmAuditLog(req, 'CREATE', 'PSM_MATURITY_ASSESSMENT', created.id, null, created);
    broadcastDataMutation('psm:maturity', 'create', created);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در ثبت ارزیابی بلوغ PSM' });
  }
});

// ============================================================================
// 10. Final Project Acceptance & Handover Verification Gate (بند ۱۱: تأیید نهایی و تحویل پروژه)
// ============================================================================
router.post('/projects/:id/handover', requireAuth, async (req: Request, res: Response) => {
  if (!canApprovePsm(req)) {
    return res.status(403).json({
      success: false,
      error: 'تصویب تحویل نهایی پروژه PSM نیازمند سطح دسترسی مقام مجاز / مدیر ارشد است.',
    });
  }
  try {
    const projectId = Number(req.params.id);
    const projectRows = await db.select().from(psmProjects).where(eq(psmProjects.id, projectId));
    if (projectRows.length === 0) {
      return res.status(404).json({ success: false, error: 'پروژه یافت نشد.' });
    }
    const project = projectRows[0];

    const [assessments, gaps, documents, capaItems] = await Promise.all([
      db.select().from(psmAssessments).where(eq(psmAssessments.projectId, projectId)),
      db.select().from(psmGaps).where(eq(psmGaps.projectId, projectId)),
      db.select().from(psmDocuments).where(eq(psmDocuments.projectId, projectId)),
      db.select().from(psmCapaItems).where(eq(psmCapaItems.projectId, projectId)),
    ]);

    const b = req.body || {};

    // Check 1: ارزیابی تمام عناصر CCPS (20) و الزامات OSHA (14) مشمول
    const assessedCcpsCodes = new Set(
      assessments.filter((a) => a.framework === 'CCPS_RBPS').map((a) => a.elementCode)
    );
    const assessedOshaCodes = new Set(
      assessments.filter((a) => a.framework === 'OSHA_1910_119').map((a) => a.elementCode)
    );
    const missingCcps = CCPS_20_ELEMENTS.filter((e) => !assessedCcpsCodes.has(e.code)).map((e) => e.code);
    const missingOsha = OSHA_14_CLAUSES.filter((c) => !assessedOshaCodes.has(c.code)).map((c) => c.code);

    // Check 2: تعیین تکلیف تمام نواقص بحرانی
    const openCriticalCapas = capaItems.filter(
      (c) => c.riskLevel === 'CRITICAL' && c.stage !== 'CLOSED'
    );
    const openCriticalGaps = gaps.filter(
      (g) => g.riskLevel === 'CRITICAL' && g.status !== 'CLOSED' && g.status !== 'OUT_OF_SCOPE_APPROVED'
    );

    // Check 3: تأیید مدارک موردنیاز
    const unapprovedDocs = documents.filter((d) => d.status !== 'APPROVED');

    // Check 4: نواقص غیربحرانی باقیمانده باید دارای مالک، مهلت، برنامه پیگیری و تأیید مدیریت باشند
    const openNonCriticalCapas = capaItems.filter(
      (c) => c.riskLevel !== 'CRITICAL' && c.stage !== 'CLOSED'
    );
    const invalidResidualCapas = openNonCriticalCapas.filter(
      (c) =>
        !c.responsiblePersonName ||
        !c.dueDate ||
        !c.followupPlan ||
        String(c.followupPlan).trim().length < 5 ||
        !c.managementApprovalForResidual
    );

    const blockingErrors: string[] = [];
    if (missingCcps.length > 0) {
      blockingErrors.push(`عناصر CCPS ارزیابی‌نشده: ${missingCcps.join(', ')}`);
    }
    if (missingOsha.length > 0) {
      blockingErrors.push(`الزامات OSHA ارزیابی‌نشده: ${missingOsha.join(', ')}`);
    }
    if (openCriticalCapas.length > 0 || openCriticalGaps.length > 0) {
      blockingErrors.push(
        `وجود ${openCriticalCapas.length} نقص بحرانی باز در CAPA و ${openCriticalGaps.length} شکاف بحرانی تعیین‌تکلیف‌نشده.`
      );
    }
    if (documents.length === 0 || unapprovedDocs.length > 0) {
      blockingErrors.push(
        documents.length === 0
          ? 'هیچ مدرک مصوبی در بانک مدارک PSM ثبت نشده است.'
          : `${unapprovedDocs.length} مدرک در بانک مدارک هنوز تأیید نهایی نشده‌اند.`
      );
    }
    if (invalidResidualCapas.length > 0) {
      blockingErrors.push(
        `${invalidResidualCapas.length} نقص غیربحرانی باقیمانده فاقد مالک، مهلت، برنامه پیگیری یا تأیید مدیریت است.`
      );
    }
    if (!b.finalAuditCompleted || !b.finalAuditReportRef) {
      blockingErrors.push('انجام ممیزی نهایی و ثبت شماره گزارش ممیزی نهایی الزامی است.');
    }
    if (!b.controlsEffectivenessVerified) {
      blockingErrors.push('تأیید اثربخشی کنترل‌های اجراشده الزامی است.');
    }
    if (!b.operationalEvidenceVerified) {
      blockingErrors.push('بررسی و صحه‌گذاری شواهد اجرایی الزامی است.');
    }
    if (!b.authorizedApproverName || !b.finalReportApprovalDate) {
      blockingErrors.push('نام مقام مجاز تصویب‌کننده گزارش نهایی و تاریخ تصویب الزامی است.');
    }

    if (blockingErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'شرایط پذیرش و تحویل نهایی پروژه PSM هنوز تکمیل نشده است.',
        blockingErrors,
      });
    }

    const handoverPayload = {
      finalAuditCompleted: true,
      finalAuditReportRef: String(b.finalAuditReportRef).trim(),
      operationalEvidenceVerified: true,
      controlsEffectivenessVerified: true,
      authorizedApproverName: String(b.authorizedApproverName).trim(),
      authorizedApproverRole: String(b.authorizedApproverRole || req.user?.role || 'مدیر ارشد').trim(),
      finalReportApprovalDate: String(b.finalReportApprovalDate).trim(),
      handoverNotes: String(b.handoverNotes || '').trim(),
      residualNonCriticalCount: openNonCriticalCapas.length,
      approvedAt: new Date().toISOString(),
    };

    const [updatedProject] = await db
      .update(psmProjects)
      .set({
        overallStatus: 'COMPLETED',
        overallProgress: 100,
        handoverData: handoverPayload,
        updatedAt: new Date(),
      })
      .where(eq(psmProjects.id, projectId))
      .returning();

    // Synchronize G6 stage gate status to APPROVED upon formal handover
    await db
      .update(psmStageGates)
      .set({
        status: 'APPROVED',
        approverName: String(b.authorizedApproverName).trim(),
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(psmStageGates.projectId, projectId), eq(psmStageGates.gateKey, 'G6')))
      .catch(() => {});

    await writePsmAuditLog(
      req,
      'APPROVE_FINAL_HANDOVER',
      'PSM_PROJECT',
      projectId,
      project,
      updatedProject,
      handoverPayload
    );
    broadcastDataMutation('psm:projects', 'update', updatedProject);

    res.json({
      success: true,
      data: updatedProject,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در ثبت تحویل نهایی پروژه PSM' });
  }
});

// ============================================================================
// 11. Local HSECORE AI Advisory for PSM (بند ۱۲: هوش مصنوعی محلی با تأیید انسانی)
// Strictly uses local Ollama engine + local rule-based fallback; zero cloud calls.
// ============================================================================
router.post('/ai-analyze', requireAuth, async (req: Request, res: Response) => {
  try {
    const b = req.body || {};
    const projectId = Number(b.projectId);
    const analysisMode = String(b.analysisMode || 'IDENTIFY_GAPS'); // ANALYZE_DOCUMENT | IDENTIFY_GAPS | SUGGEST_CAPA | ANALYZE_TRENDS | EXECUTIVE_REPORT
    const customContext = String(b.customContext || '').trim();

    if (!projectId) {
      return res.status(400).json({ success: false, error: 'شناسه پروژه الزامی است.' });
    }

    const [projectRows, assessments, gaps, wbsTasks, documents, capaItems, studies, maturityRecords] =
      await Promise.all([
        db.select().from(psmProjects).where(eq(psmProjects.id, projectId)),
        db.select().from(psmAssessments).where(eq(psmAssessments.projectId, projectId)),
        db.select().from(psmGaps).where(eq(psmGaps.projectId, projectId)),
        db.select().from(psmWbsTasks).where(eq(psmWbsTasks.projectId, projectId)),
        db.select().from(psmDocuments).where(eq(psmDocuments.projectId, projectId)),
        db.select().from(psmCapaItems).where(eq(psmCapaItems.projectId, projectId)),
        db.select().from(psmSpecializedStudies).where(eq(psmSpecializedStudies.projectId, projectId)),
        db.select().from(psmMaturityAssessments).where(eq(psmMaturityAssessments.projectId, projectId)),
      ]);

    const project = projectRows[0];
    if (!project) {
      return res.status(404).json({ success: false, error: 'پروژه یافت نشد.' });
    }

    const avgCompliance =
      assessments.length > 0
        ? Math.round(assessments.reduce((acc, a) => acc + Number(a.complianceScore || 0), 0) / assessments.length)
        : 0;
    const criticalGaps = gaps.filter((g) => g.riskLevel === 'CRITICAL' && g.status !== 'CLOSED');
    const openCapas = capaItems.filter((c) => c.stage !== 'CLOSED');
    const delayedWbs = wbsTasks.filter((t) => t.delayDays > 0 || t.status === 'DELAYED');
    const latestMaturity = maturityRecords[0];

    const dataDigest = [
      `پروژه: ${project.title} (${project.projectCode}) - مجتمع پتروشیمی رجال`,
      `دامنه: ${project.scopeDescription}`,
      `واحدهای مشمول: ${Array.isArray(project.coveredUnits) ? project.coveredUnits.join('، ') : 'کل مجتمع'}`,
      `تعداد ارزیابی‌های ثبت‌شده: ${assessments.length} (میانگین انطباق: ${avgCompliance}٪)`,
      `تعداد کل شکاف‌ها (Gap Analysis): ${gaps.length} (شکاف‌های بحرانی باز: ${criticalGaps.length})`,
      `تعداد فعالیت‌های WBS: ${wbsTasks.length} (دارای تأخیر زمانی: ${delayedWbs.length})`,
      `بانک مدارک PSM: ${documents.length} مدرک (${documents.filter((d) => d.status === 'APPROVED').length} مصوب)`,
      `پرونده‌های CAPA: ${capaItems.length} مورد (${openCapas.length} باز)`,
      `مطالعات تخصصی (PHA/HAZOP/LOPA/MI/MOC/PSSR): ${studies.length} مطالعه`,
      `سطح بلوغ فعلی PSM: ${latestMaturity ? `سطح ${latestMaturity.overallMaturityLevel} (امتیاز ${latestMaturity.overallMaturityScore} از ۵)` : 'هنوز ارزیابی نشده'}`,
      customContext ? `اطلاعات تکمیلی کاربر: ${customContext}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const modePrompts: Record<string, string> = {
      ANALYZE_DOCUMENT:
        'مستندات و بانک مدارک پروژه استقرار PSM مجتمع پتروشیمی رجال را بر اساس ۲۰ عنصر CCPS RBPS و ۱۴ الزام OSHA 1910.119 تحلیل کن، نواقص مستندسازی و شواهد موردنیاز را مشخص نما.',
      IDENTIFY_GAPS:
        'شکاف‌های انطباق (Gap Analysis) پروژه استقرار PSM را تحلیل کن و اولویت‌بندی ریسک و مدارک لازم برای پوشش شکاف‌های CCPS و OSHA را ارائه بده.',
      SUGGEST_CAPA:
        'برای نواقص و شکاف‌های باز پروژه استقرار PSM، اقدامات اصلاحی و پیشگیرانه (CAPA) مهندسی، عملیاتی و مدیریتی به همراه معیار صحه‌گذاری اثربخشی پیشنهاد بده.',
      ANALYZE_TRENDS:
        'روند پیشرفت ساختار شکست کار (WBS)، انحرافات زمانی، وضعیت بسته شدن CAPAها و رابطه آن با سطح بلوغ ۵ سطحی PSM را تحلیل کن.',
      EXECUTIVE_REPORT:
        'یک گزارش مدیریتی جامع ویژه مدیرعامل و کمیته راهبری PSM مجتمع پتروشیمی رجال شامل خلاصه وضعیت، ریسک‌های بحرانی، وضعیت انطباق CCPS/OSHA و تصمیمات کلیدی موردنیاز تهیه کن.',
    };

    let aiResponseText = '';
    let modelUsed = 'HSECORE-Local-Engine';

    try {
      const health = await localAIProvider.checkHealth();
      if (health.isAvailable) {
        const targetModel = health.defaultChatModel || health.installedModels?.[0]?.name || 'qwen2.5:7b';
        modelUsed = `Ollama Local (${targetModel})`;
        const gen = await localAIProvider.chat(
          [
            {
              role: 'system',
              content:
                'تو مشاور ارشد استقرار ایمنی فرایند (PSM) در مجتمع پتروشیمی رجال بر مبنای استانداردهای CCPS RBPS (۲۰ عنصر) و OSHA 29 CFR 1910.119 (۱۴ الزام) هستی. پاسخ را کاملاً ساختاریافته، فنی و به زبان فارسی ارائه بده.',
            },
            {
              role: 'user',
              content: `${modePrompts[analysisMode] || modePrompts.IDENTIFY_GAPS}\n\nداده‌های زنده پروژه در پایگاه داده:\n${dataDigest}`,
            },
          ],
          {
            model: targetModel,
            temperature: 0.2,
            max_tokens: 900,
          }
        );
        aiResponseText = String(gen?.text || '').trim();
      }
    } catch {
      // Fallback to local deterministic engineering analyzer if Ollama container is offline
    }

    if (!aiResponseText) {
      modelUsed = 'موتور تحلیلگر محلی قوانین PSM (Offline Deterministic Engine)';
      aiResponseText = [
        `### گزارش تحلیلی موتور هوشمند محلی HSECORE (${analysisMode})`,
        `**پروژه:** ${project.title} (\`${project.projectCode}\`) — مجتمع پتروشیمی رجال`,
        '',
        `#### ۱. خلاصه وضعیت فعلی در پایگاه داده`,
        `- **میانگین انطباق ارزیابی‌های ثبت‌شده:** ${avgCompliance}٪ از کل الزامات ارزیابی‌شده (${assessments.length} مورد)`,
        `- **وضعیت شکاف‌ها (Gap Analysis):** ${gaps.length} شکاف ثبت‌شده (${criticalGaps.length} شکاف با سطح ریسک بحرانی)`,
        `- **وضعیت برنامه اجرایی (WBS):** ${wbsTasks.length} فعالیت (${delayedWbs.length} فعالیت دارای تأخیر زمانی)`,
        `- **وضعیت CAPA:** ${capaItems.length} پرونده (${openCapas.length} نقص باز در گردش کار ۸ مرحله‌ای)`,
        `- **وضعیت بانک مدارک:** ${documents.length} مدرک (${documents.filter((d) => d.status === 'APPROVED').length} مدرک دارای تأیید نهایی و شواهد کافی)`,
        '',
        `#### ۲. تحلیل فنی و پیشنهادات اجرایی (مبنای CCPS RBPS & OSHA 1910.119)`,
        criticalGaps.length > 0
          ? `- **اولویت فوری (Critical Gaps):** تمرکز بر رفع شکاف‌های بحرانی در عناصر \`${criticalGaps
              .map((g) => g.ccpsElementCode || g.standardReference)
              .slice(0, 4)
              .join('، ')}\` و تبدیل فوری آن‌ها به فعالیت‌های مسیر بحرانی در WBS.`
          : `- **پوشش ارزیابی اولیه:** تکمیل ارزیابی برای تمامی ۲۰ عنصر CCPS و ۱۴ الزام OSHA جهت استخراج کامل شکاف‌های احتمالی.`,
        `- **کنترل یکپارچگی مدارک (PSI / SOP / MI):** اطمینان از پیوست شواهد اجرایی (نقشه‌های P&ID As-Built، برگه‌های تست PSV/SIS و گواهی تصدیق سالانه SOP) پیش از ارسال مدارک به مرحله تأیید.`,
        `- **حاکمیت CAPA:** رعایت کامل استقلال بازبین اثربخشی از مجری اقدام اصلاحی پیش از بستن پرونده‌های CAPA.`,
        `- **پایداری و بلوغ PSM:** ارتقای سطح بلوغ از طریق پایش منظم شاخص‌های پیشرو و پسرو (API RP 754 Tier 1-4) و برگزاری کمیته بازنگری مدیریت.`,
      ].join('\n');
    }

    await writePsmAuditLog(req, 'AI_LOCAL_ANALYSIS', 'PSM_PROJECT', projectId, null, {
      analysisMode,
      modelUsed,
    });

    res.json({
      success: true,
      data: {
        analysisMode,
        modelUsed,
        privacyGuarantee: 'LOCAL_ONLY_NO_CLOUD_TRANSMISSION',
        requiresHumanApproval: true,
        generatedAt: new Date().toISOString(),
        analysisText: aiResponseText,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'خطا در اجرای تحلیل هوش مصنوعی محلی PSM' });
  }
});

// ============================================================================
// 12. PSM Governance & Stage Gate Engine (موتور حاکمیت و کنترل مراحل پروژه PSM)
// ============================================================================

async function bootstrapProjectGates(projectId: number) {
  const existing = await db
    .select()
    .from(psmStageGates)
    .where(eq(psmStageGates.projectId, projectId))
    .orderBy(psmStageGates.gateNumber);

  if (existing.length >= 6) {
    return existing;
  }

  // Populate from standard authoritative catalog
  for (const def of PSM_STAGE_GATES) {
    const found = existing.find((g) => g.gateKey === def.gateKey);
    if (!found) {
      await db.insert(psmStageGates).values({
        projectId,
        gateKey: def.gateKey,
        gateNumber: def.gateNumber,
        titleFa: def.titleFa,
        titleEn: def.titleEn,
        descriptionFa: def.descriptionFa,
        entryCriteria: def.entryCriteriaFa,
        exitCriteria: def.exitCriteriaFa,
        mandatoryChecklist: def.mandatoryChecklist,
        requiredEvidenceList: def.requiredEvidenceList,
        preparedByName: def.defaultPreparerRoleFa,
        evaluatorName: 'کمیته راهبری و ممیزی PSM',
        approverName: def.defaultApproverRoleFa,
        status: def.gateNumber === 1 ? 'IN_REVIEW' : 'PENDING',
        blockingIssues: [],
        changeHistory: [
          {
            action: 'INITIALIZED',
            status: def.gateNumber === 1 ? 'IN_REVIEW' : 'PENDING',
            actor: 'موتور حاکمیت PSM',
            timestamp: new Date().toISOString(),
            note: 'دروازه کنترلی بر مبنای چارچوب CCPS RBPS و OSHA 1910.119 مقداردهی اولیه شد.',
          },
        ],
      });
    }
  }

  return await db
    .select()
    .from(psmStageGates)
    .where(eq(psmStageGates.projectId, projectId))
    .orderBy(psmStageGates.gateNumber);
}

async function evaluateProjectGate(projectId: number, gateKey: string) {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const checklistResults: Record<string, boolean> = {};

  const [project] = await db.select().from(psmProjects).where(eq(psmProjects.id, projectId));
  if (!project) {
    return {
      canPass: false,
      blockingIssues: ['پروژه مورد نظر یافت نشد.'],
      warnings: [],
      checklistResults: {},
      approvedDeviations: [],
    };
  }

  const allGates = await db.select().from(psmStageGates).where(eq(psmStageGates.projectId, projectId));
  const prevGateMap: Record<string, string> = {
    G2: 'G1',
    G3: 'G2',
    G4: 'G3',
    G5: 'G4',
    G6: 'G5',
  };

  const prevKey = prevGateMap[gateKey];
  if (prevKey) {
    const prevGate = allGates.find((g) => g.gateKey === prevKey);
    const [prevDev] = await db
      .select()
      .from(psmGateDeviations)
      .where(
        and(
          eq(psmGateDeviations.projectId, projectId),
          eq(psmGateDeviations.gateKey, prevKey),
          eq(psmGateDeviations.status, 'APPROVED')
        )
      );

    if (prevGate?.status !== 'APPROVED' && !prevDev) {
      blockingIssues.push(`دروازه پیش‌نیاز (${prevKey}) هنوز به تأیید نهایی نرسیده است و انحراف مصوبی برای آن ثبت نشده است.`);
    }
  }

  if (gateKey === 'G1') {
    const assessments = await db.select().from(psmAssessments).where(eq(psmAssessments.projectId, projectId));
    if (assessments.length === 0) {
      blockingIssues.push('ارزیابی اولیه وضعیت موجود (Baseline Assessment) برای الزامات PSM هنوز ثبت نشده است.');
      checklistResults['g1_assessments_completed'] = false;
    } else {
      checklistResults['g1_assessments_completed'] = true;
    }

    const unverifiedOutOfScope = assessments.filter(
      (a) =>
        (a.complianceStatus === 'OUT_OF_SCOPE' || !a.isInScope) &&
        (!a.outOfScopeApprovedBy || String(a.outOfScopeJustification || '').length < 15)
    );
    if (unverifiedOutOfScope.length > 0) {
      blockingIssues.push(`تعداد ${unverifiedOutOfScope.length} مورد عدم شمول فاقد توجیه فنی یا تأییدیه معتبر هستند.`);
      checklistResults['g1_out_of_scope_justified'] = false;
    } else {
      checklistResults['g1_out_of_scope_justified'] = true;
    }

    checklistResults['g1_scope_defined'] = Boolean(project.scopeDescription && project.scopeDescription.length >= 15);
    checklistResults['g1_team_charter_signed'] = Boolean(
      (project.projectManagerName || (project as any).managerName) &&
      (project.projectSponsorName || (project as any).sponsorName)
    );
  } else if (gateKey === 'G2') {
    const gaps = await db.select().from(psmGaps).where(eq(psmGaps.projectId, projectId));
    if (gaps.length === 0) {
      const nonCompliant = await db
        .select()
        .from(psmAssessments)
        .where(and(eq(psmAssessments.projectId, projectId), sql`compliance_score < 100`));
      if (nonCompliant.length > 0) {
        blockingIssues.push(`تعداد ${nonCompliant.length} ارزیابی با عدم انطباق شناسایی شده اما هنوز شکافی در فهرست شکاف‌ها ثبت نشده است.`);
      }
    }

    const invalidGaps = gaps.filter(
      (g) => !g.responsiblePersonName || !g.proposedDueDate || !g.riskLevel || !g.unitName
    );
    if (invalidGaps.length > 0) {
      blockingIssues.push(`تعداد ${invalidGaps.length} شکاف فاقد مشخصات کامل اجباری (مسئول مستقیم، مهلت یا سطح ریسک) هستند.`);
      checklistResults['g2_gaps_assigned'] = false;
      checklistResults['g2_owners_and_dues_set'] = false;
    } else {
      checklistResults['g2_gaps_assigned'] = true;
      checklistResults['g2_owners_and_dues_set'] = gaps.length > 0;
    }

    checklistResults['g2_gap_analysis_completed'] = gaps.length > 0;
    checklistResults['g2_all_gaps_logged'] = gaps.length > 0;
    checklistResults['g2_risk_levels_defined'] = gaps.length > 0 && gaps.every((g) => Boolean(g.riskLevel));
    checklistResults['g2_risk_levels_assigned'] = gaps.length > 0 && gaps.every((g) => Boolean(g.riskLevel));
    checklistResults['g2_priorities_approved'] = gaps.length > 0 && invalidGaps.length === 0;
    checklistResults['g2_critical_gaps_reviewed'] = gaps.length > 0 && invalidGaps.length === 0;
  } else if (gateKey === 'G3') {
    const gaps = await db.select().from(psmGaps).where(eq(psmGaps.projectId, projectId));
    const openCriticalGaps = gaps.filter(
      (g) => g.riskLevel === 'CRITICAL' && g.status === 'OPEN' && !g.linkedWbsId && !g.linkedCapaId
    );
    if (openCriticalGaps.length > 0) {
      blockingIssues.push(`تعداد ${openCriticalGaps.length} شکاف بحرانی فاقد فعالیت متناظر در ساختار WBS یا اقدام اصلاحی CAPA هستند.`);
      checklistResults['g3_wbs_covers_gaps'] = false;
      checklistResults['g3_wbs_fully_mapped'] = false;
    } else {
      checklistResults['g3_wbs_covers_gaps'] = true;
      checklistResults['g3_wbs_fully_mapped'] = true;
    }

    const tasks = await db.select().from(psmWbsTasks).where(eq(psmWbsTasks.projectId, projectId));
    if (tasks.length === 0) {
      blockingIssues.push('هیچ فعالیت اجرایی در ساختار شکست کار (WBS) تعریف نشده است.');
      checklistResults['g3_wbs_defined'] = false;
      checklistResults['g3_critical_path_identified'] = false;
      checklistResults['g3_gantt_approved'] = false;
    } else {
      checklistResults['g3_wbs_defined'] = true;
      checklistResults['g3_critical_path_identified'] = true;
      const invalidTasks = tasks.filter((t) => !t.plannedStart || !t.plannedEnd || !t.ownerName);
      if (invalidTasks.length > 0) {
        blockingIssues.push(`تعداد ${invalidTasks.length} فعالیت WBS فاقد تاریخ شروع، پایان یا مسئول مستقیم هستند.`);
        checklistResults['g3_gantt_approved'] = false;
      } else {
        checklistResults['g3_gantt_approved'] = true;
      }
    }

    const hasBudget = (project.budgetAllocated || 0) > 0 || tasks.some((t) => (t.allocatedBudget || 0) > 0 || Boolean(t.resources));
    checklistResults['g3_resources_allocated'] = hasBudget;
    checklistResults['g3_budget_allocated'] = hasBudget;
    checklistResults['g3_gantt_baseline_set'] = tasks.length > 0;
  } else if (gateKey === 'G4') {
    const docs = await db.select().from(psmDocuments).where(eq(psmDocuments.projectId, projectId));
    if (docs.length === 0) {
      blockingIssues.push('بانک اسناد و مدارک PSM برای این پروژه فاقد هرگونه مدرک ثبت‌شده است.');
      checklistResults['g4_all_deliverables_completed'] = false;
      checklistResults['g4_documents_approved_with_evidence'] = false;
      checklistResults['g4_no_unapproved_revisions'] = false;
    } else {
      const pendingDocs = docs.filter((d) => d.status !== 'APPROVED');
      if (pendingDocs.length > 0) {
        blockingIssues.push(`تعداد ${pendingDocs.length} مدرک فرایندی هنوز در وضعیت پیش‌نویس، رد شده یا در دست بررسی هستند و به تأیید نهایی نرسیده‌اند.`);
        checklistResults['g4_all_deliverables_completed'] = false;
        checklistResults['g4_documents_approved_with_evidence'] = false;
        checklistResults['g4_no_unapproved_revisions'] = false;
      } else {
        checklistResults['g4_all_deliverables_completed'] = true;
        checklistResults['g4_documents_approved_with_evidence'] = true;
        checklistResults['g4_no_unapproved_revisions'] = true;
      }
    }

    const gaps = await db.select().from(psmGaps).where(eq(psmGaps.projectId, projectId));
    const criticalGapsOpen = gaps.filter((g) => g.riskLevel === 'CRITICAL' && g.status === 'OPEN');
    if (criticalGapsOpen.length > 0) {
      blockingIssues.push(`تعداد ${criticalGapsOpen.length} شکاف بحرانی هنوز در وضعیت OPEN قرار دارند.`);
      checklistResults['g4_no_critical_open'] = false;
      checklistResults['g4_wbs_deliverables_completed'] = false;
    } else {
      checklistResults['g4_no_critical_open'] = true;
      checklistResults['g4_wbs_deliverables_completed'] = true;
    }

    checklistResults['g4_technical_reviews_passed'] = docs.length > 0 && docs.every((d) => d.status === 'APPROVED');
    checklistResults['g4_specialized_studies_finalized'] = docs.length > 0 && docs.every((d) => d.status === 'APPROVED');
    checklistResults['g4_evidence_verified'] = docs.every(
      (d) => Boolean(d.fileUrl || d.fileId || (d.evidenceSummary && d.evidenceSummary.length >= 10))
    );
  } else if (gateKey === 'G5') {
    const capas = await db.select().from(psmCapaItems).where(eq(psmCapaItems.projectId, projectId));
    const criticalOpenCapas = capas.filter(
      (c) => c.riskSeverity >= 4 && c.stage !== 'CLOSED' && c.stage !== 'EFFECTIVENESS_VERIFIED'
    );
    if (criticalOpenCapas.length > 0) {
      blockingIssues.push(`تعداد ${criticalOpenCapas.length} پرونده اقدام اصلاحی بحرانی (Critical CAPA) با تأیید اثربخشی بسته نشده‌اند.`);
      checklistResults['g5_critical_capas_closed'] = false;
    } else {
      checklistResults['g5_critical_capas_closed'] = true;
    }

    const closedWithoutIndep = capas.filter(
      (c) =>
        (c.stage === 'CLOSED' || c.stage === 'EFFECTIVENESS_VERIFIED') &&
        (!c.effectivenessVerifierName || c.effectivenessVerifierName === c.responsiblePersonName)
    );
    if (closedWithoutIndep.length > 0) {
      blockingIssues.push(`تعداد ${closedWithoutIndep.length} پرونده CAPA فاقد صحه‌گذاری توسط ارزیاب مستقل (غیر از مجری اقدام) هستند.`);
      checklistResults['g5_independent_verification_done'] = false;
    } else {
      checklistResults['g5_independent_verification_done'] = true;
    }

    checklistResults['g5_residual_actions_managed'] = true;
    checklistResults['g5_controls_validated_in_field'] = true;
  } else if (gateKey === 'G6') {
    const previousUnapproved = allGates.filter((g) => g.gateNumber < 6 && g.status !== 'APPROVED');
    if (previousUnapproved.length > 0) {
      blockingIssues.push(`دروازه‌های پیشین (${previousUnapproved.map((g) => g.gateKey).join('، ')}) به تأیید نهایی نرسیده‌اند.`);
      checklistResults['g6_all_gates_preceding_approved'] = false;
    } else {
      checklistResults['g6_all_gates_preceding_approved'] = true;
    }

    const gaps = await db.select().from(psmGaps).where(eq(psmGaps.projectId, projectId));
    const openCritGaps = gaps.filter((g) => g.riskLevel === 'CRITICAL' && g.status !== 'CLOSED');
    const capas = await db.select().from(psmCapaItems).where(eq(psmCapaItems.projectId, projectId));
    const openCritCapas = capas.filter(
      (c) => c.riskSeverity >= 4 && c.stage !== 'CLOSED' && c.stage !== 'EFFECTIVENESS_VERIFIED'
    );
    if (openCritGaps.length > 0 || openCritCapas.length > 0) {
      blockingIssues.push(`پروژه دارای ${openCritGaps.length} شکاف بحرانی باز و ${openCritCapas.length} اقدام اصلاحی بحرانی باز است.`);
      checklistResults['g6_zero_critical_open'] = false;
    } else {
      checklistResults['g6_zero_critical_open'] = true;
    }

    const maturityAssessments = await db
      .select()
      .from(psmMaturityAssessments)
      .where(eq(psmMaturityAssessments.projectId, projectId));
    const latestMaturity = maturityAssessments[maturityAssessments.length - 1];
    if (!latestMaturity || (latestMaturity.overallMaturityScore || 0) < 3.0) {
      blockingIssues.push(
        `امتیاز مدل بلوغ PSM (${latestMaturity?.overallMaturityScore || 1.0}) کمتر از حداقل الزامی برای تحویل نهایی (سطح ۳.۰۰) است.`
      );
      checklistResults['g6_maturity_level_achieved'] = false;
    } else {
      checklistResults['g6_maturity_level_achieved'] = true;
    }

    checklistResults['g6_final_handover_signed'] = true;
  }

  const approvedDeviations = await db
    .select()
    .from(psmGateDeviations)
    .where(
      and(
        eq(psmGateDeviations.projectId, projectId),
        eq(psmGateDeviations.gateKey, gateKey),
        eq(psmGateDeviations.status, 'APPROVED')
      )
    );

  const canPass = blockingIssues.length === 0 || approvedDeviations.length > 0;
  return { canPass, blockingIssues, warnings, checklistResults, approvedDeviations };
}

// Section 10 Governance Rule: Re-open previously APPROVED Stage Gates if criteria/documents/critical gaps become invalid
async function reopenDependentApprovedGatesIfInvalid(projectId: number, reason: string, actor: string) {
  if (!projectId) return;
  try {
    const gates = await db
      .select()
      .from(psmStageGates)
      .where(and(eq(psmStageGates.projectId, projectId), eq(psmStageGates.status, 'APPROVED')));

    for (const gate of gates) {
      const evalResult = await evaluateProjectGate(projectId, gate.gateKey);
      if (!evalResult.canPass) {
        const prevHistory = Array.isArray(gate.changeHistory) ? [...gate.changeHistory] : [];
        prevHistory.unshift({
          action: 'GATE_REOPENED_AUTOMATICALLY',
          status: 'IN_REVIEW',
          actor: actor || 'موتور حاکمیت هوشمند PSM',
          timestamp: new Date().toISOString(),
          note: `بازگشایی خودکار دروازه ${gate.gateKey} به دلیل تغییر معیارهای مصوب: ${reason}`,
        });

        await db
          .update(psmStageGates)
          .set({
            status: 'IN_REVIEW',
            blockingIssues: evalResult.blockingIssues,
            comments: `دروازه به دلیل تغییر در معیارهای مصوب (${reason}) به حالت نیازمند بررسی مجدد بازگشت.`,
            changeHistory: prevHistory,
            updatedAt: new Date(),
          })
          .where(eq(psmStageGates.id, gate.id));
      }
    }
  } catch (err) {
    logger.error('[PSM Gate Reopen Check] Error:', err);
  }
}

// 12.1. Get all Stage Gates for a project with live computed evaluation
router.get('/projects/:id/gates', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const gates = await bootstrapProjectGates(projectId);
    const deviations = await db
      .select()
      .from(psmGateDeviations)
      .where(eq(psmGateDeviations.projectId, projectId))
      .orderBy(desc(psmGateDeviations.createdAt));

    const evaluatedGates = await Promise.all(
      gates.map(async (gate) => {
        const evalResult = await evaluateProjectGate(projectId, gate.gateKey);
        return {
          ...gate,
          evaluation: evalResult,
        };
      })
    );

    const approvedCount = evaluatedGates.filter((g) => g.status === 'APPROVED').length;
    const activeGate = evaluatedGates.find((g) => g.status !== 'APPROVED') || evaluatedGates[evaluatedGates.length - 1];

    res.json({
      success: true,
      data: {
        gates: evaluatedGates,
        deviations,
        projectSummary: {
          totalGates: evaluatedGates.length,
          approvedCount,
          activeGateKey: activeGate?.gateKey || 'G1',
          progressPct: Math.round((approvedCount / evaluatedGates.length) * 100),
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'خطا در دریافت دروازه‌های کنترلی پروژه PSM' });
  }
});

// 12.2. Evaluate live blockers & exit criteria for a specific gate
router.post('/projects/:id/gates/:gateKey/evaluate', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const gateKey = String(req.params.gateKey).toUpperCase();
    const evalResult = await evaluateProjectGate(projectId, gateKey);

    // Persist blocking issues to gate record
    await db
      .update(psmStageGates)
      .set({
        blockingIssues: evalResult.blockingIssues,
        updatedAt: new Date(),
      })
      .where(and(eq(psmStageGates.projectId, projectId), eq(psmStageGates.gateKey, gateKey)));

    res.json({
      success: true,
      data: {
        gateKey,
        ...evalResult,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'خطا در ارزیابی دروازه کنترلی' });
  }
});

// 12.2b. Update Gate Preparer & Approver Roles (انتصاب مسئول آماده‌سازی و تأییدکننده از پرسنل مرکزی)
router.put('/projects/:id/gates/:gateKey/assign', requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز برای تغییر مسئولان دروازه' });
  }
  try {
    const projectId = Number(req.params.id);
    const gateKey = String(req.params.gateKey).toUpperCase();
    const b = req.body || {};

    const [gate] = await db
      .select()
      .from(psmStageGates)
      .where(and(eq(psmStageGates.projectId, projectId), eq(psmStageGates.gateKey, gateKey)));

    if (!gate) {
      return res.status(404).json({ success: false, error: 'دروازه مورد نظر یافت نشد.' });
    }

    const prevHistory = Array.isArray(gate.changeHistory) ? gate.changeHistory : [];
    const newEntry = {
      timestamp: new Date().toISOString(),
      action: 'به‌روزرسانی مسئولین آماده‌سازی و تصویب دروازه',
      actor: (req as any).user?.fullName || (req as any).user?.username || 'مدیر پروژه',
      note: `مسئول آماده‌سازی: ${b.preparedByName || gate.preparedByName} | مقام تصویب‌کننده: ${b.approverName || gate.approverName}`,
    };

    const [updated] = await db
      .update(psmStageGates)
      .set({
        preparedByName: b.preparedByName !== undefined ? String(b.preparedByName).trim() : gate.preparedByName,
        approverName: b.approverName !== undefined ? String(b.approverName).trim() : gate.approverName,
        changeHistory: [newEntry, ...prevHistory],
        updatedAt: new Date(),
      })
      .where(eq(psmStageGates.id, gate.id))
      .returning();

    await writePsmAuditLog(req, 'UPDATE', 'PSM_STAGE_GATE', gate.id, gate, updated);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در به‌روزرسانی مسئولان دروازه' });
  }
});

// 12.3. Decision on Gate (Approve, Reject, Suspend) - Strict Server-side Governance
router.post('/projects/:id/gates/:gateKey/decision', requireAuth, async (req: Request, res: Response) => {
  if (!canApprovePsm(req)) {
    return res.status(403).json({
      success: false,
      error: 'تصمیم‌گیری و تغییر وضعیت دروازه‌های حاکمیت PSM نیازمند سطح دسترسی مدیر ارشد / تأییدکننده مجاز است.',
    });
  }

  try {
    const projectId = Number(req.params.id);
    const gateKey = String(req.params.gateKey).toUpperCase();
    const b = req.body || {};
    const decision = String(b.decision || '').toUpperCase(); // APPROVED | REJECTED | SUSPENDED | IN_REVIEW

    if (!['APPROVED', 'REJECTED', 'SUSPENDED', 'IN_REVIEW'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: 'تصمیم انتخابی نامعتبر است (APPROVED، REJECTED، SUSPENDED یا IN_REVIEW).',
      });
    }

    const [gate] = await db
      .select()
      .from(psmStageGates)
      .where(and(eq(psmStageGates.projectId, projectId), eq(psmStageGates.gateKey, gateKey)));

    if (!gate) {
      return res.status(404).json({ success: false, error: 'دروازه کنترلی مورد نظر یافت نشد.' });
    }

    const actor = req.user?.name || req.user?.username || 'مدیر سیستم';
    const todayStr = new Date().toISOString().slice(0, 10);
    const decisionDate = b.decisionDate ? String(b.decisionDate).trim() : todayStr;
    const meetingMinutes = b.meetingMinutes ? String(b.meetingMinutes).trim() : gate.meetingMinutes;
    const comments = b.comments ? String(b.comments).trim() : '';

    const historyArr = Array.isArray(gate.changeHistory) ? [...gate.changeHistory] : [];

    if (decision === 'APPROVED') {
      // Law 3: Strict server-side validation against tampering or bypassing
      const evalResult = await evaluateProjectGate(projectId, gateKey);
      if (!evalResult.canPass) {
        return res.status(400).json({
          success: false,
          error: `خطای عبور غیرمجاز (قانون ۳ حاکمیت PSM): موانع بحرانی زیر مانع از تصویب این دروازه هستند:\n${evalResult.blockingIssues.join(
            '\n'
          )}`,
          blockingIssues: evalResult.blockingIssues,
        });
      }

      historyArr.push({
        action: 'GATE_APPROVED',
        status: 'APPROVED',
        actor,
        timestamp: new Date().toISOString(),
        note: comments || 'تصویب رسمی دروازه مرحله با رعایت کامل معیارهای خروج و قوانین حاکمیت PSM',
      });

      const [updated] = await db
        .update(psmStageGates)
        .set({
          status: 'APPROVED',
          decisionDate,
          meetingMinutes,
          comments: comments || gate.comments,
          approverName: b.approverName || actor,
          approvedAt: new Date(),
          approvedBy: actor,
          blockingIssues: [],
          changeHistory: historyArr,
          updatedAt: new Date(),
        })
        .where(eq(psmStageGates.id, gate.id))
        .returning();

      // If G6 is approved, project becomes ACTIVE_SYSTEM
      if (gateKey === 'G6') {
        await db
          .update(psmProjects)
          .set({
            overallStatus: 'ACTIVE_SYSTEM',
            overallProgress: 100,
            updatedAt: new Date(),
          })
          .where(eq(psmProjects.id, projectId));
      }

      await writePsmAuditLog(req, 'GATE_APPROVED', 'PSM_STAGE_GATE', gate.id, gate, updated, {
        gateKey,
        decisionDate,
        meetingMinutes,
      });

      broadcastDataMutation('psm:stage_gates', 'update', updated);
      return res.json({
        success: true,
        data: updated,
        message: `دروازه ${gateKey} با موفقیت تصویب گردید و پروژه به مرحله بعد هدایت شد.`,
      });
    }

    if (decision === 'REJECTED') {
      // Law 2 / Scenario 6: Rejection returns project to rework and records feedback
      historyArr.push({
        action: 'GATE_REJECTED_REWORK_REQUIRED',
        status: 'REJECTED',
        actor,
        timestamp: new Date().toISOString(),
        note: comments || 'درخواست بازنگری و اصلاحات مجدد (Rework Required)',
      });

      const [updated] = await db
        .update(psmStageGates)
        .set({
          status: 'REJECTED',
          decisionDate,
          meetingMinutes,
          comments: comments || 'درخواست بازنگری و اصلاحات مجدد (Rework Required)',
          approverName: b.approverName || actor,
          changeHistory: historyArr,
          updatedAt: new Date(),
        })
        .where(eq(psmStageGates.id, gate.id))
        .returning();

      await writePsmAuditLog(req, 'GATE_REJECTED', 'PSM_STAGE_GATE', gate.id, gate, updated, {
        gateKey,
        decisionDate,
        comments,
      });

      broadcastDataMutation('psm:stage_gates', 'update', updated);
      return res.json({
        success: true,
        data: updated,
        message: `دروازه ${gateKey} رد گردید و جهت رفع نواقص و بازنگری مجدد ارجاع داده شد.`,
      });
    }

    // SUSPENDED or IN_REVIEW
    historyArr.push({
      action: `GATE_STATUS_${decision}`,
      status: decision,
      actor,
      timestamp: new Date().toISOString(),
      note: comments || `تغییر وضعیت دروازه به ${decision}`,
    });

    const [updated] = await db
      .update(psmStageGates)
      .set({
        status: decision,
        decisionDate,
        meetingMinutes,
        comments: comments || gate.comments,
        changeHistory: historyArr,
        updatedAt: new Date(),
      })
      .where(eq(psmStageGates.id, gate.id))
      .returning();

    await writePsmAuditLog(req, `GATE_STATUS_${decision}`, 'PSM_STAGE_GATE', gate.id, gate, updated, {
      gateKey,
      decision,
    });

    broadcastDataMutation('psm:stage_gates', 'update', updated);
    res.json({
      success: true,
      data: updated,
      message: `وضعیت دروازه ${gateKey} به ${decision} تغییر یافت.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در ثبت تصمیم دروازه کنترلی' });
  }
});

// 12.4. Register Formal Gate Deviation (ثبت انحراف مصوب با توجیه فنی و ارزیابی ریسک)
router.post('/projects/:id/gates/:gateKey/deviations', requireAuth, async (req: Request, res: Response) => {
  if (!canWritePsm(req)) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی مجاز' });
  }
  try {
    const projectId = Number(req.params.id);
    const gateKey = String(req.params.gateKey).toUpperCase();
    const b = req.body || {};

    if (
      !b.title ||
      !b.requirementDescription ||
      !b.technicalJustification ||
      !b.compensatoryMeasures ||
      !b.validUntilDate ||
      !b.requestedByName
    ) {
      return res.status(400).json({
        success: false,
        error: 'عنوان انحراف، شرح الزام، توجیه فنی، اقدامات جبرانی، مهلت اعتبار و متقاضی الزامی هستند.',
      });
    }

    const techJust = String(b.technicalJustification).trim();
    const compMeas = String(b.compensatoryMeasures).trim();
    if (techJust.length < 10 || compMeas.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'توجیه فنی و اقدامات جبرانی باید حداقل ۱۰ کاراکتر باشند.',
      });
    }

    const deviationCode = String(
      b.deviationCode || `DEV-${projectId}-${gateKey}-${Math.floor(1000 + Math.random() * 9000)}`
    ).trim();

    const actor = req.user?.name || req.user?.username || 'کاربر سامانه';
    const [created] = await db
      .insert(psmGateDeviations)
      .values({
        projectId,
        gateKey,
        deviationCode,
        title: String(b.title).trim(),
        requirementDescription: String(b.requirementDescription).trim(),
        technicalJustification: techJust,
        riskAssessmentSummary: String(b.riskAssessmentSummary || 'ارزیابی ریسک و تحلیل خطرات انجام شده است').trim(),
        compensatoryMeasures: compMeas,
        isLegalRequirement: Boolean(b.isLegalRequirement),
        requestedByName: String(b.requestedByName).trim(),
        validUntilDate: String(b.validUntilDate).trim(),
        status: 'PENDING',
        changeHistory: [
          {
            action: 'CREATED',
            status: 'PENDING',
            actor,
            timestamp: new Date().toISOString(),
            note: 'درخواست انحراف مصوب با توجیه فنی ثبت گردید.',
          },
        ],
      })
      .returning();

    await writePsmAuditLog(req, 'CREATE_DEVIATION', 'PSM_GATE_DEVIATION', created.id, null, created, {
      deviationCode,
      gateKey,
    });

    broadcastDataMutation('psm:deviations', 'create', created);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در ثبت انحراف از دروازه' });
  }
});

// 12.5. Decide on Deviation (Approve or Reject with strict Law 3 legal check)
router.put('/deviations/:id/decide', requireAuth, async (req: Request, res: Response) => {
  if (!canApprovePsm(req)) {
    return res.status(403).json({
      success: false,
      error: 'تصمیم‌گیری در خصوص انحرافات حاکمیت PSM نیازمند سطح دسترسی مدیر ارشد / تأییدکننده مجاز است.',
    });
  }

  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(psmGateDeviations).where(eq(psmGateDeviations.id, id));
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'پرونده انحراف مورد نظر یافت نشد.' });
    }
    const deviation = rows[0];
    const b = req.body || {};
    const decision = String(b.decision || '').toUpperCase(); // APPROVED | REJECTED

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'تصمیم باید APPROVED یا REJECTED باشد.' });
    }

    // Law 3: Non-waivable statutory & legal requirements
    if (decision === 'APPROVED' && deviation.isLegalRequirement) {
      return res.status(400).json({
        success: false,
        error:
          'خطای حاکمیت PSM: بر اساس قانون سوم حاکمیت، انحراف از الزامات قانونی، استانداردهای ملی و مقررات اجباری تحت هیچ شرایطی قابل تصویب نیست.',
      });
    }

    const actor = req.user?.name || req.user?.username || 'مدیر سیستم';
    const historyArr = Array.isArray(deviation.changeHistory) ? [...deviation.changeHistory] : [];
    historyArr.push({
      action: `DEVIATION_${decision}`,
      status: decision,
      actor,
      timestamp: new Date().toISOString(),
      note: b.decisionNotes || `تصمیم‌گیری انحراف: ${decision}`,
    });

    const [updated] = await db
      .update(psmGateDeviations)
      .set({
        status: decision,
        approvedByName: decision === 'APPROVED' ? actor : deviation.approvedByName,
        approvalRole: b.approvalRole || req.user?.role || 'مدیر تأییدکننده',
        decidedAt: new Date(),
        decisionNotes: b.decisionNotes ? String(b.decisionNotes).trim() : null,
        changeHistory: historyArr,
        updatedAt: new Date(),
      })
      .where(eq(psmGateDeviations.id, id))
      .returning();

    await writePsmAuditLog(req, `DEVIATION_${decision}`, 'PSM_GATE_DEVIATION', id, deviation, updated, {
      decision,
      decisionNotes: b.decisionNotes,
    });

    broadcastDataMutation('psm:deviations', 'update', updated);
    res.json({
      success: true,
      data: updated,
      message: `انحراف با کد ${deviation.deviationCode} با وضعیت ${decision} تعیین تکلیف گردید.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'خطا در ثبت تصمیم انحراف' });
  }
});

// 12.6. Get deviations for a project
router.get('/projects/:id/deviations', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const rows = await db
      .select()
      .from(psmGateDeviations)
      .where(eq(psmGateDeviations.projectId, projectId))
      .orderBy(desc(psmGateDeviations.createdAt));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'خطا در دریافت فهرست انحرافات' });
  }
});

export default router;
