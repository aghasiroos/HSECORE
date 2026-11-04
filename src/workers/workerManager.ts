import * as XLSX from 'xlsx';
import {
  WorkerTaskRequest,
  WorkerTaskResponse,
  WorkerTaskType
} from './types';
import { normalizeDigits, normalizeForMatching } from '../utils/textNormalization';

interface PendingTask {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  onProgress?: (progress: number, message?: string) => void;
  timeoutTimer?: any;
  cancelled?: boolean;
}

const ANALYTICS_BLOB_WORKER_CODE = `
function normalizeDigits(str) {
  if (!str) return '';
  return String(str)
    .replace(/[۰-۹]/g, function(d) { return '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]; })
    .replace(/[٠-٩]/g, function(d) { return '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]; })
    .trim();
}

self.onmessage = function(event) {
  var data = event.data || {};
  var taskId = data.taskId;
  var type = data.type;
  var payload = data.payload || {};
  var startTime = performance.now();

  function reportProgress(progress, statusMessage) {
    self.postMessage({
      taskId: taskId,
      type: 'PROGRESS',
      progress: progress,
      statusMessage: statusMessage
    });
  }

  try {
    var result = null;

    if (type === 'CALCULATE_SAFETY_PYRAMID') {
      var list = payload.list || [];
      var configuredIncidentTypes = payload.configuredIncidentTypes || [];
      reportProgress(10, 'تحلیل داده‌های ایمنی...');

      var unsafeActsCount = 0;
      var unsafeCondsCount = 0;
      var nearMissCount = 0;
      var firstAidCount = 0;
      var oshaRecordableCount = 0;
      var ltiCount = 0;
      var highSeverityTotal = 0;
      var recordableTotal = 0;
      var proactiveTotal = 0;

      var typeCounts = {};
      if (Array.isArray(configuredIncidentTypes)) {
        configuredIncidentTypes.forEach(function(t) {
          typeCounts[t.id] = 0;
        });
      }

      var len = list.length || 0;
      for (var i = 0; i < len; i++) {
        var inc = list[i];
        if (inc.category === 'Unsafe Act') unsafeActsCount++;
        if (inc.category === 'Unsafe Condition') unsafeCondsCount++;
        if (inc.category === 'Near Miss') nearMissCount++;

        if (inc.incidentTypeId && typeCounts[inc.incidentTypeId] !== undefined) {
          typeCounts[inc.incidentTypeId]++;
          var typeObj = configuredIncidentTypes.find(function(t) { return t.id === inc.incidentTypeId; });
          if (typeObj && typeObj.group === 'high_severity') {
            highSeverityTotal++;
            ltiCount++;
          } else if (typeObj && typeObj.group === 'recordable') {
            recordableTotal++;
            if (typeObj.code === 'FAC') firstAidCount++;
            else oshaRecordableCount++;
          } else if (typeObj && typeObj.group === 'proactive') {
            proactiveTotal++;
          }
        }

        if (i % 250 === 0 && len > 0) {
          reportProgress(Math.min(95, Math.round(10 + (i / len) * 85)));
        }
      }

      result = {
        unsafeActsCount: unsafeActsCount,
        unsafeCondsCount: unsafeCondsCount,
        nearMissCount: nearMissCount,
        firstAidCount: firstAidCount,
        oshaRecordableCount: oshaRecordableCount,
        ltiCount: ltiCount,
        highSeverityTotal: highSeverityTotal,
        recordableTotal: recordableTotal,
        proactiveTotal: proactiveTotal,
        typeCounts: typeCounts
      };
    } else if (type === 'CALCULATE_HEALTH_ENV_KPIS') {
      var periodicExams = payload.periodicExams || [];
      var records = payload.records || [];
      var envMonitoring = payload.envMonitoring || [];
      var wasteRecords = payload.wasteRecords || [];
      var nonConformances = payload.nonConformances || [];
      var selectedYear = payload.selectedYear;
      var totalPersonnelCount = payload.totalPersonnelCount || 0;

      reportProgress(15, 'محاسبه شاخص‌های سلامت و محیط‌زیست...');

      var totalRecordsCount = records.length;
      var incompleteRecordsCount = records.filter(function(r) { return !r.isComplete; }).length;

      var yearExams = selectedYear !== undefined
        ? periodicExams.filter(function(e) { return e.examYear === selectedYear; })
        : periodicExams;

      var completedExamsCount = yearExams.filter(function(e) { return e.status === 'fit' || e.status === 'fit_with_limitations'; }).length;
      var underReviewCount = yearExams.filter(function(e) { return e.status === 'under_review' || e.status === 'needs_specialist'; }).length;
      var overdueExamsCount = Math.max(0, (totalPersonnelCount || totalRecordsCount) - yearExams.length);

      var fitCount = yearExams.filter(function(e) { return e.status === 'fit'; }).length;
      var fitWithLimitationCount = yearExams.filter(function(e) { return e.status === 'fit_with_limitations'; }).length;
      var needsSpecialistCount = yearExams.filter(function(e) { return e.status === 'needs_specialist'; }).length;
      var unfitCount = yearExams.filter(function(e) { return e.status === 'unfit'; }).length;

      var effectiveTotal = totalPersonnelCount || totalRecordsCount || 1;
      var coveragePercentage = Math.round((yearExams.length / effectiveTotal) * 100);

      reportProgress(60, 'محاسبه پایش‌های محیط زیست...');

      var totalMonitoringCount = envMonitoring.length;
      var compliantMonitoringCount = envMonitoring.filter(function(m) { return m.complianceStatus === 'compliant'; }).length;
      var nonCompliantMonitoringCount = envMonitoring.filter(function(m) { return m.complianceStatus === 'non_compliant'; }).length;
      var envComplianceRate = totalMonitoringCount > 0
        ? Math.round((compliantMonitoringCount / totalMonitoringCount) * 100)
        : 0;

      var totalWasteQty = wasteRecords.reduce(function(acc, w) { return acc + (Number(w.quantity) || 0); }, 0);
      var hazardousWasteQty = wasteRecords.filter(function(w) { return w.isHazardous; }).reduce(function(acc, w) { return acc + (Number(w.quantity) || 0); }, 0);
      var recycledWasteQty = wasteRecords.filter(function(w) { return w.category === 'پسماند قابل بازیافت'; }).reduce(function(acc, w) { return acc + (Number(w.quantity) || 0); }, 0);
      var wasteRecoveryRate = totalWasteQty > 0 ? Math.round((recycledWasteQty / totalWasteQty) * 100) : 0;

      var totalNc = nonConformances.length;
      var openNc = nonConformances.filter(function(n) { return n.status === 'باز (Open)' || n.status === 'در حال بررسی'; }).length;
      var inProgressCapa = nonConformances.filter(function(n) { return n.status === 'اقدام اصلاحی تعریف‌شده'; }).length;
      var closedNc = nonConformances.filter(function(n) { return n.status === 'بسته شده (Closed)'; }).length;
      var criticalNc = nonConformances.filter(function(n) { return n.severity === 'بحرانی (Critical)' && n.status !== 'بسته شده (Closed)'; }).length;

      result = {
        totalPersonnelCount: totalPersonnelCount,
        totalHealthRecordsCount: totalRecordsCount,
        incompleteRecordsCount: incompleteRecordsCount,
        periodicExamsTotal: yearExams.length,
        completedExamsCount: completedExamsCount,
        underReviewCount: underReviewCount,
        overdueExamsCount: overdueExamsCount,
        coveragePercentage: coveragePercentage,
        fitness: {
          fit: fitCount,
          fitWithLimitations: fitWithLimitationCount,
          needsSpecialist: needsSpecialistCount,
          unfit: unfitCount
        },
        totalMonitoringCount: totalMonitoringCount,
        compliantMonitoringCount: compliantMonitoringCount,
        nonCompliantMonitoringCount: nonCompliantMonitoringCount,
        envComplianceRate: envComplianceRate,
        totalWasteQty: totalWasteQty,
        hazardousWasteQty: hazardousWasteQty,
        recycledWasteQty: recycledWasteQty,
        wasteRecoveryRate: wasteRecoveryRate,
        totalNc: totalNc,
        openNc: openNc,
        inProgressCapa: inProgressCapa,
        closedNc: closedNc,
        criticalNc: criticalNc
      };
    } else if (type === 'CALCULATE_FIRE_DEPT_STATS') {
      var equipment = payload.equipment || [];
      reportProgress(20, 'محاسبه آمار تجهیزات آتش‌نشانی...');

      var totalInspections = 0;
      var totalGood = 0;
      var totalBad = 0;
      var totalDefects = 0;
      var openDefects = 0;
      var closedDefects = 0;
      var categorySummary = {};

      equipment.forEach(function(eq) {
        var cat = eq.category || 'سایر';
        if (!categorySummary[cat]) {
          categorySummary[cat] = { count: 0, openDefects: 0 };
        }
        categorySummary[cat].count++;

        var insList = eq.inspections || [];
        totalInspections += insList.length;
        insList.forEach(function(ins) {
          if (ins.status === 'مطلوب') totalGood++;
          if (ins.status === 'نامطلوب') totalBad++;
        });

        var defs = eq.defects || [];
        totalDefects += defs.length;
        defs.forEach(function(def) {
          if (def.status === 'باز') {
            openDefects++;
            categorySummary[cat].openDefects++;
          }
          if (def.status === 'بسته') closedDefects++;
        });
      });

      result = {
        totalEquip: equipment.length,
        totalInspections: totalInspections,
        totalGood: totalGood,
        totalBad: totalBad,
        totalDefects: totalDefects,
        openDefects: openDefects,
        closedDefects: closedDefects,
        categorySummary: categorySummary
      };
    } else if (type === 'FILTER_AND_SORT_DATASET') {
      var items = payload.items || [];
      var query = payload.query || '';
      var searchFields = payload.searchFields || [];
      var filters = payload.filters || {};
      var sortField = payload.sortField;
      var sortOrder = payload.sortOrder || 'asc';

      reportProgress(10, 'فیلترسازی و مرتب‌سازی داده‌ها...');

      var q = normalizeDigits(query).toLowerCase().trim();
      var filterEntries = Object.entries(filters);

      var filtered = items.filter(function(item) {
        for (var f = 0; f < filterEntries.length; f++) {
          var k = filterEntries[f][0];
          var v = filterEntries[f][1];
          if (v !== undefined && v !== null && v !== 'all' && v !== 'ALL' && v !== '') {
            if (item[k] !== v) return false;
          }
        }
        if (q) {
          if (searchFields.length > 0) {
            var matched = searchFields.some(function(field) {
              var val = item[field];
              if (val === null || val === undefined) return false;
              return normalizeDigits(String(val)).toLowerCase().includes(q);
            });
            if (!matched) return false;
          } else {
            var str = JSON.stringify(item).toLowerCase();
            if (!str.includes(q)) return false;
          }
        }
        return true;
      });

      reportProgress(75, 'مرتب‌سازی نتایج...');

      if (sortField) {
        filtered.sort(function(a, b) {
          var valA = a[sortField] != null ? a[sortField] : '';
          var valB = b[sortField] != null ? b[sortField] : '';
          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      }

      result = {
        filtered: filtered,
        totalCount: filtered.length
      };
    } else if (type === 'CALCULATE_MULTI_YEAR_TRENDS') {
      var datasets = payload.datasets || [];
      var years = payload.years || [];
      var dateField = payload.dateField || 'date';
      var metricField = payload.metricField || 'value';
      reportProgress(20, 'پردازش داده‌های چندساله...');

      var yearStats = {};
      years.forEach(function(y) {
        yearStats[String(y)] = { total: 0, count: 0, items: [] };
      });

      datasets.forEach(function(item) {
        var rawDate = normalizeDigits(String(item[dateField] || ''));
        for (var y = 0; y < years.length; y++) {
          var yearStr = String(years[y]);
          if (rawDate.includes(yearStr)) {
            var num = Number(item[metricField]) || 0;
            yearStats[yearStr].total += num;
            yearStats[yearStr].count += 1;
            break;
          }
        }
      });

      result = { yearStats: yearStats };
    } else {
      throw new Error('عملیات ناشناخته برای ورکر: ' + type);
    }

    reportProgress(100, 'تکمیل شد');

    self.postMessage({
      taskId: taskId,
      type: 'SUCCESS',
      result: result,
      executionTimeMs: performance.now() - startTime
    });
  } catch (err) {
    self.postMessage({
      taskId: taskId,
      type: 'ERROR',
      error: (err && err.message) || 'خطای ناشناخته در پردازش محاسبات ورکر',
      stack: err && err.stack
    });
  }
};
`;

