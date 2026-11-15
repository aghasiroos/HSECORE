import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FlaskConical,
  Plus,
  Search,
  RefreshCw,
  Printer,
  Edit3,
  Trash2,
  Paperclip,
  History,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileWarning,
  X,
  Eye,
  Download,
  Lock,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { UserProfile } from '../../../types';
import { hasPermission, isUserAdmin } from '../../../utils/authHelper';
import { apiDb } from '../../../services/apiDatabaseClient';
import PdfDocumentViewer from '../../health-env/components/PdfDocumentViewer';
import { sdsApi } from '../sdsApi';
import {
  SdsAttachmentItem,
  SdsDashboardStats,
  SdsRecordItem,
} from '../types';
import {
  PHYSICAL_STATE_LABELS,
  SDS_STATUS_META,
  SIGNAL_WORD_META,
} from '../constants';
import { GhsPictogramIcon } from './GhsPictograms';
import { SdsFormModal } from './SdsFormModal';
import { SdsAttachmentsModal } from './SdsAttachmentsModal';
import { SdsRevisionHistoryModal } from './SdsRevisionHistoryModal';
import { SdsPrintSheetModal } from './SdsPrintSheetModal';

interface SdsSubmoduleProps {
  currentUser: UserProfile;
  language: 'fa' | 'en';
  orgUnits: string[];
}

const EMPTY_STATS: SdsDashboardStats = {
  total: 0,
  approvedOrPublished: 0,
  pendingApproval: 0,
  missingPrimaryPdf: 0,
  needsRevision: 0,
  hazardousCount: 0,
  totalAttachments: 0,
  obsoleteCount: 0,
};

