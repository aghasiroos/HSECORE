import React, { useMemo, useState, useEffect } from 'react';
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, 
  BarChart3, Activity, ArrowUpRight, Plus, Clock,
  Hash, Bell, Truck, Scale, CalendarCheck, RefreshCw,
  Eye, Sliders, CheckCheck, Archive, FileText, ArrowRight,
  TrendingUp, Check, Layers, AlertOctagon, RotateCw
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, LabelList, Legend
} from 'recharts';
import { OperationalSafetyInspection, SafetyChecklistTypeTemplate } from '../types';
import { 
  evaluateChecklistScheduleStatus,
  getInspectionAlertSettings,
  InspectionAlertSettings,
  getPeriodicIntervalLabel,
  getInspectionTypeDisplay,
  isMachineryChecklist
} from '../../../utils/inspectionScheduleHelper';

interface Props {
  inspections: OperationalSafetyInspection[];
  templates: SafetyChecklistTypeTemplate[];
  onNewInspection: (templateId?: string) => void;
  onViewInspection: (inspection: OperationalSafetyInspection) => void;
  onReinspectInspection?: (inspection: OperationalSafetyInspection) => void;
  onNavigateToChecklists?: (scheduleStatus?: string) => void;
  isFa: boolean;
}

export default function SafetyOverviewDashboard({
  inspections,
  templates,
  onNewInspection,
  onViewInspection,
  onReinspectInspection,
  onNavigateToChecklists,
  isFa = true
}: Props) {
  // Chart Customization State
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar');
  const [metricFilter, setMetricFilter] = useState<'all' | 'passed' | 'failed' | 'total'>('all');
  const [showDataLabels, setShowDataLabels] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'count' | 'failed' | 'name'>('count');

  // Interactive Feed Filter Tab
  const [activeFeedTab, setActiveFeedTab] = useState<'all_urgent' | 'overdue' | 'warning' | 'active_valid' | 'archived_cycles' | 'machinery'>('all_urgent');

  // Alert Settings State
  const [alertSettings, setAlertSettings] = useState<InspectionAlertSettings>(getInspectionAlertSettings());

  useEffect(() => {
    const handleSettingsUpdate = (e: any) => {
      if (e?.detail) {
        setAlertSettings(e.detail);
      } else {
        setAlertSettings(getInspectionAlertSettings());
      }
    };
    window.addEventListener('hse_inspection_alert_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('hse_inspection_alert_settings_updated', handleSettingsUpdate);
  }, []);

  // Compute evaluations for all inspections
  const evaluationsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateChecklistScheduleStatus>>();
    inspections.forEach(i => {
      const evaluation = evaluateChecklistScheduleStatus(
        i.nextInspectionDate,
        i.inspectionType,
        i.inspectionDate,
        i.checklistTypeId,
        alertSettings,
        i.isArchivedCycle,
        i.supersededByInspectionId
      );
      map.set(i.id, evaluation);
    });
    return map;
  }, [inspections, alertSettings]);

  // Compute KPIs separating Active Cycles and Completed Prior Cycles
  const scheduleKPIs = useMemo(() => {
    let validCount = 0;
    let warningCount = 0;
    let overdueCount = 0;
    let unscheduledCount = 0;
    let archivedCount = 0;
    let activeTotal = 0;

    inspections.forEach(i => {
      if (i.isArchivedCycle) {
        archivedCount++;
      } else {
        activeTotal++;
        const status = evaluationsMap.get(i.id)?.status;
        if (status === 'VALID') validCount++;
        else if (status === 'WARNING') warningCount++;
        else if (status === 'OVERDUE') overdueCount++;
        else if (status === 'NOT_SCHEDULED') unscheduledCount++;
      }
    });

    const activeInspections = inspections.filter(i => !i.isArchivedCycle);
    const compliantCount = activeInspections.filter(i => i.status === 'COMPLETED').length;
    const actionRequiredCount = activeInspections.filter(i => i.status === 'ACTION_REQUIRED').length;
    const avgScore = activeTotal > 0 ? Math.round(activeInspections.reduce((acc, curr) => acc + curr.scorePercent, 0) / activeTotal) : 100;
    const machineryActiveCount = activeInspections.filter(i => isMachineryChecklist(i.checklistTypeId) || Boolean(i.machineryType || i.machineryTonnage)).length;

    return {
      activeTotal,
      allTotal: inspections.length,
      validCount,
      warningCount,
      overdueCount,
      unscheduledCount,
      archivedCount,
      urgentTotal: warningCount + overdueCount,
      compliantCount,
      actionRequiredCount,
      avgScore,
      machineryActiveCount
    };
  }, [inspections, evaluationsMap]);

  // Interactive Feed Items
  const feedItems = useMemo(() => {
    const activeList = inspections
      .filter(i => !i.isArchivedCycle)
      .map(i => ({
        inspection: i,
        eval: evaluationsMap.get(i.id) || evaluateChecklistScheduleStatus(i.nextInspectionDate, i.inspectionType, i.inspectionDate, i.checklistTypeId, alertSettings, false),
        isMachinery: isMachineryChecklist(i.checklistTypeId) || Boolean(i.machineryType || i.machineryTonnage)
      }));

    if (activeFeedTab === 'all_urgent') {
      return activeList.filter(item => item.eval.status === 'OVERDUE' || item.eval.status === 'WARNING')
        .sort((a, b) => (a.eval.daysRemaining ?? 999) - (b.eval.daysRemaining ?? 999));
    }
    if (activeFeedTab === 'overdue') {
      return activeList.filter(item => item.eval.status === 'OVERDUE')
        .sort((a, b) => (a.eval.daysRemaining ?? 999) - (b.eval.daysRemaining ?? 999));
    }
    if (activeFeedTab === 'warning') {
      return activeList.filter(item => item.eval.status === 'WARNING')
        .sort((a, b) => (a.eval.daysRemaining ?? 999) - (b.eval.daysRemaining ?? 999));
    }
    if (activeFeedTab === 'active_valid') {
      return activeList.filter(item => item.eval.status === 'VALID')
        .sort((a, b) => (a.eval.daysRemaining ?? 999) - (b.eval.daysRemaining ?? 999));
    }
    if (activeFeedTab === 'machinery') {
      return activeList.filter(item => item.isMachinery)
        .sort((a, b) => (a.eval.daysRemaining ?? 999) - (b.eval.daysRemaining ?? 999));
    }
    if (activeFeedTab === 'archived_cycles') {
      return inspections
        .filter(i => i.isArchivedCycle)
        .map(i => ({
          inspection: i,
          eval: evaluationsMap.get(i.id) || evaluateChecklistScheduleStatus(i.nextInspectionDate, i.inspectionType, i.inspectionDate, i.checklistTypeId, alertSettings, true, i.supersededByInspectionId),
          isMachinery: isMachineryChecklist(i.checklistTypeId) || Boolean(i.machineryType || i.machineryTonnage)
        }));
    }
    return activeList;
  }, [inspections, evaluationsMap, alertSettings, activeFeedTab]);

  // Machinery Fleet Statistics
  const machineryStats = useMemo(() => {
    const machineryList = inspections.filter(i => !i.isArchivedCycle && (isMachineryChecklist(i.checklistTypeId) || Boolean(i.machineryType || i.machineryTonnage)));
    const craneCount = machineryList.filter(i => i.checklistTypeId?.includes('crane') || i.machineryType?.includes('جرثقیل')).length;
    const forkliftCount = machineryList.filter(i => i.checklistTypeId?.includes('forklift') || i.machineryType?.includes('لیفتراک')).length;
    const generalLiftingCount = machineryList.length - craneCount - forkliftCount;

    let validMachinery = 0;
    let urgentMachinery = 0;

    machineryList.forEach(m => {
      const st = evaluationsMap.get(m.id)?.status;
      if (st === 'VALID') validMachinery++;
      if (st === 'OVERDUE' || st === 'WARNING') urgentMachinery++;
    });

    return {
      total: machineryList.length,
      craneCount,
      forkliftCount,
      generalLiftingCount: Math.max(0, generalLiftingCount),
      validMachinery,
      urgentMachinery,
      list: machineryList
    };
  }, [inspections, evaluationsMap]);

  // Chart 1: Active Inspections by Checklist Template Category
  const byTypeData = useMemo(() => {
    const map: Record<string, { name: string; count: number; passed: number; failed: number; totalPoints: number }> = {};
    templates.forEach(t => {
      map[t.id] = { 
        name: isFa ? t.titleFa.replace('چک‌لیست ایمنی ', '').replace('چک‌لیست بازرسی ', '').replace('چک‌لیست ', '') : t.titleEn, 
        count: 0, 
        passed: 0, 
        failed: 0, 
        totalPoints: 0 
      };
    });

    inspections.filter(i => !i.isArchivedCycle).forEach(i => {
      if (map[i.checklistTypeId]) {
        map[i.checklistTypeId].count += 1;
        map[i.checklistTypeId].passed += i.passedCount;
        map[i.checklistTypeId].failed += i.failedCount;
        map[i.checklistTypeId].totalPoints += (i.passedCount + i.failedCount + (i.warningCount || 0));
      }
    });

    let result = Object.values(map).filter(item => item.count > 0);
    if (sortBy === 'count') {
      result.sort((a, b) => b.count - a.count);
    } else if (sortBy === 'failed') {
      result.sort((a, b) => b.failed - a.failed);
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }, [inspections, templates, isFa, sortBy]);

  // Chart 2: Active Schedule Health Donut Data (excluding archived)
  const schedulePieData = useMemo(() => {
    return [
      { name: isFa ? 'سبز: معتبر و جاری' : 'Valid & Safe', value: scheduleKPIs.validCount, color: '#10b981' },
      { name: isFa ? 'زرد: نزدیک به موعد' : 'Approaching Warning', value: scheduleKPIs.warningCount, color: '#f59e0b' },
      { name: isFa ? 'قرمز: سررسید گذشته' : 'Overdue Alerts', value: scheduleKPIs.overdueCount, color: '#ef4444' },
      { name: isFa ? 'انجام‌شده (دوره‌های قبل)' : 'Completed (Past)', value: scheduleKPIs.archivedCount, color: '#6366f1' },
    ].filter(item => item.value > 0);
  }, [scheduleKPIs, isFa]);

  // Periodic Timing Breakdown
  const timingBreakdownData = useMemo(() => {
    const timingMap: Record<string, { label: string; count: number; color: string }> = {
      'DAILY': { label: isFa ? 'روزانه' : 'Daily', count: 0, color: '#3b82f6' },
      'MONTHLY': { label: isFa ? 'ماهانه' : 'Monthly', count: 0, color: '#6366f1' },
      'QUARTERLY': { label: isFa ? '۳ ماهه' : 'Quarterly', count: 0, color: '#8b5cf6' },
      'SEMI_ANNUAL': { label: isFa ? '۶ ماهه' : 'Semi-Annual', count: 0, color: '#ec4899' },
      'ANNUAL': { label: isFa ? 'سالانه' : 'Annual', count: 0, color: '#2563eb' },
    };

    inspections.filter(i => !i.isArchivedCycle).forEach(i => {
      const interval = i.periodicInterval || 'MONTHLY';
      if (timingMap[interval]) {
        timingMap[interval].count += 1;
      } else {
        timingMap['MONTHLY'].count += 1;
      }
    });

    return Object.values(timingMap).filter(item => item.count > 0);
  }, [inspections, isFa]);

  return (
    <div className="space-y-6" dir={isFa ? 'rtl' : 'ltr'}>
      {/* 1. TOP HERO BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute -left-10 -bottom-10 w-72 h-72 bg-blue-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-1/4 -top-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-blue-200 border border-white/10">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isFa ? 'مرکز پایش هوشمند ایمنی، ماشین‌آلات و چرخه بازرسی‌های دوره‌ای' : 'Advanced Safety & Inspection Operations Command'}</span>
              </div>

              {scheduleKPIs.urgentTotal > 0 ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 backdrop-blur-md rounded-full text-xs font-black text-amber-300 border border-amber-500/30 animate-pulse">
                  <Bell className="w-3.5 h-3.5" />
                  <span>
                    {isFa 
                      ? `${scheduleKPIs.urgentTotal} مورد نیازمند تمدید و بازرسی مجدد` 
                      : `${scheduleKPIs.urgentTotal} Inspections Need Action`}
                  </span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 backdrop-blur-md rounded-full text-xs font-bold text-emerald-300 border border-emerald-500/30">
                  <Check className="w-3.5 h-3.5" />
                  <span>{isFa ? 'تمامی بازرسی‌های دوره‌ای جاری معتبر و ایمن هستند' : 'All Active Periodic Audits Valid'}</span>
                </div>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-snug">
              {isFa ? 'داشبورد جامع مدیریت ایمنی و پایش دوره‌ای چک‌لیست‌ها' : 'Operational Safety & Equipment Inspection Dashboard'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              {isFa
                ? 'پایش خودکار موعد سررسیدها، مدیریت چرخه‌های تمدید و سوابق دوره‌های گذشته، نظارت بر ظرفیت باربرداری و تناژ جرثقیل و لیفتراک، و سنجش شاخص انطباق ایمنی مجتمع.'
                : 'Automated 3-tier active schedule tracking, completed cycle archive lineage, machinery tonnage surveillance for cranes and forklifts, and compliance metrics.'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. URGENT NOTIFICATION BANNER */}
      {scheduleKPIs.urgentTotal > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-transparent border-2 border-amber-400/60 dark:border-amber-600/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0 mt-0.5">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'هشدارهای نیازمند اقدام فوری در نوبت‌های جاری:' : 'Urgent Inspection Due Alerts:'}
                </h3>
                {scheduleKPIs.overdueCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-rose-600 text-white text-xs font-black font-mono shadow-xs">
                    {scheduleKPIs.overdueCount} {isFa ? 'مورد منقضی / سررسید گذشته (قرمز)' : 'Overdue'}
                  </span>
                )}
                {scheduleKPIs.warningCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-amber-950 text-xs font-black font-mono shadow-xs">
                    {scheduleKPIs.warningCount} {isFa ? 'مورد نزدیک به سررسید (زرد)' : 'Approaching'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-medium leading-relaxed">
                {isFa 
                  ? `بر اساس آستانه هشدار تنظیم‌شده (${alertSettings.warningThresholdDays} روز قبل)، چک‌لیست‌های فوق نیازمند انجام نوبت جدید بازرسی و صدور گواهی سلامت هستند.`
                  : `According to alert settings (${alertSettings.warningThresholdDays} days lead-time), the listed audits require inspection before certificate expiry.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            {onNavigateToChecklists && (
              <button
                onClick={() => onNavigateToChecklists('OVERDUE')}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all cursor-pointer shadow-sm"
              >
                {isFa ? 'مشاهده و اجرای موارد بحرانی' : 'View Urgent in Checklists'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. 5 HIGH-IMPACT KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Active Inspections */}
        <div 
          onClick={() => onNavigateToChecklists && onNavigateToChecklists('ALL')}
          className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between space-y-2 cursor-pointer hover:border-blue-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'بازرسی‌های جاری فعال' : 'Active Inspections'}
            </span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-800 dark:text-white">
              {scheduleKPIs.activeTotal}
            </div>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
              {isFa ? `${scheduleKPIs.allTotal} کل سوابق ثبت‌شده` : `${scheduleKPIs.allTotal} Total Records`}
            </span>
          </div>
        </div>

        {/* GREEN: VALID */}
        <div 
          onClick={() => onNavigateToChecklists && onNavigateToChecklists('VALID')}
          className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-l-4 border-l-emerald-500 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between space-y-2 cursor-pointer hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>{isFa ? 'سبز: جاری و معتبر' : 'Green: Valid'}</span>
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {scheduleKPIs.validCount}
            </div>
            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400 font-bold">
              {scheduleKPIs.activeTotal > 0 ? Math.round((scheduleKPIs.validCount / scheduleKPIs.activeTotal) * 100) : 0}٪ {isFa ? 'پوشش معتبر' : 'Valid'}
            </span>
          </div>
        </div>

        {/* YELLOW: WARNING */}
        <div 
          onClick={() => onNavigateToChecklists && onNavigateToChecklists('WARNING')}
          className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-l-4 border-l-amber-500 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between space-y-2 cursor-pointer hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-amber-800 dark:text-amber-300 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
              <span>{isFa ? 'زرد: نزدیک به موعد' : 'Yellow: Approaching'}</span>
            </span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              {scheduleKPIs.warningCount}
            </div>
            <span className="text-[10px] text-amber-700/80 dark:text-amber-400 font-bold">
              {isFa ? `در آستانه ${alertSettings.warningThresholdDays} روز` : `In ${alertSettings.warningThresholdDays}d window`}
            </span>
          </div>
        </div>

        {/* RED: OVERDUE */}
        <div 
          onClick={() => onNavigateToChecklists && onNavigateToChecklists('OVERDUE')}
          className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-l-4 border-l-rose-500 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between space-y-2 cursor-pointer hover:bg-rose-50/30 dark:hover:bg-rose-950/20 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-rose-800 dark:text-rose-300 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-ping" />
              <span>{isFa ? 'قرمز: منقضی / گذشته' : 'Red: Overdue'}</span>
            </span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
              {scheduleKPIs.overdueCount}
            </div>
            <span className="text-[10px] text-rose-700/80 dark:text-rose-400 font-bold">
              {isFa ? 'اقدام فوری جهت تمدید' : 'Immediate Action'}
            </span>
          </div>
        </div>

        {/* COMPLETED / ARCHIVED PAST CYCLES */}
        <div 
          onClick={() => onNavigateToChecklists && onNavigateToChecklists('COMPLETED_ARCHIVE')}
          className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-l-4 border-l-indigo-500 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between space-y-2 cursor-pointer hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-indigo-800 dark:text-indigo-300 flex items-center gap-1">
              <CheckCheck className="w-4 h-4 text-indigo-600" />
              <span>{isFa ? 'انجام‌شده (سوابق قبلی)' : 'Completed Cycles'}</span>
            </span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Archive className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
              {scheduleKPIs.archivedCount}
            </div>
            <span className="text-[10px] text-indigo-700/80 dark:text-indigo-400 font-bold">
              {isFa ? 'تمدید و بایگانی شده' : 'Renewed & Archived'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. MACHINERY & HIGH-RISK EQUIPMENT MATRIX */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
          <div className="space-y-0.5">
            <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-600" />
              <span>{isFa ? 'ماتریس پایش ماشین‌آلات، جرثقیل‌های متحرک، لیفتراک و تجهیزات باربرداری' : 'Machinery, Cranes & Heavy Equipment Inspection Matrix'}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isFa ? 'کنترل ظرفیت مجاز باربرداری (SWL)، شماره تگ و پلاک، و وضعیت معتبر بودن گواهی بازرسی دوره‌ای' : 'SWL capacity validation, equipment tag IDs, and periodic certificate validity.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800">
              {machineryStats.total} {isFa ? 'دستگاه در چرخه جاری' : 'Active Machines'}
            </span>
          </div>
        </div>

        {/* Machinery Sub-Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'جرثقیل‌های متحرک (بوم تلسکوپی/کفی)' : 'Mobile Cranes'}</span>
              <div className="text-xl font-black font-mono text-slate-800 dark:text-white">{machineryStats.craneCount} <span className="text-xs text-slate-400 font-normal">{isFa ? 'دستگاه' : 'units'}</span></div>
              <span className="text-[10px] text-slate-500 block">{isFa ? 'ثبت ظرفیت تناژ (۲۵ الی ۵۰ تن)' : '25t - 50t Capacity recorded'}</span>
            </div>
            <div className="p-3 rounded-xl bg-blue-100/80 dark:bg-blue-950/50 text-blue-600">
              <Truck className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'لیفتراک‌های صنعتی (دیزلی/برقی)' : 'Industrial Forklifts'}</span>
              <div className="text-xl font-black font-mono text-slate-800 dark:text-white">{machineryStats.forkliftCount} <span className="text-xs text-slate-400 font-normal">{isFa ? 'دستگاه' : 'units'}</span></div>
              <span className="text-[10px] text-slate-500 block">{isFa ? 'ثبت تناژ (۳ الی ۷ تن) و پلاک' : '3t - 7t SWL recorded'}</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-100/80 dark:bg-amber-950/50 text-amber-600">
              <Scale className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'وضعیت اعتبار گواهی ماشین‌آلات' : 'Certification Validity'}</span>
              <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {machineryStats.validMachinery} <span className="text-xs text-slate-400 font-normal">/ {machineryStats.total} {isFa ? 'معتبر' : 'valid'}</span>
              </div>
              <span className="text-[10px] text-slate-500 block">
                {machineryStats.urgentMachinery > 0 
                  ? `${machineryStats.urgentMachinery} دستگاه نیازمند تمدید فوری` 
                  : (isFa ? 'کلیه ماشین‌آلات دارای اعتبار بازرسی' : 'All machines certified')}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/50 text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 5. INTERACTIVE LIVE QUEUE & CYCLE TRACKER */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-700/60">
          <div className="space-y-0.5">
            <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-blue-600" />
              <span>{isFa ? 'مرکز پایش، اقدام فوری و رصد چرخه‌های بازرسی' : 'Inspection Queue & Cycle Tracking'}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isFa ? 'تفکیک هوشمند نوبت‌های نیازمند اقدام، ماشین‌آلات، و سوابق دوره‌های قبل' : 'Actionable queue sorted by status and cycle lineage.'}
            </p>
          </div>

          {/* Feed Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl text-xs font-bold overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveFeedTab('all_urgent')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                activeFeedTab === 'all_urgent'
                  ? 'bg-amber-600 text-white shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {isFa ? 'نیازمند اقدام فوری' : 'Urgent Actions'}
            </button>
            <button
              onClick={() => setActiveFeedTab('overdue')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                activeFeedTab === 'overdue'
                  ? 'bg-rose-600 text-white shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {isFa ? 'سررسید گذشته (قرمز)' : 'Overdue'}
            </button>
            <button
              onClick={() => setActiveFeedTab('warning')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                activeFeedTab === 'warning'
                  ? 'bg-amber-600 text-white shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {isFa ? 'نزدیک به موعد (زرد)' : 'Approaching'}
            </button>
            <button
              onClick={() => setActiveFeedTab('active_valid')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                activeFeedTab === 'active_valid'
                  ? 'bg-emerald-600 text-white shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {isFa ? 'جاری و معتبر (سبز)' : 'Active Valid'}
            </button>
            <button
              onClick={() => setActiveFeedTab('machinery')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                activeFeedTab === 'machinery'
                  ? 'bg-indigo-600 text-white shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {isFa ? 'ماشین‌آلات ویژه' : 'Machinery'}
            </button>
            <button
              onClick={() => setActiveFeedTab('archived_cycles')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                activeFeedTab === 'archived_cycles'
                  ? 'bg-indigo-700 text-white shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {isFa ? 'سوابق دوره‌های قبل' : 'Prior Cycles'}
            </button>
          </div>
        </div>

        {/* List of Items */}
        <div className="space-y-3">
          {feedItems.length === 0 ? (
            <div className="p-8 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                {isFa ? 'هیچ رکوردی در این فیلتر یافت نشد' : 'No records in this tab'}
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {isFa ? 'وضعیت دوره‌های بازرسی ایمن و مطابق استاندارد است.' : 'All inspections are aligned.'}
              </p>
            </div>
          ) : (
            feedItems.slice(0, 6).map(({ inspection: insp, eval: schedEval, isMachinery }) => {
              const isOverdue = schedEval.status === 'OVERDUE';
              const isWarning = schedEval.status === 'WARNING';
              const isArchived = Boolean(insp.isArchivedCycle);

              return (
                <div
                  key={insp.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isArchived
                      ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/60'
                      : isOverdue
                      ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/80 hover:bg-rose-100/50'
                      : isWarning
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/80 hover:bg-amber-100/50'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* ID */}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300">
                        {insp.id}
                      </span>

                      {/* Status Pill */}
                      {isArchived ? (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-md border font-black bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 flex items-center gap-1.5">
                          <CheckCheck className="w-3 h-3 text-indigo-600" />
                          <span>{isFa ? 'انجام‌شده (بایگانی دوره قبل)' : 'Completed (Prior Cycle)'}</span>
                          {insp.supersededByInspectionId && (
                            <span className="font-mono text-[9px]">➔ {insp.supersededByInspectionId}</span>
                          )}
                        </span>
                      ) : (
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-md border font-black flex items-center gap-1.5 ${schedEval.badgeClass}`}>
                          <div className={`w-2 h-2 rounded-full ${schedEval.dotColorClass}`} />
                          <span>{isFa ? schedEval.labelFa : schedEval.labelEn}</span>
                          {schedEval.daysRemaining !== null && (
                            <span className="font-mono text-[9px]">
                              {schedEval.daysRemaining < 0 
                                ? `(${Math.abs(schedEval.daysRemaining)}- روز تاخیر)` 
                                : `(${schedEval.daysRemaining} روز باقی‌مانده)`}
                            </span>
                          )}
                        </span>
                      )}

                      {/* Periodic Interval */}
                      {insp.periodicInterval && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-bold">
                          {isFa ? `دوره: ${getPeriodicIntervalLabel(insp.periodicInterval, isFa)}` : insp.periodicInterval}
                        </span>
                      )}

                      {/* Machinery Tag & Tonnage Pill */}
                      {(insp.machineryTonnage || insp.machineryTagNumber || isMachinery) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-bold flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          <span>
                            {insp.machineryTonnage ? `ظرفیت: ${insp.machineryTonnage}` : 'ماشین‌آلات ویژه'} 
                            {insp.machineryTagNumber ? ` (تگ: ${insp.machineryTagNumber})` : ''}
                          </span>
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white">
                      {insp.title}
                    </h4>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                      <span><strong>{isFa ? 'سایت/واحد:' : 'Location:'}</strong> {insp.site} - {insp.unit}</span>
                      <span><strong>{isFa ? 'تاریخ بازرسی:' : 'Date:'}</strong> {insp.inspectionDate}</span>
                      {insp.nextInspectionDate && !isArchived && (
                        <span className="text-blue-700 dark:text-blue-400 font-bold">
                          <strong>{isFa ? 'موعد سررسید بعدی:' : 'Next Due:'}</strong> {insp.nextInspectionDate}
                        </span>
                      )}
                      <span><strong>{isFa ? 'بازرس:' : 'Inspector:'}</strong> {insp.inspectorName}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      onClick={() => onViewInspection(insp)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isFa ? 'مشاهده و چاپ' : 'View'}</span>
                    </button>

                    {isArchived && insp.supersededByInspectionId ? (
                      <button
                        onClick={() => {
                          const target = inspections.find(i => i.id === insp.supersededByInspectionId);
                          if (target) onViewInspection(target);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800 rounded-xl text-xs font-black transition-all cursor-pointer"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>{isFa ? `نوبت جدید (${insp.supersededByInspectionId})` : 'Active Cycle'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onReinspectInspection ? onReinspectInspection(insp) : onNewInspection(insp.checklistTypeId)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs ${
                          isOverdue ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                        }`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{isFa ? 'بازرسی دوره‌ای جدید' : 'New Periodic Audit'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 6. ANALYTICS & VISUAL CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customizable Chart: Inspections by Category */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-700/60">
            <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>{isFa ? 'توزیع بازرسی‌های فعال به تفکیک نوع چک‌لیست و ماشین‌آلات' : 'Active Inspections by Template & Equipment'}</span>
            </h2>

            {/* Customization Toolbar */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Type Switcher */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-700/70 p-0.5 rounded-lg">
                <button
                  onClick={() => setChartType('bar')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    chartType === 'bar' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'
                  }`}
                  title={isFa ? 'نمودار ستونی' : 'Bar Chart'}
                >
                  {isFa ? 'میله‌ای' : 'Bar'}
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    chartType === 'line' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'
                  }`}
                  title={isFa ? 'نمودار خطی' : 'Line Chart'}
                >
                  {isFa ? 'خطی' : 'Line'}
                </button>
                <button
                  onClick={() => setChartType('area')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    chartType === 'area' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'
                  }`}
                  title={isFa ? 'نمودار سطحی' : 'Area Chart'}
                >
                  {isFa ? 'سطحی' : 'Area'}
                </button>
              </div>

              {/* Metric Selector */}
              <select
                value={metricFilter}
                onChange={e => setMetricFilter(e.target.value as any)}
                className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold border-none cursor-pointer"
              >
                <option value="all">{isFa ? 'همه شاخص‌ها' : 'All Metrics'}</option>
                <option value="passed">{isFa ? 'فقط موارد منطبق' : 'Passed Only'}</option>
                <option value="failed">{isFa ? 'فقط نواقص' : 'Defects Only'}</option>
                <option value="total">{isFa ? 'تعداد بازرسی' : 'Inspection Count'}</option>
              </select>

              {/* Data Labels Toggle */}
              <button
                onClick={() => setShowDataLabels(!showDataLabels)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  showDataLabels 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
                title={isFa ? 'نمایش یا مخفی‌سازی اعداد بالای نمودار' : 'Toggle Numbers on top of chart'}
              >
                <Hash className="w-3 h-3" />
                <span>{showDataLabels ? (isFa ? 'اعداد فعال' : 'Labels On') : (isFa ? 'بدون عدد' : 'Labels Off')}</span>
              </button>

              {/* Sort selector */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold border-none cursor-pointer"
              >
                <option value="count">{isFa ? 'مرتب‌سازی: تعداد' : 'Sort: Count'}</option>
                <option value="failed">{isFa ? 'مرتب‌سازی: نواقص' : 'Sort: Defect'}</option>
                <option value="name">{isFa ? 'مرتب‌سازی: الفبا' : 'Sort: Name'}</option>
              </select>
            </div>
          </div>

          <div className="h-72 w-full pt-2 min-w-0">
            <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={240} debounce={50}>
              {chartType === 'bar' ? (
                <BarChart data={byTypeData} margin={{ top: 20, right: 10, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  {(metricFilter === 'all' || metricFilter === 'passed') && (
                    <Bar dataKey="passed" name={isFa ? 'موارد منطبق (Pass)' : 'Passed'} fill="#10b981" radius={[4, 4, 0, 0]}>
                      {showDataLabels && <LabelList dataKey="passed" position="top" fill="#059669" fontSize={11} fontWeight="bold" />}
                    </Bar>
                  )}
                  {(metricFilter === 'all' || metricFilter === 'failed') && (
                    <Bar dataKey="failed" name={isFa ? 'نواقص (Fail)' : 'Failed'} fill="#ef4444" radius={[4, 4, 0, 0]}>
                      {showDataLabels && <LabelList dataKey="failed" position="top" fill="#dc2626" fontSize={11} fontWeight="bold" />}
                    </Bar>
                  )}
                  {metricFilter === 'total' && (
                    <Bar dataKey="count" name={isFa ? 'تعداد بازرسی' : 'Inspections'} fill="#3b82f6" radius={[4, 4, 0, 0]}>
                      {showDataLabels && <LabelList dataKey="count" position="top" fill="#2563eb" fontSize={11} fontWeight="bold" />}
                    </Bar>
                  )}
                </BarChart>
              ) : chartType === 'line' ? (
                <LineChart data={byTypeData} margin={{ top: 20, right: 10, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  {(metricFilter === 'all' || metricFilter === 'passed') && (
                    <Line type="monotone" dataKey="passed" name={isFa ? 'موارد منطبق' : 'Passed'} stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }}>
                      {showDataLabels && <LabelList dataKey="passed" position="top" fill="#059669" fontSize={11} fontWeight="bold" />}
                    </Line>
                  )}
                  {(metricFilter === 'all' || metricFilter === 'failed') && (
                    <Line type="monotone" dataKey="failed" name={isFa ? 'نواقص' : 'Failed'} stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }}>
                      {showDataLabels && <LabelList dataKey="failed" position="top" fill="#dc2626" fontSize={11} fontWeight="bold" />}
                    </Line>
                  )}
                  {metricFilter === 'total' && (
                    <Line type="monotone" dataKey="count" name={isFa ? 'تعداد بازرسی' : 'Inspections'} stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }}>
                      {showDataLabels && <LabelList dataKey="count" position="top" fill="#2563eb" fontSize={11} fontWeight="bold" />}
                    </Line>
                  )}
                </LineChart>
              ) : (
                <AreaChart data={byTypeData} margin={{ top: 20, right: 10, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Area type="monotone" dataKey="passed" name={isFa ? 'منطبق' : 'Passed'} stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                  <Area type="monotone" dataKey="failed" name={isFa ? 'نواقص' : 'Failed'} stroke="#ef4444" fill="#ef4444" fillOpacity={0.25} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Schedule Status & Cycle Health Donut */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>{isFa ? 'توزیع وضعیت سررسید و سوابق' : 'Schedule Status Health'}</span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isFa ? 'وضعیت سلامت کلی دوره‌ها و سوابق تمدیدشده' : 'Inspection readiness and renewals'}
            </p>
          </div>

          <div className="h-48 w-full min-w-0">
            <ResponsiveContainer width="100%" height={192} minWidth={0} minHeight={180} debounce={50}>
              <PieChart>
                <Pie
                  data={schedulePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {schedulePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            {schedulePieData.map(entry => (
              <div key={entry.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }}></span>
                  <span className="text-slate-600 dark:text-slate-300 font-bold">{entry.name}</span>
                </div>
                <span className="font-mono font-black text-slate-800 dark:text-white">{entry.value} {isFa ? 'مورد' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7. RECENT COMPREHENSIVE INSPECTIONS TABLE */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span>{isFa ? 'آخرین ممیزی‌ها و بازرسی‌های ثبت‌شده در سایت' : 'Recent Safety Inspections'}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isFa ? 'مشاهده جزئیات چک‌لیست‌ها، وضعیت سررسید، تناژ ماشین‌آلات و سوابق تمدید' : 'View checklist records, schedule status, machinery specs, and renewal history.'}
            </p>
          </div>

          {onNavigateToChecklists && (
            <button
              onClick={() => onNavigateToChecklists('ALL')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
            >
              <span>{isFa ? 'مشاهده تمام سوابق و اجرای بازرسی' : 'View all inspection records'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <div className="w-full overflow-x-auto custom-scrollbar">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">{isFa ? 'کد و عنوان بازرسی' : 'Inspection ID & Title'}</th>
                  <th className="p-3">{isFa ? 'نوع چک‌لیست و مشخصات' : 'Checklist Type & Specs'}</th>
                  <th className="p-3">{isFa ? 'تاریخ و دوره زمانی' : 'Date & Frequency'}</th>
                  <th className="p-3">{isFa ? 'موعد سررسید بعدی' : 'Next Due Date'}</th>
                  <th className="p-3">{isFa ? 'سایت و واحد' : 'Site & Unit'}</th>
                  <th className="p-3 text-center">{isFa ? 'امتیاز انطباق' : 'Score'}</th>
                  <th className="p-3 text-center">{isFa ? 'وضعیت نوبت' : 'Cycle Status'}</th>
                  <th className="p-3 text-center">{isFa ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {inspections.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      {isFa ? 'هیچ چک‌لیست بازرسی ثبت نشده است.' : 'No inspection records found.'}
                    </td>
                  </tr>
                ) : (
                  inspections.slice(0, 8).map((insp, idx) => {
                    const schedEval = evaluationsMap.get(insp.id) || evaluateChecklistScheduleStatus(insp.nextInspectionDate, insp.inspectionType, insp.inspectionDate, insp.checklistTypeId, alertSettings, insp.isArchivedCycle, insp.supersededByInspectionId);
                    const timingInfo = getInspectionTypeDisplay(insp.inspectionType, isFa);
                    const isArchived = Boolean(insp.isArchivedCycle);

                    return (
                      <tr 
                        key={insp.id} 
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors ${
                          alertSettings.highlightRowColor ? schedEval.rowBgClass : ''
                        }`}
                      >
                        <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{insp.title}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{insp.id}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-slate-700 dark:text-slate-200">{insp.checklistTypeNameFa}</div>
                          {(insp.machineryTonnage || insp.machineryTagNumber) && (
                            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 mt-0.5">
                              <Truck className="w-3 h-3" />
                              <span>{insp.machineryTonnage} {insp.machineryTagNumber ? `| تگ: ${insp.machineryTagNumber}` : ''}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          <div className="font-mono">{insp.inspectionDate}</div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${timingInfo.badgeClass}`}>
                            {timingInfo.label} {insp.periodicInterval ? `(${getPeriodicIntervalLabel(insp.periodicInterval, isFa)})` : ''}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {!isArchived && insp.nextInspectionDate ? (
                            <div className="font-mono font-bold text-blue-700 dark:text-blue-300">
                              {insp.nextInspectionDate}
                            </div>
                          ) : isArchived ? (
                            <span className="text-teal-700 dark:text-teal-400 text-[10px] font-bold">
                              ✓ {isFa ? 'تمدید و بایگانی شده' : 'Renewed'}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          <span className="font-bold text-blue-600">{insp.site}</span> - {insp.unit}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-black ${
                            insp.scorePercent >= 90
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                              : insp.scorePercent >= 70
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                          }`}>
                            {insp.scorePercent}٪
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {isArchived ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800">
                              <CheckCheck className="w-2.5 h-2.5" />
                              <span>{isFa ? 'انجام‌شده (دوره قبل)' : 'Completed Cycle'}</span>
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${schedEval.badgeClass}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${schedEval.dotColorClass}`} />
                              <span>{isFa ? schedEval.labelFa : schedEval.labelEn}</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onViewInspection(insp)}
                              className="px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                              title={isFa ? 'مشاهده و چاپ' : 'View'}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {!isArchived && onReinspectInspection && (
                              <button
                                onClick={() => onReinspectInspection(insp)}
                                className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                                title={isFa ? 'بازرسی دوره‌ای جدید' : 'New Audit'}
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
