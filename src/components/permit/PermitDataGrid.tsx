import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  Check,
  X,
  Flame,
  Snowflake,
  Shovel,
  Box,
  Zap,
  Bookmark,
  Save,
  Trash2,
  Copy,
  Plus,
  Lock,
  Pencil,
  Eye,
  History,
  Send,
  GitCommit
} from 'lucide-react';
import { WorkPermit, PermitCategory, PermitWorkflowStatus, UserProfile } from '../../types';
import { PERMIT_CATEGORIES_CONFIG } from './PermitTypes';
import PersianDatePicker from '../common/PersianDatePicker';
import { downloadCsvFile } from '../../utils/fileHelpers';

interface PermitDataGridProps {
  permits: WorkPermit[];
  currentUser: UserProfile;
  isFa: boolean;
  onSelectPermit?: (permit: WorkPermit, targetTab?: 'details' | 'inspection' | 'audit') => void;
  onEditPermit?: (permit: WorkPermit) => void;
  onUnauthorizedEdit?: (permitId: string) => void;
  onOpenAuditLogs?: (permit: WorkPermit) => void;
  onOpenReInspection?: (permit: WorkPermit) => void;
  onOpenPrintModal: (permit: WorkPermit) => void;
  onOpenQrModal?: (permit: WorkPermit) => void;
  onOpenReferral?: (permit: WorkPermit) => void;
  onOpenWorkflowTracker?: (permit: WorkPermit) => void;
  onDeletePermit?: (permitId: string) => void;
  onNewPermit?: () => void;
  onOpenFieldManager?: () => void;
}

export type GridColumnKey = 
  | 'date'
  | 'permitType'
  | 'serialNumber'
  | 'description'
  | 'location'
  | 'equipmentName'
  | 'hours'
  | 'gasTest'
  | 'safetyInspection'
  | 'unitSupervisor'
  | 'jobExecutor'
  | 'safetyUnit'
  | 'status'
  | 'actions';

interface ColumnDef {
  key: GridColumnKey;
  labelFa: string;
  labelEn: string;
  sortable: boolean;
  defaultVisible: boolean;
  minWidth?: string;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'date', labelFa: 'تاریخ', labelEn: 'Date', sortable: true, defaultVisible: true, minWidth: '130px' },
  { key: 'permitType', labelFa: 'نوع پروانه کار', labelEn: 'Permit Type', sortable: true, defaultVisible: true, minWidth: '150px' },
  { key: 'serialNumber', labelFa: 'شماره سریال', labelEn: 'Serial No.', sortable: true, defaultVisible: true, minWidth: '140px' },
  { key: 'description', labelFa: 'شرح کار و ضمائم', labelEn: 'Description & Attachments', sortable: false, defaultVisible: true, minWidth: '220px' },
  { key: 'location', labelFa: 'محل و واحد', labelEn: 'Location', sortable: true, defaultVisible: true, minWidth: '140px' },
  { key: 'equipmentName', labelFa: 'نام دستگاه / تگ', labelEn: 'Equipment', sortable: true, defaultVisible: true, minWidth: '140px' },
  { key: 'hours', labelFa: 'ساعت شروع و پایان', labelEn: 'Work Hours', sortable: true, defaultVisible: true, minWidth: '130px' },
  { key: 'gasTest', labelFa: 'تست گاز', labelEn: 'Gas Test', sortable: false, defaultVisible: true, minWidth: '140px' },
  { key: 'safetyInspection', labelFa: 'بازرسی ایمنی', labelEn: 'Safety Inspection', sortable: true, defaultVisible: true, minWidth: '140px' },
  { key: 'unitSupervisor', labelFa: 'نام سرپرست واحد', labelEn: 'Supervisor', sortable: true, defaultVisible: true, minWidth: '140px' },
  { key: 'jobExecutor', labelFa: 'نام مجری کار', labelEn: 'Executor', sortable: true, defaultVisible: true, minWidth: '140px' },
  { key: 'safetyUnit', labelFa: 'واحد ایمنی (HSE)', labelEn: 'HSE Officer', sortable: true, defaultVisible: true, minWidth: '140px' },
  { key: 'status', labelFa: 'وضعیت', labelEn: 'Status', sortable: true, defaultVisible: true, minWidth: '120px' },
  { key: 'actions', labelFa: 'عملیات', labelEn: 'Actions', sortable: false, defaultVisible: true, minWidth: '160px' },
];

