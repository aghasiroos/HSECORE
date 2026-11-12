import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileText,
  Upload,
  Search,
  Filter,
  Download,
  Eye,
  Edit3,
  Trash2,
  History,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderOpen,
  FileCheck2,
  ClipboardList,
  ShieldCheck,
  X,
  Plus,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Building2,
  Calendar,
  Hash,
  Layers,
  Image as ImageIcon,
  FileWarning,
  Info,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import moment from 'moment-jalaali';
import { UserProfile } from '../types';
import { hasPermission, isUserAdmin, addAuditLog } from '../utils/authHelper';
import { getUnits } from '../utils/orgHelper';
import { apiDb } from '../services/apiDatabaseClient';
import PdfDocumentViewer from '../modules/health-env/components/PdfDocumentViewer';
import { formatFileSize } from '../utils/fileHelpers';
import { normalizeDigits } from '../utils/textNormalization';

export type HseDocumentCategory =
  | 'ORG_PROCEDURES'
  | 'EQUIPMENT_CERTIFICATES'
  | 'ORG_FORMS_CHECKLISTS'
  | 'OTHER_HSE_DOCS';

export interface DocumentVersionItem {
  fileId: string;
  version: number;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  uploaderRole?: string;
  createdAt: string;
  changeNote?: string;
  issueDate?: string;
  expiryDate?: string;
  downloadUrl: string;
  previewUrl: string;
}

export interface HseDocumentItem {
  id: number;
  documentId: string;
  fileId: string;
  title: string;
  documentNumber: string;
  category: HseDocumentCategory;
  unitId?: number | string | null;
  unitName: string;
  issueDate: string;
  expiryDate: string;
  description: string;
  status: 'ACTIVE' | 'ARCHIVED';
  version: number;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  uploaderRole?: string;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
  previewUrl: string;
  versions: DocumentVersionItem[];
}

interface InstructionsDocumentsModuleProps {
  currentUser: UserProfile;
  language: 'fa' | 'en';
}

export const DOCUMENT_CATEGORIES: {
  id: HseDocumentCategory;
  titleFa: string;
  titleEn: string;
  shortFa: string;
  icon: any;
  color: string;
  bgLight: string;
  borderLight: string;
}[] = [
  {
    id: 'ORG_PROCEDURES',
    titleFa: 'دستورالعمل‌ها و روش‌های اجرایی سازمانی',
    titleEn: 'Organizational Instructions & Procedures',
    shortFa: 'دستورالعمل‌ها و روش‌های اجرایی',
    icon: FileText,
    color: 'text-sky-600 dark:text-sky-400',
    bgLight: 'bg-sky-50 dark:bg-sky-950/40',
    borderLight: 'border-sky-200 dark:border-sky-800/60',
  },
  {
    id: 'EQUIPMENT_CERTIFICATES',
    titleFa: 'گواهینامه‌ها و سرتیفیکیت ماشین‌آلات و تجهیزات',
    titleEn: 'Machinery & Equipment Certificates',
    shortFa: 'گواهینامه‌ها و سرتیفیکیت تجهیزات',
    icon: ShieldCheck,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderLight: 'border-emerald-200 dark:border-emerald-800/60',
  },
  {
    id: 'ORG_FORMS_CHECKLISTS',
    titleFa: 'فرم‌ها و چک‌لیست‌های سازمانی',
    titleEn: 'Organizational Forms & Checklists',
    shortFa: 'فرم‌ها و چک‌لیست‌ها',
    icon: ClipboardList,
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50 dark:bg-amber-950/40',
    borderLight: 'border-amber-200 dark:border-amber-800/60',
  },
  {
    id: 'OTHER_HSE_DOCS',
    titleFa: 'سایر مستندات مرتبط با HSE',
    titleEn: 'Other HSE Related Documents',
    shortFa: 'سایر مستندات HSE',
    icon: FolderOpen,
    color: 'text-violet-600 dark:text-violet-400',
    bgLight: 'bg-violet-50 dark:bg-violet-950/40',
    borderLight: 'border-violet-200 dark:border-violet-800/60',
  },
];

// Parse either Jalali (e.g. 1405/07/15) or Gregorian (e.g. 2026-10-07) date string to Date
function parseFlexibleDate(dateStr?: string): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const clean = normalizeDigits(dateStr.trim(), true).replace(/-/g, '/');
  const parts = clean.split('/');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    if (y >= 1300 && y <= 1500) {
      const m = moment(clean, 'jYYYY/jM/jD', true);
      if (m.isValid()) return m.toDate();
    } else if (y >= 1900 && y <= 2100) {
      const m = moment(clean, 'YYYY/M/D', true);
      if (m.isValid()) return m.toDate();
    }
  }
  const fallback = new Date(normalizeDigits(dateStr.trim(), true));
  return isNaN(fallback.getTime()) ? null : fallback;
}

export type ExpiryStatusType = 'EXPIRED' | 'EXPIRING_SOON' | 'VALID' | 'NO_EXPIRY';

export function evaluateDocumentExpiry(expiryDateStr?: string): {
  status: ExpiryStatusType;
  daysRemaining: number | null;
  labelFa: string;
  labelEn: string;
} {
  if (!expiryDateStr || !expiryDateStr.trim()) {
    return {
      status: 'NO_EXPIRY',
      daysRemaining: null,
      labelFa: 'بدون انقضا / دائمی',
      labelEn: 'No Expiry',
    };
  }

  const parsed = parseFlexibleDate(expiryDateStr);
  if (!parsed) {
    return {
      status: 'NO_EXPIRY',
      daysRemaining: null,
      labelFa: expiryDateStr,
      labelEn: expiryDateStr,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(parsed);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'EXPIRED',
      daysRemaining: diffDays,
      labelFa: `منقضی شده (${Math.abs(diffDays)} روز گذشته)`,
      labelEn: `Expired (${Math.abs(diffDays)}d ago)`,
    };
  }
  if (diffDays <= 30) {
    return {
      status: 'EXPIRING_SOON',
      daysRemaining: diffDays,
      labelFa: diffDays === 0 ? 'انقضا: امروز!' : `هشدار انقضا (${diffDays} روز مانده)`,
      labelEn: `Expiring in ${diffDays}d`,
    };
  }
  return {
    status: 'VALID',
    daysRemaining: diffDays,
    labelFa: `معتبر (${diffDays} روز مانده)`,
    labelEn: `Valid (${diffDays}d left)`,
  };
}

