import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Search, Filter, Calendar, MapPin, 
  CheckCircle2, AlertTriangle, Printer, Trash2, 
  Eye, Edit3, ShieldAlert, CheckSquare, Download,
  Layers, ArrowUpRight, X, User, Clock, FileText, Check, LayoutGrid, List,
  CalendarCheck, Link2, History, Info, Sparkles, RefreshCw, Truck, Scale,
  Bell, Sliders, ShieldCheck, HelpCircle, RotateCw, GitBranch, CheckCheck, Archive,
  Camera, Image as ImageIcon, ZoomIn, Settings
} from 'lucide-react';
import { OperationalSafetyInspection, SafetyChecklistTypeTemplate, SafetyChecklistInspectionItem, ChecklistItemVerdict, SafetyAuditPhoto } from '../types';
import InspectionAlertSettingsModal from "./InspectionAlertSettingsModal";
import OperationalChecklistPrintModal from "./OperationalChecklistPrintModal";
import SafetyManageTemplateModal from "./SafetyManageTemplateModal";
import SafetyChecklistFormModal from "./SafetyChecklistFormModal";
import { safetyDeptService } from '../services/safetyDeptService';
import { getUnits, getOrgSites } from '../../../utils/orgHelper';
import { getComplexPersonnelList } from '../../../utils/personnelHelper';
import { useFinalSubmit } from '../../../context/FinalSubmitContext';
import { 
  UnifiedInspectionTimingType, 
  PeriodicIntervalType,
  PERIODIC_INTERVAL_OPTIONS,
  INSPECTION_TIMING_OPTIONS, 
  INSPECTION_TIMING_CONFIGS, 
  calculateNextInspectionDate, 
  normalizeInspectionType, 
  normalizePeriodicInterval,
  getPeriodicIntervalLabel,
  getInspectionTypeDisplay,
  getTodayJalaliDate,
  isMachineryChecklist,
  getMachineryCategory,
  evaluateChecklistScheduleStatus,
  getInspectionAlertSettings,
  InspectionAlertSettings,
  InspectionScheduleAlertStatus
} from '../../../utils/inspectionScheduleHelper';
import { apiDb } from '../../../services/apiDatabaseClient';
import { downloadCsvFile } from '../../../utils/fileHelpers';

interface Props {
  inspections: OperationalSafetyInspection[];
  templates: SafetyChecklistTypeTemplate[];
  selectedTemplateId?: string;
  initialScheduleStatus?: string;
  selectedAudit?: OperationalSafetyInspection | null;
  initialReinspectAudit?: OperationalSafetyInspection | null;
  onSaveInspection: (inspection: Partial<OperationalSafetyInspection>) => void;
  onDeleteInspection: (id: string) => void;
  currentUser?: any;
  isFa: boolean;
}