const PRESETS_STORAGE_KEY = 'ptw_datagrid_presets_v1';
const VISIBLE_COLS_STORAGE_KEY = 'ptw_datagrid_visible_cols_v1';

interface FilterPreset {
  id: string;
  name: string;
  category: string;
  status: string;
  riskLevel: string;
  department: string;
}

export const PermitDataGrid: React.FC<PermitDataGridProps> = ({
  permits,
  currentUser,
  isFa,
  onSelectPermit,
  onEditPermit,
  onUnauthorizedEdit,
  onOpenAuditLogs,
  onOpenReInspection,
  onOpenPrintModal,
  onOpenQrModal,
  onOpenReferral,
  onOpenWorkflowTracker,
  onDeletePermit,
  onNewPermit,
  onOpenFieldManager
}) => {
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Sorting
  const [sortField, setSortField] = useState<GridColumnKey>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Column Visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<GridColumnKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem(VISIBLE_COLS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    const initial: Record<GridColumnKey, boolean> = {} as any;
    ALL_COLUMNS.forEach(c => { initial[c.key] = c.defaultVisible; });
    return initial;
  });

  // Filter Presets
  const [presets, setPresets] = useState<FilterPreset[]>(() => {
    try {
      const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return [
      { id: 'p1', name: 'پروانه‌های گرم فعال', category: 'Hot', status: 'Active', riskLevel: 'all', department: 'all' },
      { id: 'p2', name: 'پروانه‌های تعلیق شده (Stop Work)', category: 'all', status: 'Suspended', riskLevel: 'all', department: 'all' },
      { id: 'p3', name: 'فضای بسته و ریسک بحرانی', category: 'ConfinedSpace', status: 'all', riskLevel: 'Critical', department: 'all' }
    ];
  });

  const [newPresetName, setNewPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);

  // Save visible columns to local storage
  const handleToggleColumn = (key: GridColumnKey) => {
    setVisibleColumns(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(VISIBLE_COLS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Distinct departments
  const departments = useMemo(() => {
    const list = permits.map(p => p.department || p.location.split('-')[0].trim()).filter(Boolean);
    return Array.from(new Set(list));
  }, [permits]);

  // Handle Sort Toggle
  const handleSort = (field: GridColumnKey) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Preset Handlers
  const handleApplyPreset = (preset: FilterPreset) => {
    setSelectedCategory(preset.category);
    setSelectedStatus(preset.status);
    setSelectedRisk(preset.riskLevel);
    setSelectedDept(preset.department);
    setPage(1);
  };

  const handleSaveCurrentPreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: FilterPreset = {
      id: `pre-${Date.now()}`,
      name: newPresetName.trim(),
      category: selectedCategory,
      status: selectedStatus,
      riskLevel: selectedRisk,
      department: selectedDept
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
    setNewPresetName('');
    setShowSavePreset(false);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSelectedRisk('all');
    setSelectedDept('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleCopySerial = (serial: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(serial);
    setCopiedSerial(serial);
    setTimeout(() => setCopiedSerial(null), 1500);
  };

  // Filter & Search Logic
  const filteredPermits = useMemo(() => {
    return permits.filter(permit => {
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesSerial = permit.serialNumber.toLowerCase().includes(query);
        const matchesDesc = permit.description.toLowerCase().includes(query);
        const matchesLoc = permit.location.toLowerCase().includes(query);
        const matchesEq = (permit.equipmentName || '').toLowerCase().includes(query) || (permit.equipmentNumber || '').toLowerCase().includes(query);
        const matchesSup = (permit.responsibles?.unitSupervisor || '').toLowerCase().includes(query);
        const matchesExec = (permit.responsibles?.jobExecutor || '').toLowerCase().includes(query);
        const matchesSafety = (permit.responsibles?.safetyUnit || '').toLowerCase().includes(query);

        if (!matchesSerial && !matchesDesc && !matchesLoc && !matchesEq && !matchesSup && !matchesExec && !matchesSafety) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all') {
        if (permit.permitCategory !== selectedCategory && permit.permitType !== selectedCategory) {
          return false;
        }
      }

      // Status filter
      if (selectedStatus !== 'all') {
        if (permit.status !== selectedStatus) return false;
      }

      // Risk level filter
      if (selectedRisk !== 'all') {
        if (permit.riskLevel !== selectedRisk) return false;
      }

      // Department filter
      if (selectedDept !== 'all') {
        const dept = permit.department || permit.location.split('-')[0].trim();
        if (dept !== selectedDept) return false;
      }

      // Date Range filter (Jalali comparison string)
      if (dateFrom || dateTo) {
        const permitDateStr = `${permit.year}/${permit.month}/${permit.day}`;
        if (dateFrom && permitDateStr < dateFrom) return false;
        if (dateTo && permitDateStr > dateTo) return false;
      }

      return true;
    });
  }, [permits, searchTerm, selectedCategory, selectedStatus, selectedRisk, selectedDept, dateFrom, dateTo]);

  // Sort Logic
  const sortedPermits = useMemo(() => {
    const list = [...filteredPermits];
    list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'date':
          valA = a.createdDate || `${a.year}/${a.month}/${a.day}`;
          valB = b.createdDate || `${b.year}/${b.month}/${b.day}`;
          break;
        case 'serialNumber':
          valA = a.serialNumber;
          valB = b.serialNumber;
          break;
        case 'permitType':
          valA = a.permitCategory || a.permitType;
          valB = b.permitCategory || b.permitType;
          break;
        case 'location':
          valA = a.location;
          valB = b.location;
          break;
        case 'equipmentName':
          valA = a.equipmentName;
          valB = b.equipmentName;
          break;
        case 'hours':
          valA = a.startHour;
          valB = b.startHour;
          break;
        case 'unitSupervisor':
          valA = a.responsibles?.unitSupervisor || '';
          valB = b.responsibles?.unitSupervisor || '';
          break;
        case 'jobExecutor':
          valA = a.responsibles?.jobExecutor || '';
          valB = b.responsibles?.jobExecutor || '';
          break;
        case 'safetyUnit':
          valA = a.responsibles?.safetyUnit || '';
          valB = b.responsibles?.safetyUnit || '';
          break;
        case 'status':
          valA = a.status;
          valB = b.status;
          break;
        default:
          valA = a.rowNumber;
          valB = b.rowNumber;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredPermits, sortField, sortOrder]);

  // Pagination Slice
  const totalItems = sortedPermits.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedPermits = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedPermits.slice(start, start + pageSize);
  }, [sortedPermits, page, pageSize]);

  // Excel (CSV with UTF-8 BOM) Export
  const handleExportExcel = () => {
    const headers = [
      'شماره ردیف',
      'شماره سریال',
      'تاریخ',
      'نوع پروانه',
      'شرح کار',
      'محل انجام کار',
      'نام دستگاه و شماره تجهیز',
      'ساعت شروع',
      'ساعت پایان',
      'شیفت',
      'تست گاز',
      'اکسیژن O2',
      'گاز اشتعال LEL',
      'گاز H2S',
      'گاز CO',
      'تایید بازرسی ایمنی',
      'سرپرست واحد',
      'مجری کار',
      'واحد ایمنی HSE',
      'وضعیت پروانه'
    ];

    const rows = sortedPermits.map((p, idx) => [
      idx + 1,
      `"${p.serialNumber}"`,
      `"${p.year}/${p.month}/${p.day}"`,
      `"${p.permitCategory || p.permitType}"`,
      `"${p.description.replace(/"/g, '""')}"`,
      `"${p.location.replace(/"/g, '""')}"`,
      `"${p.equipmentName || ''} ${p.equipmentNumber || ''}"`,
      `"${p.startHour}"`,
      `"${p.endHour}"`,
      `"${p.workShift}"`,
      `"${p.gasTestRequired}"`,
      p.gasTest?.o2 ?? '',
      p.gasTest?.lel ?? '',
      p.gasTest?.h2s ?? '',
      p.gasTest?.co ?? '',
      `"${p.safetyInspection}"`,
      `"${p.responsibles?.unitSupervisor || ''}"`,
      `"${p.responsibles?.jobExecutor || ''}"`,
      `"${p.responsibles?.safetyUnit || ''}"`,
      `"${p.status}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadCsvFile(`PTW_Permits_Export_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
  };

  // Status Chip Renderer with exact user-requested palette
  // Green=Active/Approved, Yellow=Pending, Red=Critical/Rejected/Expired/Suspended, Blue=Under Review, Gray=Closed
  const renderStatusChip = (status: PermitWorkflowStatus) => {
    let classes = 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
    let label = status as string;
    let dotColor = 'bg-slate-400';

    switch (status) {
      case 'Active':
      case 'Approved':
      case 'Issued':
        classes = 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
        dotColor = 'bg-emerald-500';
        label = status === 'Active' ? 'فعال در سایت' : status === 'Approved' ? 'تأیید شده' : 'صادر شده';
        break;
      case 'Draft':
        classes = 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700 font-black shadow-xs';
        dotColor = 'bg-amber-500 animate-ping';
        label = 'پیش‌نویس (تکمیل‌نشده)';
        break;
      case 'Requested':
      case 'Awaiting Approval':
        classes = 'bg-amber-50 text-amber-700 border-blue-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-blue-800';
        dotColor = 'bg-amber-500';
        label = 'در انتظار تأیید';
        break;
      case 'RiskAssessment':
      case 'HSEReview':
        classes = 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
        dotColor = 'bg-blue-500';
        label = status === 'RiskAssessment' ? 'ارزیابی ریسک' : 'بررسی HSE';
        break;
      case 'Suspended':
      case 'Expired':
      case 'Cancelled':
        classes = 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
        dotColor = 'bg-rose-500';
        label = status === 'Suspended' ? 'تعلیق شده (توقف)' : status === 'Expired' ? 'منقضی شده' : 'لغو شده';
        break;
      case 'Closed':
      case 'Finished':
        classes = 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
        dotColor = 'bg-slate-400';
        label = 'بسته شده';
        break;
      case 'Extended':
        classes = 'bg-amber-50 text-amber-800 border-blue-300 dark:bg-amber-950/40 dark:text-amber-300';
        dotColor = 'bg-amber-500';
        label = 'تمدید شده';
        break;
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${classes}`}>
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span>{label}</span>
      </span>
    );
  };

  // Category Badge Renderer
  const renderCategoryBadge = (category: PermitCategory | 'Hot' | 'Cold') => {
    const config = PERMIT_CATEGORIES_CONFIG[category as PermitCategory];
    const label = config ? config.titleFa : category === 'Hot' ? 'کار گرم' : 'کار سرد';
    const colorClass = config ? config.badgeColor : 'bg-slate-100 text-slate-800 border-slate-300';

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border ${colorClass}`}>
        {category === 'Hot' && <Flame className="w-3.5 h-3.5 text-rose-500" />}
        {category === 'Cold' && <Snowflake className="w-3.5 h-3.5 text-sky-500" />}
        {category === 'Excavation' && <Shovel className="w-3.5 h-3.5 text-amber-600" />}
        {category === 'ConfinedSpace' && <Box className="w-3.5 h-3.5 text-purple-600" />}
        {category === 'ElectricalIsolation' && <Zap className="w-3.5 h-3.5 text-amber-500" />}
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar: Search, Filters Toggle, Presets, Actions */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder={isFa ? 'جستجوی لحظه‌ای: شماره سریال، شرح، محل، تجهیز، سرپرست یا مجری...' : 'Search permits...'}
              className="w-full pr-10 pl-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer ${
                showFilterPanel || selectedCategory !== 'all' || selectedStatus !== 'all' || selectedRisk !== 'all' || selectedDept !== 'all' || dateFrom || dateTo
                  ? 'bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>{isFa ? 'فیلترهای ترکیبی' : 'Filters'}</span>
              {(selectedCategory !== 'all' || selectedStatus !== 'all' || selectedRisk !== 'all' || selectedDept !== 'all' || dateFrom || dateTo) && (
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              )}
            </button>

            {/* Column Selector Toggle */}
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 transition cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">{isFa ? 'انتخاب ستون‌ها' : 'Columns'}</span>
            </button>

            {/* Excel Export */}
            <button
              onClick={handleExportExcel}
              title={isFa ? 'خروجی اکسل با فرمت استاندارد فارسی' : 'Export to Excel CSV'}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isFa ? 'خروجی اکسل' : 'Export Excel'}</span>
            </button>

            {/* Manage Form Fields Button */}
            {onOpenFieldManager && (
              <button
                type="button"
                onClick={onOpenFieldManager}
                title={isFa ? 'مدیریت، افزودن و سفارشی‌سازی فیلدهای پروانه کار گرم و سرد' : 'Manage Custom Form Fields'}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-blue-500" />
                <span className="hidden sm:inline">{isFa ? 'مدیریت فیلدها' : 'Manage Fields'}</span>
              </button>
            )}

            {/* New Permit Button */}
            {onNewPermit && (
              <button
                onClick={onNewPermit}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isFa ? 'ثبت پروانه جدید' : 'New Permit'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Presets Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-500 flex items-center gap-1">
              <Bookmark className="w-3.5 h-3.5 text-blue-500" />
              <span>{isFa ? 'پریست‌های ذخیره شده:' : 'Saved Presets:'}</span>
            </span>

            {presets.map(p => (
              <button
                key={p.id}
                onClick={() => handleApplyPreset(p)}
                className="group px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-600 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer border border-transparent hover:border-blue-200"
              >
                <span>{p.name}</span>
                <span
                  onClick={(e) => handleDeletePreset(p.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition"
                >
                  <X className="w-3 h-3" />
                </span>
              </button>
            ))}

            <button
              onClick={() => setShowSavePreset(!showSavePreset)}
              className="px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Save className="w-3 h-3" />
              <span>{isFa ? '+ ذخیره فیلتر فعلی' : '+ Save Filter'}</span>
            </button>
          </div>

          {(selectedCategory !== 'all' || selectedStatus !== 'all' || selectedRisk !== 'all' || selectedDept !== 'all' || searchTerm || dateFrom || dateTo) && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>{isFa ? 'حذف کلیه فیلترها' : 'Clear Filters'}</span>
            </button>
          )}
        </div>

        {/* Save Preset Inline Input */}
        {showSavePreset && (
          <div className="flex items-center gap-2 p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900 animate-in fade-in">
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="نام پریست فیلتر (مثلاً: پروانه‌های گرم واحد تقطیر)..."
              className="flex-1 p-2 text-xs rounded-lg border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
            <button
              onClick={handleSaveCurrentPreset}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 cursor-pointer"
            >
              ذخیره
            </button>
            <button
              onClick={() => setShowSavePreset(false)}
              className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold cursor-pointer"
            >
              انصراف
            </button>
          </div>
        )}

        {/* Composite Filter Panel (Expandable) */}
        {showFilterPanel && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              {/* Category */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">نوع پروانه:</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium"
                >
                  <option value="all">همه انواع پروانه</option>
                  <option value="Hot">کار گرم (Hot Work)</option>
                  <option value="Cold">کار سرد (Cold Work)</option>
                  <option value="Excavation">حفاری (Excavation)</option>
                  <option value="ConfinedSpace">فضای بسته (Confined Space)</option>
                  <option value="Electrical">برق و ایزولاسیون</option>
                  <option value="Radiation">پرتونگاری (Radiography)</option>
                  <option value="VehicleCrane">تردد جرثقیل و خودرو</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">وضعیت پروانه:</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium"
                >
                  <option value="all">همه وضعیت‌ها</option>
                  <option value="Active">فعال در سایت (Active)</option>
                  <option value="Issued">صادر شده (Issued)</option>
                  <option value="Approved">تأیید شده (Approved)</option>
                  <option value="RiskAssessment">در حال ارزیابی ریسک</option>
                  <option value="HSEReview">در حال بررسی HSE</option>
                  <option value="Requested">درخواست شده</option>
                  <option value="Draft">پیش‌نویس اولیه</option>
                  <option value="Suspended">تعلیق شده (Stop Work)</option>
                  <option value="Closed">بسته و تحویل شده</option>
                </select>
              </div>

              {/* Risk Level */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">سطح ریسک:</label>
                <select
                  value={selectedRisk}
                  onChange={(e) => { setSelectedRisk(e.target.value); setPage(1); }}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium"
                >
                  <option value="all">همه سطوح ریسک</option>
                  <option value="Low">ریسک پایین (Low)</option>
                  <option value="Medium">ریسک متوسط (Medium)</option>
                  <option value="High">ریسک بالا (High)</option>
                  <option value="Critical">ریسک بحرانی (Critical)</option>
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">واحد / بخش:</label>
                <select
                  value={selectedDept}
                  onChange={(e) => { setSelectedDept(e.target.value); setPage(1); }}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium"
                >
                  <option value="all">همه واحدها</option>
                  {departments.map((dept, i) => (
                    <option key={i} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">از تاریخ:</label>
                <PersianDatePicker
                  value={dateFrom}
                  onChange={(val) => { setDateFrom(val); setPage(1); }}
                  placeholder="1403/01/01"
                  className="w-full"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">تا تاریخ:</label>
                <PersianDatePicker
                  value={dateTo}
                  onChange={(val) => { setDateTo(val); setPage(1); }}
                  placeholder="1403/12/29"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Column Visibility Selector Panel (Expandable) */}
        {showColumnSelector && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isFa ? 'شخصی‌سازی ستون‌های جدول DataGrid:' : 'Customize DataGrid Columns:'}
              </span>
              <button
                onClick={() => {
                  const reset: Record<GridColumnKey, boolean> = {} as any;
                  ALL_COLUMNS.forEach(c => { reset[c.key] = true; });
                  setVisibleColumns(reset);
                  localStorage.removeItem(VISIBLE_COLS_STORAGE_KEY);
                }}
                className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
              >
                نمایش همه ستون‌ها
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {ALL_COLUMNS.map(col => (
                <label
                  key={col.key}
                  className={`flex items-center gap-2 p-2 rounded-xl text-xs font-semibold border cursor-pointer transition ${
                    visibleColumns[col.key]
                      ? 'bg-blue-50/70 border-blue-300 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300'
                      : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[col.key]}
                    onChange={() => handleToggleColumn(col.key)}
                    className="w-3.5 h-3.5 rounded text-blue-600"
                  />
                  <span className="truncate">{isFa ? col.labelFa : col.labelEn}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main DataGrid Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                {ALL_COLUMNS.filter(col => visibleColumns[col.key]).map(col => (
                  <th
                    key={col.key}
                    style={{ minWidth: col.minWidth }}
                    className={`p-3.5 whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition' : ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{isFa ? col.labelFa : col.labelEn}</span>
                      {col.sortable && (
                        <div className="text-slate-400">
                          {sortField === col.key ? (
                            sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedPermits.length === 0 ? (
                <tr>
                  <td colSpan={ALL_COLUMNS.filter(col => visibleColumns[col.key]).length} className="text-center py-12">
                    <div className="space-y-2 text-slate-400">
                      <Search className="w-8 h-8 mx-auto opacity-30" />
                      <p className="text-xs font-semibold">{isFa ? 'پروانه‌ای مطابق با فیلترهای جستجو یافت نشد' : 'No permits match your query'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPermits.map((permit) => {
                  const attachedCount = Object.values(permit.attachedPermits || {}).filter(Boolean).length;
                  const cycleCount = permit.inspectionCycles?.length || 0;

                  return (
                    <tr
                      key={permit.id}
                      onClick={() => {
                        if (onSelectPermit) onSelectPermit(permit, 'details');
                      }}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer ${
                        permit.status === 'Draft' ? 'bg-amber-50/50 dark:bg-amber-950/20 border-r-4 border-r-amber-500' : ''
                      }`}
                    >
                      {/* Date */}
                      {visibleColumns.date && (
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-900 dark:text-white">
                            {permit.year}/{permit.month}/{permit.day}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {permit.createdDate ? new Date(permit.createdDate).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '08:00'}
                          </div>
                        </td>
                      )}

                      {/* Permit Type */}
                      {visibleColumns.permitType && (
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="space-y-1">
                            {renderCategoryBadge(permit.permitCategory || permit.permitType)}
                            {permit.riskLevel && (
                              <div className="text-[10px] font-bold">
                                <span className={`px-1.5 py-0.5 rounded ${
                                  permit.riskLevel === 'Critical' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                                  permit.riskLevel === 'High' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}>
                                  ریسک: {permit.riskLevel}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Serial Number */}
                      {visibleColumns.serialNumber && (
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-mono font-extrabold text-blue-600 dark:text-blue-400">
                            <span>{permit.serialNumber}</span>
                            {permit.status === 'Draft' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-xs">
                                <FileText className="w-2.5 h-2.5 text-amber-700 dark:text-amber-300" />
                                {isFa ? 'پیش‌نویس' : 'Draft'}
                              </span>
                            )}
                            <button
                              onClick={(e) => handleCopySerial(permit.serialNumber, e)}
                              title="کپی شماره سریال"
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600 transition"
                            >
                              {copiedSerial === permit.serialNumber ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>
                      )}

                      {/* Description & Attached */}
                      {visibleColumns.description && (
                        <td className="p-3.5 max-w-xs">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                            {permit.description}
                          </p>
                          {attachedCount > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {permit.attachedPermits.confinedSpace && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                                  فضای بسته
                                </span>
                              )}
                              {permit.attachedPermits.excavation && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                                  حفاری
                                </span>
                              )}
                              {permit.attachedPermits.workingAtHeight && (
                                <span className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 text-[10px] font-bold">
                                  کار در ارتفاع
                                </span>
                              )}
                              {permit.attachedPermits.electrical && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                                  برق
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      )}

                      {/* Location */}
                      {visibleColumns.location && (
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{permit.location}</div>
                          {permit.department && (
                            <div className="text-[10px] text-slate-400">{permit.department}</div>
                          )}
                        </td>
                      )}

                      {/* Equipment */}
                      {visibleColumns.equipmentName && (
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{permit.equipmentName || '—'}</div>
                          {permit.equipmentNumber && (
                            <div className="font-mono text-[10px] text-slate-400">{permit.equipmentNumber}</div>
                          )}
                        </td>
                      )}

                      {/* Hours */}
                      {visibleColumns.hours && (
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {permit.startHour} تا {permit.endHour}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            شیفت: {permit.workShift === 'Morning' ? 'صبح' : permit.workShift === 'Evening' ? 'عصر' : 'شب'}
                          </div>
                        </td>
                      )}

                      {/* Gas Test */}
                      {visibleColumns.gasTest && (
                        <td className="p-3.5 whitespace-nowrap">
                          {permit.gasTest ? (
                            <div className="space-y-1">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                permit.gasTest.status === 'Approved'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}>
                                {permit.gasTest.status === 'Approved' ? 'تست ایمن' : 'عدم تایید'}
                              </span>
                              <div className="font-mono text-[10px] text-slate-500">
                                O2: {permit.gasTest.o2}% | LEL: {permit.gasTest.lel}%
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">لازم نیست</span>
                          )}
                        </td>
                      )}

                      {/* Safety Inspection & Cycle */}
                      {visibleColumns.safetyInspection && (
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              permit.safetyInspection === 'Approved'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}>
                              {permit.safetyInspection === 'Approved' ? 'تأیید ایمنی' : 'رد ایمنی'}
                            </span>
                            {cycleCount > 0 && (
                              <div className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                                دوره {cycleCount} ({permit.inspectionCycles?.[cycleCount - 1]?.status === 'Approved' ? 'تأیید' : 'مشروط/رد'})
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Unit Supervisor */}
                      {visibleColumns.unitSupervisor && (
                        <td className="p-3.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                          {permit.responsibles?.unitSupervisor || '—'}
                        </td>
                      )}

                      {/* Job Executor */}
                      {visibleColumns.jobExecutor && (
                        <td className="p-3.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                          {permit.responsibles?.jobExecutor || '—'}
                        </td>
                      )}

                      {/* Safety Unit */}
                      {visibleColumns.safetyUnit && (
                        <td className="p-3.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                          {permit.responsibles?.safetyUnit || '—'}
                        </td>
                      )}

                      {/* Status */}
                      {visibleColumns.status && (
                        <td className="p-3.5 whitespace-nowrap">
                          {renderStatusChip(permit.status)}
                        </td>
                      )}

                      {/* Actions */}
                      {visibleColumns.actions && (
                        <td className="p-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            {/* View Registered Permit Form */}
                            <button
                              onClick={() => onSelectPermit?.(permit, 'details')}
                              title={isFa ? 'مشاهده فرم پروانه کار صادر شده' : 'View Permit Form'}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/60 transition cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Edit / Complete Draft Permit */}
                            {currentUser.role === 'Administrator' || permit.status === 'Draft' ? (
                              <button
                                onClick={() => onEditPermit?.(permit)}
                                title={permit.status === 'Draft' ? (isFa ? 'تکمیل و صدور پروانه کار پیش‌نویس' : 'Complete & Issue Draft Permit') : (isFa ? 'ویرایش پروانه کار (ویژه مدیر اصلی سامانه)' : 'Edit Permit (Admin Only)')}
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  permit.status === 'Draft'
                                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/70 dark:text-amber-200 border-amber-300 dark:border-amber-700 shadow-xs'
                                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/60'
                                }`}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => onUnauthorizedEdit ? onUnauthorizedEdit(permit.id) : onEditPermit?.(permit)}
                                title={isFa ? 'ویرایش پروانه کار فقط برای مدیر اصلی سامانه فعال است' : 'Edit restricted to Administrator'}
                                className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition cursor-pointer opacity-70"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}

                            {/* Dedicated Audit Log Icon right next to pencil icon */}
                            <button
                              onClick={() => onOpenAuditLogs ? onOpenAuditLogs(permit) : onSelectPermit?.(permit, 'audit')}
                              title={isFa ? 'مشاهده لاگ‌های ممیزی و تاریخچه تغییرات پروانه کار' : 'View Permit Audit Trail & Logs'}
                              className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 transition cursor-pointer shadow-xs"
                            >
                              <History className="w-4 h-4" />
                            </button>

                            {/* Referral / ارجاع سند جهت بررسی، تأیید و امضا */}
                            {onOpenReferral && (
                              <button
                                onClick={() => onOpenReferral(permit)}
                                title={isFa ? 'ارجاع پروانه جهت بررسی، تأیید و امضای دیجیتال' : 'Refer Permit for Review / Signature'}
                                className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/60 transition cursor-pointer shadow-xs"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}

                            {/* Workflow Tracker / پیگیری گردش کار ارجاعات پروانه */}
                            {onOpenWorkflowTracker && (
                              <button
                                onClick={() => onOpenWorkflowTracker(permit)}
                                title={isFa ? 'رهگیری گردش کار و وضعیت امضاهای پروانه' : 'Track Referral Workflow & Signatures'}
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60 transition cursor-pointer shadow-xs"
                              >
                                <GitCommit className="w-4 h-4" />
                              </button>
                            )}

                            {/* Master Print Preview */}
                            <button
                              onClick={() => onOpenPrintModal(permit)}
                              title={isFa ? 'چاپ رسمی پروانه کار' : 'Print Permit'}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition cursor-pointer"
                            >
                              <FileText className="w-4 h-4" />
                            </button>

                            {/* Delete (Admin Only) */}
                            {onDeletePermit && (
                              currentUser.role === 'Administrator' ? (
                                <button
                                  onClick={() => onDeletePermit(permit.id)}
                                  title={isFa ? 'حذف پروانه کار (ویژه مدیر اصلی)' : 'Delete Permit (Admin Only)'}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => onDeletePermit(permit.id)}
                                  title={isFa ? 'حذف فقط برای مدیر اصلی سامانه فعال است' : 'Delete restricted to Administrator'}
                                  className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-amber-500 dark:hover:text-amber-400 transition cursor-pointer opacity-60"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* DataGrid Footer: Pagination & Item Counters */}
        <div className="p-4 bg-slate-50/80 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-slate-500 font-medium">
            <span>
              {isFa ? `نمایش ${paginatedPermits.length} از مجموع ${totalItems} پروانه` : `Showing ${paginatedPermits.length} of ${totalItems} permits`}
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <div className="flex items-center gap-1.5">
              <span>تعداد در صفحه:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="p-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>

          {/* Pagination Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-bold text-slate-700 dark:text-slate-200">
              صفحه {page} از {totalPages}
            </span>

            <button
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