function normalizeNationalCode(code?: string): string {
  if (!code) return '';
  const digits = normalizeDigits(code, true);
  if (!digits) return '';
  return digits.padStart(10, '0');
}

function extractRawCellValue(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function autoDetectPersonnelColumnMappings(headers: string[]) {
  const map: Record<string, string> = {};
  const cleanHeader = (h: string) => normalizeForMatching(h);

  headers.forEach(h => {
    const norm = cleanHeader(h);
    if (!map.nationalCode && (norm.includes('کد ملی') || norm.includes('کدملی') || norm.includes('شناسه ملی') || norm.includes('national code') || norm.includes('nid'))) {
      map.nationalCode = h;
    } else if (!map.personnelCode && (norm.includes('پرسنلی') || norm.includes('استخدامی') || norm.includes('کارمندی') || norm.includes('personnel code') || norm.includes('emp code'))) {
      map.personnelCode = h;
    } else if (!map.fullName && (norm.includes('نام و نام') || norm.includes('نام کامل') || norm.includes('full name'))) {
      map.fullName = h;
    } else if (!map.firstName && (norm === 'نام' || norm === 'first name' || norm === 'fname')) {
      map.firstName = h;
    } else if (!map.lastName && (norm.includes('خانوادگی') || norm.includes('فامیلی') || norm.includes('شهرت') || norm === 'last name' || norm === 'lname')) {
      map.lastName = h;
    } else if (!map.gender && (norm.includes('جنسیت') || norm.includes('gender') || norm === 'sex')) {
      map.gender = h;
    } else if (!map.unit && (norm.includes('واحد') || norm.includes('دپارتمان') || norm.includes('بخش') || norm.includes('unit') || norm.includes('dept'))) {
      map.unit = h;
    } else if (!map.subUnit && (norm.includes('زیرمجموعه') || norm.includes('قسمت') || norm.includes('کارگاه') || norm.includes('sub unit'))) {
      map.subUnit = h;
    } else if (!map.jobTitle && (norm.includes('شغل') || norm.includes('سمت') || norm.includes('پست') || norm.includes('job') || norm.includes('position'))) {
      map.jobTitle = h;
    } else if (!map.phone && (norm.includes('تلفن') || norm.includes('موبایل') || norm.includes('تماس') || norm.includes('همراه') || norm.includes('phone') || norm.includes('mobile'))) {
      map.phone = h;
    } else if (!map.birthDate && (norm.includes('تولد') || norm.includes('birth'))) {
      map.birthDate = h;
    } else if (!map.workplace && (norm.includes('محل خدمت') || norm.includes('محل کار') || norm.includes('سایت') || norm.includes('کارخانه') || norm.includes('workplace') || norm.includes('site'))) {
      map.workplace = h;
    } else if (!map.education && (norm.includes('تحصیل') || norm.includes('مدرک') || norm.includes('education') || norm.includes('degree'))) {
      map.education = h;
    } else if (!map.maritalStatus && (norm.includes('تاهل') || norm.includes('تأهل') || norm.includes('marital'))) {
      map.maritalStatus = h;
    }
  });

  return map;
}

const yieldToMain = () => new Promise<void>(resolve => setTimeout(resolve, 0));

class WorkerManager {
  private analyticsWorker: Worker | null = null;
  private analyticsBlobUrl: string | null = null;
  private pendingTasks: Map<string, PendingTask> = new Map();
  private hasWorkerSupport: boolean =
    typeof window !== 'undefined' &&
    typeof window.Worker !== 'undefined' &&
    typeof window.Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function';

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.terminateAll());
    }
  }

  private getAnalyticsWorker(): Worker | null {
    if (!this.hasWorkerSupport) return null;
    if (!this.analyticsWorker) {
      try {
        const blob = new Blob([ANALYTICS_BLOB_WORKER_CODE], { type: 'application/javascript' });
        this.analyticsBlobUrl = URL.createObjectURL(blob);
        this.analyticsWorker = new Worker(this.analyticsBlobUrl);
        this.setupWorkerListeners(this.analyticsWorker);
      } catch (e) {
        console.warn('HSECORE: Failed to instantiate Analytics Web Worker, falling back to non-blocking async:', e);
        this.analyticsWorker = null;
      }
    }
    return this.analyticsWorker;
  }

  private setupWorkerListeners(worker: Worker) {
    worker.onmessage = (event: MessageEvent<WorkerTaskResponse>) => {
      const data = event.data;
      if (!data || !data.taskId) return;

      const task = this.pendingTasks.get(data.taskId);
      if (!task) return;

      if (data.type === 'PROGRESS') {
        if (task.onProgress) {
          task.onProgress(data.progress, data.statusMessage);
        }
      } else if (data.type === 'SUCCESS') {
        clearTimeout(task.timeoutTimer);
        this.pendingTasks.delete(data.taskId);
        task.resolve(data.result);
      } else if (data.type === 'ERROR') {
        clearTimeout(task.timeoutTimer);
        this.pendingTasks.delete(data.taskId);
        task.reject(new Error(data.error));
      }
    };

    worker.onerror = (err: ErrorEvent) => {
      if (err && typeof err.preventDefault === 'function') {
        err.preventDefault();
      }
      console.warn('HSECORE Web Worker fallback activated:', err?.message || 'Worker runtime notice');
      if (this.analyticsWorker === worker) {
        try {
          worker.terminate();
        } catch (_) {}
        this.analyticsWorker = null;
      }
      this.pendingTasks.forEach((task) => {
        clearTimeout(task.timeoutTimer);
        task.reject(new Error('خطا در اجرای ورکر پردازش داده‌ها'));
      });
      this.pendingTasks.clear();
    };
  }

  /**
   * Non-blocking chunked execution for Excel tasks (avoids module worker CJS/Vite import issues while keeping UI responsive)
   */
  private async executeExcelTaskAsync(
    taskId: string,
    type: WorkerTaskType,
    payload: any,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<any> {
    const isCancelled = () => {
      const t = this.pendingTasks.get(taskId);
      return !t || Boolean(t.cancelled);
    };

    const report = (pct: number, msg: string) => {
      if (onProgress && !isCancelled()) {
        onProgress(pct, msg);
      }
    };

    await yieldToMain();
    if (isCancelled()) throw new Error('عملیات پردازش لغو شد.');

    if (type === 'EXCEL_PARSE_MEDICAL_EXAMS') {
      const { fileBuffer } = payload as { fileBuffer: ArrayBuffer };
      report(15, 'در حال خواندن فایل اکسل معاینات ادواری...');
      await yieldToMain();

      const workbook = XLSX.read(fileBuffer, { type: 'array' });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('فایل اکسل انتخاب‌شده دارای هیچ شیتی نمی‌باشد.');
      }

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      report(55, 'در حال استخراج داده‌های پزشکی و آزمایشگاهی...');
      await yieldToMain();

      const jsonRecords: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      report(100, 'تحلیل پرونده‌های پزشکی به پایان رسید.');
      return {
        workbook,
        records: jsonRecords,
        totalRows: jsonRecords.length
      };
    }

    if (type === 'EXCEL_PARSE_PERSONNEL') {
      const { fileBuffer, existingPersonnelList = [] } = payload;
      report(10, 'در حال خواندن ساختار فایل اکسل...');
      await yieldToMain();

      const workbook = XLSX.read(fileBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('فایل اکسل بدون برگه (Sheet) می‌باشد.');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawJson || rawJson.length === 0) {
        throw new Error('فایل اکسل خالی است یا سطری در آن یافت نشد.');
      }

      report(30, 'تشخیص ستون‌ها و تطبیق فیلدها...');
      await yieldToMain();

      const headers = Object.keys(rawJson[0]);
      const mappings = autoDetectPersonnelColumnMappings(headers);

      const rowsPreview: any[] = [];
      let createdCount = 0;
      let updatedCount = 0;
      let warningCount = 0;
      let errorCount = 0;

      const seenNationalCodesInFile = new Set<string>();
      const seenPersonnelCodesInFile = new Set<string>();
      const totalRows = rawJson.length;

      for (let idx = 0; idx < totalRows; idx++) {
        if (isCancelled()) throw new Error('عملیات پردازش توسط کاربر لغو گردید.');
        const row = rawJson[idx];
        const rowId = idx + 1;
        const errors: string[] = [];
        const warnings: string[] = [];

        const rawNationalCode = extractRawCellValue(row[mappings.nationalCode || '']);
        const rawPersonnelCode = extractRawCellValue(row[mappings.personnelCode || '']);
        let rawFirstName = extractRawCellValue(row[mappings.firstName || '']);
        let rawLastName = extractRawCellValue(row[mappings.lastName || '']);
        const rawFullNameStr = extractRawCellValue(row[mappings.fullName || '']);

        if ((!rawFirstName || !rawLastName) && rawFullNameStr) {
          const parts = rawFullNameStr.trim().split(/\s+/);
          rawFirstName = rawFirstName || parts[0] || '';
          rawLastName = rawLastName || parts.slice(1).join(' ') || '';
        }

        const fullName =
          rawFirstName && rawLastName
            ? `${rawFirstName} ${rawLastName}`
            : rawFullNameStr || rawFirstName || rawLastName || '—';
        const gender = extractRawCellValue(row[mappings.gender || '']) || 'مرد';
        const militaryStatus = extractRawCellValue(row[mappings.militaryStatus || '']) || 'پایان خدمت';
        const workplace = extractRawCellValue(row[mappings.workplace || '']);
        const unit = extractRawCellValue(row[mappings.unit || '']);
        const subUnit = extractRawCellValue(row[mappings.subUnit || '']);
        const jobTitle = extractRawCellValue(row[mappings.jobTitle || '']);
        const birthDate = extractRawCellValue(row[mappings.birthDate || '']);
        const phone = extractRawCellValue(row[mappings.phone || '']);
        const education = extractRawCellValue(row[mappings.education || '']);
        const maritalStatus = extractRawCellValue(row[mappings.maritalStatus || '']);
        const childrenCount = extractRawCellValue(row[mappings.childrenCount || '']) || '0';
        const notes = extractRawCellValue(row[mappings.notes || '']);

        const normNatCode = normalizeNationalCode(rawNationalCode);
        const normPersCode = normalizeDigits(rawPersonnelCode).trim();

        if (!rawNationalCode && !rawPersonnelCode && !rawFullNameStr && !rawLastName) {
          errors.push('اطلاعات هویتی (کد ملی، کد پرسنلی یا نام پرسنل) خالی است.');
        }

        if (normNatCode && seenNationalCodesInFile.has(normNatCode)) {
          warnings.push('کد ملی تکراری در همین فایل اکسل وجود دارد.');
        } else if (normNatCode) {
          seenNationalCodesInFile.add(normNatCode);
        }

        if (normPersCode && seenPersonnelCodesInFile.has(normPersCode)) {
          warnings.push('کد پرسنلی تکراری در همین فایل اکسل وجود دارد.');
        } else if (normPersCode) {
          seenPersonnelCodesInFile.add(normPersCode);
        }

        let matchedPerson: any = undefined;
        let matchMethod: 'NATIONAL_CODE' | 'PERSONNEL_CODE' | 'NAME_MATCH' | 'NONE' = 'NONE';

        if (normNatCode) {
          matchedPerson = existingPersonnelList.find((p: any) => normalizeNationalCode(p.nationalCode) === normNatCode);
          if (matchedPerson) matchMethod = 'NATIONAL_CODE';
        }

        if (!matchedPerson && normPersCode) {
          matchedPerson = existingPersonnelList.find((p: any) => normalizeDigits(p.personnelCode).trim() === normPersCode);
          if (matchedPerson) matchMethod = 'PERSONNEL_CODE';
        }

        if (!matchedPerson && rawFirstName && rawLastName) {
          const normInputFname = normalizeForMatching(rawFirstName);
          const normInputLname = normalizeForMatching(rawLastName);
          matchedPerson = existingPersonnelList.find((p: any) => {
            const pFname = normalizeForMatching(p.firstName);
            const pLname = normalizeForMatching(p.lastName);
            return pFname === normInputFname && pLname === normInputLname;
          });
          if (matchedPerson) matchMethod = 'NAME_MATCH';
        }

        let action: 'CREATE' | 'UPDATE' | 'DUPLICATE_WARNING' | 'ERROR' = 'CREATE';
        const changedFields: any[] = [];

        if (errors.length > 0) {
          action = 'ERROR';
          errorCount++;
        } else if (matchedPerson) {
          action = 'UPDATE';
          updatedCount++;
          const checkChange = (field: string, labelFa: string, newVal: string, oldVal?: string) => {
            if (newVal && oldVal && newVal.trim() !== oldVal.trim()) {
              changedFields.push({ fieldName: field, labelFa, oldValue: oldVal, newValue: newVal });
            }
          };
          checkChange('unit', 'واحد سازمانی', unit, matchedPerson.unit);
          checkChange('subUnit', 'زیرمجموعه', subUnit, matchedPerson.subUnit);
          checkChange('jobTitle', 'عنوان شغلی', jobTitle, matchedPerson.jobTitle);
          checkChange('workplace', 'محل خدمت', workplace, matchedPerson.workplace);
          checkChange('phone', 'شماره تماس', phone, matchedPerson.phone);
        } else {
          action = 'CREATE';
          createdCount++;
        }

        if (warnings.length > 0) {
          warningCount++;
        }

        rowsPreview.push({
          rowId,
          rawNationalCode,
          rawPersonnelCode,
          firstName: rawFirstName,
          lastName: rawLastName,
          fullName,
          gender,
          militaryStatus,
          workplace,
          unit,
          subUnit,
          jobTitle,
          birthDate,
          phone,
          education,
          maritalStatus,
          childrenCount,
          notes,
          action,
          matchMethod,
          matchedPersonnelId: matchedPerson?.id,
          matchedPersonnelCode: matchedPerson?.personnelCode,
          matchedFullName: matchedPerson ? `${matchedPerson.firstName} ${matchedPerson.lastName}` : undefined,
          changedFields,
          errors,
          warnings
        });

        if (idx > 0 && idx % 150 === 0) {
          const pct = Math.min(95, Math.round(30 + (idx / totalRows) * 65));
          report(pct, `تطبیق ردیف ${idx + 1} از ${totalRows}...`);
          await yieldToMain();
        }
      }

      report(100, 'تحلیل فایل اکسل به پایان رسید.');
      return {
        totalRows,
        createdCount,
        updatedCount,
        warningCount,
        errorCount,
        rows: rowsPreview
      };
    }

    throw new Error(`عملیات ناشناخته برای پردازشگر اکسل: ${type}`);
  }

  /**
   * Executes a task on the appropriate Worker or non-blocking async runner
   */
  public executeTask<T = any, R = any>(
    type: WorkerTaskType,
    payload: T,
    onProgress?: (progress: number, message?: string) => void,
    timeoutMs: number = 60000
  ): { promise: Promise<R>; cancel: () => void } {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const isExcel = type.startsWith('EXCEL_');

    let cancelFn = () => {};

    const promise = new Promise<R>((resolve, reject) => {
      cancelFn = () => {
        const task = this.pendingTasks.get(taskId);
        if (task) {
          task.cancelled = true;
          clearTimeout(task.timeoutTimer);
          this.pendingTasks.delete(taskId);
          task.reject(new Error('عملیات پردازش توسط کاربر لغو گردید.'));
        }
      };

      const timeoutTimer = setTimeout(() => {
        if (this.pendingTasks.has(taskId)) {
          const task = this.pendingTasks.get(taskId);
          if (task) task.cancelled = true;
          this.pendingTasks.delete(taskId);
          reject(new Error(`زمان مجاز پردازش (${timeoutMs / 1000} ثانیه) به پایان رسید.`));
        }
      }, timeoutMs);

      this.pendingTasks.set(taskId, {
        resolve,
        reject,
        onProgress,
        timeoutTimer,
        cancelled: false
      });

      if (isExcel) {
        this.executeExcelTaskAsync(taskId, type, payload, onProgress)
          .then((res) => {
            const task = this.pendingTasks.get(taskId);
            if (task && !task.cancelled) {
              clearTimeout(task.timeoutTimer);
              this.pendingTasks.delete(taskId);
              task.resolve(res as R);
            }
          })
          .catch((err) => {
            const task = this.pendingTasks.get(taskId);
            if (task && !task.cancelled) {
              clearTimeout(task.timeoutTimer);
              this.pendingTasks.delete(taskId);
              task.reject(err);
            }
          });
        return;
      }

      const worker = this.getAnalyticsWorker();
      if (!worker) {
        clearTimeout(timeoutTimer);
        this.pendingTasks.delete(taskId);
        reject(new Error('Web Worker در محیط جاری در دسترس نمی‌باشد.'));
        return;
      }

      const message: WorkerTaskRequest<T> = {
        taskId,
        type,
        payload,
        timestamp: Date.now()
      };

      worker.postMessage(message);
    });

    return { promise, cancel: cancelFn };
  }

  public cancelTask(taskId: string) {
    const task = this.pendingTasks.get(taskId);
    if (task) {
      task.cancelled = true;
      clearTimeout(task.timeoutTimer);
      this.pendingTasks.delete(taskId);
      task.reject(new Error('عملیات پردازش لغو شد.'));
    }
  }

  public terminateAll() {
    this.pendingTasks.forEach(task => {
      task.cancelled = true;
      clearTimeout(task.timeoutTimer);
      task.reject(new Error('ورکرها خاتمه یافتند.'));
    });
    this.pendingTasks.clear();

    if (this.analyticsWorker) {
      try {
        this.analyticsWorker.terminate();
      } catch (_) {}
      this.analyticsWorker = null;
    }
    if (this.analyticsBlobUrl) {
      try {
        URL.revokeObjectURL(this.analyticsBlobUrl);
      } catch (_) {}
      this.analyticsBlobUrl = null;
    }
  }
}

export const workerManager = new WorkerManager();
