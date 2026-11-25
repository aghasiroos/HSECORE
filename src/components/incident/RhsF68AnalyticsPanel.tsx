import React, { useMemo, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  ShieldAlert,
  BarChart3,
  Activity,
  Building2,
  Calendar,
  Search,
  Eye,
  RotateCcw,
  Layers,
  AlertTriangle,
  ArrowUpDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { SafetyIncidentRecord } from '../../types';
import {
  RHS_F68_FACTOR_CATEGORIES,
  WORKFLOW_STAGE_META,
  extractIncidentShamsiYear,
  getAvailableIncidentYears,
  getCorrectiveOverdueInfo,
  getIncidentWorkflowStage,
} from '../../utils/rhsF68Config';
import { toPersianDigits } from '../../utils/jalaliDate';

export type AnalyticsSectionMode = 'all' | 'analytics' | 'overdue';

interface RhsF68AnalyticsPanelProps {
  incidents: SafetyIncidentRecord[];
  onSelectIncident: (inc: SafetyIncidentRecord) => void;
  departmentList?: string[];
  sectionMode?: AnalyticsSectionMode;
  isFa?: boolean;
}

const RPN_BANDS = [
  {
    key: 'E',
    labelFa: 'شدید / بارز (E)',
    labelEn: 'Extreme (E)',
    range: '50–125',
    color: '#e11d48',
    textClass: 'text-rose-700 dark:text-rose-400',
    barClass: 'bg-rose-600',
  },
  {
    key: 'H',
    labelFa: 'بالا (H)',
    labelEn: 'High (H)',
    range: '25–49',
    color: '#f97316',
    textClass: 'text-orange-700 dark:text-orange-400',
    barClass: 'bg-orange-500',
  },
  {
    key: 'M',
    labelFa: 'متوسط (M)',
    labelEn: 'Medium (M)',
    range: '11–24',
    color: '#f59e0b',
    textClass: 'text-amber-700 dark:text-amber-400',
    barClass: 'bg-amber-500',
  },
  {
    key: 'L',
    labelFa: 'پایین (L)',
    labelEn: 'Low (L)',
    range: '1–10',
    color: '#10b981',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    barClass: 'bg-emerald-500',
  },
] as const;

export const RhsF68AnalyticsPanel: React.FC<RhsF68AnalyticsPanelProps> = ({
  incidents,
  onSelectIncident,
  departmentList = [],
  sectionMode = 'all',
  isFa = true,
}) => {
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [overdueSearch, setOverdueSearch] = useState<string>('');
  const [overdueSort, setOverdueSort] = useState<'days' | 'rpn'>('days');

  const fmtNum = (val: number | string) => (isFa ? toPersianDigits(String(val)) : String(val));

  // Dynamic years strictly from actual ledger records (no hardcoded default year)
  const availableYears = useMemo(() => getAvailableIncidentYears(incidents), [incidents]);

  const availableDepartments = useMemo(() => {
    const set = new Set<string>(departmentList.map((d) => d.trim()).filter(Boolean));
    incidents.forEach((inc) => {
      const dept = (inc.department || '').trim();
      if (dept) set.add(dept);
    });
    return Array.from(set);
  }, [departmentList, incidents]);

  const scopedIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (yearFilter !== 'ALL' && extractIncidentShamsiYear(inc) !== yearFilter) return false;
      if (deptFilter !== 'ALL' && (inc.department || '').trim() !== deptFilter.trim()) return false;
      return true;
    });
  }, [incidents, yearFilter, deptFilter]);

  const hasFilters = yearFilter !== 'ALL' || deptFilter !== 'ALL';

  const analytics = useMemo(() => {
    const total = scopedIncidents.length;
    let drafts = 0;
    let pendingHse = 0;
    let inExpertOrAction = 0;
    let pendingFinal = 0;
    let closed = 0;

    const rpnCounts: Record<'L' | 'M' | 'H' | 'E', number> = { L: 0, M: 0, H: 0, E: 0 };
    let rpnSum = 0;
    let rpnRatedCount = 0;
    let maxRpn = 0;

    const factorFreq: Record<string, number> = {};
    const deptMap: Record<
      string,
      { dept: string; total: number; highRisk: number; overdue: number }
    > = {};

    const overdueAll: Array<{
      inc: SafetyIncidentRecord;
      overdue: ReturnType<typeof getCorrectiveOverdueInfo>;
      rpn: number;
      riskLevelFa: string;
    }> = [];

    scopedIncidents.forEach((inc) => {
      const st = getIncidentWorkflowStage(inc);
      if (st === 'DRAFT') drafts++;
      else if (st === 'HSE_HEAD_TRIAGE') pendingHse++;
      else if (st === 'HSE_EXPERT_REVIEW' || st === 'ACTION_IN_PROGRESS') inExpertOrAction++;
      else if (st === 'HSE_FINAL_APPROVAL') pendingFinal++;
      else if (st === 'CLOSED') closed++;

      const rpn = inc.riskAssessment?.rpn ?? inc.rhsF68?.riskAssessment?.rpn;
      const riskLevelFa =
        inc.riskAssessment?.riskLevelFa ?? inc.rhsF68?.riskAssessment?.riskLevelFa ?? '—';
      let isHighRisk = false;
      if (typeof rpn === 'number' && rpn > 0) {
        rpnRatedCount++;
        rpnSum += rpn;
        if (rpn > maxRpn) maxRpn = rpn;
        if (rpn >= 50) {
          rpnCounts.E++;
          isHighRisk = true;
        } else if (rpn >= 25) {
          rpnCounts.H++;
          isHighRisk = true;
        } else if (rpn >= 11) {
          rpnCounts.M++;
        } else {
          rpnCounts.L++;
        }
      }

      const overdue = getCorrectiveOverdueInfo(inc);
      if (overdue.isOverdue) {
        overdueAll.push({ inc, overdue, rpn: typeof rpn === 'number' ? rpn : 0, riskLevelFa });
      }

      const factors = inc.rhsF68?.eventFactors;
      if (factors) {
        RHS_F68_FACTOR_CATEGORIES.forEach((cat) => {
          const items = factors[cat.key]?.selectedItems || [];
          if (items.length > 0) {
            factorFreq[cat.titleFa] = (factorFreq[cat.titleFa] || 0) + items.length;
          }
        });
      }

      const deptName = (inc.department || '').trim() || (isFa ? 'واحد نامشخص' : 'Unassigned');
      if (!deptMap[deptName]) {
        deptMap[deptName] = { dept: deptName, total: 0, highRisk: 0, overdue: 0 };
      }
      deptMap[deptName].total++;
      if (isHighRisk) deptMap[deptName].highRisk++;
      if (overdue.isOverdue) deptMap[deptName].overdue++;
    });

    const avgRpn = rpnRatedCount > 0 ? Math.round((rpnSum / rpnRatedCount) * 10) / 10 : 0;
    const highCriticalCount = rpnCounts.H + rpnCounts.E;
    const closureRate = total > 0 ? Math.round((closed / total) * 100) : 0;

    const rpnBreakdown = RPN_BANDS.map((band) => ({
      ...band,
      name: isFa ? band.labelFa : band.labelEn,
      value: rpnCounts[band.key],
      pct: rpnRatedCount > 0 ? Math.round((rpnCounts[band.key] / rpnRatedCount) * 100) : 0,
    }));

    const rpnChartData = rpnBreakdown.filter((b) => b.value > 0);

    const factorChartData = RHS_F68_FACTOR_CATEGORIES.map((cat) => ({
      name: isFa ? cat.titleFa.replace(/^[۰-۹\d]+\.\s*/, '') : cat.titleEn,
      count: factorFreq[cat.titleFa] || 0,
    })).sort((a, b) => b.count - a.count);

    const totalFactorSelections = factorChartData.reduce((acc, cur) => acc + cur.count, 0);

    const categoryBreakdown = [
      {
        key: 'Unsafe Act',
        name: isFa ? 'رفتار ناایمن (Unsafe Act)' : 'Unsafe Act',
        count: scopedIncidents.filter((i) => i.category === 'Unsafe Act').length,
        barClass: 'bg-amber-500',
      },
      {
        key: 'Unsafe Condition',
        name: isFa ? 'شرایط ناایمن (Unsafe Condition)' : 'Unsafe Condition',
        count: scopedIncidents.filter((i) => i.category === 'Unsafe Condition').length,
        barClass: 'bg-indigo-500',
      },
      {
        key: 'Near Miss',
        name: isFa ? 'شبه‌حادثه (Near Miss)' : 'Near Miss',
        count: scopedIncidents.filter((i) => i.category === 'Near Miss').length,
        barClass: 'bg-sky-500',
      },
      {
        key: 'Incident',
        name: isFa ? 'حادثه / رویداد' : 'Incident',
        count: scopedIncidents.filter((i) => i.category === 'Incident').length,
        barClass: 'bg-rose-600',
      },
      {
        key: 'Toxic Gas Leak',
        name: isFa ? 'نشت گازهای سمی' : 'Toxic Gas Leak',
        count: scopedIncidents.filter((i) => i.category === 'Toxic Gas Leak').length,
        barClass: 'bg-purple-600',
      },
    ].filter((c) => c.count > 0 || total === 0);

    const topDepartments = Object.values(deptMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    const workflowStages = [
      {
        key: 'draft',
        label: isFa ? 'پیش‌نویس' : 'Draft',
        count: drafts,
        barClass: 'bg-slate-400',
        textClass: 'text-slate-700 dark:text-slate-300',
      },
      {
        key: 'triage',
        label: isFa ? 'بررسی رئیس HSE' : 'HSE Triage',
        count: pendingHse,
        barClass: 'bg-amber-500',
        textClass: 'text-amber-700 dark:text-amber-400',
      },
      {
        key: 'action',
        label: isFa ? 'کارشناسی و اقدام' : 'Expert & CAPA',
        count: inExpertOrAction,
        barClass: 'bg-indigo-600',
        textClass: 'text-indigo-700 dark:text-indigo-400',
      },
      {
        key: 'final',
        label: isFa ? 'تأیید نهایی' : 'Final Sign-off',
        count: pendingFinal,
        barClass: 'bg-sky-500',
        textClass: 'text-sky-700 dark:text-sky-400',
      },
      {
        key: 'closed',
        label: isFa ? 'مختومه' : 'Closed',
        count: closed,
        barClass: 'bg-emerald-600',
        textClass: 'text-emerald-700 dark:text-emerald-400',
      },
    ];

    return {
      total,
      avgRpn,
      maxRpn,
      rpnRatedCount,
      highCriticalCount,
      closureRate,
      overdueAll,
      rpnBreakdown,
      rpnChartData,
      factorChartData,
      totalFactorSelections,
      categoryBreakdown,
      topDepartments,
      workflowStages,
    };
  }, [scopedIncidents, isFa]);

  const filteredOverdueList = useMemo(() => {
    const q = overdueSearch.trim().toLowerCase();
    const list = analytics.overdueAll.filter(({ inc }) => {
      if (!q) return true;
      const hay = [
        inc.reportNumber,
        inc.title,
        inc.department,
        inc.rhsF68?.correctiveFollowUp?.responsibleUnit,
        inc.rhsF68?.hseUnitReview?.assignedExpertName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });

    return [...list].sort((a, b) =>
      overdueSort === 'rpn'
        ? b.rpn - a.rpn || b.overdue.daysOverdue - a.overdue.daysOverdue
        : b.overdue.daysOverdue - a.overdue.daysOverdue
    );
  }, [analytics.overdueAll, overdueSearch, overdueSort]);

  const showAnalyticsSections = sectionMode === 'all' || sectionMode === 'analytics';
  const showOverdueSection = sectionMode === 'all' || sectionMode === 'overdue';

  return (
    <div dir={isFa ? 'rtl' : 'ltr'} className="space-y-6">
      {/* UNIFIED ANALYTICS CONTROL BAR */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              {sectionMode === 'overdue'
                ? isFa
                  ? 'مدیریت و پیگیری اقدامات اصلاحی معوق'
                  : 'Overdue Corrective Actions Tracker'
                : isFa
                ? 'تحلیل آماری، ارزیابی ریسک RPN و پایش اقدامات معوق'
                : 'Statistical Analytics, RPN Risk & Overdue CAPA'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isFa
              ? 'پایش زنده شاخص‌های ریسک (RPN)، فراوانی ۸ دسته‌بندی عوامل، پراکندگی واحدها و اقدامات گذشته از سررسید'
              : 'Live insights across RPN severity bands, 8-factor classification, departmental distribution, and overdue actions'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Dynamic Year Select — only years present in ledger */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              disabled={availableYears.length === 0}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="ALL">
                {availableYears.length > 0
                  ? isFa
                    ? 'همه سال‌های ثبت‌شده'
                    : 'All Recorded Years'
                  : isFa
                  ? 'بدون سال ثبت‌شده'
                  : 'No Years Logged'}
              </option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {isFa ? `سال ${fmtNum(yr)}` : yr}
                </option>
              ))}
            </select>
          </div>

          {/* Department Select */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">{isFa ? 'همه واحدهای سازمانی' : 'All Departments'}</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setYearFilter('ALL');
                setDeptFilter('ALL');
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isFa ? 'بازنشانی' : 'Reset'}</span>
            </button>
          )}
        </div>
      </div>

      {/* EXECUTIVE KPI STRIP (FLAT 5-COLUMN HAIRLINE GRID) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>{isFa ? 'کل گزارش‌های بازه' : 'Total Reports'}</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
            {fmtNum(analytics.total)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {isFa ? 'ثبت‌شده در دفتر گزارشات' : 'From Incident Ledger'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>{isFa ? 'میانگین / بیشینه RPN' : 'Avg / Max RPN'}</span>
            <Activity className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono tabular-nums text-indigo-700 dark:text-indigo-400">
              {analytics.rpnRatedCount > 0 ? fmtNum(analytics.avgRpn) : '—'}
            </span>
            {analytics.maxRpn > 0 && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {isFa ? 'بیشینه:' : 'Max:'}{' '}
                <strong className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                  {fmtNum(analytics.maxRpn)}
                </strong>
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums">{fmtNum(analytics.rpnRatedCount)}</span>{' '}
            <span>{isFa ? 'مورد ارزیابی‌شده' : 'assessed'}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>{isFa ? 'ریسک بالا و شدید (H/E)' : 'High / Extreme Risk'}</span>
            <ShieldAlert className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-orange-600 dark:text-orange-400">
            {fmtNum(analytics.highCriticalCount)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {isFa ? 'امتیاز RPN برابر یا بیش از ۲۵' : 'RPN score ≥ 25'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>{isFa ? 'نرخ مختومه‌سازی' : 'Closure Rate'}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {fmtNum(analytics.closureRate)}%
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {isFa ? 'تأیید نهایی و بسته‌شده' : 'Verified & closed'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>{isFa ? 'اقدامات اصلاحی معوق' : 'Overdue CAPAs'}</span>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {fmtNum(analytics.overdueAll.length)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {isFa ? 'گذشته از تاریخ سررسید' : 'Past target deadline'}
          </div>
        </div>
      </div>

      {/* ANALYTICS VISUALIZATIONS */}
      {showAnalyticsSections && (
        <>
          {/* WORKFLOW PIPELINE DISTRIBUTION */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {isFa ? 'وضعیت پرونده‌ها در مراحل گردش کار' : 'Workflow Stage Pipeline'}
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isFa ? 'توزیع ۵ مرحله‌ای پرونده‌های باز و مختومه' : 'Distribution across 5 workflow stages'}
              </span>
            </div>

            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
              {analytics.total > 0 ? (
                analytics.workflowStages.map((stage) =>
                  stage.count > 0 ? (
                    <div
                      key={stage.key}
                      className={`${stage.barClass} h-full transition-all duration-300`}
                      style={{ width: `${(stage.count / analytics.total) * 100}%` }}
                      title={`${stage.label}: ${stage.count}`}
                    />
                  ) : null
                )
              ) : (
                <div className="w-full h-full bg-slate-200 dark:bg-slate-800" />
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
              {analytics.workflowStages.map((stage) => {
                const share =
                  analytics.total > 0 ? Math.round((stage.count / analytics.total) * 100) : 0;
                return (
                  <div
                    key={stage.key}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50/70 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                        {stage.label}
                      </div>
                      <div className="text-[10px] font-mono tabular-nums text-slate-400">
                        {fmtNum(share)}%
                      </div>
                    </div>
                    <span className={`text-lg font-black font-mono tabular-nums ${stage.textClass}`}>
                      {fmtNum(stage.count)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ROW 1 CHARTS: RPN DONUT + 8-FACTOR HORIZONTAL BAR */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
            {/* RPN Risk Level Donut + Structured Breakdown */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>
                      {isFa
                        ? 'توزیع سطح ریسک ارزیابی‌شده (RPN)'
                        : 'RPN Risk Level Distribution'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFa
                      ? 'بر اساس حاصل‌ضرب احتمال × شدت × قابلیت کشف (۱ تا ۱۲۵)'
                      : 'Based on Probability × Severity × Detection (1–125)'}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums font-bold text-slate-500 dark:text-slate-400">
                  {fmtNum(analytics.rpnRatedCount)} {isFa ? 'مورد' : 'rated'}
                </span>
              </div>

              {analytics.rpnChartData.length === 0 ? (
                <div className="flex-1 min-h-[240px] flex flex-col items-center justify-center text-center gap-2 text-slate-400">
                  <ShieldAlert className="w-7 h-7 text-slate-300 dark:text-slate-700" />
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {isFa
                      ? 'هنوز ارزیابی ریسک RPN در این بازه ثبت نشده است.'
                      : 'No RPN risk assessments recorded yet.'}
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    {isFa
                      ? 'پس از تکمیل ارزیابی کارشناس HSE در پرونده‌های ثبت‌شده، نمودار سطح ریسک به‌صورت خودکار به‌روز می‌شود.'
                      : 'Risk level distribution updates automatically as HSE experts score incoming reports.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center flex-1">
                  <div className="relative h-60 w-full min-w-0">
                    <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={220}>
                      <PieChart>
                        <Pie
                          data={analytics.rpnChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={58}
                          outerRadius={88}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {analytics.rpnChartData.map((entry) => (
                            <Cell key={entry.key} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => [
                            `${fmtNum(value)} ${isFa ? 'پرونده' : 'cases'}`,
                            isFa ? 'تعداد' : 'Count',
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                        {fmtNum(analytics.rpnRatedCount)}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isFa ? 'ارزیابی RPN' : 'Scored'}
                      </span>
                    </div>
                  </div>

                  {/* Clean Structured Breakdown Table */}
                  <div className="space-y-3">
                    {analytics.rpnBreakdown.map((band) => (
                      <div key={band.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{ backgroundColor: band.color }}
                            />
                            <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                              {band.name}
                            </span>
                            <span className="font-mono tabular-nums text-[10px] text-slate-400">
                              ({band.range})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-mono tabular-nums font-black ${band.textClass}`}>
                              {fmtNum(band.value)}
                            </span>
                            <span className="font-mono tabular-nums text-[11px] text-slate-400 w-9 text-left">
                              {fmtNum(band.pct)}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`${band.barClass} h-full rounded-full transition-all duration-300`}
                            style={{ width: `${band.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 8-Factor Event Breakdown — Horizontal BarChart for crisp Persian RTL readability */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <span>
                      {isFa
                        ? 'فراوانی ۸ دسته‌بندی عوامل رویداد'
                        : '8-Category Event Factor Frequency'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFa
                      ? 'رتبه‌بندی پرتکرارترین عوامل شناسایی‌شده در گزارش‌های بررسی‌شده'
                      : 'Ranked frequency of contributing factors across reviewed reports'}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums font-bold text-slate-500 dark:text-slate-400">
                  {fmtNum(analytics.totalFactorSelections)} {isFa ? 'عامل' : 'tags'}
                </span>
              </div>

              {analytics.totalFactorSelections === 0 ? (
                <div className="flex-1 min-h-[240px] flex flex-col items-center justify-center text-center gap-2 text-slate-400">
                  <BarChart3 className="w-7 h-7 text-slate-300 dark:text-slate-700" />
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {isFa
                      ? 'هنوز عاملی در دسته‌بندی ۸ گانه ثبت نشده است.'
                      : 'No event factor classifications recorded yet.'}
                  </p>
                </div>
              ) : (
                <div className="h-64 w-full min-w-0">
                  <ResponsiveContainer width="100%" height={256} minWidth={0} minHeight={230}>
                    <BarChart
                      data={analytics.factorChartData}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={118}
                        tick={{ fontSize: 11, fill: '#475569' }}
                      />
                      <Tooltip
                        formatter={(value: any) => [
                          `${fmtNum(value)} ${isFa ? 'مورد' : 'items'}`,
                          isFa ? 'فراوانی' : 'Frequency',
                        ]}
                      />
                      <Bar
                        dataKey="count"
                        fill="#4f46e5"
                        radius={[0, 6, 6, 0]}
                        barSize={18}
                        name={isFa ? 'تعداد موارد' : 'Count'}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* ROW 2: CATEGORY BREAKDOWN + TOP DEPARTMENTS RISK MATRIX */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
            {/* Consolidated Category Distribution (Replaces old duplicate PieChart in IncidentReporting.tsx) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {isFa ? 'توزیع انواع گزارش‌های ثبت‌شده' : 'Report Category Distribution'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFa
                      ? 'سهم تفکیکی رفتار ناایمن، شرایط ناایمن، شبه‌حادثه و حوادث'
                      : 'Share of unsafe acts, unsafe conditions, near misses & incidents'}
                  </p>
                </div>
                <span className="font-mono tabular-nums text-xs font-bold text-slate-500">
                  {fmtNum(analytics.total)} {isFa ? 'کل' : 'total'}
                </span>
              </div>

              {analytics.total === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  {isFa
                    ? 'با ثبت اولین گزارش در دفتر ثبت، تفکیک انواع گزارش نمایش داده می‌شود.'
                    : 'Submit a report to populate category breakdown.'}
                </div>
              ) : (
                <div className="space-y-3.5">
                  {analytics.categoryBreakdown.map((cat) => {
                    const share =
                      analytics.total > 0 ? Math.round((cat.count / analytics.total) * 100) : 0;
                    return (
                      <div key={cat.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {cat.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                              {fmtNum(cat.count)}
                            </span>
                            <span className="font-mono tabular-nums text-[11px] text-slate-400 w-9 text-left">
                              {fmtNum(share)}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`${cat.barClass} h-full rounded-full transition-all duration-300`}
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Departments Breakdown */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <span>
                      {isFa
                        ? 'کانون‌های پرتکرار بر اساس واحد سازمانی'
                        : 'Top Reporting Departments'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFa
                      ? 'تعداد گزارش، ریسک‌های بالا/شدید و اقدامات معوق هر واحد'
                      : 'Volume, High/Extreme risk & overdue count per unit'}
                  </p>
                </div>
              </div>

              {analytics.topDepartments.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  {isFa ? 'داده‌ای برای نمایش واحدها وجود ندارد.' : 'No departmental data yet.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        <th className="pb-2.5">{isFa ? 'واحد سازمانی' : 'Department'}</th>
                        <th className="pb-2.5 text-center">{isFa ? 'کل گزارش' : 'Total'}</th>
                        <th className="pb-2.5 text-center">{isFa ? 'ریسک H/E' : 'H/E Risk'}</th>
                        <th className="pb-2.5 text-center">{isFa ? 'معوق' : 'Overdue'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {analytics.topDepartments.map((row) => (
                        <tr
                          key={row.dept}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-2.5 font-bold text-slate-800 dark:text-slate-100 truncate max-w-[180px]">
                            {row.dept}
                          </td>
                          <td className="py-2.5 text-center font-mono tabular-nums font-black text-slate-900 dark:text-white">
                            {fmtNum(row.total)}
                          </td>
                          <td className="py-2.5 text-center font-mono tabular-nums font-bold">
                            <span
                              className={
                                row.highRisk > 0
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-slate-400'
                              }
                            >
                              {fmtNum(row.highRisk)}
                            </span>
                          </td>
                          <td className="py-2.5 text-center font-mono tabular-nums font-bold">
                            <span
                              className={
                                row.overdue > 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-400'
                              }
                            >
                              {fmtNum(row.overdue)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* OVERDUE CORRECTIVE ACTIONS QUEUE */}
      {showOverdueSection && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-600" />
                <span>
                  {isFa
                    ? 'فهرست اقدامات اصلاحی معوق (گذشته از سررسید)'
                    : 'Overdue Corrective Actions Queue'}
                </span>
                <span className="font-mono tabular-nums text-xs font-black text-rose-600 dark:text-rose-400">
                  ({fmtNum(analytics.overdueAll.length)})
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isFa
                  ? 'پرونده‌هایی که مهلت اجرای اقدام اصلاحی آن‌ها سپری شده و هنوز مختومه نشده‌اند'
                  : 'Open reports whose corrective action target date has passed'}
              </p>
            </div>

            {analytics.overdueAll.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-60">
                  <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={overdueSearch}
                    onChange={(e) => setOverdueSearch(e.target.value)}
                    placeholder={isFa ? 'جستجو در کد، عنوان یا واحد...' : 'Search overdue...'}
                    className="w-full pr-9 pl-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOverdueSort((s) => (s === 'days' ? 'rpn' : 'days'))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {overdueSort === 'days'
                      ? isFa
                        ? 'مرتب‌سازی: بیشترین تأخیر'
                        : 'Sort: Most Overdue'
                      : isFa
                      ? 'مرتب‌سازی: بالاترین RPN'
                      : 'Sort: Highest RPN'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {analytics.overdueAll.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                {isFa
                  ? 'در حال حاضر هیچ اقدام اصلاحی معوقی در این بازه وجود ندارد.'
                  : 'No overdue corrective actions in this scope.'}
              </p>
            </div>
          ) : filteredOverdueList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              {isFa
                ? 'موردی مطابق با عبارت جستجو یافت نشد.'
                : 'No overdue actions matched your search.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-4">{isFa ? 'شماره گزارش' : 'Report ID'}</th>
                    <th className="py-2.5 px-4">{isFa ? 'عنوان و واحد مسئول' : 'Title & Unit'}</th>
                    <th className="py-2.5 px-4">{isFa ? 'کارشناس / مرحله' : 'Expert / Stage'}</th>
                    <th className="py-2.5 px-4 text-center">{isFa ? 'سطح RPN' : 'RPN'}</th>
                    <th className="py-2.5 px-4 text-center">{isFa ? 'تاریخ سررسید' : 'Due Date'}</th>
                    <th className="py-2.5 px-4 text-center">{isFa ? 'میزان تأخیر' : 'Overdue'}</th>
                    <th className="py-2.5 px-4 text-center">{isFa ? 'عملیات' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredOverdueList.map(({ inc, overdue, rpn, riskLevelFa }) => {
                    const st = getIncidentWorkflowStage(inc);
                    const responsibleUnit =
                      inc.rhsF68?.correctiveFollowUp?.responsibleUnit || inc.department || '—';
                    const expertName = inc.rhsF68?.hseUnitReview?.assignedExpertName || '—';
                    const rpnClass =
                      rpn >= 50
                        ? 'text-rose-700 dark:text-rose-400'
                        : rpn >= 25
                        ? 'text-orange-700 dark:text-orange-400'
                        : rpn >= 11
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-slate-600 dark:text-slate-300';

                    return (
                      <tr
                        key={inc.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono tabular-nums font-black text-rose-700 dark:text-rose-400 whitespace-nowrap">
                          {inc.reportNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100 max-w-xs truncate">
                            {inc.title || '—'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {responsibleUnit}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-700 dark:text-slate-200">
                            {expertName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {WORKFLOW_STAGE_META[st].labelFa}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {rpn > 0 ? (
                            <div className={`font-black ${rpnClass}`}>
                              <span className="font-mono tabular-nums">{fmtNum(rpn)}</span>
                              <span className="block text-[10px] font-medium opacity-80">
                                {riskLevelFa}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {overdue.dueDate ? fmtNum(overdue.dueDate) : '—'}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-bold text-rose-700 dark:text-rose-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span className="font-mono tabular-nums font-black">
                              {fmtNum(overdue.daysOverdue)}
                            </span>
                            <span>{isFa ? 'روز تأخیر' : 'days'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => onSelectIncident(inc)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-900 hover:text-white dark:hover:bg-indigo-600 text-slate-700 dark:text-slate-200 font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isFa ? 'بررسی پرونده' : 'Inspect'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
