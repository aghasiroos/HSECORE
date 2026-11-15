import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  Upload,
  Search,
  Download,
  Eye,
  Edit3,
  Trash2,
  History,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderOpen,
  ClipboardList,
  ShieldCheck,
  X,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Paperclip,
  Printer,
  Archive,
  ArchiveRestore,
  Link2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import moment from 'moment-jalaali';
import { UserProfile } from '../../../types';
import { hasPermission, isUserAdmin, addAuditLog } from '../../../utils/authHelper';
import { apiDb } from '../../../services/apiDatabaseClient';
import PdfDocumentViewer from '../../health-env/components/PdfDocumentViewer';
import { formatFileSize } from '../../../utils/fileHelpers';
import {
  CERTIFICATE_TYPES,
  DocumentVersionItem,
  evaluateDocumentExpiry,
  FORM_HSE_DOMAINS,
  HseDocumentCategory,
  HseDocumentItem,
  OTHER_TOPIC_CATEGORIES,
  PROMULGATION_STATUS_LABELS,
} from '../types';
import { DocumentFormModal, EquipmentSuggestion } from './DocumentFormModal';
import { DocumentAttachmentsModal } from './DocumentAttachmentsModal';
import { DocumentPrintModal } from './DocumentPrintModal';

interface DocumentCategoryWorkspaceProps {
  category: HseDocumentCategory;
  documents: HseDocumentItem[];
  loading: boolean;
  orgUnits: string[];
  equipmentOptions: EquipmentSuggestion[];
  currentUser: UserProfile;
  language: 'fa' | 'en';
  onRefresh: (forceSpinner?: boolean) => Promise<void> | void;
}

const TAB_CONFIG: Record<
  HseDocumentCategory,
  {
    titleFa: string;
    titleEn: string;
    subtitleFa: string;
    uploadBtnFa: string;
    emptyFa: string;
    icon: any;
    accentText: string;
    accentBg: string;
    accentBtn: string;
  }
> = {
  ORG_PROCEDURES: {
    titleFa: 'دستورالعمل‌ها و روش‌های اجرایی سازمانی',
    titleEn: 'Organizational Instructions & Procedures',
    subtitleFa:
      'مدیریت متمرکز دستورالعمل‌ها، روش‌های اجرایی (SOP)، کد بازنگری، مسئولین تهیه/تأیید و وضعیت ابلاغ مستندات سازمانی',
    uploadBtnFa: 'ثبت و بارگذاری دستورالعمل جدید',
    emptyFa: 'هنوز هیچ دستورالعمل یا روش اجرایی در این بخش ثبت نشده است.',
    icon: FileText,
    accentText: 'text-sky-600 dark:text-sky-400',
    accentBg: 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800',
    accentBtn: 'bg-sky-600 hover:bg-sky-700',
  },
  EQUIPMENT_CERTIFICATES: {
    titleFa: 'گواهینامه‌ها و سرتیفیکیت ماشین‌آلات و تجهیزات',
    titleEn: 'Machinery & Equipment Certificates',
    subtitleFa:
      'پایش تاریخ اعتبار، هشدار انقضای کمتر از ۳۰ روز، شرکت بازرسی‌کننده، گزارش‌های آزمون فنی و اتصال به شناسنامه تجهیزات',
    uploadBtnFa: 'ثبت گواهینامه و سرتیفیکیت جدید',
    emptyFa: 'هنوز هیچ گواهینامه یا سرتیفیکیتی برای تجهیزات ثبت نشده است.',
    icon: ShieldCheck,
    accentText: 'text-emerald-600 dark:text-emerald-400',
    accentBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
    accentBtn: 'bg-emerald-600 hover:bg-emerald-700',
  },
  ORG_FORMS_CHECKLISTS: {
    titleFa: 'فرم‌ها و چک‌لیست‌های سازمانی',
    titleEn: 'Organizational Forms & Checklists',
    subtitleFa:
      'مخزن فرم‌های مصوب HSE با دانلود مستقیم فایل خام (Word/Excel)، نسخه PDF قابل چاپ، سوابق تکمیل‌شده و کنترل بازنگری',
    uploadBtnFa: 'بارگذاری فرم / چک‌لیست جدید',
    emptyFa: 'هنوز هیچ فرم یا چک‌لیست سازمانی در این بخش ثبت نشده است.',
    icon: ClipboardList,
    accentText: 'text-amber-600 dark:text-amber-400',
    accentBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
    accentBtn: 'bg-amber-600 hover:bg-amber-700',
  },
  OTHER_HSE_DOCS: {
    titleFa: 'سایر مستندات مرتبط با HSE',
    titleEn: 'Other HSE Related Documents',
    subtitleFa:
      'آرشیو استانداردهای مرجع (NFPA، ISO، ملی)، بخشنامه‌ها و ابلاغیه‌ها، گزارش‌های تخصصی و مستندات چندفایلی PDF',
    uploadBtnFa: 'ثبت و بارگذاری مستند جدید',
    emptyFa: 'هنوز هیچ مستندی در بخش سایر مستندات مرتبط با HSE ثبت نشده است.',
    icon: FolderOpen,
    accentText: 'text-violet-600 dark:text-violet-400',
    accentBg: 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800',
    accentBtn: 'bg-violet-600 hover:bg-violet-700',
  },
};

