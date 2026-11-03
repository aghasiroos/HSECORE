/**
 * HSECORE Safe Read-Only Domain Tools for AI Assistant
 * Provides structured, real-time data across ALL HSECORE modules to ground AI responses.
 * Strictly read-only; no raw SQL mutation.
 */

import { db, schema } from '../../core/db.ts';
import { desc } from 'drizzle-orm';
import { ptwRepository } from '../ptw/ptw.repository.ts';
import { incidentRepository } from '../incidents/incident.repository.ts';
import { weatherService } from '../../weather/service.ts';
import { AIToolResult } from './ai.types.ts';
import { logger } from '../../core/logger.ts';

/**
 * Normalize Persian/Arabic characters, digits, and spacing for colloquial & cross-script matching
 */
export function normalizePersianText(input: string): string {
  if (!input) return '';
  return String(input)
    .replace(/[\u064A\u0649\u0626]/g, 'ی') // ي ى ئ -> ی
    .replace(/\u0643/g, 'ک') // ك -> ک
    .replace(/\u0629/g, 'ه') // ة -> ه
    .replace(/\u0624/g, 'و') // ؤ -> و
    .replace(/[\u0622\u0623\u0625]/g, 'ا') // آ أ إ -> ا
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ') // zero-width spaces -> space
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export class AIToolsRegistry {
  private async loadSettingsMap(): Promise<Map<string, any>> {
    const map = new Map<string, any>();
    try {
      const rows = await db.select().from(schema.systemSettings).catch(() => []);
      for (const r of rows) {
        if (r && r.key) {
          let val = r.value;
          if (typeof val === 'string') {
            try {
              val = JSON.parse(val);
            } catch {}
          }
          map.set(r.key, val);
          map.set(r.key.toLowerCase(), val);
        }
      }
    } catch {}
    return map;
  }

  /**
   * Tool 1: Live Heat Stress Monitor & Meteorological Telemetry (دما، رطوبت، WBGT، استرس گرمایی)
   */
  async getHeatStressAndWeatherSummary(): Promise<AIToolResult> {
    try {
      const settingsMap = await this.loadSettingsMap();
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

      const weather = await weatherService.getWeather(
        { lat: heatLat, lon: heatLon, query: heatLocName },
        undefined,
        false
      );

      const riskLabelsFa: Record<string, string> = {
        Normal: 'عادی و ایمن (سبز)',
        Caution: 'احتیاط (زرد)',
        'Extreme Caution': 'احتیاط شدید (نارنجی)',
        Danger: 'خطر استرس گرمایی (قرمز)',
        'Extreme Danger': 'خطر بسیار شدید / بحرانی (بنفش)',
      };
      const riskFa = riskLabelsFa[weather.cat || 'Normal'] || weather.cat || 'عادی';

      const summaryLines = [
        `ایستگاه پایش: ${weather.locationName || heatLocName}`,
        `• دمای فعلی هوا (Air Temp): ${weather.tempC}°C`,
        `• رطوبت نسبی هوا (Humidity): ${weather.hum}%`,
        `• شاخص دمای تر گوی‌سان در آفتاب (WBGT Outdoor): ${weather.wbgt ?? '-'}°C`,
        `• شاخص دمای تر گوی‌سان در سایه (WBGT Shade): ${weather.wbgtShade ?? '-'}°C`,
        `• شاخص گرما (Heat Index): ${weather.hiDisplay || weather.hi || weather.tempC}°C`,
        `• دمای گوی‌سان (Globe Temp): ${weather.globeTemp ?? '-'}°C | دمای تر طبیعی (Wet Bulb): ${weather.wetBulb ?? '-'}°C | نقطه شبنم: ${weather.dewPoint ?? '-'}°C`,
        `• سرعت باد: ${weather.wind ?? 0} km/h | فشار هوا: ${weather.pressure ?? '-'} hPa`,
        `• وضعیت تنش حرارتی: ${riskFa}${weather.subLevel ? ` (سطح ${weather.subLevel})` : ''}`,
      ];

      return {
        toolName: 'heat_weather_summary',
        titleFa: 'ماژول پایش شاخص استرس گرمایی و هواشناسی (WBGT)',
        summary: summaryLines.join('\n'),
        data: {
          location: weather.locationName || heatLocName,
          coordinates: { lat: heatLat, lon: heatLon },
          tempC: weather.tempC,
          humidityPercent: weather.hum,
          wbgt: weather.wbgt,
          wbgtShade: weather.wbgtShade,
          heatIndex: weather.hi,
          globeTemp: weather.globeTemp,
          wetBulb: weather.wetBulb,
          dewPoint: weather.dewPoint,
          windKmh: weather.wind,
          pressureHpa: weather.pressure,
          category: weather.cat,
          categoryFa: riskFa,
          provider: weather.provider,
          observedAt: weather.observedAt,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      logger.debug('[AITools] getHeatStressAndWeatherSummary fallback', { error: err.message });
      return {
        toolName: 'heat_weather_summary',
        titleFa: 'ماژول پایش شاخص استرس گرمایی و هواشناسی (WBGT)',
        summary: 'ایستگاه هواشناسی برخط در این لحظه پاسخگو نیست؛ لطفاً تنظیمات مختصات ایستگاه در ماژول استرس گرمایی را بررسی فرمایید.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 2: PTW & Work Permits Real-Time Status (پروانه‌های کار و ممیزی PTW)
   */
  async getPTWSummary(): Promise<AIToolResult> {
    try {
      const [permits, settingsMap] = await Promise.all([
        ptwRepository.findAll(),
        this.loadSettingsMap(),
      ]);
      const total = permits.length;
      const active = permits.filter((p: any) => ['IN_PROGRESS', 'APPROVED', 'ACTIVE', 'ISSUED'].includes(String(p.status || '').toUpperCase())).length;
      const pending = permits.filter((p: any) => ['PENDING', 'DRAFT', 'PENDING_APPROVAL'].includes(String(p.status || '').toUpperCase())).length;
      const closed = permits.filter((p: any) => String(p.status || '').toUpperCase() === 'CLOSED' || p.isClosed).length;

      const countType = (match: (t: string) => boolean) =>
        permits.filter((p: any) => match(String(p.permitType || p.type || '').toUpperCase())).length;

      const hotWork = countType(t => t.includes('HOT') || t.includes('گرم'));
      const coldWork = countType(t => t.includes('COLD') || t.includes('سرد'));
      const confinedSpace = countType(t => t.includes('CONFINED') || t.includes('بسته'));
      const heightWork = countType(t => t.includes('HEIGHT') || t.includes('ارتفاع'));
      const excavation = countType(t => t.includes('EXCAVATION') || t.includes('حفاری'));
      const electrical = countType(t => t.includes('ELECTR') || t.includes('برق'));

      const audits: any[] = Array.isArray(settingsMap.get('hse_ptw_audit_records_v2'))
        ? settingsMap.get('hse_ptw_audit_records_v2')
        : [];

      const recentPermits = permits.slice(0, 5).map((p: any) => `${p.permitNumber || p.id}: ${p.title || p.permitType} (${p.location || 'بدون مکان'} - وضعیت: ${p.status})`);

      return {
        toolName: 'ptw_summary',
        titleFa: 'ماژول پروانه‌های کار (PTW) و ممیزی مجوزها',
        summary: [
          `• کل پروانه‌های کار ثبت‌شده: ${total} فقره (${active} فعال/در حال اجرا، ${pending} در انتظار تایید، ${closed} مختومه)`,
          `• تفکیک نوع مجوزها: ${hotWork} کار گرم، ${coldWork} کار سرد، ${confinedSpace} فضای بسته، ${heightWork} کار در ارتفاع، ${excavation} حفاری، ${electrical} برق`,
          `• تعداد ممیزی‌های ثبت‌شده پروانه کار: ${audits.length} مورد`,
          recentPermits.length > 0 ? `• آخرین مجوزها: ${recentPermits.join(' | ')}` : '',
        ].filter(Boolean).join('\n'),
        data: {
          totalPermits: total,
          activePermits: active,
          pendingPermits: pending,
          closedPermits: closed,
          byType: { hotWork, coldWork, confinedSpace, heightWork, excavation, electrical },
          totalAudits: audits.length,
          recentPermits,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        toolName: 'ptw_summary',
        titleFa: 'ماژول پروانه‌های کار (PTW)',
        summary: 'اطلاعات پروانه‌های کار در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 3: Incidents, Near Misses & CAPA Real-Time Summary (حوادث و شبه‌حوادث)
   */
  async getIncidentSummary(): Promise<AIToolResult> {
    try {
      const incidents = await incidentRepository.findAll();
      const total = incidents.length;
      const nearMisses = incidents.filter((i: any) => String(i.incidentType || i.type || '').toUpperCase().includes('NEAR')).length;
      const accidents = total - nearMisses;
      const openCases = incidents.filter((i: any) => !['CLOSED', 'RESOLVED', 'COMPLETED'].includes(String(i.status || '').toUpperCase())).length;
      const closed = total - openCases;
      const totalLostDays = incidents.reduce((sum: number, inc: any) => sum + Number(inc.lostWorkDays || inc.lostDays || 0), 0);

      const recentList = incidents.slice(0, 5).map((i: any) => `${i.incidentNumber || i.id}: ${i.title || i.description?.slice(0, 40)} (${i.location || ''} - شدت: ${i.severity || 'عادی'})`);

      return {
        toolName: 'incidents_summary',
        titleFa: 'ماژول گزارش‌دهی و تحلیل حوادث و شبه‌حوادث',
        summary: [
          `• کل رویدادهای ثبت‌شده: ${total} مورد (${accidents} حادثه و ${nearMisses} شبه‌حادثه / Near Miss)`,
          `• وضعیت پیگیری: ${openCases} پرونده باز/در حال بررسی و ${closed} پرونده مختومه`,
          `• مجموع روزهای کاری از دست رفته (LTI Lost Days): ${totalLostDays} روز`,
          recentList.length > 0 ? `• آخرین رویدادها: ${recentList.join(' | ')}` : '',
        ].filter(Boolean).join('\n'),
        data: { totalIncidents: total, nearMisses, accidents, openCases, closed, totalLostDays, recentList },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'incidents_summary',
        titleFa: 'ماژول حوادث و شبه‌حوادث',
        summary: 'اطلاعات حوادث در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 4: Occupational Health & Periodic Medical Exams Summary (بهداشت حرفه‌ای و طب کار)
   */
  async getHealthAndExamsSummary(): Promise<AIToolResult> {
    try {
      const [exams, audio, spiro, opto, diseases, settingsMap] = await Promise.all([
        db.select().from(schema.periodicMedicalExams).catch(() => []),
        db.select().from(schema.audiometryRecords).catch(() => []),
        db.select().from(schema.spirometryRecords).catch(() => []),
        db.select().from(schema.optometryRecords).catch(() => []),
        db.select().from(schema.occupationalDiseaseDiagnoses).catch(() => []),
        this.loadSettingsMap(),
      ]);

      const extraExams = Array.isArray(settingsMap.get('hse_medical_exams_v4')) ? settingsMap.get('hse_medical_exams_v4') : [];
      const allExams = exams.length > 0 ? exams : extraExams;
      const totalExams = allExams.length;

      let fit = 0;
      let conditional = 0;
      let unfit = 0;

      for (const e of allExams) {
        const status = String((e as any).fitnessStatus || (e as any).doctorVerdict || (e as any).final_opinion || '').toUpperCase();
        if (status.includes('UNFIT') || status.includes('عدم صلاحیت') || status.includes('نامناسب')) {
          unfit++;
        } else if (status.includes('CONDITIONAL') || status.includes('مشروط') || (e as any).restrictions) {
          conditional++;
        } else {
          fit++;
        }
      }

      return {
        toolName: 'health_medical_summary',
        titleFa: 'ماژول بهداشت حرفه‌ای و معاینات طب کار',
        summary: [
          `• کل پرونده‌های معاینات طب کار: ${totalExams} پرونده`,
          `• وضعیت تناسب شغلی: ${fit} نفر بلامانع (Fit)، ${conditional} نفر مشروط (Conditional)، ${unfit} نفر عدم صلاحیت (Unfit)`,
          `• رکوردهای پاراکلینیکی: ${audio.length} ادیومتری (شنوایی‌سنجی)، ${spiro.length} اسپیرومتری (تنفس)، ${opto.length} اپتومتری (بینایی‌سنجی) و ${diseases.length} تشخیص بیماری شغلی`,
        ].join('\n'),
        data: { totalExams, fit, conditional, unfit, audiometryCount: audio.length, spirometryCount: spiro.length, optometryCount: opto.length, diseasesCount: diseases.length },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'health_medical_summary',
        titleFa: 'ماژول بهداشت حرفه‌ای و طب کار',
        summary: 'اطلاعات معاینات طب کار در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 5: Nutrition, BMI & High-Risk Chronic Conditions Summary (تغذیه، BMI و بیماران پرخطر)
   */
  async getNutritionHighRiskSummary(): Promise<AIToolResult> {
    try {
      const exams = await db.select().from(schema.periodicMedicalExams).catch(() => []);
      let normalBmi = 0;
      let overweight = 0;
      let obeseGrade1 = 0;
      let obeseGrade2 = 0;
      let obeseGrade3 = 0;
      let highBloodPressure = 0;
      let highBloodSugar = 0;

      for (const exam of exams) {
        const raw = ((exam as any).rawData || (exam as any).extraData || {}) as Record<string, any>;
        const bmi = Number((exam as any).bmi || raw.bmi || 0);
        if (bmi > 0 && bmi < 25) normalBmi++;
        else if (bmi >= 25 && bmi < 30) overweight++;
        else if (bmi >= 30 && bmi < 35) obeseGrade1++;
        else if (bmi >= 35 && bmi < 40) obeseGrade2++;
        else if (bmi >= 40) obeseGrade3++;

        const sys = Number((exam as any).systolicBp || raw.bloodPressureSystolic || 0);
        const dia = Number((exam as any).diastolicBp || raw.bloodPressureDiastolic || 0);
        if (sys >= 140 || dia >= 90) highBloodPressure++;

        const fbs = Number(raw.fbs || 0);
        if (fbs >= 126) highBloodSugar++;
      }

      return {
        toolName: 'nutrition_high_risk_summary',
        titleFa: 'ماژول تغذیه، شاخص توده بدنی (BMI) و بیماران پرخطر',
        summary: [
          `• وضعیت وزن و BMI در پرونده‌های سلامت: ${normalBmi} نفر وزن نرمال، ${overweight} نفر اضافه‌وزن (BMI 25-29.9)، ${obeseGrade1} نفر چاقی درجه ۱، ${obeseGrade2} نفر چاقی درجه ۲ و ${obeseGrade3} نفر چاقی مفرط (BMI ≥ 40)`,
          `• شاخص‌های متابولیک پرخطر: ${highBloodPressure} نفر دارای فشار خون بالا (≥140/90) و ${highBloodSugar} نفر دارای قند خون ناشتای بالا (FBS ≥ 126)`,
        ].join('\n'),
        data: { normalBmi, overweight, obeseGrade1, obeseGrade2, obeseGrade3, highBloodPressure, highBloodSugar },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'nutrition_high_risk_summary',
        titleFa: 'ماژول تغذیه و بیماران پرخطر',
        summary: 'اطلاعات پایش تغذیه در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 6: Risk Assessment & Hazard Identification (ارزیابی ریسک و مخاطرات)
   */
  async getRiskAssessmentsSummary(): Promise<AIToolResult> {
    try {
      const risks = await db.select().from(schema.riskAssessments).catch(() => []);
      const total = risks.length;
      const highRisks = risks.filter((r: any) => ['HIGH', 'EXTREME', 'CRITICAL'].includes(String(r.initialRiskLevel || r.riskLevel || '').toUpperCase())).length;
      const mediumRisks = risks.filter((r: any) => String(r.initialRiskLevel || r.riskLevel || '').toUpperCase() === 'MEDIUM').length;
      const lowRisks = Math.max(0, total - highRisks - mediumRisks);

      const topHazards = risks.slice(0, 5).map((r: any) => `${r.activityTitle}: ${r.hazardDescription} (سطح ریسک: ${r.initialRiskLevel || 'متوسط'})`);

      return {
        toolName: 'risk_assessment_summary',
        titleFa: 'ماژول ارزیابی ریسک و شناسایی مخاطرات (JSA / HAZID)',
        summary: [
          `• کل ارزیابی‌های ریسک ثبت‌شده: ${total} مورد (${highRisks} ریسک بالا/بحرانی، ${mediumRisks} ریسک متوسط، ${lowRisks} ریسک پایین/کنترل‌شده)`,
          topHazards.length > 0 ? `• نمونه مخاطرات ثبت‌شده: ${topHazards.join(' | ')}` : '',
        ].filter(Boolean).join('\n'),
        data: { totalRisks: total, highRisks, mediumRisks, lowRisks, topHazards },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'risk_assessment_summary',
        titleFa: 'ماژول ارزیابی ریسک',
        summary: 'اطلاعات ارزیابی ریسک در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 7: 5S System & Safety Inspections (نظام آراستگی ۵S و بازرسی‌های ایمنی)
   */
  async get5SAndInspectionsSummary(): Promise<AIToolResult> {
    try {
      const [fiveSRows, inspections, settingsMap] = await Promise.all([
        db.select().from(schema.fiveSAudits).catch(() => []),
        db.select().from(schema.safetyInspections).catch(() => []),
        this.loadSettingsMap(),
      ]);

      const settingFiveS: any[] = Array.isArray(settingsMap.get('hse_5s_inspections_v3')) ? settingsMap.get('hse_5s_inspections_v3') : [];
      const settingInsp: any[] = Array.isArray(settingsMap.get('hse_safety_dept_inspections_v1')) ? settingsMap.get('hse_safety_dept_inspections_v1') : [];

      const totalFiveS = Math.max(fiveSRows.length, settingFiveS.length);
      const totalInsp = Math.max(inspections.length, settingInsp.length);
      const avgFiveS = fiveSRows.length > 0
        ? Math.round((fiveSRows as any[]).reduce((s: number, r: any) => s + Number(r.totalScore || 0), 0) / fiveSRows.length)
        : 0;

      return {
        toolName: 'five_s_inspections_summary',
        titleFa: 'ماژول نظام آراستگی ۵S و بازرسی‌های فنی ایمنی',
        summary: `• مجموع ممیزی‌های نظام آراستگی ۵S: ${totalFiveS} مورد (میانگین امتیاز: ${avgFiveS}%)\n• مجموع بازرسی‌های فنی و چک‌لیست‌های ایمنی (تجهیزات، داربست، جرثقیل، برق و حفاری): ${totalInsp} مورد`,
        data: { totalFiveSAudits: totalFiveS, averageFiveSScore: avgFiveS, totalInspections: totalInsp },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'five_s_inspections_summary',
        titleFa: 'ماژول ۵S و بازرسی‌های ایمنی',
        summary: 'اطلاعات بازرسی و ۵S در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 8: Fire Department, Extinguishers & Vehicles (آتش‌نشانی و تجهیزات اطفاء حریق)
   */
  async getFireSafetySummary(): Promise<AIToolResult> {
    try {
      const [fireEq, settingsMap] = await Promise.all([
        db.select().from(schema.fireEquipment).catch(() => []),
        this.loadSettingsMap(),
      ]);
      const vehicles: any[] = Array.isArray(settingsMap.get('hse_fire_vehicles_v1')) ? settingsMap.get('hse_fire_vehicles_v1') : [];
      const serviceable = fireEq.filter((f: any) => ['SERVICEABLE', 'OPERATIONAL', 'GOOD', 'ACTIVE'].includes(String(f.status || '').toUpperCase())).length;
      const needsAttention = Math.max(0, fireEq.length - serviceable);

      const co2 = fireEq.filter((f: any) => String(f.equipmentType || '').toUpperCase().includes('CO2')).length;
      const powder = fireEq.filter((f: any) => String(f.equipmentType || '').toUpperCase().includes('POWDER')).length;
      const foam = fireEq.filter((f: any) => String(f.equipmentType || '').toUpperCase().includes('FOAM')).length;
      const hydrants = fireEq.filter((f: any) => String(f.equipmentType || '').toUpperCase().includes('HYDRANT')).length;

      return {
        toolName: 'fire_safety_summary',
        titleFa: 'ماژول آتش‌نشانی، تجهیزات اطفاء حریق و خودروهای عملیاتی',
        summary: [
          `• کل تجهیزات اطفاء حریق ثبت‌شده: ${fireEq.length} دستگاه (${serviceable} عملیاتی/آماده به کار، ${needsAttention} نیازمند شارژ یا بازرسی)`,
          `• تفکیک تجهیزات: ${powder} کپسول پودر و گاز، ${co2} کپسول CO2، ${foam} فوم، ${hydrants} هیدرانت`,
          `• خودروهای عملیاتی آتش‌نشانی و امداد: ${vehicles.length} دستگاه`,
        ].join('\n'),
        data: { totalEquipment: fireEq.length, serviceable, needsAttention, byType: { co2, powder, foam, hydrants }, vehiclesCount: vehicles.length },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'fire_safety_summary',
        titleFa: 'ماژول آتش‌نشانی',
        summary: 'اطلاعات تجهیزات آتش‌نشانی در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 9: Safety Warnings, Anomalies & Non-Conformances (اخطارهای ایمنی، تخلفات و عدم انطباق‌ها)
   */
  async getWarningsAndAnomaliesSummary(): Promise<AIToolResult> {
    try {
      const [warnings, ncs] = await Promise.all([
        db.select().from(schema.safetyWarnings).orderBy(desc(schema.safetyWarnings.createdAt)).catch(() => []),
        db.select().from(schema.nonConformances).orderBy(desc(schema.nonConformances.createdAt)).catch(() => []),
      ]);

      const activeWarnings = warnings.filter((w: any) => !['CLOSED', 'RESOLVED', 'REVOKED'].includes(String(w.status || '').toUpperCase())).length;
      const openNcs = ncs.filter((n: any) => !['CLOSED', 'RESOLVED'].includes(String(n.status || '').toUpperCase())).length;
      const recentWarnings = warnings.slice(0, 4).map((w: any) => `${w.personnelName || w.name || 'پرسنل'}: ${w.reason || w.category} (${w.warningDate || ''})`);

      return {
        toolName: 'warnings_anomalies_summary',
        titleFa: 'ماژول اخطارهای ایمنی، تخلفات و عدم انطباق‌ها (NC)',
        summary: [
          `• کل اخطارها و تخلفات ایمنی ثبت‌شده: ${warnings.length} مورد (${activeWarnings} اخطار فعال)`,
          `• کل پرونده‌های عدم انطباق (Non-Conformance): ${ncs.length} مورد (${openNcs} پرونده باز در جریان اقدام اصلاحی)`,
          recentWarnings.length > 0 ? `• آخرین اخطارهای ثبت‌شده: ${recentWarnings.join(' | ')}` : '',
        ].filter(Boolean).join('\n'),
        data: { totalWarnings: warnings.length, activeWarnings, totalNonConformances: ncs.length, openNonConformances: openNcs, recentWarnings },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'warnings_anomalies_summary',
        titleFa: 'ماژول اخطارها و عدم انطباق‌ها',
        summary: 'اطلاعات اخطارها و عدم انطباق‌ها در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 10: HSE Training & Competency Summary (آموزش‌های ایمنی و ماتریس صلاحیت)
   */
  async getTrainingSummary(): Promise<AIToolResult> {
    try {
      const [courses, attendances, settingsMap] = await Promise.all([
        db.select().from(schema.hseTrainings).catch(() => []),
        db.select().from(schema.trainingAttendances).catch(() => []),
        this.loadSettingsMap(),
      ]);
      const settingCourses: any[] = Array.isArray(settingsMap.get('hse_training_courses_v2')) ? settingsMap.get('hse_training_courses_v2') : [];
      const totalCourses = Math.max(courses.length, new Set(settingCourses.map((c: any) => c.courseCode || c.title)).size);
      const totalAttendances = Math.max(attendances.length, settingCourses.length);
      const totalHours = (courses as any[]).reduce((s: number, c: any) => s + Number(c.durationHours || 0), 0) + settingCourses.reduce((s: number, c: any) => s + Number(c.hours || 0), 0);
      const courseNames = courses.slice(0, 5).map((c: any) => c.courseTitle);

      return {
        toolName: 'training_summary',
        titleFa: 'ماژول آموزش‌های ایمنی و ماتریس شایستگی کارکنان',
        summary: [
          `• کل دوره‌های آموزشی تعریف‌شده: ${totalCourses} دوره | مجموع حضور در دوره‌ها: ${totalAttendances} نفر-دوره`,
          `• مجموع ساعات آموزشی ثبت‌شده: ${totalHours} ساعت`,
          courseNames.length > 0 ? `• عناوین دوره‌های فعال: ${courseNames.join('، ')}` : '',
        ].filter(Boolean).join('\n'),
        data: { totalCourses, totalAttendances, totalHours, courseNames },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'training_summary',
        titleFa: 'ماژول آموزش‌های ایمنی',
        summary: 'اطلاعات آموزش در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 11: PPE Management Summary (تجهیزات حفاظت فردی)
   */
  async getPPESummary(): Promise<AIToolResult> {
    try {
      const ppeList = await db.select().from(schema.ppeIssuances).catch(() => []);
      const total = ppeList.length;
      const totalQty = (ppeList as any[]).reduce((s: number, p: any) => s + Number(p.quantity || 1), 0);
      const recentItems = ppeList.slice(0, 5).map((p: any) => `${p.itemName} (${p.itemCategory} - تعداد: ${p.quantity})`);

      return {
        toolName: 'ppe_summary',
        titleFa: 'ماژول مدیریت تجهیزات حفاظت فردی (PPE)',
        summary: [
          `• کل رکوردهای تحویل تجهیزات حفاظت فردی: ${total} نوبت (مجموع اقلام توزیع‌شده: ${totalQty} عدد)`,
          recentItems.length > 0 ? `• آخرین اقلام تحویلی: ${recentItems.join(' | ')}` : '',
        ].filter(Boolean).join('\n'),
        data: { totalIssuances: total, totalQuantity: totalQty, recentItems },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'ppe_summary',
        titleFa: 'ماژول تجهیزات حفاظت فردی (PPE)',
        summary: 'اطلاعات تجهیزات حفاظت فردی در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 12: Environmental Monitoring & Waste Management (محیط زیست، پسماند و پساب)
   */
  async getEnvironmentSummary(): Promise<AIToolResult> {
    try {
      const envLogs = await db.select().from(schema.environmentalLogs).orderBy(desc(schema.environmentalLogs.createdAt)).catch(() => []);
      const total = envLogs.length;
      const compliant = envLogs.filter((e: any) => e.isCompliant !== false).length;
      const nonCompliant = total - compliant;
      const recentParams = envLogs.slice(0, 5).map((e: any) => `${e.parameterName || e.category}: ${e.measuredValue ?? '-'} ${e.unit || ''} (${e.isCompliant ? 'منطبق با استاندارد' : 'فراتر از حد مجاز'})`);

      return {
        toolName: 'environment_summary',
        titleFa: 'ماژول پایش محیط زیست، پساب و مدیریت پسماند',
        summary: [
          `• کل رکوردهای پایش زیست‌محیطی و پسماند: ${total} مورد (${compliant} منطبق با استاندارد، ${nonCompliant} عدم انطباق زیست‌محیطی)`,
          recentParams.length > 0 ? `• آخرین سنجش‌ها: ${recentParams.join(' | ')}` : '',
        ].filter(Boolean).join('\n'),
        data: { totalLogs: total, compliant, nonCompliant, recentParams },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'environment_summary',
        titleFa: 'ماژول محیط زیست و پسماند',
        summary: 'اطلاعات محیط زیست در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 13: Personnel & Organizational Hierarchy Summary (پرسنل و ساختار سازمانی)
   */
  async getPersonnelAndOrgSummary(): Promise<AIToolResult> {
    try {
      const [pers, companies, sites, depts, units] = await Promise.all([
        db.select().from(schema.personnel).catch(() => []),
        db.select().from(schema.orgCompanies).catch(() => []),
        db.select().from(schema.orgSites).catch(() => []),
        db.select().from(schema.orgDepartments).catch(() => []),
        db.select().from(schema.orgUnits).catch(() => []),
      ]);
      const activePers = pers.filter((p: any) => String(p.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;

      return {
        toolName: 'personnel_org_summary',
        titleFa: 'ماژول پرونده پرسنلی و ساختار سازمانی',
        summary: [
          `• کل پرسنل ثبت‌شده در سامانه: ${pers.length} نفر (${activePers} نفر شاغل فعال)`,
          `• ساختار سازمانی: ${companies.length} شرکت، ${sites.length} سایت/مجتمع، ${depts.length} مدیریت/اداره و ${units.length} واحد عملیاتی`,
        ].join('\n'),
        data: { totalPersonnel: pers.length, activePersonnel: activePers, companies: companies.length, sites: sites.length, departments: depts.length, units: units.length },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'personnel_org_summary',
        titleFa: 'ماژول پرسنل و ساختار سازمانی',
        summary: 'اطلاعات پرسنل در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 14: Workflows, Referrals & BPMN Processes (کارتابل ارجاعات و مدیریت فرآیندها)
   */
  async getWorkflowAndReferralsSummary(): Promise<AIToolResult> {
    try {
      const [wfInstances, bpmnProcs, settingsMap] = await Promise.all([
        db.select().from(schema.workflowInstances).catch(() => []),
        db.select().from(schema.bpmnProcesses).catch(() => []),
        this.loadSettingsMap(),
      ]);
      const referrals: any[] = Array.isArray(settingsMap.get('hse_document_referrals_v1')) ? settingsMap.get('hse_document_referrals_v1') : [];
      const pendingWf = wfInstances.filter((w: any) => ['PENDING', 'IN_PROGRESS'].includes(String(w.status || '').toUpperCase())).length;
      const pendingRefs = referrals.filter((r: any) => String(r.status || '').toUpperCase() === 'PENDING').length;

      return {
        toolName: 'workflow_referrals_summary',
        titleFa: 'ماژول مدیریت فرآیندها (BPMN) و کارتابل اسناد و ارجاعات',
        summary: [
          `• فرآیندهای استاندارد BPMN ثبت‌شده: ${bpmnProcs.length} فرآیند`,
          `• گردش‌کارهای جاری: ${wfInstances.length} مورد (${pendingWf} در انتظار بررسی و تایید)`,
          `• ارجاعات کارتابل اسناد: ${referrals.length} ارجاع (${pendingRefs} مورد در انتظار اقدام)`,
        ].join('\n'),
        data: { bpmnProcesses: bpmnProcs.length, workflowInstances: wfInstances.length, pendingWorkflows: pendingWf, totalReferrals: referrals.length, pendingReferrals: pendingRefs },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'workflow_referrals_summary',
        titleFa: 'ماژول فرآیندها و کارتابل ارجاعات',
        summary: 'اطلاعات گردش کار در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 15: Management KPI & TRIR Summary (شاخص‌های کلیدی عملکرد و TRIR)
   */
  async getManagementKPISummary(): Promise<AIToolResult> {
    try {
      const trirRows = await db.select().from(schema.trirMonthlyRecords).orderBy(desc(schema.trirMonthlyRecords.year), desc(schema.trirMonthlyRecords.monthIndex)).catch(() => []);
      const latestTRIR = trirRows.length > 0 ? trirRows[0] : null;
      const totalHours = (trirRows as any[]).reduce((s: number, r: any) => s + Number(r.totalHours || 0), 0);
      const totalInc = (trirRows as any[]).reduce((s: number, r: any) => s + Number(r.incidents || 0), 0);

      return {
        toolName: 'kpi_management_summary',
        titleFa: 'ماژول داشبورد کلان و شاخص‌های کلیدی عملکرد (TRIR)',
        summary: latestTRIR
          ? `• آخرین دوره ثبت‌شده (${latestTRIR.month} ${latestTRIR.year}): ضریب تکرار حادثه ماهانه (Monthly TRIR) برابر ${latestTRIR.monthlyTrir ?? 0} و ضریب تجمعی ۱۲ ماهه (Rolling TRIR) برابر ${latestTRIR.rollingTrir ?? 0}\n• مجموع نفر-ساعت کارکرد ثبت‌شده: ${totalHours.toLocaleString('en-US')} ساعت | مجموع حوادث قابل ثبت در سری زمانی: ${totalInc} مورد`
          : 'هیچ رکورد ماهانه TRIR هنوز ثبت نشده است.',
        data: {
          hasRecords: trirRows.length > 0,
          latest: latestTRIR,
          totalWorkHours: totalHours,
          totalRecordedIncidents: totalInc,
        },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'kpi_management_summary',
        titleFa: 'ماژول شاخص‌های کلیدی عملکرد (KPI)',
        summary: 'اطلاعات KPI در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 16: Non-Conformances & Audit Findings Summary (عدم انطباق‌ها و ممیزی‌ها)
   */
  async getNonConformancesSummary(): Promise<AIToolResult> {
    try {
      const ncs = await db.select().from(schema.nonConformances).catch(() => []);
      const total = ncs.length;
      const open = ncs.filter((n: any) => ['OPEN', 'DRAFT', 'SUBMITTED', 'IN_PROGRESS'].includes(String(n.status || '').toUpperCase())).length;
      const closed = ncs.filter((n: any) => ['CLOSED', 'RESOLVED', 'VERIFIED'].includes(String(n.status || '').toUpperCase())).length;
      const major = ncs.filter((n: any) => String(n.severity || '').toUpperCase() === 'MAJOR' || String(n.severity || '').toUpperCase() === 'CRITICAL').length;

      return {
        toolName: 'non_conformances_summary',
        titleFa: 'ماژول عدم انطباق‌ها و ممیزی‌های HSE (ISO 45001 / ISO 14001)',
        summary: [
          `• کل عدم انطباق‌های ثبت‌شده: ${total} مورد`,
          `• عدم انطباق‌های باز / در حال پیگیری: ${open} مورد`,
          `• عدم انطباق‌های مختومه و رفع‌شده: ${closed} مورد`,
          `• موارد با شدت عمده (Major/Critical): ${major} مورد`,
        ].join('\n'),
        data: { total, open, closed, major },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'non_conformances_summary',
        titleFa: 'ماژول عدم انطباق‌ها',
        summary: 'اطلاعات عدم انطباق‌ها در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 17: System Notifications & Alerts Summary (هشدارها و اعلان‌های سامانه)
   */
  async getNotificationsAndAlertsSummary(): Promise<AIToolResult> {
    try {
      const notifs = await db.select().from(schema.notifications).catch(() => []);
      const total = notifs.length;
      const critical = notifs.filter((n: any) => String(n.priority || '').toLowerCase() === 'critical' || String(n.category || '').toLowerCase() === 'critical_hse').length;
      const high = notifs.filter((n: any) => String(n.priority || '').toLowerCase() === 'high').length;
      const ackRequired = notifs.filter((n: any) => n.requiresAck && (!Array.isArray(n.acknowledgedBy) || n.acknowledgedBy.length === 0)).length;

      const recentNotifs = notifs.slice(-3).reverse().map((n: any) => `  - [${n.priority || 'medium'}] ${n.title}: ${(n.body || '').slice(0, 50)}...`).join('\n');

      return {
        toolName: 'notifications_summary',
        titleFa: 'ماژول هشدارها، رویدادها و اعلان‌های بلادرنگ سامانه',
        summary: [
          `• کل اعلان‌ها و هشدارهای ثبت‌شده: ${total} مورد`,
          `• هشدارهای سطح بحرانی (Critical): ${critical} مورد | هشدارهای اولویت بالا: ${high} مورد`,
          `• اعلان‌های نیازمند تایید دریافت (Pending Ack): ${ackRequired} مورد`,
          recentNotifs ? `• آخرین اعلان‌ها:\n${recentNotifs}` : '',
        ].filter(Boolean).join('\n'),
        data: { total, critical, high, ackRequired },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'notifications_summary',
        titleFa: 'ماژول اعلان‌ها و هشدارها',
        summary: 'اطلاعات اعلان‌ها در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 18: Users, Roles & RBAC Access Control Summary (کاربران، نقش‌ها و سطوح دسترسی)
   */
  async getUsersAndRolesSummary(): Promise<AIToolResult> {
    try {
      const userList = await db.select().from(schema.users).catch(() => []);
      const total = userList.length;
      const active = userList.filter((u: any) => u.isActive && String(u.accountStatus || 'Active').toLowerCase() === 'active').length;
      const roleCounts: Record<string, number> = {};
      for (const u of userList as any[]) {
        const r = String(u.role || 'User').trim();
        roleCounts[r] = (roleCounts[r] || 0) + 1;
      }
      const roleBreakdown = Object.entries(roleCounts).map(([r, c]) => `${r}: ${c} نفر`).join(' | ');

      return {
        toolName: 'users_roles_summary',
        titleFa: 'ماژول مدیریت کاربران، نقش‌ها و مجوزهای دسترسی (RBAC)',
        summary: [
          `• کل کاربران تعریف‌شده در سامانه: ${total} نفر (${active} کاربر فعال)`,
          `• توزیع نقش‌های کاربری: ${roleBreakdown || 'تعریف نشده'}`,
          `• مکانیزم دسترسی: کنترل دسترسی مبتنی بر نقش (RBAC) با مجوزهای تفکیک‌شده برای هر ماژول`,
        ].join('\n'),
        data: { totalUsers: total, activeUsers: active, roleCounts },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'users_roles_summary',
        titleFa: 'ماژول کاربران و نقش‌ها',
        summary: 'اطلاعات کاربران در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 19: System Settings, Configuration & Backup/Restore Status (تنظیمات، پیکربندی و پشتیبان‌گیری)
   */
  async getSettingsAndBackupSummary(): Promise<AIToolResult> {
    try {
      const [settingsMap, files] = await Promise.all([
        this.loadSettingsMap(),
        db.select().from(schema.systemFiles).catch(() => []),
      ]);
      const backupSetting = settingsMap.get('hse_system_backup_config') || settingsMap.get('backup_config');
      const backupSchedule = typeof backupSetting?.schedule === 'string' ? backupSetting.schedule : null;
      const lastBackupDate = typeof backupSetting?.lastBackupDate === 'string' ? backupSetting.lastBackupDate : null;

      return {
        toolName: 'settings_backup_summary',
        titleFa: 'ماژول تنظیمات سامانه و وضعیت پیکربندی پشتیبان‌گیری',
        summary: [
          backupSetting
            ? `• تنظیمات پشتیبان‌گیری ثبت شده است؛ برنامه زمان‌بندی: ${backupSchedule || 'در تنظیمات ثبت نشده'}`
            : '• تنظیمات پشتیبان‌گیری در کلیدهای پیکربندی شناخته‌شده پیدا نشد؛ فعال بودن بکاپ قابل تأیید نیست.',
          lastBackupDate
            ? `• آخرین زمان بکاپ ثبت‌شده در تنظیمات: ${lastBackupDate} (صرفاً metadata؛ نه تأیید صحت فایل بکاپ)`
            : '• زمان آخرین بکاپ در تنظیمات ثبت نشده است.',
          `• تعداد فایل‌های سیستمی ثبت‌شده در پایگاه داده: ${files.length} فایل`,
        ].join('\n'),
        data: {
          hasBackupConfig: Boolean(backupSetting),
          backupSchedule,
          lastBackupDate,
          totalSystemFiles: files.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'settings_backup_summary',
        titleFa: 'ماژول تنظیمات و پشتیبان‌گیری',
        summary: 'اطلاعات تنظیمات و پشتیبان‌گیری در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 20: Complete HSECORE System Architecture & Blueprint (معماری جامع، ماژول‌ها، تب‌ها، فرم‌ها و قابلیت‌ها)
   */
  async getSystemArchitectureAndCapabilitiesSummary(): Promise<AIToolResult> {
    return {
      toolName: 'system_architecture_summary',
      titleFa: 'نقشه معماری جامع، ساختار ماژول‌ها، تب‌ها، فرم‌ها و قابلیت‌های HSECORE',
      summary: [
        `🏛️ **معماری جامع سامانه یکپارچه HSECORE:**`,
        `۱. **ماژول‌ها و تب‌های عملیاتی سامانه (۲۴ ماژول یکپارچه):**`,
        `   • داشبورد مدیریتی (Dashboard): تب‌های شاخص‌های کلیدی، نمودارهای TRIR/LTIFR، تقویم HSE، خلاصه وضعیت ایستگاه‌های کاری`,
        `   • استرس گرمایی (Heat Stress): تب هواشناسی آنلاین، محاسبه دمای تر گوی‌سان (WBGT آفتاب و سایه طبق ISO 7243)، رژیم کار-استراحت، آلارم صوتی`,
        `   • پروانه کار ایمن (PTW): تب‌های کار گرم، سرد، فضای بسته، ارتفاع، حفاری، ایزولاسیون LOTO، تست گاز و ارجاعات الکترونیکی`,
        `   • واحد ایمنی (Safety Unit): تب بازرسی‌های کارگاهی، چک‌لیست‌های دوره‌ای، کمیته‌های حفاظت فنی و ایمنی ماشین‌آلات`,
        `   • آتش‌نشانی و امداد (Fire Dept): تب بازرسی کپسول‌ها، فایرباکس، سناریوهای واکنش در شرایط اضطراری (ERP) و مانورها`,
        `   • بهداشت و محیط زیست (Health & Env): تب‌های طب کار (معاینات ادواری و بدو استخدام)، ارگونومی، پایش عوامل زیان‌آور فیزیکی/شیمیایی، پسماند و پساب`,
        `   • ارزیابی ریسک (Risk Assessment): تب متدولوژی‌های JSA, FMEA, HAZOP، ماتریس ۵×۵ و سلسله‌مراتب اقدامات کنترلی`,
        `   • حوادث و شبه‌حوادث (Incidents): تب ثبت رخداد، ماتریس علل ریشه‌ای (RCA / Fishbone)، اقدامات اصلاحی (CAPA) و آمار خسارات`,
        `   • اخطارها و ناهنجاری‌ها (Warnings): تب ثبت شرایط و اعمال ناایمن، تعیین مهلت رفع و پیگیری بازرسی‌ها`,
        `   • عدم انطباق‌ها (Non-Conformances): تب ممیزی داخلی و خارجی، استانداردهای ISO 45001 / ISO 14001 و تاییدیه رفع`,
        `   • آموزش و صلاحیت (Training): تب تقویم آموزشی سالیانه، ماتریس شایستگی، سوابق دوره‌ها و صدور گواهینامه`,
        `   • تجهیزات حفاظت فردی (PPE): تب جدول استحقاق، انبارداری اقلام، تاریخ انقضا و فرم‌های تحویل به پرسنل`,
        `   • پرونده پرسنلی (Personnel): تب مشخصات، سوابق سلامت، حوادث گذشته، جایگاه در چارت سازمانی و مدارک پیوست`,
        `   • فرآیندها و گردش کار (BPMN): تب دیاگرام‌های فرآیندی استاندارد، کارتابل اسناد، امضاهای دیجیتال چندمرحله‌ای`,
        `   • کتابخانه مستندات (Documents & RAG): تب خط‌مشی‌ها، آیین‌نامه‌ها، دستورالعمل‌های کاری و جستجوی معنایی هوش مصنوعی`,
        `   • کاربران و نقش‌ها (User Management & RBAC): تب تعریف کاربران، نقش‌ها (مدیر، کارشناس، پزشک، ناظر) و حدود دسترسی`,
        `   • تنظیمات سامانه و پشتیبان‌گیری (System Settings): تب پارامترهای سرور، پیکربندی هوش مصنوعی، پایگاه داده و بکاپ خودکار`,
        `   • هشدارها و اعلان‌ها (Notifications): تب هشدارهای بلادرنگ کارتابل، رویدادهای بحرانی و اعلان‌های درون‌برنامه‌ای`,
        `۲. **فرم‌های ثبت اطلاعات:**`,
        `   • فرم صدور PTW، فرم گازسنجی، فرم ایزولاسیون مکانیکی/الکتریکی، فرم گزارش حادثه، فرم JSA، فرم معاینات طب کار، فرم تحویل PPE، فرم بازرسی آتش‌نشانی و فرم‌های ممیزی ۵S`,
        `۳. **پایگاه داده و جداول:**`,
        `   • بیش از ۲۵ جدول رابطه‌ای PostgreSQL شامل users, personnel, work_permits, incidents, risk_assessments, notifications, non_conformances, system_settings و audit_logs`,
        `۴. **قابلیت‌های فعلی و آینده:**`,
        `   • قابلیت‌های فعلی: همگام‌سازی آفلاین، موتور هوش مصنوعی محلی Ollama، جستجوی عمیق RAG، امضای دیجیتال و محاسبات فیزیک هواشناسی`,
        `   • قابلیت‌های نقشه راه آینده: اتصال سنسورهای اینترنت اشیاء (IoT) برای گازسنجی آنلاین، هوش مصنوعی بینایی ماشین برای تشخیص PPE و پیش‌بینی ریسک حوادث`,
      ].join('\n'),
      data: {
        totalModules: 24,
        hasBPMN: true,
        hasIoTSupport: true,
        databaseType: 'PostgreSQL with Drizzle ORM',
        offlineSupport: true,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Tool 21: Universal Cross-Module Deep Search (جستجوی هوشمند رکوردها در تمامی ماژول‌های سامانه)
   * Matches colloquial terms, names, codes, locations, or descriptions across all database tables.
   */
  async searchAcrossAllModules(rawQuery: string, includeSensitivePersonnel = true): Promise<AIToolResult | null> {
    const normalizedQ = normalizePersianText(rawQuery);
    const stopWords = new Set([
      'از', 'به', 'در', 'با', 'برای', 'چه', 'چند', 'چطور', 'کجا', 'کی', 'ماژول', 'بخش', 'قسمت',
      'بهم', 'بده', 'بگو', 'نشان', 'نشون', 'لیست', 'گزارش', 'وضعیت', 'اطلاعات', 'آمار', 'امار',
      'میخواهم', 'میخوام', 'لطفا', 'لطفاً', 'سلام', 'خوبی', 'چیه', 'چیست', 'است', 'هست', 'داریم',
      'رو', 'را', 'های', 'ها', 'یا', 'و', 'که', 'این', 'آن', 'ان', 'همه', 'کل', 'تعداد', 'مورد',
    ]);

    const tokens = normalizedQ
      .split(/\s+/)
      .map(t => t.replace(/[^\w\u0600-\u06FF]/g, ''))
      .filter(t => t.length >= 2 && !stopWords.has(t));

    if (tokens.length === 0) return null;

    try {
      const [permits, incidents, risks, warnings, ncs, fireEq, trainings, envLogs, personnelList, notifsList, usersList] = await Promise.all([
        ptwRepository.findAll().catch(() => []),
        incidentRepository.findAll().catch(() => []),
        db.select().from(schema.riskAssessments).catch(() => []),
        db.select().from(schema.safetyWarnings).catch(() => []),
        db.select().from(schema.nonConformances).catch(() => []),
        db.select().from(schema.fireEquipment).catch(() => []),
        db.select().from(schema.hseTrainings).catch(() => []),
        db.select().from(schema.environmentalLogs).catch(() => []),
        includeSensitivePersonnel ? db.select().from(schema.personnel).catch(() => []) : Promise.resolve([]),
        db.select().from(schema.notifications).catch(() => []),
        includeSensitivePersonnel ? db.select().from(schema.users).catch(() => []) : Promise.resolve([]),
      ]);

      const matchesToken = (text: string): number => {
        const norm = normalizePersianText(text);
        if (!norm) return 0;
        let hits = 0;
        for (const tk of tokens) {
          if (norm.includes(tk)) hits++;
        }
        return hits;
      };

      const matchedLines: string[] = [];

      // Search Permits
      for (const p of permits as any[]) {
        const blob = `${p.permitNumber || ''} ${p.title || ''} ${p.permitType || ''} ${p.location || ''} ${p.contractorName || ''} ${p.description || ''}`;
        if (matchesToken(blob) > 0) {
          matchedLines.push(`• [پروانه کار ${p.permitNumber}] عنوان: ${p.title} | نوع: ${p.permitType} | محل: ${p.location} | وضعیت: ${p.status}`);
          if (matchedLines.length >= 12) break;
        }
      }

      // Search Incidents
      for (const i of incidents as any[]) {
        const blob = `${i.incidentNumber || ''} ${i.title || ''} ${i.incidentType || ''} ${i.location || ''} ${i.description || ''} ${i.personnelName || ''}`;
        if (matchesToken(blob) > 0) {
          matchedLines.push(`• [حادثه/رویداد ${i.incidentNumber || i.id}] نوع: ${i.incidentType} | محل: ${i.location} | شرح: ${(i.description || '').slice(0, 70)} | وضعیت: ${i.status}`);
          if (matchedLines.length >= 12) break;
        }
      }

      // Search Risks
      for (const r of risks as any[]) {
        const blob = `${r.activityTitle || ''} ${r.hazardDescription || ''} ${r.consequences || ''} ${r.existingControls || ''}`;
        if (matchesToken(blob) > 0) {
          matchedLines.push(`• [ارزیابی ریسک] فعالیت: ${r.activityTitle} | خطر: ${r.hazardDescription} | سطح ریسک: ${r.initialRiskLevel}`);
          if (matchedLines.length >= 12) break;
        }
      }

      // Search Warnings & Non-Conformances
      for (const w of warnings as any[]) {
        const blob = `${w.personnelName || ''} ${w.personnelCode || ''} ${w.reason || ''} ${w.category || ''} ${w.unit || ''}`;
        if (matchesToken(blob) > 0) {
          matchedLines.push(`• [اخطار ایمنی] نام: ${w.personnelName} | علت: ${w.reason} | سطح: ${w.warningLevel} | تاریخ: ${w.warningDate}`);
          if (matchedLines.length >= 12) break;
        }
      }
      for (const n of ncs as any[]) {
        const blob = `${n.trackingCode || ''} ${n.title || ''} ${n.description || ''} ${n.unitName || ''}`;
        if (matchesToken(blob) > 0) {
          matchedLines.push(`• [عدم انطباق ${n.trackingCode}] عنوان: ${n.title} | واحد: ${n.unitName || '-'} | وضعیت: ${n.status}`);
          if (matchedLines.length >= 12) break;
        }
      }

      // Search Fire Equipment
      for (const f of fireEq as any[]) {
        const blob = `${f.code || ''} ${f.equipmentType || ''} ${f.location || ''} ${f.status || ''}`;
        if (matchesToken(blob) > 0) {
          matchedLines.push(`• [تجهیز آتش‌نشانی ${f.code}] نوع: ${f.equipmentType} | محل: ${f.location} | وضعیت: ${f.status}`);
          if (matchedLines.length >= 12) break;
        }
      }

      // Search Trainings
      for (const t of trainings as any[]) {
        const blob = `${t.courseTitle || ''} ${t.courseCategory || ''} ${t.instructor || ''} ${t.description || ''}`;
        if (matchesToken(blob) > 0) {
          matchedLines.push(`• [دوره آموزشی] عنوان: ${t.courseTitle} | مدت: ${t.durationHours} ساعت | مدرس: ${t.instructor || '-'}`);
          if (matchedLines.length >= 12) break;
        }
      }

      // Search Environment
      for (const e of envLogs as any[]) {
        const blob = `${e.category || ''} ${e.parameterName || ''} ${e.notes || ''} ${e.destination || ''}`;
        if (matchesToken(blob) > 0) {
          matchedLines.push(`• [پایش محیط زیست] پارامتر: ${e.parameterName || e.category} | مقدار: ${e.measuredValue ?? '-'} ${e.unit || ''} | تاریخ: ${e.logDate}`);
          if (matchedLines.length >= 12) break;
        }
      }

      // Search Personnel
      for (const p of personnelList as any[]) {
        const blob = `${p.firstName || ''} ${p.lastName || ''} ${p.personnelCode || ''} ${p.nationalCode || ''} ${p.jobTitle || ''}`;
        if (matchesToken(blob) > 0) {
          matchedLines.push(`• [پرونده پرسنلی] نام: ${p.firstName} ${p.lastName} | کد پرسنلی: ${p.personnelCode} | سمت: ${p.jobTitle || '-'} | وضعیت: ${p.status}`);
          if (matchedLines.length >= 12) break;
        }
      }

      // Search Notifications & Alerts
      for (const n of (notifsList || []) as any[]) {
        const blob = `${n.title || ''} ${n.body || ''} ${n.sourceModule || ''} ${n.priority || ''}`;
        if (matchesToken(blob) > 0) {
          matchedLines.push(`• [اعلان/هشدار] عنوان: ${n.title} | اولویت: ${n.priority || '-'} | مبدأ: ${n.sourceModule || 'سامانه'}`);
          if (matchedLines.length >= 12) break;
        }
      }

      // Search Users & Roles
      for (const u of (usersList || []) as any[]) {
        const blob = `${u.username || ''} ${u.fullName || ''} ${u.email || ''} ${u.role || ''} ${u.personnelNumber || ''}`;
        if (matchesToken(blob) > 0) {
          matchedLines.push(`• [کاربر سامانه] نام: ${u.fullName || u.username} | نقش: ${u.role} | ایمیل: ${u.email}`);
          if (matchedLines.length >= 12) break;
        }
      }

      if (matchedLines.length === 0) return null;

      return {
        toolName: 'universal_search',
        titleFa: 'نتایج جستجوی مستقیم در رکوردهای سامانه HSECORE',
        summary: matchedLines.slice(0, 10).join('\n'),
        data: { matchCount: matchedLines.length, matches: matchedLines.slice(0, 10) },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }
}

export const aiToolsRegistry = new AIToolsRegistry();
