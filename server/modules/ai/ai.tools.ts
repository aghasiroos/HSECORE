/**
 * HSECORE Safe Read-Only Domain Tools for AI Assistant
 * Provides structured, real-time data across ALL HSECORE modules to ground AI responses.
 * Strictly read-only; no raw SQL mutation.
 */

import { db, schema } from '../../core/db.ts';
import { desc, eq, or, ilike, inArray } from 'drizzle-orm';
import { ptwRepository } from '../ptw/ptw.repository.ts';
import { incidentRepository } from '../incidents/incident.repository.ts';
import { weatherService } from '../../weather/service.ts';
import { AIToolResult } from './ai.types.ts';
import { logger } from '../../core/logger.ts';
import { UserContext, checkUserHasPermission, isGlobalAdminUser } from '../../core/middleware/auth.ts';
import { aiModuleRegistry } from './ai.module-registry.ts';

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
  private cachedSettingsMap: { map: Map<string, any>; expiresAt: number } | null = null;
  private inflightSettingsPromise: Promise<Map<string, any>> | null = null;

  private async loadSettingsMap(): Promise<Map<string, any>> {
    const now = Date.now();
    if (this.cachedSettingsMap && now < this.cachedSettingsMap.expiresAt) {
      return this.cachedSettingsMap.map;
    }
    if (this.inflightSettingsPromise) {
      return this.inflightSettingsPromise;
    }

    this.inflightSettingsPromise = (async () => {
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
        this.cachedSettingsMap = { map, expiresAt: Date.now() + 4000 };
      } catch {} finally {
        this.inflightSettingsPromise = null;
      }
      return map;
    })();

    return this.inflightSettingsPromise;
  }

  /** Read the persisted navigation/module metadata used by the system UI. */
  async getPersistedModuleConfigs(): Promise<Record<string, unknown>> {
    const settings = await this.loadSettingsMap();
    return {
      system: settings.get('hse_ui_config_v3'),
      healthEnvironment: settings.get('hse_health_env_ui_config'),
      fireDepartment: settings.get('hse_fire_dept_ui_config'),
      safetyDepartment: settings.get('hse_safety_dept_ui_config'),
    };
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
      const [sqlExams, sqlLabs, audio, spiro, opto, diseases, settingsMap] = await Promise.all([
        db.select().from(schema.periodicMedicalExams).catch(() => []),
        db.select().from(schema.labResults).catch(() => []),
        db.select().from(schema.audiometryRecords).catch(() => []),
        db.select().from(schema.spirometryRecords).catch(() => []),
        db.select().from(schema.optometryRecords).catch(() => []),
        db.select().from(schema.occupationalDiseaseDiagnoses).catch(() => []),
        this.loadSettingsMap(),
      ]);

      const medicalRecords = Array.isArray(settingsMap.get('hse_medical_records_v4')) ? settingsMap.get('hse_medical_records_v4') : [];
      const settingExams = Array.isArray(settingsMap.get('hse_medical_exams_v4')) ? settingsMap.get('hse_medical_exams_v4') : [];
      const occExamsV2 = Array.isArray(settingsMap.get('occ_health_exams_data_v2')) ? settingsMap.get('occ_health_exams_data_v2') : [];
      const nonPeriodicExams = Array.isArray(settingsMap.get('hse_non_periodic_exams_v1')) ? settingsMap.get('hse_non_periodic_exams_v1') : [];
      const structuredLabs = Array.isArray(settingsMap.get('hse_structured_lab_results_v1')) ? settingsMap.get('hse_structured_lab_results_v1') : [];

      const seenExamIds = new Set<string>();
      const allExams: any[] = [];
      for (const item of [...settingExams, ...sqlExams, ...occExamsV2]) {
        if (!item || typeof item !== 'object') continue;
        const key = String(item.id || `${item.employeeCode || item.personnelId || ''}-${item.examYear || ''}-${item.examDate || ''}`);
        if (seenExamIds.has(key)) continue;
        seenExamIds.add(key);
        allExams.push(item);
      }

      const totalExams = allExams.length;
      let fit = 0;
      let conditional = 0;
      let needsSpecialist = 0;
      let unfit = 0;
      let underReview = 0;
      const byYear = new Map<number, number>();
      let visionCount = opto.length;
      let audioCount = audio.length;
      let spiroCount = spiro.length;

      for (const e of allExams) {
        const yr = Number(e.examYear || 0);
        if (yr > 1300) byYear.set(yr, (byYear.get(yr) || 0) + 1);

        const rawStatus = String(e.status || e.fitnessStatus || e.doctorVerdict || e.final_opinion || '').trim().toLowerCase();
        if (rawStatus === 'unfit' || rawStatus.includes('unfit') || rawStatus.includes('عدم صلاحیت') || rawStatus.includes('نامناسب')) {
          unfit++;
        } else if (rawStatus === 'needs_specialist' || rawStatus.includes('specialist') || rawStatus.includes('تخصصی')) {
          needsSpecialist++;
        } else if (rawStatus === 'under_review' || rawStatus === 'pending' || rawStatus.includes('بررسی') || rawStatus.includes('انتظار')) {
          underReview++;
        } else if (
          rawStatus === 'fit_with_limitations' ||
          rawStatus.includes('conditional') ||
          rawStatus.includes('limitation') ||
          rawStatus.includes('مشروط') ||
          rawStatus.includes('محدودیت') ||
          Boolean(e.restrictions)
        ) {
          conditional++;
        } else {
          fit++;
        }

        if (e.findings?.vision) visionCount++;
        if (e.findings?.audiometry) audioCount++;
        if (e.findings?.spirometry) spiroCount++;
      }

      const yearSummary = Array.from(byYear.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([yr, cnt]) => `سال ${yr}: ${cnt} مورد`)
        .join('، ');

      const totalLabs = sqlLabs.length + structuredLabs.length;
      const abnormalLabs = [
        ...sqlLabs.filter((l: any) => l.isAbnormal),
        ...structuredLabs.filter((l: any) => l.status && l.status !== 'normal'),
      ].length;

      return {
        toolName: 'health_medical_summary',
        titleFa: 'ماژول بهداشت حرفه‌ای و معاینات ادواری طب کار',
        summary: [
          `• کل پرونده‌های سلامت پرسنل در ماژول معاینات ادواری: ${medicalRecords.length || totalExams} پرونده پایه | مجموع نوبت‌های معاینه ادواری ثبت‌شده: ${totalExams} نوبت${yearSummary ? ` (${yearSummary})` : ''}`,
          `• وضعیت تناسب شغلی (Fitness for Duty): ${fit} مورد بلامانع (Fit)، ${conditional} مورد مشروط/با محدودیت، ${needsSpecialist} مورد نیازمند ارزیابی تخصصی، ${unfit} مورد نامناسب (Unfit) و ${underReview} مورد در حال بررسی`,
          `• ارزیابی‌های پاراکلینیکی و آزمایشگاهی: ${audioCount} شنوایی‌سنجی (ادیومتری)، ${spiroCount} عملکرد ریه (اسپیرومتری)، ${visionCount} بینایی‌سنجی (اپتومتری)، ${totalLabs} رکورد آزمایشگاهی (${abnormalLabs} مورد خارج از محدوده نرمال)، ${nonPeriodicExams.length} معاینه غیرادواری و ${diseases.length} تشخیص بیماری شغلی`,
        ].join('\n'),
        data: {
          totalMedicalDossiers: medicalRecords.length,
          totalExams,
          fit,
          conditional,
          needsSpecialist,
          unfit,
          underReview,
          byYear: Object.fromEntries(byYear),
          audiometryCount: audioCount,
          spirometryCount: spiroCount,
          optometryCount: visionCount,
          totalLabs,
          abnormalLabs,
          nonPeriodicCount: nonPeriodicExams.length,
          diseasesCount: diseases.length,
        },
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
      const [sqlExams, settingsMap] = await Promise.all([
        db.select().from(schema.periodicMedicalExams).catch(() => []),
        this.loadSettingsMap(),
      ]);
      const settingExams = Array.isArray(settingsMap.get('hse_medical_exams_v4')) ? settingsMap.get('hse_medical_exams_v4') : [];
      const structuredLabs = Array.isArray(settingsMap.get('hse_structured_lab_results_v1')) ? settingsMap.get('hse_structured_lab_results_v1') : [];
      const exams = settingExams.length > 0 ? [...settingExams, ...sqlExams] : sqlExams;

      let normalBmi = 0;
      let overweight = 0;
      let obeseGrade1 = 0;
      let obeseGrade2 = 0;
      let obeseGrade3 = 0;
      let highBloodPressure = 0;
      let highBloodSugar = 0;

      for (const exam of exams) {
        const raw = ((exam as any).rawData || (exam as any).extraData || (exam as any).findings || {}) as Record<string, any>;
        const bmi = Number((exam as any).bmi || raw.bmi || 0);
        if (bmi > 0 && bmi < 25) normalBmi++;
        else if (bmi >= 25 && bmi < 30) overweight++;
        else if (bmi >= 30 && bmi < 35) obeseGrade1++;
        else if (bmi >= 35 && bmi < 40) obeseGrade2++;
        else if (bmi >= 40) obeseGrade3++;

        let sys = Number((exam as any).systolicBp || raw.bloodPressureSystolic || 0);
        let dia = Number((exam as any).diastolicBp || raw.bloodPressureDiastolic || 0);
        if ((!sys || !dia) && typeof raw.bloodPressure === 'string') {
          const bpMatch = raw.bloodPressure.match(/(\d{2,3})\s*[/\\]\s*(\d{2,3})/);
          if (bpMatch) {
            sys = Number(bpMatch[1]);
            dia = Number(bpMatch[2]);
          }
        }
        if (sys >= 140 || dia >= 90) highBloodPressure++;

        const fbs = Number(raw.fbs || 0);
        if (fbs >= 126) highBloodSugar++;
      }

      if (highBloodSugar === 0 && structuredLabs.length > 0) {
        highBloodSugar = structuredLabs.filter((l: any) =>
          String(l.testCode || l.testName || '').toUpperCase().includes('FBS') && Number(l.value || 0) >= 126
        ).length;
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
        titleFa: 'ماژول ارزیابی ریسک (JSA / FMEA / FTA / HHA)',
        summary: [
          `• کل ارزیابی‌های ریسک ثبت‌شده: ${total} مورد (${highRisks} ریسک بالا/بحرانی، ${mediumRisks} ریسک متوسط، ${lowRisks} ریسک پایین/کنترل‌شده)`,
          topHazards.length > 0 ? `• نمونه مخاطرات ثبت‌شده: ${topHazards.join(' | ')}` : '',
        ].filter(Boolean).join('\n'),
        data: {
          totalRisks: total,
          highRisks,
          mediumRisks,
          lowRisks,
          topHazards,
        },
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
   * Tool 22: Hierarchical Module Browser (درخت سلسله‌مراتبی ماژول‌ها و تب‌ها برای دستور /)
   */
  async getModuleHierarchyTree(userContext?: UserContext): Promise<AIToolResult> {
    const treeText = aiModuleRegistry.getHierarchyTreeText(userContext);
    return {
      toolName: 'module_hierarchy_tree',
      titleFa: 'ساختار سلسله‌مراتبی ماژول‌ها و وضعیت هوش مصنوعی (/ )',
      summary: treeText,
      data: {
        totalModules: aiModuleRegistry.getAllModules().length,
        grouped: aiModuleRegistry.getGroupedModules(userContext),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Tool 23: Comprehensive 360° Personnel Dossier (پرونده جامع سلامت، آموزش، پروانه‌ها و اخطارهای پرسنل)
   */
  async getPersonnelComprehensiveDossier(identifier: string, userContext?: UserContext): Promise<AIToolResult> {
    const rawClean = String(identifier || '').trim();
    const cleanId = normalizePersianText(rawClean);

    if (!cleanId) {
      return {
        toolName: 'personnel_dossier',
        titleFa: 'پرونده جامع ۳۶۰ درجه پرسنل',
        summary: 'لطفاً کد پرسنلی، کد ملی یا نام پرسنل مورد نظر را مشخص فرمایید.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }

    const isGlobalAdmin = userContext ? isGlobalAdminUser(userContext) : false;
    const canViewPersonnel =
      isGlobalAdmin ||
      (userContext
        ? checkUserHasPermission(userContext, 'personnel:read') ||
          checkUserHasPermission(userContext, 'health:read') ||
          checkUserHasPermission(userContext, 'reports:read')
        : false);
    const canViewMedical =
      isGlobalAdmin ||
      (userContext
        ? checkUserHasPermission(userContext, 'health:read') ||
          checkUserHasPermission(userContext, 'personnel:read')
        : false);

    if (userContext && !canViewPersonnel) {
      return {
        toolName: 'personnel_dossier',
        titleFa: 'پرونده جامع ۳۶۰ درجه پرسنل',
        summary: '⛔ دسترسی غیرمجاز: شما مجوز مشاهده پرونده‌های پرسنلی (personnel:read) را ندارید.',
        data: { accessDenied: true },
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const [allPersonnel, settingsMap] = await Promise.all([
        db.select().from(schema.personnel).catch(() => []),
        this.loadSettingsMap(),
      ]);

      const medicalRecords: any[] = Array.isArray(settingsMap.get('hse_medical_records_v4'))
        ? settingsMap.get('hse_medical_records_v4')
        : [];
      const settingExams: any[] = Array.isArray(settingsMap.get('hse_medical_exams_v4'))
        ? settingsMap.get('hse_medical_exams_v4')
        : [];
      const structuredLabs: any[] = Array.isArray(settingsMap.get('hse_structured_lab_results_v1'))
        ? settingsMap.get('hse_structured_lab_results_v1')
        : [];
      const nonPeriodicSettingExams: any[] = Array.isArray(settingsMap.get('hse_non_periodic_exams_v1'))
        ? settingsMap.get('hse_non_periodic_exams_v1')
        : [];

      const numericTokens = Array.from(
        new Set(
          Array.from(cleanId.matchAll(/\d{3,12}/g)).map(m => m[0].trim())
        )
      );

      const stripHonorifics = (s: string) =>
        normalizePersianText(s)
          .replace(/\b(اقای|اقا|خانم|مهندس|دکتر|کارشناس|پرسنل|کارگر|استاد)\b/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      const matchesPersonQuery = (pCodeRaw: string, nCodeRaw: string, fullNameRaw: string): boolean => {
        const pCode = normalizePersianText(pCodeRaw);
        const nCode = normalizePersianText(nCodeRaw);
        const cleanName = stripHonorifics(fullNameRaw);
        if (pCode && (pCode === cleanId || numericTokens.includes(pCode))) return true;
        if (nCode && (nCode === cleanId || numericTokens.includes(nCode))) return true;
        if (cleanName.length >= 3 && (cleanId.includes(cleanName) || (cleanId.length >= 3 && cleanName.includes(cleanId)))) {
          return true;
        }
        return false;
      };

      const matchedSql = allPersonnel.filter((p: any) =>
        matchesPersonQuery(
          p.personnelCode || '',
          p.nationalCode || '',
          `${p.firstName || ''} ${p.lastName || ''}`
        )
      );

      const matchedMedRecords = medicalRecords.filter((r: any) =>
        matchesPersonQuery(
          r.employeeCode || '',
          r.nationalCode || '',
          r.fullName || `${r.firstName || ''} ${r.lastName || ''}`
        )
      );

      if (matchedSql.length === 0 && matchedMedRecords.length === 0) {
        return {
          toolName: 'personnel_dossier',
          titleFa: 'پرونده جامع ۳۶۰ درجه پرسنل',
          summary: `❌ هیچ پرونده پرسنلی یا پرونده سلامت با شناسه/مشخصات «${identifier}» در پایگاه داده سامانه یافت نشد.`,
          data: { notFound: true, query: identifier },
          timestamp: new Date().toISOString(),
        };
      }

      const sqlPerson = matchedSql[0] || null;
      const medRecord =
        matchedMedRecords[0] ||
        (sqlPerson
          ? medicalRecords.find((r: any) => {
              const empCode = normalizePersianText(r.employeeCode || '');
              const natCode = normalizePersianText(r.nationalCode || '');
              const pCode = normalizePersianText(sqlPerson.personnelCode || '');
              const nCode = normalizePersianText(sqlPerson.nationalCode || '');
              return (pCode && empCode === pCode) || (nCode && (natCode === nCode || empCode === nCode));
            })
          : null) ||
        null;

      const personId = sqlPerson?.id ?? -1;
      const personnelCode = String(sqlPerson?.personnelCode || medRecord?.employeeCode || '-').trim();
      const nationalCode = String(sqlPerson?.nationalCode || medRecord?.nationalCode || '-').trim();
      const fullName =
        (sqlPerson ? `${sqlPerson.firstName || ''} ${sqlPerson.lastName || ''}`.trim() : '') ||
        medRecord?.fullName ||
        `${medRecord?.firstName || ''} ${medRecord?.lastName || ''}`.trim() ||
        'بدون نام';
      const extra = (sqlPerson?.extraData && typeof sqlPerson.extraData === 'object' ? sqlPerson.extraData : {}) as Record<string, any>;

      // 1. Fetch Related Records in Parallel (avoiding full-table scans on medical sub-tables)
      const [
        companies,
        sites,
        departments,
        units,
        positions,
        sqlExams,
        trainings,
        courses,
        warnings,
        ppes,
        incidents,
        permits,
      ] = await Promise.all([
        db.select().from(schema.orgCompanies).catch(() => []),
        db.select().from(schema.orgSites).catch(() => []),
        db.select().from(schema.orgDepartments).catch(() => []),
        db.select().from(schema.orgUnits).catch(() => []),
        db.select().from(schema.orgPositions).catch(() => []),
        canViewMedical && personId > 0
          ? db.select().from(schema.periodicMedicalExams).where(eq(schema.periodicMedicalExams.personnelId, personId)).catch(() => [])
          : Promise.resolve([]),
        personId > 0
          ? db.select().from(schema.trainingAttendances).where(eq(schema.trainingAttendances.personnelId, personId)).catch(() => [])
          : Promise.resolve([]),
        db.select().from(schema.hseTrainings).catch(() => []),
        personId > 0
          ? db.select().from(schema.safetyWarnings).where(or(
              eq(schema.safetyWarnings.personnelId, personId),
              eq(schema.safetyWarnings.personnelCode, personnelCode)
            )).catch(() => [])
          : Promise.resolve([]),
        personId > 0
          ? db.select().from(schema.ppeIssuances).where(eq(schema.ppeIssuances.personnelId, personId)).catch(() => [])
          : Promise.resolve([]),
        incidentRepository.findAll().catch(() => []),
        ptwRepository.findAll().catch(() => []),
      ]);

      const examIds = sqlExams.map((e: any) => e.id).filter((id: any) => typeof id === 'number');
      const [sqlLabs, sqlAudio, sqlSpiro, sqlOpto] =
        canViewMedical && examIds.length > 0
          ? await Promise.all([
              db.select().from(schema.labResults).where(inArray(schema.labResults.examId, examIds)).catch(() => []),
              db.select().from(schema.audiometryRecords).where(inArray(schema.audiometryRecords.examId, examIds)).catch(() => []),
              db.select().from(schema.spirometryRecords).where(inArray(schema.spirometryRecords.examId, examIds)).catch(() => []),
              db.select().from(schema.optometryRecords).where(inArray(schema.optometryRecords.examId, examIds)).catch(() => []),
            ])
          : [[], [], [], []];

      const company = companies.find((c: any) => c.id === sqlPerson?.companyId)?.name || extra.companyName || '-';
      const site = sites.find((s: any) => s.id === sqlPerson?.siteId)?.name || extra.siteName || '-';
      const department =
        departments.find((d: any) => d.id === sqlPerson?.departmentId)?.name ||
        medRecord?.department ||
        extra.department ||
        extra.workArea ||
        '-';
      const unit = units.find((u: any) => u.id === sqlPerson?.unitId)?.name || extra.unitName || '-';
      const position =
        positions.find((p: any) => p.id === sqlPerson?.positionId)?.title ||
        sqlPerson?.jobTitle ||
        medRecord?.jobTitle ||
        extra.jobTitle ||
        '-';

      const lines: string[] = [];
      lines.push(`📋 **پرونده جامع ۳۶۰ درجه پرسنل:** ${fullName} (کد پرسنلی: ${personnelCode} | کد ملی: ${nationalCode})`);
      lines.push(`───────────────────────────────────────`);

      // 1. Identity & Org Placement
      lines.push(`👤 **۱. مشخصات فردی و ساختار سازمانی:**`);
      lines.push(`  • نام و نام خانوادگی: ${fullName} | نام پدر: ${sqlPerson?.fatherName || extra.fatherName || '-'}`);
      lines.push(`  • کد پرسنلی: ${personnelCode} | کد ملی: ${nationalCode} | جنسیت: ${sqlPerson?.gender === 'FEMALE' ? 'خانم' : 'آقا'} | گروه خونی: ${sqlPerson?.bloodGroup || medRecord?.bloodType || extra.bloodGroup || '-'}`);
      lines.push(`  • تاریخ تولد: ${sqlPerson?.birthDate || medRecord?.birthDate || extra.birthDate || '-'}${medRecord?.age ? ` (${medRecord.age} سال)` : ''} | تحصیلات: ${medRecord?.education || extra.education || '-'}`);
      lines.push(`  • شرکت: ${company} | سایت: ${site} | اداره/امور: ${department} | واحد: ${unit}`);
      lines.push(`  • شغل/سمت سازمانی: ${position} | نوع استخدام: ${sqlPerson?.employmentType || extra.contractType || '-'} | شیفت کاری: ${sqlPerson?.shiftType || extra.shiftPattern || '-'}`);
      lines.push(`  • وضعیت اشتغال: ${(sqlPerson?.status || 'ACTIVE') === 'ACTIVE' ? '🟢 شاغل فعال' : '🔴 غیرفعال/معلق'} | تاریخ استخدام: ${sqlPerson?.hireDate || extra.hireDate || '-'}`);

      // 2. Health & Periodic Medical Exams (merged from both SQL and Periodic Medical Exams module settings)
      lines.push(`\n🩺 **۲. سوابق معاینات سلامت شغلی و طب کار (ماژول معاینات ادواری):**`);
      if (!canViewMedical) {
        lines.push(`  🔒 *اطلاعات پزشکی به دلیل محرمانگی طبق مجوزهای امنیتی RBAC برای نقش شما ماسک شده است.*`);
      } else {
        const normPCode = normalizePersianText(personnelCode);
        const normNCode = normalizePersianText(nationalCode);
        const medRecordId = medRecord?.id ? String(medRecord.id) : '';

        const matchedSettingExams = settingExams.filter((e: any) => {
          const eCode = normalizePersianText(e.employeeCode || '');
          if (medRecordId && String(e.recordId || '') === medRecordId) return true;
          if (normPCode && normPCode !== '-' && eCode === normPCode) return true;
          if (normNCode && normNCode !== '-' && eCode === normNCode) return true;
          return false;
        });

        const matchedNonPeriodic = nonPeriodicSettingExams.filter((e: any) => {
          const eCode = normalizePersianText(e.employeeCode || '');
          const eNat = normalizePersianText(e.nationalCode || '');
          if (medRecordId && String(e.recordId || '') === medRecordId) return true;
          if (normPCode && normPCode !== '-' && eCode === normPCode) return true;
          if (normNCode && normNCode !== '-' && (eCode === normNCode || eNat === normNCode)) return true;
          return false;
        });

        const matchedStructuredLabs = structuredLabs.filter((l: any) => {
          const lCode = normalizePersianText(l.employeeCode || '');
          if (medRecordId && String(l.recordId || '') === medRecordId) return true;
          if (normPCode && normPCode !== '-' && lCode === normPCode) return true;
          if (normNCode && normNCode !== '-' && lCode === normNCode) return true;
          return false;
        });

        const combinedExams: any[] = [...matchedSettingExams];
        for (const se of sqlExams) {
          const exists = combinedExams.some((ce: any) => Number(ce.examYear || 0) === Number(se.examYear || 0));
          if (!exists) combinedExams.push(se);
        }
        combinedExams.sort((a: any, b: any) => Number(b.examYear || 0) - Number(a.examYear || 0));

        if (medRecord?.chronicConditions?.length) {
          const conds = medRecord.chronicConditions
            .map((c: any) => `${c.conditionName} (تشخیص: ${c.diagnosedYear || '-'}, وضعیت: ${c.treatmentStatus || '-'}${c.restrictions ? `، محدودیت: ${c.restrictions}` : ''})`)
            .join(' | ');
          lines.push(`  • سوابق بیماری‌های مزمن و زمینه‌ای: ${conds}`);
        }
        if (medRecord?.riskFactors?.length) {
          const risks = medRecord.riskFactors
            .map((rf: any) => `${rf.hazardType} (شدت: ${rf.intensity}، PPE الزامی: ${rf.ppeRequired})`)
            .join(' | ');
          lines.push(`  • عوامل زیان‌آور شغلی مرتبط با پست: ${risks}`);
        }
        if (medRecord?.notes) {
          lines.push(`  • یادداشت پرونده سلامت: ${medRecord.notes}`);
        }

        const verdictFa: Record<string, string> = {
          fit: '🟢 مناسب کار بدون محدودیت (Fit)',
          FIT: '🟢 مناسب کار بدون محدودیت (Fit)',
          fit_with_limitations: '🟡 مناسب کار با محدودیت / مشروط (Conditional Fit)',
          CONDITIONAL_FIT: '🟡 مناسب کار با محدودیت / مشروط (Conditional Fit)',
          needs_specialist: '🟠 نیازمند ارزیابی تخصصی (Needs Specialist)',
          unfit: '🔴 نامناسب برای شغل فعلی / عدم صلاحیت (Unfit)',
          UNFIT: '🔴 نامناسب برای شغل فعلی / عدم صلاحیت (Unfit)',
          under_review: '⚪ در حال بررسی پزشکی (Under Review)',
          PENDING: '⚪ در انتظار بررسی پزشکی (Pending)',
        };

        if (combinedExams.length === 0) {
          lines.push(`  • هیچ نوبت معاینه ادواری ثبت‌شده‌ای برای این پرسنل یافت نشد.`);
        } else {
          lines.push(`  • تعداد دوره‌های معاینات ادواری ثبت‌شده: ${combinedExams.length} دوره (${combinedExams.map((e: any) => e.examYear || '-').join('، ')})`);
          for (const ex of combinedExams.slice(0, 4)) {
            const findings = (ex.findings || ex.rawData || {}) as Record<string, any>;
            const statusKey = String(ex.status || ex.doctorVerdict || ex.fitnessStatus || '').trim();
            const statusLabel = verdictFa[statusKey] || statusKey || '-';
            const height = findings.heightCm ?? ex.height ?? '-';
            const weight = findings.weightKg ?? ex.weight ?? '-';
            const bmi = findings.bmi ?? ex.bmi ?? '-';
            const bp = findings.bloodPressure || (ex.systolicBp && ex.diastolicBp ? `${ex.systolicBp}/${ex.diastolicBp}` : '-');
            lines.push(`  ─── دوره سال ${ex.examYear || '-'} (تاریخ: ${ex.examDate || '-'} | نوع: ${ex.examType || 'دوره‌ای سالانه'}) ───`);
            lines.push(`    - مرکز طب کار: ${ex.medicalCenter || '-'} | پزشک معاینه‌گر: ${ex.doctor || ex.doctorName || '-'}`);
            lines.push(`    - نظر نهایی طب کار: ${statusLabel}`);
            lines.push(`    - علائم حیاتی و آنتروپومتری: قد ${height} cm | وزن ${weight} kg | شاخص توده بدنی (BMI): ${bmi} | فشار خون: ${bp}`);
            if (findings.vision) lines.push(`    - بینایی‌سنجی (اپتومتری): ${findings.vision}`);
            if (findings.audiometry) lines.push(`    - شنوایی‌سنجی (ادیومتری): ${findings.audiometry}`);
            if (findings.spirometry) lines.push(`    - عملکرد ریه (اسپیرومتری): ${findings.spirometry}`);
            if (findings.ecg) lines.push(`    - نوار قلب (ECG): ${findings.ecg}`);
            if (findings.bloodTests) lines.push(`    - آزمایش‌های خون و بیوشیمی: ${findings.bloodTests}`);
            if (findings.generalConclusion || ex.clinicalNotes) {
              lines.push(`    - جمع‌بندی بالینی پزشک: ${findings.generalConclusion || ex.clinicalNotes}`);
            }
            if (ex.recommendations || ex.restrictions) {
              lines.push(`    - توصیه‌ها و محدودیت‌های پزشکی: ${[ex.recommendations, ex.restrictions].filter(Boolean).join(' | ')}`);
            }
          }
        }

        if (matchedStructuredLabs.length > 0 || sqlLabs.length > 0) {
          const labItems = [
            ...matchedStructuredLabs.map((l: any) => `${l.testName || l.testCode} (${l.examYear || '-'}): ${l.value} ${l.unit || ''}${l.status && l.status !== 'normal' ? ` [⚠️ غیرنرمال: ${l.status}]` : ''}`),
            ...sqlLabs.map((l: any) => `${l.parameterName}: ${l.resultValue} ${l.unit || ''}${l.isAbnormal ? ' [⚠️ غیرنرمال]' : ''}`),
          ];
          lines.push(`  • جزئیات پارامترهای آزمایشگاهی ثبت‌شده (${labItems.length} مورد): ${labItems.slice(0, 12).join(' | ')}`);
        }

        if (sqlAudio.length > 0) {
          const latestAudio = sqlAudio[0];
          lines.push(`  • رکورد ادیومتری جدول تخصصی: گوش راست ${latestAudio.rightEarAvg ?? '-'} dB | گوش چپ ${latestAudio.leftEarAvg ?? '-'} dB (${latestAudio.interpretation || '-'})`);
        }
        if (sqlSpiro.length > 0) {
          const latestSpiro = sqlSpiro[0];
          lines.push(`  • رکورد اسپیرومتری جدول تخصصی: FVC=${latestSpiro.fvc ?? '-'}% | FEV1=${latestSpiro.fev1 ?? '-'}% | FEV1/FVC=${latestSpiro.fev1FvcRatio ?? '-'}% (${latestSpiro.pattern || '-'})`);
        }
        if (sqlOpto.length > 0) {
          const latestOpto = sqlOpto[0];
          lines.push(`  • رکورد اپتومتری جدول تخصصی: دید راست ${latestOpto.rightEyeAcuity || '-'} | دید چپ ${latestOpto.leftEyeAcuity || '-'} | دید رنگ: ${latestOpto.colorVision || '-'}`);
        }
        if (matchedNonPeriodic.length > 0) {
          lines.push(`  • معاینات غیر دوره‌ای / بازگشت به کار: ${matchedNonPeriodic.length} نوبت (${matchedNonPeriodic.map((n: any) => `${n.examDate}: ${n.reason} - ${n.status}`).join(' | ')})`);
        }
      }

      // 3. HSE Training & Competency
      lines.push(`\n🎓 **۳. سوابق آموزش و گواهینامه‌های HSE:**`);
      if (trainings.length === 0) {
        lines.push(`  • هیچ رکورد آموزشی برای این پرسنل ثبت نشده است.`);
      } else {
        lines.push(`  • مجموع دوره‌های گذرانده‌شده: ${trainings.length} دوره`);
        for (const tr of trainings.slice(0, 5)) {
          const course = courses.find((c: any) => c.id === tr.trainingId);
          lines.push(`    - ${course?.courseTitle || 'دوره ایمنی'}: ${tr.passed ? '✓ قبولی' : '✗ مردود'} (تاریخ: ${tr.sessionDate || '-'}, گواهینامه: ${tr.certificateNumber || '-'})`);
        }
      }

      // 4. PTW Involvement
      const involvedPermits = permits.filter((p: any) =>
        (personId > 0 && (p.issuerId === personId || p.acceptorId === personId)) ||
        (p.contractorName && p.contractorName.includes(fullName))
      );
      lines.push(`\n📜 **۴. پروانه‌های کار ایمن (PTW) مرتبط:**`);
      if (involvedPermits.length === 0) {
        lines.push(`  • پروانه کار فعالی به عنوان صادرکننده یا تحویل‌گیرنده برای ایشان ثبت نشده است.`);
      } else {
        lines.push(`  • تعداد پروانه‌های کار مرتبط: ${involvedPermits.length} فقره`);
        for (const pt of involvedPermits.slice(0, 4)) {
          lines.push(`    - پروانه ${pt.permitNumber || pt.id}: ${pt.title || pt.permitType} (محل: ${pt.location || '-'}, وضعیت: ${pt.status || '-'})`);
        }
      }

      // 5. Safety Incidents & Near Misses
      const personIncidents = incidents.filter((inc: any) =>
        (personId > 0 && inc.involvedPersonnelId === personId) ||
        (inc.personnelName && normalizePersianText(inc.personnelName).includes(normalizePersianText(fullName)))
      );
      lines.push(`\n⚠️ **۵. سوابق حوادث و شبه‌حوادث شغلی:**`);
      if (personIncidents.length === 0) {
        lines.push(`  • ✅ سابقه حادثه یا شبه‌حادثه ثبت‌شده‌ای ندارد (حادثه صفر).`);
      } else {
        lines.push(`  • تعداد رویدادهای ثبت‌شده: ${personIncidents.length} مورد`);
        for (const inc of personIncidents.slice(0, 4)) {
          lines.push(`    - رویداد ${inc.incidentNumber || inc.id}: ${inc.incidentType || 'حادثه'} در ${inc.location || '-'} (تاریخ: ${inc.incidentDate || '-'}, وضعیت: ${inc.status || '-'})`);
        }
      }

      // 6. Safety Warnings & Compliance
      lines.push(`\n🛑 **۶. اخطارها و انضباط ایمنی:**`);
      if (warnings.length === 0) {
        lines.push(`  • ✅ هیچ اخطار کتبی یا تخلف ایمنی برای ایشان ثبت نشده است.`);
      } else {
        lines.push(`  • تعداد اخطارهای ثبت‌شده: ${warnings.length} مورد`);
        for (const w of warnings.slice(0, 4)) {
          lines.push(`    - اخطار سطح ${w.warningLevel || '-'}: ${w.reason || w.category} (تاریخ: ${w.warningDate || '-'}, صادرکننده: ${w.issuedBy || '-'})`);
        }
      }

      // 7. PPE Delivery History
      lines.push(`\n🦺 **۷. سوابق تحویل تجهیزات حفاظت فردی (PPE):**`);
      if (ppes.length === 0) {
        lines.push(`  • رکوردی از تحویل تجهیزات حفاظت فردی در سیستم ثبت نشده است.`);
      } else {
        lines.push(`  • تعداد اقلام تحویلی: ${ppes.length} قلم`);
        for (const item of ppes.slice(0, 5)) {
          lines.push(`    - ${item.itemName} (${item.itemCategory}) - تعداد: ${item.quantity || 1} عدد (تاریخ تحویل: ${item.issueDate || '-'})`);
        }
      }

      return {
        toolName: 'personnel_dossier',
        titleFa: `پرونده جامع ۳۶۰ درجه پرسنل (${fullName})`,
        summary: lines.join('\n'),
        data: {
          personnelId: personId,
          personnelCode,
          nationalCode,
          fullName,
          company,
          department,
          unit,
          position,
          totalTrainings: trainings.length,
          totalPermits: involvedPermits.length,
          totalIncidents: personIncidents.length,
          totalWarnings: warnings.length,
          totalPPEs: ppes.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      logger.error('[AITools] getPersonnelComprehensiveDossier failed', err);
      return {
        toolName: 'personnel_dossier',
        titleFa: 'پرونده جامع ۳۶۰ درجه پرسنل',
        summary: `خطا در دریافت پرونده پرسنلی: ${err?.message || 'خطای ناشناخته سرور'}`,
        data: { error: String(err?.message || err) },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 21: Process Safety Management (PSM / RBPS CCPS & OSHA 1910.119) Summary
   */
  async getPsmSummary(): Promise<AIToolResult> {
    try {
      const [projects, assessments, gaps, capaItems, studies, stageGates] = await Promise.all([
        db.select().from(schema.psmProjects).catch(() => []),
        db.select().from(schema.psmAssessments).catch(() => []),
        db.select().from(schema.psmGaps).catch(() => []),
        db.select().from(schema.psmCapaItems).catch(() => []),
        db.select().from(schema.psmSpecializedStudies).catch(() => []),
        db.select().from(schema.psmStageGates).catch(() => []),
      ]);

      const activeProjects = projects.filter((p: any) => !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(String(p.status || '').toUpperCase())).length;
      const openGaps = gaps.filter((g: any) => !['CLOSED', 'RESOLVED', 'VERIFIED'].includes(String(g.status || '').toUpperCase())).length;
      const openCapa = capaItems.filter((c: any) => !['CLOSED', 'VERIFIED', 'EFFECTIVE'].includes(String(c.stage || c.status || '').toUpperCase())).length;
      const approvedGates = stageGates.filter((g: any) => String(g.status || '').toUpperCase() === 'APPROVED').length;
      const recentProjects = projects.slice(0, 4).map((p: any) => `${p.projectCode || p.id}: ${p.title} (وضعیت: ${p.status || 'در جریان'})`);

      return {
        toolName: 'psm_summary',
        titleFa: 'ماژول مدیریت ایمنی فرآیند (PSM - CCPS 20 / OSHA 1910.119)',
        summary: [
          `• کل پروژه‌های استقرار PSM: ${projects.length} پروژه (${activeProjects} پروژه فعال)`,
          `• ارزیابی‌های انطباق و شکاف (Gap Analysis): ${assessments.length} ارزیابی | شکاف‌های شناسایی‌شده: ${gaps.length} مورد (${openGaps} شکاف باز)`,
          `• اقدامات اصلاحی و پیشگیرانه PSM (CAPA): ${capaItems.length} مورد (${openCapa} در جریان اجرا/راستی‌آزمایی)`,
          `• مطالعات تخصصی ایمنی فرآیند (PHA/HAZOP/LOPA/MOC/PSSR/MI/bowtie): ${studies.length} مطالعه | دروازه‌های مرحله‌ای (Stage-Gate): ${stageGates.length} دروازه (${approvedGates} تاییدشده)`,
          recentProjects.length > 0 ? `• آخرین پروژه‌های PSM: ${recentProjects.join(' | ')}` : '',
        ].filter(Boolean).join('\n'),
        data: {
          totalProjects: projects.length,
          activeProjects,
          totalAssessments: assessments.length,
          totalGaps: gaps.length,
          openGaps,
          totalCapa: capaItems.length,
          openCapa,
          totalStudies: studies.length,
          totalStageGates: stageGates.length,
          approvedGates,
        },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        toolName: 'psm_summary',
        titleFa: 'ماژول مدیریت ایمنی فرآیند (PSM)',
        summary: 'اطلاعات مدیریت ایمنی فرآیند (PSM) در دسترس نیست.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tool 24: Comprehensive Multi-Module Cross Analysis (تحلیل یکپارچه و مقطعی تمام ماژول‌های سامانه برای دستور /ALL)
   */
  async getAllModulesCrossAnalysis(userContext?: UserContext): Promise<AIToolResult> {
    const isGlobalAdmin = userContext ? isGlobalAdminUser(userContext) : false;
    const canHealth = isGlobalAdmin || (userContext ? checkUserHasPermission(userContext, 'health:read') : false);
    const canPermit = isGlobalAdmin || (userContext ? checkUserHasPermission(userContext, 'ptw:read') : false);
    const canIncident = isGlobalAdmin || (userContext ? checkUserHasPermission(userContext, 'incidents:read') : false);
    const canSafety = isGlobalAdmin || (userContext ? checkUserHasPermission(userContext, 'safety:read') : false);
    const canFire = isGlobalAdmin || (userContext ? checkUserHasPermission(userContext, 'fire:read') : false);
    const canTraining = isGlobalAdmin || (userContext ? checkUserHasPermission(userContext, 'training:read') : false);
    const canPPE = isGlobalAdmin || (userContext ? checkUserHasPermission(userContext, 'ppe:read') : false);
    const canEnv = isGlobalAdmin || (userContext ? checkUserHasPermission(userContext, 'environment:read') : false);
    const canPersonnel = isGlobalAdmin || (userContext ? checkUserHasPermission(userContext, 'personnel:read') : false);
    const canWorkflow = isGlobalAdmin || (userContext ? checkUserHasPermission(userContext, 'workflows:read') : false);
    const canReport = isGlobalAdmin || (userContext ? checkUserHasPermission(userContext, 'reports:read') : false);

    const tasks: Array<Promise<{ name: string; res: AIToolResult | null }>> = [
      this.getHeatStressAndWeatherSummary().then(r => ({ name: 'استرس گرمایی و هواشناسی (WBGT)', res: r })),
      canPermit ? this.getPTWSummary().then(r => ({ name: 'پروانه‌های کار (PTW)', res: r })) : Promise.resolve({ name: 'پروانه‌های کار (PTW)', res: null }),
      canIncident ? this.getIncidentSummary().then(r => ({ name: 'حوادث و شبه‌حوادث (Incidents)', res: r })) : Promise.resolve({ name: 'حوادث و شبه‌حوادث (Incidents)', res: null }),
      canHealth ? this.getHealthAndExamsSummary().then(r => ({ name: 'معاینات بهداشت حرفه‌ای و طب کار', res: r })) : Promise.resolve({ name: 'معاینات بهداشت حرفه‌ای و طب کار', res: null }),
      canHealth ? this.getNutritionHighRiskSummary().then(r => ({ name: 'پایش تغذیه و بیماران پرخطر', res: r })) : Promise.resolve({ name: 'پایش تغذیه و بیماران پرخطر', res: null }),
      canSafety ? this.getRiskAssessmentsSummary().then(r => ({ name: 'ارزیابی ریسک و مخاطرات (JSA)', res: r })) : Promise.resolve({ name: 'ارزیابی ریسک و مخاطرات (JSA)', res: null }),
      canSafety ? this.getPsmSummary().then(r => ({ name: 'مدیریت ایمنی فرآیند (PSM)', res: r })) : Promise.resolve({ name: 'مدیریت ایمنی فرآیند (PSM)', res: null }),
      canSafety ? this.get5SAndInspectionsSummary().then(r => ({ name: 'نظام آراستگی ۵S و بازرسی‌ها', res: r })) : Promise.resolve({ name: 'نظام آراستگی ۵S و بازرسی‌ها', res: null }),
      canFire ? this.getFireSafetySummary().then(r => ({ name: 'آتش‌نشانی و تجهیزات اطفاء حریق', res: r })) : Promise.resolve({ name: 'آتش‌نشانی و تجهیزات اطفاء حریق', res: null }),
      canSafety ? this.getWarningsAndAnomaliesSummary().then(r => ({ name: 'اخطارهای ایمنی و عدم انطباق‌ها', res: r })) : Promise.resolve({ name: 'اخطارهای ایمنی و عدم انطباق‌ها', res: null }),
      canTraining ? this.getTrainingSummary().then(r => ({ name: 'آموزش‌های ایمنی و شایستگی', res: r })) : Promise.resolve({ name: 'آموزش‌های ایمنی و شایستگی', res: null }),
      canPPE ? this.getPPESummary().then(r => ({ name: 'تجهیزات حفاظت فردی (PPE)', res: r })) : Promise.resolve({ name: 'تجهیزات حفاظت فردی (PPE)', res: null }),
      canEnv ? this.getEnvironmentSummary().then(r => ({ name: 'پایش محیط زیست و پسماند', res: r })) : Promise.resolve({ name: 'پایش محیط زیست و پسماند', res: null }),
      canPersonnel ? this.getPersonnelAndOrgSummary().then(r => ({ name: 'پرسنل و ساختار سازمانی', res: r })) : Promise.resolve({ name: 'پرسنل و ساختار سازمانی', res: null }),
      canWorkflow ? this.getWorkflowAndReferralsSummary().then(r => ({ name: 'کارتابل اسناد و فرآیندهای BPMN', res: r })) : Promise.resolve({ name: 'کارتابل اسناد و فرآیندهای BPMN', res: null }),
      canReport ? this.getManagementKPISummary().then(r => ({ name: 'شاخص‌های کلیدی عملکرد و TRIR', res: r })) : Promise.resolve({ name: 'شاخص‌های کلیدی عملکرد و TRIR', res: null }),
      canSafety ? this.getNonConformancesSummary().then(r => ({ name: 'عدم انطباق‌های ISO 45001 / 14001', res: r })) : Promise.resolve({ name: 'عدم انطباق‌های ISO 45001 / 14001', res: null }),
      this.getNotificationsAndAlertsSummary().then(r => ({ name: 'اعلان‌ها و هشدارهای بلادرنگ', res: r })),
    ];

    const results = await Promise.all(tasks);
    const summarySections: string[] = [];

    summarySections.push(`🌐 **گزارش جامع و تحلیل یکپارچه مقطعی کلیه ماژول‌های سامانه HSECORE (/ALL)**`);
    summarySections.push(`🕒 زمان تحلیل داده‌ها: ${new Date().toLocaleTimeString('fa-IR')} - تاریخ: ${new Date().toLocaleDateString('fa-IR')}\n`);

    let activeCount = 0;
    let restrictedCount = 0;

    for (const item of results) {
      if (item.res) {
        activeCount++;
        summarySections.push(`📌 **${item.name}:**\n${item.res.summary}\n`);
      } else {
        restrictedCount++;
        summarySections.push(`🔒 **${item.name}:** *به دلیل محدودیت مجوزهای RBAC برای نقش شما در دسترس نیست.*\n`);
      }
    }

    summarySections.push(`───────────────────────────────────────`);
    summarySections.push(`📊 **نتیجه پوشش تحلیلی:** ${activeCount} ماژول فعال و پردازش‌شده ${restrictedCount > 0 ? `| ${restrictedCount} ماژول تحت محافظت RBAC` : ''}`);

    return {
      toolName: 'all_modules_cross_analysis',
      titleFa: 'تحلیل مقطعی و یکپارچه تمامی ماژول‌های سامانه (/ALL)',
      summary: summarySections.join('\n'),
      data: {
        totalModulesQueried: results.length,
        activeModulesCount: activeCount,
        restrictedCount,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export const aiToolsRegistry = new AIToolsRegistry();
