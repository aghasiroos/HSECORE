/**
 * HSECORE Safe Read-Only Domain Tools for Local AI
 * Provides structured, audited real-data summaries to ground AI reasoning.
 * Strictly read-only; no raw SQL execution or data mutation.
 */

import { db, schema } from '../../core/db.ts';
import { desc, eq, and, sql } from 'drizzle-orm';
import { ptwRepository } from '../ptw/ptw.repository.ts';
import { incidentRepository } from '../incidents/incident.repository.ts';
import { AIToolResult } from './ai.types.ts';
import { logger } from '../../core/logger.ts';

export class AIToolsRegistry {
  /**
   * Tool: PTW & Work Permits Real-Time Status
   */
  async getPTWSummary(): Promise<AIToolResult> {
    try {
      const permits = await ptwRepository.findAll();
      const total = permits.length;
      const active = permits.filter((p: any) => p.status === 'IN_PROGRESS' || p.status === 'APPROVED' || p.status === 'ACTIVE').length;
      const hotWork = permits.filter((p: any) => p.permitType === 'HOT_WORK').length;
      const coldWork = permits.filter((p: any) => p.permitType === 'COLD_WORK').length;
      const confinedSpace = permits.filter((p: any) => p.permitType === 'CONFINED_SPACE').length;
      const closed = permits.filter((p: any) => p.status === 'CLOSED' || p.isClosed).length;

      const recentActive = permits
        .filter((p: any) => !p.isClosed && p.status !== 'CLOSED')
        .slice(0, 5)
        .map((p: any) => ({
          permitNumber: p.permitNumber,
          title: p.title,
          type: p.permitType,
          location: p.location,
          applicant: p.applicantName,
        }));

      return {
        toolName: 'ptw_summary',
        titleFa: 'خلاصه پروانه‌های کار (PTW)',
        summary: `مجموع ${total} پروانه کار ثبت شده است که ${active} فقره از آنها هم‌اکنون فعال/در حال اجرا هستند (${hotWork} کار گرم، ${coldWork} کار سرد، ${confinedSpace} فضای بسته).`,
        data: {
          totalPermits: total,
          activePermits: active,
          closedPermits: closed,
          byType: { hotWork, coldWork, confinedSpace },
          recentActive,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      logger.error('[AITools] getPTWSummary error', { error: err.message });
      return {
        toolName: 'ptw_summary',
        titleFa: 'خلاصه پروانه‌های کار (PTW)',
        summary: 'اطلاعات پروانه‌های کار در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool: Incidents, Near Misses & CAPA Real-Time Summary
   */
  async getIncidentSummary(): Promise<AIToolResult> {
    try {
      const incidents = await incidentRepository.findAll();
      const total = incidents.length;
      const nearMisses = incidents.filter((i: any) => i.incidentType === 'NEAR_MISS').length;
      const accidents = incidents.filter((i: any) => i.incidentType !== 'NEAR_MISS').length;
      const investigating = incidents.filter((i: any) => i.status === 'INVESTIGATING' || i.status === 'REPORTED').length;
      const closed = incidents.filter((i: any) => i.status === 'CLOSED').length;

      let totalLostDays = 0;
      for (const inc of incidents) {
        totalLostDays += Number(inc.lostWorkDays || 0);
      }

      const recentIncidents = incidents.slice(0, 5).map((i: any) => ({
        incidentNumber: i.incidentNumber,
        title: i.title,
        severity: i.severity,
        type: i.incidentType,
        date: i.incidentDate,
        status: i.status,
      }));

      return {
        toolName: 'incidents_summary',
        titleFa: 'آمار حوادث، شبه‌حوادث و اقدامات اصلاحی',
        summary: `مجموع ${total} رویداد ایمنی ثبت شده است شامل ${nearMisses} شبه‌حادثه (Near Miss) و ${accidents} حادثه. ${investigating} پرونده در دست بررسی و روزهای کاری از دست رفته ${totalLostDays} روز است.`,
        data: {
          totalIncidents: total,
          nearMisses,
          accidents,
          investigating,
          closed,
          totalLostDays,
          recentIncidents,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      logger.error('[AITools] getIncidentSummary error', { error: err.message });
      return {
        toolName: 'incidents_summary',
        titleFa: 'آمار حوادث و رویدادها',
        summary: 'اطلاعات حوادث در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool: Occupational Health & Periodic Medical Exams Summary
   */
  async getHealthAndExamsSummary(): Promise<AIToolResult> {
    try {
      const exams = await db.select().from(schema.periodicMedicalExams).catch(() => []);
      const totalExams = exams.length;

      let fit = 0;
      let conditional = 0;
      let unfit = 0;

      for (const e of exams) {
        const status = String((e as any).fitnessStatus || (e as any).fitnessOutcome || '').toUpperCase();
        const finalOp = String((e as any).finalOpinion || (e as any).opinion || '');

        if (status.includes('FIT') && !status.includes('UNFIT') && !status.includes('CONDITIONAL') || finalOp.includes('بلامانع') || finalOp.includes('مناسب')) {
          fit++;
        } else if (status.includes('CONDITIONAL') || finalOp.includes('مشروط')) {
          conditional++;
        } else if (status.includes('UNFIT') || finalOp.includes('عدم صلاحیت') || finalOp.includes('نامناسب')) {
          unfit++;
        }
      }

      return {
        toolName: 'health_medical_summary',
        titleFa: 'پایش سلامت شغلی و معاینات ادواری',
        summary: `مجموع ${totalExams} پرونده معاینات طب کار ثبت شده است. نتایج نهایی: ${fit} نفر تناسب کامل (Fit)، ${conditional} نفر مشروط، و ${unfit} نفر عدم تناسب شغلی.`,
        data: {
          totalExams,
          fit,
          conditional,
          unfit,
          fitnessPercentage: totalExams > 0 ? Math.round((fit / totalExams) * 100) : 0,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      logger.error('[AITools] getHealthAndExamsSummary error', { error: err.message });
      return {
        toolName: 'health_medical_summary',
        titleFa: 'پایش سلامت شغلی',
        summary: 'اطلاعات معاینات طب کار در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool: Nutrition, BMI & High-Risk Chronic Conditions Summary
   */
  async getNutritionHighRiskSummary(): Promise<AIToolResult> {
    try {
      const exams = await db.select().from(schema.periodicMedicalExams).catch(() => []);
      let overweight = 0;
      let obeseGrade1 = 0;
      let obeseGrade2 = 0;
      let obeseGrade3 = 0;
      let highBloodPressure = 0;
      let highBloodSugar = 0;

      for (const exam of exams) {
        const extra = (exam as any).extraData || {};
        const general = (exam as any).generalHealth || {};
        const labs = (exam as any).laboratory || {};

        const bmi = Number(extra.bmi || general.bmi || (exam as any).bmi || 0);
        if (bmi >= 25 && bmi < 30) overweight++;
        else if (bmi >= 30 && bmi < 35) obeseGrade1++;
        else if (bmi >= 35 && bmi < 40) obeseGrade2++;
        else if (bmi >= 40) obeseGrade3++;

        const bpSystolic = Number(extra.bloodPressureSystolic || general.bloodPressureSystolic || 0);
        const bpDiastolic = Number(extra.bloodPressureDiastolic || general.bloodPressureDiastolic || 0);
        if (bpSystolic >= 140 || bpDiastolic >= 90) highBloodPressure++;

        const fbs = Number(extra.fbs || labs.fbs || 0);
        if (fbs >= 126) highBloodSugar++;
      }

      const totalHighRisk = overweight + obeseGrade1 + obeseGrade2 + obeseGrade3 + highBloodPressure + highBloodSugar;

      return {
        toolName: 'nutrition_high_risk_summary',
        titleFa: 'بیماران پرخطر تغذیه، چاقی و بیماری‌های مزمن',
        summary: `بر اساس آخرین معاینات ادواری: ${overweight} نفر اضافه‌وزن، ${obeseGrade1 + obeseGrade2 + obeseGrade3} نفر چاقی (درجات ۱ تا ۳)، ${highBloodPressure} نفر فشار خون بالا و ${highBloodSugar} نفر قند خون ناشتای غیرطبیعی (دیابت/پیش‌دیابت) دارند.`,
        data: {
          overweight,
          obesity: { grade1: obeseGrade1, grade2: obeseGrade2, grade3: obeseGrade3 },
          highBloodPressure,
          highBloodSugar,
          totalIndicators: totalHighRisk,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      logger.error('[AITools] getNutritionHighRiskSummary error', { error: err.message });
      return {
        toolName: 'nutrition_high_risk_summary',
        titleFa: 'بیماران پرخطر تغذیه',
        summary: 'اطلاعات تغذیه در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool: Risk Assessment & Hazard Identification
   */
  async getRiskAssessmentsSummary(): Promise<AIToolResult> {
    try {
      const risks = await db.select().from(schema.riskAssessments).catch(() => []);
      const total = risks.length;
      const highRisks = risks.filter((r: any) => String(r.riskLevel).toUpperCase() === 'HIGH' || String(r.riskLevel).toUpperCase() === 'EXTREME').length;
      const mediumRisks = risks.filter((r: any) => String(r.riskLevel).toUpperCase() === 'MEDIUM').length;
      const lowRisks = risks.filter((r: any) => String(r.riskLevel).toUpperCase() === 'LOW').length;

      return {
        toolName: 'risk_assessment_summary',
        titleFa: 'ارزیابی ریسک‌ها و مخاطرات شغلی',
        summary: `مجموع ${total} رکورد ارزیابی ریسک ثبت شده است که ${highRisks} مورد در وضعیت ریسک بالا/بحرانی، ${mediumRisks} متوسط و ${lowRisks} مورد در وضعیت کنترل‌شده قرار دارند.`,
        data: {
          totalRisks: total,
          highRisks,
          mediumRisks,
          lowRisks,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        toolName: 'risk_assessment_summary',
        titleFa: 'ارزیابی ریسک‌ها',
        summary: 'اطلاعات ارزیابی ریسک در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool: 5S System & Safety Inspections
   */
  async get5SAndInspectionsSummary(): Promise<AIToolResult> {
    try {
      const fiveSRows = await db.select().from(schema.fiveSAudits).catch(() => []);
      const inspections = await db.select().from(schema.safetyInspections).catch(() => []);

      return {
        toolName: 'five_s_inspections_summary',
        titleFa: 'نظام آراستگی ۵S و بازرسی‌های ایمنی',
        summary: `مجموع ${fiveSRows.length} ممیزی ۵S و ${inspections.length} بازرسی ایمنی و بهداشت در سازمان ثبت و پایش شده است.`,
        data: {
          totalFiveSAudits: fiveSRows.length,
          totalInspections: inspections.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        toolName: 'five_s_inspections_summary',
        titleFa: 'نظام آراستگی ۵S و بازرسی‌ها',
        summary: 'اطلاعات ۵S در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool: Management KPI & TRIR Summary
   */
  async getManagementKPISummary(): Promise<AIToolResult> {
    try {
      const trirRows = await db.select().from(schema.trirMonthlyRecords).catch(() => []);
      const latestTRIR = trirRows.length > 0 ? trirRows[0] : null;

      return {
        toolName: 'kpi_management_summary',
        titleFa: 'شاخص‌های کلیدی عملکرد مدیریت HSE (TRIR)',
        summary: latestTRIR
          ? `آخرین ضریب تکرار حادثه (TRIR) ثبت‌شده برابر با ${latestTRIR.trirValue || '0'} و نفر-ساعت کارکرد سازمان برابر با ${latestTRIR.totalWorkHours || '0'} ساعت است.`
          : 'شاخص‌های TRIR در ماه جاری در حال پایش و محاسبه است.',
        data: {
          hasRecords: trirRows.length > 0,
          latest: latestTRIR,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        toolName: 'kpi_management_summary',
        titleFa: 'شاخص‌های کلیدی عملکرد مدیریت',
        summary: 'اطلاعات KPI در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export const aiToolsRegistry = new AIToolsRegistry();
