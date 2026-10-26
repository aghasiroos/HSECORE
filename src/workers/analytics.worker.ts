/// <reference lib="webworker" />
import { WorkerTaskRequest, WorkerTaskResponse } from './types';

/* eslint-disable no-restricted-globals */
const ctx: DedicatedWorkerGlobalScope = self as any;

function normalizeDigits(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
    .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .trim();
}

ctx.onmessage = (event: MessageEvent<WorkerTaskRequest>) => {
  const { taskId, type, payload } = event.data;
  const startTime = performance.now();

  const reportProgress = (progress: number, statusMessage?: string) => {
    ctx.postMessage({
      taskId,
      type: 'PROGRESS',
      progress,
      statusMessage
    });
  };

  try {
    let result: any = null;

    switch (type) {
      case 'CALCULATE_SAFETY_PYRAMID': {
        const { list, configuredIncidentTypes } = payload as { list: any[]; configuredIncidentTypes: any[] };
        reportProgress(10, 'تحلیل داده‌های ایمنی...');

        let unsafeActsCount = 0;
        let unsafeCondsCount = 0;
        let nearMissCount = 0;
        let firstAidCount = 0;
        let oshaRecordableCount = 0;
        let ltiCount = 0;
        let highSeverityTotal = 0;
        let recordableTotal = 0;
        let proactiveTotal = 0;

        const typeCounts: Record<string, number> = {};
        if (Array.isArray(configuredIncidentTypes)) {
          configuredIncidentTypes.forEach(t => {
            typeCounts[t.id] = 0;
          });
        }

        const len = list?.length || 0;
        for (let i = 0; i < len; i++) {
          const inc = list[i];
          if (inc.category === 'Unsafe Act') unsafeActsCount++;
          if (inc.category === 'Unsafe Condition') unsafeCondsCount++;
          if (inc.category === 'Near Miss') nearMissCount++;

          if (inc.incidentTypeId && typeCounts[inc.incidentTypeId] !== undefined) {
            typeCounts[inc.incidentTypeId]++;
            const typeObj = configuredIncidentTypes?.find(t => t.id === inc.incidentTypeId);
            if (typeObj?.group === 'high_severity') {
              highSeverityTotal++;
              ltiCount++;
            } else if (typeObj?.group === 'recordable') {
              recordableTotal++;
              if (typeObj.code === 'FAC') firstAidCount++;
              else oshaRecordableCount++;
            } else if (typeObj?.group === 'proactive') {
              proactiveTotal++;
            }
          }

          if (i % 250 === 0 && len > 0) {
            reportProgress(Math.min(95, Math.round(10 + (i / len) * 85)));
          }
        }

        result = {
          unsafeActsCount,
          unsafeCondsCount,
          nearMissCount,
          firstAidCount,
          oshaRecordableCount,
          ltiCount,
          highSeverityTotal,
          recordableTotal,
          proactiveTotal,
          typeCounts
        };
        break;
      }

      case 'CALCULATE_HEALTH_ENV_KPIS': {
        const {
          periodicExams = [],
          records = [],
          envMonitoring = [],
          wasteRecords = [],
          nonConformances = [],
          selectedYear,
          selectedMonitoringYear,
          totalPersonnelCount = 0
        } = payload;

        reportProgress(15, 'محاسبه شاخص‌های سلامت و محیط‌زیست...');

        const totalRecordsCount = records.length;
        const incompleteRecordsCount = records.filter((r: any) => !r.isComplete).length;

        // Periodic exams
        const yearExams = selectedYear !== undefined 
          ? periodicExams.filter((e: any) => e.examYear === selectedYear)
          : periodicExams;

        const completedExamsCount = yearExams.filter((e: any) => e.status === 'fit' || e.status === 'fit_with_limitations').length;
        const underReviewCount = yearExams.filter((e: any) => e.status === 'under_review' || e.status === 'needs_specialist').length;
        const overdueExamsCount = Math.max(0, (totalPersonnelCount || totalRecordsCount) - yearExams.length);

        const fitCount = yearExams.filter((e: any) => e.status === 'fit').length;
        const fitWithLimitationCount = yearExams.filter((e: any) => e.status === 'fit_with_limitations').length;
        const needsSpecialistCount = yearExams.filter((e: any) => e.status === 'needs_specialist').length;
        const unfitCount = yearExams.filter((e: any) => e.status === 'unfit').length;

        const effectiveTotal = totalPersonnelCount || totalRecordsCount || 1;
        const coveragePercentage = Math.round((yearExams.length / effectiveTotal) * 100);

        reportProgress(60, 'محاسبه پایش‌های محیط زیست...');

        // Environmental monitoring
        const totalMonitoringCount = envMonitoring.length;
        const compliantMonitoringCount = envMonitoring.filter((m: any) => m.complianceStatus === 'compliant').length;
        const nonCompliantMonitoringCount = envMonitoring.filter((m: any) => m.complianceStatus === 'non_compliant').length;
        const envComplianceRate = totalMonitoringCount > 0 
          ? Math.round((compliantMonitoringCount / totalMonitoringCount) * 100) 
          : 0;

        // Waste
        const totalWasteQty = wasteRecords.reduce((acc: number, w: any) => acc + (Number(w.quantity) || 0), 0);
        const hazardousWasteQty = wasteRecords.filter((w: any) => w.isHazardous).reduce((acc: number, w: any) => acc + (Number(w.quantity) || 0), 0);
        const recycledWasteQty = wasteRecords.filter((w: any) => w.category === 'پسماند قابل بازیافت').reduce((acc: number, w: any) => acc + (Number(w.quantity) || 0), 0);
        const wasteRecoveryRate = totalWasteQty > 0 ? Math.round((recycledWasteQty / totalWasteQty) * 100) : 0;

        // Non-conformances
        const totalNc = nonConformances.length;
        const openNc = nonConformances.filter((n: any) => n.status === 'باز (Open)' || n.status === 'در حال بررسی').length;
        const inProgressCapa = nonConformances.filter((n: any) => n.status === 'اقدام اصلاحی تعریف‌شده').length;
        const closedNc = nonConformances.filter((n: any) => n.status === 'بسته شده (Closed)').length;
        const criticalNc = nonConformances.filter((n: any) => n.severity === 'بحرانی (Critical)' && n.status !== 'بسته شده (Closed)').length;

        result = {
          totalPersonnelCount,
          totalHealthRecordsCount: totalRecordsCount,
          incompleteRecordsCount,
          periodicExamsTotal: yearExams.length,
          completedExamsCount,
          underReviewCount,
          overdueExamsCount,
          coveragePercentage,
          fitness: {
            fit: fitCount,
            fitWithLimitations: fitWithLimitationCount,
            needsSpecialist: needsSpecialistCount,
            unfit: unfitCount
          },
          totalMonitoringCount,
          compliantMonitoringCount,
          nonCompliantMonitoringCount,
          envComplianceRate,
          totalWasteQty,
          hazardousWasteQty,
          recycledWasteQty,
          wasteRecoveryRate,
          totalNc,
          openNc,
          inProgressCapa,
          closedNc,
          criticalNc
        };
        break;
      }

      case 'CALCULATE_FIRE_DEPT_STATS': {
        const { equipment = [] } = payload as { equipment: any[] };
        reportProgress(20, 'محاسبه آمار تجهیزات آتش‌نشانی...');

        let totalInspections = 0;
        let totalGood = 0;
        let totalBad = 0;
        let totalDefects = 0;
        let openDefects = 0;
        let closedDefects = 0;

        const categorySummary: Record<string, { count: number; openDefects: number }> = {};

        equipment.forEach((eq: any) => {
          const cat = eq.category || 'سایر';
          if (!categorySummary[cat]) {
            categorySummary[cat] = { count: 0, openDefects: 0 };
          }
          categorySummary[cat].count++;

          const insList = eq.inspections || [];
          totalInspections += insList.length;
          insList.forEach((ins: any) => {
            if (ins.status === 'مطلوب') totalGood++;
            if (ins.status === 'نامطلوب') totalBad++;
          });

          const defs = eq.defects || [];
          totalDefects += defs.length;
          defs.forEach((def: any) => {
            if (def.status === 'باز') {
              openDefects++;
              categorySummary[cat].openDefects++;
            }
            if (def.status === 'بسته') closedDefects++;
          });
        });

        result = {
          totalEquip: equipment.length,
          totalInspections,
          totalGood,
          totalBad,
          totalDefects,
          openDefects,
          closedDefects,
          categorySummary
        };
        break;
      }

      case 'FILTER_AND_SORT_DATASET': {
        const {
          items = [],
          query = '',
          searchFields = [],
          filters = {},
          sortField,
          sortOrder = 'asc'
        } = payload;

        reportProgress(10, 'فیلترسازی و مرتب‌سازی داده‌ها...');

        const q = normalizeDigits(query).toLowerCase().trim();
        const filterEntries = Object.entries(filters);

        const filtered = items.filter((item: any) => {
          // Custom field filters
          for (let f = 0; f < filterEntries.length; f++) {
            const [k, v] = filterEntries[f];
            if (v !== undefined && v !== null && v !== 'all' && v !== 'ALL' && v !== '') {
              if (item[k] !== v) return false;
            }
          }

          // Search query matching
          if (q) {
            if (searchFields.length > 0) {
              const matched = searchFields.some((field: string) => {
                const val = item[field];
                if (val === null || val === undefined) return false;
                return normalizeDigits(String(val)).toLowerCase().includes(q);
              });
              if (!matched) return false;
            } else {
              const str = JSON.stringify(item).toLowerCase();
              if (!str.includes(q)) return false;
            }
          }

          return true;
        });

        reportProgress(75, 'مرتب‌سازی نتایج...');

        if (sortField) {
          filtered.sort((a: any, b: any) => {
            const valA = a[sortField] ?? '';
            const valB = b[sortField] ?? '';
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
          });
        }

        result = {
          filtered,
          totalCount: filtered.length
        };
        break;
      }

      case 'CALCULATE_MULTI_YEAR_TRENDS': {
        const { datasets = [], years = [], dateField = 'date', metricField = 'value' } = payload;
        reportProgress(20, 'پردازش داده‌های چندساله...');

        const yearStats: Record<string, { total: number; count: number; items: any[] }> = {};
        years.forEach((y: string | number) => {
          yearStats[String(y)] = { total: 0, count: 0, items: [] };
        });

        datasets.forEach((item: any) => {
          const rawDate = normalizeDigits(String(item[dateField] || ''));
          for (let y = 0; y < years.length; y++) {
            const yearStr = String(years[y]);
            if (rawDate.includes(yearStr)) {
              const num = Number(item[metricField]) || 0;
              yearStats[yearStr].total += num;
              yearStats[yearStr].count += 1;
              break;
            }
          }
        });

        result = { yearStats };
        break;
      }

      default:
        throw new Error(`عملیات ناشناخته برای ورکر: ${type}`);
    }

    reportProgress(100, 'تکمیل شد');

    const successResponse: WorkerTaskResponse = {
      taskId,
      type: 'SUCCESS',
      result,
      executionTimeMs: performance.now() - startTime
    };
    ctx.postMessage(successResponse);
  } catch (err: any) {
    const errorResponse: WorkerTaskResponse = {
      taskId,
      type: 'ERROR',
      error: err?.message || 'خطای ناشناخته در پردازش محاسبات ورکر',
      stack: err?.stack
    };
    ctx.postMessage(errorResponse);
  }
};