export default function OperationalChecklistsView({
  inspections,
  templates,
  selectedTemplateId,
  initialScheduleStatus,
  selectedAudit,
  initialReinspectAudit,
  onSaveInspection,
  onDeleteInspection,
  currentUser,
  isFa
}: Props) {
  const { confirmFinalSubmit } = useFinalSubmit();
  const [filterType, setFilterType] = useState<string>(selectedTemplateId || 'ALL');
  const [filterTiming, setFilterTiming] = useState<string>('ALL');
  const [filterSite, setFilterSite] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterScheduleStatus, setFilterScheduleStatus] = useState<string>(initialScheduleStatus || 'ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Sites list from Organizational Structure
  const availableSites = useMemo(() => {
    return getOrgSites() || [];
  }, []);

  // Inspection Schedule Alert Settings State
  const [alertSettings, setAlertSettings] = useState<InspectionAlertSettings>(getInspectionAlertSettings());
  const [isAlertSettingsOpen, setIsAlertSettingsOpen] = useState(false);
  const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false);

  useEffect(() => {
    if (initialScheduleStatus) {
      setFilterScheduleStatus(initialScheduleStatus);
    }
  }, [initialScheduleStatus]);

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
  
  const [deleteConfirm, setDeleteConfirm] = useState<{
    title: string;
    description?: string;
    onConfirm: () => void;
  } | null>(null);

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeInspection, setActiveInspection] = useState<OperationalSafetyInspection | null>(null);
  const [ncFeedbackToast, setNcFeedbackToast] = useState<string | null>(null);

  // Re-inspection State
  const [isReinspectionMode, setIsReinspectionMode] = useState(false);
  const [reinspectSourceInspection, setReinspectSourceInspection] = useState<OperationalSafetyInspection | null>(null);

  useEffect(() => {
    if (selectedAudit) {
      setActiveInspection(selectedAudit);
      setIsDetailOpen(true);
    }
  }, [selectedAudit]);

  useEffect(() => {
    if (initialReinspectAudit) {
      handleReinspectInspection(initialReinspectAudit);
    }
  }, [initialReinspectAudit]);

  const handleOpenNewForm = (typeId?: string) => {
    setIsReinspectionMode(false);
    setReinspectSourceInspection(null);
    setActiveInspection(null);
    if (typeId) {
      setFilterType(typeId);
    }
    setIsFormOpen(true);
  };

  const handleEditInspection = (insp: OperationalSafetyInspection) => {
    setIsReinspectionMode(false);
    setReinspectSourceInspection(null);
    setActiveInspection(insp);
    setIsFormOpen(true);
  };

  const handleReinspectInspection = (sourceInsp: OperationalSafetyInspection) => {
    setIsReinspectionMode(true);
    setReinspectSourceInspection(sourceInsp);
    setActiveInspection(null);
    setIsDetailOpen(false);
    setIsFormOpen(true);
  };

  const [showArchivedCyclesInMainList, setShowArchivedCyclesInMainList] = useState(false);

  // Compute Schedule Evaluation and Status Counts
  const inspectionEvaluations = useMemo(() => {
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

  const scheduleCounts = useMemo(() => {
    let valid = 0;
    let warning = 0;
    let overdue = 0;
    let unscheduled = 0;
    let completedArchived = 0;
    let activeTotal = 0;

    inspections.forEach(i => {
      if (i.isArchivedCycle) {
        completedArchived++;
      } else {
        activeTotal++;
        const evalStatus = inspectionEvaluations.get(i.id)?.status;
        if (evalStatus === 'VALID') valid++;
        else if (evalStatus === 'WARNING') warning++;
        else if (evalStatus === 'OVERDUE') overdue++;
        else if (evalStatus === 'NOT_SCHEDULED') unscheduled++;
      }
    });

    return {
      total: activeTotal,
      allTotal: inspections.length,
      valid,
      warning,
      overdue,
      unscheduled,
      completedArchived,
      urgentTotal: warning + overdue
    };
  }, [inspections, inspectionEvaluations]);

  // Filtered List (Excludes archived completed previous cycles from 'ALL' and active status views)
  const filteredInspections = useMemo(() => {
    return inspections.filter(i => {
      // Schedule status / Completed section filter logic
      if (filterScheduleStatus === 'COMPLETED_ARCHIVE') {
        if (!i.isArchivedCycle) return false;
      } else if (filterScheduleStatus === 'ALL') {
        // By default in 'ALL', only display active current cycle inspections
        if (i.isArchivedCycle && !showArchivedCyclesInMainList) return false;
      } else {
        // For specific active statuses (VALID, WARNING, OVERDUE, NOT_SCHEDULED):
        if (i.isArchivedCycle) return false;
        const evalStatus = inspectionEvaluations.get(i.id)?.status;
        if (evalStatus !== filterScheduleStatus) return false;
      }

      if (filterType !== 'ALL' && i.checklistTypeId !== filterType) return false;
      if (filterTiming !== 'ALL') {
        const norm = normalizeInspectionType(i.inspectionType);
        if (norm !== filterTiming) return false;
      }
      if (filterSite !== 'ALL' && i.site !== filterSite) return false;
      if (filterStatus !== 'ALL' && i.status !== filterStatus) return false;
      
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = i.title?.toLowerCase().includes(q);
        const matchId = i.id?.toLowerCase().includes(q);
        const matchInspector = i.inspectorName?.toLowerCase().includes(q);
        const matchUnit = i.unit?.toLowerCase().includes(q);
        const matchArea = i.areaLocation?.toLowerCase().includes(q);
        const matchRelated = (i.relatedOperationId?.toLowerCase().includes(q) || i.relatedOperationTitle?.toLowerCase().includes(q));
        const matchMachinery = (i.machinerySpecs?.toLowerCase().includes(q) || i.machineryTonnage?.toLowerCase().includes(q) || i.machineryTagNumber?.toLowerCase().includes(q) || i.machineryType?.toLowerCase().includes(q));
        const matchSuperseded = i.supersededByInspectionId?.toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchInspector && !matchUnit && !matchArea && !matchRelated && !matchMachinery && !matchSuperseded) return false;
      }
      return true;
    });
  }, [inspections, filterType, filterTiming, filterSite, filterStatus, filterScheduleStatus, searchQuery, inspectionEvaluations, showArchivedCyclesInMainList]);

  // Export to Excel / CSV
  const handleExportCSV = () => {
    if (filteredInspections.length === 0) {
      alert(isFa ? 'داده‌ای برای خروجی وجود ندارد.' : 'No data to export.');
      return;
    }
    const headers = ['شناسه', 'نوع چک‌لیست', 'عنوان', 'تاریخ', 'زمان‌بندی', 'موعد بعدی', 'سایت', 'واحد', 'موقعیت', 'بازرس', 'درصد انطباق', 'مطلوب', 'نامطلوب', 'وضعیت'];
    const rows = filteredInspections.map(i => [
      i.id,
      i.checklistTypeNameFa,
      i.title,
      i.inspectionDate,
      i.inspectionType,
      i.nextInspectionDate || '-',
      i.site,
      i.unit,
      i.areaLocation,
      i.inspectorName,
      `${i.scorePercent}%`,
      i.passedCount,
      i.failedCount,
      i.status
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    downloadCsvFile(`HSE-Safety-Checklists-${Date.now()}.csv`, csvContent);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-blue-600" />
            <span>{isFa ? 'مدیریت و ثبت چک‌لیست‌های عملیاتی ایمنی' : 'Operational Safety Checklists'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isFa 
              ? 'ثبت ممیزی‌ها، زمان‌بندی دوره‌ای هوشمند، هشدارهای سررسید ۴ وضعیتی و نظارت بر تجهیزات حساس' 
              : 'Manage site inspections, 4-tier schedule alert status, and high-risk equipment audits'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Manage Templates & Items Button */}
          <button
            type="button"
            onClick={() => setIsManageTemplatesOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs"
            title={isFa ? 'مدیریت الگوها، بندهای کنترلی و دسته‌بندی‌ها' : 'Manage Checklist Templates & Items'}
          >
            <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>{isFa ? 'مدیریت الگوها و آیتم‌ها' : 'Manage Templates & Items'}</span>
          </button>

          {/* Export to Excel / CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs"
            title={isFa ? 'دریافت خروجی اکسل / CSV' : 'Export Excel / CSV'}
          >
            <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>{isFa ? 'خروجی اکسل / CSV' : 'Export Excel / CSV'}</span>
          </button>

          {/* Alert Settings Trigger Button */}
          <button
            onClick={() => setIsAlertSettingsOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs"
            title={isFa ? 'تنظیمات زمان هشدار و آستانه سررسید بازرسی‌ها' : 'Inspection Alert Settings'}
          >
            <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>{isFa ? 'تنظیمات زمان هشدار سررسید' : 'Alert Lead-Times'}</span>
            {scheduleCounts.urgentTotal > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] font-mono font-black flex items-center justify-center">
                {scheduleCounts.urgentTotal}
              </span>
            )}
          </button>

          {/* New Checklist Button */}
          <button
            onClick={() => handleOpenNewForm()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{isFa ? 'ثبت چک‌لیست جدید' : 'New Checklist Audit'}</span>
          </button>
        </div>
      </div>

      {ncFeedbackToast && (
        <div className="p-3.5 bg-emerald-600 text-white rounded-2xl shadow-md flex items-center justify-between text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{ncFeedbackToast}</span>
          </div>
          <button onClick={() => setNcFeedbackToast(null)} className="p-1 hover:bg-white/20 rounded-lg">✕</button>
        </div>
      )}

      {/* Top Banner Alert (Shown when Overdue or Approaching Warning items exist and banner enabled) */}
      {alertSettings.bannerAlertEnabled && (scheduleCounts.overdue > 0 || scheduleCounts.warning > 0) && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 via-amber-100/70 to-rose-50 dark:from-amber-950/40 dark:via-amber-900/30 dark:to-rose-950/40 border-2 border-amber-300 dark:border-amber-700/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-amber-950 dark:text-amber-100">
                  {isFa ? 'هشدارهای هوشمند سررسید و موعد بازرسی‌های دوره‌ای:' : 'Upcoming & Overdue Inspection Alerts:'}
                </span>
                {scheduleCounts.overdue > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[11px] font-black font-mono">
                    {scheduleCounts.overdue} {isFa ? 'مورد سررسید گذشته (قرمز)' : 'Overdue'}
                  </span>
                )}
                {scheduleCounts.warning > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500 text-amber-950 text-[11px] font-black font-mono">
                    {scheduleCounts.warning} {isFa ? 'مورد نزدیک به سررسید (زرد)' : 'Approaching'}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-900/90 dark:text-amber-200 mt-1 font-medium leading-relaxed">
                {isFa 
                  ? `بازه هشدار فعال: ${alertSettings.warningThresholdDays} روز قبل از تاریخ سررسید. لطفاً نسبت به برنامه‌ریزی و اجرای به‌موقع بازرسی‌های نیازمند اقدام اقدام فرمایید.`
                  : `Active warning lead-time: ${alertSettings.warningThresholdDays} days before due date. Please take action on urgent items.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            {scheduleCounts.overdue > 0 && (
              <button
                onClick={() => setFilterScheduleStatus('OVERDUE')}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all cursor-pointer shadow-xs"
              >
                {isFa ? 'فیلتر موارد گذشته (قرمز)' : 'View Overdue'}
              </button>
            )}
            {scheduleCounts.warning > 0 && (
              <button
                onClick={() => setFilterScheduleStatus('WARNING')}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-all cursor-pointer shadow-xs"
              >
                {isFa ? 'فیلتر موارد نزدیک (زرد)' : 'View Approaching'}
              </button>
            )}
            <button
              onClick={() => setIsAlertSettingsOpen(true)}
              className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 transition-all cursor-pointer"
              title={isFa ? 'تغییر زمان هشدار' : 'Alert Settings'}
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4-STATUS & ARCHIVE FILTER TABS (سبز، زرد، قرمز، انجام‌شده‌ها، خاکستری) */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
          {/* ALL ACTIVE */}
          <button
            onClick={() => setFilterScheduleStatus('ALL')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              filterScheduleStatus === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
            }`}
          >
            <span>{isFa ? 'همه بازرسی‌های جاری' : 'All Active Cycles'}</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-black/10 dark:bg-white/20 font-black">
              {scheduleCounts.total}
            </span>
          </button>

          {/* GREEN: VALID */}
          <button
            onClick={() => setFilterScheduleStatus('VALID')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              filterScheduleStatus === 'VALID'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-900 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span>{isFa ? 'سبز: جاری و معتبر' : 'Green: Valid'}</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-emerald-200 dark:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 font-black">
              {scheduleCounts.valid}
            </span>
          </button>

          {/* YELLOW: WARNING */}
          <button
            onClick={() => setFilterScheduleStatus('WARNING')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              filterScheduleStatus === 'WARNING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 hover:bg-amber-100'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
            <span>{isFa ? 'زرد: نزدیک به موعد بازرسی' : 'Yellow: Approaching'}</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 font-black">
              {scheduleCounts.warning}
            </span>
          </button>

          {/* RED: OVERDUE */}
          <button
            onClick={() => setFilterScheduleStatus('OVERDUE')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              filterScheduleStatus === 'OVERDUE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-900 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span>{isFa ? 'قرمز: سررسید گذشته' : 'Red: Overdue'}</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-rose-200 dark:bg-rose-900/60 text-rose-950 dark:text-rose-100 font-black">
              {scheduleCounts.overdue}
            </span>
          </button>

          {/* COMPLETED / ARCHIVED PRIOR CYCLES */}
          <button
            onClick={() => setFilterScheduleStatus('COMPLETED_ARCHIVE')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              filterScheduleStatus === 'COMPLETED_ARCHIVE'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-indigo-900 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100'
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>{isFa ? 'انجام‌شده‌ها / سوابق دوره‌های قبل' : 'Completed (Prior Cycles)'}</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-indigo-200 dark:bg-indigo-900/60 text-indigo-950 dark:text-indigo-100 font-black">
              {scheduleCounts.completedArchived}
            </span>
          </button>
        </div>
      </div>

      {/* Checklist Templates Category Filter Tabs */}
      <div className="bg-white dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-xs">
        <button
          type="button"
          onClick={() => setFilterType('ALL')}
          className={`px-4 py-2 rounded-xl font-bold transition shrink-0 cursor-pointer ${
            filterType === 'ALL'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
          }`}
        >
          <span>{isFa ? 'همه الگوها و چک‌لیست‌ها' : 'All Templates'}</span>
          <span className="mr-1.5 px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/20 text-[10px] font-mono font-black">
            {inspections.length}
          </span>
        </button>

        {templates.map(tmpl => {
          const count = inspections.filter(i => i.checklistTypeId === tmpl.id).length;
          const active = filterType === tmpl.id;
          return (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => setFilterType(tmpl.id)}
              className={`px-3.5 py-2 rounded-xl font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                active
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
              }`}
            >
              <span>{isFa ? tmpl.titleFa : tmpl.titleEn}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black ${
                active ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-[0px] w-full md:min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={isFa ? 'جستجو بر اساس عنوان، کد بازرسی، بازرس، عملیات، مشخصات ماشین‌آلات...' : 'Search audits, operations, machinery...'}
            className="w-full pl-3 pr-9 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter by Inspection Type (Timing Logic) */}
        <select
          value={filterTiming}
          onChange={e => setFilterTiming(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <option value="ALL">{isFa ? 'تمامی انواع بازرسی (دوره‌ای/عملیاتی)' : 'All Inspection Types'}</option>
          <option value="PERIODIC">{isFa ? 'دوره‌ای (ماهانه)' : 'Periodic (Monthly)'}</option>
          <option value="PRE_OP">{isFa ? 'قبل از عملیات' : 'Pre-Operation'}</option>
          <option value="POST_OP">{isFa ? 'بعد از عملیات' : 'Post-Operation'}</option>
          <option value="ADHOC">{isFa ? 'موردی / ویژه' : 'Ad-Hoc / Special'}</option>
        </select>

        {/* Filter by Checklist Template */}
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <option value="ALL">{isFa ? 'تمامی قالب‌های چک‌لیست' : 'All Checklist Templates'}</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>
              {isFa ? t.titleFa : t.titleEn}
            </option>
          ))}
        </select>

        {/* Filter by Site */}
        <select
          value={filterSite}
          onChange={e => setFilterSite(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <option value="ALL">{isFa ? 'تمامی سایت‌ها' : 'All Sites'}</option>
          {availableSites.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Filter by Compliance Status */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <option value="ALL">{isFa ? 'تمامی نتایج ممیزی' : 'All Audit Results'}</option>
          <option value="COMPLETED">{isFa ? 'منطبق و تاییدشده' : 'Compliant'}</option>
          <option value="ACTION_REQUIRED">{isFa ? 'دارای عدم انطباق (CAPA)' : 'Action Required'}</option>
        </select>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
            title={isFa ? 'نمایش کارتی' : 'Grid View'}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
            title={isFa ? 'نمایش ردیفی' : 'List View'}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Inspections Container */}
      <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-3"}>
        {filteredInspections.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-800 p-12 rounded-2xl border border-slate-200 dark:border-slate-700 text-center space-y-3">
            <CheckSquare className="w-12 h-12 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-600 dark:text-slate-300">
              {isFa ? 'هیچ چک‌لیستی با فیلترهای انتخابی یافت نشد.' : 'No checklists match selected filters.'}
            </div>
            <button
              onClick={() => {
                setFilterType('ALL');
                setFilterTiming('ALL');
                setFilterSite('ALL');
                setFilterStatus('ALL');
                setFilterScheduleStatus('ALL');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              {isFa ? 'پاک‌کردن فیلترها' : 'Clear Filters'}
            </button>
          </div>
        ) : (
          filteredInspections.map(insp => {
            const timingInfo = getInspectionTypeDisplay(insp.inspectionType, isFa);
            const isPeriodic = timingInfo.key === 'PERIODIC';
            const isEventLinked = timingInfo.key === 'PRE_OP' || timingInfo.key === 'POST_OP';
            const schedEval = inspectionEvaluations.get(insp.id) || evaluateChecklistScheduleStatus(insp.nextInspectionDate, insp.inspectionType, insp.inspectionDate, insp.checklistTypeId, alertSettings);

            // Dynamic border and background tinting based on schedule status if enabled
            const highlightClasses = alertSettings.highlightRowColor
              ? `${schedEval.rowBorderClass} ${schedEval.rowBgClass}`
              : 'border border-slate-200 dark:border-slate-700';

            return (
              <div
                key={insp.id}
                className={`bg-white dark:bg-slate-800 rounded-2xl ${highlightClasses} p-5 shadow-xs hover:shadow-md transition-all flex ${viewMode === 'list' ? 'flex-col md:flex-row items-start md:items-center justify-between gap-4' : 'flex-col justify-between space-y-4'} group`}
              >
                <div className={`space-y-3 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                  {/* Top Badges & 4-Status Schedule Pill */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Inspection ID */}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold">
                          {insp.id}
                        </span>

                        {/* Timing Type Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${timingInfo.badgeClass}`}>
                          {timingInfo.label}
                        </span>

                        {/* 4-STATUS SCHEDULE BADGE (Green, Yellow, Red, Gray) */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1 ${schedEval.badgeClass}`}>
                          <div className={`w-2 h-2 rounded-full ${schedEval.dotColorClass}`} />
                          <span>{isFa ? schedEval.labelFa : schedEval.labelEn}</span>
                          {schedEval.daysRemaining !== null && (
                            <span className="font-mono text-[9px] opacity-80">
                              {schedEval.daysRemaining < 0 
                                ? `(${Math.abs(schedEval.daysRemaining)}- روز)` 
                                : `(${schedEval.daysRemaining} روز)`}
                            </span>
                          )}
                        </span>

                        {/* Re-Inspection Lineage Badge if applicable */}
                        {(insp.isReinspection || (insp.reinspectionCycle && insp.reinspectionCycle > 1) || insp.previousInspectionId) && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                            <RotateCw className="w-2.5 h-2.5" />
                            <span>{isFa ? `نوبت ${insp.reinspectionCycle || 2} (بازرسی دوره‌ای جدید)` : `Cycle ${insp.reinspectionCycle || 2}`}</span>
                            {insp.previousInspectionId && (
                              <span className="font-mono text-[9px] opacity-75">
                                [عطف: {insp.previousInspectionId}]
                              </span>
                            )}
                          </span>
                        )}

                        {/* Completed / Archived Prior Cycle Badge */}
                        {insp.isArchivedCycle && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center gap-1">
                            <CheckCheck className="w-2.5 h-2.5" />
                            <span>{isFa ? 'انجام‌شده (بایگانی دوره قبل)' : 'Completed (Prior Cycle)'}</span>
                            {insp.supersededByInspectionId && (
                              <span className="font-mono text-[9px] opacity-80">
                                ➔ {insp.supersededByInspectionId}
                              </span>
                            )}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-black text-slate-800 dark:text-white line-clamp-2 leading-relaxed">
                        {insp.title}
                      </h3>
                    </div>

                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-black shrink-0 ${
                        insp.scorePercent >= 90
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                          : insp.scorePercent >= 70
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                      }`}
                    >
                      {insp.scorePercent}٪
                    </span>
                  </div>

                  {/* Core Inspection Attributes Grid */}
                  <div className={`text-xs text-slate-500 dark:text-slate-400 ${viewMode === 'list' ? 'grid grid-cols-2 md:grid-cols-4 gap-3' : 'space-y-1.5'}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{isFa ? 'نوع چک‌لیست:' : 'Template:'}</span>
                      <span className="truncate">{insp.checklistTypeNameFa}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{isFa ? 'تاریخ انجام:' : 'Date:'}</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{insp.inspectionDate}</span>
                    </div>

                    {/* Next Due Date and Alert Message */}
                    {isPeriodic ? (
                      <div className={`flex items-center gap-1.5 font-bold px-2 py-0.5 rounded-md ${
                        schedEval.status === 'OVERDUE' 
                          ? 'bg-rose-100/90 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                          : schedEval.status === 'WARNING'
                          ? 'bg-amber-100/90 text-amber-950 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700 animate-pulse'
                          : 'bg-blue-50/70 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                      }`}>
                        <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>{isFa ? `سررسید بعدی:` : 'Next Due:'}</span>
                        <span className="font-mono font-black">{insp.nextInspectionDate || calculateNextInspectionDate(insp.inspectionDate, 'PERIODIC', insp.periodicInterval || 'MONTHLY')}</span>
                      </div>
                    ) : isEventLinked ? (
                      <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400 font-bold bg-purple-50/70 dark:bg-purple-950/30 px-2 py-0.5 rounded-md truncate">
                        <Link2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{isFa ? 'عملیات مرتبط:' : 'Event:'}</span>
                        <span className="truncate">{insp.relatedOperationId || insp.permitNumber || (insp.relatedOperationTitle ? insp.relatedOperationTitle : 'متصل به فرآیند')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <span>{isFa ? 'موعد بعدی:' : 'Next:'}</span>
                        <span>{insp.nextInspectionDate || (isFa ? 'موردی (بدون دوره)' : 'Ad-Hoc')}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{isFa ? 'مکان / بازرس:' : 'Unit/Inspector:'}</span>
                      <span className="truncate">{insp.unit} ({insp.inspectorName})</span>
                    </div>

                    {/* Machinery / Equipment Specs & Tonnage Badge */}
                    {(insp.machineryTonnage || insp.machinerySpecs || insp.machineryType || isMachineryChecklist(insp.checklistTypeId, insp.checklistTypeNameFa)) && (
                      <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/40 px-2.5 py-1 rounded-lg text-xs flex-wrap font-bold">
                        <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        {insp.machineryTonnage && (
                          <span className="font-mono bg-amber-200/80 dark:bg-amber-900/70 text-amber-950 dark:text-amber-100 px-1.5 py-0.5 rounded text-[10px] font-black">
                            تناژ: {insp.machineryTonnage}
                          </span>
                        )}
                        <span className="truncate">
                          {insp.machinerySpecs || insp.machineryType || (isMachineryChecklist(insp.checklistTypeId) ? 'ماشین‌آلات ویژه' : '')}
                        </span>
                        {insp.machineryTagNumber && (
                          <span className="text-[10px] text-slate-500 font-mono">({insp.machineryTagNumber})</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Warning / Overdue Descriptive Message Banner inside card */}
                  {(schedEval.status === 'WARNING' || schedEval.status === 'OVERDUE') && (
                    <div className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 ${
                      schedEval.status === 'OVERDUE'
                        ? 'bg-rose-100/80 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                        : 'bg-amber-100/80 dark:bg-amber-950/50 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                    }`}>
                      {schedEval.status === 'OVERDUE' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      )}
                      <span>{isFa ? schedEval.messageFa : schedEval.messageEn}</span>
                    </div>
                  )}

                  {/* Score breakdown pills */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[11px] flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold">
                      {insp.passedCount} {isFa ? 'تایید' : 'Passed'}
                    </span>
                    {insp.failedCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 font-bold">
                        {insp.failedCount} {isFa ? 'نقص' : 'Failed'}
                      </span>
                    )}
                    {insp.warningCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 font-bold">
                        {insp.warningCount} {isFa ? 'هشدار' : 'Warn'}
                      </span>
                    )}
                    {/* Photo evidence indicator badge */}
                    {((insp.photos && insp.photos.length > 0) || (insp.items?.some(it => it.photos && it.photos.length > 0))) && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold flex items-center gap-1">
                        <Camera className="w-3 h-3" />
                        <span>
                          {(insp.photos?.length || 0) + (insp.items?.reduce((acc, it) => acc + (it.photos?.length || 0), 0) || 0)} {isFa ? 'عکس' : 'photos'}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className={`${viewMode === 'list' ? 'flex flex-row items-center justify-end gap-2 shrink-0 md:pl-4 md:border-r border-slate-100 dark:border-slate-700' : 'pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-1.5 flex-wrap'}`}>
                  <button
                    onClick={() => {
                      setActiveInspection(insp);
                      setIsDetailOpen(true);
                    }}
                    className={`py-1.5 px-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${viewMode === 'list' ? '' : 'flex-1 min-w-[100px]'}`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isFa ? 'مشاهده و چاپ' : 'Details'}</span>
                  </button>

                  {insp.failedCount > 0 && (
                    <button
                      onClick={async () => {
                        try {
                          const failedItems = insp.items?.filter((it: any) => it.status === 'failed' || it.status === 'fail' || it.result === 'failed') || [];
                          const clauseDetails = failedItems.length > 0 
                            ? failedItems.map((it: any, idx: number) => 
                                `• بند ${idx + 1}${it.code ? ` (${it.code})` : ''}: ${it.questionFa || it.title || it.description || 'شرح بند مشخص نشده'}${it.notes ? ` [توضیحات بازرس: ${it.notes}]` : ''}`
                              ).join('\n')
                            : 'کلیه بندهای عدم انطباق شناسایی‌شده در چک‌لیست بازرسی.';

                          const nc = await apiDb.createNonConformance({
                            title: `عدم انطباق ممیزی: ${insp.checklistTypeNameFa} (${insp.unit})`,
                            sourceModule: 'safety_inspection',
                            sourceRecordId: String(insp.id),
                            sourceTitle: `${insp.checklistTypeNameFa} #${insp.id}`,
                            unitName: insp.unit,
                            riskLevel: insp.failedCount >= 3 ? 'HIGH' : 'MEDIUM',
                            category: 'ایمنی عملیاتی',
                            description: `یافته‌های ممیزی چک‌لیست ${insp.checklistTypeNameFa} (نمره: ${insp.scorePercent}٪ | تعداد بندهای مردود: ${insp.failedCount})\nبازرس: ${insp.inspectorName} | تاریخ: ${insp.inspectionDate}\n\nشرح بندهایی که دارای عدم انطباق هستند:\n${clauseDetails}`,
                            assignedToName: insp.inspectorName,
                            status: 'REGISTERED'
                          });
                          setNcFeedbackToast(isFa ? `عدم انطباق با کد رهگیری «${nc?.trackingCode || 'جدید'}» در سامانه CAPA ثبت گردید.` : 'Non-conformance registered in CAPA successfully.');
                          setTimeout(() => setNcFeedbackToast(null), 4000);
                        } catch (e: any) {
                          setNcFeedbackToast(e?.message || 'خطا در ثبت عدم انطباق');
                          setTimeout(() => setNcFeedbackToast(null), 4000);
                        }
                      }}
                      className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      title={isFa ? 'ارجاع و ثبت مستقیم در سامانه عدم انطباق و اقدامات اصلاحی (CAPA)' : 'Register in CAPA System'}
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      <span>{isFa ? 'ثبت عدم انطباق' : 'CAPA'}</span>
                    </button>
                  )}

                  {insp.isArchivedCycle && insp.supersededByInspectionId ? (
                    <button
                      onClick={() => {
                        const target = inspections.find(i => i.id === insp.supersededByInspectionId);
                        if (target) {
                          setActiveInspection(target);
                          setIsDetailOpen(true);
                        }
                      }}
                      className="py-1.5 px-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                      title={isFa ? `مشاهده بازرسی دوره جدید (${insp.supersededByInspectionId})` : `View Active Inspection (${insp.supersededByInspectionId})`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{isFa ? `نوبت جدید (${insp.supersededByInspectionId})` : `Active (${insp.supersededByInspectionId})`}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReinspectInspection(insp)}
                      className="py-1.5 px-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs hover:scale-102"
                      title={isFa ? 'ایجاد رکورد بازرسی دوره‌ای جدید (سابقه قبلی کاملاً انجام‌شده و بایگانی می‌شود)' : 'Create New Periodic Audit (Completes and archives previous cycle)'}
                    >
                      <RotateCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>{isFa ? 'بازرسی دوره‌ای جدید' : 'New Periodic Audit'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleEditInspection(insp)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    title={isFa ? 'ویرایش' : 'Edit'}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setDeleteConfirm({
                        title: isFa ? 'آیا از حذف این بازرسی اطمینان دارید؟' : 'Delete this inspection?',
                        description: isFa ? `بازرسی: ${insp.title}` : `Inspection: ${insp.title}`,
                        onConfirm: () => {
                          onDeleteInspection(insp.id);
                          setDeleteConfirm(null);
                        }
                      });
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                    title={isFa ? 'حذف' : 'Delete'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FORM MODAL (Create / Edit / Re-inspect) */}
      <SafetyChecklistFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setIsReinspectionMode(false);
          setReinspectSourceInspection(null);
          setActiveInspection(null);
        }}
        templates={templates}
        initialData={activeInspection}
        defaultTemplateId={filterType !== 'ALL' ? filterType : templates[0]?.id}
        isReinspectionMode={isReinspectionMode}
        reinspectSourceInspection={reinspectSourceInspection}
        onSave={async (payload) => {
          onSaveInspection(payload);
          setIsFormOpen(false);
          setIsReinspectionMode(false);
          setReinspectSourceInspection(null);
          setActiveInspection(null);
        }}
        currentUser={currentUser}
        isFa={isFa}
      />

      {/* DETAIL / PRINT VIEW FORMAL MODAL */}
      {isDetailOpen && activeInspection && (
        <OperationalChecklistPrintModal
          inspection={activeInspection}
          onClose={() => {
            setIsDetailOpen(false);
            setActiveInspection(null);
          }}
          isFa={isFa}
        />
      )}

      {/* --- CONFIRM DELETE MODAL --- */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{isFa ? 'تایید حذف' : 'Confirm Delete'}</h4>
            </div>

            <div className="space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-100 text-xs">{deleteConfirm.title}</p>
              {deleteConfirm.description && (
                <p className="text-[11px] text-slate-500">{deleteConfirm.description}</p>
              )}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={deleteConfirm.onConfirm}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                {isFa ? 'حذف قطعی' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- INSPECTION ALERT SETTINGS MODAL --- */}
      <InspectionAlertSettingsModal
        isOpen={isAlertSettingsOpen}
        onClose={() => setIsAlertSettingsOpen(false)}
        templates={templates}
        currentSettings={alertSettings}
        onSettingsSaved={(newSettings) => {
          setAlertSettings(newSettings);
        }}
        isFa={isFa}
      />


      {/* --- MANAGE TEMPLATES & ITEMS MODAL --- */}
      <SafetyManageTemplateModal
        isOpen={isManageTemplatesOpen}
        onClose={() => setIsManageTemplatesOpen(false)}
        templates={templates}
        inspections={inspections}
        selectedTemplateId={filterType !== 'ALL' ? filterType : undefined}
        onSaveTemplate={async (tmpl) => {
          await safetyDeptService.saveTemplate(tmpl, currentUser?.fullName || currentUser?.username || 'کارشناس ایمنی');
        }}
        onDeleteTemplate={async (tmplId) => {
          await safetyDeptService.deleteTemplate(tmplId, currentUser?.fullName || currentUser?.username || 'کارشناس ایمنی');
        }}
        onAddChecklistItem={async (tmplId, item) => {
          return safetyDeptService.addChecklistItem(tmplId, item, currentUser?.fullName || currentUser?.username || 'کارشناس ایمنی');
        }}
        onUpdateChecklistItem={async (tmplId, item) => {
          return safetyDeptService.updateChecklistItem(tmplId, item, currentUser?.fullName || currentUser?.username || 'کارشناس ایمنی');
        }}
        onDeleteChecklistItem={async (tmplId, itemId) => {
          return safetyDeptService.deleteChecklistItem(tmplId, itemId, currentUser?.fullName || currentUser?.username || 'کارشناس ایمنی');
        }}
        onReorderChecklistItems={async (tmplId, items) => {
          return safetyDeptService.reorderChecklistItems(tmplId, items, currentUser?.fullName || currentUser?.username || 'کارشناس ایمنی');
        }}
        onResetTemplate={async (tmplId) => {
          return safetyDeptService.resetTemplateToDefault(tmplId, currentUser?.fullName || currentUser?.username || 'کارشناس ایمنی');
        }}
        onRestoreAllDefaults={async () => {
          return safetyDeptService.restoreAllDefaultTemplates(currentUser?.fullName || currentUser?.username || 'کارشناس ایمنی');
        }}
        onEditInspection={(insp) => {
          setIsManageTemplatesOpen(false);
          handleEditInspection(insp);
        }}
        currentUser={currentUser}
        isFa={isFa}
      />
    </div>
  );
}
