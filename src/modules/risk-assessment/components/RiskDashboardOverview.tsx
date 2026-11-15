import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  TrendingDown,
  FileCheck,
  Plus,
  Filter,
  BarChart3,
  Printer,
  Edit3,
  Trash2,
  Download,
  RotateCcw,
  ClipboardList,
  Building2,
  Grid3X3,
} from 'lucide-react';
import {
  AnyRiskAssessment,
  RiskMethod,
  RiskMatrixConfig,
} from '../types';
import {
  getRiskLevelColor,
  getMethodMeta,
  getDistinctMethods,
  getStatusBadgeMeta,
} from '../services/riskAssessmentService';
import {
  DEFAULT_RISK_MATRIX_CONFIG,
  exportRiskRegisterToExcel,
  loadOrganizationMatrixConfig,
} from '../services/riskMatrixConfig';
import { isActionOverdue } from '../services/riskWorkflowEngine';
import {
  nonConformanceService,
  NonConformanceRecord,
} from '../../../components/non-conformance/nonConformanceService';
import PersianDatePicker from '../../../components/common/PersianDatePicker';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';

interface RiskDashboardOverviewProps {
  assessments: AnyRiskAssessment[];
  isFa: boolean;
  onSelectMethod: (method: RiskMethod) => void;
  onNewAssessment: (method?: RiskMethod) => void;
  onViewAssessment: (assessment: AnyRiskAssessment) => void;
  onPrintAssessment?: (assessment: AnyRiskAssessment) => void;
  onEditAssessment?: (assessment: AnyRiskAssessment) => void;
  onDeleteAssessment?: (assessment: AnyRiskAssessment) => void;
}

