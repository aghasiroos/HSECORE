import { Router, Request, Response } from 'express';
import { db } from '../../src/db/index.ts';
import * as schema from '../../src/db/schema.ts';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { requireAuth, requireRole } from '../core/middleware/auth.ts';
import { weatherService } from '../weather/service.ts';
import { isWeatherRecordStale } from '../weather/physics.ts';
import { logger } from '../core/logger.ts';
import { broadcastDataMutation } from '../core/socket.ts';
import { DEFAULT_DASHBOARD_CARDS_LAYOUT } from '../../src/hooks/useDashboardMetrics.ts';

export const dashboardRouter = Router();

// ── CANONICAL PERMANENT PRODUCTION DEFAULT LAYOUT (FOR VPS & LOCAL DEPLOYMENTS) ──
export const CANONICAL_DEFAULT_DASHBOARD_LAYOUT = {
  cards: DEFAULT_DASHBOARD_CARDS_LAYOUT,
  updatedAt: new Date().toISOString(),
  updatedBy: 'Production Default Standard',
};

// In-memory micro-cache for ultra-fast response (<3ms)
let cachedMetricsData: any = null;
let lastMetricsCacheTime = 0;
const CACHE_TTL_MS = 10000; // 10 seconds cache for dashboard metrics

export function invalidateDashboardCache() {
  cachedMetricsData = null;
  lastMetricsCacheTime = 0;
}

dashboardRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    const bypassCache = req.query.refresh === 'true';

    if (!bypassCache && cachedMetricsData && (now - lastMetricsCacheTime < CACHE_TTL_MS)) {
      res.setHeader('Cache-Control', 'public, max-age=10');
      return res.json({
        success: true,
        cached: true,
        timestamp: new Date(lastMetricsCacheTime).toISOString(),
        summary: cachedMetricsData,
      });
    }

    // Execute all پایگاه داده queries in parallel with complete schema safety
    const [
      trirRows,
      allIncidents,
      allPermits,
      allExams,
      allRisks,
      allWarnings,
      allFireEq,
      allFiveS,
      allPersonnel,
      allDepts,
      targetSetting,
      allNotifs,
      allTrainings,
      allAttendances,
      allInspections,
      allEnvLogs,
      allAudiometry,
      allSpirometry,
      allPpeIssuances
    ] = await Promise.all([
      db.select().from(schema.trirMonthlyRecords).orderBy(desc(schema.trirMonthlyRecords.year), desc(schema.trirMonthlyRecords.monthIndex)).catch(() => []),
      db.select().from(schema.incidents).orderBy(desc(schema.incidents.createdAt)).catch(() => []),
      db.select().from(schema.workPermits).orderBy(desc(schema.workPermits.createdAt)).catch(() => []),
      db.select().from(schema.periodicMedicalExams).orderBy(desc(schema.periodicMedicalExams.createdAt)).catch(() => []),
      db.select().from(schema.riskAssessments).catch(() => []),
      db.select().from(schema.safetyWarnings).orderBy(desc(schema.safetyWarnings.createdAt)).catch(() => []),
      db.select().from(schema.fireEquipment).catch(() => []),
      db.select().from(schema.fiveSAudits).orderBy(desc(schema.fiveSAudits.createdAt)).catch(() => []),
      db.select().from(schema.personnel).catch(() => []),
      db.select().from(schema.orgDepartments).catch(() => []),
      db.select().from(schema.systemSettings).catch(() => []),
      db.select().from(schema.notifications).where(eq(schema.notifications.isDeleted, false)).orderBy(desc(schema.notifications.createdAt)).limit(10).catch(() => []),
      db.select().from(schema.hseTrainings).catch(() => []),
      db.select().from(schema.trainingAttendances).catch(() => []),
      db.select().from(schema.safetyInspections).orderBy(desc(schema.safetyInspections.createdAt)).catch(() => []),
      db.select().from(schema.environmentalLogs).catch(() => []),
      db.select().from(schema.audiometryRecords).catch(() => []),
      db.select().from(schema.spirometryRecords).catch(() => []),
      db.select().from(schema.ppeIssuances).catch(() => []),
    ]);

    // Fast lookup map for all systemSettings persistent storage
    const settingsMap = new Map<string, any>();
    (targetSetting as any[]).forEach(s => {
      if (s && s.key) {
        let val = s.value;
        if (typeof val === 'string') {
          try { val = JSON.parse(val); } catch {}
        }
        settingsMap.set(s.key, val);
        settingsMap.set(s.key.toLowerCase(), val);
      }
    });

    // 1. Process TRIR Series
    const formattedTrir = (trirRows as any[]).map((r: any) => ({
      id: String(r.id),
      year: Number(r.year),
      month: String(r.month),
      monthIndex: Number(r.monthIndex || 1),
      attendance: Number(r.attendanceHours ?? 0),
      mission: Number(r.missionHours ?? 0),
      contractor: Number(r.contractorHours ?? 0),
      attendanceHours: Number(r.attendanceHours ?? 0),
      missionHours: Number(r.missionHours ?? 0),
      contractorHours: Number(r.contractorHours ?? 0),
      totalHours: Number(r.totalHours ?? 0) || (Number(r.attendanceHours ?? 0) + Number(r.missionHours ?? 0) + Number(r.contractorHours ?? 0)),
      incidents: Number(r.incidents ?? 0),
      monthlyTrir: Number(r.monthlyTrir ?? 0),
      monthlyTRIR: Number(r.monthlyTrir ?? 0),
      rollingTrir: Number(r.rollingTrir ?? 0),
      rollingTRIR: Number(r.rollingTrir ?? 0),
      notes: r.notes || '',
      label: `${r.month} ${r.year}`,
    }));

    const trirChronological = [...formattedTrir].reverse();
    const last12Points = trirChronological.slice(-12);
    const prev12Points = trirChronological.length > 12 ? trirChronological.slice(-24, -12) : [];

    const current12Incidents = last12Points.reduce((sum, p) => sum + p.incidents, 0);
    const prev12Incidents = prev12Points.reduce((sum, p) => sum + p.incidents, 0);

    let incidentPercentChange = 0;
    let incidentTrend: 'up' | 'down' | 'flat' = 'flat';
    if (prev12Incidents > 0) {
      incidentPercentChange = ((current12Incidents - prev12Incidents) / prev12Incidents) * 100;
      if (incidentPercentChange > 0) incidentTrend = 'up';
      else if (incidentPercentChange < 0) incidentTrend = 'down';
    } else if (current12Incidents > 0) {
      incidentPercentChange = 100;
      incidentTrend = 'up';
    }

    const totalSafeHours12M = last12Points.reduce((sum, p) => sum + p.totalHours, 0);
    const latestRollingTrir = last12Points.length > 0 ? last12Points[last12Points.length - 1].rollingTRIR : 0;

    // 2. Process Incidents (Normalized across OSHA and Safety Incident Reporting module)
    const incList = allIncidents as any[];
    const ltiIncidents = incList.filter(i => {
      const type = String(i.type || i.incidentType || '').toUpperCase();
      const sev = String(i.severity || '').toUpperCase();
      return type === 'LTI' || sev.includes('LTI') || sev.includes('FATAL') || sev.includes('MAJOR') || Boolean(i.isLti) || Boolean(i.isOshaRecordable);
    });

    const nearMissIncidents = incList.filter(i => {
      const type = String(i.type || i.incidentType || '').toUpperCase();
      const cat = String(i.category || i.categoryFa || '').toLowerCase();
      const sev = String(i.severity || '').toLowerCase();
      return type === 'NEARMISS' || type === 'NEAR_MISS' || cat.includes('شبه') || sev.includes('near miss');
    });

    const unsafeActsIncidents = incList.filter(i => {
      const type = String(i.type || i.incidentType || '').toUpperCase();
      const cat = String(i.category || i.categoryFa || '').toLowerCase();
      return type === 'UNSAFE_ACT' || cat.includes('عمل ناایمن');
    });

    const unsafeConditionsIncidents = incList.filter(i => {
      const type = String(i.type || i.incidentType || '').toUpperCase();
      const cat = String(i.category || i.categoryFa || '').toLowerCase();
      return type === 'UNSAFE_CONDITION' || cat.includes('شرایط ناایمن');
    });

    const openIncidents = incList.filter(i => {
      const st = String(i.status || '').toUpperCase();
      return !['CLOSED', 'RESOLVED', 'COMPLETED'].includes(st);
    });

    const totalLostDays = incList.reduce<number>((sum, i) => sum + (Number(i.lostDays || i.lostWorkDays || i.lostWorkdays || 0)), 0);

    // 3. Process Work Permits (PTW)
    const permitList = allPermits as any[];
    const activePermits = permitList.filter(p => {
      const st = String(p.status || '').toUpperCase();
      return ['APPROVED', 'ISSUED', 'ACTIVE', 'IN_PROGRESS'].includes(st);
    });
    const pendingPermits = permitList.filter(p => {
      const st = String(p.status || '').toUpperCase();
      return ['PENDING', 'REQUESTED', 'DRAFT', 'UNDER_REVIEW'].includes(st);
    });
    const closedPermits = permitList.filter(p => {
      const st = String(p.status || '').toUpperCase();
      return ['CLOSED', 'COMPLETED', 'EXPIRED'].includes(st);
    });

    const permitsByType = {
      hot: permitList.filter(p => {
        const t = String(p.type || p.permitType || '').toUpperCase();
        return t === 'HOTWORK' || t === 'HOT' || t.includes('گرم');
      }).length,
      cold: permitList.filter(p => {
        const t = String(p.type || p.permitType || '').toUpperCase();
        return t === 'COLDWORK' || t === 'COLD' || t.includes('سرد');
      }).length,
      height: permitList.filter(p => {
        const t = String(p.type || p.permitType || '').toUpperCase();
        return t === 'HEIGHT' || t.includes('ارتفاع');
      }).length,
      confined: permitList.filter(p => {
        const t = String(p.type || p.permitType || '').toUpperCase();
        return t === 'CONFINEDSPACE' || t === 'CONFINED' || t.includes('بسته');
      }).length,
      electrical: permitList.filter(p => {
        const t = String(p.type || p.permitType || '').toUpperCase();
        return t === 'ELECTRICAL' || t === 'ELECTRIC' || t.includes('برق');
      }).length,
      excavation: permitList.filter(p => {
        const t = String(p.type || p.permitType || '').toUpperCase();
        return t === 'EXCAVATION' || t.includes('حفاری');
      }).length,
      other: 0,
    };
    permitsByType.other = Math.max(0, permitList.length - (permitsByType.hot + permitsByType.cold + permitsByType.height + permitsByType.confined + permitsByType.electrical + permitsByType.excavation));

    // 4. Process PTW Audits (Strictly Authoritative from PTW Audit sub-module)
    const ptwAuditRecords: any[] = Array.isArray(settingsMap.get('hse_ptw_audit_records_v2'))
      ? settingsMap.get('hse_ptw_audit_records_v2')
      : [];

    let auditedPermitsCount = ptwAuditRecords.length;
    let compliantAuditedPermits = 0;
    let ptwAuditComplianceRate = 0;

    if (auditedPermitsCount > 0) {
      const compliantAudits = ptwAuditRecords.filter(a => {
        const score = a.complianceScore !== undefined ? Number(a.complianceScore) : undefined;
        if (score !== undefined) return score >= 80;
        const defects = Number(a.defectsCount ?? a.totalMissedNcCount ?? 0);
        return defects === 0;
      });
      compliantAuditedPermits = compliantAudits.length;
      ptwAuditComplianceRate = Math.round((compliantAuditedPermits / auditedPermitsCount) * 100);
    } else if (permitList.length > 0) {
      // Fallback only if permits have embedded audit check results
      const audited = permitList.filter(p => p.hasAuditDeviations !== undefined || p.auditScore !== undefined);
      if (audited.length > 0) {
        auditedPermitsCount = audited.length;
        compliantAuditedPermits = audited.filter(p => !p.hasAuditDeviations && !p.hasViolations).length;
        ptwAuditComplianceRate = Math.round((compliantAuditedPermits / auditedPermitsCount) * 100);
      }
    }

    // 5. Process Occupational Health & Medical Exams (Merged from Table + System Settings Dossiers)
    const sqlExams = (allExams as any[]) || [];

    const extractArrayFromSetting = (val: any): any[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (Array.isArray(val.examinations)) return val.examinations;
      if (Array.isArray(val.exams)) return val.exams;
      if (Array.isArray(val.data)) return val.data;
      if (Array.isArray(val.value)) return val.value;
      return [];
    };

    const settingExams = [
      ...extractArrayFromSetting(settingsMap.get('hse_medical_exams_v4')),
      ...extractArrayFromSetting(settingsMap.get('hse_medical_exams_v3')),
      ...extractArrayFromSetting(settingsMap.get('hse_medical_exams')),
    ];

    const occExams = [
      ...extractArrayFromSetting(settingsMap.get('OCC_HEALTH_EXAMS_DATA_V2')),
      ...extractArrayFromSetting(settingsMap.get('occ_health_exams_data_v2')),
      ...extractArrayFromSetting(settingsMap.get('OCC_HEALTH_EXAMS_DATA')),
      ...extractArrayFromSetting(settingsMap.get('occ_health_exams_data')),
    ];

    const examMap = new Map<string, any>();
    [...sqlExams, ...settingExams, ...occExams].forEach((e, idx) => {
      if (!e) return;
      const id = String(e.id || e.exam_id || '').trim();
      const code = String(
        e.employeeCode ||
        e.personnelCode ||
        e.pcode ||
        e.nationalCode ||
        e.nid ||
        e.personnel_id ||
        ''
      ).trim();
      const year = String(e.examYear || e.exam_year || '').trim();

      const key = id || (code ? `${code}_${year}` : `exam_${idx}`);
      if (key && !examMap.has(key)) {
        examMap.set(key, e);
      }
    });
    const examList = Array.from(examMap.values());

    const fitExams: any[] = [];
    const conditionalExams: any[] = [];
    const unfitExams: any[] = [];

    examList.forEach(e => {
      const rawText = String(
        e.final_opinion ||
        e.opinion ||
        e.doctorVerdict ||
        e.doctor_verdict ||
        e.status ||
        e.fitnessStatus ||
        e.fitness_status ||
        e.finalFitnessStatus ||
        e.findings?.generalConclusion ||
        ''
      ).trim();

      const upper = rawText.toUpperCase();

      // 1. Unfit / Ineligible
      if (
        upper === 'UNFIT' ||
        upper === 'REJECTED' ||
        rawText.includes('عدم صلاحیت') ||
        rawText.includes('نامناسب') ||
        rawText.includes('عدم تناسب') ||
        rawText.includes('رد صلاحیت')
      ) {
        unfitExams.push(e);
        return;
      }

      // 2. Conditional / Specialist Referral / Limitations
      if (
        upper === 'CONDITIONAL' ||
        upper === 'CONDITIONAL_FIT' ||
        upper === 'FIT_WITH_LIMITATIONS' ||
        upper === 'NEEDS_SPECIALIST' ||
        rawText.includes('مشروط') ||
        rawText.includes('ارجاع') ||
        rawText.includes('محدودیت') ||
        (e.final_conditions && String(e.final_conditions).trim().length > 0) ||
        (e.restrictions && String(e.restrictions).trim().length > 0) ||
        (String(e.final_followup_needed).trim() === 'بله')
      ) {
        conditionalExams.push(e);
        return;
      }

      // 3. Fit (بلامانع یا متناسب)
      fitExams.push(e);
    });

    const totalExams = examList.length;
    const fitnessPercentage = totalExams > 0
      ? Math.round(((fitExams.length + conditionalExams.length) / totalExams) * 100)
      : 0;

    const audioList = allAudiometry as any[];
    const normalHearing = audioList.filter(a => a.hearingLossType === 'NORMAL' || a.interpretation === 'NORMAL' || !a.hearingLossLeft).length;
    const hearingLossCount = Math.max(0, audioList.length - normalHearing);

    const spiroList = allSpirometry as any[];
    const normalLung = spiroList.filter(s => s.spirometryPattern === 'NORMAL' || s.interpretation === 'NORMAL' || s.isAcceptable).length;
    const lungAbnormalCount = Math.max(0, spiroList.length - normalLung);

    // 6. Process Risk Assessments
    const riskList = allRisks as any[];
    const highRisks = riskList.filter(r => r.riskLevel === 'High' || r.riskLevel === 'HIGH' || r.initialRiskLevel === 'HIGH' || r.initialRiskLevel === 'EXTREME' || (r.riskScore || r.initialRiskScore || 0) >= 15);
    const mediumRisks = riskList.filter(r => r.riskLevel === 'Medium' || r.riskLevel === 'MEDIUM' || r.initialRiskLevel === 'MEDIUM' || ((r.riskScore || r.initialRiskScore || 0) >= 8 && (r.riskScore || r.initialRiskScore || 0) < 15));
    const lowRisks = riskList.filter(r => r.riskLevel === 'Low' || r.riskLevel === 'LOW' || r.initialRiskLevel === 'LOW' || ((r.riskScore || r.initialRiskScore || 0) < 8));

    // 7. Process Safety Warnings & Anomalies (گزارشات ناهنجاری و انحرافات باز)
    const warnList = allWarnings as any[];
    const activeWarnings = warnList.filter(w => {
      const st = String(w.status || '').toUpperCase();
      return !['CLOSED', 'RESOLVED', 'REVOKED'].includes(st);
    });
    const penalizedWarnings = warnList.filter(w => w.warningLevel === 'WRITTEN_2' || w.warningLevel === 'SUSPENSION' || Boolean(w.penalty));
    const envNonConformances = (allEnvLogs as any[]).filter(e => !e.isCompliant || e.category === 'NON_CONFORMANCE');
    const fiveSNcs: any[] = Array.isArray(settingsMap.get('hse_5s_nc_v3')) ? settingsMap.get('hse_5s_nc_v3') : [];
    
    // Combined Safety Inspections (Table + Settings)
    const sqlInspections = (allInspections as any[]) || [];
    const settingInspections: any[] = Array.isArray(settingsMap.get('hse_safety_dept_inspections_v1'))
      ? settingsMap.get('hse_safety_dept_inspections_v1')
      : Array.isArray(settingsMap.get('safety_inspections'))
      ? settingsMap.get('safety_inspections')
      : [];

    const inspectionMap = new Map<string, any>();
    [...sqlInspections, ...settingInspections].forEach(i => {
      if (i && i.id && !inspectionMap.has(i.id)) {
        inspectionMap.set(i.id, i);
      }
    });
    const inspectionList = Array.from(inspectionMap.values());

    const compliantInspections = inspectionList.filter(i => {
      const st = String(i.status || '').toUpperCase();
      return st === 'COMPLIANT' || st === 'PASSED' || st === 'GOOD' || st === 'ACCEPTABLE' || (Number(i.complianceScore || 0) >= 80);
    });
    const defectiveInspections = inspectionList.filter(i => !compliantInspections.includes(i));
    const checklistPassRate = inspectionList.length > 0 ? Math.round((compliantInspections.length / inspectionList.length) * 100) : 0;

    const inspectionsByType = {
      equipment: inspectionList.filter(i => {
        const t = String(i.inspectionType || '').toUpperCase();
        return t === 'EQUIPMENT' || t.includes('تجهیز');
      }).length,
      scaffolding: inspectionList.filter(i => {
        const t = String(i.inspectionType || '').toUpperCase();
        return t === 'SCAFFOLDING' || t.includes('داربست');
      }).length,
      crane: inspectionList.filter(i => {
        const t = String(i.inspectionType || '').toUpperCase();
        return t === 'CRANE' || t.includes('جرثقیل');
      }).length,
      electrical: inspectionList.filter(i => {
        const t = String(i.inspectionType || '').toUpperCase();
        return t === 'ELECTRICAL' || t.includes('برق');
      }).length,
      excavation: inspectionList.filter(i => {
        const t = String(i.inspectionType || '').toUpperCase();
        return t === 'EXCAVATION' || t.includes('حفاری');
      }).length,
      siteRoutine: inspectionList.filter(i => {
        const t = String(i.inspectionType || '').toUpperCase();
        return t === 'DAILY_ROUTINE' || t.includes('روزانه') || (!i.inspectionType);
      }).length,
    };

    // Anomalies Consolidation
    const totalAnomaliesCount = warnList.length + nearMissIncidents.length + unsafeActsIncidents.length + unsafeConditionsIncidents.length + envNonConformances.length + fiveSNcs.length + defectiveInspections.length;
    const openAnomaliesCount = activeWarnings.length + openIncidents.length + envNonConformances.filter(e => !e.isResolved).length + fiveSNcs.filter((n: any) => n.status !== 'Closed').length + defectiveInspections.length;
    const resolvedAnomaliesCount = Math.max(0, totalAnomaliesCount - openAnomaliesCount);

    const anomaliesByCategory = {
      unsafeActs: unsafeActsIncidents.length + warnList.filter(w => w.category === 'UNSAFE_ACT' || w.category === 'BEHAVIORAL' || !w.category).length,
      ppeViolations: warnList.filter(w => w.category === 'PPE_VIOLATION' || String(w.title || '').includes('حفاظت فردی')).length,
      equipmentAnomalies: defectiveInspections.length + unsafeConditionsIncidents.length,
      environmentalAnomalies: envNonConformances.length + fiveSNcs.length,
      nearMisses: nearMissIncidents.length,
    };

    // 8. Process Fire Department (Extinguishers + Fleet Vehicles + Daily Readiness Reports)
    const fireList = allFireEq as any[];
    const fireVehicles: any[] = Array.isArray(settingsMap.get('hse_fire_vehicles_v1'))
      ? settingsMap.get('hse_fire_vehicles_v1')
      : [];

    const operationalEquipment = fireList.filter(f => {
      const st = String(f.status || '').toUpperCase();
      return ['SERVICEABLE', 'OPERATIONAL', 'GOOD', 'ACTIVE'].includes(st) || !f.status;
    });
    const operationalVehicles = fireVehicles.filter(v => {
      const st = String(v.status || '');
      const rd = String(v.overallReadiness || '');
      return st.includes('آماده') || st === 'Operational' || rd.includes('عالی') || Number(v.complianceScore || 0) >= 80;
    });

    const defectiveEquipment = fireList.filter(f => !operationalEquipment.includes(f));
    const defectiveVehicles = fireVehicles.filter(v => !operationalVehicles.includes(v));

    const totalFireAssets = fireList.length + fireVehicles.length;
    const operationalFireCount = operationalEquipment.length + operationalVehicles.length;
    const needsInspectionCount = defectiveEquipment.length + defectiveVehicles.length;
    const fireReadiness = totalFireAssets > 0 ? Math.round((operationalFireCount / totalFireAssets) * 100) : 0;

    const fireByType = {
      co2: fireList.filter(f => String(f.equipmentType || '').includes('CO2')).length,
      powder: fireList.filter(f => String(f.equipmentType || '').includes('POWDER')).length,
      foam: fireList.filter(f => String(f.equipmentType || '').includes('FOAM')).length,
      hoses: fireList.filter(f => String(f.equipmentType || '').includes('HOSE')).length,
      hydrants: fireList.filter(f => String(f.equipmentType || '').includes('HYDRANT')).length,
      detectors: fireList.filter(f => String(f.equipmentType || '').includes('DETECTOR')).length,
      vehicles: fireVehicles.length,
    };

    // 9. Process 5S Audits & Inspections (Table + Setting)
    const sqlFiveS = (allFiveS as any[]) || [];
    const settingFiveS: any[] = Array.isArray(settingsMap.get('hse_5s_inspections_v3'))
      ? settingsMap.get('hse_5s_inspections_v3')
      : [];

    const fiveSMap = new Map<string, any>();
    [...sqlFiveS, ...settingFiveS].forEach(a => {
      if (a && a.id && !fiveSMap.has(a.id)) {
        fiveSMap.set(a.id, a);
      }
    });
    const fiveSList = Array.from(fiveSMap.values());
    const totalFiveSCount = fiveSList.length;
    const avgFiveSScore = totalFiveSCount > 0
      ? Math.round(fiveSList.reduce((sum, a) => sum + Number(a.overallScorePercentage ?? a.totalScore ?? 0), 0) / totalFiveSCount)
      : 0;

    // 10. Process Training Management (Table + Setting Courses)
    const sqlTrainings = (allTrainings as any[]) || [];
    const settingCourses: any[] = Array.isArray(settingsMap.get('hse_training_courses_v2'))
      ? settingsMap.get('hse_training_courses_v2')
      : [];
    const settingDefs: any[] = Array.isArray(settingsMap.get('hse_training_course_defs'))
      ? settingsMap.get('hse_training_course_defs')
      : [];

    const trainingList = [...sqlTrainings];
    const attendanceList = [...(allAttendances as any[])];

    const totalCoursesCount = Math.max(
      trainingList.length,
      settingDefs.length,
      new Set(settingCourses.map((c: any) => c.courseCode || c.code)).size
    );
    const totalAttendancesCount = Math.max(attendanceList.length, settingCourses.length);
    const trainedPersonnelCount = new Set([
      ...attendanceList.map(a => a.personnelId),
      ...settingCourses.map((c: any) => c.personnelCode || c.id)
    ]).size;

    const totalTrainingHours = trainingList.reduce((sum, t) => sum + Number(t.durationHours || 0), 0) +
      settingCourses.reduce((sum: number, c: any) => sum + Number(c.hours || 0), 0);

    const passedAttendances = attendanceList.filter(a => a.passed !== false).length +
      settingCourses.filter((c: any) => c.passed !== false).length;
    const trainingPassRate = totalAttendancesCount > 0 ? Math.round((passedAttendances / totalAttendancesCount) * 100) : 0;

    const trainingsByCategory = {
      generalSafety: trainingList.filter(t => t.courseCategory === 'GENERAL_SAFETY' || !t.courseCategory).length +
        settingCourses.filter((c: any) => String(c.courseCode || '').includes('GEN') || !c.category).length,
      fireFighting: trainingList.filter(t => t.courseCategory === 'FIRE_FIGHTING' || t.courseTitle?.includes('اطفاء')).length +
        settingCourses.filter((c: any) => String(c.courseCode || '').includes('FIRE') || String(c.title || '').includes('اطفاء')).length,
      firstAid: trainingList.filter(t => t.courseCategory === 'FIRST_AID' || t.courseTitle?.includes('امداد')).length +
        settingCourses.filter((c: any) => String(c.courseCode || '').includes('AID') || String(c.title || '').includes('امداد')).length,
      ptwTraining: trainingList.filter(t => t.courseCategory === 'PTW' || t.courseTitle?.includes('پروانه')).length +
        settingCourses.filter((c: any) => String(c.courseCode || '').includes('PTW') || String(c.title || '').includes('پروانه')).length,
      ergonomics: trainingList.filter(t => t.courseCategory === 'ERGONOMICS' || t.courseTitle?.includes('ارگونومی')).length +
        settingCourses.filter((c: any) => String(c.courseCode || '').includes('ERGO') || String(c.title || '').includes('ارگونومی')).length,
    };

    // 11. Target TRIR & Meteorological Coordinates
    const trirTarget = settingsMap.get('trir_target') ? Number(settingsMap.get('trir_target')) : 1.5;

    let heatLat = 30.471003;
    let heatLon = 49.090324;
    let heatLocName = 'منطقه ویژه صنعتی بندر امام خمینی (پتروشیمی)';
    const heatConfig = settingsMap.get('hse_heat_monitor_config');
    if (heatConfig) {
      if (heatConfig.lat && heatConfig.lon) {
        heatLat = Number(heatConfig.lat);
        heatLon = Number(heatConfig.lon);
      }
      if (heatConfig.locationName) heatLocName = heatConfig.locationName;
    }

    // 12. Climate/Weather Data (100% Real Telemetry from Meteorological Station)
    let liveClimate: any = null;
    try {
      const weather = await weatherService.getWeather(
        { lat: heatLat, lon: heatLon, query: heatLocName },
        undefined,
        bypassCache
      );
      if (weather && weather.tempC !== undefined) {
        liveClimate = {
          tempC: weather.tempC,
          hum: weather.hum,
          hi: weather.hi ?? weather.tempC,
          hiDisplay: weather.hiDisplay ?? (weather.hi !== undefined ? weather.hi.toFixed(1) : weather.tempC.toFixed(1)),
          offChart: weather.offChart ?? false,
          wbgt: weather.wbgt,
          wbgtShade: weather.wbgtShade,
          globeTemp: weather.globeTemp,
          dewPoint: weather.dewPoint,
          wetBulb: weather.wetBulb,
          cat: weather.cat ?? 'Normal',
          subLevel: weather.subLevel ?? null,
          loc: weather.locationName || heatLocName,
          source: weather.provider || 'Real Meteorological Station',
          aqi: weather.aqi,
          observedAt: weather.observedAt,
          fetchedAt: weather.fetchedAt,
          isStale: isWeatherRecordStale(weather.observedAt),
        };
      }
    } catch (err: any) {
      console.warn('[Dashboard Climate] Live meteorological station unreachable:', err.message || err);
      liveClimate = null;
    }

    // 13. Assembled Canonical Live Summary
    const summary = {
      incidents: {
        total: incList.length,
        rolling12m: current12Incidents,
        prev12m: prev12Incidents,
        percentChange: incidentPercentChange,
        trendDirection: incidentTrend,
        openCases: openIncidents.length,
        ltiCount: ltiIncidents.length,
        nearMissCount: nearMissIncidents.length,
        lostWorkdays: totalLostDays,
      },
      trir: {
        currentRolling: latestRollingTrir,
        target: trirTarget,
        totalSafeManHours: totalSafeHours12M,
        attendanceHours: last12Points.reduce((sum, p) => sum + p.attendanceHours, 0),
        contractorHours: last12Points.reduce((sum, p) => sum + p.contractorHours, 0),
        series: trirChronological,
      },
      permits: {
        total: permitList.length,
        active: activePermits.length,
        pending: pendingPermits.length,
        closed: closedPermits.length,
        byType: permitsByType,
        auditComplianceRate: ptwAuditComplianceRate,
        auditedCount: auditedPermitsCount,
        compliantAuditedCount: compliantAuditedPermits,
      },
      health: {
        totalExams: examList.length,
        fit: fitExams.length,
        conditional: conditionalExams.length,
        unfit: unfitExams.length,
        fitnessPercentage,
        hearingLossCount,
        lungAbnormalCount,
        audiometryTotal: audioList.length,
        spirometryTotal: spiroList.length,
      },
      risks: {
        total: riskList.length,
        high: highRisks.length,
        medium: mediumRisks.length,
        low: lowRisks.length,
      },
      warnings: {
        total: warnList.length,
        active: activeWarnings.length,
        penalized: penalizedWarnings.length,
        list: warnList.slice(0, 20),
      },
      anomalies: {
        total: totalAnomaliesCount,
        open: openAnomaliesCount,
        resolved: resolvedAnomaliesCount,
        byCategory: anomaliesByCategory,
      },
      fireSafety: {
        total: totalFireAssets,
        operational: operationalFireCount,
        needsInspection: needsInspectionCount,
        readinessRate: fireReadiness,
        byType: fireByType,
      },
      fiveS: {
        total: totalFiveSCount,
        averageScore: avgFiveSScore,
      },
      training: {
        totalCourses: totalCoursesCount,
        totalAttendances: totalAttendancesCount,
        trainedPersonnel: trainedPersonnelCount,
        totalHours: totalTrainingHours,
        passRate: trainingPassRate,
        byCategory: trainingsByCategory,
      },
      safetyInspections: {
        total: inspectionList.length,
        compliant: compliantInspections.length,
        defective: defectiveInspections.length,
        passRate: checklistPassRate,
        byType: inspectionsByType,
      },
      personnel: {
        total: Math.max((allPersonnel as any[]).length, (settingsMap.get('org_nodes') || []).length, 1),
        departmentsCount: Math.max((allDepts as any[]).length, Object.keys(settingsMap.get('hse_unit_structure_v1') || {}).length, 1),
      },
      climate: liveClimate,
      notifications: allNotifs as any[],
    };

    // Cache summary in memory
    cachedMetricsData = summary;
    lastMetricsCacheTime = now;

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
    });
  } catch (error: any) {
    logger.error('Failed to aggregate dashboard metrics', { error: error.message });
    res.status(500).json({ success: false, error: 'Database aggregation error' });
  }
});

