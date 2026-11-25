import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import {
  Building2,
  Users,
  Clock,
  Award,
  Layers,
  Plus,
  Search,
  Filter,
  RotateCcw,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Printer,
  History,
  CheckCircle2,
  AlertCircle,
  X,
  UserCheck,
  CalendarDays,
  BarChart3,
  ListChecks,
  Sparkles,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import PersianDatePicker from '../common/PersianDatePicker';
import { apiDb } from '../../services/apiDatabaseClient';
import { printService } from '../../services/printService';
import { getShamsiToday } from '../../utils/jalaliDate';
import { normalizeForMatching } from '../../utils/textNormalization';
import {
  cleanContractorDisplayName,
  computeContractorTrainingAggregates,
  normalizeContractorCompanyKey,
  parseTrainingHours,
  roundHours,
  toComparableJalaliNumber,
} from '../../utils/contractorTrainingAnalytics';
import type {
  ContractorCompany,
  ContractorTrainingAuditEntry,
  ContractorTrainingRecord,
  LegacyContractorSummary,
} from '../../types/training';

interface ContractorTrainingPanelProps {
  isFa: boolean;
  currentUser: any;
  jobTitles: string[];
  onContractorsSynced?: (synced: LegacyContractorSummary[]) => void;
}

type ViewTab = 'summary' | 'records' | 'audit';
type ChartMetric = 'totalHours' | 'uniquePersonnelCount' | 'averagePerCapitaHours';

interface FormState {
  companyName: string;
  personnelFullName: string;
  jobTitle: string;
  trainingHours: string;
  trainingDate: string;
  courseTitle: string;
  notes: string;
}

const CHART_COLORS = [
  '#2563eb',
  '#0891b2',
  '#059669',
  '#4f46e5',
  '#d97706',
  '#7c3aed',
  '#0284c7',
  '#0d9488',
];

function formatNumber(val: number, maxDecimals = 2): string {
  if (!Number.isFinite(val)) return '0';
  return Number(val.toFixed(maxDecimals)).toLocaleString('en-US', {
    maximumFractionDigits: maxDecimals,
  });
}

function getActionBadgeConfig(action: ContractorTrainingAuditEntry['action'], isFa: boolean) {
  switch (action) {
    case 'CREATE':
      return {
        label: isFa ? 'ثبت رکورد' : 'Created',
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70',
      };
    case 'UPDATE':
      return {
        label: isFa ? 'ویرایش' : 'Updated',
        cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/70',
      };
    case 'DELETE':
      return {
        label: isFa ? 'حذف' : 'Deleted',
        cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/70',
      };
  }
}

export default function ContractorTrainingPanel({
  isFa,
  currentUser,
  jobTitles,
  onContractorsSynced,
}: ContractorTrainingPanelProps) {
  // Persisted state from backend PostgreSQL
  const [records, setRecords] = useState<ContractorTrainingRecord[]>([]);
  const [companies, setCompanies] = useState<ContractorCompany[]>([]);
  const [auditHistory, setAuditHistory] = useState<ContractorTrainingAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Active sub-view & chart metric
  const [activeView, setActiveView] = useState<ViewTab>('summary');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('totalHours');
  const [expandedCompanyKey, setExpandedCompanyKey] = useState<string | null>(null);

  // Form & editing state
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => ({
    companyName: '',
    personnelFullName: '',
    jobTitle: '',
    trainingHours: '',
    trainingDate: getShamsiToday(),
    courseTitle: '',
    notes: '',
  }));

  // Company Autocomplete dropdown state
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [highlightedCompanyIdx, setHighlightedCompanyIdx] = useState(-1);
  const companyBoxRef = useRef<HTMLDivElement>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCompanyKey, setFilterCompanyKey] = useState('');
  const [filterPersonnel, setFilterPersonnel] = useState('');
  const [filterJobTitle, setFilterJobTitle] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Delete confirmation modal state (no window.confirm)
  const [pendingDelete, setPendingDelete] = useState<ContractorTrainingRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync callback ref to avoid refetch loops
  const onContractorsSyncedRef = useRef(onContractorsSynced);
  useEffect(() => {
    onContractorsSyncedRef.current = onContractorsSynced;
  }, [onContractorsSynced]);

  // Role check mirror of backend `canBulkAssignTraining`
  const canManageRecords = useMemo(() => {
    const role = String(currentUser?.role || '').trim().toLowerCase();
    return (
      !role ||
      role === 'administrator' ||
      role === 'admin' ||
      role === 'hse manager' ||
      role === 'hse officer' ||
      role === 'manager' ||
      role.includes('admin') ||
      role.includes('hse') ||
      role.includes('مدیر') ||
      role.includes('کارشناس')
    );
  }, [currentUser]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await apiDb.getContractorTrainingData();
      setRecords(data.records || []);
      setCompanies(data.companies || []);
      setAuditHistory(data.auditHistory || []);
      if (Array.isArray(data.syncedContractors)) {
        onContractorsSyncedRef.current?.(data.syncedContractors);
      }
    } catch (err: any) {
      if (!silent) {
        toast.error(
          err?.message ||
            (isFa
              ? 'خطا در دریافت اطلاعات آموزشی شرکت‌ها و پیمانکاران'
              : 'Failed to load contractor training records')
        );
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [isFa]);

  useEffect(() => {
    loadData(false);

    const handleExternalMutation = (e: any) => {
      const entity = e?.detail?.entityType || e?.detail?.entity || e?.detail?.key;
      if (
        !entity ||
        entity === 'training' ||
        entity === 'settings' ||
        String(entity).startsWith('hse_training_contractor')
      ) {
        loadData(true);
      }
    };

    window.addEventListener('app_data_mutated', handleExternalMutation);
    window.addEventListener('hse_data_mutated', handleExternalMutation);
    return () => {
      window.removeEventListener('app_data_mutated', handleExternalMutation);
      window.removeEventListener('hse_data_mutated', handleExternalMutation);
    };
  }, [loadData]);

  // Close company autocomplete on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (companyBoxRef.current && !companyBoxRef.current.contains(e.target as Node)) {
        setIsCompanyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Smart company matching & autocomplete suggestions
  const typedCompanyKey = useMemo(
    () => normalizeContractorCompanyKey(form.companyName),
    [form.companyName]
  );

  const exactMatchedCompany = useMemo(() => {
    if (!typedCompanyKey) return null;
    return (
      companies.find(
        (c) => (c.normalizedKey || normalizeContractorCompanyKey(c.name)) === typedCompanyKey
      ) || null
    );
  }, [companies, typedCompanyKey]);

  const companySuggestions = useMemo(() => {
    const queryNorm = normalizeForMatching(form.companyName);
    const queryKey = typedCompanyKey;

    const sorted = [...companies].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    if (!queryNorm) return sorted.slice(0, 12);

    return sorted
      .filter((c) => {
        const nameNorm = normalizeForMatching(c.name);
        const key = c.normalizedKey || normalizeContractorCompanyKey(c.name);
        return nameNorm.includes(queryNorm) || (queryKey && key.includes(queryKey));
      })
      .slice(0, 10);
  }, [companies, form.companyName, typedCompanyKey]);

  // Personnel suggestions for currently selected/typed company (makes logging multiple courses for same person accurate)
  const personnelSuggestionsForCompany = useMemo(() => {
    const seen = new Map<string, { fullName: string; lastJobTitle: string }>();
    records.forEach((r) => {
      const rKey = normalizeContractorCompanyKey(r.companyName);
      if (typedCompanyKey && rKey !== typedCompanyKey) return;
      const cleanName = cleanContractorDisplayName(r.personnelFullName);
      if (!cleanName) return;
      const key = normalizeForMatching(cleanName);
      if (!seen.has(key)) {
        seen.set(key, {
          fullName: cleanName,
          lastJobTitle: cleanContractorDisplayName(r.jobTitle),
        });
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.fullName.localeCompare(b.fullName, 'fa'));
  }, [records, typedCompanyKey]);

  // Job title suggestions combining org catalog + previously recorded contractor job titles
  const jobTitleSuggestions = useMemo(() => {
    const map = new Map<string, string>();
    [...jobTitles, ...records.map((r) => r.jobTitle)].forEach((jt) => {
      const clean = cleanContractorDisplayName(jt);
      if (!clean) return;
      const key = normalizeForMatching(clean);
      if (!map.has(key)) map.set(key, clean);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [jobTitles, records]);

  // Distinct filter options
  const filterCompanyOptions = useMemo(() => {
    const map = new Map<string, string>();
    companies.forEach((c) => {
      const key = c.normalizedKey || normalizeContractorCompanyKey(c.name);
      if (key && !map.has(key)) map.set(key, c.name);
    });
    records.forEach((r) => {
      const key = normalizeContractorCompanyKey(r.companyName);
      if (key && !map.has(key)) map.set(key, r.companyName);
    });
    return Array.from(map.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  }, [companies, records]);

  const filterJobTitleOptions = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((r) => {
      const clean = cleanContractorDisplayName(r.jobTitle);
      if (!clean) return;
      const key = normalizeForMatching(clean);
      if (!map.has(key)) map.set(key, clean);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [records]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      filterCompanyKey ||
      filterPersonnel.trim() ||
      filterJobTitle ||
      filterDateFrom ||
      filterDateTo
  );

  // Filtered individual training records
  const filteredRecords = useMemo(() => {
    const qNorm = normalizeForMatching(searchQuery);
    const pNorm = normalizeForMatching(filterPersonnel);
    const jobNorm = normalizeForMatching(filterJobTitle);
    const fromNum = toComparableJalaliNumber(filterDateFrom);
    const toNum = toComparableJalaliNumber(filterDateTo);

    return records
      .filter((r) => {
        if (filterCompanyKey) {
          const recKey = normalizeContractorCompanyKey(r.companyName);
          if (recKey !== filterCompanyKey) return false;
        }
        if (pNorm) {
          const nameNorm = normalizeForMatching(r.personnelFullName);
          if (!nameNorm.includes(pNorm)) return false;
        }
        if (jobNorm) {
          const rJobNorm = normalizeForMatching(r.jobTitle);
          if (rJobNorm !== jobNorm) return false;
        }
        if (fromNum !== null || toNum !== null) {
          const recDateNum = toComparableJalaliNumber(r.trainingDate);
          if (recDateNum === null) return false;
          if (fromNum !== null && recDateNum < fromNum) return false;
          if (toNum !== null && recDateNum > toNum) return false;
        }
        if (qNorm) {
          const hay = normalizeForMatching(
            `${r.companyName} ${r.personnelFullName} ${r.jobTitle} ${r.courseTitle || ''} ${r.notes || ''} ${r.trainingDate || ''}`
          );
          if (!hay.includes(qNorm)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const diff =
          (toComparableJalaliNumber(b.trainingDate) ?? 0) -
          (toComparableJalaliNumber(a.trainingDate) ?? 0);
        if (diff !== 0) return diff;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
  }, [
    records,
    searchQuery,
    filterCompanyKey,
    filterPersonnel,
    filterJobTitle,
    filterDateFrom,
    filterDateTo,
  ]);

  // Single-source-of-truth aggregations (filtered + global)
  const { companyAggregates, globalStats } = useMemo(
    () => computeContractorTrainingAggregates(filteredRecords, companies),
    [filteredRecords, companies]
  );

  const unfilteredAggregates = useMemo(
    () => computeContractorTrainingAggregates(records, companies),
    [records, companies]
  );

  // Comparative chart data (top 12 contractors sorted by selected metric)
  const chartData = useMemo(() => {
    return [...companyAggregates]
      .sort((a, b) => b[chartMetric] - a[chartMetric])
      .slice(0, 12)
      .map((agg) => ({
        name: agg.companyName.length > 26 ? `${agg.companyName.slice(0, 25)}…` : agg.companyName,
        fullName: agg.companyName,
        totalHours: agg.totalHours,
        uniquePersonnelCount: agg.uniquePersonnelCount,
        averagePerCapitaHours: agg.averagePerCapitaHours,
        recordsCount: agg.recordsCount,
      }));
  }, [companyAggregates, chartMetric]);

  // Reset form helper
  const resetForm = (preserveCompany = false) => {
    setEditingRecordId(null);
    setForm((prev) => ({
      companyName: preserveCompany ? prev.companyName : '',
      personnelFullName: '',
      jobTitle: '',
      trainingHours: '',
      trainingDate: prev.trainingDate || getShamsiToday(),
      courseTitle: '',
      notes: '',
    }));
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterCompanyKey('');
    setFilterPersonnel('');
    setFilterJobTitle('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  // Start editing an existing individual record
  const handleStartEdit = (rec: ContractorTrainingRecord) => {
    if (!canManageRecords) {
      toast.error(
        isFa
          ? 'شما مجوز ویرایش سوابق آموزشی شرکت‌ها و پیمانکاران را ندارید.'
          : 'You do not have permission to edit contractor training records.'
      );
      return;
    }
    setEditingRecordId(rec.id);
    setForm({
      companyName: rec.companyName,
      personnelFullName: rec.personnelFullName,
      jobTitle: rec.jobTitle,
      trainingHours: String(rec.trainingHours),
      trainingDate: rec.trainingDate || getShamsiToday(),
      courseTitle: rec.courseTitle || '',
      notes: rec.notes || '',
    });
    setIsCompanyDropdownOpen(false);
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Submit create / update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageRecords) {
      toast.error(
        isFa
          ? 'شما مجوز ثبت یا ویرایش سوابق آموزشی پیمانکاران را ندارید.'
          : 'Not authorized to manage contractor training records.'
      );
      return;
    }

    const canonicalCompanyName = exactMatchedCompany
      ? exactMatchedCompany.name
      : cleanContractorDisplayName(form.companyName);
    const cleanPerson = cleanContractorDisplayName(form.personnelFullName);
    const cleanJob = cleanContractorDisplayName(form.jobTitle);
    const parsedHours = parseTrainingHours(form.trainingHours);
    const cleanDate = String(form.trainingDate || '').trim();

    if (!canonicalCompanyName) {
      toast.error(isFa ? 'لطفاً نام شرکت / پیمانکار را وارد نمایید.' : 'Company name is required.');
      return;
    }
    if (!cleanPerson) {
      toast.error(
        isFa
          ? 'لطفاً نام و نام خانوادگی پرسنل آموزش‌دیده را وارد نمایید.'
          : 'Personnel full name is required.'
      );
      return;
    }
    if (!cleanJob) {
      toast.error(isFa ? 'لطفاً سمت شغلی پرسنل را وارد نمایید.' : 'Job title is required.');
      return;
    }
    if (!parsedHours || parsedHours <= 0 || parsedHours > 1000) {
      toast.error(
        isFa
          ? 'ساعت سرانه آموزشی باید عددی معتبر و بزرگ‌تر از صفر باشد.'
          : 'Training hours must be a positive number.'
      );
      return;
    }
    if (!cleanDate) {
      toast.error(isFa ? 'لطفاً تاریخ آموزش را انتخاب نمایید.' : 'Training date is required.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        companyName: canonicalCompanyName,
        personnelFullName: cleanPerson,
        jobTitle: cleanJob,
        trainingHours: parsedHours,
        trainingDate: cleanDate,
        courseTitle: cleanContractorDisplayName(form.courseTitle) || undefined,
        notes: cleanContractorDisplayName(form.notes) || undefined,
      };

      const res = editingRecordId
        ? await apiDb.updateContractorTrainingRecord(editingRecordId, payload)
        : await apiDb.createContractorTrainingRecord(payload);

      if (res) {
        if (Array.isArray(res.records)) setRecords(res.records);
        if (Array.isArray(res.companies)) setCompanies(res.companies);
        if (Array.isArray(res.auditHistory)) setAuditHistory(res.auditHistory);
        if (Array.isArray(res.syncedContractors)) {
          onContractorsSyncedRef.current?.(res.syncedContractors);
        }
      }

      toast.success(
        editingRecordId
          ? isFa
            ? `سابقه آموزشی «${cleanPerson}» با موفقیت ویرایش و آمارها به‌روزرسانی شد.`
            : `Updated training record for ${cleanPerson}.`
          : isFa
          ? `سابقه آموزشی «${cleanPerson}» برای «${canonicalCompanyName}» ثبت شد.`
          : `Recorded training for ${cleanPerson} (${canonicalCompanyName}).`
      );

      // Keep selected company on create so consecutive entries for the same contractor are effortless
      resetForm(!editingRecordId);
    } catch (err: any) {
      toast.error(
        err?.message ||
          (isFa ? 'خطا در ذخیره‌سازی سابقه آموزشی پیمانکار' : 'Failed to save contractor record')
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Delete confirmed record
  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await apiDb.deleteContractorTrainingRecord(pendingDelete.id);
      if (res) {
        if (Array.isArray(res.records)) setRecords(res.records);
        if (Array.isArray(res.companies)) setCompanies(res.companies);
        if (Array.isArray(res.auditHistory)) setAuditHistory(res.auditHistory);
        if (Array.isArray(res.syncedContractors)) {
          onContractorsSyncedRef.current?.(res.syncedContractors);
        }
      }
      if (editingRecordId === pendingDelete.id) {
        resetForm(false);
      }
      toast.success(
        isFa
          ? `سابقه آموزشی «${pendingDelete.personnelFullName}» حذف و در تاریخچه تغییرات ثبت شد.`
          : `Deleted training record for ${pendingDelete.personnelFullName}.`
      );
      setPendingDelete(null);
    } catch (err: any) {
      toast.error(
        err?.message ||
          (isFa ? 'خطا در حذف سابقه آموزشی پیمانکار' : 'Failed to delete contractor record')
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Auto-fill job title if user picks an existing trainee from datalist
  const handlePersonnelInputChange = (val: string) => {
    const matched = personnelSuggestionsForCompany.find(
      (p) => normalizeForMatching(p.fullName) === normalizeForMatching(val)
    );
    setForm((prev) => ({
      ...prev,
      personnelFullName: val,
      jobTitle: !prev.jobTitle && matched?.lastJobTitle ? matched.lastJobTitle : prev.jobTitle,
    }));
  };

  // Export multi-sheet Excel (.xlsx)
  const handleExportExcel = () => {
    if (filteredRecords.length === 0 && companyAggregates.length === 0) {
      toast.error(isFa ? 'داده‌ای برای خروجی اکسل وجود ندارد.' : 'No data available to export.');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Aggregated summary per contractor
      const summaryRows = companyAggregates.map((agg, idx) => ({
        'ردیف': idx + 1,
        'نام شرکت / پیمانکار': agg.companyName,
        'تعداد پرسنل آموزش‌دیده (یکتا)': agg.uniquePersonnelCount,
        'تعداد دوره‌ها و سوابق ثبت‌شده': agg.recordsCount,
        'مجموع ساعات آموزش (ساعت)': agg.totalHours,
        'میانگین سرانه آموزشی (ساعت/نفر)': agg.averagePerCapitaHours,
        'آخرین تاریخ آموزش': agg.lastTrainingDate || '-',
      }));
      summaryRows.push({
        'ردیف': companyAggregates.length + 1,
        'نام شرکت / پیمانکار': 'جمع کل / میانگین تجمعی',
        'تعداد پرسنل آموزش‌دیده (یکتا)': globalStats.totalUniquePersonnel,
        'تعداد دوره‌ها و سوابق ثبت‌شده': globalStats.totalRecords,
        'مجموع ساعات آموزش (ساعت)': globalStats.totalHours,
        'میانگین سرانه آموزشی (ساعت/نفر)': globalStats.averagePerCapitaHours,
        'آخرین تاریخ آموزش': '-',
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary['!cols'] = [
        { wch: 8 },
        { wch: 32 },
        { wch: 24 },
        { wch: 24 },
        { wch: 22 },
        { wch: 26 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'خلاصه تجمعی پیمانکاران');

      // Sheet 2: Individual records
      const detailRows = filteredRecords.map((rec, idx) => ({
        'ردیف': idx + 1,
        'نام شرکت / پیمانکار': rec.companyName,
        'نام و نام خانوادگی پرسنل': rec.personnelFullName,
        'سمت شغلی': rec.jobTitle,
        'ساعت سرانه آموزشی (ساعت/نفر)': roundHours(Number(rec.trainingHours)),
        'تاریخ آموزش': rec.trainingDate,
        'عنوان دوره / موضوع': rec.courseTitle || '-',
        'توضیحات': rec.notes || '-',
        'ثبت‌کننده': rec.createdBy || '-',
      }));
      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      wsDetail['!cols'] = [
        { wch: 8 },
        { wch: 28 },
        { wch: 26 },
        { wch: 22 },
        { wch: 24 },
        { wch: 16 },
        { wch: 26 },
        { wch: 28 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsDetail, 'سوابق انفرادی آموزش');

      // Sheet 3: Change history (if any)
      if (auditHistory.length > 0) {
        const auditRows = auditHistory.slice(0, 200).map((entry, idx) => ({
          'ردیف': idx + 1,
          'نوع عملیات': getActionBadgeConfig(entry.action, true).label,
          'تاریخ': entry.dateFa,
          'کاربر اقدام‌کننده': entry.actorName,
          'شرکت / پیمانکار': entry.companyName,
          'پرسنل': entry.personnelFullName,
          'شرح تغییر': entry.summary,
        }));
        const wsAudit = XLSX.utils.json_to_sheet(auditRows);
        wsAudit['!cols'] = [
          { wch: 8 },
          { wch: 14 },
          { wch: 14 },
          { wch: 20 },
          { wch: 26 },
          { wch: 24 },
          { wch: 52 },
        ];
        XLSX.utils.book_append_sheet(wb, wsAudit, 'سوابق تغییرات');
      }

      const safeDate = getShamsiToday().replace(/\//g, '-');
      XLSX.writeFile(wb, `Contractor_Training_Report_${safeDate}.xlsx`);
      toast.success(
        isFa ? 'فایل اکسل گزارش آموزش پیمانکاران با موفقیت دریافت شد.' : 'Excel report downloaded.'
      );
    } catch (err) {
      console.error('[ContractorTraining] Excel export error:', err);
      toast.error(isFa ? 'خطا در تولید فایل اکسل' : 'Failed to generate Excel file');
    }
  };

  // Export PDF via centralized safe React print container
  const handleExportPdf = () => {
    if (filteredRecords.length === 0 && companyAggregates.length === 0) {
      toast.error(isFa ? 'داده‌ای برای چاپ و خروجی PDF وجود ندارد.' : 'No data available to export.');
      return;
    }

    const printed = printService.printElement('contractor-training-pdf-sheet', {
      title: isFa
        ? 'گزارش جامع آمار و سوابق آموزشی شرکت‌ها و پیمانکاران'
        : 'Contractor Training Analytics Report',
      orientation: 'landscape',
      pageSize: 'A4',
      isFa,
      autoPrint: true,
      documentDate: getShamsiToday(),
      customStyles: `
        #contractor-training-pdf-sheet { display: block !important; position: static !important; visibility: visible !important; }
      `,
    });

    if (!printed) {
      toast.error(
        isFa
          ? 'پنجره چاپ مسدود شد؛ لطفاً مجوز نمایش پنجره چاپ مرورگر را فعال کنید.'
          : 'Print popup blocked. Please allow popups for PDF export.'
      );
    }
  };

  const chartMetricLabel = useMemo(() => {
    if (chartMetric === 'totalHours') return isFa ? 'مجموع ساعات آموزش (ساعت)' : 'Total Hours';
    if (chartMetric === 'uniquePersonnelCount')
      return isFa ? 'تعداد پرسنل یکتا (نفر)' : 'Unique Personnel';
    return isFa ? 'میانگین سرانه آموزشی (ساعت/نفر)' : 'Avg Per Capita (hr/person)';
  }, [chartMetric, isFa]);

  const handleCompanyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isCompanyDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsCompanyDropdownOpen(true);
      setHighlightedCompanyIdx(0);
      return;
    }
    if (!isCompanyDropdownOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedCompanyIdx((prev) =>
        companySuggestions.length > 0 ? (prev + 1) % companySuggestions.length : -1
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedCompanyIdx((prev) =>
        companySuggestions.length > 0
          ? (prev - 1 + companySuggestions.length) % companySuggestions.length
          : -1
      );
    } else if (e.key === 'Enter' && highlightedCompanyIdx >= 0 && companySuggestions[highlightedCompanyIdx]) {
      e.preventDefault();
      const chosen = companySuggestions[highlightedCompanyIdx];
      setForm((prev) => ({ ...prev, companyName: chosen.name }));
      setIsCompanyDropdownOpen(false);
      setHighlightedCompanyIdx(-1);
    } else if (e.key === 'Escape') {
      setIsCompanyDropdownOpen(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir={isFa ? 'rtl' : 'ltr'}>
      {/* =====================================================================
          1. EXECUTIVE KPI STRIP (5 Distinct Non-Redundant Indicators)
         ===================================================================== */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm md:text-base font-black text-slate-900 dark:text-white">
              {isFa
                ? 'داشبورد مدیریتی و تحلیل آمار آموزش شرکت‌ها و پیمانکاران'
                : 'Contractor Training Management Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/70">
                <Filter className="w-3.5 h-3.5" />
                <span>
                  {isFa ? 'نمای فیلترشده' : 'Filtered View'} (
                  <span className="font-mono tabular-nums">{filteredRecords.length}</span>{' '}
                  {isFa ? 'از' : 'of'}{' '}
                  <span className="font-mono tabular-nums">{records.length}</span>)
                </span>
              </span>
            )}
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isFa ? 'خروجی Excel' : 'Excel'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isFa ? 'خروجی PDF' : 'PDF'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* KPI 1: Total Contractors */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isFa ? 'کل پیمانکاران فعال' : 'Active Contractors'}
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                {formatNumber(globalStats.totalCompanies, 0)}
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isFa ? 'شرکت' : 'companies'}
              </span>
            </div>
            <div className="mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
              {isFa ? 'ثبت‌شده در بانک پیمانکاران:' : 'Registered in directory:'}{' '}
              <span className="font-mono tabular-nums font-bold text-slate-600 dark:text-slate-300">
                {companies.length}
              </span>
            </div>
          </div>

          {/* KPI 2: Unique Trained Personnel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isFa ? 'پرسنل آموزش‌دیده (یکتا)' : 'Unique Trained Personnel'}
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatNumber(globalStats.totalUniquePersonnel, 0)}
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isFa ? 'نفر یکتا' : 'people'}
              </span>
            </div>
            <div className="mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
              {isFa ? 'شمارش بدون تکرار افراد در دوره‌ها' : 'Deduplicated across multiple courses'}
            </div>
          </div>

          {/* KPI 3: Total Training Records / Courses (Explicitly Separate Metric) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isFa ? 'تعداد دوره‌ها و سوابق' : 'Total Training Records'}
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                {formatNumber(globalStats.totalRecords, 0)}
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isFa ? 'سابقه ثبت‌شده' : 'records'}
              </span>
            </div>
            <div className="mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
              {isFa ? 'شاخص مجزا از تعداد افراد یکتا' : 'Tracked separately from headcount'}
            </div>
          </div>

          {/* KPI 4: Total Training Hours */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isFa ? 'مجموع ساعات آموزشی' : 'Total Training Hours'}
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {formatNumber(globalStats.totalHours, 2)}
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isFa ? 'نفر-ساعت' : 'man-hrs'}
              </span>
            </div>
            <div className="mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
              {isFa ? 'جمع کل ساعات تمام سوابق معتبر' : 'Sum of all valid attendance records'}
            </div>
          </div>

          {/* KPI 5: Average Per-Capita Training Hours */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isFa ? 'میانگین سرانه آموزشی' : 'Avg Per Capita Hours'}
              </span>
              <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono tabular-nums text-cyan-700 dark:text-cyan-400">
                {formatNumber(globalStats.averagePerCapitaHours, 2)}
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isFa ? 'ساعت / نفر' : 'hr / person'}
              </span>
            </div>
            <div className="mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
              {isFa ? 'مجموع ساعات ÷ پرسنل یکتا' : 'Total hours / unique personnel'}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. INDIVIDUAL TRAINING RECORD ENTRY / EDIT FORM (Smart Autocomplete)
         ===================================================================== */}
      <div
        ref={formSectionRef}
        className={`rounded-3xl border p-5 md:p-6 transition-colors ${
          editingRecordId
            ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/70'
            : 'bg-slate-50/80 dark:bg-slate-800/35 border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-700/80 pb-3.5 mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                editingRecordId
                  ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                  : 'bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400'
              }`}
            >
              {editingRecordId ? <Pencil className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {editingRecordId
                  ? isFa
                    ? 'ویرایش سابقه آموزشی پرسنل پیمانکار'
                    : 'Edit Contractor Personnel Record'
                  : isFa
                  ? 'ثبت انفرادی سابقه آموزشی پرسنل شرکت‌ها و پیمانکاران'
                  : 'Record Individual Contractor Personnel Training'}
              </h3>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                {isFa
                  ? 'هر رکورد مربوط به یک دوره آموزشی گذرانده‌شده توسط یک پرسنل است؛ تجمیع شرکت‌ها و تفکیک افراد یکتا به‌صورت خودکار انجام می‌شود.'
                  : 'Each entry logs one training session for an individual trainee; company totals and unique headcount recalculate automatically.'}
              </p>
            </div>
          </div>

          {editingRecordId && (
            <button
              type="button"
              onClick={() => resetForm(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>{isFa ? 'انصراف از ویرایش' : 'Cancel Edit'}</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            {/* Field 1: Smart Contractor Company Autocomplete */}
            <div className="md:col-span-3 space-y-1.5" ref={companyBoxRef}>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>{isFa ? 'نام شرکت / پیمانکار *' : 'Company / Contractor *'}</span>
                {typedCompanyKey && (
                  <span
                    className={`text-[10px] font-bold inline-flex items-center gap-1 ${
                      exactMatchedCompany
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {exactMatchedCompany ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{isFa ? 'موجود در بانک پیمانکاران' : 'Matched directory'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        <span>{isFa ? 'پیمانکار جدید' : 'New company'}</span>
                      </>
                    )}
                  </span>
                )}
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={form.companyName}
                  onFocus={() => setIsCompanyDropdownOpen(true)}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, companyName: e.target.value }));
                    setIsCompanyDropdownOpen(true);
                    setHighlightedCompanyIdx(-1);
                  }}
                  onKeyDown={handleCompanyKeyDown}
                  placeholder={
                    isFa
                      ? 'جستجو یا تایپ نام شرکت / پیمانکار...'
                      : 'Search or enter contractor company...'
                  }
                  autoComplete="off"
                  required
                  className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none shadow-2xs"
                />

                {isCompanyDropdownOpen && companySuggestions.length > 0 && (
                  <div className="absolute z-30 mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800">
                      {isFa
                        ? 'شرکت‌های ثبت‌شده در بانک اطلاعاتی (پیشنهاد هوشمند)'
                        : 'Saved Companies (Smart Autocomplete)'}
                    </div>
                    {companySuggestions.map((company, idx) => {
                      const isExact =
                        (company.normalizedKey || normalizeContractorCompanyKey(company.name)) ===
                        typedCompanyKey;
                      const agg = unfilteredAggregates.companyAggregates.find(
                        (a) => a.normalizedKey === company.normalizedKey
                      );
                      return (
                        <button
                          key={company.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setForm((prev) => ({ ...prev, companyName: company.name }));
                            setIsCompanyDropdownOpen(false);
                            setHighlightedCompanyIdx(-1);
                          }}
                          className={`w-full px-3.5 py-2.5 text-right flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                            idx === highlightedCompanyIdx
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span className="font-bold truncate flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{company.name}</span>
                            {isExact && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            )}
                          </span>
                          {agg && (
                            <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                              {agg.uniquePersonnelCount} {isFa ? 'نفر' : 'ppl'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {exactMatchedCompany &&
                cleanContractorDisplayName(form.companyName) !== exactMatchedCompany.name && (
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>
                      {isFa
                        ? `تطبیق خودکار با «${exactMatchedCompany.name}» برای جلوگیری از ایجاد شرکت تکراری`
                        : `Auto-matched with "${exactMatchedCompany.name}" to prevent duplicate`}
                    </span>
                  </p>
                )}
            </div>

            {/* Field 2: Personnel Full Name */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {isFa ? 'نام و نام خانوادگی پرسنل آموزش‌دیده *' : 'Trained Personnel Full Name *'}
              </label>
              <input
                type="text"
                list="contractor-personnel-suggestions"
                value={form.personnelFullName}
                onChange={(e) => handlePersonnelInputChange(e.target.value)}
                placeholder={isFa ? 'مثال: علیرضا محمدی' : 'e.g. Alireza Mohammadi'}
                required
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none shadow-2xs"
              />
              <datalist id="contractor-personnel-suggestions">
                {personnelSuggestionsForCompany.map((p) => (
                  <option key={p.fullName} value={p.fullName} />
                ))}
              </datalist>
            </div>

            {/* Field 3: Job Title */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {isFa ? 'سمت شغلی *' : 'Job Title *'}
              </label>
              <input
                type="text"
                list="contractor-jobtitle-suggestions"
                value={form.jobTitle}
                onChange={(e) => setForm((prev) => ({ ...prev, jobTitle: e.target.value }))}
                placeholder={isFa ? 'مثال: جوشکار، سرپرست ایمنی' : 'e.g. Welder'}
                required
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none shadow-2xs"
              />
              <datalist id="contractor-jobtitle-suggestions">
                {jobTitleSuggestions.map((jt) => (
                  <option key={jt} value={jt} />
                ))}
              </datalist>
            </div>

            {/* Field 4: Training Hours (hours/person) */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block whitespace-nowrap">
                {isFa ? 'ساعت آموزش *' : 'Hours *'}
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="1000"
                value={form.trainingHours}
                onChange={(e) => setForm((prev) => ({ ...prev, trainingHours: e.target.value }))}
                placeholder="4"
                required
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono tabular-nums font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none shadow-2xs text-center"
              />
            </div>

            {/* Field 5: Training Date */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {isFa ? 'تاریخ آموزش *' : 'Training Date *'}
              </label>
              <PersianDatePicker
                value={form.trainingDate}
                onChange={(val) => setForm((prev) => ({ ...prev, trainingDate: val }))}
                isFa={isFa}
                required
                showGregorianPreview={false}
                placeholder={isFa ? 'انتخاب تاریخ...' : 'Select date...'}
                inputClassName="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono tabular-nums font-bold"
              />
            </div>
          </div>

          {/* Secondary optional row + Submit button */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5 space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                {isFa ? 'عنوان دوره / موضوع آموزش (اختیاری)' : 'Course Title / Topic (Optional)'}
              </label>
              <input
                type="text"
                value={form.courseTitle}
                onChange={(e) => setForm((prev) => ({ ...prev, courseTitle: e.target.value }))}
                placeholder={
                  isFa
                    ? 'مثال: ایمنی کار در ارتفاع، آشنایی با مجوز کار (PTW)...'
                    : 'e.g. Working at Height, PTW Orientation...'
                }
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>

            <div className="md:col-span-4 space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                {isFa ? 'توضیحات تکمیلی (اختیاری)' : 'Notes (Optional)'}
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder={isFa ? 'نام مدرس، محل برگزاری یا شماره گواهینامه...' : 'Instructor or certificate ref...'}
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>

            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={isSaving || !canManageRecords}
                className={`w-full h-[42px] px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  editingRecordId
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
                }`}
              >
                {editingRecordId ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>
                  {isSaving
                    ? isFa
                      ? 'در حال ذخیره...'
                      : 'Saving...'
                    : editingRecordId
                    ? isFa
                      ? 'ذخیره تغییرات رکورد'
                      : 'Save Changes'
                    : isFa
                    ? 'ثبت سابقه آموزشی فرد'
                    : 'Add Training Record'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* =====================================================================
          3. COMPARATIVE PERFORMANCE CHART ACROSS CONTRACTORS
         ===================================================================== */}
      {companyAggregates.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {isFa
                    ? 'نمودار مقایسه‌ای عملکرد آموزشی پیمانکاران'
                    : 'Comparative Contractor Training Performance'}
                </h3>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {isFa
                    ? 'مقایسه مستقیم پیمانکاران بر اساس مجموع ساعات، تعداد پرسنل یکتا یا میانگین سرانه آموزشی'
                    : 'Compare contractors by total hours, unique headcount, or average per capita hours'}
                </p>
              </div>
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 gap-1">
              {(
                [
                  { key: 'totalHours', label: isFa ? 'مجموع ساعات' : 'Total Hours' },
                  { key: 'uniquePersonnelCount', label: isFa ? 'پرسنل یکتا' : 'Unique Staff' },
                  { key: 'averagePerCapitaHours', label: isFa ? 'میانگین سرانه' : 'Avg Per Capita' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setChartMetric(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    chartMetric === opt.key
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full" style={{ height: Math.max(230, Math.min(420, chartData.length * 42 + 48)) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 16, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={165}
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const row = payload[0].payload;
                    return (
                      <div
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-xl text-xs space-y-1.5 min-w-[210px]"
                        dir={isFa ? 'rtl' : 'ltr'}
                      >
                        <div className="font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1.5">
                          {row.fullName}
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{isFa ? 'پرسنل یکتا:' : 'Unique Staff:'}</span>
                          <span className="font-mono tabular-nums font-black text-emerald-600 dark:text-emerald-400">
                            {formatNumber(row.uniquePersonnelCount, 0)} {isFa ? 'نفر' : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{isFa ? 'تعداد سوابق/دوره:' : 'Records:'}</span>
                          <span className="font-mono tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
                            {formatNumber(row.recordsCount, 0)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{isFa ? 'مجموع ساعات:' : 'Total Hours:'}</span>
                          <span className="font-mono tabular-nums font-black text-blue-600 dark:text-blue-400">
                            {formatNumber(row.totalHours, 2)} {isFa ? 'ساعت' : 'hrs'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{isFa ? 'میانگین سرانه:' : 'Avg Per Capita:'}</span>
                          <span className="font-mono tabular-nums font-black text-cyan-700 dark:text-cyan-400">
                            {formatNumber(row.averagePerCapitaHours, 2)} {isFa ? 'ساعت/نفر' : 'hr/p'}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey={chartMetric}
                  name={chartMetricLabel}
                  radius={[0, 8, 8, 0]}
                  barSize={22}
                >
                  {chartData.map((_, idx) => (
                    <Cell key={`bar-cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. UNIFIED SEARCH & MULTI-CRITERIA FILTER BAR
         ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Sub-view switcher */}
          <div className="inline-flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-950/70 p-1 rounded-2xl border border-slate-200/70 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveView('summary')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeView === 'summary'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{isFa ? 'نمای تجمعی پیمانکاران' : 'Aggregated by Contractor'}</span>
              <span className="font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {companyAggregates.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('records')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeView === 'records'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>{isFa ? 'فهرست سوابق انفرادی' : 'Individual Records'}</span>
              <span className="font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {filteredRecords.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('audit')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeView === 'audit'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{isFa ? 'سوابق تغییرات' : 'Change History'}</span>
              <span className="font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {auditHistory.length}
              </span>
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isFa ? 'پاک‌سازی فیلترها' : 'Reset Filters'}</span>
            </button>
          )}
        </div>

        {/* Multi-criteria Filter Controls (Hidden on Audit tab) */}
        {activeView !== 'audit' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            {/* General Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isFa ? 'جستجوی سریع...' : 'Quick search...'}
                className="w-full bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs font-medium focus:border-blue-500 outline-none"
              />
            </div>

            {/* Filter by Contractor */}
            <select
              value={filterCompanyKey}
              onChange={(e) => setFilterCompanyKey(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold focus:border-blue-500 outline-none"
            >
              <option value="">{isFa ? 'همه شرکت‌ها / پیمانکاران' : 'All Contractors'}</option>
              {filterCompanyOptions.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Filter by Personnel Name */}
            <input
              type="text"
              value={filterPersonnel}
              onChange={(e) => setFilterPersonnel(e.target.value)}
              placeholder={isFa ? 'فیلتر نام پرسنل...' : 'Filter personnel name...'}
              className="w-full bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium focus:border-blue-500 outline-none"
            />

            {/* Filter by Job Title */}
            <select
              value={filterJobTitle}
              onChange={(e) => setFilterJobTitle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold focus:border-blue-500 outline-none"
            >
              <option value="">{isFa ? 'همه سمت‌های شغلی' : 'All Job Titles'}</option>
              {filterJobTitleOptions.map((jt) => (
                <option key={jt} value={jt}>
                  {jt}
                </option>
              ))}
            </select>

            {/* Filter Date From */}
            <PersianDatePicker
              value={filterDateFrom}
              onChange={(val) => setFilterDateFrom(val)}
              isFa={isFa}
              showGregorianPreview={false}
              placeholder={isFa ? 'از تاریخ آموزش...' : 'From date...'}
              inputClassName="w-full bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono tabular-nums font-bold"
            />

            {/* Filter Date To */}
            <PersianDatePicker
              value={filterDateTo}
              onChange={(val) => setFilterDateTo(val)}
              isFa={isFa}
              showGregorianPreview={false}
              placeholder={isFa ? 'تا تاریخ آموزش...' : 'To date...'}
              inputClassName="w-full bg-slate-50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono tabular-nums font-bold"
            />
          </div>
        )}

        {/* ===================================================================
            VIEW A: AGGREGATED COMPANY SUMMARY WITH EXPANDABLE PERSONNEL DRAWER
           =================================================================== */}
        {activeView === 'summary' && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-100/90 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-black">
                <tr>
                  <th className="px-3 py-3.5 text-center w-12 text-slate-400">#</th>
                  <th className="px-4 py-3.5">{isFa ? 'نام شرکت / پیمانکار' : 'Contractor Company'}</th>
                  <th className="px-4 py-3.5 text-center whitespace-nowrap">
                    {isFa ? 'پرسنل یکتا (نفر)' : 'Unique Personnel'}
                  </th>
                  <th className="px-4 py-3.5 text-center whitespace-nowrap">
                    {isFa ? 'تعداد دوره‌ها / سوابق' : 'Courses / Records'}
                  </th>
                  <th className="px-4 py-3.5 text-center whitespace-nowrap">
                    {isFa ? 'مجموع ساعات آموزش' : 'Total Hours'}
                  </th>
                  <th className="px-4 py-3.5 text-center whitespace-nowrap">
                    {isFa ? 'میانگین سرانه (ساعت/نفر)' : 'Avg Per Capita'}
                  </th>
                  <th className="px-4 py-3.5 text-center whitespace-nowrap">
                    {isFa ? 'آخرین تاریخ آموزش' : 'Last Training Date'}
                  </th>
                  <th className="px-4 py-3.5 text-center w-32">{isFa ? 'جزئیات افراد' : 'Details'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-bold">
                      {isFa ? 'در حال بارگذاری اطلاعات پیمانکاران...' : 'Loading contractor analytics...'}
                    </td>
                  </tr>
                )}

                {!isLoading && companyAggregates.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Building2 className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        <span className="font-bold">
                          {hasActiveFilters
                            ? isFa
                              ? 'هیچ پیمانکار یا سابقه آموزشی مطابق با فیلترهای انتخابی یافت نشد.'
                              : 'No matching contractor records found.'
                            : isFa
                            ? 'هنوز سابقه آموزشی انفرادی برای شرکت‌ها و پیمانکاران ثبت نشده است.'
                            : 'No contractor training records yet.'}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  companyAggregates.map((agg, idx) => {
                    const isExpanded = expandedCompanyKey === agg.normalizedKey;
                    return (
                      <React.Fragment key={agg.normalizedKey}>
                        <tr
                          className={`transition-colors ${
                            isExpanded
                              ? 'bg-blue-50/50 dark:bg-blue-950/20'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="px-3 py-3.5 text-center font-mono tabular-nums text-slate-400 font-bold">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3.5 font-black text-slate-900 dark:text-slate-100">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCompanyKey(isExpanded ? null : agg.normalizedKey)
                              }
                              className="inline-flex items-center gap-2 text-right hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                            >
                              <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                              <span>{agg.companyName}</span>
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-mono tabular-nums font-black">
                              {formatNumber(agg.uniquePersonnelCount, 0)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-mono tabular-nums font-bold">
                              {formatNumber(agg.recordsCount, 0)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono tabular-nums font-black text-blue-600 dark:text-blue-400">
                            {formatNumber(agg.totalHours, 2)}
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono tabular-nums font-black text-cyan-700 dark:text-cyan-400">
                            {formatNumber(agg.averagePerCapitaHours, 2)}
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono tabular-nums font-bold text-slate-600 dark:text-slate-300">
                            {agg.lastTrainingDate || '-'}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCompanyKey(isExpanded ? null : agg.normalizedKey)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer"
                            >
                              <span>{isExpanded ? (isFa ? 'بستن' : 'Hide') : isFa ? 'مشاهده افراد' : 'View'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Personnel & Dates Breakdown Row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70 dark:bg-slate-950/50">
                            <td colSpan={8} className="p-4 md:p-5">
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                                  <div className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span>
                                      {isFa
                                        ? `جزئیات پرسنل آموزش‌دیده شرکت «${agg.companyName}»`
                                        : `Trained Personnel Breakdown — ${agg.companyName}`}
                                    </span>
                                  </div>
                                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                    <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-black">
                                      {agg.uniquePersonnelCount}
                                    </span>{' '}
                                    {isFa ? 'نفر یکتا در' : 'unique people across'}{' '}
                                    <span className="font-mono tabular-nums text-indigo-600 dark:text-indigo-400 font-black">
                                      {agg.recordsCount}
                                    </span>{' '}
                                    {isFa ? 'سابقه آموزشی' : 'records'}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                  {agg.personnelDetails.map((person) => (
                                    <div
                                      key={person.personKey}
                                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-2.5"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <div className="font-black text-slate-900 dark:text-white text-xs">
                                            {person.fullName}
                                          </div>
                                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                            {person.jobTitles.join(' / ')}
                                          </div>
                                        </div>
                                        <div className="text-left shrink-0">
                                          <div className="text-xs font-black font-mono tabular-nums text-blue-600 dark:text-blue-400">
                                            {formatNumber(person.totalHours, 2)}{' '}
                                            <span className="font-sans text-[10px] font-bold text-slate-500">
                                              {isFa ? 'ساعت' : 'hrs'}
                                            </span>
                                          </div>
                                          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                            <span className="font-mono tabular-nums">
                                              {person.recordsCount}
                                            </span>{' '}
                                            {isFa ? 'دوره ثبت‌شده' : 'courses'}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Individual sessions for this person */}
                                      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border-t border-slate-100 dark:border-slate-800 pt-2">
                                        {person.records.map((rec) => (
                                          <div
                                            key={rec.id}
                                            className="py-1.5 flex items-center justify-between gap-2 text-[11px]"
                                          >
                                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                                              <span className="inline-flex items-center gap-1 font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                                <CalendarDays className="w-3 h-3 text-slate-400" />
                                                {rec.trainingDate}
                                              </span>
                                              <span className="font-mono tabular-nums font-black text-blue-600 dark:text-blue-400">
                                                {formatNumber(rec.trainingHours, 2)}{' '}
                                                <span className="font-sans font-bold text-[10px]">
                                                  {isFa ? 'ساعت' : 'h'}
                                                </span>
                                              </span>
                                              {rec.courseTitle && (
                                                <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                                                  {rec.courseTitle}
                                                </span>
                                              )}
                                            </div>
                                            {canManageRecords && (
                                              <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                  type="button"
                                                  onClick={() => handleStartEdit(rec)}
                                                  className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors cursor-pointer"
                                                  title={isFa ? 'ویرایش رکورد' : 'Edit'}
                                                >
                                                  <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setPendingDelete(rec)}
                                                  className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                                                  title={isFa ? 'حذف رکورد' : 'Delete'}
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
              {companyAggregates.length > 0 && (
                <tfoot className="bg-slate-100 dark:bg-slate-950 border-t-2 border-slate-200 dark:border-slate-700 font-black text-slate-900 dark:text-white">
                  <tr>
                    <td colSpan={2} className="px-4 py-3.5">
                      {isFa ? 'جمع کل / میانگین تجمعی' : 'Grand Total / Aggregate Average'}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatNumber(globalStats.totalUniquePersonnel, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-indigo-700 dark:text-indigo-400">
                      {formatNumber(globalStats.totalRecords, 0)}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-blue-700 dark:text-blue-400">
                      {formatNumber(globalStats.totalHours, 2)}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-cyan-700 dark:text-cyan-400">
                      {formatNumber(globalStats.averagePerCapitaHours, 2)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* ===================================================================
            VIEW B: INDIVIDUAL TRAINING RECORDS LEDGER (Edit & Delete)
           =================================================================== */}
        {activeView === 'records' && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-right whitespace-nowrap">
              <thead className="bg-slate-100/90 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-black">
                <tr>
                  <th className="px-3 py-3.5 text-center w-12 text-slate-400">#</th>
                  <th className="px-4 py-3.5">{isFa ? 'شرکت / پیمانکار' : 'Company'}</th>
                  <th className="px-4 py-3.5">{isFa ? 'نام و نام خانوادگی پرسنل' : 'Personnel Name'}</th>
                  <th className="px-4 py-3.5">{isFa ? 'سمت شغلی' : 'Job Title'}</th>
                  <th className="px-4 py-3.5 text-center">{isFa ? 'ساعت آموزش (نفر)' : 'Hours'}</th>
                  <th className="px-4 py-3.5 text-center">{isFa ? 'تاریخ آموزش' : 'Date'}</th>
                  <th className="px-4 py-3.5">{isFa ? 'عنوان دوره / توضیحات' : 'Course / Notes'}</th>
                  <th className="px-4 py-3.5 text-center w-24">{isFa ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-bold">
                      {isFa
                        ? 'هیچ سابقه آموزشی انفرادی مطابق فیلتر فعلی یافت نشد.'
                        : 'No individual records found.'}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec, idx) => (
                    <tr
                      key={rec.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        editingRecordId === rec.id ? 'bg-amber-50/70 dark:bg-amber-950/25' : ''
                      }`}
                    >
                      <td className="px-3 py-3 text-center font-mono tabular-nums text-slate-400 font-bold">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-black text-slate-900 dark:text-slate-100">
                        {rec.companyName}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                        {rec.personnelFullName}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                        {rec.jobTitle}
                      </td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums font-black text-blue-600 dark:text-blue-400">
                        {formatNumber(rec.trainingHours, 2)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300">
                        {rec.trainingDate}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[260px] truncate">
                        {rec.courseTitle || rec.notes || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(rec)}
                            disabled={!canManageRecords}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors cursor-pointer disabled:opacity-40"
                            title={isFa ? 'ویرایش رکورد' : 'Edit'}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(rec)}
                            disabled={!canManageRecords}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer disabled:opacity-40"
                            title={isFa ? 'حذف رکورد' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredRecords.length > 0 && (
                <tfoot className="bg-slate-100 dark:bg-slate-950 border-t-2 border-slate-200 dark:border-slate-700 font-black text-slate-900 dark:text-white">
                  <tr>
                    <td colSpan={4} className="px-4 py-3">
                      {isFa ? 'جمع ساعات سوابق نمایش‌داده‌شده' : 'Total Hours (Displayed Records)'}{' '}
                      (<span className="font-mono tabular-nums">{filteredRecords.length}</span>{' '}
                      {isFa ? 'سابقه' : 'records'} /{' '}
                      <span className="font-mono tabular-nums">
                        {globalStats.totalUniquePersonnel}
                      </span>{' '}
                      {isFa ? 'نفر یکتا' : 'unique'})
                    </td>
                    <td className="px-4 py-3 text-center font-mono tabular-nums text-blue-700 dark:text-blue-400">
                      {formatNumber(globalStats.totalHours, 2)}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* ===================================================================
            VIEW C: PERSISTENT AUDIT LOG (سوابق تغییرات)
           =================================================================== */}
        {activeView === 'audit' && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-100/90 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-black">
                <tr>
                  <th className="px-4 py-3.5 w-28">{isFa ? 'عملیات' : 'Action'}</th>
                  <th className="px-4 py-3.5 w-28 text-center">{isFa ? 'تاریخ' : 'Date'}</th>
                  <th className="px-4 py-3.5 w-36">{isFa ? 'کاربر اقدام‌کننده' : 'Actor'}</th>
                  <th className="px-4 py-3.5 w-44">{isFa ? 'شرکت / پیمانکار' : 'Company'}</th>
                  <th className="px-4 py-3.5 w-40">{isFa ? 'پرسنل' : 'Personnel'}</th>
                  <th className="px-4 py-3.5">{isFa ? 'شرح تغییر' : 'Summary'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {auditHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-bold">
                      {isFa
                        ? 'هنوز سابقه تغییری برای بخش پیمانکاران ثبت نشده است.'
                        : 'No change history recorded yet.'}
                    </td>
                  </tr>
                ) : (
                  auditHistory.map((entry) => {
                    const badge = getActionBadgeConfig(entry.action, isFa);
                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[11px] font-bold ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono tabular-nums font-bold text-slate-600 dark:text-slate-300">
                          {entry.dateFa}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                          {entry.actorName}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                          {entry.companyName}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                          {entry.personnelFullName}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 leading-relaxed">
                          {entry.summary}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================================
          5. DELETE CONFIRMATION MODAL (No window.confirm)
         ===================================================================== */}
      {pendingDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="p-3 bg-red-100 dark:bg-red-950/60 rounded-2xl border border-red-200 dark:border-red-900/60">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 dark:text-white text-sm">
                  {isFa ? 'تایید حذف سابقه آموزشی' : 'Confirm Record Deletion'}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFa
                    ? 'این عملیات در تاریخچه تغییرات ثبت شده و آمارهای داشبورد بلافاصله به‌روزرسانی می‌شوند.'
                    : 'This action is logged in change history and metrics recalculate immediately.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 text-xs space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'پیمانکار:' : 'Company:'}</span>
                <span className="font-black text-slate-900 dark:text-white">{pendingDelete.companyName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'پرسنل:' : 'Personnel:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {pendingDelete.personnelFullName} ({pendingDelete.jobTitle})
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'ساعت و تاریخ:' : 'Hours & Date:'}</span>
                <span className="font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400">
                  {formatNumber(pendingDelete.trainingHours, 2)} ({pendingDelete.trainingDate})
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 cursor-pointer disabled:opacity-50"
              >
                {isDeleting
                  ? isFa
                    ? 'در حال حذف...'
                    : 'Deleting...'
                  : isFa
                  ? 'حذف قطعی رکورد'
                  : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          6. HIDDEN PRINTABLE A4 LANDSCAPE PDF TEMPLATE (Safe React JSX)
         ===================================================================== */}
      <div id="contractor-training-pdf-sheet" className="hidden" dir={isFa ? 'rtl' : 'ltr'}>
        <div className="p-4 text-slate-900 space-y-5">
          <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
            <div>
              <h1 className="text-lg font-black">
                {isFa
                  ? 'گزارش تجمعی و تفصیلی آمار آموزش شرکت‌ها و پیمانکاران'
                  : 'Contractor Training Analytics Report'}
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                {isFa ? 'سامانه مدیریت ایمنی، بهداشت و محیط زیست (HSE)' : 'HSE Management Platform'}
              </p>
            </div>
            <div className="text-xs text-left space-y-1">
              <div>
                {isFa ? 'تاریخ گزارش:' : 'Report Date:'}{' '}
                <span className="font-mono font-bold">{getShamsiToday()}</span>
              </div>
              <div>
                {isFa ? 'تعداد پیمانکاران:' : 'Contractors:'}{' '}
                <span className="font-mono font-bold">{globalStats.totalCompanies}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 text-center">
            <div className="border border-slate-300 rounded-lg p-2">
              <div className="text-[10px] text-slate-600">{isFa ? 'کل پیمانکاران' : 'Contractors'}</div>
              <div className="text-base font-black font-mono">{globalStats.totalCompanies}</div>
            </div>
            <div className="border border-slate-300 rounded-lg p-2">
              <div className="text-[10px] text-slate-600">{isFa ? 'پرسنل یکتا' : 'Unique Staff'}</div>
              <div className="text-base font-black font-mono">{globalStats.totalUniquePersonnel}</div>
            </div>
            <div className="border border-slate-300 rounded-lg p-2">
              <div className="text-[10px] text-slate-600">{isFa ? 'تعداد سوابق/دوره‌ها' : 'Records'}</div>
              <div className="text-base font-black font-mono">{globalStats.totalRecords}</div>
            </div>
            <div className="border border-slate-300 rounded-lg p-2">
              <div className="text-[10px] text-slate-600">{isFa ? 'مجموع ساعات' : 'Total Hours'}</div>
              <div className="text-base font-black font-mono">{formatNumber(globalStats.totalHours, 2)}</div>
            </div>
            <div className="border border-slate-300 rounded-lg p-2">
              <div className="text-[10px] text-slate-600">{isFa ? 'میانگین سرانه' : 'Avg Per Capita'}</div>
              <div className="text-base font-black font-mono">
                {formatNumber(globalStats.averagePerCapitaHours, 2)}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-black mb-2">
              {isFa ? '۱. خلاصه تجمعی به تفکیک پیمانکار' : '1. Contractor Summary'}
            </h2>
            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-2">#</th>
                  <th className="border border-slate-300 p-2 text-right">{isFa ? 'نام شرکت / پیمانکار' : 'Company'}</th>
                  <th className="border border-slate-300 p-2">{isFa ? 'پرسنل یکتا' : 'Unique'}</th>
                  <th className="border border-slate-300 p-2">{isFa ? 'تعداد سوابق' : 'Records'}</th>
                  <th className="border border-slate-300 p-2">{isFa ? 'مجموع ساعات' : 'Total Hours'}</th>
                  <th className="border border-slate-300 p-2">{isFa ? 'میانگین سرانه' : 'Avg/Person'}</th>
                  <th className="border border-slate-300 p-2">{isFa ? 'آخرین آموزش' : 'Last Date'}</th>
                </tr>
              </thead>
              <tbody>
                {companyAggregates.map((agg, idx) => (
                  <tr key={agg.normalizedKey}>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">{idx + 1}</td>
                    <td className="border border-slate-300 p-1.5 font-bold">{agg.companyName}</td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">
                      {agg.uniquePersonnelCount}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">
                      {agg.recordsCount}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono font-bold">
                      {formatNumber(agg.totalHours, 2)}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">
                      {formatNumber(agg.averagePerCapitaHours, 2)}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">
                      {agg.lastTrainingDate || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="text-sm font-black mb-2">
              {isFa ? '۲. فهرست تفصیلی سوابق آموزشی پرسنل پیمانکاران' : '2. Individual Records'}
            </h2>
            <table className="w-full text-[11px] border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-1.5">#</th>
                  <th className="border border-slate-300 p-1.5 text-right">{isFa ? 'پیمانکار' : 'Company'}</th>
                  <th className="border border-slate-300 p-1.5 text-right">{isFa ? 'نام و نام خانوادگی' : 'Name'}</th>
                  <th className="border border-slate-300 p-1.5 text-right">{isFa ? 'سمت شغلی' : 'Job Title'}</th>
                  <th className="border border-slate-300 p-1.5">{isFa ? 'ساعت' : 'Hours'}</th>
                  <th className="border border-slate-300 p-1.5">{isFa ? 'تاریخ آموزش' : 'Date'}</th>
                  <th className="border border-slate-300 p-1.5 text-right">{isFa ? 'عنوان دوره' : 'Course'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec, idx) => (
                  <tr key={rec.id}>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">{idx + 1}</td>
                    <td className="border border-slate-300 p-1.5 font-bold">{rec.companyName}</td>
                    <td className="border border-slate-300 p-1.5">{rec.personnelFullName}</td>
                    <td className="border border-slate-300 p-1.5">{rec.jobTitle}</td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono font-bold">
                      {formatNumber(rec.trainingHours, 2)}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">{rec.trainingDate}</td>
                    <td className="border border-slate-300 p-1.5">{rec.courseTitle || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