export const SdsSubmodule: React.FC<SdsSubmoduleProps> = ({
  currentUser,
  language,
  orgUnits,
}) => {
  const isFa = language === 'fa';
  const isAdmin = isUserAdmin(currentUser);
  const roleKey = String(currentUser?.role || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  // RBAC permissions (reusing Documents permission module + manager role rules)
  const canView = isAdmin || hasPermission(currentUser, 'Documents', 'view');
  const canCreate = isAdmin || hasPermission(currentUser, 'Documents', 'create');
  const canEdit = isAdmin || hasPermission(currentUser, 'Documents', 'edit');
  const canDelete = isAdmin || hasPermission(currentUser, 'Documents', 'delete');
  const canPrint = isAdmin || hasPermission(currentUser, 'Documents', 'print') || canView;
  const canApprove =
    isAdmin ||
    hasPermission(currentUser, 'Documents', 'approve') ||
    ['ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'PROCESS_MANAGER'].includes(roleKey);

  // List & Dashboard State
  const [records, setRecords] = useState<SdsRecordItem[]>([]);
  const [stats, setStats] = useState<SdsDashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [casFilter, setCasFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [onlyNeedsRevision, setOnlyNeedsRevision] = useState(false);
  const [onlyMissingPdf, setOnlyMissingPdf] = useState(false);
  const [onlyHazardous, setOnlyHazardous] = useState(false);

  // Modals State
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SdsRecordItem | null>(null);
  const [attachmentsTarget, setAttachmentsTarget] = useState<SdsRecordItem | null>(null);
  const [historyTargetId, setHistoryTargetId] = useState<number | null>(null);
  const [printTarget, setPrintTarget] = useState<SdsRecordItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SdsRecordItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Quick Inline Primary PDF Preview State
  const [quickPreview, setQuickPreview] = useState<{
    record: SdsRecordItem;
    att: SdsAttachmentItem;
    blobUrl: string | null;
    loading: boolean;
    error?: string | null;
  } | null>(null);
  const quickBlobRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (quickBlobRef.current) {
        URL.revokeObjectURL(quickBlobRef.current);
        quickBlobRef.current = null;
      }
    };
  }, []);

  const fetchRecords = useCallback(
    async (showSpinner = false) => {
      if (!canView) {
        setLoading(false);
        return;
      }
      if (!hasLoadedOnceRef.current || showSpinner) {
        setLoading(true);
      }
      try {
        const res = await sdsApi.list({
          search: searchQuery.trim() || undefined,
          casNumber: casFilter.trim() || undefined,
          unitName: unitFilter !== 'ALL' ? unitFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          onlyNeedsRevision: onlyNeedsRevision || undefined,
          onlyMissingPdf: onlyMissingPdf || undefined,
          onlyHazardous: onlyHazardous || undefined,
        });
        setRecords(res.records || []);
        setStats(res.stats || EMPTY_STATS);
        hasLoadedOnceRef.current = true;
      } catch (err: any) {
        console.error('Error loading SDS records:', err);
        toast.error(err?.message || (isFa ? 'خطا در دریافت لیست SDSها' : 'Failed to load SDS list'));
      } finally {
        setLoading(false);
      }
    },
    [
      canView,
      searchQuery,
      casFilter,
      unitFilter,
      statusFilter,
      onlyNeedsRevision,
      onlyMissingPdf,
      onlyHazardous,
      isFa,
    ]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecords(false);
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchRecords]);

  useEffect(() => {
    const handleMutation = (e: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
      if (entity === 'sds' || entity === 'sds_records' || entity === 'sds_attachments') {
        fetchRecords(false);
      }
    };
    window.addEventListener('hse_data_mutated', handleMutation);
    return () => window.removeEventListener('hse_data_mutated', handleMutation);
  }, [fetchRecords]);

  const resetAllFilters = () => {
    setSearchQuery('');
    setCasFilter('');
    setUnitFilter('ALL');
    setStatusFilter('ALL');
    setOnlyNeedsRevision(false);
    setOnlyMissingPdf(false);
    setOnlyHazardous(false);
  };

  const hasActiveFilter =
    Boolean(searchQuery.trim()) ||
    Boolean(casFilter.trim()) ||
    unitFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    onlyNeedsRevision ||
    onlyMissingPdf ||
    onlyHazardous;

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setFormOpen(true);
  };

  const handleOpenEdit = async (rec: SdsRecordItem) => {
    try {
      const full = await sdsApi.getById(rec.id);
      setEditingRecord(full);
      setFormOpen(true);
    } catch {
      setEditingRecord(rec);
      setFormOpen(true);
    }
  };

  const handleOpenPrint = async (rec: SdsRecordItem) => {
    try {
      const full = await sdsApi.getById(rec.id);
      setPrintTarget(full);
    } catch {
      setPrintTarget(rec);
    }
  };

  const handleFormSaved = (saved: SdsRecordItem) => {
    setFormOpen(false);
    setEditingRecord(null);
    fetchRecords(false);
    if (attachmentsTarget?.id === saved.id) {
      setAttachmentsTarget(saved);
    }
  };

  const handleStartRevisionFromForm = async (lockedRecord: SdsRecordItem) => {
    const toastId = toast.loading(
      isFa ? 'در حال ایجاد نسخه بازنگری جدید...' : 'Creating new revision...'
    );
    try {
      const updated = await sdsApi.createRevision(lockedRecord.id, {
        changeSummary: 'ایجاد نسخه بازنگری جدید جهت بروزرسانی اطلاعات و مشخصات ایمنی',
        triggerReason: 'بازنگری دستی توسط کاربر از فرم مشخصات SDS',
      });
      toast.success(
        isFa
          ? `نسخه جدید Rev.${updated.revisionNumber} در وضعیت پیش‌نویس آماده ویرایش شد.`
          : `Revision ${updated.revisionNumber} created.`,
        { id: toastId }
      );
      setEditingRecord(updated);
      fetchRecords(false);
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ایجاد بازنگری جدید', { id: toastId });
    }
  };

  const handleRecordUpdatedFromChildModal = (updated: SdsRecordItem) => {
    fetchRecords(false);
    if (attachmentsTarget?.id === updated.id) {
      setAttachmentsTarget(updated);
    }
    if (editingRecord?.id === updated.id) {
      setEditingRecord(updated);
    }
  };

  const handleQuickPreviewPrimaryPdf = async (rec: SdsRecordItem) => {
    const primaryPdf =
      rec.attachments?.find(
        (a) => a.attachmentRole === 'PRIMARY_SDS_PDF' && a.isPrimary
      ) ||
      rec.attachments?.find((a) => a.attachmentRole === 'PRIMARY_SDS_PDF') ||
      rec.attachments?.find((a) => a.mimeType === 'application/pdf');

    if (!primaryPdf) {
      setAttachmentsTarget(rec);
      return;
    }

    if (quickBlobRef.current) {
      URL.revokeObjectURL(quickBlobRef.current);
      quickBlobRef.current = null;
    }

    setQuickPreview({
      record: rec,
      att: primaryPdf,
      blobUrl: null,
      loading: true,
      error: null,
    });

    const blobUrl = await apiDb.fetchFileBlobUrl(primaryPdf.fileId, primaryPdf.mimeType);
    if (!blobUrl) {
      setQuickPreview({
        record: rec,
        att: primaryPdf,
        blobUrl: null,
        loading: false,
        error: isFa
          ? 'فایل PDF در سرور قابل بارگذاری نبود. می‌توانید از بخش فایل‌های پیوست وضعیت فایل را بررسی کنید.'
          : 'Failed to load PDF file.',
      });
      return;
    }

    quickBlobRef.current = blobUrl;
    setQuickPreview({
      record: rec,
      att: primaryPdf,
      blobUrl,
      loading: false,
      error: null,
    });
  };

  const closeQuickPreview = () => {
    if (quickBlobRef.current) {
      URL.revokeObjectURL(quickBlobRef.current);
      quickBlobRef.current = null;
    }
    setQuickPreview(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !canDelete) return;
    setDeleting(true);
    try {
      await sdsApi.remove(deleteTarget.id);
      toast.success(
        isFa
          ? `برگه SDS ماده «${deleteTarget.materialNameFa}» با موفقیت حذف شد.`
          : 'SDS deleted.'
      );
      setDeleteTarget(null);
      fetchRecords(false);
    } catch (err: any) {
      toast.error(err?.message || (isFa ? 'خطا در حذف SDS' : 'Failed to delete SDS'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5" dir={isFa ? 'rtl' : 'ltr'}>
      {/* ── Header Strip ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {isFa
                  ? 'برگه‌های اطلاعات ایمنی مواد شیمیایی (SDS)'
                  : 'Chemical Safety Data Sheets (SDS)'}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isFa
                  ? 'مخزن یکپارچه مواد شیمیایی مجتمع پتروشیمی رجال · ساختار استاندارد ۱۶ بخشی GHS / ISO 11014 · کنترل نسخه و پیوست‌های چندگانه'
                  : 'Integrated Chemical Material Repository · 16-Section GHS / ISO 11014 · Lifecycle & Revision Control'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => fetchRecords(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
              <span>{isFa ? 'بروزرسانی' : 'Refresh'}</span>
            </button>

            {canCreate && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <Plus className="w-4 h-4" />
                <span>{isFa ? 'ثبت ماده شیمیایی و SDS جدید' : 'Register New Chemical / SDS'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ── 7 Interactive KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 mt-5">
          {/* 1. Total */}
          <button
            type="button"
            onClick={resetAllFilters}
            className={`text-right p-3 rounded-xl border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              !hasActiveFilter
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                : 'bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-bold opacity-80 truncate">
              {isFa ? 'کل مواد ثبت‌شده' : 'Total Chemicals'}
            </div>
            <div className="text-xl font-bold font-mono tabular-nums mt-1">{stats.total}</div>
          </button>

          {/* 2. Approved / Published */}
          <button
            type="button"
            onClick={() => {
              setOnlyMissingPdf(false);
              setOnlyNeedsRevision(false);
              setOnlyHazardous(false);
              setStatusFilter(
                statusFilter === 'APPROVED_OR_PUBLISHED' ? 'ALL' : 'APPROVED_OR_PUBLISHED'
              );
            }}
            className={`text-right p-3 rounded-xl border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              statusFilter === 'APPROVED_OR_PUBLISHED'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-700 ring-1 ring-emerald-500/40'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              <span className="truncate">{isFa ? 'تأیید و منتشرشده' : 'Approved/Pub'}</span>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {stats.approvedOrPublished}
            </div>
          </button>

          {/* 3. Pending Approval */}
          <button
            type="button"
            onClick={() => {
              setOnlyMissingPdf(false);
              setOnlyNeedsRevision(false);
              setOnlyHazardous(false);
              setStatusFilter(
                statusFilter === 'PENDING_APPROVAL' ? 'ALL' : 'PENDING_APPROVAL'
              );
            }}
            className={`text-right p-3 rounded-xl border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
              statusFilter === 'PENDING_APPROVAL'
                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-700 ring-1 ring-amber-500/40'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
              <span className="truncate">{isFa ? 'در انتظار تأیید' : 'Pending Review'}</span>
              <Clock className="w-3.5 h-3.5 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {stats.pendingApproval}
            </div>
          </button>

          {/* 4. Missing Primary PDF */}
          <button
            type="button"
            onClick={() => setOnlyMissingPdf((v) => !v)}
            className={`text-right p-3 rounded-xl border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
              onlyMissingPdf
                ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-400 dark:border-rose-700 ring-1 ring-rose-500/40'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400">
              <span className="truncate">{isFa ? 'فاقد PDF اصلی' : 'Missing PDF'}</span>
              <FileWarning className="w-3.5 h-3.5 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {stats.missingPrimaryPdf}
            </div>
          </button>

          {/* 5. Needs Revision */}
          <button
            type="button"
            onClick={() => setOnlyNeedsRevision((v) => !v)}
            className={`text-right p-3 rounded-xl border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
              onlyNeedsRevision
                ? 'bg-orange-50 dark:bg-orange-950/50 border-orange-400 dark:border-orange-700 ring-1 ring-orange-500/40'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-orange-300'
            }`}
          >
            <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-orange-700 dark:text-orange-400">
              <span className="truncate">{isFa ? 'نیازمند بازنگری' : 'Needs Revision'}</span>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {stats.needsRevision}
            </div>
          </button>

          {/* 6. GHS Hazardous */}
          <button
            type="button"
            onClick={() => setOnlyHazardous((v) => !v)}
            className={`text-right p-3 rounded-xl border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
              onlyHazardous
                ? 'bg-red-50 dark:bg-red-950/50 border-red-400 dark:border-red-700 ring-1 ring-red-500/40'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-red-300'
            }`}
          >
            <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-red-700 dark:text-red-400">
              <span className="truncate">{isFa ? 'خطرناک (GHS)' : 'Hazardous (GHS)'}</span>
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {stats.hazardousCount}
            </div>
          </button>

          {/* 7. Total Attachments */}
          <div className="text-right p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-sky-700 dark:text-sky-400">
              <span className="truncate">{isFa ? 'کل پیوست‌ها' : 'Total Files'}</span>
              <Paperclip className="w-3.5 h-3.5 shrink-0" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {stats.totalAttachments}
            </div>
          </div>
        </div>
      </div>

      {/* ── Search & Multi-Facet Filter Bar ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* General search */}
          <div className="md:col-span-5 relative">
            <Search
              className={`w-4 h-4 text-slate-400 absolute top-3 ${isFa ? 'right-3.5' : 'left-3.5'}`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isFa
                  ? 'جست‌وجوی نام فارسی/انگلیسی ماده، نام تجاری، UN، شماره سند یا سازنده...'
                  : 'Search material name, trade name, UN, doc number...'
              }
              className={`w-full ${
                isFa ? 'pr-10 pl-8' : 'pl-10 pr-8'
              } py-2.5 text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-teal-500 outline-none text-slate-800 dark:text-slate-100`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`absolute top-2.5 ${
                  isFa ? 'left-3' : 'right-3'
                } text-slate-400 hover:text-slate-600 cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* CAS Number filter */}
          <div className="md:col-span-2">
            <input
              type="text"
              dir="ltr"
              value={casFilter}
              onChange={(e) => setCasFilter(e.target.value)}
              placeholder="CAS Number (e.g. 67-56-1)"
              className="w-full px-3 py-2.5 text-xs font-mono font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-teal-500 outline-none text-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Unit filter */}
          <div className="md:col-span-3">
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-teal-500 outline-none text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">{isFa ? 'همه واحدهای مصرف‌کننده / مجتمع' : 'All Units'}</option>
              {orgUnits.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-teal-500 outline-none text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">{isFa ? 'همه وضعیت‌ها' : 'All Statuses'}</option>
              <option value="PUBLISHED">{SDS_STATUS_META.PUBLISHED.fa}</option>
              <option value="APPROVED">{SDS_STATUS_META.APPROVED.fa}</option>
              <option value="UNDER_REVIEW">{SDS_STATUS_META.UNDER_REVIEW.fa}</option>
              <option value="DRAFT">{SDS_STATUS_META.DRAFT.fa}</option>
              <option value="OBSOLETE">{SDS_STATUS_META.OBSOLETE.fa}</option>
              <option value="APPROVED_OR_PUBLISHED">
                {isFa ? 'تأییدشده + منتشرشده' : 'Approved + Published'}
              </option>
              <option value="PENDING_APPROVAL">
                {isFa ? 'پیش‌نویس + در انتظار تأیید' : 'Draft + Under Review'}
              </option>
            </select>
          </div>
        </div>

        {/* Toggle Filter Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyNeedsRevision((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                onlyNeedsRevision
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-400'
              }`}
            >
              {isFa ? 'فقط موارد نیازمند بازنگری' : 'Only Needs Revision'}
            </button>

            <button
              type="button"
              onClick={() => setOnlyMissingPdf((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                onlyMissingPdf
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-400'
              }`}
            >
              {isFa ? 'فقط فاقد PDF اصلی' : 'Only Missing PDF'}
            </button>

            <button
              type="button"
              onClick={() => setOnlyHazardous((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                onlyHazardous
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-red-400'
              }`}
            >
              {isFa ? 'فقط مواد دارای طبقه‌بندی GHS' : 'Only Hazardous'}
            </button>
          </div>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>{isFa ? 'پاک‌کردن فیلترها' : 'Reset Filters'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── SDS Repository Table ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-xs font-bold text-slate-500">
              {isFa
                ? 'در حال فراخوانی برگه‌های اطلاعات ایمنی (SDS) از سرور...'
                : 'Loading Safety Data Sheets...'}
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {hasActiveFilter
                ? isFa
                  ? 'هیچ برگه SDS مطابق با فیلترهای انتخابی یافت نشد'
                  : 'No matching SDS records found'
                : isFa
                ? 'هنوز هیچ ماده شیمیایی یا برگه SDS در سامانه ثبت نشده است'
                : 'No chemical SDS records registered yet'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
              {isFa
                ? 'با کلیک بر روی دکمه «ثبت ماده شیمیایی و SDS جدید»، می‌توانید مشخصات شناسنامه‌ای، شماره CAS، علائم GHS و ۱۶ بخش کامل برگه ایمنی به‌همراه فایل PDF مرجع را ثبت نمایید.'
                : 'Click "Register New Chemical / SDS" to add GHS classification, 16 sections, and PDF attachments.'}
            </p>
            {canCreate && !hasActiveFilter && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isFa ? 'ثبت اولین برگه SDS' : 'Create First SDS'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4">{isFa ? 'ماده شیمیایی / مشخصات' : 'Material Name'}</th>
                  <th className="py-3 px-3">{isFa ? 'شماره سند و نسخه' : 'Doc & Rev'}</th>
                  <th className="py-3 px-3">{isFa ? 'CAS / UN' : 'CAS / UN'}</th>
                  <th className="py-3 px-3">{isFa ? 'واحد و محل انبارش' : 'Unit & Storage'}</th>
                  <th className="py-3 px-3">{isFa ? 'علائم خطر GHS' : 'GHS Hazards'}</th>
                  <th className="py-3 px-3">{isFa ? 'پیوست / PDF اصلی' : 'PDF & Files'}</th>
                  <th className="py-3 px-3">{isFa ? 'وضعیت و بازنگری' : 'Lifecycle'}</th>
                  <th className="py-3 px-4 text-left">{isFa ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {records.map((rec) => {
                  const statusMeta = SDS_STATUS_META[rec.status] || SDS_STATUS_META.DRAFT;
                  const signalMeta =
                    SIGNAL_WORD_META[rec.ghsData?.signalWord || 'NONE'] || SIGNAL_WORD_META.NONE;
                  const physMeta =
                    PHYSICAL_STATE_LABELS[rec.physicalState] || PHYSICAL_STATE_LABELS.LIQUID;
                  const pictograms = rec.ghsData?.pictograms || [];
                  const isLocked = rec.status === 'APPROVED' || rec.status === 'PUBLISHED';

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Material Name FA/EN + Trade */}
                      <td className="py-3.5 px-4 max-w-[260px]">
                        <div className="space-y-0.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPrint(rec)}
                            className="font-bold text-slate-900 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-400 text-right cursor-pointer transition-colors block truncate max-w-full"
                            title={rec.materialNameFa}
                          >
                            {rec.materialNameFa}
                          </button>
                          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate" dir="ltr">
                            {rec.materialNameEn}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span>{isFa ? physMeta.fa : physMeta.en}</span>
                            {rec.tradeName && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate max-w-[140px]">{rec.tradeName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Document Number & Revision */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                          {rec.documentNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5 flex items-center gap-1">
                          <span>Rev.{rec.revisionNumber}</span>
                          {isLocked && (
                            <span title={isFa ? 'نسخه مصوب قفل‌شده' : 'Locked Approved'}>
                              <Lock className="w-3 h-3 text-slate-400 inline" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* CAS & UN */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-800 dark:text-slate-100 tabular-nums" dir="ltr">
                          {rec.casNumber || '—'}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums mt-0.5" dir="ltr">
                          {rec.unNumber ? `UN ${rec.unNumber}` : 'UN —'}
                        </div>
                      </td>

                      {/* Unit & Storage */}
                      <td className="py-3.5 px-3 max-w-[180px]">
                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {rec.unitName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {rec.storageLocation || rec.manufacturer || '—'}
                        </div>
                      </td>

                      {/* GHS Pictograms & Signal Word */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col gap-1">
                          {pictograms.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {pictograms.slice(0, 4).map((code) => (
                                <GhsPictogramIcon key={code} code={code} size={26} />
                              ))}
                              {pictograms.length > 4 && (
                                <span className="text-[11px] font-mono font-bold text-slate-500 tabular-nums">
                                  +{pictograms.length - 4}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {isFa ? 'بدون پیکتوگرام' : 'No Pictograms'}
                            </span>
                          )}
                          {rec.ghsData?.signalWord && rec.ghsData.signalWord !== 'NONE' && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border w-fit ${signalMeta.badgeClass}`}
                            >
                              {isFa ? signalMeta.fa : signalMeta.en}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Attachments / Primary PDF */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          {rec.hasPrimaryPdf ? (
                            <button
                              type="button"
                              onClick={() => handleQuickPreviewPrimaryPdf(rec)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition cursor-pointer"
                              title={isFa ? 'مشاهده سریع فایل PDF اصلی' : 'Preview Primary PDF'}
                            >
                              <Eye className="w-3 h-3" />
                              <span>{isFa ? 'PDF اصلی موجود' : 'Primary PDF'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAttachmentsTarget(rec)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] font-bold hover:bg-rose-100 dark:hover:bg-rose-900/60 transition cursor-pointer"
                            >
                              <FileWarning className="w-3 h-3" />
                              <span>{isFa ? 'فاقد PDF اصلی' : 'No PDF'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setAttachmentsTarget(rec)}
                            className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1 cursor-pointer tabular-nums"
                          >
                            <Paperclip className="w-3 h-3" />
                            <span>
                              {isFa
                                ? `${rec.attachmentCount} فایل پیوست`
                                : `${rec.attachmentCount} files`}
                            </span>
                          </button>
                        </div>
                      </td>

                      {/* Lifecycle Status & Revision Alert */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${statusMeta.badgeClass}`}
                          >
                            {isFa ? statusMeta.fa : statusMeta.en}
                          </span>
                          {rec.needsRevision && (
                            <button
                              type="button"
                              onClick={() => setHistoryTargetId(rec.id)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-700 dark:text-orange-300 hover:underline cursor-pointer"
                              title={rec.reviewAlertMessage || rec.revisionTriggerReason}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{isFa ? 'نیازمند بازنگری' : 'Needs Revision'}</span>
                            </button>
                          )}
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                            {rec.lastRevisionDate || rec.preparedDate}
                          </span>
                        </div>
                      </td>

                      {/* Row Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {canPrint && (
                            <button
                              type="button"
                              onClick={() => handleOpenPrint(rec)}
                              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 hover:text-teal-700 dark:hover:text-teal-300 transition cursor-pointer"
                              title={isFa ? 'مشاهده کامل و چاپ برگه A4 استاندارد' : 'View & Print A4'}
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setAttachmentsTarget(rec)}
                            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-950/50 hover:text-sky-700 dark:hover:text-sky-300 transition cursor-pointer"
                            title={isFa ? 'مدیریت فایل‌های پیوست و PDF' : 'Manage Attachments'}
                          >
                            <Paperclip className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setHistoryTargetId(rec.id)}
                            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300 transition cursor-pointer"
                            title={
                              isFa
                                ? 'تاریخچه نسخه‌ها، مقایسه و تأیید/انتشار'
                                : 'Revisions & Lifecycle'
                            }
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(rec)}
                              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-700 dark:hover:text-amber-300 transition cursor-pointer"
                              title={
                                isLocked
                                  ? isFa
                                    ? 'مشاهده / شروع بازنگری جدید'
                                    : 'View / Start New Revision'
                                  : isFa
                                  ? 'ویرایش ۱۶ بخش SDS'
                                  : 'Edit SDS'
                              }
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(rec)}
                              className="p-2 rounded-lg text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                              title={isFa ? 'حذف برگه SDS' : 'Delete SDS'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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

      {/* ── MODAL 1: 16-Section Create / Edit SDS Form ── */}
      <SdsFormModal
        isOpen={formOpen}
        editingRecord={editingRecord}
        orgUnits={orgUnits}
        isFa={isFa}
        onClose={() => {
          setFormOpen(false);
          setEditingRecord(null);
        }}
        onSaved={handleFormSaved}
        onStartRevision={handleStartRevisionFromForm}
      />

      {/* ── MODAL 2: Multi-File Attachments Manager ── */}
      <SdsAttachmentsModal
        record={attachmentsTarget}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        isFa={isFa}
        language={language}
        onClose={() => setAttachmentsTarget(null)}
        onRecordUpdated={handleRecordUpdatedFromChildModal}
      />

      {/* ── MODAL 3: Lifecycle, Approvals & Side-by-Side Version Comparison ── */}
      <SdsRevisionHistoryModal
        recordId={historyTargetId}
        canEdit={canEdit}
        canApprove={canApprove}
        isFa={isFa}
        onClose={() => setHistoryTargetId(null)}
        onRecordUpdated={handleRecordUpdatedFromChildModal}
        onOpenFormForEdit={(updated) => {
          setHistoryTargetId(null);
          setEditingRecord(updated);
          setFormOpen(true);
        }}
      />

      {/* ── MODAL 4: Standalone A4 Print Sheet ── */}
      <SdsPrintSheetModal
        record={printTarget}
        defaultLanguage={language}
        canEdit={canEdit}
        onClose={() => setPrintTarget(null)}
        onEdit={(rec) => {
          setPrintTarget(null);
          handleOpenEdit(rec);
        }}
      />

      {/* ── MODAL 5: Quick Inline Primary PDF Preview ── */}
      {quickPreview && (
        <div className="fixed inset-0 z-[10065] bg-slate-950/80 backdrop-blur-xs flex flex-col p-3 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {quickPreview.record.materialNameFa} — {quickPreview.att.originalName}
                </h4>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {quickPreview.record.documentNumber} · Rev.{quickPreview.record.revisionNumber}
                  {quickPreview.record.casNumber ? ` · CAS ${quickPreview.record.casNumber}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const rec = quickPreview.record;
                  closeQuickPreview();
                  setAttachmentsTarget(rec);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>{isFa ? 'سایر پیوست‌ها' : 'All Attachments'}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  apiDb.downloadFileById(quickPreview.att.fileId, quickPreview.att.originalName)
                }
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isFa ? 'دانلود PDF' : 'Download'}</span>
              </button>
              <button
                type="button"
                onClick={closeQuickPreview}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-slate-600 hover:text-rose-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex items-center justify-center">
            {quickPreview.loading ? (
              <div className="text-center space-y-2">
                <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-xs font-bold text-slate-500">
                  {isFa ? 'در حال بارگذاری سند PDF...' : 'Loading PDF...'}
                </div>
              </div>
            ) : quickPreview.error ? (
              <div className="p-8 text-center max-w-md space-y-2">
                <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
                <p className="text-xs font-bold text-rose-600">{quickPreview.error}</p>
              </div>
            ) : quickPreview.blobUrl ? (
              <div className="w-full h-full">
                <PdfDocumentViewer
                  fileId={quickPreview.att.fileId}
                  fileData={quickPreview.blobUrl}
                  fileName={quickPreview.att.originalName}
                  displayName={`${quickPreview.record.materialNameFa} — ${quickPreview.att.originalName}`}
                  language={language}
                  onDownload={() => {
                    void apiDb.downloadFileById(
                      quickPreview.att.fileId,
                      quickPreview.att.originalName
                    );
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── MODAL 6: Delete SDS Confirmation Modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[10070] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isFa ? 'تأیید حذف برگه اطلاعات ایمنی (SDS)' : 'Confirm SDS Deletion'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {isFa
                  ? `آیا از حذف برگه SDS ماده «${deleteTarget.materialNameFa}» (${deleteTarget.documentNumber}${
                      deleteTarget.casNumber ? ` · CAS: ${deleteTarget.casNumber}` : ''
                    }) از مخزن شیمیایی سامانه اطمینان دارید؟`
                  : `Are you sure you want to delete SDS "${deleteTarget.materialNameEn}"?`}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isFa
                  ? 'عملیات حذف در لاگ ممیزی عملیاتی سامانه ثبت خواهد شد.'
                  : 'This action will be recorded in the operational audit log.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                {deleting
                  ? isFa
                    ? 'در حال حذف...'
                    : 'Deleting...'
                  : isFa
                  ? 'بله، حذف شود'
                  : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SdsSubmodule;
