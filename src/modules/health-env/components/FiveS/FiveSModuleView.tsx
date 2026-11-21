import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  CheckSquare, Plus, Search, Filter, Calendar, 
  MapPin, User, AlertTriangle, CheckCircle2, 
  Clock, ArrowUpRight, TrendingUp, BarChart3, 
  Download, Printer, RefreshCw, X, Trash2, Edit3, 
  Eye, Camera, Upload, Layers, Award, ShieldAlert, 
  ChevronDown, ChevronRight, CheckCircle, HelpCircle, 
  ListChecks, CalendarClock, PieChart, Sparkles, Building2,
  Image as ImageIcon
} from 'lucide-react';
import { 
  FiveSInspection, 
  FiveSChecklistItem, 
  FiveSNonConformance, 
  FiveSCorrectiveAction, 
  FiveSSchedule, 
  FiveSUnitRanking, 
  FiveSPillarKey,
  FiveSItemStatus,
  FiveSPhoto
} from '../../types';
import { fiveSService, FIVE_S_PILLARS } from '../../services/fiveSService';
import { getUnits } from '../../../../utils/orgHelper';
import { getComplexPersonnelList } from '../../../../utils/personnelHelper';
import { printService } from '../../../../services/printService';
import { 
  calculateNextInspectionDate, 
  normalizeInspectionType, 
  normalizePeriodicInterval,
  getPeriodicIntervalLabel,
  getInspectionTypeBadgeClass, 
  UNIFIED_INSPECTION_TIMING_TYPES,
  PERIODIC_INTERVAL_OPTIONS,
  PeriodicIntervalType
} from '../../../../utils/inspectionScheduleHelper';
import { useFinalSubmit } from '../../../../context/FinalSubmitContext';
import FormalReportHeader from '../../../../components/common/FormalReportHeader';
import { apiDb } from '../../../../services/apiDatabaseClient';
import { downloadCsvFile } from '../../../../utils/fileHelpers';
import { toast } from 'react-hot-toast';
import { showConfirmDialog } from '../../../../components/common/ConfirmDialogModal';

interface Props {
  language: 'fa' | 'en';
  currentUser?: any;
}

