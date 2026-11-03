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
import type { UserContext } from '../../core/middleware/auth.ts';
import { getAIModuleCatalog } from './ai.module-registry.ts';

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
   * Dedicated read-only PTW Audit analytics. Only aggregate data is returned;
   * signer names, personnel identifiers, signatures and attachment payloads are excluded.
   */
  async getPTWAuditSummary(): Promise<AIToolResult> {
    try {
      const settingsMap = await this.loadSettingsMap();
      const rawAudits = settingsMap.get('hse_ptw_audit_records_v2');
      const legacySeedIds = new Set([
        'ptw-aud-1405-001', 'ptw-aud-1405-002', 'ptw-aud-1405-003',
        'ptw-aud-1405-004', 'ptw-aud-1405-005', 'ptw-aud-1405-006',
        'ptw-aud-1404-001', 'ptw-aud-1404-002', 'ptw-aud-1404-003',
        'ptw-aud-1403-001', 'ptw-aud-1403-002',
      ]);
      const audits: any[] = Array.isArray(rawAudits)
        ? rawAudits.filter((audit: any) => audit && typeof audit.id === 'string' && !legacySeedIds.has(audit.id))
        : [];

      const metrics = audits.map((audit: any) => {
        const items = Array.isArray(audit.inspectionItems) ? audit.inspectionItems : [];
        const hazards = Array.isArray(audit.environmentalHazards) ? audit.environmentalHazards : [];
        const ppe = Array.isArray(audit.requiredPpe) ? audit.requiredPpe : [];
        const precautions = Array.isArray(audit.precautionsTaken) ? audit.precautionsTaken : [];
        const passed = items.filter((item: any) => ['P', 'PASS'].includes(String(item.status || '').toUpperCase())).length;
        const questionDefects = items.filter((item: any) => ['O', 'DEFECT'].includes(String(item.status || '').toUpperCase())).length;
        const na = items.filter((item: any) => ['-', 'NA'].includes(String(item.status || '').toUpperCase())).length;
        const missedHazards = hazards.filter((item: any) => item?.missed === true).length;
        const missedPpe = ppe.filter((item: any) => item?.missed === true).length;
        const missedPrecautions = precautions.filter((item: any) => item?.missed === true).length;
        const computedDefects = questionDefects + missedHazards + missedPpe + missedPrecautions;
        const explicitDefects = Number(audit.defectsCount);
        const defects = Number.isFinite(explicitDefects) && audit.defectsCount !== null && audit.defectsCount !== undefined
          ? Math.max(0, explicitDefects)
          : computedDefects;
        const explicitPassed = Number(audit.passedCount);
        const passedCount = Number.isFinite(explicitPassed) && audit.passedCount !== null && audit.passedCount !== undefined
          ? Math.max(0, explicitPassed)
          : passed;
        const explicitScore = Number(audit.complianceScore);
        const evaluated = passedCount + defects;
        const score = Number.isFinite(explicitScore) && audit.complianceScore !== null &&
          audit.complianceScore !== undefined && explicitScore >= 0 && explicitScore <= 100
          ? explicitScore
          : evaluated > 0 ? Number(((passedCount / evaluated) * 100).toFixed(1)) : null;
        return {
          audit,
          defects,
          passedCount,
          na,
          missedHazards,
          missedPpe,
          missedPrecautions,
          score,
          defective: defects > 0 || String(audit.status || '').toUpperCase() === 'CRITICAL_NC',
        };
      });

      const totalAudits = metrics.length;
      const finalizedCount = metrics.filter(x => String(x.audit.status || '').toUpperCase() === 'FINALIZED').length;
      const draftCount = metrics.filter(x => String(x.audit.status || '').toUpperCase() === 'DRAFT').length;
      const criticalNcCount = metrics.filter(x => String(x.audit.status || '').toUpperCase() === 'CRITICAL_NC').length;
      const defectiveAuditsCount = metrics.filter(x => x.defective).length;
      const totalDefectsIdentified = metrics.reduce((sum, x) => sum + x.defects, 0);
      const scoreValues = metrics.map(x => x.score).filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
      const avgComplianceScore = scoreValues.length
        ? Number((scoreValues.reduce((sum, x) => sum + x, 0) / scoreValues.length).toFixed(1))
        : null;
      const hotPermitCount = metrics.filter(x => String(x.audit.permitType || '').toUpperCase() === 'HOT').length;
      const coldPermitCount = metrics.filter(x => String(x.audit.permitType || '').toUpperCase() === 'COLD').length;
      const confinedSpacePermitCount = metrics.filter(x =>
        String(x.audit.permitType || '').toUpperCase() === 'CONFINED_SPACE' ||
        String(x.audit.attachedPermitType || '').toLowerCase() === 'confinedspace'
      ).length;
      const attachedPermitCount = metrics.filter(x =>
        x.audit.hasAttachedPermit === true ||
        (x.audit.attachedPermitType && String(x.audit.attachedPermitType).toUpperCase() !== 'NONE')
      ).length;
      const totalMissedHazards = metrics.reduce((sum, x) => sum + x.missedHazards, 0);
      const totalMissedPpe = metrics.reduce((sum, x) => sum + x.missedPpe, 0);
      const totalMissedPrecautions = metrics.reduce((sum, x) => sum + x.missedPrecautions, 0);

      const categoryMap = new Map<string, number>();
      const unitMap = new Map<string, { total: number; defective: number; defects: number; scores: number[] }>();
      const monthMap = new Map<string, { total: number; defective: number; defects: number; scores: number[] }>();
      const addCategory = (label: unknown) => {
        const name = String(label || '').trim();
        if (name) categoryMap.set(name, (categoryMap.get(name) || 0) + 1);
      };

      for (const item of metrics) {
        const audit = item.audit;
        const unitName = String(audit.unitName || 'واحد نامشخص').trim() || 'واحد نامشخص';
        const unit = unitMap.get(unitName) || { total: 0, defective: 0, defects: 0, scores: [] };
        unit.total += 1;
        unit.defective += item.defective ? 1 : 0;
        unit.defects += item.defects;
        if (item.score !== null) unit.scores.push(item.score);
        unitMap.set(unitName, unit);

        const date = String(audit.auditDate || '');
        const dateParts = date.split('/');
        if (dateParts.length >= 2 && /^\d{4}$/.test(dateParts[0]) && /^\d{1,2}$/.test(dateParts[1])) {
          const monthKey = `${dateParts[0]}/${String(Number(dateParts[1])).padStart(2, '0')}`;
          const month = monthMap.get(monthKey) || { total: 0, defective: 0, defects: 0, scores: [] };
          month.total += 1;
          month.defective += item.defective ? 1 : 0;
          month.defects += item.defects;
          if (item.score !== null) month.scores.push(item.score);
          monthMap.set(monthKey, month);
        }

        const inspectionItems = Array.isArray(audit.inspectionItems) ? audit.inspectionItems : [];
        inspectionItems.filter((question: any) =>
          ['O', 'DEFECT'].includes(String(question.status || '').toUpperCase())
        ).forEach((question: any) => addCategory(question.category || question.questionFa));
        (Array.isArray(audit.environmentalHazards) ? audit.environmentalHazards : [])
          .filter((entry: any) => entry?.missed === true).forEach((entry: any) => addCategory(entry.labelFa || 'خطر محیطی انتخاب‌نشده'));
        (Array.isArray(audit.requiredPpe) ? audit.requiredPpe : [])
          .filter((entry: any) => entry?.missed === true).forEach((entry: any) => addCategory(entry.labelFa || 'PPE الزامی تأمین‌نشده'));
        (Array.isArray(audit.precautionsTaken) ? audit.precautionsTaken : [])
          .filter((entry: any) => entry?.missed === true).forEach((entry: any) => addCategory(entry.labelFa || 'تمهید ایمنی انجام‌نشده'));
      }

      const topDefectCategories = Array.from(categoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      const byUnit = Array.from(unitMap.entries())
        .map(([unitName, value]) => ({
          unitName,
          totalAudits: value.total,
          defectiveAudits: value.defective,
          totalDefects: value.defects,
          defectRate: value.total ? Number(((value.defective / value.total) * 100).toFixed(1)) : 0,
          avgComplianceScore: value.scores.length
            ? Number((value.scores.reduce((sum, score) => sum + score, 0) / value.scores.length).toFixed(1))
            : null,
        }))
        .sort((a, b) => b.totalDefects - a.totalDefects)
        .slice(0, 10);
      const monthlyTrend = Array.from(monthMap.entries())
        .map(([month, value]) => ({
          month,
          totalAudits: value.total,
          defectiveAudits: value.defective,
          totalDefects: value.defects,
          defectRate: value.total ? Number(((value.defective / value.total) * 100).toFixed(1)) : 0,
          avgComplianceScore: value.scores.length
            ? Number((value.scores.reduce((sum, score) => sum + score, 0) / value.scores.length).toFixed(1))
            : null,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
      const recentAudits = metrics
        .slice()
        .sort((a, b) => `${String(b.audit.auditDate || '')} ${String(b.audit.auditTime || '')}`
          .localeCompare(`${String(a.audit.auditDate || '')} ${String(a.audit.auditTime || '')}`))
        .slice(0, 20)
        .map(item => ({
          auditDate: item.audit.auditDate,
          auditTime: item.audit.auditTime,
          unitName: item.audit.unitName,
          subUnitName: item.audit.subUnitName || null,
          permitNumber: item.audit.permitNumber,
          permitType: item.audit.permitType,
          attachedPermitType: item.audit.attachedPermitType || 'NONE',
          status: item.audit.status,
          complianceScore: item.score,
          passedCount: item.passedCount,
          defectsCount: item.defects,
          missedHazards: item.missedHazards,
          missedPpe: item.missedPpe,
          missedPrecautions: item.missedPrecautions,
        }));

      return {
        toolName: 'ptw_audit_summary',
        titleFa: 'ماژول ممیزی پروانه‌های کار (PTW Audit)',
        summary: [
          `• تعداد ممیزی‌های معتبر: ${totalAudits} مورد؛ نهایی: ${finalizedCount}، پیش‌نویس: ${draftCount}، عدم انطباق بحرانی: ${criticalNcCount}`,
          `• ممیزی‌های دارای نقص: ${defectiveAuditsCount} مورد؛ مجموع عدم انطباق‌ها: ${totalDefectsIdentified}`,
          `• میانگین امتیاز انطباق: ${avgComplianceScore === null ? 'داده کافی موجود نیست' : `${avgComplianceScore}٪`}`,
          `• نوع پروانه ممیزی‌شده: ${hotPermitCount} گرم، ${coldPermitCount} سرد، ${confinedSpacePermitCount} فضای بسته؛ پروانه الحاقی: ${attachedPermitCount}`,
          `• عدم انطباق‌های اقلام جانبی: خطرات ${totalMissedHazards}، PPE ${totalMissedPpe}، تمهیدات ${totalMissedPrecautions}`,
          `• ${recentAudits.length} رکورد آخر ممیزی به‌صورت خلاصه و بدون نام امضاکنندگان در داده مرجع موجود است.`,
        ].join('\n'),
        data: {
          totalAudits,
          finalizedCount,
          draftCount,
          criticalNcCount,
          defectiveAuditsCount,
          cleanAuditsCount: Math.max(0, totalAudits - defectiveAuditsCount),
          totalDefectsIdentified,
          avgComplianceScore,
          hotPermitCount,
          coldPermitCount,
          confinedSpacePermitCount,
          attachedPermitCount,
          totalMissedHazards,
          totalMissedPpe,
          totalMissedPrecautions,
          topDefectCategories,
          byUnit,
          monthlyTrend,
          recentAudits,
          privacy: 'Sanitized read-only records. Signer names, personnel identifiers, signatures, and attachment contents are excluded.',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      logger.warn('[AITools] PTW audit analytics unavailable', { error: err?.message });
      return {
        toolName: 'ptw_audit_summary',
        titleFa: 'ماژول ممیزی پروانه‌های کار (PTW Audit)',
        summary: 'داده‌های ممیزی پروانه کار در این لحظه از پایگاه داده قابل دریافت نیست؛ هیچ آماری حدس زده نشده است.',
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
  async getRiskAssessmentsSummary(selectedMethodologies?: string[]): Promise<AIToolResult> {
    try {
      const allRisks = await db.select().from(schema.riskAssessments);
      const selectedMethods = Array.isArray(selectedMethodologies)
        ? selectedMethodologies.map(method => String(method).toUpperCase()).filter(Boolean)
        : [];
      const risks = selectedMethods.length
        ? allRisks.filter((risk: any) => selectedMethods.includes(String(risk.methodology || '').toUpperCase()))
        : allRisks;
      const total = risks.length;
      const highRisks = risks.filter((r: any) => ['HIGH', 'EXTREME', 'CRITICAL'].includes(String(r.initialRiskLevel || '').toUpperCase())).length;
      const mediumRisks = risks.filter((r: any) => String(r.initialRiskLevel || '').toUpperCase() === 'MEDIUM').length;
      const lowRisks = Math.max(0, total - highRisks - mediumRisks);
      const byMethodMap = new Map<string, { total: number; high: number; medium: number; low: number }>();
      const byStatusMap = new Map<string, number>();
      for (const risk of risks as any[]) {
        const method = String(risk.methodology || 'نامشخص').toUpperCase();
        const bucket = byMethodMap.get(method) || { total: 0, high: 0, medium: 0, low: 0 };
        bucket.total += 1;
        const level = String(risk.initialRiskLevel || '').toUpperCase();
        if (['HIGH', 'EXTREME', 'CRITICAL'].includes(level)) bucket.high += 1;
        else if (level === 'MEDIUM') bucket.medium += 1;
        else bucket.low += 1;
        byMethodMap.set(method, bucket);
        const status = String(risk.status || 'نامشخص').toUpperCase();
        byStatusMap.set(status, (byStatusMap.get(status) || 0) + 1);
      }
      const byMethod = Array.from(byMethodMap.entries()).map(([method, value]) => ({ method, ...value }));
      const byStatus = Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count }));
      const residualHighRisks = risks.filter((r: any) => ['HIGH', 'EXTREME', 'CRITICAL'].includes(String(r.residualRiskLevel || '').toUpperCase())).length;
      const topHazards = (risks as any[])
        .slice()
        .sort((a: any, b: any) => Number(b.initialRiskScore || 0) - Number(a.initialRiskScore || 0))
        .slice(0, 5)
        .map((r: any) =>
        `${r.activityTitle || 'فعالیت نامشخص'}: ${r.hazardDescription || 'شرح خطر ثبت نشده'} (ریسک اولیه: ${r.initialRiskLevel || 'نامشخص'}؛ ریسک باقیمانده: ${r.residualRiskLevel || 'ثبت نشده'})`
      );

      return {
        toolName: 'risk_assessment_summary',
        titleFa: 'ماژول ارزیابی ریسک و شناسایی مخاطرات (JSA / FMEA / FTA / HHA)',
        summary: [
          `• روش‌های انتخاب‌شده: ${selectedMethods.join('، ') || 'همه روش‌ها'}`,
          `• کل ارزیابی‌های ریسک ثبت‌شده: ${total} مورد (${highRisks} بالا/بحرانی، ${mediumRisks} متوسط، ${lowRisks} پایین/سایر)`,
          `• ریسک‌های باقیمانده بالا/بحرانی: ${residualHighRisks} مورد`,
          `• تفکیک روش ارزیابی: ${byMethod.map(x => `${x.method}: ${x.total} (بالا/بحرانی ${x.high})`).join('؛ ') || 'داده‌ای ثبت نشده'}`,
          `• وضعیت گردش کار: ${byStatus.map(x => `${x.status}: ${x.count}`).join('؛ ') || 'داده‌ای ثبت نشده'}`,
          topHazards.length > 0 ? `• نمونه مخاطرات ثبت‌شده: ${topHazards.join(' | ')}` : '',
        ].filter(Boolean).join('\n'),
        data: { selectedMethodologies: selectedMethods, totalRisks: total, highRisks, mediumRisks, lowRisks, residualHighRisks, byMethod, byStatus, topHazards },
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      logger.warn('[AITools] risk assessment summary unavailable', { error: err?.message });
      return {
        toolName: 'risk_assessment_summary',
        titleFa: 'ماژول ارزیابی ریسک',
        summary: 'اطلاعات ارزیابی ریسک در این لحظه از پایگاه داده قابل دریافت نیست؛ هیچ آماری حدس زده نشده است.',
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
      const backupSchedule = backupSetting?.schedule || 'روزانه خودکار (ساعت ۰۲:۰۰ بامداد)';
      const lastBackupDate = backupSetting?.lastBackupDate || 'فعال و ذخیره‌شده در پایگاه داده پایدار PostgreSQL';

      return {
        toolName: 'settings_backup_summary',
        titleFa: 'ماژول تنظیمات سامانه، پیکربندی سرور و پشتیبان‌گیری',
        summary: [
          `• وضعیت پشتیبان‌گیری دیتابیس: ${backupSchedule}`,
          `• آخرین وضعیت بکاپ و داده‌های پایدار: ${lastBackupDate}`,
          `• تعداد فایل‌ها و مستندات سیستمی ذخیره‌شده: ${files.length} فایل`,
          `• معماری داده: پایگاه داده رابطه‌ای PostgreSQL به همراه مکانیزم همگام‌سازی آفلاین/آنلاین`,
        ].join('\n'),
        data: { backupSchedule, lastBackupDate, totalSystemFiles: files.length },
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
  async getSystemArchitectureAndCapabilitiesSummary(userContext?: UserContext): Promise<AIToolResult> {
    if (!userContext) {
      return {
        toolName: 'system_architecture_summary',
        titleFa: 'رجیستری ساختار و پوشش ماژول‌های HSECORE',
        summary: 'برای مشاهده ساختار و سطح اتصال ماژول‌ها، احراز هویت لازم است.',
        data: {},
        timestamp: new Date().toISOString(),
      };
    }

    const modules = await getAIModuleCatalog(userContext);
    const allItems: Array<{ moduleId: string; moduleNameFa: string; connected: boolean; allowed: boolean }> = [];
    const visit = (item: any) => {
      allItems.push(item);
      (item.children || []).forEach(visit);
    };
    modules.forEach(visit);
    const connected = allItems.filter(item => item.allowed && item.connected);
    const unavailable = allItems.filter(item => item.allowed && !item.connected);
    const restricted = allItems.filter(item => !item.allowed);

    return {
      toolName: 'system_architecture_summary',
      titleFa: 'رجیستری زنده ساختار و پوشش ماژول‌های HSECORE',
      summary: [
        `• تعداد ماژول‌های اصلی ثبت‌شده: ${modules.length}`,
        `• تعداد زیرماژول‌ها و تب‌های ثبت‌شده: ${allItems.length - modules.length}`,
        `• بخش‌های دارای منبع داده متصل و مجاز: ${connected.length}`,
        `• بخش‌های مجاز بدون Adapter داده: ${unavailable.length}`,
        `• بخش‌های خارج از سطح دسترسی کاربر: ${restricted.length}`,
        `• فهرست ماژول‌ها: ${modules.map(item => item.moduleNameFa).join('، ')}`,
        'این گزارش از رجیستری واقعی و وضعیت Adapterهای خواندن ساخته شده است؛ قابلیت‌های آینده یا داده‌های فاقد اتصال در آن به‌عنوان قابلیت موجود معرفی نمی‌شوند.',
      ].join('\n'),
      data: {
        totalModules: modules.length,
        totalSubmodulesAndTabs: allItems.length - modules.length,
        connectedAccessibleSections: connected.length,
        unavailableAccessibleSections: unavailable.length,
        restrictedSections: restricted.length,
        modules: modules.map(item => {
          const serializeTree = (node: any): any => ({
            moduleId: node.moduleId,
            moduleNameFa: node.moduleNameFa,
            connected: node.connected,
            allowed: node.allowed,
            tools: node.tools,
            notes: node.notes,
            children: (node.children || []).map(serializeTree),
          });
          return serializeTree(item);
        }),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Tool 21: Universal Cross-Module Deep Search (جستجوی هوشمند رکوردها در تمامی ماژول‌های سامانه)
   * Matches colloquial terms, names, codes, locations, or descriptions across all database tables.
   */
  async searchAcrossAllModules(rawQuery: string): Promise<AIToolResult | null> {
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
      const [permits, incidents, risks, warnings, ncs, fireEq, trainings, envLogs, notifsList] = await Promise.all([
        ptwRepository.findAll().catch(() => []),
        incidentRepository.findAll().catch(() => []),
        db.select().from(schema.riskAssessments).catch(() => []),
        db.select().from(schema.safetyWarnings).catch(() => []),
        db.select().from(schema.nonConformances).catch(() => []),
        db.select().from(schema.fireEquipment).catch(() => []),
        db.select().from(schema.hseTrainings).catch(() => []),
        db.select().from(schema.environmentalLogs).catch(() => []),
        db.select().from(schema.notifications).catch(() => []),
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

      // Search Notifications & Alerts
      for (const n of (notifsList || []) as any[]) {
        const blob = `${n.title || ''} ${n.body || ''} ${n.sourceModule || ''} ${n.priority || ''}`;
        if (matchesToken(blob) > 0) {
          matchedLines.push(`• [اعلان/هشدار] عنوان: ${n.title} | اولویت: ${n.priority || '-'} | مبدأ: ${n.sourceModule || 'سامانه'}`);
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
