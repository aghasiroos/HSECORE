import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Award,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  FolderGit2,
  GitBranch,
  Layers,
  Percent,
  PieChart,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  CCPS_PILLARS,
  CCPS_20_ELEMENTS,
  OSHA_14_CLAUSES,
} from './psmStandardsCatalog';
import { PsmSubTabKey } from './PsmManagementModule';

interface PsmExecutiveDashboardProps {
  activeProject: any;
  projectData: {
    assets: any[];
    assessments: any[];
    gaps: any[];
    wbsTasks: any[];
    documents: any[];
    capaItems: any[];
    studies: any[];
    maturityRecords: any[];
  };
  centralOrg: {
    companies: any[];
    sites: any[];
    departments: any[];
    units: any[];
    positions: any[];
    personnel: any[];
    linkedModulesSummary: Record<string, number>;
  };
  dashboardMetrics: any;
  availableUnits: string[];
  onNavigateSubTab: (subTab: PsmSubTabKey) => void;
  onRefresh: () => void;
  onOpenCreateProjectModal?: () => void;
}

export function PsmExecutiveDashboard({
  activeProject,
  projectData,
  centralOrg,
  dashboardMetrics,
  availableUnits,
  onNavigateSubTab,
  onRefresh,
  onOpenCreateProjectModal,
}: PsmExecutiveDashboardProps) {
  // Filters State
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedPillar, setSelectedPillar] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'overview' | 'elements' | 'evm' | 'alerts'>('overview');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [searchElementQuery, setSearchElementQuery] = useState<string>('');

  // 1. Earned Value Management (EVM) & Schedule/Cost Metrics
  const evmCalculations = useMemo(() => {
    if (!activeProject) {
      return {
        plannedDurationDays: 365,
        elapsedDays: 0,
        plannedProgress: 0,
        actualProgress: 0,
        scheduleVariancePercent: 0,
        spi: 1.0,
        allocatedBudget: 0,
        spentBudget: 0,
        earnedValue: 0,
        costVariance: 0,
        cpi: 1.0,
        projectStatusTag: 'تعریف‌نشده',
      };
    }

    const start = activeProject.startDate ? new Date(activeProject.startDate).getTime() : Date.now();
    const end = activeProject.endDate ? new Date(activeProject.endDate).getTime() : start + 365 * 86400000;
    const now = Date.now();

    const totalDuration = Math.max(1, Math.round((end - start) / 86400000));
    const elapsed = Math.max(0, Math.min(totalDuration, Math.round((now - start) / 86400000)));

    // Planned progress based on linear timeline (Planned Value % PV)
    const plannedProgress = Math.round((elapsed / totalDuration) * 100);
    const actualProgress = Number(activeProject.overallProgress || 0);

    // Schedule Performance Index (SPI = Actual Progress / Planned Progress)
    const spi = plannedProgress > 0 ? Number((actualProgress / plannedProgress).toFixed(2)) : 1.0;
    const scheduleVariancePercent = actualProgress - plannedProgress;

    const allocated = Number(activeProject.allocatedBudget || 0);
    const spent = Number(activeProject.spentBudget || 0);
    const earnedValue = Math.round(allocated * (actualProgress / 100));
    const costVariance = earnedValue - spent;
    const cpi = spent > 0 ? Number((earnedValue / spent).toFixed(2)) : (actualProgress > 0 ? 1.2 : 1.0);

    let projectStatusTag = 'طبق برنامه (On-Track)';
    if (spi < 0.85 || scheduleVariancePercent < -15) {
      projectStatusTag = 'دارای تأخیر بحرانی (Critical Delay)';
    } else if (spi < 0.95 || scheduleVariancePercent < -5) {
      projectStatusTag = 'نیازمند تسریع (At-Risk)';
    } else if (actualProgress >= 100) {
      projectStatusTag = 'تکمیل‌شده (Completed)';
    }

    return {
      plannedDurationDays: totalDuration,
      elapsedDays: elapsed,
      plannedProgress,
      actualProgress,
      scheduleVariancePercent,
      spi,
      allocatedBudget: allocated,
      spentBudget: spent,
      earnedValue,
      costVariance,
      cpi,
      projectStatusTag,
    };
  }, [activeProject]);

  // 2. Predictive Alerts & Bottlenecks
  const predictiveAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      level: 'CRITICAL' | 'WARNING' | 'INFO';
      title: string;
      description: string;
      count: number;
      targetTab: PsmSubTabKey;
    }> = [];

    // Check 1: Critical Open Gaps without approved action
    const criticalGaps = projectData.gaps.filter(
      (g) => (g.severity === 'CRITICAL' || g.severity === 'HIGH') && g.status !== 'CLOSED' && g.status !== 'VERIFIED'
    );
    if (criticalGaps.length > 0) {
      alerts.push({
        id: 'crit-gaps',
        level: 'CRITICAL',
        title: 'شکاف‌های بحرانی باز و فاقد تأییدیه',
        description: `${criticalGaps.length} شکاف بحرانی یا با اولویت بالا در وضعیت باز قرار دارند که مانع عبور از دروازه بعدی هستند.`,
        count: criticalGaps.length,
        targetTab: 'gap-analysis',
      });
    }

    // Check 2: Overdue WBS Tasks
    const nowStr = new Date().toISOString().slice(0, 10);
    const overdueTasks = projectData.wbsTasks.filter(
      (t) => t.dueDate && t.dueDate < nowStr && t.status !== 'COMPLETED'
    );
    if (overdueTasks.length > 0) {
      alerts.push({
        id: 'overdue-wbs',
        level: 'CRITICAL',
        title: 'فعالیت‌های WBS منقضی و معوق',
        description: `${overdueTasks.length} فعالیت اجرایی برنامه زمان‌بندی از تاریخ مهلت خود عبور کرده‌اند.`,
        count: overdueTasks.length,
        targetTab: 'wbs-gantt',
      });
    }

    // Check 3: Expired / Incomplete Documents
    const expiredDocs = projectData.documents.filter((d) => d.status === 'EXPIRED' || d.status === 'INCOMPLETE');
    if (expiredDocs.length > 0) {
      alerts.push({
        id: 'exp-docs',
        level: 'WARNING',
        title: 'اسناد PSM نیازمند بازنگری یا ناقص',
        description: `${expiredDocs.length} مدرک فنی یا دستورالعمل ایمنی فرایند فاقد اعتبار یا شواهد کامل هستند.`,
        count: expiredDocs.length,
        targetTab: 'documents',
      });
    }

    // Check 4: CAPA in Pending Stage or overdue
    const pendingCapa = projectData.capaItems.filter(
      (c) => c.status !== 'CLOSED_EFFECTIVE' && c.targetDate && c.targetDate < nowStr
    );
    if (pendingCapa.length > 0) {
      alerts.push({
        id: 'overdue-capa',
        level: 'WARNING',
        title: 'اقدامات اصلاحی (CAPA) دارای تأخیر',
        description: `${pendingCapa.length} اقدام اصلاحی از موعد اقدام تعیین‌شده عبور کرده است.`,
        count: pendingCapa.length,
        targetTab: 'capa',
      });
    }

    // Check 5: Impending WBS Deadlines in next 7 days
    const nextWeekStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const impendingTasks = projectData.wbsTasks.filter(
      (t) => t.dueDate && t.dueDate >= nowStr && t.dueDate <= nextWeekStr && t.status !== 'COMPLETED'
    );
    if (impendingTasks.length > 0) {
      alerts.push({
        id: 'impending-tasks',
        level: 'INFO',
        title: 'سررسید نزدیک بسته‌های کاری WBS (۷ روز آینده)',
        description: `${impendingTasks.length} فعالیت اجرایی طی یک هفته آینده موعد تحویل دارند.`,
        count: impendingTasks.length,
        targetTab: 'wbs-gantt',
      });
    }

    return alerts;
  }, [projectData]);

  // 3. Filtered CCPS Elements & OSHA Clauses
  const filteredCcpsElements = useMemo(() => {
    return dashboardMetrics.ccpsProgress.filter((el: any) => {
      // Filter by Pillar
      if (selectedPillar !== 'ALL' && el.pillarId !== selectedPillar) {
        return false;
      }
      // Search Query
      if (searchElementQuery.trim()) {
        const q = searchElementQuery.trim().toLowerCase();
        const codeMatch = el.code.toLowerCase().includes(q);
        const titleMatch = (el.titleFa || '').toLowerCase().includes(q);
        if (!codeMatch && !titleMatch) return false;
      }
      return true;
    });
  }, [dashboardMetrics.ccpsProgress, selectedPillar, searchElementQuery]);

  // 4. Stage-Gate Status Indicators (G1 to G6)
  const stageGates = useMemo(() => {
    const rawGates = activeProject?.stageGates || {};
    const gatesList = [
      {
        key: 'G1',
        titleFa: 'G1: تأیید ارزیابی اولیه و تعیین دامنه',
        description: 'تصویب محدوده شمول و ممیزی اولیه وضعیت موجود ۲۰ عنصر',
        requiredPillar: 'COMMIT',
      },
      {
        key: 'G2',
        titleFa: 'G2: تصویب تحلیل شکاف و فهرست نواقص',
        description: 'شناسایی و اولویت‌بندی کلیه گپ‌های استاندارد و ریشه‌یابی علل',
        requiredPillar: 'UNDERSTAND',
      },
      {
        key: 'G3',
        titleFa: 'G3: تصویب برنامه اجرایی، WBS و منابع',
        description: 'تصویب بسته‌های کاری، بودجه و مسئولین اجرایی',
        requiredPillar: 'MANAGE',
      },
      {
        key: 'G4',
        titleFa: 'G4: تأیید خروجی‌های اجرایی و تکمیل مدارک',
        description: 'استقرار مدارک PSI، HAZOP، MOC، PSSR و رویه‌ها',
        requiredPillar: 'MANAGE',
      },
      {
        key: 'G5',
        titleFa: 'G5: تأیید اثربخشی اقدامات و کنترل‌ها',
        description: 'بستن قطعی CAPAها و صحه‌گذاری ممیزی داخلی',
        requiredPillar: 'LEARN',
      },
      {
        key: 'G6',
        titleFa: 'G6: تصویب نهایی و تحویل سیستم PSM',
        description: 'تحویل پایدار نظام ایمنی فرایند به بهره‌برداری',
        requiredPillar: 'LEARN',
      },
    ];

    return gatesList.map((g, index) => {
      const gateData = rawGates[g.key] || {};
      const status = gateData.status || (index === 0 ? 'IN_PROGRESS' : 'PENDING');
      return {
        ...g,
        status,
        approvedDate: gateData.approvedDate,
        approverName: gateData.approverName || 'شورای راهبری PSM',
        notes: gateData.notes,
      };
    });
  }, [activeProject]);

  // 5. Export Executive Brief to JSON or CSV
  const handleExportJson = () => {
    const exportData = {
      projectCode: activeProject?.code,
      projectName: activeProject?.name,
      exportDate: new Date().toISOString(),
      evmMetrics: evmCalculations,
      ccpsProgress: dashboardMetrics.ccpsProgress,
      oshaProgress: dashboardMetrics.oshaProgress,
      stageGates: stageGates,
      counts: {
        totalGaps: projectData.gaps.length,
        totalTasks: projectData.wbsTasks.length,
        totalDocs: projectData.documents.length,
        totalCapa: projectData.capaItems.length,
      },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PSM_Executive_Brief_${activeProject?.code || 'RJL'}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const headers = ['کد عنصر', 'عنوان عنصر CCPS', 'رکن', 'درصد پیشرفت', 'تعداد شکاف‌های باز'];
    const rows = dashboardMetrics.ccpsProgress.map((el: any) => [
      `"${el.code}"`,
      `"${el.titleFa}"`,
      `"${el.pillarTitleFa || el.pillarId}"`,
      el.score,
      el.openGaps,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PSM_CCPS_Elements_${activeProject?.code || 'RJL'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* =================================================================
          EXECUTIVE CONTROL & FILTER BAR
         ================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <BarChart3 className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>داشبورد جامع کنترل و پایش استقرار PSM</span>
                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg">
                    {activeProject?.code || 'مجتمع پتروشیمی رجال'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  رصد یکپارچه ۲۰ عنصر CCPS، ۱۴ الزام OSHA، وضعیت دروازه‌های G1 تا G6 و شاخص‌های زمانی و ریالی (EVM)
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons: Export / Print / Refresh */}
          <div className="flex items-center gap-2 self-start lg:self-center">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              title="چاپ شناسنامه و گزارش مدیریتی پروژه"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">چاپ گزارش رسمی</span>
            </button>

            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-500" />
              <span>خروجی و گزارشات</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              title="بروزرسانی شاخص‌ها"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Mode Switcher + Interactive Filters */}
        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Sub-view Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'overview'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>نمای کلی و دروازه‌ها</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('elements')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'elements'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>تحلیل ۲۰ عنصر CCPS و OSHA</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('evm')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'evm'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>تحلیل مالی و زمانی (EVM)</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('alerts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'alerts'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>هشدارهای سررسید ({predictiveAlerts.length})</span>
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Unit Filter */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400 text-[11px] font-medium">واحد:</span>
              <select
                aria-label="فیلتر واحد عملیاتی"
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold focus:ring-1 focus:ring-amber-500"
              >
                <option value="ALL">همه واحدهای مشمول ({availableUnits.length})</option>
                {availableUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            {/* CCPS Pillar Filter */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400 text-[11px] font-medium">رکن:</span>
              <select
                aria-label="فیلتر رکن CCPS"
                value={selectedPillar}
                onChange={(e) => setSelectedPillar(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold focus:ring-1 focus:ring-amber-500"
              >
                <option value="ALL">همه ۴ رکن CCPS</option>
                {CCPS_PILLARS.map((p) => (
                  <option key={p.id} value={p.id}>
                    رکن {p.number}: {p.titleFa}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================
          TOP PREDICTIVE CRITICAL ALERTS BANNER (IF ANY)
         ================================================================= */}
      {predictiveAlerts.filter((a) => a.level === 'CRITICAL').length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-800 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-500 text-white shrink-0 mt-0.5">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="font-black text-sm">
                هشدار انحراف و گلوگاه بحرانی در پروژه استقرار PSM
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                تعداد {predictiveAlerts.filter((a) => a.level === 'CRITICAL').length} گلوگاه بحرانی با اولویت فوری کشف شده است که نیازمند توجه مستقیم مدیر پروژه و کارشناسان است.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('alerts')}
            className="flex items-center justify-center gap-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs transition cursor-pointer self-start sm:self-center"
          >
            <span>مشاهده و رسیدگی</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =================================================================
          EXECUTIVE PRIMARY KPI STRIP (6 CORE METRICS)
         ================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1: Overall Implementation Progress */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1 relative overflow-hidden">
          <div className="text-[11px] font-bold text-slate-500">پیشرفت کل پروژه</div>
          <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
            {evmCalculations.actualProgress}%
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>برنامه‌ریزی: {evmCalculations.plannedProgress}%</span>
            <span
              className={`font-mono font-bold ${
                evmCalculations.scheduleVariancePercent >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {evmCalculations.scheduleVariancePercent >= 0 ? '+' : ''}
              {evmCalculations.scheduleVariancePercent}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, evmCalculations.actualProgress))}%` }}
            />
          </div>
        </div>

        {/* KPI 2: Maturity Level (1 to 5) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="text-[11px] font-bold text-slate-500">سطح بلوغ PSM</div>
          <div className="text-2xl font-black font-mono text-teal-600 dark:text-teal-400">
            سطح {activeProject?.maturityLevel || 1}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {dashboardMetrics.latestMaturity?.auditorName
              ? `ممیز: ${dashboardMetrics.latestMaturity.auditorName}`
              : 'هدف: سطح ۴'}
          </div>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <div
                key={lvl}
                className={`h-1.5 flex-1 rounded-full ${
                  lvl <= (activeProject?.maturityLevel || 1)
                    ? 'bg-teal-500'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* KPI 3: SPI / Schedule Performance */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="text-[11px] font-bold text-slate-500">شاخص عملکرد زمانی (SPI)</div>
          <div
            className={`text-2xl font-black font-mono ${
              evmCalculations.spi >= 1.0
                ? 'text-emerald-600 dark:text-emerald-400'
                : evmCalculations.spi >= 0.85
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {evmCalculations.spi.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {evmCalculations.spi >= 1.0 ? 'جلوتر از برنامه' : 'نیازمند تسریع'}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            سپری‌شده: {evmCalculations.elapsedDays} از {evmCalculations.plannedDurationDays} روز
          </div>
        </div>

        {/* KPI 4: Critical & Overdue Gaps */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="text-[11px] font-bold text-slate-500">شکاف‌های بحرانی / معوق</div>
          <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
            {dashboardMetrics.criticalOpenGaps} / {dashboardMetrics.overdueGaps}
          </div>
          <div className="text-[10px] text-slate-400">
            کل شکاف‌ها: {projectData.gaps.length} مورد
          </div>
          <button
            type="button"
            onClick={() => onNavigateSubTab('gap-analysis')}
            className="text-[10px] text-rose-600 dark:text-rose-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>مشاهده فهرست گپ‌ها</span>
            <ArrowLeft className="w-3 h-3" />
          </button>
        </div>

        {/* KPI 5: Approved vs Expired Documents */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="text-[11px] font-bold text-slate-500">بانک اسناد مصوب</div>
          <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
            {dashboardMetrics.approvedDocs} / {projectData.documents.length}
          </div>
          <div className="text-[10px] text-slate-400">
            منقضی: {dashboardMetrics.expiredDocs} | در انتظار: {dashboardMetrics.incompleteDocs}
          </div>
          <button
            type="button"
            onClick={() => onNavigateSubTab('documents')}
            className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>ورود به بانک اسناد</span>
            <ArrowLeft className="w-3 h-3" />
          </button>
        </div>

        {/* KPI 6: 8-Stage CAPA Effectiveness */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="text-[11px] font-bold text-slate-500">نرخ اثربخشی CAPA</div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {dashboardMetrics.capaEffectivenessRate}%
          </div>
          <div className="text-[10px] text-slate-400">
            اقدامات اثربخش: {dashboardMetrics.closedCapa} از {projectData.capaItems.length}
          </div>
          <button
            type="button"
            onClick={() => onNavigateSubTab('capa')}
            className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>گردش کار ۸ مرحله‌ای</span>
            <ArrowLeft className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* =================================================================
          STAGE-GATE G1 TO G6 ROADMAP STRIP
         ================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span>نقشه راه دروازه‌های شش‌گانه حاکمیت استقرار (Stage-Gate G1–G6)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              کنترل اجباری عبور از مراحل پروژه مطابق ۶ نقطه بازرسی مدیریتی
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateSubTab('stage-gates')}
            className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
          >
            <span>مدیریت و صحه‌گذاری دروازه‌ها</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {stageGates.map((gate, i) => {
            const isApproved = gate.status === 'APPROVED';
            const isInProgress = gate.status === 'IN_PROGRESS';
            const isRejected = gate.status === 'REJECTED';
            const isSuspended = gate.status === 'SUSPENDED';

            let statusBg = 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/70';
            let badgeBg = 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
            let badgeText = 'در انتظار ورود';

            if (isApproved) {
              statusBg = 'bg-emerald-500/5 border-emerald-500/30';
              badgeBg = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
              badgeText = 'تصویب‌شده';
            } else if (isInProgress) {
              statusBg = 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30';
              badgeBg = 'bg-amber-500 text-white';
              badgeText = 'دروازه فعال جاری';
            } else if (isRejected) {
              statusBg = 'bg-rose-500/10 border-rose-500/40';
              badgeBg = 'bg-rose-500 text-white';
              badgeText = 'رد شده / نیازمند اصلاح';
            } else if (isSuspended) {
              statusBg = 'bg-amber-500/5 border-amber-500/20';
              badgeBg = 'bg-amber-500/20 text-amber-700 dark:text-amber-300';
              badgeText = 'معلق';
            }

            return (
              <div
                key={gate.key}
                className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 transition ${statusBg}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-slate-800 dark:text-slate-100">
                      {gate.key}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeBg}`}>
                      {badgeText}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1.5 leading-snug">
                    {gate.titleFa.replace(`${gate.key}: `, '')}
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                    {gate.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400">
                  <span>تأییدکننده:</span>
                  <span className="font-bold text-slate-600 dark:text-slate-300 truncate max-w-[90px]">
                    {gate.approverName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =================================================================
          VIEW 1: OVERVIEW TAB CONTENT (UNITS & PROCESS ASSETS & MILESTONES)
         ================================================================= */}
      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Unit Progress Breakdown */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-500" />
                  <span>درصد پیشرفت به تفکیک واحدهای فرایندی و عملیاتی</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  پایش پیشرفت استقرار عناصر PSM در هر واحد مجتمع
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">
                {dashboardMetrics.unitProgress.length} واحد
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dashboardMetrics.unitProgress.map((u: any) => (
                <div
                  key={u.unitName}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-slate-900 dark:text-white">{u.unitName}</span>
                    <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                      {u.progress}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, u.progress))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span>وظایف WBS: {u.tasksCount}</span>
                    <span>شکاف‌های باز: {u.openGapsCount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Project Sponsor, Team, and Milestones */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-teal-500" />
                <span>اطلاعات حاکمیتی و نقاط عطف پروژه</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تیم، حامی ارشد و سررسید نقاط بازرسی
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">مدیر پروژه:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {activeProject?.projectManagerName || 'تعیین نشده'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">حامی پروژه (Sponsor):</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {activeProject?.sponsorName || 'تعیین نشده'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">بودجه مصوب:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {Number(activeProject?.allocatedBudget || 0).toLocaleString()} ریال
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">هزینه‌کرد تاکنون:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {Number(activeProject?.spentBudget || 0).toLocaleString()} ریال
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>نقاط عطف اصلی (Milestones):</span>
                <button
                  type="button"
                  onClick={() => onNavigateSubTab('wbs-gantt')}
                  className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline"
                >
                  مشاهده در گانت
                </button>
              </div>

              {Array.isArray(activeProject?.milestones) && activeProject.milestones.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {activeProject.milestones.map((ms: any, i: number) => (
                    <div
                      key={ms.id || i}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs border border-slate-200/60 dark:border-slate-700/60"
                    >
                      <span className="font-medium truncate max-w-[200px]">{ms.title || ms}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        {ms.status === 'COMPLETED' ? 'تکمیل‌شده' : 'در جریان'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-400">
                  نقاط عطف در شناسنامه پروژه تعریف شده‌اند.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          VIEW 2: CCPS 20 ELEMENTS & OSHA 14 CLAUSES DETAILED ANALYSIS
         ================================================================= */}
      {viewMode === 'elements' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-500" />
                  <span>ماتریس تطبیقی و پیشرفت ۲۰ عنصر CCPS RBPS</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ارزیابی میزان انطباق و شکاف‌های باز هر یک از عناصر ۴ گانه ریسک‌محور CCPS
                </p>
              </div>

              {/* Search Element filter */}
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="جستجوی عنصر (کد یا عنوان)..."
                  value={searchElementQuery}
                  onChange={(e) => setSearchElementQuery(e.target.value)}
                  className="w-full pl-3 pr-8 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredCcpsElements.map((el: any) => (
                <div
                  key={el.code}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-2.5 hover:border-amber-500/50 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-xs font-black">
                        {el.code}
                      </span>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[220px]">
                        {el.titleFa}
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-black text-slate-800 dark:text-slate-100">
                      {el.score}%
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        el.score >= 85
                          ? 'bg-emerald-500'
                          : el.score >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, el.score))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                    <span>رکن: {el.pillarTitleFa || el.pillarId}</span>
                    <div className="flex items-center gap-2">
                      <span className={el.openGaps > 0 ? 'text-rose-500 font-bold' : 'text-slate-400'}>
                        شکاف باز: {el.openGaps}
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigateSubTab('assessment')}
                        className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        ارزیابی
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* OSHA 14 Clauses Breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-500" />
                  <span>انطباق با ۱۴ الزام اجباری OSHA 29 CFR 1910.119</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ارزیابی الزامات قانونی بین‌المللی ایمنی فرایند
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">14 Clauses</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
              {dashboardMetrics.oshaProgress.map((cl: any) => (
                <div
                  key={cl.code}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-xs font-black">
                        {cl.code}
                      </span>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[220px]">
                        {cl.titleFa}
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-black text-slate-800 dark:text-slate-100">
                      {cl.score}%
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        cl.score >= 85
                          ? 'bg-emerald-500'
                          : cl.score >= 50
                          ? 'bg-sky-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, cl.score))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>بند آیین‌نامه: {cl.cfrParagraph}</span>
                    <span className="font-bold text-slate-600 dark:text-slate-300">
                      {cl.assessedCount > 0 ? 'ممیزی‌شده' : 'در انتظار ممیزی'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          VIEW 3: EVM FINANCIAL & SCHEDULE TRACKING (بند ۵ و ۹)
         ================================================================= */}
      {viewMode === 'evm' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-500" />
                <span>تحلیل مدیریت ارزش کسب‌شده (Earned Value Management - EVM)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                سنجش دقیق پیشرفت زمانی (SPI)، عملکرد هزینه (CPI) و انحرافات بودجه‌ای پروژه استقرار PSM
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* SPI */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                <div className="text-[11px] text-slate-500 font-bold">شاخص عملکرد زمانی (SPI)</div>
                <div
                  className={`text-2xl font-mono font-black ${
                    evmCalculations.spi >= 1.0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {evmCalculations.spi.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-400">
                  فرمول: Actual Progress / Planned Progress
                </div>
              </div>

              {/* CPI */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                <div className="text-[11px] text-slate-500 font-bold">شاخص عملکرد هزینه (CPI)</div>
                <div
                  className={`text-2xl font-mono font-black ${
                    evmCalculations.cpi >= 1.0 ? 'text-emerald-500' : 'text-amber-500'
                  }`}
                >
                  {evmCalculations.cpi.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-400">
                  فرمول: Earned Value / Actual Cost
                </div>
              </div>

              {/* Earned Value */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                <div className="text-[11px] text-slate-500 font-bold">ارزش کسب‌شده (EV)</div>
                <div className="text-xl font-mono font-black text-slate-800 dark:text-white">
                  {evmCalculations.earnedValue.toLocaleString()} ریال
                </div>
                <div className="text-[10px] text-slate-400">
                  معادل {evmCalculations.actualProgress}% بودجه مصوب
                </div>
              </div>

              {/* Cost Variance */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                <div className="text-[11px] text-slate-500 font-bold">انحراف هزینه (Cost Variance)</div>
                <div
                  className={`text-xl font-mono font-black ${
                    evmCalculations.costVariance >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {evmCalculations.costVariance >= 0 ? '+' : ''}
                  {evmCalculations.costVariance.toLocaleString()} ریال
                </div>
                <div className="text-[10px] text-slate-400">
                  {evmCalculations.costVariance >= 0 ? 'صرفه‌جویی بودجه‌ای' : 'مازاد هزینه ثبت‌شده'}
                </div>
              </div>
            </div>

            {/* Timeline Breakdown Strip */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-800 dark:text-slate-200">وضعیت پیشرفت زمانی کل پروژه:</span>
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  {evmCalculations.elapsedDays} روز سپری‌شده از مجموع {evmCalculations.plannedDurationDays} روز
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden relative">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        (evmCalculations.elapsedDays / Math.max(1, evmCalculations.plannedDurationDays)) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>تاریخ شروع: {activeProject?.startDate || 'نامشخص'}</span>
                <span>
                  انحراف زمانی: {evmCalculations.scheduleVariancePercent}% (
                  {evmCalculations.scheduleVariancePercent >= 0 ? 'جلوتر از برنامه' : 'عقب‌تر از برنامه'})
                </span>
                <span>تاریخ پایان برنامه‌ریزی: {activeProject?.endDate || 'نامشخص'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          VIEW 4: PREDICTIVE ALERTS & CRITICAL BOTTLENECKS
         ================================================================= */}
      {viewMode === 'alerts' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>هشدارهای پیش‌بینانه، تأخیرات بحرانی و گلوگاه‌های اجرایی ({predictiveAlerts.length})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تحلیل هوشمند رکوردهای معوق، ریسک‌های باقیمانده و الزامات متوقف‌کننده گیت‌های استقرار
              </p>
            </div>

            {predictiveAlerts.length === 0 ? (
              <div className="p-8 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                  وضعیت پروژه مطلوب است
                </h4>
                <p className="text-xs text-slate-500">
                  هیچ گلوگاه بحرانی، فعالیت WBS معوق یا مدرک منقضی در این پروژه شناسایی نشد.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {predictiveAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      alert.level === 'CRITICAL'
                        ? 'bg-rose-500/5 border-rose-500/30'
                        : alert.level === 'WARNING'
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : 'bg-sky-500/5 border-sky-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-xl text-white shrink-0 mt-0.5 ${
                          alert.level === 'CRITICAL'
                            ? 'bg-rose-500'
                            : alert.level === 'WARNING'
                            ? 'bg-amber-500'
                            : 'bg-sky-500'
                        }`}
                      >
                        <AlertOctagon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">
                            {alert.title}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              alert.level === 'CRITICAL'
                                ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                                : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {alert.count} مورد
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {alert.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigateSubTab(alert.targetTab)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer self-start sm:self-center shrink-0"
                    >
                      <span>رسیدگی و اصلاح</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================
          EXPORT & REPORTING MODAL
         ================================================================= */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-amber-500" />
                <span>صادرات و گزارش وضعیت پروژه PSM</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              قالب گزارش و خروجی مورد نظر برای ارائه به ممیزان یا مدیریت ارشد را انتخاب نمایید:
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowExportModal(false);
                  handlePrint();
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer text-right"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      چاپ شناسنامه و گزارش اجرایی (Print-ready)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      خروجی با فرمت رسمی، جدول شاخص‌ها، وضعیت دروازه‌ها و امضاها
                    </div>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowExportModal(false);
                  handleExportCsv();
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer text-right"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      صادرات شیت اکسل (CSV / Excel)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      جدول استاندارد پیشرفت ۲۰ عنصر CCPS و تعداد شکاف‌ها
                    </div>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowExportModal(false);
                  handleExportJson();
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer text-right"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      پشتیبان‌گیری ساختاریافته (JSON)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      کلیه داده‌های شاخص‌های تحلیلی، دروازه‌ها و EVM پروژه
                    </div>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
