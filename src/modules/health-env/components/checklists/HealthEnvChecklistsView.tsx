import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Coffee, UtensilsCrossed, Ambulance, Bath,
  Plus, Search, Filter, Printer, Download, Eye, Edit3, Trash2,
  Calendar, CheckCircle2, AlertTriangle, Clock, ShieldCheck, 
  Settings, ArrowUpDown, ChevronDown, Check, X, FileText,
  BarChart3, Layers, Send, GitCommit, Paperclip, Repeat, AlertCircle
} from 'lucide-react';
import { 
  HealthEnvInspection, 
  HealthEnvChecklistTypeTemplate, 
  HealthEnvChecklistType,
  HealthEnvInspectionStatus,
  HealthEnvApprovalStatus,
  HealthEnvScheduleType,
  HealthEnvPeriodicInterval
} from '../../types/checklistTypes';
import { healthEnvChecklistService } from '../../services/healthEnvChecklistService';
import HealthEnvChecklistFormModal from './HealthEnvChecklistFormModal';
import HealthEnvChecklistDetailModal from './HealthEnvChecklistDetailModal';
import HealthEnvManageTemplateModal from './HealthEnvManageTemplateModal';
import HealthEnvChecklistPrintModal from './HealthEnvChecklistPrintModal';
import { CreateReferralModal } from '../../../../components/referral/CreateReferralModal';
import { DocumentWorkflowTrackerModal } from '../../../../components/referral/DocumentWorkflowTrackerModal';
import { getReferralsForDocument } from '../../../../utils/referralHelper';
import { getTodayJalaliDate, getJalaliDaysDifference } from '../../../../utils/inspectionScheduleHelper';
import { downloadCsvFile } from '../../../../utils/fileHelpers';

interface Props {
  language: 'fa' | 'en';
  currentUser?: any;
}