function InstructionsDocumentsModuleComponent({
  currentUser,
  language,
}: InstructionsDocumentsModuleProps) {
  const isFa = language === 'fa';
  const isAdmin = isUserAdmin(currentUser);

  // RBAC Permissions
  const canView = isAdmin || hasPermission(currentUser, 'Documents', 'view');
  const canCreate = isAdmin || hasPermission(currentUser, 'Documents', 'create');
  const canEdit = isAdmin || hasPermission(currentUser, 'Documents', 'edit');
  const canDelete = isAdmin || hasPermission(currentUser, 'Documents', 'delete');

  // State
  const [documents, setDocuments] = useState<HseDocumentItem[]>([]);
  const [orgUnits, setOrgUnits] = useState<string[]>(() => {
    const central = getUnits();
    return central.length > 0 ? ['عمومی مجتمع', ...central] : ['عمومی مجتمع'];
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED' | 'EXPIRING' | 'ALL'>('ACTIVE');

  // Upload / Edit Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingDoc, setEditingDoc] = useState<HseDocumentItem | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDocNumber, setFormDocNumber] = useState<string>('');
  const [formCategory, setFormCategory] = useState<HseDocumentCategory>('ORG_PROCEDURES');
  const [formUnitName, setFormUnitName] = useState<string>('عمومی مجتمع');
  const [formIssueDate, setFormIssueDate] = useState<string>(() => moment().format('jYYYY/jMM/jDD'));
  const [formExpiryDate, setFormExpiryDate] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Replace Version Modal State
  const [replaceTargetDoc, setReplaceTargetDoc] = useState<HseDocumentItem | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceChangeNote, setReplaceChangeNote] = useState<string>('');
  const [replaceIssueDate, setReplaceIssueDate] = useState<string>('');
  const [replaceExpiryDate, setReplaceExpiryDate] = useState<string>('');
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // Version History Modal State
  const [historyModalDoc, setHistoryModalDoc] = useState<HseDocumentItem | null>(null);

  // Online Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<{
    doc: HseDocumentItem;
    versionItem: DocumentVersionItem;
    blobUrl: string | null;
    loading: boolean;
    error?: string | null;
  } | null>(null);
  const previewReqIdRef = useRef<number>(0);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imageRotation, setImageRotation] = useState<number>(0);

  // Delete Confirmation Modal State
  const [deleteTargetDoc, setDeleteTargetDoc] = useState<HseDocumentItem | null>(null);

  // Load organization units from DB & Central Org Structure
  useEffect(() => {
    const refreshUnits = () => {
      const loadOrgs = typeof apiDb.getOrgNodes === 'function'
        ? apiDb.getOrgNodes()
        : Promise.resolve([]);

      loadOrgs
        .then((orgData: any) => {
          const names = new Set<string>(['عمومی مجتمع', ...getUnits()]);
          if (orgData) {
            if (Array.isArray(orgData.departments)) {
              orgData.departments.forEach((d: any) => d?.name && names.add(d.name.trim()));
            }
            if (Array.isArray(orgData.units)) {
              orgData.units.forEach((u: any) => u?.name && names.add(u.name.trim()));
            }
            if (Array.isArray(orgData)) {
              orgData.forEach((n: any) => (n?.name || n?.title) && names.add((n.name || n.title).trim()));
            }
          }
          setOrgUnits(Array.from(names));
        })
        .catch(() => {
          setOrgUnits(['عمومی مجتمع', ...getUnits()]);
        });
    };

    refreshUnits();
    window.addEventListener('hse_unit_structure_updated', refreshUnits);
    window.addEventListener('hse_org_nodes_updated', refreshUnits);
    return () => {
      window.removeEventListener('hse_unit_structure_updated', refreshUnits);
      window.removeEventListener('hse_org_nodes_updated', refreshUnits);
    };
  }, []);

  const hasInitialLoadedRef = useRef<boolean>(false);
  const activeBlobUrlRef = useRef<string | null>(null);

  const fetchDocuments = useCallback(async (forceSpinner = false) => {
    if (!canView) {
      setLoading(false);
      return;
    }
    if (!hasInitialLoadedRef.current || forceSpinner) {
      setLoading(true);
    }
    try {
      const list = await apiDb.getDocuments();
      setDocuments(Array.isArray(list) ? list : []);
      hasInitialLoadedRef.current = true;
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    fetchDocuments();

    let debounceTimer: any = null;
    const handleDataMutated = (e: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
      if (entity === 'documents' || entity === 'document' || entity === 'files') {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          apiDb.invalidateCache('documents');
          fetchDocuments(false);
        }, 200);
      }
    };

    const handleSubTabNavigate = (e: any) => {
      if (e?.detail?.tab === 'documents' && e?.detail?.subItem) {
        setSelectedCategory(e.detail.subItem);
      }
    };

    window.addEventListener('hse_data_mutated', handleDataMutated);
    window.addEventListener('hse-navigate-subtab', handleSubTabNavigate);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('hse_data_mutated', handleDataMutated);
      window.removeEventListener('hse-navigate-subtab', handleSubTabNavigate);
    };
  }, [fetchDocuments]);

  // Keep track of active preview blob URL and revoke only on unmount or when replaced
  useEffect(() => {
    if (previewDoc?.blobUrl && previewDoc.blobUrl !== activeBlobUrlRef.current) {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
      activeBlobUrlRef.current = previewDoc.blobUrl;
    } else if (!previewDoc && activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
  }, [previewDoc]);

  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, []);

  // Available units for filter (combining orgUnits and any unit names present in documents)
  const allUnitOptions = useMemo(() => {
    const set = new Set<string>(orgUnits);
    documents.forEach((d) => {
      if (d.unitName && d.unitName.trim()) set.add(d.unitName.trim());
    });
    return Array.from(set);
  }, [orgUnits, documents]);

  // Expiry statistics across active documents
  const expiryAlerts = useMemo(() => {
    const expired: HseDocumentItem[] = [];
    const expiringSoon: HseDocumentItem[] = [];

    documents
      .filter((d) => d.status === 'ACTIVE')
      .forEach((doc) => {
        const exp = evaluateDocumentExpiry(doc.expiryDate);
        if (exp.status === 'EXPIRED') {
          expired.push(doc);
        } else if (exp.status === 'EXPIRING_SOON') {
          expiringSoon.push(doc);
        }
      });

    return { expired, expiringSoon, totalAlerts: expired.length + expiringSoon.length };
  }, [documents]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Status filter
      if (statusFilter === 'ACTIVE' && doc.status !== 'ACTIVE') return false;
      if (statusFilter === 'ARCHIVED' && doc.status !== 'ARCHIVED') return false;
      if (statusFilter === 'EXPIRING') {
        if (doc.status !== 'ACTIVE') return false;
        const exp = evaluateDocumentExpiry(doc.expiryDate);
        if (exp.status !== 'EXPIRED' && exp.status !== 'EXPIRING_SOON') return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL' && doc.category !== selectedCategory) return false;

      // Unit filter
      if (selectedUnit !== 'ALL' && doc.unitName !== selectedUnit) return false;

      // Search query (Title, Document Number, Category, Unit, Description)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const catMeta = DOCUMENT_CATEGORIES.find((c) => c.id === doc.category);
        const catText = `${catMeta?.titleFa || ''} ${catMeta?.titleEn || ''}`.toLowerCase();
        const matches =
          doc.title.toLowerCase().includes(q) ||
          doc.documentNumber.toLowerCase().includes(q) ||
          doc.unitName.toLowerCase().includes(q) ||
          (doc.description || '').toLowerCase().includes(q) ||
          (doc.originalName || '').toLowerCase().includes(q) ||
          catText.includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [documents, statusFilter, selectedCategory, selectedUnit, searchQuery]);

  // Validate selected file client-side before upload
  const validateSelectedFile = (file: File): boolean => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'docx', 'doc', 'xlsx', 'xls'];

    if (!allowedMimes.includes(file.type) && !allowedExts.includes(ext)) {
      toast.error(
        isFa
          ? 'فرمت فایل مجاز نیست. تنها فایل‌های PDF، JPG، PNG، WEBP، Word و Excel مجاز می‌باشند.'
          : 'Invalid file format. Only PDF, JPG, PNG, WEBP, Word, and Excel are allowed.'
      );
      return false;
    }

    const maxBytes = 25 * 1024 * 1024; // 25MB
    if (file.size > maxBytes) {
      toast.error(
        isFa
          ? `حجم فایل بیش از حد مجاز (۲۵ مگابایت) است. حجم فایل انتخابی: ${formatFileSize(file.size)}`
          : `File size exceeds 25MB limit (${formatFileSize(file.size)}).`
      );
      return false;
    }

    return true;
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    if (!canCreate) {
      toast.error(isFa ? 'شما مجوز بارگذاری مستند جدید را ندارید.' : 'Permission denied.');
      return;
    }
    setEditingDoc(null);
    setFormTitle('');
    setFormDocNumber('');
    setFormCategory(
      selectedCategory !== 'ALL' ? (selectedCategory as HseDocumentCategory) : 'ORG_PROCEDURES'
    );
    setFormUnitName(selectedUnit !== 'ALL' ? selectedUnit : orgUnits[0] || 'عمومی مجتمع');
    setFormIssueDate(moment().format('jYYYY/jMM/jDD'));
    setFormExpiryDate('');
    setFormDescription('');
    setSelectedFile(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Metadata Modal
  const handleOpenEditModal = (doc: HseDocumentItem) => {
    if (!canEdit) {
      toast.error(isFa ? 'شما مجوز ویرایش اطلاعات مستندات را ندارید.' : 'Permission denied.');
      return;
    }
    setEditingDoc(doc);
    setFormTitle(doc.title);
    setFormDocNumber(doc.documentNumber);
    setFormCategory(doc.category);
    setFormUnitName(doc.unitName || 'عمومی مجتمع');
    setFormIssueDate(doc.issueDate || '');
    setFormExpiryDate(doc.expiryDate || '');
    setFormDescription(doc.description || '');
    setSelectedFile(null);
    setIsFormModalOpen(true);
  };

  // Submit Create or Edit Metadata
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error(isFa ? 'لطفاً عنوان مستند را وارد نمایید.' : 'Please enter document title.');
      return;
    }
    if (!formDocNumber.trim()) {
      toast.error(isFa ? 'لطفاً شماره مدرک را وارد نمایید.' : 'Please enter document number.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingDoc) {
        // Update metadata
        const res = await apiDb.updateDocument(editingDoc.documentId, {
          title: formTitle.trim(),
          documentNumber: formDocNumber.trim(),
          category: formCategory,
          unitName: formUnitName.trim() || 'عمومی مجتمع',
          issueDate: formIssueDate.trim(),
          expiryDate: formExpiryDate.trim(),
          description: formDescription.trim(),
        });

        if (!res.success) {
          toast.error(res.error || 'خطا در ویرایش اطلاعات مستند');
          return;
        }

        if (res.data) {
          setDocuments((prev) =>
            prev.map((d) => (d.documentId === editingDoc.documentId ? res.data : d))
          );
        }
        try {
          addAuditLog(
            currentUser.username,
            `ویرایش اطلاعات مستند «${formTitle.trim()}» (شماره مدرک: ${formDocNumber.trim()})`,
            'موفق',
            { module: 'دستورالعمل‌ها و مستندات', recordId: editingDoc.documentId }
          );
        } catch {}
        toast.success(isFa ? 'اطلاعات مستند با موفقیت بروزرسانی شد.' : 'Document updated.');
        setIsFormModalOpen(false);
        await fetchDocuments();
      } else {
        // Create new document with file upload
        if (!selectedFile) {
          toast.error(
            isFa
              ? 'لطفاً فایل مستند را انتخاب نمایید.'
              : 'Please select a file to upload.'
          );
          setSubmitting(false);
          return;
        }

        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('title', formTitle.trim());
        fd.append('documentNumber', formDocNumber.trim());
        fd.append('category', formCategory);
        fd.append('unitName', formUnitName.trim() || 'عمومی مجتمع');
        fd.append('issueDate', formIssueDate.trim());
        fd.append('expiryDate', formExpiryDate.trim());
        fd.append('description', formDescription.trim());

        const res = await apiDb.createDocument(fd);
        if (!res.success) {
          toast.error(res.error || 'خطا در بارگذاری و ثبت مستند');
          return;
        }

        if (res.data) {
          setDocuments((prev) => [
            res.data,
            ...prev.filter((d) => d.documentId !== res.data.documentId),
          ]);
        }
        if (statusFilter !== 'ACTIVE' && statusFilter !== 'ALL') {
          setStatusFilter('ACTIVE');
        }
        if (selectedCategory !== 'ALL' && selectedCategory !== formCategory) {
          setSelectedCategory('ALL');
        }
        if (selectedUnit !== 'ALL' && selectedUnit !== (formUnitName.trim() || 'عمومی مجتمع')) {
          setSelectedUnit('ALL');
        }

        try {
          addAuditLog(
            currentUser.username,
            `بارگذاری مستند جدید «${formTitle.trim()}» (شماره مدرک: ${formDocNumber.trim()})`,
            'موفق',
            { module: 'دستورالعمل‌ها و مستندات', recordId: res.data?.documentId }
          );
        } catch {}
        toast.success(
          isFa ? 'مستند جدید با موفقیت در سرور ذخیره و ثبت گردید.' : 'Document uploaded successfully.'
        );
        setIsFormModalOpen(false);
        await fetchDocuments();
      }
    } catch (err: any) {
      toast.error(err?.message || (isFa ? 'خطا در ثبت و بارگذاری مستند' : 'Upload error'));
    } finally {
      setSubmitting(false);
    }
  };

  // Open Replace File (New Version) Modal
  const handleOpenReplaceModal = (doc: HseDocumentItem) => {
    if (!canEdit) {
      toast.error(isFa ? 'شما مجوز جایگزینی نسخه مستند را ندارید.' : 'Permission denied.');
      return;
    }
    setReplaceTargetDoc(doc);
    setReplaceFile(null);
    setReplaceChangeNote('');
    setReplaceIssueDate(moment().format('jYYYY/jMM/jDD'));
    setReplaceExpiryDate(doc.expiryDate || '');
  };

  // Submit Replace File (New Version)
  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceTargetDoc) return;
    if (!replaceFile) {
      toast.error(isFa ? 'لطفاً فایل نسخه جدید را انتخاب کنید.' : 'Please select the new version file.');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', replaceFile);
      fd.append(
        'changeNote',
        replaceChangeNote.trim() || `بازنگری و ارتقا به نسخه ${(replaceTargetDoc.version || 1) + 1}`
      );
      fd.append('issueDate', replaceIssueDate.trim() || replaceTargetDoc.issueDate);
      fd.append('expiryDate', replaceExpiryDate.trim());

      const res = await apiDb.replaceDocumentFile(replaceTargetDoc.documentId, fd);
      if (!res.success) {
        toast.error(res.error || 'خطا در جایگزینی فایل مستند');
        return;
      }

      if (res.data) {
        setDocuments((prev) =>
          prev.map((d) => (d.documentId === replaceTargetDoc.documentId ? res.data : d))
        );
      }

      try {
        addAuditLog(
          currentUser.username,
          `جایگزینی فایل و ثبت نسخه ${(replaceTargetDoc.version || 1) + 1} برای مستند «${replaceTargetDoc.title}»`,
          'موفق',
          { module: 'دستورالعمل‌ها و مستندات', recordId: replaceTargetDoc.documentId }
        );
      } catch {}
      toast.success(
        isFa
          ? `نسخه جدید (ویرایش ${(replaceTargetDoc.version || 1) + 1}) با موفقیت جایگزین و ثبت گردید.`
          : 'New document version uploaded.'
      );
      setReplaceTargetDoc(null);
      await fetchDocuments();
    } catch (err: any) {
      toast.error(err?.message || (isFa ? 'خطا در جایگزینی فایل مستند' : 'Replace error'));
    } finally {
      setSubmitting(false);
    }
  };


  // Confirm Delete Document
  const handleConfirmDelete = async () => {
    if (!deleteTargetDoc || !canDelete) return;
    setSubmitting(true);
    try {
      const res = await apiDb.deleteDocument(deleteTargetDoc.documentId);
      if (!res.success) {
        toast.error(res.error || 'خطا در حذف مستند');
        return;
      }
      addAuditLog(
        currentUser.username,
        `حذف مستند «${deleteTargetDoc.title}» (شماره مدرک: ${deleteTargetDoc.documentNumber})`,
        'موفق',
        { module: 'دستورالعمل‌ها و مستندات', recordId: deleteTargetDoc.documentId }
      );
      toast.success(isFa ? 'مستند با موفقیت از سامانه حذف گردید.' : 'Document deleted.');
      setDeleteTargetDoc(null);
      await fetchDocuments();
    } finally {
      setSubmitting(false);
    }
  };

  // Online Preview Handler
  const handleOpenPreview = async (doc: HseDocumentItem, versionItem?: DocumentVersionItem) => {
    const reqId = ++previewReqIdRef.current;
    const targetVer: DocumentVersionItem = versionItem ||
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

    setImageZoom(1);
    setImageRotation(0);
    setPreviewDoc({
      doc,
      versionItem: targetVer,
      blobUrl: null,
      loading: true,
      error: null,
    });

    const blobUrl = await apiDb.fetchFileBlobUrl(targetVer.fileId, targetVer.mimeType);
    if (reqId !== previewReqIdRef.current) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      return;
    }

    if (!blobUrl) {
      setPreviewDoc({
        doc,
        versionItem: targetVer,
        blobUrl: null,
        loading: false,
        error: isFa
          ? 'فایل فیزیکی این نسخه در سرور یافت نشد (احتمالاً پیش از بروزرسانی کانتینر بارگذاری شده است). می‌توانید از طریق دکمه «جایگزینی فایل» نسخه مدرک را مجدداً بارگذاری نمایید.'
          : 'Document binary file could not be loaded from server. Please re-upload or replace the file.',
      });
      return;
    }

    setPreviewDoc({
      doc,
      versionItem: targetVer,
      blobUrl,
      loading: false,
      error: null,
    });
  };

  // Download Handler
  const handleDownloadFile = async (fileId: string, originalName: string) => {
    const toastId = toast.loading(isFa ? 'در حال دریافت فایل اصلی از سرور...' : 'Downloading file...');
    const ok = await apiDb.downloadFileById(fileId, originalName);
    toast.dismiss(toastId);
    if (ok) {
      toast.success(isFa ? `فایل «${originalName}» دانلود شد.` : 'File downloaded.');
    } else {
      toast.error(isFa ? 'خطا در دانلود فایل از سرور.' : 'Download failed.');
    }
  };

  if (!canView) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-8 text-center space-y-3 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
          {isFa ? 'عدم دسترسی به ماژول دستورالعمل‌ها و مستندات' : 'Access Denied'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {isFa
            ? 'حساب کاربری شما مجوز مشاهده مستندات را ندارد. در صورت نیاز با مدیر سیستم هماهنگ فرمایید.'
            : 'Your account does not have permission to view documents.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir={isFa ? 'rtl' : 'ltr'}>
      {/* ── Top Module Header & Action Bar ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'دستورالعمل‌ها و مستندات سازمانی (HSE DMS)' : 'HSE Instructions & Documents'}
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/60">
                  {isFa ? 'مخزن مرکزی و کنترل نسخه‌ها' : 'Central Document Repository'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isFa
                  ? 'مدیریت یکپارچه روش‌های اجرایی، گواهینامه‌ها و سرتیفیکیت تجهیزات، فرم‌ها، چک‌لیست‌ها و مستندات فنی HSE'
                  : 'Unified management of organizational procedures, machinery certificates, checklists, and HSE documents'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => fetchDocuments(true)}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title={isFa ? 'بروزرسانی لیست از سرور' : 'Refresh'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-500' : ''}`} />
              <span>{isFa ? 'بروزرسانی' : 'Refresh'}</span>
            </button>

            {canCreate && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white text-xs font-black flex items-center gap-2 shadow-sm shadow-sky-600/20 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{isFa ? 'بارگذاری مستند جدید' : 'Upload New Document'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ── 4 Category Cards Strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
          {DOCUMENT_CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const count = documents.filter(
              (d) =>
                d.category === cat.id &&
                (statusFilter === 'ARCHIVED' ? d.status === 'ARCHIVED' : d.status === 'ACTIVE')
            ).length;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? 'ALL' : cat.id)}
                className={`text-right p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? `${cat.bgLight} ${cat.borderLight} ring-2 ring-sky-500/30 shadow-xs`
                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cat.bgLight} border ${cat.borderLight}`}
                  >
                    <CatIcon className={`w-5 h-5 ${cat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                      {isFa ? cat.titleFa : cat.titleEn}
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                      {isFa ? `${count} مدرک ثبت‌شده` : `${count} documents`}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-xs font-mono font-black px-2 py-0.5 rounded-lg tabular-nums ${
                    isSelected
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Certificate & Document Expiry Warning Banner ── */}
      {expiryAlerts.totalAlerts > 0 && (
        <div className="bg-amber-50/95 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800/70 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-amber-900 dark:text-amber-200">
                {isFa
                  ? 'هشدار اعتبار گواهینامه‌ها و مستندات دارای تاریخ انقضا'
                  : 'Certificate & Document Expiry Warning'}
              </h3>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5 font-bold">
                {isFa ? (
                  <>
                    {expiryAlerts.expired.length > 0 && (
                      <span className="text-rose-600 dark:text-rose-400 font-black ml-2">
                        • {expiryAlerts.expired.length} مستند/گواهینامه منقضی شده
                      </span>
                    )}
                    {expiryAlerts.expiringSoon.length > 0 && (
                      <span>
                        • {expiryAlerts.expiringSoon.length} مستند/گواهینامه در آستانه انقضا (کمتر از ۳۰ روز)
                      </span>
                    )}
                  </>
                ) : (
                  `${expiryAlerts.expired.length} expired, ${expiryAlerts.expiringSoon.length} expiring within 30 days.`
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === 'EXPIRING' ? 'ACTIVE' : 'EXPIRING')
            }
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
              statusFilter === 'EXPIRING'
                ? 'bg-amber-700 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
          >
            {statusFilter === 'EXPIRING'
              ? isFa
                ? 'نمایش همه مستندات فعال'
                : 'Show All Active'
              : isFa
              ? 'مشاهده موارد نیازمند تمدید'
              : 'View Expiring Docs'}
          </button>
        </div>
      )}

      {/* ── Search & Multi-Facet Filter Bar ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
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
                  ? 'جست‌وجو بر اساس عنوان، شماره مدرک، واحد یا توضیحات...'
                  : 'Search by title, document code, unit...'
              }
              className={`w-full ${
                isFa ? 'pr-10 pl-8' : 'pl-10 pr-8'
              } py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-800 dark:text-slate-100`}
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

          {/* Category Select */}
          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">
                {isFa ? 'همه دسته‌بندی‌های مستندات' : 'All Document Categories'}
              </option>
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {isFa ? c.titleFa : c.titleEn}
                </option>
              ))}
            </select>
          </div>

          {/* Organizational Unit Select */}
          <div className="md:col-span-2">
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">{isFa ? 'همه واحدهای سازمانی' : 'All Units'}</option>
              {allUnitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter Tabs */}
          <div className="md:col-span-2 flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition cursor-pointer ${
                statusFilter === 'ACTIVE'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {isFa ? 'فعال' : 'Active'}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('EXPIRING')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition cursor-pointer ${
                statusFilter === 'EXPIRING'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {isFa ? 'انقضا' : 'Expiring'}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ARCHIVED')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition cursor-pointer ${
                statusFilter === 'ARCHIVED'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {isFa ? 'آرشیو' : 'Archived'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Documents Table / Repository List ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-xs font-bold text-slate-500">
              {isFa ? 'در حال فراخوانی مستندات از پایگاه داده سرور...' : 'Loading documents...'}
            </div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div className="text-sm font-black text-slate-700 dark:text-slate-200">
              {isFa ? 'هیچ مستندی با فیلترهای انتخابی یافت نشد' : 'No documents found'}
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {isFa
                ? 'برای ثبت دستورالعمل، روش اجرایی، گواهینامه تجهیزات یا فرم سازمانی جدید از دکمه «بارگذاری مستند جدید» استفاده نمایید.'
                : 'Use the "Upload New Document" button to add PDF or image documents.'}
            </p>
            {canCreate && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isFa ? 'بارگذاری اولین مستند' : 'Upload Document'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-black text-slate-600 dark:text-slate-300">
                  <th className="py-3.5 px-4">{isFa ? 'عنوان و مشخصات مدرک' : 'Document Title'}</th>
                  <th className="py-3.5 px-3">{isFa ? 'شماره مدرک' : 'Doc Code'}</th>
                  <th className="py-3.5 px-3">{isFa ? 'دسته‌بندی' : 'Category'}</th>
                  <th className="py-3.5 px-3">{isFa ? 'واحد مربوطه' : 'Unit'}</th>
                  <th className="py-3.5 px-3">{isFa ? 'تاریخ صدور / انقضا' : 'Issue / Expiry'}</th>
                  <th className="py-3.5 px-3 text-center">{isFa ? 'نسخه و فرمت' : 'Version & Type'}</th>
                  <th className="py-3.5 px-4 text-left">{isFa ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {filteredDocuments.map((doc) => {
                  const catMeta =
                    DOCUMENT_CATEGORIES.find((c) => c.id === doc.category) ||
                    DOCUMENT_CATEGORIES[0];
                  const CatIcon = catMeta.icon;
                  const expInfo = evaluateDocumentExpiry(doc.expiryDate);
                  const isPdf = doc.mimeType === 'application/pdf';

                  return (
                    <tr
                      key={doc.documentId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Title & Description */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              isPdf
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/50'
                                : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50'
                            }`}
                          >
                            {isPdf ? (
                              <FileText className="w-4.5 h-4.5" />
                            ) : (
                              <ImageIcon className="w-4.5 h-4.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenPreview(doc);
                                }}
                                className="hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer transition-colors"
                              >
                                {doc.title}
                              </span>
                              {doc.status === 'ARCHIVED' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                                  {isFa ? 'آرشیو شده' : 'Archived'}
                                </span>
                              )}
                            </div>
                            {doc.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                {doc.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Document Number */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="font-mono font-black text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700">
                          {doc.documentNumber}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${catMeta.bgLight} ${catMeta.color} border ${catMeta.borderLight}`}
                        >
                          <CatIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{isFa ? catMeta.shortFa : catMeta.titleEn}</span>
                        </span>
                      </td>

                      {/* Unit */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{doc.unitName || 'عمومی مجتمع'}</span>
                        </div>
                      </td>

                      {/* Issue / Expiry Date & Status */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 font-bold">
                            <span>{isFa ? 'صدور: ' : 'Issued: '}</span>
                            <span className="font-mono">{doc.issueDate || '-'}</span>
                          </div>
                          {doc.expiryDate ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black ${
                                  expInfo.status === 'EXPIRED'
                                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                    : expInfo.status === 'EXPIRING_SOON'
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                                }`}
                              >
                                {expInfo.status === 'EXPIRED' ||
                                expInfo.status === 'EXPIRING_SOON' ? (
                                  <AlertTriangle className="w-3 h-3" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                <span>{isFa ? expInfo.labelFa : expInfo.labelEn}</span>
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold">
                              {isFa ? 'بدون انقضا / دائمی' : 'No Expiry'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Version & Format */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setHistoryModalDoc(doc)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/50 text-slate-700 dark:text-slate-300 hover:text-sky-600 font-mono font-black text-[11px] border border-slate-200 dark:border-slate-700 cursor-pointer transition"
                            title={isFa ? 'مشاهده تاریخچه نسخه‌ها' : 'Version History'}
                          >
                            <History className="w-3 h-3" />
                            <span>v{doc.version || 1}</span>
                            {doc.versions?.length > 1 && (
                              <span className="text-[9px] text-sky-600 dark:text-sky-400">
                                ({doc.versions.length})
                              </span>
                            )}
                          </button>
                          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                            {doc.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Online Preview */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPreview(doc);
                            }}
                            className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/70 text-sky-600 dark:text-sky-400 transition cursor-pointer"
                            title={isFa ? 'مشاهده آنلاین مدرک' : 'Preview Document'}
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Download Original File */}
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(doc.fileId, doc.originalName)}
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 text-emerald-600 dark:text-emerald-400 transition cursor-pointer"
                            title={isFa ? 'دانلود فایل اصلی' : 'Download File'}
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Version History */}
                          <button
                            type="button"
                            onClick={() => setHistoryModalDoc(doc)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                            title={isFa ? 'مدیریت و تاریخچه نسخه‌ها' : 'Version History'}
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Replace File (Upload New Version) */}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOpenReplaceModal(doc)}
                              className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-600 dark:text-indigo-400 transition cursor-pointer"
                              title={isFa ? 'جایگزینی فایل (ثبت نسخه جدید)' : 'Replace File / New Version'}
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          )}

                          {/* Edit Metadata */}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(doc)}
                              className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/70 text-amber-600 dark:text-amber-400 transition cursor-pointer"
                              title={isFa ? 'ویرایش اطلاعات مدرک' : 'Edit Metadata'}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}


                          {/* Delete */}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTargetDoc(doc)}
                              className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/70 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                              title={isFa ? 'حذف مدرک' : 'Delete Document'}
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

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 1: UPLOAD NEW DOCUMENT / EDIT METADATA
      ══════════════════════════════════════════════════════════════════════════ */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[10050] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  {editingDoc ? <Edit3 className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
                    {editingDoc
                      ? isFa
                        ? 'ویرایش مشخصات مستند'
                        : 'Edit Document Metadata'
                      : isFa
                      ? 'بارگذاری و ثبت مستند جدید'
                      : 'Upload New Document'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-bold">
                    {isFa
                      ? 'فرمت‌های مجاز: PDF، JPG، PNG و WEBP (حداکثر ۲۵ مگابایت)'
                      : 'Allowed formats: PDF, JPG, PNG, WEBP (Max 25MB)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Title */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                    {isFa ? 'عنوان مستند / گواهینامه *' : 'Document Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={
                      isFa
                        ? 'مثلاً: دستورالعمل اجرایی کار در ارتفاع / گواهینامه سلامت فنی جرثقیل ۵۰ تن'
                        : 'e.g., Working at Height Procedure'
                    }
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Document Number */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                    {isFa ? 'شماره مدرک / کد سرتیفیکیت *' : 'Document Number *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formDocNumber}
                    onChange={(e) => setFormDocNumber(e.target.value)}
                    placeholder={isFa ? 'مثلاً: HSE-PR-104 یا CERT-2026-09' : 'e.g., HSE-PR-104'}
                    className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                    {isFa ? 'دسته‌بندی مستند *' : 'Category *'}
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as HseDocumentCategory)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-800 dark:text-slate-100"
                  >
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {isFa ? c.titleFa : c.titleEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Organizational Unit */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                    {isFa ? 'واحد سازمانی مربوطه *' : 'Organizational Unit *'}
                  </label>
                  <input
                    type="text"
                    list="hse-doc-org-units-list"
                    required
                    value={formUnitName}
                    onChange={(e) => setFormUnitName(e.target.value)}
                    placeholder={isFa ? 'انتخاب یا تایپ نام واحد سازمانی...' : 'Select or type unit...'}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-800 dark:text-slate-100"
                  />
                  <datalist id="hse-doc-org-units-list">
                    {allUnitOptions.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>

                {/* Issue Date */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                    {isFa ? 'تاریخ صدور / تصویب' : 'Issue Date'}
                  </label>
                  <input
                    type="text"
                    value={formIssueDate}
                    onChange={(e) => setFormIssueDate(e.target.value)}
                    placeholder="1405/07/01"
                    className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Expiry Date */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                    {isFa
                      ? 'تاریخ انقضا (ویژه گواهینامه‌ها و سرتیفیکیت‌ها)'
                      : 'Expiry Date (For Certificates)'}
                  </label>
                  <input
                    type="text"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    placeholder={isFa ? 'مثلاً 1406/07/01 (اختیاری)' : 'e.g., 1406/07/01'}
                    className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                    {isFa ? 'توضیحات و دامنه کاربرد' : 'Description'}
                  </label>
                  <textarea
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder={
                      isFa
                        ? 'شرح مختصر مستند، دامنه شمول، شماره سریال تجهیز یا نکات ممیزی...'
                        : 'Document description, equipment serial number, or scope...'
                    }
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-800 dark:text-slate-100 resize-none"
                  />
                </div>

                {/* File Upload Dropzone (Only when creating new document) */}
                {!editingDoc && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                      {isFa ? 'فایل مستند (PDF، Word، Excel، JPG، PNG، WEBP) *' : 'Document File *'}
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.xlsx,.xls,application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f && validateSelectedFile(f)) {
                          setSelectedFile(f);
                        } else if (f) {
                          e.target.value = '';
                        }
                      }}
                      className="hidden"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 rounded-2xl p-5 text-center cursor-pointer transition bg-slate-50/60 dark:bg-slate-800/40"
                    >
                      {selectedFile ? (
                        <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                          <div className="flex items-center gap-2.5 min-w-0 text-right">
                            <FileCheck2 className="w-5 h-5 text-emerald-500 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                                {selectedFile.name}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Standard File'}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Upload className="w-7 h-7 text-sky-500 mx-auto" />
                          <div className="text-xs font-black text-slate-700 dark:text-slate-200">
                            {isFa
                              ? 'برای انتخاب فایل کلیک کنید (PDF، JPG، PNG، WEBP)'
                              : 'Click to select PDF, JPG, PNG, or WEBP file'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {isFa
                              ? 'بررسی امنیتی نوع واقعی فایل (Magic Bytes) و ذخیره‌سازی پایدار در سرور'
                              : 'Validated and stored securely on server'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-black shadow-sm shadow-sky-600/20 cursor-pointer"
                >
                  {submitting
                    ? isFa
                      ? 'در حال ذخیره‌سازی...'
                      : 'Saving...'
                    : editingDoc
                    ? isFa
                      ? 'ذخیره تغییرات'
                      : 'Save Changes'
                    : isFa
                    ? 'ثبت و بارگذاری مستند'
                    : 'Upload Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 2: REPLACE FILE & CREATE NEW VERSION
      ══════════════════════════════════════════════════════════════════════════ */}
      {replaceTargetDoc && (
        <div className="fixed inset-0 z-[10050] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
                  {isFa
                    ? `جایگزینی فایل و انتشار نسخه جدید (ویرایش ${(replaceTargetDoc.version || 1) + 1})`
                    : `Replace File (Version ${(replaceTargetDoc.version || 1) + 1})`}
                </h3>
                <p className="text-[11px] text-slate-500 font-bold mt-0.5">
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
                <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                  {isFa ? 'فایل نسخه جدید (PDF، Word، Excel، JPG، PNG، WEBP) *' : 'New Version File *'}
                </label>
                <input
                  ref={replaceFileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.xlsx,.xls,application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && validateSelectedFile(f)) {
                      setReplaceFile(f);
                    } else if (f) {
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />
                <div
                  onClick={() => replaceFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-2xl p-4 text-center cursor-pointer transition bg-slate-50 dark:bg-slate-800/40"
                >
                  {replaceFile ? (
                    <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {replaceFile.name} ({formatFileSize(replaceFile.size)})
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {isFa ? 'انتخاب فایل نسخه جدید از سیستم' : 'Select replacement file'}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1">
                    {isFa ? 'تاریخ صدور نسخه جدید' : 'New Issue Date'}
                  </label>
                  <input
                    type="text"
                    value={replaceIssueDate}
                    onChange={(e) => setReplaceIssueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1">
                    {isFa ? 'تاریخ انقضای جدید' : 'New Expiry Date'}
                  </label>
                  <input
                    type="text"
                    value={replaceExpiryDate}
                    onChange={(e) => setReplaceExpiryDate(e.target.value)}
                    placeholder={isFa ? 'اختیاری' : 'Optional'}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'علت بازنگری / شرح تغییرات نسخه جدید' : 'Revision / Change Note'}
                </label>
                <input
                  type="text"
                  value={replaceChangeNote}
                  onChange={(e) => setReplaceChangeNote(e.target.value)}
                  placeholder={
                    isFa
                      ? 'مثلاً: تمدید گواهینامه سالانه / بازنگری بخش چهارم دستورالعمل'
                      : 'e.g., Annual certificate renewal'
                  }
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReplaceTargetDoc(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer"
                >
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !replaceFile}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
                >
                  {submitting
                    ? isFa
                      ? 'در حال بارگذاری...'
                      : 'Uploading...'
                    : isFa
                    ? 'ثبت و جایگزینی نسخه'
                    : 'Replace Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 3: VERSION HISTORY MODAL
      ══════════════════════════════════════════════════════════════════════════ */}
      {historyModalDoc && (
        <div className="fixed inset-0 z-[10050] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
                    {isFa ? 'تاریخچه نسخه‌ها و سوابق بازنگری مدرک' : 'Document Version History'}
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">
                    {historyModalDoc.title} — <span className="font-mono">{historyModalDoc.documentNumber}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalDoc(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {(historyModalDoc.versions || []).map((ver, idx) => (
                <div
                  key={ver.fileId}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    idx === 0
                      ? 'bg-sky-50/50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/60'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-sky-600 text-white font-mono font-black text-[11px]">
                        v{ver.version}
                      </span>
                      {idx === 0 && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          {isFa ? 'نسخه جاری (فعال)' : 'Current Version'}
                        </span>
                      )}
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                        {ver.originalName}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        ({formatFileSize(ver.fileSize)})
                      </span>
                    </div>
                    {ver.changeNote && (
                      <div className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                        {ver.changeNote}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 font-bold flex flex-wrap items-center gap-3">
                      <span>
                        {isFa ? 'بارگذاری توسط: ' : 'By: '}
                        {ver.uploadedBy}
                      </span>
                      <span>
                        {isFa ? 'تاریخ ثبت: ' : 'Date: '}
                        {moment(ver.createdAt).format('jYYYY/jMM/jDD HH:mm')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const targetDoc = historyModalDoc;
                        setHistoryModalDoc(null);
                        handleOpenPreview(targetDoc, ver);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isFa ? 'مشاهده' : 'Preview'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(ver.fileId, ver.originalName)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isFa ? 'دانلود' : 'Download'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 4: ONLINE PDF & IMAGE PREVIEWER
      ══════════════════════════════════════════════════════════════════════════ */}
      {previewDoc && (
        <div className="fixed inset-0 z-[10060] bg-slate-950/80 backdrop-blur-xs flex flex-col p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-2xl max-w-6xl w-full mx-auto">
            {/* Preview Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                      {previewDoc.doc.title}
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-mono text-[10px] font-black">
                      v{previewDoc.versionItem.version}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-bold truncate">
                    {isFa ? 'شماره مدرک: ' : 'Code: '}
                    <span className="font-mono">{previewDoc.doc.documentNumber}</span> •{' '}
                    {previewDoc.doc.unitName}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Version Selector in Preview */}
                {previewDoc.doc.versions && previewDoc.doc.versions.length > 1 && (
                  <select
                    value={previewDoc.versionItem.fileId}
                    onChange={(e) => {
                      const found = previewDoc.doc.versions.find((v) => v.fileId === e.target.value);
                      if (found) handleOpenPreview(previewDoc.doc, found);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  >
                    {previewDoc.doc.versions.map((v) => (
                      <option key={v.fileId} value={v.fileId}>
                        {isFa ? `نسخه v${v.version}` : `v${v.version}`}
                      </option>
                    ))}
                  </select>
                )}

                {/* Image Zoom/Rotate Controls */}
                {previewDoc.versionItem.mimeType.startsWith('image/') && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                      className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                      title={isFa ? 'بزرگ‌نمایی' : 'Zoom In'}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                      className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                      title={isFa ? 'کوچک‌نمایی' : 'Zoom Out'}
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageRotation((r) => (r + 90) % 360)}
                      className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                      title={isFa ? 'چرخش ۹۰ درجه' : 'Rotate'}
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Download Button */}
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadFile(
                      previewDoc.versionItem.fileId,
                      previewDoc.versionItem.originalName
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isFa ? 'دانلود فایل اصلی' : 'Download'}</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    previewReqIdRef.current++;
                    setPreviewDoc(null);
                  }}
                  className="p-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Viewport */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 overflow-auto flex items-center justify-center relative">
              {previewDoc.loading ? (
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <div className="text-xs font-bold text-slate-500">
                    {isFa ? 'در حال آماده‌سازی نمایش آنلاین مستند...' : 'Loading preview...'}
                  </div>
                </div>
              ) : previewDoc.blobUrl ? (
                previewDoc.versionItem.mimeType === 'application/pdf' ||
                previewDoc.versionItem.originalName?.toLowerCase().endsWith('.pdf') ? (
                  <div className="w-full h-full flex flex-col">
                    <PdfDocumentViewer
                      fileId={previewDoc.versionItem.fileId}
                      fileData={previewDoc.blobUrl}
                      fileName={previewDoc.versionItem.originalName || `${previewDoc.doc.title}.pdf`}
                      displayName={`${previewDoc.doc.title} (${previewDoc.doc.documentNumber})`}
                      language={language}
                      onDownload={() =>
                        handleDownloadFile(
                          previewDoc.versionItem.fileId,
                          previewDoc.versionItem.originalName
                        )
                      }
                    />
                  </div>
                ) : (
                  <div className="p-6 overflow-auto flex items-center justify-center w-full h-full">
                    <img
                      src={previewDoc.blobUrl}
                      alt={previewDoc.doc.title}
                      style={{
                        transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                        transition: 'transform 0.2s ease',
                      }}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    />
                  </div>
                )
              ) : (
                <div className="max-w-md mx-auto p-6 text-center space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg m-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {isFa ? 'عدم دسترسی به فایل فیزیکی مستند' : 'Document File Unavailable'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
                      {previewDoc.error ||
                        (isFa
                          ? 'فایل این مستند در سرور قابل بارگذاری نمی‌باشد.'
                          : 'Unable to load document file.')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(previewDoc.doc, previewDoc.versionItem)}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                    >
                      {isFa ? 'تلاش مجدد' : 'Retry'}
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          const targetDoc = previewDoc.doc;
                          setPreviewDoc(null);
                          handleOpenReplaceModal(targetDoc);
                        }}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isFa ? 'بارگذاری مجدد / جایگزینی فایل' : 'Replace File'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 5: DELETE CONFIRMATION MODAL
      ══════════════════════════════════════════════════════════════════════════ */}
      {deleteTargetDoc && (
        <div className="fixed inset-0 z-[10060] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
                {isFa ? 'تأیید حذف مستند از سامانه' : 'Confirm Document Deletion'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isFa
                  ? `آیا از حذف مستند «${deleteTargetDoc.title}» (شماره مدرک: ${deleteTargetDoc.documentNumber}) اطمینان دارید؟`
                  : `Are you sure you want to delete "${deleteTargetDoc.title}"?`}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetDoc(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
              >
                {submitting ? (isFa ? 'در حال حذف...' : 'Deleting...') : isFa ? 'بله، حذف شود' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const InstructionsDocumentsModule = React.memo(
  InstructionsDocumentsModuleComponent,
  (prev, next) =>
    prev.language === next.language &&
    prev.currentUser?.id === next.currentUser?.id &&
    prev.currentUser?.role === next.currentUser?.role &&
    prev.currentUser?.username === next.currentUser?.username
);

export default InstructionsDocumentsModule;

