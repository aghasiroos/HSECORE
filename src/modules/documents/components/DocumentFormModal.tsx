import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Paperclip,
  Trash2,
  ShieldCheck,
  ClipboardList,
  FolderOpen,
  Link2,
} from 'lucide-react';
import moment from 'moment-jalaali';
import { toast } from 'react-hot-toast';
import { apiDb } from '../../../services/apiDatabaseClient';
import { addAuditLog } from '../../../utils/authHelper';
import { formatFileSize } from '../../../utils/fileHelpers';
import { UserProfile } from '../../../types';
import {
  ATTACHMENT_ROLES_BY_CATEGORY,
  CERTIFICATE_TYPES,
  DocumentTabMetadata,
  FORM_HSE_DOMAINS,
  HseDocumentCategory,
  HseDocumentItem,
  OTHER_TOPIC_CATEGORIES,
  PROMULGATION_STATUS_LABELS,
} from '../types';

export interface EquipmentSuggestion {
  code: string;
  name: string;
  location?: string;
}

interface QueuedExtraFile {
  file: File;
  role: string;
  title: string;
}

interface DocumentFormModalProps {
  isOpen: boolean;
  category: HseDocumentCategory;
  editingDoc: HseDocumentItem | null;
  orgUnits: string[];
  equipmentOptions: EquipmentSuggestion[];
  currentUser: UserProfile;
  isFa: boolean;
  onClose: () => void;
  onSaved: (savedDoc?: HseDocumentItem) => Promise<void> | void;
}

const CATEGORY_HEADER_META: Record<
  HseDocumentCategory,
  { fa: string; en: string; codePlaceholder: string; titleLabelFa: string; codeLabelFa: string; dateLabelFa: string }
> = {
  ORG_PROCEDURES: {
    fa: 'دستورالعمل‌ها و روش‌های اجرایی سازمانی',
    en: 'Organizational Instructions & Procedures',
    codePlaceholder: 'مثلاً: HSE-WI-014',
    titleLabelFa: 'عنوان دستورالعمل / روش اجرایی *',
    codeLabelFa: 'کد / شناسه مستند *',
    dateLabelFa: 'تاریخ تهیه / صدور',
  },
  EQUIPMENT_CERTIFICATES: {
    fa: 'گواهینامه‌ها و سرتیفیکیت ماشین‌آلات و تجهیزات',
    en: 'Machinery & Equipment Certificates',
    codePlaceholder: 'مثلاً: CERT-CRN-1405-08',
    titleLabelFa: 'نام ماشین‌آلات / تجهیز *',
    codeLabelFa: 'کد گواهینامه *',
    dateLabelFa: 'تاریخ صدور گواهینامه',
  },
  ORG_FORMS_CHECKLISTS: {
    fa: 'فرم‌ها و چک‌لیست‌های سازمانی',
    en: 'Organizational Forms & Checklists',
    codePlaceholder: 'مثلاً: HSE-FRM-022',
    titleLabelFa: 'عنوان فرم / چک‌لیست مصوب *',
    codeLabelFa: 'کد فرم مصوب *',
    dateLabelFa: 'تاریخ تدوین / اعتبار فرم',
  },
  OTHER_HSE_DOCS: {
    fa: 'سایر مستندات مرتبط با HSE',
    en: 'Other HSE Related Documents',
    codePlaceholder: 'مثلاً: HSE-REF-009',
    titleLabelFa: 'عنوان مستند / استاندارد / بخشنامه *',
    codeLabelFa: 'کد یا شماره مرجع مستند *',
    dateLabelFa: 'تاریخ صدور / انتشار',
  },
};

function validateSelectedFile(file: File, isFa: boolean): boolean {
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
        : 'Invalid file format.'
    );
    return false;
  }

  if (file.size > 25 * 1024 * 1024) {
    toast.error(
      isFa
        ? `حجم فایل بیش از ۲۵ مگابایت است (${formatFileSize(file.size)}).`
        : 'File size exceeds 25MB limit.'
    );
    return false;
  }

  return true;
}

