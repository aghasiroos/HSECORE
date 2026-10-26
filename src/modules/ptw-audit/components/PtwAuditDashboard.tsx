import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart3, 
  Settings2, 
  TrendingUp, 
  Users, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Filter, 
  RotateCcw, 
  Eye, 
  Printer, 
  Search, 
  Activity, 
  Calendar, 
  Award, 
  Layers,
  History,
  Send,
  GitCommit
} from 'lucide-react';
import { PtwAuditRecord, PtwHistoricalYearStat } from '../types';
import { 
  DashboardFilterState,
  RoleType,
  filterAuditsForDashboard,
  computeTopDefectivePersonnel,
  computeHazardDefectStats,
  computePpeDefectStats,
  computePrecautionsDefectStats,
  computePermitTypeDistribution,
  computeYearlyAuditTrends,
  computeMonthlyTrendForYear,
  computeUnitDefectRankings,
  extractJalaliYear,
  getAuditTotalDefects
} from '../services/ptwAuditAnalytics';
import { getHistoricalYearStats } from '../services/ptwAuditService';
import { useUnifiedOrgUnits } from '../../../utils/orgUnitsHelper';
import ChartCustomizationModal, { 
  ChartSettings, 
  loadSavedChartSettings, 
  saveChartSettingsToStorage 
} from './ChartCustomizationModal';
import PtwHistoricalStatsModal from './PtwHistoricalStatsModal';
import PtwAuditKpiCards from './PtwAuditKpiCards';
import PtwAuditPersonnelRanking from './PtwAuditPersonnelRanking';
import PtwAuditDefectAreas from './PtwAuditDefectAreas';
import PtwAuditPermitDistribution from './PtwAuditPermitDistribution';
import PtwAuditYearlyTrends from './PtwAuditYearlyTrends';

interface PtwAuditDashboardProps {
  audits: PtwAuditRecord[];
  onViewDetail: (audit: PtwAuditRecord) => void;
  onPrint: (audit: PtwAuditRecord) => void;
  onSwitchToList: () => void;
  onAddNew: () => void;
  onOpenReferral?: (audit: PtwAuditRecord) => void;
  onOpenWorkflowTracker?: (audit: PtwAuditRecord) => void;
  isFa?: boolean;
}

