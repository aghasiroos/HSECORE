import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  RotateCcw,
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldAlert,
  ClipboardCheck,
  Layers,
  Eye,
  Loader2,
  Building2,
  Wrench,
  UserCheck,
  FileText,
} from 'lucide-react';
import {
  getScaffoldTypeLabelFa,
  SCAFFOLD_TAG_META,
  SCAFFOLD_WORKFLOW_STEPS,
  ScaffoldBootstrapData,
  ScaffoldKpis,
  ScaffoldManagementReportData,
  ScaffoldPermissionsMatrix,
  ScaffoldRecord,
} from './types';
import { scaffoldingApi, ScaffoldFilterParams } from './scaffoldingApi';
import ScaffoldFormModal from './ScaffoldFormModal';
import ScaffoldDetailModal from './ScaffoldDetailModal';
import ScaffoldPrintModal from './ScaffoldPrintModal';

interface Props {
  isFa?: boolean;
  currentUser?: any;
}

const DEFAULT_KPIS: ScaffoldKpis = {
  totalScaffolds: 0,
  greenTagCount: 0,
  yellowTagCount: 0,
  redTagCount: 0,
  pendingInspectionCount: 0,
  openDefectsScaffoldsCount: 0,
  openDefectsTotalItems: 0,
  criticalDefectsScaffoldsCount: 0,
  totalInspectionsPerformed: 0,
};

const DEFAULT_PERMS: ScaffoldPermissionsMatrix = {
  canView: true,
  canCreate: false,
  canEdit: false,
  canInspect: false,
  canApprove: false,
  canChangeTag: false,
  canReport: false,
  canDelete: false,
};