export const DocumentFormModal: React.FC<DocumentFormModalProps> = ({
  isOpen,
  category,
  editingDoc,
  orgUnits,
  equipmentOptions,
  currentUser,
  isFa,
  onClose,
  onSaved,
}) => {
  const metaCfg = CATEGORY_HEADER_META[category];
  const extraRoles = ATTACHMENT_ROLES_BY_CATEGORY[category] || ATTACHMENT_ROLES_BY_CATEGORY.OTHER_HSE_DOCS;

  const [title, setTitle] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [unitName, setUnitName] = useState(orgUnits[0] || 'عمومی مجتمع');
  const [issueDate, setIssueDate] = useState(() => moment().format('jYYYY/jMM/jDD'));
  const [expiryDate, setExpiryDate] = useState('');
  const [description, setDescription] = useState('');
  const [primaryFile, setPrimaryFile] = useState<File | null>(null);
  const [queuedExtras, setQueuedExtras] = useState<QueuedExtraFile[]>([]);
  const [extraRoleDraft, setExtraRoleDraft] = useState<string>(extraRoles[0]?.id || 'OTHER');
  const [submitting, setSubmitting] = useState(false);

  // Tab 1 fields
  const [revisionCode, setRevisionCode] = useState('Rev.00');
  const [revisionDate, setRevisionDate] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [promulgationStatus, setPromulgationStatus] = useState<
    'PROMULGATED' | 'UNDER_REVISION' | 'DRAFT' | 'OBSOLETE'
  >('PROMULGATED');

  // Tab 2 fields
  const [equipmentSerialOrModel, setEquipmentSerialOrModel] = useState('');
  const [linkedEquipmentCode, setLinkedEquipmentCode] = useState('');
  const [linkedEquipmentName, setLinkedEquipmentName] = useState('');
  const [certificateType, setCertificateType] = useState(CERTIFICATE_TYPES[0]);
  const [inspectionCompany, setInspectionCompany] = useState('');
  const [renewalStatus, setRenewalStatus] = useState<'AUTO' | 'PENDING_RENEWAL'>('AUTO');

  // Tab 3 fields
  const [hseDomain, setHseDomain] = useState(FORM_HSE_DOMAINS[0]);

  // Tab 4 fields
  const [topicCategory, setTopicCategory] = useState<
    'STANDARDS' | 'CIRCULARS' | 'SPECIALIZED_GUIDES' | 'REFERENCE_REPORTS' | 'OTHER'
  >('STANDARDS');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [tags, setTags] = useState('');

  const primaryInputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const defaultRole =
      ATTACHMENT_ROLES_BY_CATEGORY[category]?.[0]?.id || 'OTHER';
    setExtraRoleDraft(defaultRole);
    setPrimaryFile(null);
    setQueuedExtras([]);

    if (editingDoc) {
      const tm = editingDoc.tabMetadata || {};
      setTitle(editingDoc.title || '');
      setDocumentNumber(editingDoc.documentNumber || '');
      setUnitName(editingDoc.unitName || orgUnits[0] || 'عمومی مجتمع');
      setIssueDate(editingDoc.issueDate || '');
      setExpiryDate(editingDoc.expiryDate || '');
      setDescription(editingDoc.description || '');

      // Tab 1
      setRevisionCode(tm.revisionCode || `Rev.0${Math.max(0, (editingDoc.version || 1) - 1)}`);
      setRevisionDate(tm.revisionDate || '');
      setPreparedBy(tm.preparedBy || '');
      setApprovedBy(tm.approvedBy || '');
      setPromulgationStatus(tm.promulgationStatus || 'PROMULGATED');

      // Tab 2
      setEquipmentSerialOrModel(tm.equipmentSerialOrModel || '');
      setLinkedEquipmentCode(tm.linkedEquipmentCode || '');
      setLinkedEquipmentName(tm.linkedEquipmentName || '');
      setCertificateType(tm.certificateType || CERTIFICATE_TYPES[0]);
      setInspectionCompany(tm.inspectionCompany || '');
      setRenewalStatus(tm.renewalStatus || 'AUTO');

      // Tab 3
      setHseDomain(tm.hseDomain || FORM_HSE_DOMAINS[0]);

      // Tab 4
      setTopicCategory(tm.topicCategory || 'STANDARDS');
      setIssuingAuthority(tm.issuingAuthority || '');
      setTags(tm.tags || '');
    } else {
      setTitle('');
      setDocumentNumber('');
      setUnitName(orgUnits[0] || 'عمومی مجتمع');
      setIssueDate(moment().format('jYYYY/jMM/jDD'));
      setExpiryDate('');
      setDescription('');

      setRevisionCode('Rev.00');
      setRevisionDate('');
      setPreparedBy(currentUser.fullName || currentUser.username || '');
      setApprovedBy('');
      setPromulgationStatus('PROMULGATED');

      setEquipmentSerialOrModel('');
      setLinkedEquipmentCode('');
      setLinkedEquipmentName('');
      setCertificateType(CERTIFICATE_TYPES[0]);
      setInspectionCompany('');
      setRenewalStatus('AUTO');

      setHseDomain(FORM_HSE_DOMAINS[0]);

      setTopicCategory('STANDARDS');
      setIssuingAuthority('');
      setTags('');
    }
  }, [isOpen, editingDoc, category, orgUnits, currentUser]);

  if (!isOpen) return null;

  const buildTabMetadata = (): DocumentTabMetadata => {
    if (category === 'ORG_PROCEDURES') {
      return {
        revisionCode: revisionCode.trim(),
        revisionDate: revisionDate.trim(),
        preparedBy: preparedBy.trim(),
        approvedBy: approvedBy.trim(),
        promulgationStatus,
      };
    }
    if (category === 'EQUIPMENT_CERTIFICATES') {
      return {
        equipmentSerialOrModel: equipmentSerialOrModel.trim(),
        linkedEquipmentCode: linkedEquipmentCode.trim(),
        linkedEquipmentName: linkedEquipmentName.trim(),
        certificateType: certificateType.trim(),
        inspectionCompany: inspectionCompany.trim(),
        renewalStatus,
      };
    }
    if (category === 'ORG_FORMS_CHECKLISTS') {
      return {
        hseDomain: hseDomain.trim(),
        revisionCode: revisionCode.trim(),
      };
    }
    return {
      topicCategory,
      issuingAuthority: issuingAuthority.trim(),
      tags: tags.trim(),
    };
  };

  const handleLinkedEquipmentChange = (val: string) => {
    setLinkedEquipmentCode(val);
    const match = equipmentOptions.find(
      (eq) => eq.code.toLowerCase() === val.trim().toLowerCase()
    );
    if (match) {
      setLinkedEquipmentName(match.name);
      if (!title.trim()) {
        setTitle(match.name);
      }
    }
  };

  const handleExtraFilesPicked = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const valid: QueuedExtraFile[] = [];
    Array.from(files).forEach((f) => {
      if (validateSelectedFile(f, isFa)) {
        valid.push({
          file: f,
          role: extraRoleDraft,
          title: f.name,
        });
      }
    });
    if (valid.length > 0) {
      setQueuedExtras((prev) => [...prev, ...valid]);
    }
    if (extraInputRef.current) extraInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error(isFa ? 'لطفاً عنوان را وارد نمایید.' : 'Please enter title.');
      return;
    }
    if (!documentNumber.trim()) {
      toast.error(isFa ? 'لطفاً کد / شماره مدرک را وارد نمایید.' : 'Please enter document code.');
      return;
    }
    if (category === 'EQUIPMENT_CERTIFICATES' && !expiryDate.trim()) {
      toast.error(
        isFa
          ? 'برای گواهینامه‌های تجهیزات وارد کردن تاریخ انقضا الزامی است.'
          : 'Expiry date is required for equipment certificates.'
      );
      return;
    }

    const tabMetadata = buildTabMetadata();
    setSubmitting(true);
    try {
      if (editingDoc) {
        const res = await apiDb.updateDocument(editingDoc.documentId, {
          title: title.trim(),
          documentNumber: documentNumber.trim(),
          category,
          unitName: unitName.trim() || 'عمومی مجتمع',
          issueDate: issueDate.trim(),
          expiryDate: expiryDate.trim(),
          description: description.trim(),
          tabMetadata,
        });

        if (!res.success) {
          toast.error(res.error || 'خطا در بروزرسانی اطلاعات مستند');
          return;
        }

        try {
          addAuditLog(
            currentUser.username,
            `ویرایش مستند «${title.trim()}» در بخش «${metaCfg.fa}» (${documentNumber.trim()})`,
            'موفق',
            { module: 'دستورالعمل‌ها و مستندات', recordId: editingDoc.documentId }
          );
        } catch {}

        toast.success(isFa ? 'اطلاعات مستند با موفقیت بروزرسانی شد.' : 'Document updated.');
        onClose();
        await onSaved(res.data);
      } else {
        if (!primaryFile) {
          toast.error(isFa ? 'لطفاً فایل اصلی مستند را انتخاب کنید.' : 'Please select primary file.');
          setSubmitting(false);
          return;
        }

        const fd = new FormData();
        fd.append('file', primaryFile);
        fd.append('title', title.trim());
        fd.append('documentNumber', documentNumber.trim());
        fd.append('category', category);
        fd.append('unitName', unitName.trim() || 'عمومی مجتمع');
        fd.append('issueDate', issueDate.trim());
        fd.append('expiryDate', expiryDate.trim());
        fd.append('description', description.trim());
        fd.append('tabMetadata', JSON.stringify(tabMetadata));

        const res = await apiDb.createDocument(fd);
        if (!res.success || !res.data) {
          toast.error(res.error || 'خطا در ثبت و بارگذاری مستند');
          return;
        }

        let finalDoc: HseDocumentItem = res.data;
        let failedExtras = 0;

        for (const extra of queuedExtras) {
          const efd = new FormData();
          efd.append('file', extra.file);
          efd.append('role', extra.role);
          efd.append('title', extra.title || extra.file.name);
          const extraRes = await apiDb.addDocumentAttachment(finalDoc.documentId, efd);
          if (extraRes.success && extraRes.data) {
            finalDoc = extraRes.data;
          } else {
            failedExtras++;
          }
        }

        try {
          addAuditLog(
            currentUser.username,
            `ثبت و بارگذاری مستند جدید «${title.trim()}» در بخش «${metaCfg.fa}» (${documentNumber.trim()})`,
            'موفق',
            { module: 'دستورالعمل‌ها و مستندات', recordId: finalDoc.documentId }
          );
        } catch {}

        if (failedExtras > 0) {
          toast.success(
            `سند اصلی ثبت شد، اما بارگذاری ${failedExtras} فایل پیوست با خطا مواجه شد.`
          );
        } else {
          toast.success(isFa ? 'مستند جدید با موفقیت ثبت و ذخیره شد.' : 'Document uploaded.');
        }

        onClose();
        await onSaved(finalDoc);
      }
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ذخیره‌سازی مستند');
    } finally {
      setSubmitting(false);
    }
  };

  const CategoryIcon =
    category === 'EQUIPMENT_CERTIFICATES'
      ? ShieldCheck
      : category === 'ORG_FORMS_CHECKLISTS'
      ? ClipboardList
      : category === 'OTHER_HSE_DOCS'
      ? FolderOpen
      : FileText;

  return (
    <div className="fixed inset-0 z-[10050] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-8 max-h-[92vh] overflow-y-auto">
        {/* Modal Header (Fixed Category Context, ZERO Category Dropdown) */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <CategoryIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                {editingDoc
                  ? isFa
                    ? 'ویرایش اطلاعات و شناسنامه مستند'
                    : 'Edit Document Metadata'
                  : isFa
                  ? 'ثبت و بارگذاری مستند جدید'
                  : 'Upload New Document'}
              </h3>
              <p className="text-xs font-bold text-sky-600 dark:text-sky-400 truncate mt-0.5">
                {isFa ? metaCfg.fa : metaCfg.en}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {metaCfg.titleLabelFa}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  category === 'EQUIPMENT_CERTIFICATES'
                    ? 'مثلاً: جرثقیل سقفی ۲۵ تن سالن کمپرسور / لیفتراک ۳ تن کوماتسو'
                    : category === 'ORG_FORMS_CHECKLISTS'
                    ? 'مثلاً: چک‌لیست ایمنی کار در ارتفاع / فرم گزارش شبه‌حادثه'
                    : 'عنوان کامل مستند را وارد نمایید'
                }
                className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Document / Certificate / Form Code */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {metaCfg.codeLabelFa}
              </label>
              <input
                type="text"
                required
                dir="ltr"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder={metaCfg.codePlaceholder}
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-900 dark:text-slate-100 text-left"
              />
            </div>

            {/* Organizational Unit */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isFa ? 'واحد سازمانی / کارگاه مرتبط' : 'Organizational Unit'}
              </label>
              <select
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-900 dark:text-slate-100"
              >
                {orgUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            {/* Issue Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {metaCfg.dateLabelFa}
              </label>
              <input
                type="text"
                dir="ltr"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                placeholder="1405/08/25"
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-900 dark:text-slate-100 text-left"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {category === 'EQUIPMENT_CERTIFICATES'
                  ? 'تاریخ انقضای گواهینامه *'
                  : 'تاریخ اعتبار / انقضا (اختیاری)'}
              </label>
              <input
                type="text"
                dir="ltr"
                required={category === 'EQUIPMENT_CERTIFICATES'}
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                placeholder="1406/08/25"
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-900 dark:text-slate-100 text-left"
              />
            </div>

            {/* ── TAB 1 SPECIALIZED FIELDS: ORG_PROCEDURES ── */}
            {category === 'ORG_PROCEDURES' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    شماره بازنگری (Revision)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={revisionCode}
                    onChange={(e) => setRevisionCode(e.target.value)}
                    placeholder="Rev.01"
                    className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500 text-left"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    تاریخ آخرین بازنگری
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={revisionDate}
                    onChange={(e) => setRevisionDate(e.target.value)}
                    placeholder="1405/08/25"
                    className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500 text-left"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    مسئول تهیه مستند
                  </label>
                  <input
                    type="text"
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    placeholder="نام کارشناس / تهیه‌کننده"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    مسئول تأیید / تصویب‌کننده
                  </label>
                  <input
                    type="text"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    placeholder="رئیس ایمنی / مدیریت مجتمع"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    وضعیت ابلاغ و اعتبار دستورالعمل
                  </label>
                  <select
                    value={promulgationStatus}
                    onChange={(e) =>
                      setPromulgationStatus(
                        e.target.value as 'PROMULGATED' | 'UNDER_REVISION' | 'DRAFT' | 'OBSOLETE'
                      )
                    }
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                  >
                    {(
                      Object.keys(PROMULGATION_STATUS_LABELS) as Array<
                        keyof typeof PROMULGATION_STATUS_LABELS
                      >
                    ).map((key) => (
                      <option key={key} value={key}>
                        {PROMULGATION_STATUS_LABELS[key].fa}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* ── TAB 2 SPECIALIZED FIELDS: EQUIPMENT_CERTIFICATES ── */}
            {category === 'EQUIPMENT_CERTIFICATES' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    مدل / شماره سریال یا پلاک تجهیز
                  </label>
                  <input
                    type="text"
                    value={equipmentSerialOrModel}
                    onChange={(e) => setEquipmentSerialOrModel(e.target.value)}
                    placeholder="مثلاً: SN-98421 / Demag 25T"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تگ / کد تجهیز مرتبط در سایر ماژول‌ها (اختیاری)</span>
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    list="hse-linked-equipment-list"
                    value={linkedEquipmentCode}
                    onChange={(e) => handleLinkedEquipmentChange(e.target.value)}
                    placeholder="انتخاب یا تایپ کد تجهیز سامانه..."
                    className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500 text-left"
                  />
                  <datalist id="hse-linked-equipment-list">
                    {equipmentOptions.map((eq) => (
                      <option key={eq.code} value={eq.code}>
                        {eq.name} {eq.location ? `(${eq.location})` : ''}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    نوع گواهینامه / آزمون فنی
                  </label>
                  <select
                    value={certificateType}
                    onChange={(e) => setCertificateType(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                  >
                    {CERTIFICATE_TYPES.map((ct) => (
                      <option key={ct} value={ct}>
                        {ct}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    نام شرکت / مرجع بازرسی‌کننده
                  </label>
                  <input
                    type="text"
                    value={inspectionCompany}
                    onChange={(e) => setInspectionCompany(e.target.value)}
                    placeholder="مثلاً: شرکت بازرسی فنی و کنترل خوردگی"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    وضعیت پیگیری تمدید گواهینامه
                  </label>
                  <select
                    value={renewalStatus}
                    onChange={(e) =>
                      setRenewalStatus(e.target.value as 'AUTO' | 'PENDING_RENEWAL')
                    }
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                  >
                    <option value="AUTO">
                      محاسبه خودکار وضعیت (معتبر / نزدیک به انقضا / منقضی‌شده) بر اساس تاریخ
                    </option>
                    <option value="PENDING_RENEWAL">
                      در انتظار تمدید / در حال انجام بازرسی مجدد
                    </option>
                  </select>
                </div>
              </>
            )}

            {/* ── TAB 3 SPECIALIZED FIELDS: ORG_FORMS_CHECKLISTS ── */}
            {category === 'ORG_FORMS_CHECKLISTS' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    حوزه تخصصی HSE فرم / چک‌لیست
                  </label>
                  <select
                    value={hseDomain}
                    onChange={(e) => setHseDomain(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                  >
                    {FORM_HSE_DOMAINS.map((dom) => (
                      <option key={dom} value={dom}>
                        {dom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    شماره بازنگری فرم
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={revisionCode}
                    onChange={(e) => setRevisionCode(e.target.value)}
                    placeholder="Rev.00"
                    className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500 text-left"
                  />
                </div>
              </>
            )}

            {/* ── TAB 4 SPECIALIZED FIELDS: OTHER_HSE_DOCS ── */}
            {category === 'OTHER_HSE_DOCS' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    دسته‌بندی موضوعی مستند
                  </label>
                  <select
                    value={topicCategory}
                    onChange={(e) =>
                      setTopicCategory(
                        e.target.value as
                          | 'STANDARDS'
                          | 'CIRCULARS'
                          | 'SPECIALIZED_GUIDES'
                          | 'REFERENCE_REPORTS'
                          | 'OTHER'
                      )
                    }
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                  >
                    {OTHER_TOPIC_CATEGORIES.map((tc) => (
                      <option key={tc.id} value={tc.id}>
                        {isFa ? tc.fa : tc.en}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    مرجع صادرکننده / ناشر
                  </label>
                  <input
                    type="text"
                    value={issuingAuthority}
                    onChange={(e) => setIssuingAuthority(e.target.value)}
                    placeholder="مثلاً: سازمان حفاظت محیط زیست / NFPA / وزارت کار"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    برچسب‌ها و کلیدواژه‌های جست‌وجو (اختیاری)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="مثلاً: حریق، ارگونومی، محیط زیست، مجتمع رجال"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                  />
                </div>
              </>
            )}

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {isFa ? 'توضیحات تکمیلی و دامنه کاربرد' : 'Description'}
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={isFa ? 'شرح مختصر کاربرد، حدود مجاز یا یادداشت‌های اجرایی...' : 'Notes...'}
                className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500 resize-none"
              />
            </div>

            {/* File Upload Area (Create Mode) */}
            {!editingDoc && (
              <>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                    {category === 'EQUIPMENT_CERTIFICATES'
                      ? 'فایل PDF یا تصویر اصلی گواهینامه *'
                      : category === 'ORG_FORMS_CHECKLISTS'
                      ? 'فایل خام اصلی فرم / چک‌لیست (Word، Excel یا PDF) *'
                      : 'فایل اصلی مستند (PDF، تصویر، Word یا Excel) *'}
                  </label>
                  <input
                    ref={primaryInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.xlsx,.xls"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && validateSelectedFile(f, isFa)) {
                        setPrimaryFile(f);
                      } else if (f) {
                        e.target.value = '';
                      }
                    }}
                    className="hidden"
                  />
                  <div
                    onClick={() => primaryInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition ${
                      primaryFile
                        ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'border-slate-300 dark:border-slate-700 hover:border-sky-500 bg-slate-50 dark:bg-slate-800/40'
                    }`}
                  >
                    {primaryFile ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0 text-right">
                          <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                              {primaryFile.name}
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-slate-500">
                              {formatFileSize(primaryFile.size)}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setPrimaryFile(null);
                            if (primaryInputRef.current) primaryInputRef.current.value = '';
                          }}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-6 h-6 text-sky-500 mx-auto" />
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          برای انتخاب فایل اصلی کلیک کنید (حداکثر ۲۵ مگابایت)
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Multi-File Additional Attachments During Creation */}
                <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <Paperclip className="w-4 h-4 text-sky-600" />
                      <span>
                        {category === 'EQUIPMENT_CERTIFICATES'
                          ? 'بارگذاری فایل گزارش بازرسی / پیوست‌های تکمیلی (اختیاری - چند فایل)'
                          : category === 'ORG_FORMS_CHECKLISTS'
                          ? 'بارگذاری نسخه PDF قابل چاپ یا فرم تکمیل‌شده (اختیاری - چند فایل)'
                          : category === 'OTHER_HSE_DOCS'
                          ? 'بارگذاری چند فایل PDF و ضمائم همزمان (اختیاری)'
                          : 'فایل‌های PDF پیوست و ضمائم تکمیلی (اختیاری)'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={extraRoleDraft}
                      onChange={(e) => setExtraRoleDraft(e.target.value)}
                      className="sm:w-1/2 px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                    >
                      {extraRoles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {isFa ? r.fa : r.en}
                        </option>
                      ))}
                    </select>
                    <input
                      ref={extraInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.xlsx,.xls"
                      onChange={(e) => handleExtraFilesPicked(e.target.files)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => extraInputRef.current?.click()}
                      className="sm:w-1/2 px-3 py-2 rounded-xl border border-dashed border-sky-400 bg-white dark:bg-slate-900 hover:bg-sky-50 dark:hover:bg-sky-950/30 text-sky-700 dark:text-sky-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>افزودن فایل(های) پیوست</span>
                    </button>
                  </div>

                  {queuedExtras.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {queuedExtras.map((item, idx) => (
                        <div
                          key={`${item.file.name}-${idx}`}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                              {item.file.name}
                            </span>
                            <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                              ({formatFileSize(item.file.size)})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setQueuedExtras((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
            >
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
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
  );
};

export default DocumentFormModal;