export default function HealthEnvChecklistsView({ language = 'fa', currentUser }: Props) {
  // Master state
  const [inspections, setInspections] = useState<HealthEnvInspection[]>([]);
  const [templates, setTemplates] = useState<HealthEnvChecklistTypeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Tabs state
  const [selectedTypeTab, setSelectedTypeTab] = useState<HealthEnvChecklistType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<HealthEnvInspectionStatus | 'ALL'>('ALL');
  const [approvalFilter, setApprovalFilter] = useState<HealthEnvApprovalStatus | 'ALL'>('ALL');
  const [scheduleFilter, setScheduleFilter] = useState<HealthEnvScheduleType | 'ALL'>('ALL');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState<HealthEnvInspection | null>(null);
  const [viewingInspection, setViewingInspection] = useState<HealthEnvInspection | null>(null);
  const [printingInspection, setPrintingInspection] = useState<HealthEnvInspection | null>(null);
  const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false);

  // Referral & Workflow Tracker Modals state
  const [referralTargetInspection, setReferralTargetInspection] = useState<HealthEnvInspection | null>(null);
  const [trackerTargetInspection, setTrackerTargetInspection] = useState<HealthEnvInspection | null>(null);

  // Delete Confirmation Dialog state
  const [deletingInspectionId, setDeletingInspectionId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load initial data
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        await healthEnvChecklistService.reloadFromServer();
        setInspections(healthEnvChecklistService.getAllInspections());
        setTemplates(healthEnvChecklistService.getTemplates());
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Sync state with service events
  useEffect(() => {
    const handleUpdate = () => {
      setInspections(healthEnvChecklistService.getAllInspections());
      setTemplates(healthEnvChecklistService.getTemplates());
    };
    window.addEventListener('hse_health_env_inspections_updated', handleUpdate);
    window.addEventListener('hse_health_env_templates_updated', handleUpdate);
    window.addEventListener('hse_document_referrals_updated', handleUpdate);
    return () => {
      window.removeEventListener('hse_health_env_inspections_updated', handleUpdate);
      window.removeEventListener('hse_health_env_templates_updated', handleUpdate);
      window.removeEventListener('hse_document_referrals_updated', handleUpdate);
    };
  }, []);

  // Filter inspections
  const filteredInspections = useMemo(() => {
    return inspections.filter(item => {
      // 1. Checklist Type Filter
      if (selectedTypeTab !== 'ALL' && item.checklistTypeId !== selectedTypeTab) {
        return false;
      }
      // 2. Status Filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      // 3. Approval Filter
      if (approvalFilter !== 'ALL' && item.approvalStatus !== approvalFilter) {
        return false;
      }
      // 4. Schedule Type Filter
      if (scheduleFilter !== 'ALL' && (item.scheduleType || 'PERIODIC') !== scheduleFilter) {
        return false;
      }
      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesId = item.id?.toLowerCase().includes(q);
        const matchesLocation = item.areaLocation?.toLowerCase().includes(q);
        const matchesInspector = item.inspectorName?.toLowerCase().includes(q);
        const matchesUnit = item.unit?.toLowerCase().includes(q);
        const matchesCode = item.equipmentOrFacilityCode?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesId && !matchesLocation && !matchesInspector && !matchesUnit && !matchesCode) {
          return false;
        }
      }
      return true;
    });
  }, [inspections, selectedTypeTab, statusFilter, approvalFilter, scheduleFilter, searchQuery]);

  // Overall KPIs calculation
  const totalInspections = inspections.length;
  const avgComplianceScore = totalInspections > 0 
    ? Math.round(inspections.reduce((acc, i) => acc + (i.scorePercent || 0), 0) / totalInspections) 
    : 100;
  const totalDefectsCount = inspections.reduce((acc, i) => acc + (i.failedCount || 0), 0);
  const actionRequiredCount = inspections.filter(i => i.status === 'ACTION_REQUIRED').length;
  const pendingApprovalCount = inspections.filter(i => i.approvalStatus === 'PENDING_APPROVAL').length;
  
  // Calculate overdue periodic inspections
  const overduePeriodicCount = useMemo(() => {
    const today = getTodayJalaliDate();
    return inspections.filter(i => {
      if ((i.scheduleType || 'PERIODIC') !== 'PERIODIC' || !i.nextInspectionDate) return false;
      return getJalaliDaysDifference(i.nextInspectionDate, today) < 0;
    }).length;
  }, [inspections]);

  const handleCreateNew = () => {
    setEditingInspection(null);
    setIsFormOpen(true);
  };

  const handleEdit = (insp: HealthEnvInspection) => {
    setEditingInspection(insp);
    setIsFormOpen(true);
  };

  const handleRequestDelete = (id: string) => {
    setDeletingInspectionId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deletingInspectionId) return;
    try {
      setIsDeleting(true);
      await healthEnvChecklistService.deleteInspection(
        deletingInspectionId, 
        currentUser?.fullName || currentUser?.name || 'کاربر سیستم'
      );
      if (viewingInspection?.id === deletingInspectionId) {
        setViewingInspection(null);
      }
      setDeletingInspectionId(null);
    } catch (err: any) {
      alert(err?.message || 'خطا در حذف بازرسی');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveInspection = async (formData: Partial<HealthEnvInspection>) => {
    return healthEnvChecklistService.saveInspection(formData, currentUser?.fullName || currentUser?.name || 'کارشناس بهداشت');
  };

  const handleApproveInspection = async (id: string, comment?: string) => {
    const updated = await healthEnvChecklistService.approveInspection(
      id, 
      currentUser?.fullName || currentUser?.name || 'مدیر HSE', 
      'سرپرست بهداشت و محیط زیست', 
      comment
    );
    if (viewingInspection && viewingInspection.id === id) {
      setViewingInspection(updated);
    }
    return updated;
  };

  const handleRejectInspection = async (id: string, comment: string) => {
    const updated = await healthEnvChecklistService.rejectInspection(
      id, 
      currentUser?.fullName || currentUser?.name || 'مدیر HSE', 
      'سرپرست بهداشت و محیط زیست', 
      comment
    );
    if (viewingInspection && viewingInspection.id === id) {
      setViewingInspection(updated);
    }
    return updated;
  };

  const getChecklistIcon = (type: HealthEnvChecklistType) => {
    switch (type) {
      case 'premises-buildings': return <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'pantries-kitchenettes': return <Coffee className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case 'restaurant-dining': return <UtensilsCrossed className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'ambulance-equipment': return <Ambulance className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
      case 'workshop-restrooms': return <Bath className="w-5 h-5 text-sky-600 dark:text-sky-400" />;
      default: return <FileText className="w-5 h-5 text-slate-600" />;
    }
  };

  const getScheduleBadge = (insp: HealthEnvInspection) => {
    const type = insp.scheduleType || 'PERIODIC';
    if (type === 'ADHOC') {
      return (
        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          موردی
        </span>
      );
    }
    
    // Periodic interval label
    const intervalMap: Record<string, string> = {
      DAILY: 'روزانه',
      MONTHLY: 'ماهانه',
      QUARTERLY: 'سه‌ماهه',
      SEMI_ANNUAL: 'شش‌ماهه',
      ANNUAL: 'سالانه'
    };
    const label = intervalMap[insp.periodicInterval || 'MONTHLY'] || 'ماهانه';

    // Check overdue
    const today = getTodayJalaliDate();
    const isOverdue = insp.nextInspectionDate && getJalaliDaysDifference(insp.nextInspectionDate, today) < 0;

    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
          دوره‌ای ({label})
        </span>
        {insp.nextInspectionDate && (
          <span className={`text-[9px] font-mono font-bold ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
            {isOverdue ? `سررسید گذشته: ${insp.nextInspectionDate}` : `موعد: ${insp.nextInspectionDate}`}
          </span>
        )}
      </div>
    );
  };

  // Export to Excel / CSV
  const handleExportCSV = () => {
    if (inspections.length === 0) {
      alert('داده‌ای برای خروجی وجود ندارد.');
      return;
    }
    const headers = ['شناسه', 'نوع چک‌لیست', 'عنوان', 'تاریخ', 'زمان‌بندی', 'موعد بعدی', 'موقعیت', 'بازرس', 'درصد انطباق', 'مطلوب', 'نامطلوب', 'وضعیت تأیید'];
    const rows = filteredInspections.map(i => [
      i.id,
      i.checklistTypeNameFa,
      i.title,
      i.inspectionDate,
      i.scheduleType === 'ADHOC' ? 'موردی' : `دوره‌ای (${i.periodicInterval || 'MONTHLY'})`,
      i.nextInspectionDate || '-',
      i.areaLocation,
      i.inspectorName,
      `${i.scorePercent}%`,
      i.passedCount,
      i.failedCount,
      i.approvalStatus
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    downloadCsvFile(`HSE-Health-Env-Checklists-${Date.now()}.csv`, csvContent);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir="rtl">
      
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-850 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center border border-teal-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                چک‌لیست‌های عملیاتی بهداشت و محیط زیست
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                سامانه پایش استاندارد اماکن، آبدارخانه‌ها، رستوران، آمبولانس و سرویس‌های بهداشتی (ثبت پایدار در پایگاه داده مرکزی)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setIsManageTemplatesOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>مدیریت الگوها و آیتم‌ها</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>خروجی اکسل / CSV</span>
          </button>

          <button
            type="button"
            onClick={handleCreateNew}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-md shadow-teal-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت بازرسی بهداشتی جدید</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-850 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">کل بازرسی‌های ثبت‌شده</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900 dark:text-white font-mono">{totalInspections}</span>
            <span className="text-[10px] text-teal-600 font-bold">پرونده فعال</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-850 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">میانگین انطباق بهداشتی</span>
          <div className="flex items-baseline justify-between">
            <span className={`text-xl font-black font-mono ${
              avgComplianceScore >= 80 ? 'text-emerald-600' :
              avgComplianceScore >= 60 ? 'text-amber-600' : 'text-rose-600'
            }`}>
              {avgComplianceScore}%
            </span>
            <span className="text-[10px] text-slate-400 font-bold">کل چک‌لیست‌ها</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-850 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">نواقص شناسایی‌شده</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-rose-600 font-mono">{totalDefectsCount}</span>
            <span className="text-[10px] text-rose-500 font-bold">مورد عدم انطباق</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-850 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">در انتظار اقدام اصلاحی</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-amber-600 font-mono">{actionRequiredCount}</span>
            <span className="text-[10px] text-amber-500 font-bold">نیازمند پیگیری</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-850 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">سررسید گذشته دوره‌ای</span>
          <div className="flex items-baseline justify-between">
            <span className={`text-xl font-black font-mono ${overduePeriodicCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {overduePeriodicCount}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">
              {overduePeriodicCount > 0 ? 'نیازمند تجدید' : 'به‌روز'}
            </span>
          </div>
        </div>
      </div>

      {/* Checklist Templates Category Filter Tabs */}
      <div className="bg-white dark:bg-slate-850 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-1.5 overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setSelectedTypeTab('ALL')}
          className={`px-4 py-2 rounded-xl font-bold transition shrink-0 cursor-pointer ${
            selectedTypeTab === 'ALL'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>همه چک‌لیست‌ها</span>
          <span className="mr-1.5 px-1.5 py-0.5 rounded-full bg-black/10 text-[10px] font-mono">
            {inspections.length}
          </span>
        </button>

        {templates.map(tmpl => {
          const count = inspections.filter(i => i.checklistTypeId === tmpl.id).length;
          const active = selectedTypeTab === tmpl.id;
          return (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => setSelectedTypeTab(tmpl.id)}
              className={`px-3.5 py-2 rounded-xl font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                active
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>{tmpl.titleFa}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                active ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-850 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="جستجو در عنوان، شناسه، موقعیت، بازرس یا پلاک..."
            className="w-full pr-10 pl-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-teal-500/30"
          />
        </div>

        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
          {/* Schedule filter */}
          <select
            value={scheduleFilter}
            onChange={e => setScheduleFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold focus:ring-2 focus:ring-teal-500/30 cursor-pointer"
          >
            <option value="ALL">همه زمان‌بندی‌ها (دوره‌ای و موردی)</option>
            <option value="PERIODIC">فقط بازرسی‌های دوره‌ای</option>
            <option value="ADHOC">فقط بازرسی‌های موردی (Ad-Hoc)</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold focus:ring-2 focus:ring-teal-500/30 cursor-pointer"
          >
            <option value="ALL">همه وضعیت‌ها</option>
            <option value="COMPLETED">تکمیل‌شده (بی‌نقص)</option>
            <option value="ACTION_REQUIRED">نیازمند اقدام اصلاحی</option>
            <option value="IN_PROGRESS">در حال انجام</option>
            <option value="CLOSED">بسته شده</option>
          </select>

          {/* Approval filter */}
          <select
            value={approvalFilter}
            onChange={e => setApprovalFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold focus:ring-2 focus:ring-teal-500/30 cursor-pointer"
          >
            <option value="ALL">همه تأییدات</option>
            <option value="APPROVED">تأییدشده رسمی</option>
            <option value="PENDING_APPROVAL">در انتظار بررسی</option>
            <option value="REJECTED">رد شده</option>
          </select>

          {(searchQuery || selectedTypeTab !== 'ALL' || statusFilter !== 'ALL' || approvalFilter !== 'ALL' || scheduleFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedTypeTab('ALL');
                setStatusFilter('ALL');
                setApprovalFilter('ALL');
                setScheduleFilter('ALL');
              }}
              className="px-3 py-2 bg-rose-50 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition cursor-pointer"
            >
              پاک‌کردن فیلترها
            </button>
          )}
        </div>
      </div>

      {/* Inspections Table */}
      {filteredInspections.length > 0 ? (
        <div className="bg-white dark:bg-slate-850 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-24 text-center">شناسه</th>
                  <th className="p-3">عنوان بازرسی و الگو</th>
                  <th className="p-3 w-40">زمان‌بندی و سررسید</th>
                  <th className="p-3 w-36">موقعیت و واحد</th>
                  <th className="p-3 w-28">بازرس</th>
                  <th className="p-3 w-24">تاریخ بازرسی</th>
                  <th className="p-3 w-20 text-center">پیوست</th>
                  <th className="p-3 w-20 text-center">انطباق</th>
                  <th className="p-3 w-24 text-center">وضعیت تأیید</th>
                  <th className="p-3 w-48 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInspections.map((insp) => {
                  const referrals = getReferralsForDocument('AUDIT_CHECKLIST', insp.id);
                  const hasRef = referrals.length > 0;
                  return (
                    <tr 
                      key={insp.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="p-3 text-center font-mono text-teal-700 dark:text-teal-400 font-bold">
                        {insp.id}
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {getChecklistIcon(insp.checklistTypeId)}
                          <span>{insp.title}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {insp.checklistTypeNameFa}
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        {getScheduleBadge(insp)}
                      </td>

                      <td className="p-3 text-slate-700 dark:text-slate-300">
                        <div>{insp.areaLocation || '-'}</div>
                        <div className="text-[10px] text-slate-400">{insp.unit}</div>
                      </td>

                      <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                        {insp.inspectorName}
                      </td>

                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                        {insp.inspectionDate}
                      </td>

                      <td className="p-3 text-center">
                        {(insp.attachments?.length || 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-md">
                            <Paperclip className="w-3 h-3" />
                            <span>{insp.attachments?.length}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <span className={`font-mono font-black ${
                          insp.scorePercent >= 85 ? 'text-emerald-600' :
                          insp.scorePercent >= 65 ? 'text-amber-600' : 'text-rose-600'
                        }`}>
                          {insp.scorePercent}%
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {insp.passedCount}P / {insp.failedCount}F
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          insp.approvalStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                          insp.approvalStatus === 'REJECTED' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                          'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                          {insp.approvalStatus === 'APPROVED' ? 'تأییدشده' : 
                           insp.approvalStatus === 'REJECTED' ? 'رد شده' : 'در انتظار'}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingInspection(insp)}
                            className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/40 transition cursor-pointer"
                            title="مشاهده جزئیات کامل"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setPrintingInspection(insp)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                            title="چاپ فرم رسمی A4"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setReferralTargetInspection(insp)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer"
                            title="ارجاع و امضای دیجیتال"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          {hasRef && (
                            <button
                              type="button"
                              onClick={() => setTrackerTargetInspection(insp)}
                              className="p-1.5 text-slate-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/40 transition cursor-pointer"
                              title="پیگیری گردش کار و امضاها"
                            >
                              <GitCommit className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleEdit(insp)}
                            className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/40 transition cursor-pointer"
                            title="ویرایش چک‌لیست"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRequestDelete(insp.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="حذف چک‌لیست"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white dark:bg-slate-850 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center mx-auto shadow-xs">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-black text-slate-800 dark:text-white">
              {searchQuery || selectedTypeTab !== 'ALL' || statusFilter !== 'ALL' || scheduleFilter !== 'ALL'
                ? 'هیچ بازرسی با فیلترهای انتخابی یافت نشد'
                : 'هنوز بازرسی بهداشتی ثبت نشده است'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {searchQuery || selectedTypeTab !== 'ALL' || statusFilter !== 'ALL' || scheduleFilter !== 'ALL'
                ? 'لطفاً عبارت جستجو یا شروط فیلتر را تغییر دهید.'
                : 'می‌توانید با کلیک بر روی دکمه زیر، اولین چک‌لیست بازدید بهداشتی را با استفاده از الگوهای استاندارد پنج‌گانه ثبت فرمایید.'}
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={handleCreateNew}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer shadow-md shadow-teal-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت اولین بازرسی بهداشتی</span>
            </button>
          </div>
        </div>
      )}

      {/* Form Modal (Create / Edit) */}
      <HealthEnvChecklistFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingInspection(null);
        }}
        templates={templates}
        initialData={editingInspection}
        defaultTypeId={selectedTypeTab !== 'ALL' ? selectedTypeTab : 'premises-buildings'}
        onSave={handleSaveInspection}
        currentUser={currentUser}
      />

      {/* Detail View Modal */}
      <HealthEnvChecklistDetailModal
        isOpen={Boolean(viewingInspection)}
        onClose={() => setViewingInspection(null)}
        inspection={viewingInspection}
        onEdit={insp => {
          setViewingInspection(null);
          handleEdit(insp);
        }}
        onOpenPrint={() => {
          setPrintingInspection(viewingInspection);
        }}
        onOpenReferral={insp => {
          setReferralTargetInspection(insp);
        }}
        onOpenWorkflowTracker={insp => {
          setTrackerTargetInspection(insp);
        }}
        onDelete={id => handleRequestDelete(id)}
        onApprove={handleApproveInspection}
        onReject={handleRejectInspection}
        currentUser={currentUser}
      />

      {/* Manage Templates Modal */}
      <HealthEnvManageTemplateModal
        isOpen={isManageTemplatesOpen}
        onClose={() => setIsManageTemplatesOpen(false)}
        templates={templates}
        selectedTypeId={selectedTypeTab !== 'ALL' ? selectedTypeTab : (templates[0]?.id || 'premises-buildings')}
        onSaveTemplate={async (tmpl) => {
          await healthEnvChecklistService.saveTemplate(tmpl, currentUser?.fullName || currentUser?.name || 'مدیر بهداشت و ایمنی');
        }}
        onDeleteTemplate={async (tmplId) => {
          await healthEnvChecklistService.deleteTemplate(tmplId, currentUser?.fullName || currentUser?.name || 'مدیر بهداشت و ایمنی');
        }}
        onAddChecklistItem={(tmplId, item) => healthEnvChecklistService.addChecklistItem(tmplId, item, currentUser?.fullName || currentUser?.name || 'مدیر بهداشت و ایمنی')}
        onUpdateChecklistItem={(tmplId, item) => healthEnvChecklistService.updateChecklistItem(tmplId, item, currentUser?.fullName || currentUser?.name || 'مدیر بهداشت و ایمنی')}
        onDeleteChecklistItem={(tmplId, itemId) => healthEnvChecklistService.deleteChecklistItem(tmplId, itemId, currentUser?.fullName || currentUser?.name || 'مدیر بهداشت و ایمنی')}
        onReorderChecklistItems={(tmplId, items) => healthEnvChecklistService.reorderChecklistItems(tmplId, items, currentUser?.fullName || currentUser?.name || 'مدیر بهداشت و ایمنی')}
        onResetTemplate={(tmplId) => healthEnvChecklistService.resetTemplateToDefault(tmplId, currentUser?.fullName || currentUser?.name || 'مدیر بهداشت و ایمنی')}
        currentUser={currentUser}
      />

      {/* Official A4 Print Modal with System Branding */}
      <HealthEnvChecklistPrintModal
        isOpen={Boolean(printingInspection)}
        onClose={() => setPrintingInspection(null)}
        inspection={printingInspection}
      />

      {/* Create Referral Modal (ارجاع و امضای دیجیتال) */}
      {referralTargetInspection && (
        <CreateReferralModal
          documentType="AUDIT_CHECKLIST"
          documentId={referralTargetInspection.id}
          documentNumber={`HSE-CHK-${referralTargetInspection.id}`}
          documentTitle={`چک‌لیست بهداشت: ${referralTargetInspection.title}`}
          currentUser={currentUser}
          isFa={language === 'fa'}
          onClose={() => setReferralTargetInspection(null)}
          onSuccess={() => {
            setReferralTargetInspection(null);
            healthEnvChecklistService.reloadFromServer();
          }}
        />
      )}

      {/* Document Workflow Tracker Modal (رهگیری گردش کار و سوابق امضا) */}
      {trackerTargetInspection && (
        <DocumentWorkflowTrackerModal
          isOpen={Boolean(trackerTargetInspection)}
          documentType="AUDIT_CHECKLIST"
          documentId={trackerTargetInspection.id}
          documentTitle={`چک‌لیست بهداشت: ${trackerTargetInspection.title}`}
          currentUser={currentUser}
          isFa={language === 'fa'}
          onClose={() => setTrackerTargetInspection(null)}
        />
      )}

      {/* Standard Delete Confirmation Dialog */}
      {deletingInspectionId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900/50">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                تأیید حذف چک‌لیست بازرسی
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                آیا از حذف دائم چک‌لیست با شناسه <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{deletingInspectionId}</span> اطمینان دارید؟ کلیه اقلام، پیوست‌ها و سوابق این چک‌لیست از پایگاه داده حذف شده و رویداد حذف در Audit Log سامانه ثبت خواهد شد.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingInspectionId(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-md shadow-rose-600/30 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'در حال حذف...' : 'تأیید و حذف دائم'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