export default function FiveSModuleView({ language, currentUser }: Props) {
  const { confirmFinalSubmit } = useFinalSubmit();
  const isFa = language === 'fa';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inspections' | 'nc-capa' | 'planning' | 'ranking' | 'reports'>('dashboard');

  // Dynamic Units extracted from System Settings (Master Data)
  const [availableUnits, setAvailableUnits] = useState<string[]>(() => {
    const u = getUnits();
    return u && u.length > 0 ? u : [];
  });

  // Keep available units in sync with System Settings (storage events / updates)
  useEffect(() => {
    const syncSystemUnits = () => {
      const u = getUnits();
      setAvailableUnits(u || []);
    };
    syncSystemUnits();
    window.addEventListener('storage', syncSystemUnits);
    window.addEventListener('hse_org_nodes_updated', syncSystemUnits);
    window.addEventListener('app_data_mutated', syncSystemUnits);
    return () => {
      window.removeEventListener('storage', syncSystemUnits);
      window.removeEventListener('hse_org_nodes_updated', syncSystemUnits);
      window.removeEventListener('app_data_mutated', syncSystemUnits);
    };
  }, []);

  // Service Data State
  const [inspections, setInspections] = useState<FiveSInspection[]>(() => fiveSService.getAllInspections());
  const [nonConformances, setNonConformances] = useState<FiveSNonConformance[]>(() => fiveSService.getAllNonConformances());
  const [schedules, setSchedules] = useState<FiveSSchedule[]>(() => fiveSService.getAllSchedules());

  const reloadData = () => {
    setInspections(fiveSService.getAllInspections());
    setNonConformances(fiveSService.getAllNonConformances());
    setSchedules(fiveSService.getAllSchedules());
    const latestUnits = getUnits();
    if (latestUnits && latestUnits.length > 0) setAvailableUnits(latestUnits);
  };

  // KPIs
  const kpis = useMemo(() => fiveSService.getKPIs(), [inspections, nonConformances, schedules]);
  const rankings = useMemo(() => fiveSService.getUnitRankings(), [inspections, nonConformances]);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState<FiveSInspection | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [viewingInspection, setViewingInspection] = useState<FiveSInspection | null>(null);

  // NC Edit Modal
  const [isNcModalOpen, setIsNcModalOpen] = useState(false);
  const [editingNc, setEditingNc] = useState<FiveSNonConformance | null>(null);

  // Schedule Modal
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<FiveSSchedule | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // Photo Lightbox
  const [previewPhoto, setPreviewPhoto] = useState<FiveSPhoto | null>(null);

  // -------------------------------------------------------------
  // INSPECTION FORM STATE
  // -------------------------------------------------------------
  const [formHeader, setFormHeader] = useState<{
    id?: string;
    inspectionNumber: string;
    date: string;
    time: string;
    department: string;
    location: string;
    inspector: string;
    supervisor: string;
    hseManager?: string;
    inspectionType: string;
    periodicInterval?: PeriodicIntervalType;
    nextInspectionDate?: string;
    relatedOperationId?: string;
    relatedOperationTitle?: string;
    overallNotes: string;
  }>({
    inspectionNumber: '',
    date: '',
    time: '10:00',
    department: getUnits()[0] || '',
    location: '',
    inspector: currentUser?.name || currentUser?.username || 'کارشناس HSE',
    supervisor: '',
    hseManager: '',
    inspectionType: 'دوره‌ای',
    periodicInterval: 'MONTHLY',
    nextInspectionDate: '',
    relatedOperationId: '',
    relatedOperationTitle: '',
    overallNotes: ''
  });

  const [formItems, setFormItems] = useState<FiveSChecklistItem[]>([]);
  const [activeFormPillar, setActiveFormPillar] = useState<FiveSPillarKey>('seiri');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUploadItemId, setPhotoUploadItemId] = useState<string | null>(null);

  // Helper when selecting a unit in form: auto-suggest supervisor from personnel DB
  const handleUnitChange = (selectedUnit: string) => {
    let autoSupervisor = formHeader.supervisor;
    if (!formHeader.supervisor || formHeader.supervisor.trim() === '') {
      try {
        const personnelList = getComplexPersonnelList();
        const supervisorPerson = personnelList.find(p => 
          (p.unit === selectedUnit || p.department === selectedUnit) && 
          (p.jobTitle?.includes('سرپرست') || p.jobTitle?.includes('رئیس') || p.jobTitle?.includes('مدیر'))
        );
        if (supervisorPerson) {
          autoSupervisor = supervisorPerson.fullName;
        }
      } catch {}
    }
    setFormHeader(prev => ({
      ...prev,
      department: selectedUnit,
      supervisor: autoSupervisor
    }));
  };

  // Open New Inspection Form
  const handleOpenNewInspection = (presetSchedule?: FiveSSchedule) => {
    const currentUnits = getUnits();
    setAvailableUnits(currentUnits);
    const today = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()).replace(/\//g, '/');

    const defaultUnit = presetSchedule ? presetSchedule.department : '';
    let autoSupervisor = '';
    try {
      if (defaultUnit) {
        const personnelList = getComplexPersonnelList();
        const supervisorPerson = personnelList.find(p => 
          (p.unit === defaultUnit || p.department === defaultUnit) && 
          (p.jobTitle?.includes('سرپرست') || p.jobTitle?.includes('رئیس') || p.jobTitle?.includes('مدیر'))
        );
        if (supervisorPerson) autoSupervisor = supervisorPerson.fullName;
      }
    } catch {}

    const inspectionDate = presetSchedule ? presetSchedule.scheduledDate : today;
    const initialNextDate = calculateNextInspectionDate(inspectionDate, 'PERIODIC', 'MONTHLY');

    setFormHeader({
      inspectionNumber: `5S-${today.slice(0, 4)}-${String(inspections.length + 1).padStart(3, '0')}`,
      date: inspectionDate,
      time: '10:00',
      department: defaultUnit,
      location: presetSchedule ? presetSchedule.location : '',
      inspector: currentUser?.name || currentUser?.username || 'کارشناس HSE',
      supervisor: autoSupervisor,
      hseManager: '',
      inspectionType: 'دوره‌ای',
      periodicInterval: 'MONTHLY' as PeriodicIntervalType,
      nextInspectionDate: initialNextDate,
      relatedOperationId: '',
      relatedOperationTitle: '',
      overallNotes: ''
    });

    setFormItems(fiveSService.createEmptyChecklist());
    setActiveFormPillar('seiri');
    setEditingInspection(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Inspection Form
  const handleOpenEditInspection = (insp: FiveSInspection) => {
    const normInterval = normalizePeriodicInterval(insp.periodicInterval);
    setFormHeader({
      id: insp.id,
      inspectionNumber: insp.inspectionNumber,
      date: insp.date,
      time: insp.time || '10:00',
      department: insp.department,
      location: insp.location,
      inspector: insp.inspector,
      supervisor: insp.supervisor,
      hseManager: (insp as any).hseManager || '',
      inspectionType: insp.inspectionType || 'دوره‌ای',
      periodicInterval: normInterval,
      nextInspectionDate: insp.nextInspectionDate || (normalizeInspectionType(insp.inspectionType) === 'PERIODIC' ? calculateNextInspectionDate(insp.date, 'PERIODIC', normInterval) : ''),
      relatedOperationId: insp.relatedOperationId || '',
      relatedOperationTitle: insp.relatedOperationTitle || '',
      overallNotes: insp.overallNotes || ''
    });

    setFormItems(insp.items || fiveSService.createEmptyChecklist());
    setActiveFormPillar('seiri');
    setEditingInspection(insp);
    setIsFormModalOpen(true);
  };

  // Update item status
  const handleUpdateItemStatus = (itemId: string, status: FiveSItemStatus) => {
    setFormItems(prev => prev.map(it => {
      if (it.id === itemId) {
        let sc = 100;
        if (status === 'fully_compliant') sc = 100;
        else if (status === 'compliant') sc = 75;
        else if (status === 'needs_improvement') sc = 50;
        else if (status === 'non_compliant') sc = 0;
        return {
          ...it,
          status,
          score: sc,
          hasNonConformance: status === 'non_compliant'
        };
      }
      return it;
    }));
  };

  // Update item remarks or corrective text
  const handleUpdateItemText = (itemId: string, field: 'remarks' | 'correctiveActionText', val: string) => {
    setFormItems(prev => prev.map(it => {
      if (it.id === itemId) {
        return { ...it, [field]: val };
      }
      return it;
    }));
  };

  // Handle Photo Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoUploadItemId) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const newPhoto: FiveSPhoto = {
        id: `5s-photo-${Date.now()}`,
        title: file.name,
        originalFileName: file.name,
        fileData: base64,
        fileSizeFormatted: `${(file.size / 1024).toFixed(0)} KB`,
        uploadedAt: formHeader.date || '1404/05/20',
        uploadedBy: formHeader.inspector || 'بازرس'
      };

      setFormItems(prev => prev.map(it => {
        if (it.id === photoUploadItemId) {
          return {
            ...it,
            photos: [...(it.photos || []), newPhoto]
          };
        }
        return it;
      }));

      setPhotoUploadItemId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (itemId: string, photoId: string) => {
    setFormItems(prev => prev.map(it => {
      if (it.id === itemId) {
        return {
          ...it,
          photos: (it.photos || []).filter(p => p.id !== photoId)
        };
      }
      return it;
    }));
  };

  // Handlers for dynamic inspection type, periodic interval & date calculation
  const handleDateChange = (newDate: string) => {
    const norm = normalizeInspectionType(formHeader.inspectionType);
    let autoNext = formHeader.nextInspectionDate;
    if (norm === 'PERIODIC') {
      autoNext = calculateNextInspectionDate(newDate, 'PERIODIC', formHeader.periodicInterval || 'MONTHLY');
    }
    setFormHeader(prev => ({
      ...prev,
      date: newDate,
      nextInspectionDate: autoNext
    }));
  };

  const handlePeriodicIntervalChange = (newInterval: PeriodicIntervalType) => {
    const autoNext = calculateNextInspectionDate(formHeader.date || '1404/01/01', 'PERIODIC', newInterval);
    setFormHeader(prev => ({
      ...prev,
      periodicInterval: newInterval,
      nextInspectionDate: autoNext
    }));
  };

  const handleInspectionTypeChange = (newType: string) => {
    const norm = normalizeInspectionType(newType);
    let autoNext: string | undefined = '';
    if (norm === 'PERIODIC') {
      autoNext = calculateNextInspectionDate(formHeader.date || '1404/01/01', 'PERIODIC', formHeader.periodicInterval || 'MONTHLY');
    } else if (norm === 'ADHOC') {
      autoNext = formHeader.nextInspectionDate || '';
    } else {
      // PRE_OP & POST_OP do not have periodic next dates
      autoNext = '';
    }

    setFormHeader(prev => ({
      ...prev,
      inspectionType: newType,
      nextInspectionDate: autoNext
    }));
  };

  // Live scores calculation in form
  const liveScores = useMemo(() => {
    return fiveSService.calculateInspectionScores(formItems);
  }, [formItems]);

  // Save inspection
  const handleSaveInspection = () => {
    if (!formHeader.department || !formHeader.date) {
      toast.error('لطفاً واحد و تاریخ بازرسی را مشخص فرمایید.');
      return;
    }

    confirmFinalSubmit({
      isFa,
      onConfirm: () => {
        fiveSService.saveInspection({
          id: formHeader.id,
          inspectionNumber: formHeader.inspectionNumber,
          date: formHeader.date,
          time: formHeader.time,
          department: formHeader.department,
          location: formHeader.location,
          inspector: formHeader.inspector,
          supervisor: formHeader.supervisor,
          inspectionType: formHeader.inspectionType,
          periodicInterval: normalizeInspectionType(formHeader.inspectionType) === 'PERIODIC' ? (formHeader.periodicInterval || 'MONTHLY') : undefined,
          nextInspectionDate: formHeader.nextInspectionDate?.trim() || undefined,
          relatedOperationId: formHeader.relatedOperationId?.trim() || undefined,
          relatedOperationTitle: formHeader.relatedOperationTitle?.trim() || undefined,
          overallNotes: formHeader.overallNotes,
          items: formItems,
          status: 'completed'
        }, currentUser?.name || currentUser?.username || 'کارشناس HSE');

        reloadData();
        setIsFormModalOpen(false);
      }
    });
  };

  // Delete Inspection
  const handleDeleteInspection = async (id: string) => {
    const ok = await showConfirmDialog({
      title: 'حذف بازرسی 5S',
      message: 'آیا از حذف این بازرسی 5S اطمینان دارید؟',
      confirmLabel: 'حذف',
      cancelLabel: 'انصراف',
      tone: 'danger',
    });
    if (ok) {
      fiveSService.deleteInspection(id, currentUser?.name || 'کاربر سیستم');
      reloadData();
    }
  };

  const filteredInspections = useMemo(() => {
    return inspections.filter(i => {
      const matchSearch = !searchTerm || 
        (i.department && i.department.includes(searchTerm)) || 
        (i.inspector && i.inspector.includes(searchTerm)) || 
        (i.id && i.id.includes(searchTerm));
      const matchDept = filterDepartment === 'all' || i.department === filterDepartment;
      const matchType = filterType === 'all' || i.inspectionType === filterType;

      return matchSearch && matchDept && matchType;
    });
  }, [inspections, searchTerm, filterDepartment, filterType]);

  // Export CSV
  const handleExportCSV = (type: 'inspections' | 'rankings') => {
    const csvContent = type === 'inspections' 
      ? fiveSService.exportInspectionsToCSV() 
      : fiveSService.exportRankingsToCSV();
    downloadCsvFile("5S_" + type + "_" + Date.now() + ".csv", csvContent);
  };

  const handleSaveNcModal = () => {
    if (!editingNc) return;
    const saved = fiveSService.saveNonConformance(editingNc, currentUser?.name || 'کاربر سیستم');
    try {
      const itemDesc = saved.description || saved.title || 'عدم انطباق ممیزی 5S';
      const sevStr = String(saved.severity || '');
      const isHigh = sevStr.includes('High') || sevStr.includes('بحرانی') || sevStr.includes('بالا');
      const isMed = sevStr.includes('Medium') || sevStr.includes('متوسط');
      const isClosed = saved.status === 'completed' || saved.status === 'verified_closed';

      apiDb.createNonConformance({
        title: "عدم انطباق 5S: " + (saved.title || saved.department || 'واحد'),
        sourceModule: '5s',
        sourceRecordId: String(saved.id),
        sourceTitle: "بازرسی 5S - " + (saved.pillar || ''),
        unitName: saved.department || saved.location,
        riskLevel: isHigh ? 'HIGH' : isMed ? 'MEDIUM' : 'LOW',
        category: 'محیط زیست و 5S',
        description: "واحد: " + (saved.department || '-') + " | رکن: " + (saved.pillar || '-') + "\nشرح عدم انطباق: " + itemDesc + "\nمسئول پیگیری: " + (saved.responsiblePerson || '-') + " | مهلت: " + (saved.dueDate || '-'),
        assignedToName: saved.responsiblePerson,
        status: isClosed ? 'CLOSED' : 'REGISTERED'
      });
    } catch (err) {
      console.warn('Failed to sync 5S NC to database:', err);
    }
    reloadData();
    setIsNcModalOpen(false);
    setEditingNc(null);
  };

  // Save Schedule
  const [scheduleFormData, setScheduleFormData] = useState<Partial<FiveSSchedule>>({
    department: getUnits()[0] || '',
    location: '',
    frequency: 'ماهانه',
    inspector: currentUser?.name || 'کارشناس HSE',
    scheduledDate: '',
    status: 'scheduled',
    notes: ''
  });

  const handleSaveSchedule = () => {
    if (!scheduleFormData.department || !scheduleFormData.scheduledDate) {
      toast.error('لطفاً واحد و تاریخ برنامه‌ریزی‌شده را وارد نمایید.');
      return;
    }
    fiveSService.saveSchedule(scheduleFormData, currentUser?.name || 'کاربر سیستم');
    reloadData();
    setIsScheduleModalOpen(false);
  };

  return (
    <div className="w-full p-4 md:p-6 space-y-6 max-w-7xl 2xl:max-w-[1720px] mx-auto" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Top Header & Navigation Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-2xl shadow-md">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                {isFa ? 'سامانه جامع ارزیابی و ممیزی 5S' : '5S Workplace Organization System'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                محیط زیست و بهره‌وری
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isFa 
                ? 'پایش پنج اصل ساماندهی (تفکیک، نظم، پاکیزگی، استانداردسازی و انضباط)، پیگیری عدم انطباق‌ها و رتبه‌بندی واحدها' 
                : 'Pillar-based 5S audits, non-conformance tracking, corrective actions (CAPA) and unit benchmarking.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExportCSV('inspections')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
            title="خروجی اکسل"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>خروجی اکسل</span>
          </button>

          <button
            onClick={() => handleOpenNewInspection()}
            className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت بازرسی جدید 5S</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl text-xs font-bold border border-slate-200 dark:border-slate-700 overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'dashboard'
              ? 'bg-emerald-600 text-white shadow-xs font-black'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>داشبورد و شاخص‌ها</span>
        </button>

        <button
          onClick={() => setActiveTab('inspections')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'inspections'
              ? 'bg-emerald-600 text-white shadow-xs font-black'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          <span>بازرسی‌ها ({inspections.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('nc-capa')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'nc-capa'
              ? 'bg-emerald-600 text-white shadow-xs font-black'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
          }`}
        >
          <ShieldAlert className={`w-4 h-4 ${activeTab === 'nc-capa' ? 'text-white' : 'text-purple-400'}`} />
          <span>عدم انطباق‌ها و CAPA ({kpis.openNonConformances} باز)</span>
        </button>

        <button
          onClick={() => setActiveTab('planning')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'planning'
              ? 'bg-emerald-600 text-white shadow-xs font-black'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
          }`}
        >
          <CalendarClock className={`w-4 h-4 ${activeTab === 'planning' ? 'text-white' : 'text-blue-400'}`} />
          <span>برنامه‌ریزی بازرسی ({schedules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ranking')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'ranking'
              ? 'bg-emerald-600 text-white shadow-xs font-black'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
          }`}
        >
          <Award className={`w-4 h-4 ${activeTab === 'ranking' ? 'text-white' : 'text-amber-400'}`} />
          <span>رتبه‌بندی واحدها</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: 5S DASHBOARD & KPIS */}
      {/* ============================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Overdue Inspections Alert if any */}
          {kpis.overdueInspections > 0 && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-4 rounded-2xl flex items-center justify-between text-rose-800 dark:text-rose-300 text-xs">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span className="font-bold">
                  تعداد {kpis.overdueInspections} بازرسی 5S از تاریخ سررسید برنامه‌ریزی‌شده گذشته و نیازمند پیگیری فوری است.
                </span>
              </div>
              <button
                onClick={() => setActiveTab('planning')}
                className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 cursor-pointer"
              >
                مشاهده بازرسی‌های معوق
              </button>
            </div>
          )}

          {/* KPI Summary Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* KPI 1: Overall Average 5S Score */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>میانگین امتیاز 5S</span>
                <Sparkles className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {kpis.averageScore}٪
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${kpis.averageScore}%` }}
                ></div>
              </div>
              <span className="text-[10px] text-slate-400 block font-bold">
                نرخ انطباق کل واحدهای مجتمع
              </span>
            </div>

            {/* KPI 2: Total & Completed Inspections */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>کل بازرسی‌های انجام‌شده</span>
                <CheckCircle2 className="w-4 h-4 text-teal-500" />
              </div>
              <div className="text-3xl font-black font-mono text-slate-800 dark:text-white">
                {kpis.completedInspections}
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between font-bold">
                <span>برنامه‌ریزی‌شده: {kpis.scheduledInspections}</span>
                <span className="text-rose-500">معوق: {kpis.overdueInspections}</span>
              </div>
            </div>

            {/* KPI 3: Open Non-Conformances */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>عدم انطباق‌های 5S</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-3xl font-black font-mono text-amber-600 dark:text-amber-400">
                {kpis.openNonConformances} <span className="text-xs text-slate-400 font-sans">مورد باز</span>
              </div>
              <div className="text-[10px] text-slate-400 font-bold">
                کل موارد ثبت‌شده: {kpis.totalNonConformances} مورد
              </div>
            </div>

            {/* KPI 4: Open CAPA Actions */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>اقدامات اصلاحی باز</span>
                <ShieldAlert className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-3xl font-black font-mono text-purple-600 dark:text-purple-400">
                {kpis.openCorrectiveActions}
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between font-bold">
                <span className="text-rose-500">Overdue: {kpis.overdueActions}</span>
                <span className="text-emerald-600">تکمیل: {kpis.actionStatusCounts.completed}</span>
              </div>
            </div>

            {/* KPI 5: Scheduled & Compliance */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>وضعیت کلی 5S</span>
                <Award className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl font-black text-slate-800 dark:text-white pt-1">
                {kpis.averageScore >= 80 ? 'سطح مطلوب و عالی' : kpis.averageScore >= 60 ? 'سطح قابل قبول' : 'نیازمند کایزن'}
              </div>
              <span className="text-[10px] text-emerald-600 font-bold block">
                {rankings.length} واحد ارزیابی‌شده
              </span>
            </div>
          </div>

          {/* 5-Pillar Score Cards (Seiri, Seiton, Seiso, Seiketsu, Shitsuke) */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-sm text-slate-800 dark:text-white">
                  میانگین امتیازات پنج محور اصلی 5S در کل مجتمع
                </h3>
              </div>
              <span className="text-xs text-slate-400">مبنا: ۱۰۰ امتیاز</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {FIVE_S_PILLARS.map((p) => {
                const score = kpis.pillarScoresAvg[p.key] || 0;
                return (
                  <div 
                    key={p.key} 
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 dark:text-white">
                        {p.number}. {p.titleFa}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{p.titleEn}</span>
                    </div>
                    
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                        {score} <span className="text-xs font-sans text-slate-400">/ ۱۰۰</span>
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        score >= 80 ? 'bg-emerald-100 text-emerald-800' : score >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {score >= 80 ? 'عالی' : score >= 60 ? 'متوسط' : 'ضعیف'}
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${score}%` }}
                      ></div>
                    </div>
                    
                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                      {p.persianName}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Charts & Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Unit Scores Comparison */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-teal-600" />
                  <h3 className="font-black text-sm text-slate-800 dark:text-white">
                    مقایسه امتیاز 5S واحدها و بخش‌ها
                  </h3>
                </div>
                <span className="text-xs text-slate-400">بر اساس آخرین ارزیابی‌ها</span>
              </div>

              {rankings.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  هنوز بازرسی 5S برای واحدها ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-3">
                  {rankings.slice(0, 6).map((rk) => (
                    <div key={rk.department} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-700 dark:text-slate-300">{rk.department}</span>
                        <span className="font-mono text-emerald-600">{rk.averageScore}٪</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-teal-500 h-full rounded-full"
                          style={{ width: `${rk.averageScore}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chart 2: Non-Conformances by Unit */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h3 className="font-black text-sm text-slate-800 dark:text-white">
                    توزیع عدم انطباق‌های 5S بر حسب واحد
                  </h3>
                </div>
                <span className="text-xs text-slate-400">{kpis.totalNonConformances} مورد کل</span>
              </div>

              {kpis.ncByUnit.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  هیچ موردی از عدم انطباق ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-3">
                  {kpis.ncByUnit.map((item) => (
                    <div key={item.department} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{item.department}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-mono font-bold">
                        {item.count} مورد
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: INSPECTIONS LIST & ACTIONS */}
      {/* ============================================================== */}
      {activeTab === 'inspections' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-[0px] w-full md:min-w-[220px] flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  placeholder="جستجو در شماره، واحد، محل، بازرس..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-emerald-500"
                />
              </div>

              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              >
                <option value="all">همه واحدها</option>
                {Array.from(new Set([...availableUnits, ...inspections.map(i => i.department).filter(Boolean)])).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              >
                <option value="all">همه انواع ممیزی</option>
                <option value="دوره‌ای">دوره‌ای</option>
                <option value="موردی">موردی</option>
                <option value="ممیزی جامع">ممیزی جامع</option>
                <option value="ممیزی مدیریتی">ممیزی مدیریتی</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenNewInspection()}
                className="px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>بازرسی جدید</span>
              </button>
            </div>
          </div>

          {/* Inspections Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-black border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3.5">شماره بازرسی</th>
                    <th className="p-3.5">تاریخ</th>
                    <th className="p-3.5">واحد / بخش</th>
                    <th className="p-3.5">نوع و سررسید بعدی / عملیات</th>
                    <th className="p-3.5">محل بازرسی</th>
                    <th className="p-3.5">بازرس</th>
                    <th className="p-3.5 text-center">امتیاز 5S</th>
                    <th className="p-3.5 text-center">رتبه‌بندی</th>
                    <th className="p-3.5 text-center">عدم انطباق</th>
                    <th className="p-3.5 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium text-slate-800 dark:text-slate-200">
                  {filteredInspections.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-slate-400">
                        <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-600" />
                        <p className="font-bold">هیچ رکوردی از بازرسی 5S یافت نشد</p>
                        <p className="text-[11px] text-slate-400 mt-1">جهت ایجاد اولین بازرسی از دکمه «بازرسی جدید» استفاده فرمایید.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredInspections.map((insp) => {
                      const normType = normalizeInspectionType(insp.inspectionType);
                      const badgeClass = getInspectionTypeBadgeClass(normType);
                      return (
                        <tr key={insp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                            {insp.inspectionNumber}
                          </td>
                          <td className="p-3.5 font-mono text-slate-500">
                            {insp.date}
                          </td>
                          <td className="p-3.5 font-bold">
                            {insp.department}
                          </td>
                          <td className="p-3.5 space-y-1">
                            <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold ${badgeClass}`}>
                              {insp.inspectionType || 'دوره‌ای'}
                            </span>
                            {normType === 'PERIODIC' && (
                              <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-emerald-600 inline shrink-0" />
                                <span>سررسید ({getPeriodicIntervalLabel(insp.periodicInterval, isFa)}): {insp.nextInspectionDate || calculateNextInspectionDate(insp.date, 'PERIODIC', insp.periodicInterval || 'MONTHLY')}</span>
                              </div>
                            )}
                            {(normType === 'PRE_OP' || normType === 'POST_OP') && (insp.relatedOperationId || insp.relatedOperationTitle) && (
                              <div className="text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
                                <Layers className="w-3 h-3 text-amber-600 inline" />
                                <span className="truncate max-w-[140px]">{insp.relatedOperationId ? `[${insp.relatedOperationId}]` : ''} {insp.relatedOperationTitle || ''}</span>
                              </div>
                            )}
                            {normType === 'ADHOC' && insp.nextInspectionDate && (
                              <div className="text-[10px] text-purple-700 dark:text-purple-300 font-mono flex items-center gap-1">
                                <CalendarClock className="w-3 h-3 text-purple-600 inline" />
                                <span>پیگیری: {insp.nextInspectionDate}</span>
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-500 text-[11px]">
                            {insp.location || '—'}
                          </td>
                          <td className="p-3.5">
                            {insp.inspector}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full font-mono font-black text-xs ${
                              insp.scores.total >= 80 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' 
                                : insp.scores.total >= 60 
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' 
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                            }`}>
                              {insp.scores.total}٪
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              insp.generalRating === 'عالی' ? 'bg-emerald-500 text-white' :
                              insp.generalRating === 'خوب' ? 'bg-teal-500 text-white' :
                              insp.generalRating === 'قابل قبول' ? 'bg-blue-500 text-white' :
                              insp.generalRating === 'نیازمند بهبود' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
                            }`}>
                              {insp.generalRating}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-mono">
                            {insp.nonConformancesCount > 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
                                {insp.nonConformancesCount} مورد
                              </span>
                            ) : (
                              <span className="text-emerald-600 text-[11px] font-bold">✓ منطبق</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setViewingInspection(insp);
                                  setIsDetailsModalOpen(true);
                                }}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg"
                                title="مشاهده کارنامه و گزارش"
                              >
                                <Eye className="w-4 h-4 text-emerald-600" />
                              </button>
                              <button
                                onClick={() => handleOpenEditInspection(insp)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg"
                                title="ویرایش بازرسی"
                              >
                                <Edit3 className="w-4 h-4 text-blue-600" />
                              </button>
                              <button
                                onClick={() => handleDeleteInspection(insp.id)}
                                className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 rounded-lg"
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table></div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: NON-CONFORMANCES & CAPA */}
      {/* ============================================================== */}
      {activeTab === 'nc-capa' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-white">
                فهرست عدم انطباق‌ها و اقدامات اصلاحی 5S (CAPA)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                پیگیری چرخه رفع موارد نامنطبق، مهلت‌های سررسید و تایید مستندات اثبات اقدام
              </p>
            </div>
            <button
              onClick={() => {
                const currentUnits = getUnits();
                setAvailableUnits(currentUnits);
                setEditingNc({
                  id: `5S-NC-${Date.now()}`,
                  trackingCode: `5S-NC-1404-${String(nonConformances.length + 1).padStart(3, '0')}`,
                  pillar: 'seiri',
                  title: '',
                  description: '',
                  location: '',
                  department: '',
                  severity: 'متوسط (Medium)',
                  responsiblePerson: '',
                  dueDate: '',
                  status: 'open',
                  identifiedDate: new Intl.DateTimeFormat('fa-IR-u-ca-persian').format(new Date()),
                  reportedBy: currentUser?.name || 'کارشناس HSE',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                });
                setIsNcModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت عدم انطباق جدید</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nonConformances.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-slate-800 p-12 text-center text-slate-400 rounded-2xl border border-slate-200 dark:border-slate-700">
                <ShieldAlert className="w-10 h-10 mx-auto mb-2 opacity-30 text-purple-600" />
                <p className="font-bold">هیچ عدم انطباقی ثبت نشده است</p>
                <p className="text-[11px] text-slate-400 mt-1">تمام آیتم‌های بازرسی منطبق هستند.</p>
              </div>
            ) : (
              nonConformances.map((nc) => (
                <div key={nc.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700 text-xs">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{nc.trackingCode}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        nc.status === 'open' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300' :
                        nc.status === 'in_progress' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                        'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      }`}>
                        {nc.status === 'open' ? 'باز' : nc.status === 'in_progress' ? 'در حال اقدام' : 'تکمیل و تأیید'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 inline-block">
                        محور: {FIVE_S_PILLARS.find(p => p.key === nc.pillar)?.titleFa || nc.pillar}
                      </span>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white leading-snug">
                        {nc.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {nc.description}
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-0.5 pt-1">
                      <div>واحد: <strong className="text-slate-700 dark:text-slate-300">{nc.department}</strong></div>
                      <div>محل: <span className="text-slate-600 dark:text-slate-400">{nc.location}</span></div>
                      <div>مسئول اقدام: <span className="text-slate-600 dark:text-slate-400">{nc.responsiblePerson}</span></div>
                      <div>مهلت: <span className="font-mono text-rose-600 font-bold">{nc.dueDate}</span></div>
                    </div>

                    {nc.photo && (
                      <div className="pt-2">
                        <img 
                          src={nc.photo.fileData} 
                          alt="مدرک عدم انطباق" 
                          className="w-full h-24 object-cover rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-90"
                          onClick={() => setPreviewPhoto(nc.photo || null)}
                        />
                      </div>
                    )}

                    {nc.correctiveAction && (
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          <span>پیشرفت اقدام:</span>
                          <span className="font-mono text-emerald-600">{nc.correctiveAction.progressPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-purple-600 h-full rounded-full"
                            style={{ width: `${nc.correctiveAction.progressPercent}%` }}
                          ></div>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          {nc.correctiveAction.description}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setEditingNc(nc);
                        setIsNcModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                      <span>ویرایش و پیگیری اقدام</span>
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await showConfirmDialog({
                          title: 'حذف عدم انطباق',
                          message: 'آیا از حذف این عدم انطباق اطمینان دارید؟',
                          confirmLabel: 'حذف',
                          cancelLabel: 'انصراف',
                          tone: 'danger',
                        });
                        if (ok) {
                          fiveSService.deleteNonConformance(nc.id, currentUser?.name || 'کاربر سیستم');
                          reloadData();
                        }
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: INSPECTION PLANNING & SCHEDULE */}
      {/* ============================================================== */}
      {activeTab === 'planning' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-white">
                برنامه‌ریزی و زمان‌بندی بازرسی‌های 5S
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                تعریف دوره‌های ممیزی هفتگی، ماهانه و فصلی برای واحدهای مجتمع
              </p>
            </div>
            <button
              onClick={() => {
                const currentUnits = getUnits();
                setAvailableUnits(currentUnits);
                setScheduleFormData({
                  department: '',
                  location: 'کل سایت',
                  frequency: 'ماهانه',
                  inspector: currentUser?.name || 'کارشناس HSE',
                  scheduledDate: new Intl.DateTimeFormat('fa-IR-u-ca-persian').format(new Date()),
                  status: 'scheduled',
                  notes: ''
                });
                setIsScheduleModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف برنامه جدید</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 font-black border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3.5">واحد / بخش</th>
                    <th className="p-3.5">محل بازرسی</th>
                    <th className="p-3.5">دوره زمانی</th>
                    <th className="p-3.5">بازرس مسئول</th>
                    <th className="p-3.5">تاریخ سررسید</th>
                    <th className="p-3.5 text-center">وضعیت</th>
                    <th className="p-3.5 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium text-slate-800 dark:text-slate-200">
                  {schedules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400">
                        <CalendarClock className="w-10 h-10 mx-auto mb-2 opacity-30 text-blue-600" />
                        <p className="font-bold">برنامه زمان‌بندی بازرسی تعریف نشده است</p>
                        <p className="text-[11px] text-slate-400 mt-1">با زدن دکمه «تعریف برنامه جدید» دوره‌های منظم بازرسی را ثبت کنید.</p>
                      </td>
                    </tr>
                  ) : (
                    schedules.map((sch) => (
                      <tr key={sch.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                        <td className="p-3.5 font-bold">{sch.department}</td>
                        <td className="p-3.5 text-slate-500">{sch.location}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                            {sch.frequency}
                          </span>
                        </td>
                        <td className="p-3.5">{sch.inspector}</td>
                        <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                          {sch.scheduledDate}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            sch.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                            sch.status === 'overdue' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {sch.status === 'completed' ? 'انجام شده' : sch.status === 'overdue' ? 'عقب افتاده' : 'برنامه‌ریزی‌شده'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenNewInspection(sch)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              انجام بازرسی
                            </button>
                            <button
                              onClick={async () => {
                                const ok = await showConfirmDialog({
                                  title: 'حذف برنامه بازرسی',
                                  message: 'آیا از حذف این برنامه اطمینان دارید؟',
                                  confirmLabel: 'حذف',
                                  cancelLabel: 'انصراف',
                                  tone: 'danger',
                                });
                                if (ok) {
                                  fiveSService.deleteSchedule(sch.id, currentUser?.name || 'کاربر سیستم');
                                  reloadData();
                                }
                              }}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table></div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: UNIT RANKING & BENCHMARKING */}
      {/* ============================================================== */}
      {activeTab === 'ranking' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div>
              <h3 className="font-black text-sm text-slate-800 dark:text-white">
                جدول رتبه‌بندی و مقایسه واحدهای سازمانی در استقرار 5S
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ارزیابی عملکرد واحدها بر اساس میانگین امتیاز، تعداد عدم انطباق‌ها و تفکیک ۵ محور
              </p>
            </div>
            <button
              onClick={() => handleExportCSV('rankings')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>خروجی اکسل رتبه‌بندی</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 font-black border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3.5 text-center w-16">رتبه</th>
                    <th className="p-3.5">واحد / بخش</th>
                    <th className="p-3.5 text-center">تعداد بازرسی</th>
                    <th className="p-3.5 text-center">امتیاز 5S</th>
                    <th className="p-3.5 text-center">تفکیک</th>
                    <th className="p-3.5 text-center">نظم</th>
                    <th className="p-3.5 text-center">پاکیزگی</th>
                    <th className="p-3.5 text-center">استاندارد</th>
                    <th className="p-3.5 text-center">انضباط</th>
                    <th className="p-3.5 text-center">ارزیابی</th>
                    <th className="p-3.5 text-center">عدم انطباق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium text-slate-800 dark:text-slate-200">
                  {rankings.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-12 text-center text-slate-400">
                        <Award className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-500" />
                        <p className="font-bold">هنوز ارزیابی 5S برای واحدها ثبت نشده است</p>
                      </td>
                    </tr>
                  ) : (
                    rankings.map((rk) => (
                      <tr key={rk.department} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                        <td className="p-3.5 text-center">
                          <span className={`w-7 h-7 inline-flex items-center justify-center rounded-full font-mono font-black text-xs ${
                            rk.rank === 1 ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400' :
                            rk.rank === 2 ? 'bg-slate-200 text-slate-800 ring-1 ring-slate-400' :
                            rk.rank === 3 ? 'bg-blue-100 text-blue-800' : 'text-slate-500'
                          }`}>
                            {rk.rank}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          {rk.department}
                        </td>
                        <td className="p-3.5 text-center font-mono">{rk.totalInspections}</td>
                        <td className="p-3.5 text-center font-mono font-black text-sm text-emerald-600">
                          {rk.averageScore}٪
                        </td>
                        <td className="p-3.5 text-center font-mono text-slate-600 dark:text-slate-300">{rk.seiriScore}</td>
                        <td className="p-3.5 text-center font-mono text-slate-600 dark:text-slate-300">{rk.seitonScore}</td>
                        <td className="p-3.5 text-center font-mono text-slate-600 dark:text-slate-300">{rk.seisoScore}</td>
                        <td className="p-3.5 text-center font-mono text-slate-600 dark:text-slate-300">{rk.seiketsuScore}</td>
                        <td className="p-3.5 text-center font-mono text-slate-600 dark:text-slate-300">{rk.shitsukeScore}</td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            rk.rating === 'عالی' ? 'bg-emerald-500 text-white' :
                            rk.rating === 'خوب' ? 'bg-teal-500 text-white' :
                            rk.rating === 'قابل قبول' ? 'bg-blue-500 text-white' :
                            rk.rating === 'نیازمند بهبود' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
                          }`}>
                            {rk.rating}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-mono">
                          {rk.openNCs > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                              {rk.openNCs} باز
                            </span>
                          ) : (
                            <span className="text-emerald-600 text-[10px] font-bold">✓ صفر</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table></div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: NEW / EDIT INSPECTION FORM */}
      {/* ============================================================== */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-6 h-6" />
                <div>
                  <h3 className="font-black text-base">
                    {editingInspection ? `ویرایش بازرسی 5S (${formHeader.inspectionNumber})` : 'ثبت و ارزیابی بازرسی جدید 5S'}
                  </h3>
                  <span className="text-xs text-emerald-100">
                    چک‌لیست پنجگانه استاندارد بر اساس اصول Seiri, Seiton, Seiso, Seiketsu, Shitsuke
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
              {/* Header Info Grid */}
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">شماره بازرسی</label>
                  <input
                    type="text"
                    value={formHeader.inspectionNumber}
                    onChange={(e) => setFormHeader({ ...formHeader, inspectionNumber: e.target.value })}
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">تاریخ بازرسی (شمسی)</label>
                  <input
                    type="text"
                    value={formHeader.date}
                    onChange={(e) => handleDateChange(e.target.value)}
                    placeholder="1404/05/20"
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-600 dark:text-slate-300">واحد / بخش ارزیابی</label>
                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-normal">
                      استخراج خودکار از تنظیمات سیستم
                    </span>
                  </div>
                  <select
                    value={formHeader.department}
                    onChange={(e) => handleUnitChange(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-emerald-500 focus:outline-none"
                    required
                  >
                    {!availableUnits.includes(formHeader.department) && formHeader.department && (
                      <option value={formHeader.department}>{formHeader.department}</option>
                    )}
                    {availableUnits.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">محل دقیق بازرسی</label>
                  <input
                    type="text"
                    value={formHeader.location}
                    onChange={(e) => setFormHeader({ ...formHeader, location: e.target.value })}
                    placeholder="مثال: سالن پمپ‌ها، محوطه انبار..."
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">۱. کارشناس / نماینده واحد (بازرس)</label>
                  <input
                    type="text"
                    value={formHeader.inspector}
                    onChange={(e) => setFormHeader({ ...formHeader, inspector: e.target.value })}
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">۲. سرپرست / مسئول واحد</label>
                  <input
                    type="text"
                    value={formHeader.supervisor}
                    onChange={(e) => setFormHeader({ ...formHeader, supervisor: e.target.value })}
                    placeholder="نام مسئول واحد"
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">۳. رئیس مرکز HSE</label>
                  <input
                    type="text"
                    value={formHeader.hseManager}
                    onChange={(e) => setFormHeader({ ...formHeader, hseManager: e.target.value })}
                    placeholder="نام یا تاییدیه رئیس مرکز HSE"
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">نوع بازرسی</label>
                  <select
                    value={formHeader.inspectionType}
                    onChange={(e) => handleInspectionTypeChange(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  >
                    {UNIFIED_INSPECTION_TIMING_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{isFa ? t.labelFa : t.labelEn}</option>
                    ))}
                  </select>
                </div>

                {normalizeInspectionType(formHeader.inspectionType) === 'PERIODIC' && (
                  <>
                    <div className="animate-in fade-in zoom-in-95 duration-150">
                      <label className="font-bold text-blue-700 dark:text-blue-300 block mb-1">
                        {isFa ? 'دوره بازرسی (بازه تکرار) *' : 'Periodic Interval *'}
                      </label>
                      <select
                        value={formHeader.periodicInterval || 'MONTHLY'}
                        onChange={(e) => handlePeriodicIntervalChange(e.target.value as PeriodicIntervalType)}
                        className="w-full p-2 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-700 rounded-xl font-bold text-blue-900 dark:text-blue-200"
                      >
                        {PERIODIC_INTERVAL_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {isFa ? opt.labelFa : opt.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-600 dark:text-slate-300">{isFa ? 'تاریخ بازرسی بعدی' : 'Next Due Date'}</label>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          {isFa ? `محاسبه خودکار (${getPeriodicIntervalLabel(formHeader.periodicInterval || 'MONTHLY', true)})` : `Auto (${getPeriodicIntervalLabel(formHeader.periodicInterval || 'MONTHLY', false)})`}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={formHeader.nextInspectionDate || ''}
                        onChange={(e) => setFormHeader({ ...formHeader, nextInspectionDate: e.target.value })}
                        placeholder="1404/06/20"
                        className="w-full p-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-700 rounded-xl font-mono text-emerald-900 dark:text-emerald-300 font-bold"
                      />
                    </div>
                  </>
                )}

                {(normalizeInspectionType(formHeader.inspectionType) === 'PRE_OP' || normalizeInspectionType(formHeader.inspectionType) === 'POST_OP') && (
                  <>
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">شناسه/کد عملیات مرتبط</label>
                      <input
                        type="text"
                        value={formHeader.relatedOperationId || ''}
                        onChange={(e) => setFormHeader({ ...formHeader, relatedOperationId: e.target.value })}
                        placeholder="مثال: PTW-1404-098"
                        className="w-full p-2 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 rounded-xl font-mono text-amber-900 dark:text-amber-300"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">عنوان عملیات / رویداد</label>
                      <input
                        type="text"
                        value={formHeader.relatedOperationTitle || ''}
                        onChange={(e) => setFormHeader({ ...formHeader, relatedOperationTitle: e.target.value })}
                        placeholder="مثال: تعمیرات اساسی بویلر ۲"
                        className="w-full p-2 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 rounded-xl text-amber-900 dark:text-amber-300"
                      />
                    </div>
                  </>
                )}

                {normalizeInspectionType(formHeader.inspectionType) === 'ADHOC' && (
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">تاریخ پیگیری بعدی (اختیاری)</label>
                    <input
                      type="text"
                      value={formHeader.nextInspectionDate || ''}
                      onChange={(e) => setFormHeader({ ...formHeader, nextInspectionDate: e.target.value })}
                      placeholder="1404/06/20"
                      className="w-full p-2 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-300 dark:border-purple-700 rounded-xl font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">ساعت بازرسی</label>
                  <input
                    type="text"
                    value={formHeader.time}
                    onChange={(e) => setFormHeader({ ...formHeader, time: e.target.value })}
                    placeholder="10:00"
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* Live Score Summary Banner */}
              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-black font-mono text-emerald-700 dark:text-emerald-300">
                    {liveScores.total}٪
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-slate-800 dark:text-white">امتیاز کل ارزیابی:</span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-black bg-emerald-600 text-white">
                        {liveScores.generalRating}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono mt-0.5">
                      <span>تفکیک: {liveScores.seiri}٪</span>
                      <span>نظم: {liveScores.seiton}٪</span>
                      <span>پاکیزگی: {liveScores.seiso}٪</span>
                      <span>استاندارد: {liveScores.seiketsu}٪</span>
                      <span>انضباط: {liveScores.shitsuke}٪</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5S Pillar Tabs */}
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl text-xs font-bold gap-1 border border-slate-200 dark:border-slate-700">
                {FIVE_S_PILLARS.map((p) => {
                  const pScore = liveScores[p.key];
                  return (
                    <button
                      key={p.key}
                      onClick={() => setActiveFormPillar(p.key)}
                      className={`flex-1 py-2 px-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        activeFormPillar === p.key
                          ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-black shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <span>{p.number}. {p.titleFa}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {pScore}٪
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Checklist Items for Selected Pillar */}
              <div className="space-y-4">
                {formItems
                  .filter(it => it.pillar === activeFormPillar)
                  .map((item) => (
                    <div 
                      key={item.id} 
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        item.status === 'non_compliant' 
                          ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800' 
                          : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-mono font-bold text-xs">
                              {item.itemNumber}
                            </span>
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                              {item.title}
                            </h4>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 pr-8">
                            {item.description}
                          </p>
                        </div>

                        {/* Status Radio Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateItemStatus(item.id, 'fully_compliant')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              item.status === 'fully_compliant'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-50'
                            }`}
                          >
                            کاملاً منطبق (۱۰۰٪)
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateItemStatus(item.id, 'compliant')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              item.status === 'compliant'
                                ? 'bg-teal-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50'
                            }`}
                          >
                            منطبق (۷۵٪)
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateItemStatus(item.id, 'needs_improvement')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              item.status === 'needs_improvement'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-50'
                            }`}
                          >
                            نیازمند بهبود (۵۰٪)
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateItemStatus(item.id, 'non_compliant')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              item.status === 'non_compliant'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-50'
                            }`}
                          >
                            نامنطبق (۰٪)
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateItemStatus(item.id, 'not_applicable')}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              item.status === 'not_applicable'
                                ? 'bg-slate-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                            }`}
                          >
                            NA
                          </button>
                        </div>
                      </div>

                      {/* Observations, Action and Photos */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                        <div>
                          <input
                            type="text"
                            placeholder="توضیحات و مشاهدات عینی ممیز..."
                            value={item.remarks || ''}
                            onChange={(e) => handleUpdateItemText(item.id, 'remarks', e.target.value)}
                            className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                          />
                        </div>

                        <div>
                          <input
                            type="text"
                            placeholder="اقدام اصلاحی مورد نیاز در صورت عدم انطباق..."
                            value={item.correctiveActionText || ''}
                            onChange={(e) => handleUpdateItemText(item.id, 'correctiveActionText', e.target.value)}
                            className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                          />
                        </div>
                      </div>

                      {/* Photo Attachment Thumbnails */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoUploadItemId(item.id);
                            fileInputRef.current?.click();
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5 text-emerald-600" />
                          <span>افزودن عکس</span>
                        </button>

                        {(item.photos || []).map((p) => (
                          <div key={p.id} className="relative group">
                            <img
                              src={p.fileData}
                              alt="پیش‌نمایش"
                              className="w-12 h-12 object-cover rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer"
                              onClick={() => setPreviewPhoto(p)}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(item.id, p.id)}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Hidden file input for photo upload */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/jpg,image/webp"
                className="hidden"
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                با ذخیره بازرسی، عدم انطباق‌های مشخص‌شده به طور خودکار در سامانه ثبت خواهند شد.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleSaveInspection}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>ثبت نهایی بازرسی و محاسبه امتیاز</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: INSPECTION REPORT & DETAILS */}
      {/* ============================================================== */}
      {isDetailsModalOpen && viewingInspection && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Award className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="font-black text-base">
                    کارنامه ممیزی و گزارش تفصیلی 5S ({viewingInspection.inspectionNumber})
                  </h3>
                  <span className="text-xs text-slate-400">
                    واحد {viewingInspection.department} | تاریخ {viewingInspection.date}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    printService.printElement('five-s-inspection-modal-print-container', {
                      title: `کارنامه ممیزی و گزارش تفصیلی نظام آراستگی ۵S - ${viewingInspection.inspectionNumber}`,
                      orientation: 'portrait',
                      pageSize: 'A4',
                      documentCode: 'HSE-5S-REP-01',
                      documentDate: viewingInspection.date,
                      isFa: true,
                      autoPrint: true
                    });
                  }}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-slate-300"
                  title="چاپ گزارش"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div id="five-s-inspection-modal-print-container" className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1 text-xs print:p-0 print:overflow-visible">
              {/* Official Standard Header for Print / PDF */}
              <div className="hidden print:block mb-4">
                <FormalReportHeader 
                  isFa={true} 
                  docTitle={`کارنامه ممیزی و گزارش تفصیلی نظام آراستگی ۵S (${viewingInspection.inspectionNumber})`}
                  docCode="HSE-5S-REP-01" 
                  revision="01" 
                  issueDate={viewingInspection.date} 
                />
              </div>

              {/* Score Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="text-center sm:text-right">
                  <span className="text-slate-400 block mb-1">امتیاز کل 5S</span>
                  <div className="text-3xl font-black font-mono text-emerald-600">
                    {viewingInspection.scores.total}٪
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">
                    ارزیابی: {viewingInspection.generalRating}
                  </span>
                </div>

                <div className="text-center sm:text-right">
                  <span className="text-slate-400 block mb-1">مشخصات ممیزی</span>
                  <div className="font-bold text-slate-800 dark:text-white">
                    محل: {viewingInspection.location}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    کارشناس/بازرس: {viewingInspection.inspector} | سرپرست واحد: {viewingInspection.supervisor || '-'} | رئیس مرکز HSE: {(viewingInspection as any).hseManager || 'مدیریت HSE'}
                  </span>
                </div>

                <div className="text-center sm:text-right">
                  <span className="text-slate-400 block mb-1">نوع و زمان‌بندی بازرسی</span>
                  <div className="space-y-1">
                    <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold ${getInspectionTypeBadgeClass(normalizeInspectionType(viewingInspection.inspectionType))}`}>
                      {viewingInspection.inspectionType || 'دوره‌ای'}
                    </span>
                    {normalizeInspectionType(viewingInspection.inspectionType) === 'PERIODIC' && (
                      <div className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        سررسید بعدی: {viewingInspection.nextInspectionDate || 'تعیین نشده'}
                      </div>
                    )}
                    {(normalizeInspectionType(viewingInspection.inspectionType) === 'PRE_OP' || normalizeInspectionType(viewingInspection.inspectionType) === 'POST_OP') && (
                      <div className="text-[11px] text-amber-600 dark:text-amber-400">
                        عملیات: {viewingInspection.relatedOperationId || ''} {viewingInspection.relatedOperationTitle ? `(${viewingInspection.relatedOperationTitle})` : ''}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-center sm:text-right">
                  <span className="text-slate-400 block mb-1">وضعیت انطباق</span>
                  <div className="font-bold text-rose-600 font-mono text-base">
                    {viewingInspection.nonConformancesCount} عدم انطباق
                  </div>
                  <span className="text-[10px] text-slate-400">
                    اقدامات باز: {viewingInspection.openActionsCount}
                  </span>
                </div>
              </div>

              {/* History / Audit Log */}
              {viewingInspection.inspectionHistory && viewingInspection.inspectionHistory.length > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span>تاریخچه ثبت و تغییرات زمان‌بندی بازرسی:</span>
                  </div>
                  <div className="space-y-1.5">
                    {viewingInspection.inspectionHistory.map((h, i) => (
                      <div key={h.id || i} className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400">{h.inspectionDate || h.timestamp.slice(0, 10)}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{h.notes}</span>
                          {h.newNextDueDate && (
                            <span className="text-[10px] text-emerald-600 font-mono font-bold">
                              (سررسید بعدی: {h.newNextDueDate})
                            </span>
                          )}
                        </div>
                        <span className="text-slate-400 font-mono text-[10px]">{h.changedBy}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5-Pillar Score Details */}
              <div className="space-y-3">
                <h4 className="font-black text-slate-800 dark:text-white">
                  تفکیک امتیازات پنج اصل 5S:
                </h4>
                <div className="grid grid-cols-5 gap-2 text-center font-mono">
                  {FIVE_S_PILLARS.map(p => (
                    <div key={p.key} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="text-[10px] font-sans font-bold text-slate-500 block truncate">{p.titleFa}</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white">{viewingInspection.scores[p.key]}٪</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Checklist Breakdown */}
              <div className="space-y-3">
                <h4 className="font-black text-slate-800 dark:text-white">
                  ریز ارزیابی آیتم‌های چک‌لیست ({viewingInspection.items.length} آیتم):
                </h4>
                <div className="space-y-2">
                  {viewingInspection.items.map((it) => (
                    <div key={it.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-400">{it.itemNumber}.</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{it.title}</span>
                        </div>
                        {it.remarks && (
                          <p className="text-[11px] text-slate-500 pr-5">مشاهده: {it.remarks}</p>
                        )}
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] shrink-0 ${
                        it.status === 'fully_compliant' ? 'bg-emerald-100 text-emerald-800' :
                        it.status === 'compliant' ? 'bg-teal-100 text-teal-800' :
                        it.status === 'needs_improvement' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {it.status === 'fully_compliant' ? '۱۰۰٪ کاملاً منطبق' :
                         it.status === 'compliant' ? '۷۵٪ منطبق' :
                         it.status === 'needs_improvement' ? '۵۰٪ بهبود' : '۰٪ نامنطبق'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: EDIT NON-CONFORMANCE & CAPA */}
      {/* ============================================================== */}
      {isNcModalOpen && editingNc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto">
            <div className="p-4 bg-purple-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-black text-sm">
                  ویرایش و پیگیری عدم انطباق 5S ({editingNc.trackingCode})
                </h3>
              </div>
              <button onClick={() => setIsNcModalOpen(false)} className="p-1 hover:bg-white/20 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[80vh]">
              <div>
                <label className="font-bold block mb-1">عنوان عدم انطباق</label>
                <input
                  type="text"
                  value={editingNc.title}
                  onChange={(e) => setEditingNc({ ...editingNc, title: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">شرح دقیق مشاهده و ریشه عدم انطباق</label>
                <textarea
                  rows={3}
                  value={editingNc.description}
                  onChange={(e) => setEditingNc({ ...editingNc, description: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold">واحد مربوطه</label>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">تنظیمات سیستم</span>
                  </div>
                  <select
                    value={editingNc.department}
                    onChange={(e) => setEditingNc({ ...editingNc, department: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {!availableUnits.includes(editingNc.department) && editingNc.department && (
                      <option value={editingNc.department}>{editingNc.department}</option>
                    )}
                    {availableUnits.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold block mb-1">محور 5S</label>
                  <select
                    value={editingNc.pillar}
                    onChange={(e) => setEditingNc({ ...editingNc, pillar: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {FIVE_S_PILLARS.map(p => (
                      <option key={p.key} value={p.key}>{p.titleFa}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold block mb-1">مسئول اقدام اصلاحی</label>
                  <input
                    type="text"
                    value={editingNc.responsiblePerson}
                    onChange={(e) => setEditingNc({ ...editingNc, responsiblePerson: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold block mb-1">مهلت اصلاح (سررسید)</label>
                  <input
                    type="text"
                    value={editingNc.dueDate}
                    onChange={(e) => setEditingNc({ ...editingNc, dueDate: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold block mb-1">وضعیت عدم انطباق</label>
                  <select
                    value={editingNc.status}
                    onChange={(e) => setEditingNc({ ...editingNc, status: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="open">باز (Open)</option>
                    <option value="in_progress">در حال اقدام (In Progress)</option>
                    <option value="completed">تکمیل شده (Completed)</option>
                    <option value="verified_closed">تأیید و مختومه (Closed)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold block mb-1">شدت</label>
                  <select
                    value={editingNc.severity}
                    onChange={(e) => setEditingNc({ ...editingNc, severity: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="پایین (Low)">پایین (Low)</option>
                    <option value="متوسط (Medium)">متوسط (Medium)</option>
                    <option value="بالا (High)">بالا (High)</option>
                    <option value="بحرانی (Critical)">بحرانی (Critical)</option>
                  </select>
                </div>
              </div>

              {/* CAPA Section */}
              <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <h4 className="font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>اقدام اصلاحی و پیشرفت (CAPA)</span>
                </h4>
                
                <div>
                  <label className="font-bold block mb-1 text-[11px]">شرح اقدام اصلاحی انجام‌شده / در حال انجام</label>
                  <input
                    type="text"
                    value={editingNc.correctiveAction?.description || ''}
                    onChange={(e) => setEditingNc({
                      ...editingNc,
                      correctiveAction: {
                        id: editingNc.correctiveAction?.id || `5S-ACT-${Date.now()}`,
                        ncId: editingNc.id,
                        description: e.target.value,
                        responsible: editingNc.responsiblePerson,
                        startDate: editingNc.identifiedDate,
                        dueDate: editingNc.dueDate,
                        status: editingNc.correctiveAction?.status || 'in_progress',
                        progressPercent: editingNc.correctiveAction?.progressPercent || 50
                      }
                    })}
                    placeholder="مثال: جانمایی شیلنگ‌ها، اجرای خط‌کشی و پاک‌سازی کامل..."
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span>درصد پیشرفت اقدام:</span>
                    <span className="font-mono text-emerald-600">{editingNc.correctiveAction?.progressPercent || 0}٪</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={editingNc.correctiveAction?.progressPercent || 0}
                    onChange={(e) => setEditingNc({
                      ...editingNc,
                      correctiveAction: {
                        id: editingNc.correctiveAction?.id || `5S-ACT-${Date.now()}`,
                        ncId: editingNc.id,
                        description: editingNc.correctiveAction?.description || '',
                        responsible: editingNc.responsiblePerson,
                        startDate: editingNc.identifiedDate,
                        dueDate: editingNc.dueDate,
                        status: Number(e.target.value) === 100 ? 'completed' : 'in_progress',
                        progressPercent: Number(e.target.value)
                      }
                    })}
                    className="w-full accent-purple-600"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsNcModalOpen(false)}
                className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveNcModal}
                className="px-4 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-black hover:bg-purple-700"
              >
                ذخیره تغییرات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: CREATE SCHEDULE */}
      {/* ============================================================== */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-blue-600" />
                <span>تعریف برنامه بازرسی 5S</span>
              </h3>
              <button onClick={() => setIsScheduleModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold">واحد سازمانی</label>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400">استخراج از تنظیمات</span>
                </div>
                <select
                  value={scheduleFormData.department}
                  onChange={(e) => setScheduleFormData({ ...scheduleFormData, department: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  {!availableUnits.includes(scheduleFormData.department || '') && scheduleFormData.department && (
                    <option value={scheduleFormData.department}>{scheduleFormData.department}</option>
                  )}
                  {availableUnits.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1">محل بازرسی</label>
                <input
                  type="text"
                  placeholder="کل سایت، خط تولید، کارگاه..."
                  value={scheduleFormData.location || ''}
                  onChange={(e) => setScheduleFormData({ ...scheduleFormData, location: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">دوره بازرسی</label>
                  <select
                    value={scheduleFormData.frequency}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, frequency: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="هفتگی">هفتگی</option>
                    <option value="دو هفته یکبار">دو هفته یکبار</option>
                    <option value="ماهانه">ماهانه</option>
                    <option value="فصلی">فصلی</option>
                    <option value="سالانه">سالانه</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold block mb-1">تاریخ سررسید (شمسی)</label>
                  <input
                    type="text"
                    placeholder="1404/06/15"
                    value={scheduleFormData.scheduledDate || ''}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, scheduledDate: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">بازرس مسئول</label>
                <input
                  type="text"
                  value={scheduleFormData.inspector || ''}
                  onChange={(e) => setScheduleFormData({ ...scheduleFormData, inspector: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveSchedule}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700"
              >
                ذخیره برنامه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: PHOTO LIGHTBOX */}
      {/* ============================================================== */}
      {previewPhoto && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 cursor-pointer"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-3 cursor-default" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 dark:text-white">
                {previewPhoto.title || 'تصویر مدرک بازرسی 5S'}
              </span>
              <button onClick={() => setPreviewPhoto(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewPhoto.fileData}
              alt="عکس پیوست 5S"
              className="w-full max-h-[70vh] object-contain rounded-2xl bg-black"
            />
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>ثبت‌شده توسط: {previewPhoto.uploadedBy}</span>
              <span>تاریخ: {previewPhoto.uploadedAt}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