export const DocumentCategoryWorkspace: React.FC<DocumentCategoryWorkspaceProps> = ({
  category,
  documents,
  loading,
  orgUnits,
  equipmentOptions,
  currentUser,
  language,
  onRefresh,
}) => {
  const isFa = language === 'fa';
  const isAdmin = isUserAdmin(currentUser);
  const canView = isAdmin || hasPermission(currentUser, 'Documents', 'view');
  const canCreate = isAdmin || hasPermission(currentUser, 'Documents', 'create');
  const canEdit = isAdmin || hasPermission(currentUser, 'Documents', 'edit');
  const canDelete = isAdmin || hasPermission(currentUser, 'Documents', 'delete');
  const canPrint = isAdmin || hasPermission(currentUser, 'Documents', 'print') || canView;

  const cfg = TAB_CONFIG[category];
  const TabIcon = cfg.icon;

  // Filters (tab-local, zero category dropdown)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ACTIVE');

  // Facet filters per category
  const [promulgationFilter, setPromulgationFilter] = useState<string>('ALL');
  const [certTypeFilter, setCertTypeFilter] = useState<string>('ALL');
  const [certHealthFilter, setCertHealthFilter] = useState<
    'ALL' | 'VALID' | 'EXPIRING' | 'EXPIRED' | 'PENDING_RENEWAL'
  >('ALL');
  const [domainFilter, setDomainFilter] = useState<string>('ALL');
  const [topicFilter, setTopicFilter] = useState<string>('ALL');
  const [multiPdfOnly, setMultiPdfOnly] = useState<boolean>(false);

  // Modals State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<HseDocumentItem | null>(null);
  const [attachmentsModalDocId, setAttachmentsModalDocId] = useState<string | null>(null);
  const [printDoc, setPrintDoc] = useState<HseDocumentItem | null>(null);
  const [historyDoc, setHistoryDoc] = useState<HseDocumentItem | null>(null);
  const [deleteTargetDoc, setDeleteTargetDoc] = useState<HseDocumentItem | null>(null);

  // Replace Version Modal
  const [replaceTargetDoc, setReplaceTargetDoc] = useState<HseDocumentItem | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceChangeNote, setReplaceChangeNote] = useState('');
  const [replaceIssueDate, setReplaceIssueDate] = useState('');
  const [replaceExpiryDate, setReplaceExpiryDate] = useState('');
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  // Preview Modal
  const [previewTarget, setPreviewTarget] = useState<{
    title: string;
    subtitle: string;
    fileId: string;
    originalName: string;
    mimeType: string;
    versionBadge?: string;
    docForVersions?: HseDocumentItem;
    blobUrl: string | null;
    loading: boolean;
    error?: string | null;
  } | null>(null);
  const previewReqRef = useRef(0);
  const activeBlobUrlRef = useRef<string | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);

  // Reset tab-specific facet filters when switching tabs
  useEffect(() => {
    setSearchQuery('');
    setSelectedUnit('ALL');
    setStatusFilter('ACTIVE');
    setPromulgationFilter('ALL');
    setCertTypeFilter('ALL');
    setCertHealthFilter('ALL');
    setDomainFilter('ALL');
    setTopicFilter('ALL');
    setMultiPdfOnly(false);
  }, [category]);

  useEffect(() => {
    if (previewTarget?.blobUrl && previewTarget.blobUrl !== activeBlobUrlRef.current) {
      if (activeBlobUrlRef.current) URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = previewTarget.blobUrl;
    } else if (!previewTarget && activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
  }, [previewTarget]);

  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, []);

  const categoryDocs = useMemo(
    () => documents.filter((d) => d.category === category),
    [documents, category]
  );

  const unitOptions = useMemo(() => {
    const s = new Set<string>(orgUnits);
    categoryDocs.forEach((d) => {
      if (d.unitName && d.unitName.trim()) s.add(d.unitName.trim());
    });
    return Array.from(s);
  }, [orgUnits, categoryDocs]);

  const activeAttachmentsDoc = useMemo(() => {
    if (!attachmentsModalDocId) return null;
    return categoryDocs.find((d) => d.documentId === attachmentsModalDocId) || null;
  }, [attachmentsModalDocId, categoryDocs]);

  // ── Category-Specific Dashboard KPIs ──
  const stats = useMemo(() => {
    const activeDocs = categoryDocs.filter((d) => d.status === 'ACTIVE');
    if (category === 'ORG_PROCEDURES') {
      const promulgated = activeDocs.filter(
        (d) => (d.tabMetadata?.promulgationStatus || 'PROMULGATED') === 'PROMULGATED'
      ).length;
      const inProgress = activeDocs.filter(
        (d) =>
          d.tabMetadata?.promulgationStatus === 'UNDER_REVISION' ||
          d.tabMetadata?.promulgationStatus === 'DRAFT'
      ).length;
      const archivedOrObsolete = categoryDocs.filter(
        (d) => d.status === 'ARCHIVED' || d.tabMetadata?.promulgationStatus === 'OBSOLETE'
      ).length;
      const withAttachments = categoryDocs.filter(
        (d) => (d.extraAttachments?.length || 0) > 0
      ).length;
      return {
        total: categoryDocs.length,
        promulgated,
        inProgress,
        archivedOrObsolete,
        withAttachments,
      };
    }

    if (category === 'EQUIPMENT_CERTIFICATES') {
      let valid = 0;
      let expiringOrPending = 0;
      let expired = 0;
      let linked = 0;
      activeDocs.forEach((d) => {
        const exp = evaluateDocumentExpiry(d.expiryDate);
        if (d.tabMetadata?.linkedEquipmentCode) linked++;
        if (exp.status === 'EXPIRED') {
          expired++;
        } else if (
          exp.status === 'EXPIRING_SOON' ||
          d.tabMetadata?.renewalStatus === 'PENDING_RENEWAL'
        ) {
          expiringOrPending++;
        } else {
          valid++;
        }
      });
      return {
        total: categoryDocs.length,
        valid,
        expiringOrPending,
        expired,
        linked,
      };
    }

    if (category === 'ORG_FORMS_CHECKLISTS') {
      const rawFiles = activeDocs.length;
      const printableOrFilled = activeDocs.filter(
        (d) => (d.extraAttachments?.length || 0) > 0
      ).length;
      const totalVersions = categoryDocs.reduce(
        (sum, d) => sum + (d.versions?.length || 1),
        0
      );
      return {
        total: categoryDocs.length,
        activeCount: activeDocs.length,
        rawFiles,
        printableOrFilled,
        totalVersions,
      };
    }

    // OTHER_HSE_DOCS
    const standards = activeDocs.filter((d) => d.tabMetadata?.topicCategory === 'STANDARDS').length;
    const circulars = activeDocs.filter((d) => d.tabMetadata?.topicCategory === 'CIRCULARS').length;
    const guidesAndReports = activeDocs.filter(
      (d) =>
        d.tabMetadata?.topicCategory === 'SPECIALIZED_GUIDES' ||
        d.tabMetadata?.topicCategory === 'REFERENCE_REPORTS'
    ).length;
    const totalFiles = categoryDocs.reduce(
      (sum, d) => sum + 1 + (d.extraAttachments?.length || 0),
      0
    );
    return {
      total: categoryDocs.length,
      standards,
      circulars,
      guidesAndReports,
      totalFiles,
    };
  }, [categoryDocs, category]);

  // ── Filtered Rows ──
  const filteredDocs = useMemo(() => {
    return categoryDocs.filter((doc) => {
      if (statusFilter === 'ACTIVE' && doc.status !== 'ACTIVE') return false;
      if (statusFilter === 'ARCHIVED' && doc.status !== 'ARCHIVED') return false;
      if (selectedUnit !== 'ALL' && doc.unitName !== selectedUnit) return false;

      const meta = doc.tabMetadata || {};

      if (category === 'ORG_PROCEDURES' && promulgationFilter !== 'ALL') {
        const currentProm = meta.promulgationStatus || 'PROMULGATED';
        if (currentProm !== promulgationFilter) return false;
      }

      if (category === 'EQUIPMENT_CERTIFICATES') {
        if (certTypeFilter !== 'ALL' && (meta.certificateType || '') !== certTypeFilter) {
          return false;
        }
        if (certHealthFilter !== 'ALL') {
          const exp = evaluateDocumentExpiry(doc.expiryDate);
          if (certHealthFilter === 'EXPIRED' && exp.status !== 'EXPIRED') return false;
          if (certHealthFilter === 'EXPIRING' && exp.status !== 'EXPIRING_SOON') return false;
          if (
            certHealthFilter === 'PENDING_RENEWAL' &&
            meta.renewalStatus !== 'PENDING_RENEWAL'
          ) {
            return false;
          }
          if (
            certHealthFilter === 'VALID' &&
            (exp.status === 'EXPIRED' ||
              exp.status === 'EXPIRING_SOON' ||
              meta.renewalStatus === 'PENDING_RENEWAL')
          ) {
            return false;
          }
        }
      }

      if (category === 'ORG_FORMS_CHECKLISTS' && domainFilter !== 'ALL') {
        if ((meta.hseDomain || '') !== domainFilter) return false;
      }

      if (category === 'OTHER_HSE_DOCS') {
        if (topicFilter !== 'ALL' && (meta.topicCategory || 'OTHER') !== topicFilter) {
          return false;
        }
        if (multiPdfOnly && (doc.extraAttachments?.length || 0) === 0) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const haystack = [
          doc.title,
          doc.documentNumber,
          doc.unitName,
          doc.description,
          doc.originalName,
          meta.revisionCode,
          meta.preparedBy,
          meta.approvedBy,
          meta.equipmentSerialOrModel,
          meta.linkedEquipmentCode,
          meta.inspectionCompany,
          meta.certificateType,
          meta.hseDomain,
          meta.issuingAuthority,
          meta.tags,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [
    categoryDocs,
    statusFilter,
    selectedUnit,
    category,
    promulgationFilter,
    certTypeFilter,
    certHealthFilter,
    domainFilter,
    topicFilter,
    multiPdfOnly,
    searchQuery,
  ]);

  // ── Handlers ──
  const handleDownloadFile = async (fileId: string, originalName: string) => {
    const toastId = toast.loading(isFa ? 'در حال دریافت فایل...' : 'Downloading...');
    const ok = await apiDb.downloadFileById(fileId, originalName);
    toast.dismiss(toastId);
    if (ok) {
      toast.success(isFa ? `فایل «${originalName}» دانلود شد.` : 'Downloaded.');
    } else {
      toast.error(isFa ? 'خطا در دانلود فایل از سرور.' : 'Download failed.');
    }
  };

  const handleOpenPreview = async (
    fileId: string,
    originalName: string,
    mimeType: string,
    title: string,
    subtitle: string,
    versionBadge?: string,
    docForVersions?: HseDocumentItem
  ) => {
    const reqId = ++previewReqRef.current;
    setImageZoom(1);
    setImageRotation(0);
    setPreviewTarget({
      title,
      subtitle,
      fileId,
      originalName,
      mimeType,
      versionBadge,
      docForVersions,
      blobUrl: null,
      loading: true,
      error: null,
    });

    const blobUrl = await apiDb.fetchFileBlobUrl(fileId, mimeType);
    if (reqId !== previewReqRef.current) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      return;
    }

    if (!blobUrl) {
      setPreviewTarget((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              error: 'فایل فیزیکی این مستند در سرور یافت نشد. می‌توانید از گزینه جایگزینی فایل استفاده کنید.',
            }
          : null
      );
      return;
    }

    setPreviewTarget((prev) =>
      prev ? { ...prev, blobUrl, loading: false, error: null } : null
    );
  };

  const handlePreviewDoc = (doc: HseDocumentItem, versionItem?: DocumentVersionItem) => {
    const ver = versionItem ||
      doc.versions?.[0] || {
        fileId: doc.fileId,
        version: doc.version,
        originalName: doc.originalName,
        mimeType: doc.mimeType || 'application/pdf',
        fileSize: doc.fileSize,
        uploadedBy: doc.uploadedBy,
        createdAt: doc.updatedAt,
        downloadUrl: doc.downloadUrl,
        previewUrl: doc.previewUrl,
      };
    handleOpenPreview(
      ver.fileId,
      ver.originalName,
      ver.mimeType || 'application/pdf',
      doc.title,
      `${doc.documentNumber} · ${doc.unitName}`,
      `v${ver.version}`,
      doc
    );
  };

  const handleToggleArchive = async (doc: HseDocumentItem) => {
    if (!canEdit) return;
    const nextStatus = doc.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    const res = await apiDb.updateDocument(doc.documentId, { status: nextStatus });
    if (res.success) {
      toast.success(
        nextStatus === 'ARCHIVED'
          ? 'مستند به بایگانی/منسوخ منتقل شد.'
          : 'مستند مجدداً فعال شد.'
      );
      await onRefresh(false);
    } else {
      toast.error(res.error || 'خطا در تغییر وضعیت مستند');
    }
  };

  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceTargetDoc || !replaceFile) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', replaceFile);
      fd.append(
        'changeNote',
        replaceChangeNote.trim() || `انتشار نسخه ${(replaceTargetDoc.version || 1) + 1}`
      );
      fd.append('issueDate', replaceIssueDate.trim() || replaceTargetDoc.issueDate);
      fd.append('expiryDate', replaceExpiryDate.trim());

      const res = await apiDb.replaceDocumentFile(replaceTargetDoc.documentId, fd);
      if (!res.success) {
        toast.error(res.error || 'خطا در جایگزینی فایل');
        return;
      }

      try {
        addAuditLog(
          currentUser.username,
          `ثبت نسخه جدید (v${(replaceTargetDoc.version || 1) + 1}) برای «${replaceTargetDoc.title}»`,
          'موفق',
          { module: 'دستورالعمل‌ها و مستندات', recordId: replaceTargetDoc.documentId }
        );
      } catch {}

      toast.success(`نسخه جدید (ویرایش ${(replaceTargetDoc.version || 1) + 1}) ثبت شد.`);
      setReplaceTargetDoc(null);
      await onRefresh(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetDoc || !canDelete) return;
    setSubmitting(true);
    try {
      const res = await apiDb.deleteDocument(deleteTargetDoc.documentId);
      if (!res.success) {
        toast.error(res.error || 'خطا در حذف مستند');
        return;
      }
      try {
        addAuditLog(
          currentUser.username,
          `حذف مستند «${deleteTargetDoc.title}» (${deleteTargetDoc.documentNumber})`,
          'موفق',
          { module: 'دستورالعمل‌ها و مستندات', recordId: deleteTargetDoc.documentId }
        );
      } catch {}
      toast.success(isFa ? 'مستند با موفقیت حذف شد.' : 'Deleted.');
      setDeleteTargetDoc(null);
      await onRefresh(false);
    } finally {
      setSubmitting(false);
    }
  };

  const getFormatLabel = (name: string) => {
    const ext = name.split('.').pop()?.toUpperCase() || 'FILE';
    return ext;
  };

  return (
    <div className="space-y-4">
      {/* ── Dedicated Tab Header & Primary CTA ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${cfg.accentBg}`}
          >
            <TabIcon className={`w-6 h-6 ${cfg.accentText}`} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
              {isFa ? cfg.titleFa : cfg.titleEn}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {cfg.subtitleFa}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onRefresh(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-500' : ''}`} />
            <span>{isFa ? 'بروزرسانی' : 'Refresh'}</span>
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setEditingDoc(null);
                setIsFormOpen(true);
              }}
              className={`px-4 py-2.5 rounded-xl ${cfg.accentBtn} text-white text-xs font-black flex items-center gap-2 shadow-xs cursor-pointer`}
            >
              <Upload className="w-4 h-4" />
              <span>{cfg.uploadBtnFa}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Independent Dashboard KPIs per Tab ── */}
      {category === 'ORG_PROCEDURES' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ALL');
              setPromulgationFilter('ALL');
            }}
            className="text-right p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-300 transition cursor-pointer"
          >
            <div className="text-xs font-bold text-slate-500">کل دستورالعمل‌ها</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {stats.total}
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ACTIVE');
              setPromulgationFilter('PROMULGATED');
            }}
            className="text-right p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 hover:border-emerald-400 transition cursor-pointer"
          >
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">ابلاغ‌شده و معتبر</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {stats.promulgated}
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ACTIVE');
              setPromulgationFilter('UNDER_REVISION');
            }}
            className="text-right p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/60 hover:border-amber-400 transition cursor-pointer"
          >
            <div className="text-xs font-bold text-amber-700 dark:text-amber-400">در دست بازنگری / پیش‌نویس</div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
              {stats.inProgress}
            </div>
          </button>
          <div className="text-right p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-500">دارای ضمائم / منسوخ و آرشیو</div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1 tabular-nums">
              {stats.withAttachments} <span className="text-xs font-bold text-slate-400">/ {stats.archivedOrObsolete} آرشیو</span>
            </div>
          </div>
        </div>
      )}

      {category === 'EQUIPMENT_CERTIFICATES' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ACTIVE');
                setCertHealthFilter('ALL');
              }}
              className="text-right p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 transition cursor-pointer"
            >
              <div className="text-xs font-bold text-slate-500">کل گواهینامه‌های ثبت‌شده</div>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                {stats.total}
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ACTIVE');
                setCertHealthFilter('VALID');
              }}
              className="text-right p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 hover:border-emerald-400 transition cursor-pointer"
            >
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">گواهینامه‌های معتبر</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {stats.valid}
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ACTIVE');
                setCertHealthFilter('EXPIRING');
              }}
              className="text-right p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/60 hover:border-amber-400 transition cursor-pointer"
            >
              <div className="text-xs font-bold text-amber-700 dark:text-amber-400">نزدیک به انقضا / در انتظار تمدید</div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                {stats.expiringOrPending}
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ACTIVE');
                setCertHealthFilter('EXPIRED');
              }}
              className="text-right p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/60 hover:border-rose-400 transition cursor-pointer"
            >
              <div className="text-xs font-bold text-rose-700 dark:text-rose-400">منقضی‌شده</div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
                {stats.expired}
              </div>
            </button>
          </div>

          {((stats.expired || 0) > 0 || (stats.expiringOrPending || 0) > 0) && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  هشدار اعتبار تجهیزات:{' '}
                  {(stats.expired || 0) > 0 && (
                    <span className="text-rose-600 dark:text-rose-400 font-black ml-2">
                      {stats.expired} گواهینامه منقضی‌شده
                    </span>
                  )}
                  {(stats.expiringOrPending || 0) > 0 && (
                    <span>{stats.expiringOrPending} گواهینامه در آستانه انقضا (&lt;۳۰ روز) یا در انتظار تمدید</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCertHealthFilter(
                    certHealthFilter === 'EXPIRING' ? 'ALL' : 'EXPIRING'
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer shrink-0"
              >
                {certHealthFilter === 'EXPIRING' ? 'نمایش همه' : 'فیلتر موارد نیازمند اقدام'}
              </button>
            </div>
          )}
        </>
      )}

      {category === 'ORG_FORMS_CHECKLISTS' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-500">کل فرم‌ها و چک‌لیست‌ها</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {stats.total}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/60">
            <div className="text-xs font-bold text-amber-700 dark:text-amber-400">فرم‌های فعال قابل دانلود</div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
              {stats.rawFiles}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60">
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">دارای PDF چاپی یا سوابق تکمیل‌شده</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {stats.printableOrFilled}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-500">مجموع کل نسخه‌های بایگانی</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {stats.totalVersions}
            </div>
          </div>
        </div>
      )}

      {category === 'OTHER_HSE_DOCS' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setTopicFilter('ALL')}
            className="text-right p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-300 transition cursor-pointer"
          >
            <div className="text-xs font-bold text-slate-500">کل مستندات مرجع</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {stats.total}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setTopicFilter('STANDARDS')}
            className="text-right p-4 rounded-2xl bg-white dark:bg-slate-900 border border-violet-200/80 dark:border-violet-900/60 hover:border-violet-400 transition cursor-pointer"
          >
            <div className="text-xs font-bold text-violet-700 dark:text-violet-400">استانداردها و الزامات</div>
            <div className="text-2xl font-black text-violet-600 dark:text-violet-400 mt-1 tabular-nums">
              {stats.standards}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setTopicFilter('CIRCULARS')}
            className="text-right p-4 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-sky-900/60 hover:border-sky-400 transition cursor-pointer"
          >
            <div className="text-xs font-bold text-sky-700 dark:text-sky-400">بخشنامه‌ها و ابلاغیه‌ها</div>
            <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1 tabular-nums">
              {stats.circulars}
            </div>
          </button>
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-500">مجموع فایل‌ها و PDFهای پیوست</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {stats.totalFiles}
            </div>
          </div>
        </div>
      )}

      {/* ── Specialized Search & Facet Filter Bar (ZERO Category Select) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search
              className={`w-4 h-4 text-slate-400 absolute top-3 ${isFa ? 'right-3.5' : 'left-3.5'}`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                category === 'EQUIPMENT_CERTIFICATES'
                  ? 'جست‌وجو نام تجهیز، سریال، کد گواهینامه، شرکت بازرسی...'
                  : category === 'ORG_FORMS_CHECKLISTS'
                  ? 'جست‌وجو عنوان فرم، کد فرم، حوزه HSE...'
                  : category === 'OTHER_HSE_DOCS'
                  ? 'جست‌وجو عنوان، مرجع صادرکننده، برچسب‌ها...'
                  : 'جست‌وجو عنوان، کد مدرک، مسئول تهیه/تأیید...'
              }
              className={`w-full ${
                isFa ? 'pr-10 pl-8' : 'pl-10 pr-8'
              } py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`absolute top-3 ${
                  isFa ? 'left-3' : 'right-3'
                } text-slate-400 hover:text-slate-600 cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
            >
              <option value="ALL">{isFa ? 'همه واحدهای سازمانی' : 'All Units'}</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Tab-Specific Facet Filter */}
          {category === 'ORG_PROCEDURES' && (
            <div className="md:col-span-3">
              <select
                value={promulgationFilter}
                onChange={(e) => setPromulgationFilter(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
              >
                <option value="ALL">همه وضعیت‌های ابلاغ</option>
                {(
                  Object.keys(PROMULGATION_STATUS_LABELS) as Array<
                    keyof typeof PROMULGATION_STATUS_LABELS
                  >
                ).map((k) => (
                  <option key={k} value={k}>
                    {PROMULGATION_STATUS_LABELS[k].fa}
                  </option>
                ))}
              </select>
            </div>
          )}

          {category === 'EQUIPMENT_CERTIFICATES' && (
            <>
              <div className="md:col-span-3">
                <select
                  value={certTypeFilter}
                  onChange={(e) => setCertTypeFilter(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                >
                  <option value="ALL">همه انواع گواهینامه</option>
                  {CERTIFICATE_TYPES.map((ct) => (
                    <option key={ct} value={ct}>
                      {ct}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <select
                  value={certHealthFilter}
                  onChange={(e) => setCertHealthFilter(e.target.value as any)}
                  className="w-full px-3 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                >
                  <option value="ALL">همه وضعیت‌های اعتبار</option>
                  <option value="VALID">معتبر</option>
                  <option value="EXPIRING">نزدیک به انقضا (&lt;۳۰ روز)</option>
                  <option value="EXPIRED">منقضی‌شده</option>
                  <option value="PENDING_RENEWAL">در انتظار تمدید</option>
                </select>
              </div>
            </>
          )}

          {category === 'ORG_FORMS_CHECKLISTS' && (
            <div className="md:col-span-3">
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
              >
                <option value="ALL">همه حوزه‌های تخصصی HSE</option>
                {FORM_HSE_DOMAINS.map((dom) => (
                  <option key={dom} value={dom}>
                    {dom}
                  </option>
                ))}
              </select>
            </div>
          )}

          {category === 'OTHER_HSE_DOCS' && (
            <div className="md:col-span-3">
              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
              >
                <option value="ALL">همه دسته‌های موضوعی</option>
                {OTHER_TOPIC_CATEGORIES.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.fa}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status filter */}
          <div className={category === 'EQUIPMENT_CERTIFICATES' ? 'md:col-span-12 flex justify-end' : 'md:col-span-2'}>
            <div className="flex items-center gap-2">
              {category === 'OTHER_HSE_DOCS' && (
                <button
                  type="button"
                  onClick={() => setMultiPdfOnly((v) => !v)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold border cursor-pointer shrink-0 ${
                    multiPdfOnly
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  چندفایلی
                </button>
              )}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
              >
                <option value="ACTIVE">فقط فعال</option>
                <option value="ARCHIVED">بایگانی / منسوخ</option>
                <option value="ALL">همه رکوردها</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Documents Data Table ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading && categoryDocs.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <RefreshCw className="w-6 h-6 text-sky-500 animate-spin mx-auto" />
            <div className="text-xs font-bold text-slate-500">در حال دریافت اطلاعات از سرور...</div>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <TabIcon className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <div className="text-sm font-black text-slate-700 dark:text-slate-300">{cfg.emptyFa}</div>
            {canCreate && (
              <button
                type="button"
                onClick={() => {
                  setEditingDoc(null);
                  setIsFormOpen(true);
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${cfg.accentBtn} text-white text-xs font-bold cursor-pointer`}
              >
                <Upload className="w-4 h-4" />
                <span>{cfg.uploadBtnFa}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-600 dark:text-slate-300">
                  {category === 'ORG_PROCEDURES' && (
                    <>
                      <th className="py-3 px-4">کد مدرک و بازنگری</th>
                      <th className="py-3 px-4">عنوان دستورالعمل</th>
                      <th className="py-3 px-4">واحد / مسئولین تهیه و تأیید</th>
                      <th className="py-3 px-4">تاریخ تهیه / بازنگری</th>
                      <th className="py-3 px-4">وضعیت ابلاغ</th>
                      <th className="py-3 px-4">نسخه و پیوست‌ها</th>
                      <th className="py-3 px-4 text-center">عملیات</th>
                    </>
                  )}
                  {category === 'EQUIPMENT_CERTIFICATES' && (
                    <>
                      <th className="py-3 px-4">کد گواهینامه و تگ تجهیز</th>
                      <th className="py-3 px-4">نام ماشین‌آلات / تجهیز و مدل</th>
                      <th className="py-3 px-4">نوع گواهینامه و شرکت بازرسی</th>
                      <th className="py-3 px-4">صدور و انقضا</th>
                      <th className="py-3 px-4">وضعیت اعتبار</th>
                      <th className="py-3 px-4">گزارش / پیوست</th>
                      <th className="py-3 px-4 text-center">عملیات</th>
                    </>
                  )}
                  {category === 'ORG_FORMS_CHECKLISTS' && (
                    <>
                      <th className="py-3 px-4">کد فرم مصوب</th>
                      <th className="py-3 px-4">عنوان فرم / چک‌لیست</th>
                      <th className="py-3 px-4">حوزه تخصصی و واحد</th>
                      <th className="py-3 px-4">فایل خام قابل دانلود</th>
                      <th className="py-3 px-4">PDF چاپی / سوابق تکمیل‌شده</th>
                      <th className="py-3 px-4 text-center">عملیات</th>
                    </>
                  )}
                  {category === 'OTHER_HSE_DOCS' && (
                    <>
                      <th className="py-3 px-4">کد مرجع</th>
                      <th className="py-3 px-4">عنوان مستند و برچسب‌ها</th>
                      <th className="py-3 px-4">دسته موضوعی و مرجع صادرکننده</th>
                      <th className="py-3 px-4">واحد و تاریخ</th>
                      <th className="py-3 px-4">فایل‌ها و PDFهای پیوست</th>
                      <th className="py-3 px-4 text-center">عملیات</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filteredDocs.map((doc) => {
                  const meta = doc.tabMetadata || {};
                  const exp = evaluateDocumentExpiry(doc.expiryDate);
                  const extraCount = doc.extraAttachments?.length || 0;
                  const canPreviewMain =
                    doc.mimeType === 'application/pdf' ||
                    doc.mimeType?.startsWith('image/') ||
                    doc.originalName?.toLowerCase().endsWith('.pdf');

                  return (
                    <tr
                      key={doc.documentId}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* ── TAB 1 CELLS: ORG_PROCEDURES ── */}
                      {category === 'ORG_PROCEDURES' && (
                        <>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-mono font-black text-slate-900 dark:text-slate-100">
                              {doc.documentNumber}
                            </div>
                            <div className="text-[11px] font-mono text-sky-600 dark:text-sky-400">
                              {meta.revisionCode || `Rev.0${Math.max(0, (doc.version || 1) - 1)}`}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-[260px]">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate" title={doc.title}>
                              {doc.title}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {doc.originalName} · <span className="font-mono tabular-nums">{formatFileSize(doc.fileSize)}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{doc.unitName}</div>
                            {(meta.preparedBy || meta.approvedBy) && (
                              <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                                {meta.preparedBy ? `تهیه: ${meta.preparedBy}` : ''}
                                {meta.preparedBy && meta.approvedBy ? ' · ' : ''}
                                {meta.approvedBy ? `تأیید: ${meta.approvedBy}` : ''}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-[11px]">
                            <div className="text-slate-800 dark:text-slate-200">{doc.issueDate || '—'}</div>
                            {meta.revisionDate && (
                              <div className="text-slate-500">بازنگری: {meta.revisionDate}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {(() => {
                              const pKey = meta.promulgationStatus || 'PROMULGATED';
                              const pInfo = PROMULGATION_STATUS_LABELS[pKey];
                              return (
                                <span
                                  className={`inline-flex px-2.5 py-1 rounded-lg border text-[11px] font-bold ${pInfo.badgeClass}`}
                                >
                                  {pInfo.fa}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setHistoryDoc(doc)}
                                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-mono text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                title="تاریخچه نسخه‌ها"
                              >
                                <History className="w-3 h-3" />
                                <span>v{doc.version}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setAttachmentsModalDocId(doc.documentId)}
                                className="px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-700 dark:text-sky-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer tabular-nums"
                                title="مدیریت پیوست‌ها"
                              >
                                <Paperclip className="w-3 h-3" />
                                <span>{extraCount}</span>
                              </button>
                            </div>
                          </td>
                        </>
                      )}

                      {/* ── TAB 2 CELLS: EQUIPMENT_CERTIFICATES ── */}
                      {category === 'EQUIPMENT_CERTIFICATES' && (
                        <>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-mono font-black text-slate-900 dark:text-slate-100">
                              {doc.documentNumber}
                            </div>
                            {meta.linkedEquipmentCode && (
                              <div className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                                <Link2 className="w-3 h-3" />
                                <span>{meta.linkedEquipmentCode}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-[240px]">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate" title={doc.title}>
                              {doc.title}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {meta.equipmentSerialOrModel || doc.unitName}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-[220px]">
                            <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                              {meta.certificateType || 'گواهینامه فنی'}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {meta.inspectionCompany || doc.unitName}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-[11px]">
                            <div className="text-slate-600 dark:text-slate-400">صدور: {doc.issueDate || '—'}</div>
                            <div className="font-bold text-slate-900 dark:text-slate-100">انقضا: {doc.expiryDate || '—'}</div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {meta.renewalStatus === 'PENDING_RENEWAL' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold">
                                <Clock className="w-3 h-3" />
                                <span>در انتظار تمدید</span>
                              </span>
                            ) : exp.status === 'EXPIRED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-bold">
                                <AlertTriangle className="w-3 h-3" />
                                <span>{exp.labelFa}</span>
                              </span>
                            ) : exp.status === 'EXPIRING_SOON' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold">
                                <Clock className="w-3 h-3" />
                                <span>{exp.labelFa}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{exp.labelFa}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setAttachmentsModalDocId(doc.documentId)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer tabular-nums"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>{extraCount} پیوست</span>
                            </button>
                          </td>
                        </>
                      )}

                      {/* ── TAB 3 CELLS: ORG_FORMS_CHECKLISTS ── */}
                      {category === 'ORG_FORMS_CHECKLISTS' && (
                        <>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-mono font-black text-slate-900 dark:text-slate-100">
                              {doc.documentNumber}
                            </div>
                            <div className="text-[11px] font-mono text-amber-600 dark:text-amber-400">
                              {meta.revisionCode || `Rev.0${Math.max(0, (doc.version || 1) - 1)}`}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-[260px]">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate" title={doc.title}>
                              {doc.title}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              نسخه v{doc.version} · {doc.issueDate || '—'}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-[220px]">
                            <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                              {meta.hseDomain || 'عمومی HSE'}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">{doc.unitName}</div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleDownloadFile(doc.fileId, doc.originalName)}
                              className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                              title={doc.originalName}
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>دانلود فایل خام</span>
                              <span className="font-mono text-[10px] opacity-80">
                                ({getFormatLabel(doc.originalName)})
                              </span>
                            </button>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setAttachmentsModalDocId(doc.documentId)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer tabular-nums"
                            >
                              <Paperclip className="w-3.5 h-3.5 text-sky-600" />
                              <span>{extraCount} فایل پیوست / پرشده</span>
                            </button>
                          </td>
                        </>
                      )}

                      {/* ── TAB 4 CELLS: OTHER_HSE_DOCS ── */}
                      {category === 'OTHER_HSE_DOCS' && (
                        <>
                          <td className="py-3 px-4 whitespace-nowrap font-mono font-black text-slate-900 dark:text-slate-100">
                            {doc.documentNumber}
                          </td>
                          <td className="py-3 px-4 max-w-[260px]">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate" title={doc.title}>
                              {doc.title}
                            </div>
                            {meta.tags ? (
                              <div className="text-[11px] text-violet-600 dark:text-violet-400 truncate">
                                #{meta.tags}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 truncate">{doc.originalName}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-[230px]">
                            <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                              {OTHER_TOPIC_CATEGORIES.find((t) => t.id === meta.topicCategory)?.fa ||
                                'سایر مستندات مرتبط با HSE'}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {meta.issuingAuthority || '—'}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-[11px]">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{doc.unitName}</div>
                            <div className="font-mono tabular-nums text-slate-500">{doc.issueDate || '—'}</div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setAttachmentsModalDocId(doc.documentId)}
                              className="px-2.5 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 text-violet-700 dark:text-violet-300 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer tabular-nums"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              <span>{1 + extraCount} فایل (اصلی + {extraCount} پیوست)</span>
                            </button>
                          </td>
                        </>
                      )}

                      {/* ── SHARED ACTIONS CELL ── */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {canPreviewMain && (
                            <button
                              type="button"
                              onClick={() => handlePreviewDoc(doc)}
                              className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-600 dark:text-sky-400 cursor-pointer"
                              title="مشاهده آنلاین"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(doc.fileId, doc.originalName)}
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                            title="دانلود فایل اصلی"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttachmentsModalDocId(doc.documentId)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 cursor-pointer"
                            title="فایل‌های پیوست و ضمائم"
                          >
                            <Paperclip className="w-4 h-4" />
                          </button>
                          {canPrint && (
                            <button
                              type="button"
                              onClick={() => setPrintDoc(doc)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 cursor-pointer"
                              title="چاپ شناسنامه مستند (A4)"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setReplaceTargetDoc(doc);
                                  setReplaceFile(null);
                                  setReplaceChangeNote('');
                                  setReplaceIssueDate(moment().format('jYYYY/jMM/jDD'));
                                  setReplaceExpiryDate(doc.expiryDate || '');
                                }}
                                className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                                title="بارگذاری نسخه جدید (جایگزینی فایل)"
                              >
                                <Upload className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDoc(doc);
                                  setIsFormOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-600 dark:text-amber-400 cursor-pointer"
                                title="ویرایش اطلاعات"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleArchive(doc)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 cursor-pointer"
                                title={doc.status === 'ACTIVE' ? 'انتقال به بایگانی / منسوخ' : 'بازگردانی به فعال'}
                              >
                                {doc.status === 'ACTIVE' ? (
                                  <Archive className="w-4 h-4" />
                                ) : (
                                  <ArchiveRestore className="w-4 h-4 text-emerald-600" />
                                )}
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTargetDoc(doc)}
                              className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 cursor-pointer"
                              title="حذف مستند"
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

      {/* ── MODAL: Create / Edit (Fixed Active Tab Category) ── */}
      <DocumentFormModal
        isOpen={isFormOpen}
        category={category}
        editingDoc={editingDoc}
        orgUnits={unitOptions}
        equipmentOptions={equipmentOptions}
        currentUser={currentUser}
        isFa={isFa}
        onClose={() => {
          setIsFormOpen(false);
          setEditingDoc(null);
        }}
        onSaved={async () => {
          await onRefresh(false);
        }}
      />

      {/* ── MODAL: Supplementary Multi-File Attachments ── */}
      <DocumentAttachmentsModal
        doc={activeAttachmentsDoc}
        canUpload={canCreate || canEdit}
        canDelete={canDelete}
        isFa={isFa}
        onClose={() => setAttachmentsModalDocId(null)}
        onUpdated={async () => {
          await onRefresh(false);
        }}
        onPreviewFile={(fileId, originalName, mimeType, title) =>
          handleOpenPreview(
            fileId,
            originalName,
            mimeType,
            title,
            activeAttachmentsDoc ? `${activeAttachmentsDoc.title} · ${activeAttachmentsDoc.documentNumber}` : originalName
          )
        }
        onDownloadFile={handleDownloadFile}
      />

      {/* ── MODAL: A4 Printable Card ── */}
      <DocumentPrintModal
        doc={printDoc}
        isFa={isFa}
        onClose={() => setPrintDoc(null)}
      />

      {/* ── MODAL: Replace Version ── */}
      {replaceTargetDoc && (
        <div className="fixed inset-0 z-[10050] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                  جایگزینی فایل و انتشار نسخه v{(replaceTargetDoc.version || 1) + 1}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {replaceTargetDoc.title} ({replaceTargetDoc.documentNumber})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplaceTargetDoc(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReplaceSubmit} className="space-y-4">
              <div>
                <input
                  ref={replaceInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.xlsx,.xls"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setReplaceFile(f);
                  }}
                  className="hidden"
                />
                <div
                  onClick={() => replaceInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-2xl p-4 text-center cursor-pointer bg-slate-50 dark:bg-slate-800/50"
                >
                  {replaceFile ? (
                    <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {replaceFile.name} ({formatFileSize(replaceFile.size)})
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      انتخاب فایل نسخه جدید (PDF، Word، Excel، تصویر)
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    تاریخ صدور نسخه جدید
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={replaceIssueDate}
                    onChange={(e) => setReplaceIssueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    تاریخ انقضای جدید
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={replaceExpiryDate}
                    onChange={(e) => setReplaceExpiryDate(e.target.value)}
                    placeholder="اختیاری"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  شرح تغییرات / علت بازنگری
                </label>
                <input
                  type="text"
                  value={replaceChangeNote}
                  onChange={(e) => setReplaceChangeNote(e.target.value)}
                  placeholder="مثلاً: تمدید سالانه گواهینامه یا اصلاح بند چهارم"
                  className="w-full px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReplaceTargetDoc(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting || !replaceFile}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
                >
                  {submitting ? 'در حال ثبت...' : 'ثبت نسخه جدید'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Version History ── */}
      {historyDoc && (
        <div className="fixed inset-0 z-[10050] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                  تاریخچه نسخه‌ها و سوابق بازنگری
                </h3>
                <p className="text-xs text-slate-500">
                  {historyDoc.title} — <span className="font-mono">{historyDoc.documentNumber}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryDoc(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto">
              {(historyDoc.versions || []).map((ver, idx) => (
                <div
                  key={ver.fileId}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    idx === 0
                      ? 'bg-sky-50/50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-sky-600 text-white font-mono text-[11px] font-black">
                        v{ver.version}
                      </span>
                      {idx === 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          نسخه جاری
                        </span>
                      )}
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {ver.originalName}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400">
                        ({formatFileSize(ver.fileSize)})
                      </span>
                    </div>
                    {ver.changeNote && (
                      <div className="text-xs text-slate-600 dark:text-slate-300">{ver.changeNote}</div>
                    )}
                    <div className="text-[11px] text-slate-400 flex flex-wrap gap-3">
                      <span>بارگذاری توسط: {ver.uploadedBy}</span>
                      <span className="font-mono tabular-nums">
                        {moment(ver.createdAt).format('jYYYY/jMM/jDD HH:mm')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const d = historyDoc;
                        setHistoryDoc(null);
                        handlePreviewDoc(d, ver);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>مشاهده</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(ver.fileId, ver.originalName)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>دانلود</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Online Preview (PDF & Image) ── */}
      {previewTarget && (
        <div className="fixed inset-0 z-[10070] bg-slate-950/80 backdrop-blur-xs flex flex-col p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-2xl max-w-6xl w-full mx-auto">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                    {previewTarget.title}
                  </h3>
                  {previewTarget.versionBadge && (
                    <span className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-mono text-[10px] font-black">
                      {previewTarget.versionBadge}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{previewTarget.subtitle}</div>
              </div>

              <div className="flex items-center gap-2">
                {previewTarget.docForVersions &&
                  previewTarget.docForVersions.versions.length > 1 && (
                    <select
                      value={previewTarget.fileId}
                      onChange={(e) => {
                        const found = previewTarget.docForVersions?.versions.find(
                          (v) => v.fileId === e.target.value
                        );
                        if (found && previewTarget.docForVersions) {
                          handlePreviewDoc(previewTarget.docForVersions, found);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                    >
                      {previewTarget.docForVersions.versions.map((v) => (
                        <option key={v.fileId} value={v.fileId}>
                          نسخه v{v.version}
                        </option>
                      ))}
                    </select>
                  )}

                {previewTarget.mimeType.startsWith('image/') && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                      className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                      className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageRotation((r) => (r + 90) % 360)}
                      className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    handleDownloadFile(previewTarget.fileId, previewTarget.originalName)
                  }
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    previewReqRef.current++;
                    setPreviewTarget(null);
                  }}
                  className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-rose-500 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 dark:bg-slate-950 overflow-auto flex items-center justify-center">
              {previewTarget.loading ? (
                <div className="text-center space-y-2">
                  <RefreshCw className="w-7 h-7 text-sky-500 animate-spin mx-auto" />
                  <div className="text-xs font-bold text-slate-500">در حال بارگذاری پیش‌نمایش...</div>
                </div>
              ) : previewTarget.blobUrl ? (
                previewTarget.mimeType === 'application/pdf' ||
                previewTarget.originalName.toLowerCase().endsWith('.pdf') ? (
                  <div className="w-full h-full flex flex-col">
                    <PdfDocumentViewer
                      fileId={previewTarget.fileId}
                      fileData={previewTarget.blobUrl}
                      fileName={previewTarget.originalName}
                      displayName={previewTarget.title}
                      language={language}
                      onDownload={() =>
                        handleDownloadFile(previewTarget.fileId, previewTarget.originalName)
                      }
                    />
                  </div>
                ) : (
                  <div className="p-6 flex items-center justify-center w-full h-full">
                    <img
                      src={previewTarget.blobUrl}
                      alt={previewTarget.title}
                      style={{
                        transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                        transition: 'transform 0.2s ease',
                      }}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    />
                  </div>
                )
              ) : (
                <div className="p-6 text-center space-y-2 max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 m-4">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {previewTarget.error || 'خطا در نمایش پیش‌نمایش فایل'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Delete Confirmation ── */}
      {deleteTargetDoc && (
        <div className="fixed inset-0 z-[10060] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                تأیید حذف مستند از سامانه
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                آیا از حذف مستند «{deleteTargetDoc.title}» (کد: {deleteTargetDoc.documentNumber}) همراه با نسخه‌ها و فایل‌های پیوست آن اطمینان دارید؟
              </p>
            </div>
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetDoc(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
              >
                {submitting ? 'در حال حذف...' : 'بله، حذف شود'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentCategoryWorkspace;
