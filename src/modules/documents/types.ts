import moment from 'moment-jalaali';
import { normalizeDigits } from '../../utils/textNormalization';

export type HseDocumentCategory =
  | 'ORG_PROCEDURES'
  | 'EQUIPMENT_CERTIFICATES'
  | 'ORG_FORMS_CHECKLISTS'
  | 'OTHER_HSE_DOCS';

export type DocumentsModuleTabKey = HseDocumentCategory | 'SDS';

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

export interface DocumentExtraAttachmentItem {
  fileId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  role: string;
  title: string;
  uploadedBy: string;
  createdAt: string;
  downloadUrl: string;
  previewUrl: string;
}

export interface DocumentTabMetadata {
  // Tab 1: Procedures
  revisionCode?: string;
  revisionDate?: string;
  preparedBy?: string;
  approvedBy?: string;
  promulgationStatus?: 'PROMULGATED' | 'UNDER_REVISION' | 'DRAFT' | 'OBSOLETE';

  // Tab 2: Equipment Certificates
  equipmentSerialOrModel?: string;
  linkedEquipmentCode?: string;
  linkedEquipmentName?: string;
  certificateType?: string;
  inspectionCompany?: string;
  renewalStatus?: 'AUTO' | 'PENDING_RENEWAL';

  // Tab 3: Forms & Checklists
  hseDomain?: string;

  // Tab 4: Other HSE Docs
  topicCategory?: 'STANDARDS' | 'CIRCULARS' | 'SPECIALIZED_GUIDES' | 'REFERENCE_REPORTS' | 'OTHER';
  issuingAuthority?: string;
  tags?: string;
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
  tabMetadata?: DocumentTabMetadata;
  extraAttachments?: DocumentExtraAttachmentItem[];
}

export const PROMULGATION_STATUS_LABELS: Record<
  'PROMULGATED' | 'UNDER_REVISION' | 'DRAFT' | 'OBSOLETE',
  { fa: string; en: string; badgeClass: string }
> = {
  PROMULGATED: {
    fa: 'ابلاغ‌شده (معتبر)',
    en: 'Promulgated',
    badgeClass:
      'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  UNDER_REVISION: {
    fa: 'در دست بازنگری',
    en: 'Under Revision',
    badgeClass:
      'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  DRAFT: {
    fa: 'پیش‌نویس / آماده ابلاغ',
    en: 'Draft',
    badgeClass:
      'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  },
  OBSOLETE: {
    fa: 'منسوخ‌شده',
    en: 'Obsolete',
    badgeClass:
      'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700',
  },
};

export const CERTIFICATE_TYPES: string[] = [
  'بازرسی فنی دوره‌ای جرثقیل و تجهیزات لیفتینگ',
  'تست هیدرواستاتیک و بازرسی مخازن تحت فشار / دیگ بخار',
  'گواهینامه سلامت فنی لیفتراک و ماشین‌آلات کارگاهی',
  'تست چاه ارت، هم‌بندی و حفاظت الکتریکی',
  'کالیبراسیون تجهیزات ابزار دقیق و گازسنج‌ها',
  'تاییدیه سیستم‌های اعلام و اطفای حریق',
  'سایر گواهینامه‌ها و سرتیفیکیت‌های فنی',
];

export const FORM_HSE_DOMAINS: string[] = [
  'ایمنی صنعتی و عملیات',
  'آتش‌نشانی و واکنش در شرایط اضطراری',
  'بهداشت حرفه‌ای و طب کار',
  'محیط زیست و مدیریت پسماند',
  'ایمنی فرآیند (PSM)',
  'مدیریت پیمانکاران و مجوز کار (PTW)',
  'عمومی HSE و ممیزی',
];

export const OTHER_TOPIC_CATEGORIES: {
  id: 'STANDARDS' | 'CIRCULARS' | 'SPECIALIZED_GUIDES' | 'REFERENCE_REPORTS' | 'OTHER';
  fa: string;
  en: string;
}[] = [
  { id: 'STANDARDS', fa: 'استانداردها و الزامات (NFPA، ISO، OSHA، ملی)', en: 'Standards & Requirements' },
  { id: 'CIRCULARS', fa: 'بخشنامه‌ها و ابلاغیه‌های سازمانی و قانونی', en: 'Circulars & Directives' },
  { id: 'SPECIALIZED_GUIDES', fa: 'دستورالعمل‌های تخصصی خارج از دسته‌بندی اول', en: 'Specialized Guidelines' },
  { id: 'REFERENCE_REPORTS', fa: 'گزارش‌ها، مطالعات و مستندات مرجع HSE', en: 'Reference Reports & Studies' },
  { id: 'OTHER', fa: 'سایر مستندات مرتبط با HSE', en: 'Other HSE Documents' },
];

export const ATTACHMENT_ROLES_BY_CATEGORY: Record<
  HseDocumentCategory,
  { id: string; fa: string; en: string }[]
> = {
  ORG_PROCEDURES: [
    { id: 'SUPPORTING_PDF', fa: 'فایل PDF پیوست / ضمیمه دستورالعمل', en: 'Supporting PDF' },
    { id: 'FLOWCHART_DOC', fa: 'فلوچارت / جدول پیوست', en: 'Flowchart / Appendix' },
    { id: 'OTHER', fa: 'سایر مستندات پشتیبان', en: 'Other' },
  ],
  EQUIPMENT_CERTIFICATES: [
    { id: 'INSPECTION_REPORT', fa: 'گزارش بازرسی فنی و آزمون (Inspection Report)', en: 'Inspection Report' },
    { id: 'CERTIFICATE_PDF', fa: 'نسخه PDF گواهینامه تکمیلی', en: 'Supplementary Certificate PDF' },
    { id: 'OTHER', fa: 'سایر مدارک تجهیز', en: 'Other' },
  ],
  ORG_FORMS_CHECKLISTS: [
    { id: 'PRINTABLE_PDF', fa: 'نسخه PDF قابل چاپ فرم خام', en: 'Printable PDF Form' },
    { id: 'COMPLETED_FORM', fa: 'فایل تکمیل‌شده / سوابق پرشده فرم', en: 'Completed / Filled Form' },
    { id: 'OTHER', fa: 'سایر پیوست‌های فرم', en: 'Other' },
  ],
  OTHER_HSE_DOCS: [
    { id: 'REFERENCE_PDF', fa: 'فایل PDF مرجع / جلد یا پیوست مکمل', en: 'Supplementary Reference PDF' },
    { id: 'APPENDIX_DOC', fa: 'پیوست / استاندارد الحاقی', en: 'Appendix / Addendum' },
    { id: 'OTHER', fa: 'سایر فایل‌ها', en: 'Other' },
  ],
};

export function parseFlexibleDate(dateStr?: string): Date | null {
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
      labelFa: `منقضی (${Math.abs(diffDays)} روز پیش)`,
      labelEn: `Expired (${Math.abs(diffDays)}d ago)`,
    };
  }

  if (diffDays <= 30) {
    return {
      status: 'EXPIRING_SOON',
      daysRemaining: diffDays,
      labelFa: diffDays === 0 ? 'انقضا امروز' : `نزدیک به انقضا (${diffDays} روز)`,
      labelEn: diffDays === 0 ? 'Expires today' : `Expiring (${diffDays}d)`,
    };
  }

  return {
    status: 'VALID',
    daysRemaining: diffDays,
    labelFa: `معتبر (${diffDays} روز مانده)`,
    labelEn: `Valid (${diffDays}d left)`,
  };
}