// Layout & Dashboard Settings (Persistent in پایگاه داده - Supports Per-User and System Defaults)
dashboardRouter.get('/layout', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (userId) {
      const userLayoutKey = `dashboard_layout_user_${userId}`;
      const userRecord = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, userLayoutKey)).catch(() => []);
      if (userRecord.length > 0 && (userRecord[0] as any).value) {
        return res.json({ success: true, data: (userRecord[0] as any).value, isUserCustom: true });
      }
    }

    const layoutKey = 'dashboard_executive_layout';
    const record = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, layoutKey)).catch(() => []);
    if (record.length > 0 && (record[0] as any).value) {
      return res.json({ success: true, data: (record[0] as any).value, isUserCustom: false });
    }

    // Auto-seed permanent default layout into پایگاه داده
    await db
      .insert(schema.systemSettings)
      .values({
        key: layoutKey,
        value: CANONICAL_DEFAULT_DASHBOARD_LAYOUT,
        description: 'Permanent Production Default Dashboard Layout',
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .catch(() => {});

    return res.json({ success: true, data: CANONICAL_DEFAULT_DASHBOARD_LAYOUT, isUserCustom: false });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

dashboardRouter.post('/layout', requireAuth, async (req: Request, res: Response) => {
  try {
    const layoutData = req.body;
    const userId = req.body.userId || req.user?.uid || req.user?.username;
    const userRole = (req.user?.role || '').toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'ADMINISTRATOR';
    const saveAsGlobal = req.body.saveAsGlobal === true && isAdmin;

    const layoutKey = saveAsGlobal ? 'dashboard_executive_layout' : (userId ? `dashboard_layout_user_${userId}` : 'dashboard_executive_layout');

    await db
      .insert(schema.systemSettings)
      .values({
        key: layoutKey,
        value: layoutData,
        description: saveAsGlobal 
          ? 'Executive Management Dashboard Layout & Widget Coordinates' 
          : `Personal Dashboard Layout for User ${userId}`,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.systemSettings.key,
        set: {
          value: layoutData,
          description: saveAsGlobal 
            ? 'Executive Management Dashboard Layout & Widget Coordinates' 
            : `Personal Dashboard Layout for User ${userId}`,
          updatedAt: new Date(),
        },
      });

    invalidateDashboardCache();
    broadcastDataMutation('dashboard_layout', 'update', { layoutKey, layoutData });
    res.json({ 
      success: true, 
      message: saveAsGlobal 
        ? 'چیدمان پیش‌فرض سازمانی در پایگاه داده ذخیره گردید.' 
        : 'چیدمان اختصاصی کاربر در پایگاه داده ذخیره گردید.',
      isUserCustom: !saveAsGlobal
    });
  } catch (err: any) {
    logger.error('Failed to save dashboard layout', { error: err.message });
    res.status(500).json({ success: false, error: 'خطا در ذخیره چیدمان داشبورد در سرور' });
  }
});

dashboardRouter.post('/layout/reset', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || req.user?.uid || req.user?.username;
    if (userId) {
      const userLayoutKey = `dashboard_layout_user_${userId}`;
      await db.delete(schema.systemSettings).where(eq(schema.systemSettings.key, userLayoutKey)).catch(() => {});
    }
    invalidateDashboardCache();
    broadcastDataMutation('dashboard_layout', 'reset', { userId });
    res.json({ success: true, message: 'چیدمان با موفقیت به حالت پیش‌فرض سازمانی بازنشانی شد.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