export default function PtwAuditDashboard({
  audits,
  onViewDetail,
  onPrint,
  onSwitchToList,
  onAddNew,
  onOpenReferral,
  onOpenWorkflowTracker,
  isFa = true
}: PtwAuditDashboardProps) {
  const { units: unifiedUnits } = useUnifiedOrgUnits();
  // 1. Filter States
  const [filters, setFilters] = useState<DashboardFilterState>({
    year: 'ALL',
    dateRange: 'ALL',
    unitName: 'ALL',
    permitType: 'ALL',
    roleType: 'ALL',
    searchQuery: ''
  });

  // Active sub-tab for Top 10 personnel
  const [activeRoleTab, setActiveRoleTab] = useState<RoleType>('areaResponsible');

  // Chart Customization State (loaded and persisted to localStorage)
  const [chartSettings, setChartSettings] = useState<ChartSettings>(() => loadSavedChartSettings());
  const [isChartSettingsOpen, setIsChartSettingsOpen] = useState(false);

  // Historical yearly statistics (manual input for past years comparison)
  const [historicalStats, setHistoricalStats] = useState<PtwHistoricalYearStat[]>(() => getHistoricalYearStats());
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);

  const handleHistoricalStatsChange = () => {
    setHistoricalStats(getHistoricalYearStats());
  };

  useEffect(() => {
    const handleStorageUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setHistoricalStats(e.detail);
      } else {
        setHistoricalStats(getHistoricalYearStats());
      }
    };
    window.addEventListener('hse_ptw_historical_years_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('hse_ptw_historical_years_updated', handleStorageUpdate);
    };
  }, []);

  const handleUpdateChartSettings = (newSettings: ChartSettings) => {
    setChartSettings(newSettings);
    saveChartSettingsToStorage(newSettings);
  };

  // Drill-down modal state
  const [drillDownModal, setDrillDownModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    records: PtwAuditRecord[];
  }>({
    isOpen: false,
    title: '',
    description: '',
    records: []
  });

  // Available Jalali years in dataset derived strictly from user's registered audits and historical entries
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    audits.forEach(a => {
      const y = extractJalaliYear(a.auditDate);
      if (y) yearsSet.add(y);
    });
    historicalStats.forEach(h => {
      if (h.year) yearsSet.add(h.year);
    });
    if (yearsSet.size === 0) {
      yearsSet.add(extractJalaliYear());
    }
    return Array.from(yearsSet).sort().reverse();
  }, [audits, historicalStats]);

  // 2. Filtered audits
  const filteredAudits = useMemo(() => {
    return filterAuditsForDashboard(audits, filters);
  }, [audits, filters]);

  // 3. Computed Analytics
  const topAreaResponsible = useMemo(() => computeTopDefectivePersonnel(filteredAudits, 'areaResponsible'), [filteredAudits]);
  const topSupervisors = useMemo(() => computeTopDefectivePersonnel(filteredAudits, 'seniorShiftSupervisor'), [filteredAudits]);
  const topPerformers = useMemo(() => computeTopDefectivePersonnel(filteredAudits, 'workPerformer'), [filteredAudits]);
  const topSafetyUnit = useMemo(() => computeTopDefectivePersonnel(filteredAudits, 'safetyUnitSigner'), [filteredAudits]);

  const activeTopPersonnel = useMemo(() => {
    switch (activeRoleTab) {
      case 'areaResponsible': return topAreaResponsible;
      case 'seniorShiftSupervisor': return topSupervisors;
      case 'workPerformer': return topPerformers;
      case 'safetyUnitSigner': return topSafetyUnit;
    }
  }, [activeRoleTab, topAreaResponsible, topSupervisors, topPerformers, topSafetyUnit]);

  // Category defects
  const hazardDefects = useMemo(() => computeHazardDefectStats(filteredAudits), [filteredAudits]);
  const ppeDefects = useMemo(() => computePpeDefectStats(filteredAudits), [filteredAudits]);
  const precautionsDefects = useMemo(() => computePrecautionsDefectStats(filteredAudits), [filteredAudits]);

  // Permit type distribution
  const permitDistribution = useMemo(() => computePermitTypeDistribution(filteredAudits), [filteredAudits]);

  // Yearly trends (computed from audits combined with manual historical stats)
  const yearlyTrends = useMemo(() => computeYearlyAuditTrends(audits, historicalStats), [audits, historicalStats]);

  // Monthly trends for selected year
  const monthlyTrends = useMemo(() => {
    return computeMonthlyTrendForYear(audits, filters.year);
  }, [audits, filters.year]);

  // Unit Rankings
  const unitRankings = useMemo(() => computeUnitDefectRankings(filteredAudits), [filteredAudits]);

  // Executive KPI summary calculations
  const totalAuditsCount = filteredAudits.length;
  const defectiveAuditsCount = useMemo(() => {
    return filteredAudits.filter(a => {
      const defects = getAuditTotalDefects(a);
      return defects > 0;
    }).length;
  }, [filteredAudits]);

  const totalDefectsCount = useMemo(() => {
    let sum = 0;
    filteredAudits.forEach(a => {
      sum += getAuditTotalDefects(a);
    });
    return sum;
  }, [filteredAudits]);

  const overallDefectRate = totalAuditsCount > 0 ? Number(((defectiveAuditsCount / totalAuditsCount) * 100).toFixed(1)) : 0;
  const overallComplianceRate = totalAuditsCount > 0 
    ? Number((filteredAudits.reduce((acc, a) => acc + (a.complianceScore ?? 100), 0) / totalAuditsCount).toFixed(1))
    : 100;

  const hotPermitsCount = useMemo(() => filteredAudits.filter(a => a.permitType === 'HOT').length, [filteredAudits]);
  const criticalNcCount = useMemo(() => filteredAudits.filter(a => a.status === 'CRITICAL_NC').length, [filteredAudits]);

  // Drill-down open handler
  const handleOpenDrillDown = (title: string, description: string, recordIdsOrFilter: string[] | ((a: PtwAuditRecord) => boolean)) => {
    let matched: PtwAuditRecord[] = [];
    if (Array.isArray(recordIdsOrFilter)) {
      matched = audits.filter(a => recordIdsOrFilter.includes(a.id));
    } else if (typeof recordIdsOrFilter === 'function') {
      matched = audits.filter(recordIdsOrFilter);
    }
    setDrillDownModal({
      isOpen: true,
      title,
      description,
      records: matched
    });
  };

  const resetFilters = () => {
    setFilters({
      year: 'ALL',
      dateRange: 'ALL',
      unitName: 'ALL',
      permitType: 'ALL',
      roleType: 'ALL',
      searchQuery: ''
    });
  };

  const hasActiveFilters = 
    filters.year !== 'ALL' || 
    filters.unitName !== 'ALL' || 
    filters.permitType !== 'ALL' || 
    filters.roleType !== 'ALL' || 
    filters.searchQuery.trim() !== '';

  return (
    <div className="space-y-6" dir="rtl" id="ptw-audit-dashboard-root">
      
      {/* ========================================================================= */}
      {/* 1. Header & Navigation */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-l from-slate-900 via-slate-800 to-indigo-950 text-white p-5 sm:p-7 rounded-3xl shadow-lg border border-slate-700/60 relative overflow-hidden">
        {/* Background glow accents */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 font-black">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight">
                  داشبورد تحلیلی و مدیریتی ممیزی پروانه کار
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30">
                  تحلیل هوشمند HSE
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                استخراج خودکار شاخص‌های عدم انطباق، رتبه‌بندی خطای افراد، توزیع پروانه‌ها و روند مقایسه‌ای سالانه
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 relative z-10 self-end lg:self-auto">
          {/* Historical Data Entry Button */}
          <button
            onClick={() => setIsHistoricalModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-amber-300 hover:text-amber-200 font-bold text-xs sm:text-sm rounded-2xl border border-amber-500/30 transition-all cursor-pointer shadow-sm active:scale-95"
            title="ورود دستی یا ویرایش آمار و اطلاعات سال‌های گذشته"
          >
            <History className="w-4 h-4 text-amber-400" />
            <span>ثبت آمار سنوات قبل</span>
          </button>

          {/* Chart Customization Button */}
          <button
            onClick={() => setIsChartSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs sm:text-sm rounded-2xl border border-slate-700 transition-all cursor-pointer shadow-sm active:scale-95"
            title="تنظیمات پالت رنگ، نمایش اعداد و استایل نمودارها"
          >
            <Settings2 className="w-4 h-4 text-amber-400" />
            <span>شخصی‌سازی نمودارها</span>
          </button>

          <button
            onClick={onSwitchToList}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs sm:text-sm rounded-2xl border border-slate-700 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>مشاهده لیست ممیزی‌ها</span>
          </button>

          <button
            onClick={onAddNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-amber-500/25 transition-all active:scale-95 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>ثبت ممیزی جدید</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Interactive Multi-Filter Bar */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Filter className="w-4 h-4 text-amber-500" />
            <span>فیلترهای جامع داشبورد:</span>
            {hasActiveFilters && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-mono">
                فیلتر فعال ({filteredAudits.length} از {audits.length} ممیزی)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>حذف فیلترها</span>
              </button>
            )}
          </div>

        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          
          {/* Dynamic Jalali Year Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              سال ممیزی (بر اساس ثبت کاربر):
            </label>
            <select
              value={filters.year}
              onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
              className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">همه سال‌ها ({availableYears.join(', ')})</option>
              {availableYears.map(y => (
                <option key={y} value={y}>سال {y}</option>
              ))}
            </select>
          </div>

          {/* Unit Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              واحد عملیاتی:
            </label>
            <select
              value={filters.unitName}
              onChange={(e) => setFilters(prev => ({ ...prev, unitName: e.target.value }))}
              className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">همه واحدهای مجتمع</option>
              {unifiedUnits.map(u => (
                <option key={u.id} value={u.name}>
                  {u.fullPath && u.fullPath !== u.name ? `${u.name} (${u.fullPath})` : u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Permit Type Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              نوع پروانه کار:
            </label>
            <select
              value={filters.permitType}
              onChange={(e) => setFilters(prev => ({ ...prev, permitType: e.target.value }))}
              className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">همه انواع پروانه</option>
              <option value="HOT">گرم (HOT)</option>
              <option value="COLD">سرد (COLD)</option>
              <option value="CONFINED_SPACE">ورود به فضای بسته</option>
              <option value="RADIOGRAPHY">پرتونگاری (رادیوگرافی)</option>
              <option value="ELECTRICAL">برق و ایزولاسیون</option>
              <option value="EXCAVATION">حفاری</option>
            </select>
          </div>

          {/* Signer Role Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              سمت و نقش ممیزی:
            </label>
            <select
              value={filters.roleType}
              onChange={(e) => setFilters(prev => ({ ...prev, roleType: e.target.value as any }))}
              className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">همه سمت‌ها و مسئولیت‌ها</option>
              <option value="areaResponsible">مسئول محوطه / صادرکننده</option>
              <option value="seniorShiftSupervisor">کشیک ارشد نوبت‌کاری</option>
              <option value="workPerformer">مجری کار / پیمانکار</option>
              <option value="safetyUnitSigner">واحد ایمنی (HSE)</option>
            </select>
          </div>

          {/* Live Search */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              جستجو در افراد و پروانه‌ها:
            </label>
            <div className="relative">
              <input
                type="text"
                value={filters.searchQuery}
                onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                placeholder="شماره پروانه، نام فرد، محل کار..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-3 pr-8 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. Executive KPI Cards with Chart Mode Toggle */}
      {/* ========================================================================= */}
      <PtwAuditKpiCards
        totalAuditsCount={totalAuditsCount}
        defectiveAuditsCount={defectiveAuditsCount}
        totalDefectsCount={totalDefectsCount}
        overallDefectRate={overallDefectRate}
        overallComplianceRate={overallComplianceRate}
        hotPermitsCount={hotPermitsCount}
        criticalNcCount={criticalNcCount}
        chartSettings={chartSettings}
        onOpenDrillDown={(title, desc, filter) => handleOpenDrillDown(title, desc, filter)}
      />

      {/* ========================================================================= */}
      {/* 4. Top 10 Defective Personnel (Table & Bar Chart with Data Numbers) */}
      {/* ========================================================================= */}
      <PtwAuditPersonnelRanking
        activeTopPersonnel={activeTopPersonnel}
        activeRoleTab={activeRoleTab}
        setActiveRoleTab={setActiveRoleTab}
        topAreaResponsibleCount={topAreaResponsible.length}
        topSupervisorsCount={topSupervisors.length}
        topPerformersCount={topPerformers.length}
        topSafetyUnitCount={topSafetyUnit.length}
        chartSettings={chartSettings}
        onUpdateChartSettings={handleUpdateChartSettings}
        onOpenDrillDown={(title, desc, ids) => handleOpenDrillDown(title, desc, ids)}
      />

      {/* ========================================================================= */}
      {/* 5. The 3 Defect Categories (Hazards, PPE, Precautions) - Clean Zero Defects */}
      {/* ========================================================================= */}
      <PtwAuditDefectAreas
        hazardDefects={hazardDefects}
        ppeDefects={ppeDefects}
        precautionsDefects={precautionsDefects}
        chartSettings={chartSettings}
        onUpdateChartSettings={handleUpdateChartSettings}
        onOpenDrillDown={(title, desc, ids) => handleOpenDrillDown(title, desc, ids)}
      />

      {/* ========================================================================= */}
      {/* 6. Permit Types Distribution & Operational Units Ranking */}
      {/* ========================================================================= */}
      <PtwAuditPermitDistribution
        permitDistribution={permitDistribution}
        unitRankings={unitRankings}
        chartSettings={chartSettings}
        onUpdateChartSettings={handleUpdateChartSettings}
        onOpenDrillDown={(title, desc, filter) => handleOpenDrillDown(title, desc, filter)}
      />

      {/* ========================================================================= */}
      {/* 7. Multi-Year Trends & Dynamic Annual Comparison */}
      {/* ========================================================================= */}
      <PtwAuditYearlyTrends
        yearlyTrends={yearlyTrends}
        monthlyTrends={monthlyTrends}
        selectedYear={filters.year}
        chartSettings={chartSettings}
        onUpdateChartSettings={handleUpdateChartSettings}
        onOpenDrillDown={(title, desc, filter) => handleOpenDrillDown(title, desc, filter)}
        onOpenHistoricalModal={() => setIsHistoricalModalOpen(true)}
      />

      {/* ========================================================================= */}
      {/* 8. Interactive Drill-Down Records Modal */}
      {/* ========================================================================= */}
      {drillDownModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-amber-500" />
                  <span>{drillDownModal.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-mono font-bold">
                    {drillDownModal.records.length} رکورد
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {drillDownModal.description}
                </p>
              </div>

              <button
                onClick={() => setDrillDownModal(prev => ({ ...prev, isOpen: false }))}
                className="w-9 h-9 rounded-2xl bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Table */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {drillDownModal.records.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  هیچ پروانه کاری منطبق با این شاخص یافت نشد.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold bg-slate-50 dark:bg-slate-800/40">
                        <th className="py-3 px-3">شماره پروانه</th>
                        <th className="py-3 px-3">نوع پرمیت</th>
                        <th className="py-3 px-3">واحد و محل کار</th>
                        <th className="py-3 px-3">تاریخ و ساعت</th>
                        <th className="py-3 px-3">مسئولین امضاکننده</th>
                        <th className="py-3 px-3 text-center">خطاها</th>
                        <th className="py-3 px-3 text-center">امتیاز</th>
                        <th className="py-3 px-3 text-center">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {drillDownModal.records.map((a) => {
                        const defects = a.inspectionItems?.filter(i => i.status === 'O' || i.status === 'DEFECT').length || (a.defectsCount || 0);

                        return (
                          <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                            {/* Permit Number */}
                            <td className="py-3 px-3">
                              <div className="font-mono font-bold text-slate-900 dark:text-white">
                                {a.permitNumber}
                              </div>
                              {a.hasAttachedPermit && a.attachedPermitNumber && (
                                <div className="text-[10px] text-purple-600 font-mono">
                                  الحاقی: {a.attachedPermitNumber}
                                </div>
                              )}
                            </td>

                            {/* Type */}
                            <td className="py-3 px-3">
                              <span className={`inline-block px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                                a.permitType === 'HOT' ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300' :
                                a.permitType === 'COLD' ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300' :
                                'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}>
                                {a.permitType === 'HOT' ? 'گرم (HOT)' : a.permitType === 'COLD' ? 'سرد (COLD)' : 'فضای بسته'}
                              </span>
                            </td>

                            {/* Unit */}
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-800 dark:text-slate-200">{a.unitName}</div>
                              <div className="text-[10px] text-slate-400">{a.subUnitName || a.workDescription?.slice(0, 30)}...</div>
                            </td>

                            {/* Date */}
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                              {a.auditDate} - {a.auditTime}
                            </td>

                            {/* Signers */}
                            <td className="py-3 px-3 text-[11px] space-y-0.5">
                              <div><span className="text-slate-400">محوطه:</span> {a.signers?.areaResponsibleName || '-'}</div>
                              <div><span className="text-slate-400">مجری:</span> {a.signers?.workPerformerName || '-'}</div>
                            </td>

                            {/* Defects count */}
                            <td className="py-3 px-3 text-center">
                              {defects > 0 ? (
                                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 font-mono font-bold">
                                  {defects} خطا
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-bold text-[11px]">بدون خطا</span>
                              )}
                            </td>

                            {/* Score */}
                            <td className="py-3 px-3 text-center font-mono font-bold">
                              <span className={a.complianceScore && a.complianceScore >= 95 ? 'text-emerald-600' : 'text-amber-600'}>
                                {a.complianceScore}%
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setDrillDownModal(prev => ({ ...prev, isOpen: false }));
                                    onViewDetail(a);
                                  }}
                                  title="مشاهده جزئیات کامل"
                                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-amber-500 hover:text-slate-950 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setDrillDownModal(prev => ({ ...prev, isOpen: false }));
                                    onOpenReferral?.(a);
                                  }}
                                  title="ارجاع جهت تایید و امضا"
                                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setDrillDownModal(prev => ({ ...prev, isOpen: false }));
                                    onOpenWorkflowTracker?.(a);
                                  }}
                                  title="گردش کار و امضاها"
                                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-purple-600 hover:text-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                                >
                                  <GitCommit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setDrillDownModal(prev => ({ ...prev, isOpen: false }));
                                    onPrint(a);
                                  }}
                                  title="چاپ رسمی A4"
                                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-blue-500 hover:text-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <button
                onClick={() => setDrillDownModal(prev => ({ ...prev, isOpen: false }))}
                className="px-5 py-2 rounded-2xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 font-bold text-xs text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. Historical Yearly Statistics Modal */}
      {/* ========================================================================= */}
      <PtwHistoricalStatsModal
        isOpen={isHistoricalModalOpen}
        onClose={() => setIsHistoricalModalOpen(false)}
        onStatsUpdated={handleHistoricalStatsChange}
      />

      {/* ========================================================================= */}
      {/* 10. Chart Customization Modal */}
      {/* ========================================================================= */}
      <ChartCustomizationModal
        isOpen={isChartSettingsOpen}
        onClose={() => setIsChartSettingsOpen(false)}
        settings={chartSettings}
        onChangeSettings={handleUpdateChartSettings}
      />

    </div>
  );
}