export default function ScaffoldingModuleView({ isFa = true }: Props) {
  const [bootstrap, setBootstrap] = useState<ScaffoldBootstrapData | null>(null);
  const [items, setItems] = useState<ScaffoldRecord[]>([]);
  const [kpis, setKpis] = useState<ScaffoldKpis>(DEFAULT_KPIS);
  const [permissions, setPermissions] = useState<ScaffoldPermissionsMatrix>(DEFAULT_PERMS);
  const [filterOptions, setFilterOptions] = useState<{
    units: string[];
    contractors: string[];
    inspectors: string[];
  }>({ units: [], contractors: [], inspectors: [] });

  const [filters, setFilters] = useState<ScaffoldFilterParams>({
    search: '',
    unit: 'ALL',
    contractor: 'ALL',
    inspector: 'ALL',
    tagStatus: 'ALL',
    workflowStatus: 'ALL',
    permitNumber: '',
  });

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ScaffoldRecord | null>(null);
  const [selectedScaffoldId, setSelectedScaffoldId] = useState<number | null>(null);
  const [summaryReport, setSummaryReport] = useState<ScaffoldManagementReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const loadBootstrap = useCallback(async () => {
    try {
      const data = await scaffoldingApi.getBootstrap();
      setBootstrap(data);
      if (data.permissions) setPermissions(data.permissions);
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در دریافت اطلاعات پایه ماژول داربست‌بندی');
    }
  }, []);

  const loadList = useCallback(async (activeFilters: ScaffoldFilterParams) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await scaffoldingApi.list(activeFilters);
      setItems(res.items || []);
      setKpis(res.kpis || DEFAULT_KPIS);
      setFilterOptions(res.filterOptions || { units: [], contractors: [], inspectors: [] });
      if (res.permissions) setPermissions(res.permissions);
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در دریافت فهرست داربست‌ها');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadList(filters);
    }, 180);
    return () => clearTimeout(timer);
  }, [filters, loadList]);

  // Real-time multi-user sync via Socket.IO `app_data_mutated` event
  useEffect(() => {
    const onRealtimeMutation = (ev: Event) => {
      const detail = (ev as CustomEvent<{ entity?: string; module?: string }>).detail;
      const entity = String(detail?.entity || '').toLowerCase();
      const mod = String(detail?.module || '').toLowerCase();
      if (entity.includes('scaffold') || mod.includes('scaffold')) {
        loadList(filters);
        loadBootstrap();
      }
    };
    window.addEventListener('app_data_mutated', onRealtimeMutation as EventListener);
    return () => {
      window.removeEventListener('app_data_mutated', onRealtimeMutation as EventListener);
    };
  }, [filters, loadList, loadBootstrap]);

  const handleResetFilters = () => {
    setFilters({
      search: '',
      unit: 'ALL',
      contractor: 'ALL',
      inspector: 'ALL',
      tagStatus: 'ALL',
      workflowStatus: 'ALL',
      permitNumber: '',
    });
  };

  const handleOpenSummaryReport = async () => {
    setLoadingReport(true);
    setErrorMsg(null);
    try {
      const rep = await scaffoldingApi.getManagementReport(filters);
      setSummaryReport(rep);
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در تهیه گزارش مدیریتی');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'کد داربست',
      'تاریخ درخواست',
      'واحد درخواست‌کننده',
      'محل نصب',
      'ناحیه',
      'تجهیز',
      'شماره PTW',
      'شماره درخواست کار',
      'پیمانکار',
      'مسئول نصب',
      'بازرس HSE',
      'نوع داربست',
      'ارتفاع (متر)',
      'وضعیت تگ',
      'مرحله فرآیند',
      'نواقص باز',
      'نواقص بحرانی',
      'تعداد بازرسی',
      'تاریخ آخرین بازرسی',
      'اعتبار تگ تا',
    ];

    const escapeCsv = (val: unknown) => {
      const s = String(val ?? '').replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = items.map(s => [
      s.scaffoldCode,
      s.requestDate,
      s.requestingUnit,
      s.installationLocation,
      s.areaName || '',
      s.equipmentName || '',
      s.permitNumber || '',
      s.workRequestNumber || '',
      s.contractorName,
      s.erectorSupervisorName,
      s.inspectorName,
      getScaffoldTypeLabelFa(s.scaffoldType),
      s.heightMeters,
      SCAFFOLD_TAG_META[s.tagStatus].shortFa,
      SCAFFOLD_WORKFLOW_STEPS.find(w => w.key === s.workflowStatus)?.labelFa || s.workflowStatus,
      s.openDefectsCount,
      s.criticalDefectsCount,
      s.inspectionsCount,
      s.latestInspectionDate || '',
      s.tagValidUntil || '',
    ]);

    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scaffolding-report-${bootstrap?.todayJalali?.replace(/\//g, '-') || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilter =
    Boolean(filters.search?.trim()) ||
    Boolean(filters.permitNumber?.trim()) ||
    filters.unit !== 'ALL' ||
    filters.contractor !== 'ALL' ||
    filters.inspector !== 'ALL' ||
    filters.tagStatus !== 'ALL' ||
    filters.workflowStatus !== 'ALL';

  const kpiCards = [
    {
      key: 'total',
      label: 'کل داربست‌ها',
      value: kpis.totalScaffolds,
      icon: Layers,
      accent: 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/60',
      border: 'border-slate-200 dark:border-slate-700',
      onClick: handleResetFilters,
    },
    {
      key: 'green',
      label: 'تگ سبز (مجاز)',
      value: kpis.greenTagCount,
      icon: CheckCircle2,
      accent: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40',
      border: 'border-emerald-200 dark:border-emerald-800/70',
      onClick: () => setFilters(prev => ({ ...prev, tagStatus: 'GREEN', workflowStatus: 'ALL' })),
    },
    {
      key: 'yellow',
      label: 'تگ زرد (نیازمند اصلاح)',
      value: kpis.yellowTagCount,
      icon: AlertTriangle,
      accent: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40',
      border: 'border-amber-200 dark:border-amber-800/70',
      onClick: () => setFilters(prev => ({ ...prev, tagStatus: 'YELLOW', workflowStatus: 'ALL' })),
    },
    {
      key: 'red',
      label: 'تگ قرمز (غیرمجاز)',
      value: kpis.redTagCount,
      icon: XCircle,
      accent: 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/40',
      border: 'border-rose-200 dark:border-rose-800/70',
      onClick: () => setFilters(prev => ({ ...prev, tagStatus: 'RED', workflowStatus: 'ALL' })),
    },
    {
      key: 'pending',
      label: 'در انتظار بازرسی',
      value: kpis.pendingInspectionCount,
      icon: Clock,
      accent: 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40',
      border: 'border-blue-200 dark:border-blue-800/70',
      onClick: () => setFilters(prev => ({ ...prev, workflowStatus: 'PENDING_INSPECTION', tagStatus: 'ALL' })),
    },
    {
      key: 'defects',
      label: 'دارای نقص باز',
      value: kpis.openDefectsScaffoldsCount,
      sub: kpis.criticalDefectsScaffoldsCount > 0 ? `${kpis.criticalDefectsScaffoldsCount} بحرانی` : undefined,
      icon: ShieldAlert,
      accent: 'text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40',
      border: 'border-orange-200 dark:border-orange-800/70',
      onClick: () => setFilters(prev => ({ ...prev, workflowStatus: 'OPEN_DEFECTS', tagStatus: 'ALL' })),
    },
    {
      key: 'inspections',
      label: 'کل بازرسی‌های انجام‌شده',
      value: kpis.totalInspectionsPerformed,
      icon: ClipboardCheck,
      accent: 'text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40',
      border: 'border-indigo-200 dark:border-indigo-800/70',
      onClick: handleResetFilters,
    },
  ];

  const renderTagBadge = (tag: ScaffoldRecord['tagStatus']) => {
    if (tag === 'GREEN') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-black shadow-xs">
          <CheckCircle2 className="w-3.5 h-3.5" />
          تگ سبز (مجاز)
        </span>
      );
    }
    if (tag === 'YELLOW') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 text-[11px] font-black shadow-xs">
          <AlertTriangle className="w-3.5 h-3.5" />
          تگ زرد (اصلاح)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-600 text-white text-[11px] font-black shadow-xs">
        <XCircle className="w-3.5 h-3.5" />
        تگ قرمز (ممنوع)
      </span>
    );
  };

  return (
    <div className="space-y-5" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Header Banner & Primary Actions */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              مدیریت، بازرسی و وضعیت تگ رنگی داربست‌بندی
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ثبت متمرکز داربست‌ها با اتصال مستقیم به PTW، چک‌لیست ۱۵‌بندی استاندارد، کنترل تگ سبز/زرد/قرمز و همگام‌سازی لحظه‌ای
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {permissions.canReport && (
            <>
              <button
                type="button"
                disabled={loadingReport}
                onClick={handleOpenSummaryReport}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold cursor-pointer"
              >
                {loadingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                <span>گزارش مدیریتی / چاپ A4</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={items.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs font-bold cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>خروجی Excel</span>
              </button>
            </>
          )}

          {permissions.canCreate && (
            <button
              type="button"
              onClick={() => {
                setEditingRecord(null);
                setShowFormModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت داربست جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* 7 Executive KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {kpiCards.map(card => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={card.onClick}
              className={`text-right bg-white dark:bg-slate-800 p-3.5 rounded-2xl border ${card.border} hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-2`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${card.accent}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
                  {card.value}
                </span>
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 leading-snug">
                  {card.label}
                </div>
                {card.sub && (
                  <div className="text-[10px] font-black text-rose-600 dark:text-rose-400 mt-0.5">
                    {card.sub}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Search & Multi-Criteria Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>جستجو و فیلترهای پیشرفته داربست‌ها</span>
          </div>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              پاک کردن فیلترها
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
          {/* General Search */}
          <div className="relative sm:col-span-2 lg:col-span-2 xl:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="جستجو کد، محل، تجهیز..."
              className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* PTW Number Filter */}
          <input
            type="text"
            value={filters.permitNumber || ''}
            onChange={e => setFilters(prev => ({ ...prev, permitNumber: e.target.value }))}
            placeholder="شماره پروانه کار (PTW)..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Unit Filter */}
          <select
            value={filters.unit || 'ALL'}
            onChange={e => setFilters(prev => ({ ...prev, unit: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 outline-none"
          >
            <option value="ALL">همه واحدها</option>
            {filterOptions.units.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>

          {/* Contractor Filter */}
          <select
            value={filters.contractor || 'ALL'}
            onChange={e => setFilters(prev => ({ ...prev, contractor: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 outline-none"
          >
            <option value="ALL">همه پیمانکاران</option>
            {filterOptions.contractors.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Inspector Filter */}
          <select
            value={filters.inspector || 'ALL'}
            onChange={e => setFilters(prev => ({ ...prev, inspector: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 outline-none"
          >
            <option value="ALL">همه بازرسان HSE</option>
            {filterOptions.inspectors.map(i => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>

          {/* Tag Color Filter */}
          <select
            value={filters.tagStatus || 'ALL'}
            onChange={e => setFilters(prev => ({ ...prev, tagStatus: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
          >
            <option value="ALL">همه تگ‌های رنگی</option>
            <option value="GREEN">تگ سبز (مجاز)</option>
            <option value="YELLOW">تگ زرد (اصلاح)</option>
            <option value="RED">تگ قرمز (غیرمجاز)</option>
          </select>

          {/* Workflow / Inspection Status Filter */}
          <select
            value={filters.workflowStatus || 'ALL'}
            onChange={e => setFilters(prev => ({ ...prev, workflowStatus: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 outline-none"
          >
            <option value="ALL">همه وضعیت‌های بازرسی</option>
            <option value="PENDING_INSPECTION">در انتظار بازرسی</option>
            <option value="OPEN_DEFECTS">دارای نقص باز</option>
            {SCAFFOLD_WORKFLOW_STEPS.map(s => (
              <option key={s.key} value={s.key}>{s.labelFa}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-900/30 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-200 text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* Registry List: Desktop Table + Responsive Mobile Cards */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-slate-500 text-xs font-bold">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            در حال بارگذاری اطلاعات داربست‌ها از پایگاه داده...
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center px-4 space-y-3">
            <Layers className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
            <div className="text-sm font-black text-slate-700 dark:text-slate-300">
              {hasActiveFilter ? 'هیچ داربستی با فیلترهای انتخابی یافت نشد' : 'هنوز داربستی در سامانه ثبت نشده است'}
            </div>
            <p className="text-xs text-slate-500">
              برای شروع، از دکمه «ثبت داربست جدید» استفاده نمایید تا کد یکتا، اتصال PTW و فرآیند بازرسی ایجاد گردد.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-3 text-right">کد داربست</th>
                    <th className="p-3 text-right">واحد / محل نصب و تجهیز</th>
                    <th className="p-3 text-right">PTW / درخواست کار</th>
                    <th className="p-3 text-right">پیمانکار و بازرس HSE</th>
                    <th className="p-3 text-center">مشخصات فنی</th>
                    <th className="p-3 text-center">وضعیت تگ</th>
                    <th className="p-3 text-center">فرآیند و نواقص</th>
                    <th className="p-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {items.map(s => {
                    const wfLabel =
                      SCAFFOLD_WORKFLOW_STEPS.find(w => w.key === s.workflowStatus)?.shortFa || s.workflowStatus;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedScaffoldId(s.id)}
                        className="hover:bg-blue-50/40 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
                      >
                        <td className="p-3">
                          <div className="font-mono font-black text-blue-700 dark:text-blue-400">
                            {s.scaffoldCode}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{s.requestDate}</div>
                        </td>
                        <td className="p-3 max-w-[230px]">
                          <div className="font-black text-slate-900 dark:text-white truncate">{s.requestingUnit}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {s.installationLocation}
                            {s.equipmentName ? ` • ${s.equipmentName}` : ''}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {s.permitNumber ? `PTW: ${s.permitNumber}` : 'PTW: -'}
                          </div>
                          {s.workRequestNumber && (
                            <div className="text-slate-400 mt-0.5">WR: {s.workRequestNumber}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{s.contractorName}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">بازرس: {s.inspectorName}</div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="font-mono font-black text-slate-800 dark:text-slate-200">
                            {s.heightMeters} متر
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[130px] mx-auto mt-0.5">
                            {getScaffoldTypeLabelFa(s.scaffoldType).split('(')[0]}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {renderTagBadge(s.tagStatus)}
                          {s.tagValidUntil && s.tagStatus === 'GREEN' && (
                            <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                              اعتبار: {s.tagValidUntil}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{wfLabel}</div>
                          <div className="text-[10px] mt-0.5 flex items-center justify-center gap-1.5">
                            <span className="text-slate-500">بازرسی: {s.inspectionsCount}</span>
                            {s.openDefectsCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-black">
                                {s.openDefectsCount} نقص باز
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedScaffoldId(s.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600 text-blue-700 dark:text-blue-300 hover:text-white text-[11px] font-black transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            پرونده و بازرسی
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Responsive Cards */}
            <div className="lg:hidden divide-y divide-slate-200 dark:divide-slate-700">
              {items.map(s => {
                const wfLabel =
                  SCAFFOLD_WORKFLOW_STEPS.find(w => w.key === s.workflowStatus)?.shortFa || s.workflowStatus;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedScaffoldId(s.id)}
                    className="p-4 space-y-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono font-black text-sm text-blue-700 dark:text-blue-400">
                          {s.scaffoldCode}
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {s.requestingUnit}
                        </div>
                      </div>
                      {renderTagBadge(s.tagStatus)}
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <div>{s.installationLocation}{s.equipmentName ? ` — ${s.equipmentName}` : ''}</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Wrench className="w-3 h-3" /> {s.contractorName}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> {s.inspectorName}
                        </span>
                        {s.permitNumber && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <FileText className="w-3 h-3" /> {s.permitNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/70 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-600 dark:text-slate-300">{wfLabel}</span>
                        <span className="text-slate-400">• ارتفاع {s.heightMeters}m</span>
                        {s.openDefectsCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-black">
                            {s.openDefectsCount} نقص باز
                          </span>
                        )}
                      </div>
                      <span className="text-blue-600 font-black">مشاهده پرونده ←</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Registration / Edit Modal */}
      {showFormModal && bootstrap && (
        <ScaffoldFormModal
          isOpen={showFormModal}
          onClose={() => {
            setShowFormModal(false);
            setEditingRecord(null);
          }}
          bootstrap={bootstrap}
          initialRecord={editingRecord}
          onSaved={() => {
            loadList(filters);
            loadBootstrap();
          }}
        />
      )}

      {/* Full Detail / Workflow / Inspection / Tag History Modal */}
      {selectedScaffoldId !== null && bootstrap && (
        <ScaffoldDetailModal
          scaffoldId={selectedScaffoldId}
          bootstrap={bootstrap}
          onClose={() => setSelectedScaffoldId(null)}
          onEdit={rec => {
            setSelectedScaffoldId(null);
            setEditingRecord(rec);
            setShowFormModal(true);
          }}
          onChanged={() => {
            loadList(filters);
            loadBootstrap();
          }}
        />
      )}

      {/* Executive Summary Report A4 Print Modal */}
      {summaryReport && (
        <ScaffoldPrintModal
          mode="summary"
          report={summaryReport}
          onClose={() => setSummaryReport(null)}
        />
      )}
    </div>
  );
}