export default function RiskDashboardOverview({
  assessments,
  isFa,
  onSelectMethod,
  onNewAssessment,
  onViewAssessment,
  onPrintAssessment,
  onEditAssessment,
  onDeleteAssessment,
}: RiskDashboardOverviewProps) {
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [matrixConfig, setMatrixConfig] = useState<RiskMatrixConfig>(DEFAULT_RISK_MATRIX_CONFIG);
  const [linkedNcs, setLinkedNcs] = useState<NonConformanceRecord[]>([]);

  useEffect(() => {
    loadOrganizationMatrixConfig().then(setMatrixConfig).catch(() => {});
    nonConformanceService
      .getAll({ sourceModule: 'risk_assessment' })
      .then(list => setLinkedNcs(Array.isArray(list) ? list : []))
      .catch(() => setLinkedNcs([]));
  }, [assessments.length]);

  const distinctUnits = useMemo(
    () => Array.from(new Set(assessments.map(a => a.unit).filter(Boolean))).sort(),
    [assessments]
  );

  const hasActiveFilters =
    unitFilter !== 'ALL' ||
    methodFilter !== 'ALL' ||
    levelFilter !== 'ALL' ||
    Boolean(dateFrom.trim()) ||
    Boolean(dateTo.trim());

  const resetFilters = () => {
    setUnitFilter('ALL');
    setMethodFilter('ALL');
    setLevelFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const filteredAssessments = useMemo(() => {
    return assessments.filter(a => {
      if (unitFilter !== 'ALL' && a.unit !== unitFilter) return false;
      if (methodFilter !== 'ALL' && String(a.method || '').toUpperCase() !== methodFilter) return false;
      if (levelFilter !== 'ALL' && String(a.overallRiskLevel || '').toUpperCase() !== levelFilter) return false;
      const d = (a.assessmentDate || '').trim().replace(/-/g, '/');
      if (dateFrom.trim() && d && d < dateFrom.trim().replace(/-/g, '/')) return false;
      if (dateTo.trim() && d && d > dateTo.trim().replace(/-/g, '/')) return false;
      return true;
    });
  }, [assessments, unitFilter, methodFilter, levelFilter, dateFrom, dateTo]);

  // ── KPI Calculations ──
  const totalCount = filteredAssessments.length;
  const approvedCount = filteredAssessments.filter(a => a.status === 'APPROVED').length;
  const underReviewCount = filteredAssessments.filter(a => a.status === 'UNDER_REVIEW').length;
  const draftCount = filteredAssessments.filter(a => a.status === 'DRAFT').length;
  const archivedCount = filteredAssessments.filter(a => a.status === 'ARCHIVED').length;

  const criticalCount = filteredAssessments.filter(a => a.overallRiskLevel === 'CRITICAL').length;
  const highCount = filteredAssessments.filter(a => a.overallRiskLevel === 'HIGH').length;
  const mediumCount = filteredAssessments.filter(a => a.overallRiskLevel === 'MEDIUM').length;
  const lowCount = filteredAssessments.filter(a => a.overallRiskLevel === 'LOW').length;

  const criticalResidualCount = filteredAssessments.filter(
    a => (a.residualRiskLevel || 'LOW') === 'CRITICAL'
  ).length;
  const highResidualCount = filteredAssessments.filter(
    a => (a.residualRiskLevel || 'LOW') === 'HIGH'
  ).length;

  // CAPA Metrics (deduplicated across assessment.controlActions + non_conformances)
  const capaStats = useMemo(() => {
    let open = 0;
    let overdue = 0;
    let completed = 0;
    const seenNcIds = new Set<string>();
    const filteredIds = new Set(filteredAssessments.map(a => String(a.id)));
    const filteredCodes = new Set(filteredAssessments.map(a => String(a.code)));

    for (const a of filteredAssessments) {
      const actions = Array.isArray(a.controlActions) ? a.controlActions : [];
      for (const act of actions) {
        if (act.nonConformanceId) seenNcIds.add(String(act.nonConformanceId));
        if (act.status === 'DONE' || act.status === 'VERIFIED') {
          completed += 1;
        } else if (act.status === 'OVERDUE' || isActionOverdue(act.deadline, act.status)) {
          overdue += 1;
          open += 1;
        } else {
          open += 1;
        }
      }
    }

    for (const nc of linkedNcs) {
      if (nc.id && seenNcIds.has(String(nc.id))) continue;
      const srcId = String(nc.sourceRecordId || '');
      if (hasActiveFilters && srcId && !filteredIds.has(srcId) && !filteredCodes.has(srcId)) continue;
      if (nc.status === 'CLOSED') {
        completed += 1;
      } else if (nc.status !== 'CANCELLED') {
        open += 1;
        if (isActionOverdue(nc.dueDate || '', nc.status)) {
          overdue += 1;
        }
      }
    }

    return { open, overdue, completed, total: open + completed };
  }, [filteredAssessments, linkedNcs, hasActiveFilters]);

  // Average Risk Reduction Index (%)
  const avgReductionPct = useMemo(() => {
    const diffs: number[] = [];
    for (const a of filteredAssessments) {
      const init = Number(a.initialRiskScore || 0);
      const res = Number(a.residualRiskScore || 0);
      if (init > 0 && res >= 0 && res <= init) {
        diffs.push(Math.round(((init - res) / init) * 100));
      }
    }
    if (diffs.length === 0) return 0;
    return Math.round(diffs.reduce((s, v) => s + v, 0) / diffs.length);
  }, [filteredAssessments]);

  // ── Chart 1: Initial vs Residual Risk Comparison ──
  const initialVsResidualChartData = useMemo(() => {
    const levels: Array<{ key: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; label: string }> = [
      { key: 'CRITICAL', label: isFa ? 'بحرانی' : 'Critical' },
      { key: 'HIGH', label: isFa ? 'بالا' : 'High' },
      { key: 'MEDIUM', label: isFa ? 'متوسط' : 'Medium' },
      { key: 'LOW', label: isFa ? 'پایین' : 'Low' },
    ];
    return levels.map(l => ({
      name: l.label,
      initial: filteredAssessments.filter(a => (a.overallRiskLevel || 'LOW') === l.key).length,
      residual: filteredAssessments.filter(a => (a.residualRiskLevel || 'LOW') === l.key).length,
    }));
  }, [filteredAssessments, isFa]);

  // ── Chart 2: Unit Breakdown ──
  const unitChartData = useMemo(() => {
    const map = new Map<string, { name: string; criticalHigh: number; mediumLow: number; total: number }>();
    for (const a of filteredAssessments) {
      const unitName = a.unit || (isFa ? 'سایر واحدها' : 'Other');
      const cur = map.get(unitName) || { name: unitName, criticalHigh: 0, mediumLow: 0, total: 0 };
      cur.total += 1;
      if (a.overallRiskLevel === 'CRITICAL' || a.overallRiskLevel === 'HIGH') {
        cur.criticalHigh += 1;
      } else {
        cur.mediumLow += 1;
      }
      map.set(unitName, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 7);
  }, [filteredAssessments, isFa]);

  // ── Dynamic Methods Aggregation ──
  const allDistinctMethods = getDistinctMethods(filteredAssessments);

  const methodStatsMap = useMemo(() => {
    const map: Record<
      string,
      {
        method: RiskMethod;
        total: number;
        critical: number;
        high: number;
        approved: number;
        lastDate?: string;
        meta: ReturnType<typeof getMethodMeta>;
      }
    > = {};

    allDistinctMethods.forEach(methodKey => {
      map[methodKey] = {
        method: methodKey,
        total: 0,
        critical: 0,
        high: 0,
        approved: 0,
        lastDate: undefined,
        meta: getMethodMeta(methodKey),
      };
    });

    filteredAssessments.forEach(a => {
      const key = (a.method || 'JSA').toUpperCase() as RiskMethod;
      if (!map[key]) {
        map[key] = {
          method: key,
          total: 0,
          critical: 0,
          high: 0,
          approved: 0,
          lastDate: undefined,
          meta: getMethodMeta(key),
        };
      }
      map[key].total += 1;
      if (a.overallRiskLevel === 'CRITICAL') map[key].critical += 1;
      if (a.overallRiskLevel === 'HIGH') map[key].high += 1;
      if (a.status === 'APPROVED') map[key].approved += 1;
      if (!map[key].lastDate || (a.assessmentDate && a.assessmentDate > (map[key].lastDate || ''))) {
        map[key].lastDate = a.assessmentDate;
      }
    });

    return map;
  }, [allDistinctMethods, filteredAssessments]);

  const dynamicMethodBarData = useMemo(
    () =>
      Object.values(methodStatsMap)
        .filter(item => item.method !== 'MATRIX')
        .map(item => ({
          name: item.meta.shortFa,
          methodKey: item.method,
          total: item.total,
          critical: item.critical,
          color: item.meta.chartColor,
        })),
    [methodStatsMap]
  );

  // Attention Queue: Under Review + Overdue CAPA assessments
  const attentionQueue = useMemo(() => {
    return filteredAssessments
      .map(a => {
        const overdueCount = (a.controlActions || []).filter(act =>
          act.status === 'OVERDUE' || isActionOverdue(act.deadline, act.status)
        ).length;
        const isPendingReview = a.status === 'UNDER_REVIEW';
        return { assessment: a, overdueCount, isPendingReview };
      })
      .filter(x => x.overdueCount > 0 || x.isPendingReview || x.assessment.residualRiskLevel === 'CRITICAL')
      .slice(0, 6);
  }, [filteredAssessments]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ── Interactive Filter Bar ── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-black text-slate-800 dark:text-slate-100">
              {isFa ? 'فیلترهای مدیریتی و تحلیلی داشبورد ریسک' : 'Risk Dashboard Filters'}
            </span>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
              ({filteredAssessments.length} {isFa ? 'از' : 'of'} {assessments.length} {isFa ? 'سند' : 'records'})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isFa ? 'بازنشانی فیلترها' : 'Reset'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => exportRiskRegisterToExcel(filteredAssessments, matrixConfig)}
              disabled={filteredAssessments.length === 0}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isFa ? 'خروجی اکسل رجیستر' : 'Export Excel'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              {isFa ? 'واحد عملیاتی / دپارتمان' : 'Unit / Department'}
            </label>
            <select
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value)}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">{isFa ? 'همه واحدها' : 'All Units'}</option>
              {distinctUnits.map(u => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              {isFa ? 'متدولوژی ارزیابی' : 'Methodology'}
            </label>
            <select
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value)}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">{isFa ? 'همه روش‌ها' : 'All Methods'}</option>
              {allDistinctMethods
                .filter(m => m !== 'MATRIX')
                .map(m => (
                  <option key={m} value={m}>
                    {getMethodMeta(m).shortFa}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              {isFa ? 'سطح ریسک کلی' : 'Risk Level'}
            </label>
            <select
              value={levelFilter}
              onChange={e => setLevelFilter(e.target.value)}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">{isFa ? 'تمام سطوح' : 'All Levels'}</option>
              <option value="CRITICAL">{isFa ? 'بحرانی (Critical)' : 'Critical'}</option>
              <option value="HIGH">{isFa ? 'بالا (High)' : 'High'}</option>
              <option value="MEDIUM">{isFa ? 'متوسط (Medium)' : 'Medium'}</option>
              <option value="LOW">{isFa ? 'پایین (Low)' : 'Low'}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              {isFa ? 'از تاریخ (شمسی)' : 'From Date'}
            </label>
            <PersianDatePicker
              value={dateFrom}
              onChange={v => setDateFrom(v)}
              isFa={isFa}
              placeholder={isFa ? 'مثال: 1404/01/01' : 'From'}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              {isFa ? 'تا تاریخ (شمسی)' : 'To Date'}
            </label>
            <PersianDatePicker
              value={dateTo}
              onChange={v => setDateTo(v)}
              isFa={isFa}
              placeholder={isFa ? 'مثال: 1404/12/29' : 'To'}
            />
          </div>
        </div>
      </div>

      {/* ── Executive KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Total & Workflow Status */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'کل پرونده‌های ارزیابی ریسک' : 'Total Risk Assessments'}
            </p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {totalCount}
            </h3>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400">
                {approvedCount} {isFa ? 'تاییدشده' : 'Approved'}
              </span>
              <span className="text-amber-600 dark:text-amber-400">
                {underReviewCount} {isFa ? 'در بازبینی' : 'Review'}
              </span>
              <span>
                {draftCount + archivedCount} {isFa ? 'پیش‌نویس/بایگانی' : 'Draft/Arch'}
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Critical & Residual Critical */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-red-200 dark:border-red-900/60 shadow-xs flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-red-700 dark:text-red-400">
              {isFa ? 'ریسک‌های بحرانی و بالا' : 'Critical & High Risks'}
            </p>
            <div className="flex items-baseline gap-2 mt-1 tabular-nums">
              <h3 className="text-2xl font-black text-red-600 dark:text-red-400">
                {criticalCount + highCount}
              </h3>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                ({criticalCount} {isFa ? 'بحرانی' : 'Crit'} / {highCount} {isFa ? 'بالا' : 'High'})
              </span>
            </div>
            <div className="text-[10px] font-bold mt-1.5 tabular-nums text-rose-700 dark:text-rose-300">
              {isFa ? 'باقیمانده بحرانی:' : 'Critical Residual:'} {criticalResidualCount}{' '}
              {isFa ? 'مورد' : ''} ({highResidualCount} {isFa ? 'بالا' : 'High'})
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: CAPA Actions Tracking */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'اقدامات اصلاحی و کنترلی (CAPA)' : 'CAPA Actions Status'}
            </p>
            <div className="flex items-baseline gap-2 mt-1 tabular-nums">
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {capaStats.open}
              </h3>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isFa ? 'اقدام باز' : 'Open'}
              </span>
            </div>
            <div className="text-[10px] font-bold mt-1.5 flex flex-wrap gap-x-2 tabular-nums">
              <span className={capaStats.overdue > 0 ? 'text-red-600 dark:text-red-400 font-black' : 'text-slate-500'}>
                {capaStats.overdue} {isFa ? 'معوقه' : 'Overdue'}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400">
                {capaStats.completed} {isFa ? 'تکمیل/بسته‌شده' : 'Completed'}
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Risk Reduction Index */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-xs flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              {isFa ? 'شاخص میانگین کاهش ریسک' : 'Avg Risk Reduction'}
            </p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {avgReductionPct}%
            </h3>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1.5 tabular-nums">
              {lowCount + mediumCount} {isFa ? 'پرونده در سطح قابل قبول/ALARP' : 'Low/Medium risk records'}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Charts Row (Initial vs Residual, Unit Breakdown, Methodologies) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 1: Initial vs Residual Risk */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {isFa ? 'مقایسه ریسک اولیه و ریسک باقیمانده' : 'Initial vs Residual Risk'}
            </h4>
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height={215} minWidth={0} minHeight={200} debounce={50}>
                <BarChart data={initialVsResidualChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.18} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 'bold',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  <Bar
                    dataKey="initial"
                    name={isFa ? 'ریسک اولیه' : 'Initial'}
                    fill="#f97316"
                    radius={[5, 5, 0, 0]}
                  />
                  <Bar
                    dataKey="residual"
                    name={isFa ? 'ریسک باقیمانده' : 'Residual'}
                    fill="#10b981"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Chart 2: Unit Breakdown */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              {isFa ? 'پراکندگی ریسک بر حسب واحد عملیاتی' : 'Risk Breakdown by Unit'}
            </h4>
            <div className="h-56 w-full min-w-0">
              {unitChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={215} minWidth={0} minHeight={200} debounce={50}>
                  <BarChart data={unitChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.18} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 'bold',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <Bar
                      dataKey="criticalHigh"
                      stackId="u"
                      name={isFa ? 'بحرانی / بالا' : 'Critical / High'}
                      fill="#ef4444"
                    />
                    <Bar
                      dataKey="mediumLow"
                      stackId="u"
                      name={isFa ? 'متوسط / پایین' : 'Medium / Low'}
                      fill="#3b82f6"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs font-bold text-slate-400">
                  {isFa ? 'داده‌ای برای نمایش وجود ندارد' : 'No unit data'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chart 3: Dynamic Methodologies Distribution */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {isFa ? 'توزیع پرونده‌ها به تفکیک روش‌ها' : 'Assessments by Methodology'}
            </h4>
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height={215} minWidth={0} minHeight={200} debounce={50}>
                <BarChart data={dynamicMethodBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.18} vertical={false} />
                  <XAxis dataKey="methodKey" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 'bold',
                    }}
                    formatter={(val: any) => [val, isFa ? 'تعداد پرونده' : 'Records']}
                    labelFormatter={label => {
                      const meta = getMethodMeta(String(label));
                      return isFa ? meta.titleFa : meta.titleEn;
                    }}
                  />
                  <Bar dataKey="total" name={isFa ? 'تعداد' : 'Total'} radius={[5, 5, 0, 0]}>
                    {dynamicMethodBarData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color || '#4f46e5'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ── Attention Queue: Pending Reviews, Overdue CAPAs, Critical Residuals ── */}
      {attentionQueue.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              {isFa
                ? 'کارتابل فوری: پرونده‌های نیازمند بازبینی، اقدام معوقه یا ریسک باقیمانده بحرانی'
                : 'Attention Queue: Pending Reviews & Overdue Actions'}
            </h4>
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 tabular-nums">
              {attentionQueue.length} {isFa ? 'مورد اولویت‌دار' : 'Priority items'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {attentionQueue.map(({ assessment, overdueCount, isPendingReview }) => {
              const statusMeta = getStatusBadgeMeta(assessment.status, isFa);
              return (
                <div
                  key={assessment.id}
                  onClick={() => (onEditAssessment ? onEditAssessment(assessment) : onViewAssessment(assessment))}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:border-indigo-400 dark:hover:border-indigo-500 transition cursor-pointer flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400" dir="ltr">
                      {assessment.code}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <div className="text-xs font-black text-slate-800 dark:text-slate-100 line-clamp-1">
                    {assessment.title}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    <span>{assessment.unit}</span>
                    <div className="flex items-center gap-2 tabular-nums">
                      {overdueCount > 0 && (
                        <span className="text-red-600 dark:text-red-400 font-black">
                          {overdueCount} {isFa ? 'اقدام معوقه' : 'overdue'}
                        </span>
                      )}
                      {isPendingReview && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {isFa ? 'منتظر تایید' : 'Pending'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── All 8 Methodologies Summary Table ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {isFa ? 'جدول تجمیعی وضعیت ۸ تب تخصصی ارزیابی ریسک' : 'Risk Assessment Methodologies Summary'}
          </h4>
        </div>

        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="p-3 font-bold whitespace-nowrap">{isFa ? 'تب / متدولوژی' : 'Method'}</th>
                <th className="p-3 font-bold">{isFa ? 'عنوان و دامنه کاربرد' : 'Scope'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'پرونده‌ها' : 'Records'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'بحرانی' : 'Critical'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'مصوب' : 'Approved'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'آخرین تاریخ' : 'Last Date'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'دسترسی سریع' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {Object.values(methodStatsMap).map(item => {
                const isMatrix = item.method === 'MATRIX';
                return (
                  <tr key={item.method} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectMethod(item.method)}
                        className="font-mono font-black text-xs px-2.5 py-1 rounded-lg text-white cursor-pointer hover:opacity-90 inline-flex items-center gap-1 shadow-xs"
                        style={{ backgroundColor: item.meta.chartColor }}
                      >
                        {isMatrix && <Grid3X3 className="w-3.5 h-3.5" />}
                        <span>{item.meta.shortFa}</span>
                      </button>
                    </td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                      <div>{isFa ? item.meta.titleFa : item.meta.titleEn}</div>
                      <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400 truncate max-w-md mt-0.5">
                        {isFa ? item.meta.descFa : item.meta.titleEn}
                      </div>
                    </td>
                    <td className="p-3 text-center font-black text-slate-800 dark:text-slate-100 tabular-nums">
                      {isMatrix ? filteredAssessments.length : item.total}
                    </td>
                    <td className="p-3 text-center tabular-nums">
                      {item.critical > 0 ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800">
                          {item.critical}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                      {isMatrix ? approvedCount : item.approved}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-500 text-center whitespace-nowrap" dir="ltr">
                      {item.lastDate || (isMatrix ? (isFa ? 'فعال و پویا' : 'Live') : (isFa ? 'ثبت نشده' : 'None'))}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectMethod(item.method)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-bold rounded-lg transition text-[11px] cursor-pointer"
                        >
                          {isMatrix ? (isFa ? 'گشودن ماتریس' : 'Open Matrix') : (isFa ? 'مشاهده کارتابل' : 'View Records')}
                        </button>
                        {!isMatrix && (
                          <button
                            type="button"
                            onClick={() => onNewAssessment(item.method)}
                            className="p-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition cursor-pointer"
                            title={isFa ? 'ثبت ارزیابی جدید' : 'New Assessment'}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Latest Assessments List ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            {isFa ? 'آخرین ارزیابی‌های ریسک ثبت‌شده' : 'Latest Risk Assessments'}
          </h4>
          <button
            type="button"
            onClick={() => onNewAssessment()}
            className="text-xs font-black text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors cursor-pointer"
          >
            {isFa ? '+ ثبت ارزیابی جدید' : '+ New Assessment'}
          </button>
        </div>

        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="p-3 font-bold whitespace-nowrap">{isFa ? 'کد سند' : 'Doc Code'}</th>
                <th className="p-3 font-bold min-w-[190px]">{isFa ? 'عنوان ارزیابی' : 'Title'}</th>
                <th className="p-3 font-bold whitespace-nowrap text-center">{isFa ? 'متدولوژی' : 'Method'}</th>
                <th className="p-3 font-bold min-w-[150px]">{isFa ? 'واحد / موقعیت' : 'Unit / Location'}</th>
                <th className="p-3 font-bold whitespace-nowrap text-center">{isFa ? 'تاریخ' : 'Date'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'ریسک اولیه' : 'Initial Risk'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'ریسک باقیمانده' : 'Residual Risk'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'وضعیت' : 'Status'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'عملیات' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAssessments.slice(0, 10).map(item => {
                const initColors = getRiskLevelColor(item.overallRiskLevel);
                const resColors = getRiskLevelColor(item.residualRiskLevel || 'LOW');
                const methodMeta = getMethodMeta(item.method);
                const statusMeta = getStatusBadgeMeta(item.status, isFa);
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => onViewAssessment(item)}
                  >
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className="font-mono font-bold text-indigo-600 dark:text-indigo-400 inline-block px-2 py-0.5 rounded-md bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-[11px]"
                        dir="ltr"
                      >
                        {item.code}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200 max-w-xs">
                      <div className="truncate">{item.title}</div>
                      <div className="text-[10px] font-normal text-slate-400">{item.assessorName}</div>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-black text-white"
                        style={{ backgroundColor: methodMeta.chartColor }}
                      >
                        {methodMeta.shortFa}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {item.unit} {item.areaLocation ? `- ${item.areaLocation}` : ''}
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px] text-center whitespace-nowrap" dir="ltr">
                      {item.assessmentDate}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-[10px] font-black ${initColors.badge}`}>
                        {isFa ? initColors.shortLabelFa : initColors.shortLabelEn}
                      </span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-[10px] font-black ${resColors.badge}`}>
                        {isFa ? resColors.shortLabelFa : resColors.shortLabelEn}
                      </span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            if (onPrintAssessment) onPrintAssessment(item);
                            else onViewAssessment(item);
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 text-[11px] cursor-pointer"
                          title={isFa ? 'مشاهده و چاپ' : 'View & Print'}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{isFa ? 'چاپ' : 'Print'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            if (onEditAssessment) onEditAssessment(item);
                            else onViewAssessment(item);
                          }}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-lg transition cursor-pointer"
                          title={isFa ? 'ویرایش سند' : 'Edit'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteAssessment && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              onDeleteAssessment(item);
                            }}
                            className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-500 hover:text-red-700 dark:text-red-400 rounded-lg transition cursor-pointer"
                            title={isFa ? 'حذف سند' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredAssessments.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-bold text-xs">
                    {isFa ? 'موردی مطابق با فیلترهای انتخابی یافت نشد.' : 'No assessments match current filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
