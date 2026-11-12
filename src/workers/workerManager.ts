import * as XLSX from 'xlsx';
import {
  WorkerTaskRequest,
  WorkerTaskResponse,
  WorkerTaskType
} from './types';

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
