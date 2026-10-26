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

    // 2. Process Incidents
    const incList = allIncidents as any[];
    const ltiIncidents = incList.filter(i => i.type === 'LTI' || i.incidentType === 'LTI' || i.isLti || i.severity === 'FATAL' || i.severity === 'MAJOR');
    const nearMissIncidents = incList.filter(i => i.type === 'NearMiss' || i.incidentType === 'NEAR_MISS' || i.category?.includes('شبه'));
    const openIncidents = incList.filter(i => i.status === 'Open' || i.status === 'UnderInvestigation' || i.status === 'PENDING');
    const totalLostDays = incList.reduce<number>((sum, i) => sum + (Number(i.lostDays || i.lostWorkDays || 0)), 0);

    // 3. Process Work Permits (PTW) & PTW Audits
    const permitList = allPermits as any[];
    const activePermits = permitList.filter(p => p.status === 'Approved' || p.status === 'Issued' || p.status === 'Active' || p.status === 'In_Progress');
    const pendingPermits = permitList.filter(p => p.status === 'Pending' || p.status === 'Requested' || p.status === 'Draft');
    const closedPermits = permitList.filter(p => p.status === 'Closed' || p.status === 'Completed' || p.status === 'Expired');

    const permitsByType = {
      hot: permitList.filter(p => p.type === 'HotWork' || p.type === 'HOT' || p.permitType?.includes('گرم')).length,
      cold: permitList.filter(p => p.type === 'ColdWork' || p.type === 'COLD' || p.permitType?.includes('سرد')).length,
      height: permitList.filter(p => p.type === 'Height' || p.type === 'HEIGHT' || p.permitType?.includes('ارتفاع')).length,
      confined: permitList.filter(p => p.type === 'ConfinedSpace' || p.type === 'CONFINED' || p.permitType?.includes('بسته')).length,
      electrical: permitList.filter(p => p.type === 'Electrical' || p.type === 'ELECTRIC' || p.permitType?.includes('برق')).length,
      excavation: permitList.filter(p => p.type === 'Excavation' || p.permitType?.includes('حفاری')).length,
      other: 0,
    };
    permitsByType.other = Math.max(0, permitList.length - (permitsByType.hot + permitsByType.cold + permitsByType.height + permitsByType.confined + permitsByType.electrical + permitsByType.excavation));

    // PTW Audits & Quality Compliance (Strictly from real DB work permits)
    const auditedPermitsCount = permitList.length;
    const nonCompliantPermits = permitList.filter(p => p.hasViolations || p.hasAuditDeviations || p.status === 'Rejected' || p.status === 'Suspended').length;
    const compliantAuditedPermits = Math.max(0, auditedPermitsCount - nonCompliantPermits);
    const ptwAuditComplianceRate = auditedPermitsCount > 0 ? Math.round((compliantAuditedPermits / auditedPermitsCount) * 100) : 0;

    // 4. Process Medical Exams & Health Unit Data
    const examList = allExams as any[];
    const fitExams = examList.filter(e => e.fitnessStatus === 'Fit' || e.fitnessStatus === 'FIT' || e.finalFitnessStatus === 'FIT');
    const conditionalExams = examList.filter(e => e.fitnessStatus === 'Conditional' || e.fitnessStatus === 'CONDITIONAL' || e.finalFitnessStatus === 'CONDITIONAL');
    const unfitExams = examList.filter(e => e.fitnessStatus === 'Unfit' || e.fitnessStatus === 'UNFIT' || e.finalFitnessStatus === 'UNFIT');
    const fitnessPercentage = examList.length > 0 ? Math.round(((fitExams.length + conditionalExams.length) / examList.length) * 100) : 0;

    const audioList = allAudiometry as any[];
    const normalHearing = audioList.filter(a => a.hearingLossType === 'NORMAL' || a.interpretation === 'NORMAL' || !a.hearingLossLeft).length;
    const hearingLossCount = Math.max(0, audioList.length - normalHearing);

    const spiroList = allSpirometry as any[];
    const normalLung = spiroList.filter(s => s.spirometryPattern === 'NORMAL' || s.interpretation === 'NORMAL' || s.isAcceptable).length;
    const lungAbnormalCount = Math.max(0, spiroList.length - normalLung);

    // 5. Process Risk Assessments
    const riskList = allRisks as any[];
    const highRisks = riskList.filter(r => r.riskLevel === 'High' || r.riskLevel === 'HIGH' || r.initialRiskLevel === 'HIGH' || r.initialRiskLevel === 'EXTREME' || (r.riskScore || r.initialRiskScore || 0) >= 15);
    const mediumRisks = riskList.filter(r => r.riskLevel === 'Medium' || r.riskLevel === 'MEDIUM' || r.initialRiskLevel === 'MEDIUM' || ((r.riskScore || r.initialRiskScore || 0) >= 8 && (r.riskScore || r.initialRiskScore || 0) < 15));
    const lowRisks = riskList.filter(r => r.riskLevel === 'Low' || r.riskLevel === 'LOW' || r.initialRiskLevel === 'LOW' || ((r.riskScore || r.initialRiskScore || 0) < 8));

    // 6. Process Safety Warnings & Anomalies (گزارشات ناهنجاری)
    const warnList = allWarnings as any[];
    const activeWarnings = warnList.filter(w => w.status === 'ACTIVE' || w.status === 'Active' || w.status === 'Open');
    const penalizedWarnings = warnList.filter(w => w.warningLevel === 'WRITTEN_2' || w.warningLevel === 'SUSPENSION');
    const envNonConformances = (allEnvLogs as any[]).filter(e => !e.isCompliant || e.category === 'NON_CONFORMANCE');
    
    const totalAnomaliesCount = warnList.length + nearMissIncidents.length + envNonConformances.length;
    const openAnomaliesCount = activeWarnings.length + openIncidents.length + envNonConformances.filter(e => !e.isResolved).length;
    const resolvedAnomaliesCount = Math.max(0, totalAnomaliesCount - openAnomaliesCount);

    const anomaliesByCategory = {
      unsafeActs: warnList.filter(w => w.category === 'UNSAFE_ACT' || w.category === 'BEHAVIORAL' || !w.category).length,
      ppeViolations: warnList.filter(w => w.category === 'PPE_VIOLATION').length,
      equipmentAnomalies: (allInspections as any[]).filter(i => i.status === 'DEFECTIVE' || i.status === 'NEEDS_ACTION').length,
      environmentalAnomalies: envNonConformances.length,
      nearMisses: nearMissIncidents.length,
    };

    // 7. Process Fire Department (واحد آتش‌نشانی)
    const fireList = allFireEq as any[];
    const operationalFire = fireList.filter(f => f.status === 'SERVICEABLE' || f.status === 'Operational' || f.status === 'GOOD' || f.status === 'ACTIVE' || !f.status);
    const expiredFire = fireList.filter(f => f.status === 'NEEDS_RECHARGE' || f.status === 'Expired' || f.status === 'DEFECTIVE' || f.status === 'OUT_OF_SERVICE');
    const fireReadiness = fireList.length > 0 ? Math.round((operationalFire.length / fireList.length) * 100) : 0;

    const fireByType = {
      co2: fireList.filter(f => f.equipmentType === 'EXTINGUISHER_CO2' || f.equipmentType?.includes('CO2')).length,
      powder: fireList.filter(f => f.equipmentType === 'EXTINGUISHER_POWDER' || f.equipmentType?.includes('POWDER')).length,
      foam: fireList.filter(f => f.equipmentType === 'EXTINGUISHER_FOAM' || f.equipmentType?.includes('FOAM')).length,
      hoses: fireList.filter(f => f.equipmentType === 'FIRE_HOSE' || f.equipmentType?.includes('HOSE')).length,
      hydrants: fireList.filter(f => f.equipmentType === 'HYDRANT' || f.equipmentType?.includes('HYDRANT')).length,
      detectors: fireList.filter(f => f.equipmentType === 'SMOKE_DETECTOR' || f.equipmentType?.includes('DETECTOR')).length,
    };

    // 8. Process 5S Audits
    const fiveSList = allFiveS as any[];
    const avgFiveSScore = fiveSList.length > 0
      ? Math.round(fiveSList.reduce<number>((sum, a) => sum + (Number(a.totalScore || 0)), 0) / fiveSList.length)
      : 0;

    // 9. Process Training Management (مدیریت آموزش)
    const trainingList = allTrainings as any[];
    const attendanceList = allAttendances as any[];
    const passedAttendances = attendanceList.filter(a => a.passed !== false);
    const trainingPassRate = attendanceList.length > 0 ? Math.round((passedAttendances.length / attendanceList.length) * 100) : 0;
    const totalTrainingHours = trainingList.reduce<number>((sum, t) => sum + Number(t.durationHours || 0), 0);
    const totalTrainedPersonnel = new Set(attendanceList.map(a => a.personnelId)).size;

    const trainingsByCategory = {
      generalSafety: trainingList.filter(t => t.courseCategory === 'GENERAL_SAFETY' || !t.courseCategory).length,
      fireFighting: trainingList.filter(t => t.courseCategory === 'FIRE_FIGHTING' || t.courseTitle?.includes('اطفاء')).length,
      firstAid: trainingList.filter(t => t.courseCategory === 'FIRST_AID' || t.courseTitle?.includes('امداد')).length,
      ptwTraining: trainingList.filter(t => t.courseCategory === 'PTW' || t.courseTitle?.includes('پروانه')).length,
      ergonomics: trainingList.filter(t => t.courseCategory === 'ERGONOMICS' || t.courseTitle?.includes('ارگونومی')).length,
    };

    // 10. Process Safety Unit Checklists & Inspections (واحد ایمنی - چک‌لیست‌ها)
    const inspectionList = allInspections as any[];
    const compliantInspections = inspectionList.filter(i => i.status === 'COMPLIANT' || i.status === 'PASSED' || i.status === 'GOOD' || i.status === 'ACCEPTABLE');
    const defectiveInspections = inspectionList.filter(i => i.status === 'DEFECTIVE' || i.status === 'FAILED' || i.status === 'NEEDS_ACTION');
    const checklistPassRate = inspectionList.length > 0 ? Math.round((compliantInspections.length / inspectionList.length) * 100) : 0;

    const inspectionsByType = {
      equipment: inspectionList.filter(i => i.inspectionType === 'EQUIPMENT' || !i.inspectionType).length,
      scaffolding: inspectionList.filter(i => i.inspectionType === 'SCAFFOLDING' || i.inspectionType?.includes('داربست')).length,
      crane: inspectionList.filter(i => i.inspectionType === 'CRANE' || i.inspectionType?.includes('جرثقیل')).length,
      electrical: inspectionList.filter(i => i.inspectionType === 'ELECTRICAL' || i.inspectionType?.includes('برق')).length,
      excavation: inspectionList.filter(i => i.inspectionType === 'EXCAVATION' || i.inspectionType?.includes('حفاری')).length,
      siteRoutine: inspectionList.filter(i => i.inspectionType === 'DAILY_ROUTINE' || i.inspectionType?.includes('روزانه')).length,
    };

    // 11. Target TRIR & Heat Monitor Settings
    const trirSettingRow = (targetSetting as any[]).find(s => s.key === 'trir_target');
    const trirTarget = trirSettingRow?.value ? Number(trirSettingRow.value) : 1.5;

    const heatConfigRow = (targetSetting as any[]).find(s => s.key === 'hse_heat_monitor_config');
    let heatLat = 30.471003;
    let heatLon = 49.090324;
    let heatLocName = 'منطقه ویژه صنعتی بندر امام خمینی (پتروشیمی)';
    if (heatConfigRow?.value) {
      try {
        const parsed = JSON.parse(heatConfigRow.value);
        if (parsed.lat && parsed.lon) {
          heatLat = Number(parsed.lat);
          heatLon = Number(parsed.lon);
        }
        if (parsed.locationName) heatLocName = parsed.locationName;
      } catch {}
    }

    // 12. Climate/Weather Data (100% Real Telemetry - Zero Synthetic Fake Values)
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
      liveClimate = null; // Strictly null, never return fake 38.5°C numbers
    }

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
        total: fireList.length,
        operational: operationalFire.length,
        needsInspection: expiredFire.length,
        readinessRate: fireReadiness,
        byType: fireByType,
      },
      fiveS: {
        total: fiveSList.length,
        averageScore: avgFiveSScore,
      },
      training: {
        totalCourses: trainingList.length,
        totalAttendances: attendanceList.length,
        trainedPersonnel: totalTrainedPersonnel,
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
        total: (allPersonnel as any[]).length,
        departmentsCount: (allDepts as any[]).length,
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

