import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  ShieldAlert,
  Database,
  Download,
  AlertOctagon,
  Search,
  Printer,
  Sparkles,
  LayoutGrid,
  BarChart3,
  FileEdit,
  FileWarning,
  User,
  Users,
  Building,
  Building2,
  Briefcase,
  Phone,
  MapPin,
  CreditCard,
  ShieldCheck,
  Layers,
  Check,
  X,
  CopyX,
  Send,
  History,
  UploadCloud,
  FileSpreadsheet,
  RotateCcw
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { WarningRecord } from '../types';
import { 
  deduplicateWarningRecords, 
  sanitizeWarningRecords,
  clearWarningsFromStorage
} from '../utils/safeStorage';
import { downloadCsvFile } from '../utils/fileHelpers';
import { apiDb } from '../services/apiDatabaseClient';
import {
  findPersonnelByCode,
  PersonnelOrgDetails,
  getPersonnelOrgDetails,
  getStoredOrgNodes,
  syncAndGetExtractedDepartments,
  ComplexPersonnel
} from '../utils/personnelHelper';
import CentralPersonnelSelector from './CentralPersonnelSelector';
import { useSystemBranding } from '../utils/systemBrandingHelper';
import CustomizableWarningCharts from './warnings/CustomizableWarningCharts';
import WarningNoticePrintModal from './warnings/WarningNoticePrintModal';
import WarningsExcelImportModal from './warnings/WarningsExcelImportModal';
import { downloadWarningsExcelTemplate, exportWarningsToExcel } from './warnings/warningsExcelService';
import { CreateReferralModal } from './referral/CreateReferralModal';
import { DocumentWorkflowTrackerModal } from './referral/DocumentWorkflowTrackerModal';
import { getCurrentUser, addAuditLog } from '../utils/authHelper';
import { CentralNotificationService } from '../services/notificationService';
import UniversalOrgUnitSelect from './common/UniversalOrgUnitSelect';
import { getUnifiedOrgUnits } from '../utils/orgUnitsHelper';

interface WarningsManagerProps {
  warnings: WarningRecord[];
  onWarningsUpdated: (warns: WarningRecord[]) => void;
  language: 'en' | 'fa';
  currentUser?: any;
}

const MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const COMMON_HSE_VIOLATIONS = [
  'شروع فعالیت بدون اخذ مجوز کار معتبر (PTW)',
  'عدم استفاده از تجهیزات و لوازم حفاظت فردی مصوب (PPE)',
  'عدم رعایت الزامات ایمنی کار در ارتفاع و عدم اتصال لنیارد',
  'عدم حضور ناظر ایمنی و رهاسازی عملیات پرخطر',
  'استفاده غیرمجاز از ادوات، اتصالات و شبکه آب آتش‌نشانی',
  'عدم رعایت اصول خانه‌داری صنعتی (5S) و ایجاد سد معبر اضطراری',
  'استعمال دخانیات در محوطه فرآیندی و زون‌های خطرناک',
  'تخلیه غیرمجاز پساب و عدم تفکیک پسماندهای ویژه شیمیایی',
  'عدم رعایت مقررات ترافیکی و رانندگی پرخطر در محوطه صنعتی',
  'عدم قفل‌گذاری و برچسب‌زنی ایمنی تجهیزات انرژی‌دار (LOTO)'
];

function buildDefaultNoticeText(
  name?: string,
  unit?: string,
  repetitionText?: string,
  reason?: string,
  companyName?: string
): string {
  const cName = companyName || 'مجتمع پتروشیمی رجال';
  return `جناب آقای ${name || '................'} واحد / پیمانکار ${unit || '................'} بدینوسیله برای ${repetitionText || 'اولین'} بار به دلیل « ${reason || '................'} » به شما اخطار داده می‌شود تا نسبت به عدم تکرار مورد فوق و رعایت مقررات بهداشت ، ایمنی و محیط زیست مطابق با دستورالعمل ${cName} اقدام فرمایید .`;
}

interface FormState {
  id?: string;
  day: number;
  month: string;
  year: number;
  number: string;
  site: string;
  name: string;
  personnelCode: string;
  nationalCode: string;
  phone: string;
  jobTitle: string;
  unit: string;
  unitId?: string;
  department: string;
  supervisor: string;
  location: string;
  costCenter: string;
  fullOrgPath: string;
  type: 'فردی' | 'واحدی';
  reason: string;
  repetitionText?: string;
  noticeText?: string;
}

export default function WarningsManager({
  warnings = [],
  onWarningsUpdated,
  language = 'fa',
  currentUser
}: WarningsManagerProps) {
  const isFa = language === 'fa';
  const { branding } = useSystemBranding();
  const logoUrl = branding?.logoUrl;
  const companyNameFa = branding?.organizationNameFa;
  const formSectionRef = useRef<HTMLDivElement>(null);

  // Two primary sections as requested: 'charts' (نمایش نمودارها) or 'records' (ثبت گزارش خطا و مدیریت اخطارها)
  const [activeTab, setActiveTab] = useState<'charts' | 'records'>('records');

  // Chart customization sub-mode: 'custom' (Customizable dashboard) vs 'classic' (Recharts)
  const [chartViewMode, setChartViewMode] = useState<'custom' | 'classic'>('custom');

  // Search filter in ledger
  const [searchTerm, setSearchTerm] = useState('');

  // Editing state
  const [editingWarnId, setEditingWarnId] = useState<string | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [warnError, setWarnError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);
  const [printNoticeRecord, setPrintNoticeRecord] = useState<WarningRecord | null>(null);
  const [referralWarning, setReferralWarning] = useState<WarningRecord | null>(null);
  const [trackerWarning, setTrackerWarning] = useState<WarningRecord | null>(null);
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const activeUser = useMemo(() => {
    if (currentUser) return currentUser;
    try {
      if (typeof getCurrentUser === 'function') {
        const u = getCurrentUser();
        if (u) return u;
      }
      const stored = sessionStorage.getItem('hse_current_user');
      if (stored) return JSON.parse(stored);
      const remember = localStorage.getItem('hse_remember_user');
      if (remember) return JSON.parse(remember);
    } catch {}
    return null;
  }, [currentUser]);

  // Track if user manually adjusted extracted org info
  const [isOrgCustomized, setIsOrgCustomized] = useState(false);

  // Real-time synchronization across all systems and browsers
  useEffect(() => {
    const handleRemoteUpdate = (e?: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
      if (!entity || entity.includes('warn')) {
        apiDb.getSafetyWarnings().then(w => {
          if (Array.isArray(w)) {
            const { clean } = deduplicateWarningRecords(w);
            onWarningsUpdated(clean);
          }
        }).catch(() => {});
      }
    };

    window.addEventListener('hse_warnings_updated', handleRemoteUpdate);
    window.addEventListener('app_data_mutated', handleRemoteUpdate);
    window.addEventListener('hse_data_mutated', handleRemoteUpdate);

    return () => {
      window.removeEventListener('hse_warnings_updated', handleRemoteUpdate);
      window.removeEventListener('app_data_mutated', handleRemoteUpdate);
      window.removeEventListener('hse_data_mutated', handleRemoteUpdate);
    };
  }, [onWarningsUpdated]);

  // Helper to suggest next warning number
  const suggestWarningNumber = (records: WarningRecord[]) => {
    if (!records || records.length === 0) return 'HSE/w/001';
    const nums = records.map(w => {
      const match = (w.number || '').match(/(\d+)/);
      return match ? parseInt(match[0], 10) : 0;
    });
    const maxNum = Math.max(0, ...nums);
    return `HSE/w/${String(maxNum + 1).padStart(3, '0')}`;
  };

  // Safe warnings normalization (filtering out demo seed data and deduplicating records)
  const safeWarnings = useMemo<WarningRecord[]>(() => {
    if (!Array.isArray(warnings)) return [];
    const sanitized = sanitizeWarningRecords(warnings);
    return deduplicateWarningRecords(sanitized).clean;
  }, [warnings]);

  // Detected duplicate records count in raw warnings
  const duplicateDetectedCount = useMemo(() => {
    if (!Array.isArray(warnings)) return 0;
    const { removedCount } = deduplicateWarningRecords(warnings);
    return removedCount;
  }, [warnings]);

  // Explicit action to deduplicate and clean warnings
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const handleDeduplicateWarnings = async () => {
    setIsDeduplicating(true);
    try {
      const { clean, removedCount } = deduplicateWarningRecords(warnings);
      onWarningsUpdated(clean);

      // Also trigger backend DB deduplication
      try {
        await apiDb.deduplicateSafetyWarnings();
      } catch {}

      if (removedCount > 0) {
        alert(isFa 
          ? `✅ تعداد ${removedCount} رکورد تکراری با موفقیت شناسایی، ادغام و از سامانه حذف گردید.`
          : `✅ Successfully purged ${removedCount} duplicate records.`);
      } else {
        alert(isFa 
          ? '✅ بازبینی کامل انجام شد: هیچ رکورد تکراری در سامانه اخطارها وجود ندارد.'
          : '✅ Verification complete: No duplicate records found.');
      }
    } finally {
      setIsDeduplicating(false);
    }
  };

  // User requested action: Wipe all warning records clean and ensure no default data exists
  const [isClearingAll, setIsClearingAll] = useState(false);
  const handleClearAllWarnings = async () => {
    const confirmMsg = isFa
      ? 'آیا از پاکسازی و حذف کامل تمامی سوابق اخطارهای کتبی اطمینان دارید؟ تمام رکوردهای ثبت‌شده حذف خواهند شد و هیچ داده پیش‌فرضی باقی نخواهد ماند.'
      : 'Are you sure you want to completely clear all warning records? No default data will remain.';
    
    if (!window.confirm(confirmMsg)) return;

    setIsClearingAll(true);
    try {
      onWarningsUpdated([]);
      await clearWarningsFromStorage();
      await apiDb.clearAllSafetyWarnings();
      alert(isFa 
        ? '✅ تمامی سوابق اخطارها با موفقیت پاکسازی شد و هیچ داده پیش‌فرضی در سامانه قرار ندارد.'
        : '✅ All warning records have been permanently cleared. Zero default records exist.');
    } catch (err) {
      console.error('Error clearing warning records:', err);
    } finally {
      setIsClearingAll(false);
    }
  };

  // Automatically purge any remaining sample seed records and duplicate records from parent state & storage
  useEffect(() => {
    if (Array.isArray(warnings) && warnings.length > 0 && safeWarnings.length !== warnings.length) {
      onWarningsUpdated(safeWarnings);
    }
  }, [warnings, safeWarnings, onWarningsUpdated]);

  // Editable official notice text customization state
  const [isNoticeCustomized, setIsNoticeCustomized] = useState(false);

  // Initial Form State
  const [warnForm, setWarnForm] = useState<FormState>(() => ({
    day: 1,
    month: MONTHS[0],
    year: 1405,
    number: suggestWarningNumber(safeWarnings),
    site: '',
    name: '',
    personnelCode: '',
    nationalCode: '',
    phone: '',
    jobTitle: '',
    unit: '',
    unitId: '',
    department: '',
    supervisor: '',
    location: '',
    costCenter: '',
    fullOrgPath: '',
    type: 'فردی',
    reason: '',
    repetitionText: 'اولین',
    noticeText: ''
  }));

  // Automatic calculation of approved official notice template text
  const defaultNoticeText = useMemo(() => {
    return buildDefaultNoticeText(
      warnForm.name,
      warnForm.unit,
      warnForm.repetitionText,
      warnForm.reason,
      companyNameFa
    );
  }, [warnForm.name, warnForm.unit, warnForm.repetitionText, warnForm.reason, companyNameFa]);

  // Current effective official notice text (manual edits or auto-generated template)
  const currentNoticeText = isNoticeCustomized ? (warnForm.noticeText ?? defaultNoticeText) : defaultNoticeText;

  // Update suggested number when safeWarnings change and not editing
  useEffect(() => {
    if (!editingWarnId) {
      setWarnForm(prev => {
        if (!prev.name && (!prev.number || prev.number.startsWith('HSE/w/'))) {
          return { ...prev, number: suggestWarningNumber(safeWarnings) };
        }
        return prev;
      });
    }
  }, [safeWarnings, editingWarnId]);

  // Available organizational units and departments extracted strictly from System Settings (Org Structure)
  const { extractedUnits, extractedDepts, extractedSites } = useMemo(() => {
    const unifiedUnits = getUnifiedOrgUnits();
    const unitsSet = new Set<string>();
    const deptsSet = new Set<string>();
    const sitesSet = new Set<string>();

    unifiedUnits.forEach(u => {
      if (u.name) unitsSet.add(u.name.trim());
      if (u.parentName) deptsSet.add(u.parentName.trim());
      if (u.type === 'Department') deptsSet.add(u.name.trim());
      if (u.location) sitesSet.add(u.location.trim());
      if (u.type === 'Site' || u.type === 'Company') sitesSet.add(u.name.trim());
    });

    return {
      extractedUnits: Array.from(unitsSet),
      extractedDepts: Array.from(deptsSet),
      extractedSites: Array.from(sitesSet)
    };
  }, [safeWarnings]);

  // Handler for Personnel Selection from Master Data
  const handleSelectPersonnel = (person: ComplexPersonnel | null, org: PersonnelOrgDetails) => {
    if (person) {
      const candCode = person.effectiveCode || person.personnelCode || person.id;
      const candName = person.fullName || (person.lastName ? `${person.firstName} ${person.lastName}`.trim() : '');
      const priorCount = safeWarnings.filter(item => 
        (candCode && item.personnelCode === candCode) ||
        (candName && item.name && item.name.trim().toLowerCase() === candName.trim().toLowerCase())
      ).length;
      const ordinals = [
        'اولین', 'دومین', 'سومین', 'چهارمین', 'پنجمین',
        'ششمین', 'هفتمین', 'هشتمین', 'نهمین', 'دهمین',
        'یازدهمین', 'دوازدهمین', 'سیزدهمین', 'چهاردهمین', 'پانزدهمین',
        'شانزدهمین', 'هفدهمین', 'هجدهمین', 'نوزدهمین', 'بیستمین'
      ];
      const autoRepetition = ordinals[priorCount] || 'اولین';

      setWarnForm(prev => ({
        ...prev,
        personnelCode: person.effectiveCode || person.personnelCode || person.id,
        name: person.fullName || (person.lastName ? `${person.firstName} ${person.lastName}`.trim() : prev.name),
        nationalCode: person.nationalCode || '',
        phone: person.phone || '',
        jobTitle: person.jobTitle || org.jobTitle || '',
        unit: org.unit || person.unit || prev.unit || '',
        unitId: org.orgNodeId || person.orgNodeId || prev.unitId || '',
        department: org.department || person.department || prev.department || '',
        supervisor: org.supervisor || person.supervisor || prev.supervisor || '',
        location: org.location || '',
        costCenter: org.costCenter || '',
        fullOrgPath: org.fullOrgPath || '',
        repetitionText: autoRepetition
      }));
      setIsOrgCustomized(false);
    } else {
      // Cleared: When removed from search field, no user should be displayed
      setWarnForm(prev => ({
        ...prev,
        personnelCode: '',
        name: '',
        nationalCode: '',
        phone: '',
        jobTitle: '',
        unit: '',
        department: '',
        supervisor: '',
        location: '',
        costCenter: '',
        fullOrgPath: '',
        repetitionText: 'اولین'
      }));
      setIsOrgCustomized(false);
    }
  };

  // Open modal for registering a new warning
  const handleOpenRegisterModal = () => {
    setEditingWarnId(null);
    setWarnError('');
    setWarnForm({
      personnelCode: '',
      nationalCode: '',
      phone: '',
      jobTitle: '',
      department: '',
      supervisor: '',
      location: '',
      costCenter: '',
      fullOrgPath: '',
      day: 1,
      month: MONTHS[0],
      year: 1405,
      number: suggestWarningNumber(safeWarnings),
      site: '',
      name: '',
      unit: '',
      unitId: '',
      type: 'فردی',
      reason: '',
      repetitionText: 'اولین',
      noticeText: ''
    });
    setIsNoticeCustomized(false);
    setIsOrgCustomized(false);
    setIsRegisterModalOpen(true);
  };

  // Handle Form Submission (Create or Edit)
  const handleWarnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warnForm.name.trim()) {
      setWarnError(isFa ? 'لطفاً نام کارمند یا واحد دریافت‌کننده اخطار را وارد یا انتخاب کنید.' : 'Please enter or select personnel/unit name.');
      return;
    }
    if (!warnForm.unit.trim()) {
      setWarnError(isFa ? 'لطفاً واحد سازمانی را وارد یا انتخاب نمایید.' : 'Please provide organizational unit.');
      return;
    }
    if (!warnForm.reason.trim()) {
      setWarnError(isFa ? 'شرح و علت تخلف کتبی الزامی است.' : 'Violation details are required.');
      return;
    }

    // Duplicate check 1: Notice number uniqueness
    const normNumber = (warnForm.number || '').trim().toLowerCase().replace(/\s+/g, '');
    if (normNumber && normNumber !== 'hse/w/' && normNumber !== 'hse/w/000') {
      const existingWithNum = safeWarnings.find(w => 
        (!editingWarnId || w.id !== editingWarnId) &&
        (w.number || '').trim().toLowerCase().replace(/\s+/g, '') === normNumber
      );
      if (existingWithNum) {
        setWarnError(isFa 
          ? `شماره ابلاغیه «${warnForm.number}» قبلاً برای «${existingWithNum.name}» ثبت شده است. جهت جلوگیری از تکرار، لطفاً شماره دیگری تعیین نمایید.`
          : `Notice number "${warnForm.number}" is already used for "${existingWithNum.name}".`
        );
        return;
      }
    }

    // Duplicate check 2: Identical infraction check (person + date + unit + reason)
    const normName = (warnForm.name || '').trim().toLowerCase().replace(/\s+/g, '');
    const normCode = (warnForm.personnelCode || warnForm.nationalCode || '').trim();
    const normReason = (warnForm.reason || '').trim().toLowerCase().replace(/\s+/g, '');
    const normUnit = (warnForm.unit || '').trim().toLowerCase().replace(/\s+/g, '');

    const duplicateInfraction = safeWarnings.find(w => {
      if (editingWarnId && w.id === editingWarnId) return false;
      const wName = (w.name || '').trim().toLowerCase().replace(/\s+/g, '');
      const wCode = (w.personnelCode || w.nationalCode || '').trim();
      const wReason = (w.reason || '').trim().toLowerCase().replace(/\s+/g, '');
      const wUnit = (w.unit || '').trim().toLowerCase().replace(/\s+/g, '');
      
      const samePerson = (normCode && wCode && normCode === wCode) || (normName && wName && normName === wName);
      const sameDate = Number(w.year) === Number(warnForm.year) && String(w.month) === String(warnForm.month) && Number(w.day) === Number(warnForm.day);
      const sameViolation = normReason && wReason && (normReason === wReason || normReason.includes(wReason) || wReason.includes(normReason));
      const sameUnit = normUnit && wUnit && normUnit === wUnit;

      return samePerson && sameDate && sameViolation && sameUnit;
    });

    if (duplicateInfraction) {
      setWarnError(isFa 
        ? `یک اخطار با همین مشخصات و شرح تخلف در این تاریخ برای «${warnForm.name}» قبلاً ثبت گردیده است (شماره ابلاغیه: ${duplicateInfraction.number}). جهت حفظ یکپارچگی، ثبت تکراری مجاز نمی‌باشد.`
        : `An identical warning record already exists for this person on this date (${duplicateInfraction.number}).`
      );
      return;
    }

    setWarnError('');

    if (editingWarnId) {
      // Editing existing warning
      try {
        const payload = {
          ...warnForm,
          noticeText: currentNoticeText,
          id: editingWarnId
        };
        const saved = await apiDb.saveSafetyWarning(payload);
        const updated = safeWarnings.map(w =>
          w.id === editingWarnId ? { ...w, ...warnForm, noticeText: currentNoticeText, id: String(saved?.id || editingWarnId) } : w
        );
        const { clean } = deduplicateWarningRecords(updated);
        onWarningsUpdated(clean);
        setEditingWarnId(null);
        setIsNoticeCustomized(false);
        setIsRegisterModalOpen(false);
      } catch (err: any) {
        setWarnError(isFa ? 'خطا در ویرایش اخطار در پایگاه داده' : 'Error updating warning in database');
        return;
      }
    } else {
      // Creating new warning - database MUST generate persistent ID
      try {
        const payload = {
          ...warnForm,
          noticeText: currentNoticeText,
          repetitionText: warnForm.repetitionText || 'اولین'
        };
        const saved = await apiDb.saveSafetyWarning(payload);
        if (!saved || !saved.id) {
          setWarnError(isFa ? 'خطا در ثبت اخطار در پایگاه داده. شناسه معتبر صادر نشد.' : 'Failed to receive valid record ID.');
          return;
        }
        const newWarn: WarningRecord = {
          ...warnForm,
          id: String(saved.id),
          number: saved.number || warnForm.number,
          repetitionText: warnForm.repetitionText || 'اولین',
          noticeText: currentNoticeText
        };
        const { clean } = deduplicateWarningRecords([...safeWarnings, newWarn]);
        onWarningsUpdated(clean);
        setIsNoticeCustomized(false);
        setIsRegisterModalOpen(false);

        // Dispatch Central Notification with Popup
        CentralNotificationService.sendNotification({
          title: `صدور اخطار کتبی HSE: ${newWarn.number}`,
          body: `اخطار عدم انطباق ایمنی برای ${newWarn.name} (${newWarn.jobTitle || 'پرسنل'}) به دلیل "${newWarn.reason}" صادر گردید.`,
          category: 'warning',
          priority: 'high',
          sourceModule: 'warnings',
          type: 'popup',
          triggerPopup: true,
          actionUrl: '#warnings',
          recordId: newWarn.number,
          sender: activeUser.fullName || activeUser.username,
          playSound: true,
        }).catch(() => {});

        // Directly open official print modal for instant preview/print
        setPrintNoticeRecord(newWarn);
      } catch (err: any) {
        setWarnError(isFa ? 'خطا در برقراری ارتباط با پایگاه داده' : 'Database connection error');
        return;
      }
    }

    // Reset Form
    setWarnForm({
      personnelCode: '',
      nationalCode: '',
      phone: '',
      jobTitle: '',
      department: '',
      supervisor: '',
      location: '',
      costCenter: '',
      fullOrgPath: '',
      day: 1,
      month: MONTHS[0],
      year: 1405,
      number: suggestWarningNumber(safeWarnings),
      site: '',
      name: '',
      unit: '',
      unitId: '',
      type: 'فردی',
      reason: '',
      repetitionText: 'اولین',
      noticeText: ''
    });
    setIsNoticeCustomized(false);
    setIsOrgCustomized(false);
  };

  // Cancel edit mode / close registration modal
  const handleCancelEdit = () => {
    setEditingWarnId(null);
    setWarnError('');
    setIsNoticeCustomized(false);
    setIsRegisterModalOpen(false);
    setWarnForm({
      personnelCode: '',
      nationalCode: '',
      phone: '',
      jobTitle: '',
      department: '',
      supervisor: '',
      location: '',
      costCenter: '',
      fullOrgPath: '',
      day: 1,
      month: MONTHS[0],
      year: 1405,
      number: suggestWarningNumber(safeWarnings),
      site: '',
      name: '',
      unit: '',
      unitId: '',
      type: 'فردی',
      reason: '',
      repetitionText: 'اولین',
      noticeText: ''
    });
    setIsNoticeCustomized(false);
    setIsOrgCustomized(false);
  };

  // Start edit warning
  const startEditWarn = (w: WarningRecord) => {
    const roleUpper = (currentUser?.role || '').toUpperCase().replace(/[\s_]+/g, '');
    const canManage = ['ADMIN', 'ADMINISTRATOR', 'HSEMANAGER', 'SAFETYOFFICER', 'EXECUTIVEMANAGER'].includes(roleUpper) ||
                      roleUpper.includes('ADMIN') ||
                      roleUpper.includes('مدیر') ||
                      Boolean(currentUser?.permissions?.Warnings?.edit || currentUser?.permissions?.['Safety Warnings']?.edit);

    if (!canManage) {
      alert(isFa ? 'تنها مدیر ارشد و سرپرستان مجاز سیستم دسترسی ویرایش این اطلاعات را دارند.' : 'Only authorized managers and administrators can edit this information.');
      return;
    }

    // Ensure we switch to the records & registration tab
    setActiveTab('records');

    setEditingWarnId(w.id);

    // If some org metadata is missing in the warning record, attempt to resolve it from master personnel
    const candidateCode = w.personnelCode || w.name;
    const resolvedPerson = candidateCode ? findPersonnelByCode(candidateCode) : null;
    const resolvedOrg = resolvedPerson ? getPersonnelOrgDetails(resolvedPerson) : null;

    setWarnForm({
      id: w.id,
      personnelCode: w.personnelCode || (resolvedPerson ? (resolvedPerson.effectiveCode || resolvedPerson.personnelCode) : ''),
      name: w.name || '',
      nationalCode: w.nationalCode || resolvedPerson?.nationalCode || '',
      phone: w.phone || resolvedPerson?.phone || '',
      jobTitle: w.jobTitle || resolvedPerson?.jobTitle || resolvedOrg?.jobTitle || '',
      unit: w.unit || resolvedOrg?.unit || '',
      unitId: w.unitId || (resolvedPerson ? (resolvedPerson as any).orgNodeId : '') || '',
      department: w.department || resolvedOrg?.department || '',
      supervisor: w.supervisor || resolvedOrg?.supervisor || '',
      location: w.location || resolvedOrg?.location || '',
      costCenter: w.costCenter || resolvedOrg?.costCenter || '',
      fullOrgPath: w.fullOrgPath || resolvedOrg?.fullOrgPath || '',
      day: w.day || 1,
      month: w.month || MONTHS[0],
      year: w.year || 1404,
      number: w.number || suggestWarningNumber(safeWarnings),
      site: w.site || '',
      type: w.type || 'فردی',
      reason: w.reason || '',
      repetitionText: w.repetitionText || 'اولین',
      noticeText: w.noticeText || ''
    });
    setWarnError('');
    setIsNoticeCustomized(Boolean(w.noticeText && w.noticeText.trim()));
    setIsOrgCustomized(false);
    setIsRegisterModalOpen(true);
  };

  // Delete warning record
  const deleteWarningRecord = (w: WarningRecord) => {
    const roleUpper = (currentUser?.role || '').toUpperCase().replace(/[\s_]+/g, '');
    const canManage = ['ADMIN', 'ADMINISTRATOR', 'HSEMANAGER', 'SAFETYOFFICER', 'EXECUTIVEMANAGER'].includes(roleUpper) ||
                      roleUpper.includes('ADMIN') ||
                      roleUpper.includes('مدیر') ||
                      Boolean(currentUser?.permissions?.Warnings?.delete || currentUser?.permissions?.['Safety Warnings']?.delete);

    if (!canManage) {
      alert(isFa ? 'تنها مدیر ارشد و سرپرستان مجاز سیستم دسترسی حذف این اطلاعات را دارند.' : 'Only authorized managers and administrators can delete this information.');
      return;
    }
    setDeleteConfirm({
      title: isFa ? `آیا از حذف ابلاغیه اخطار شماره "${w?.number || ''}" متعلق به "${w?.name || ''}" اطمینان دارید؟` : `Delete warning notice #${w?.number || ''} for "${w?.name || ''}"?`,
      description: isFa ? 'این پرونده تخلف به طور کامل از پایگاه داده و سیستم حذف خواهد شد.' : 'This warning record will be permanently deleted from the database.',
      onConfirm: async () => {
        try {
          if (w.id) {
            await apiDb.deleteSafetyWarning(w.id);
          }
          if (w.number && w.number !== w.id) {
            await apiDb.deleteSafetyWarning(w.number).catch(() => {});
          }
        } catch (err) {
          console.warn('Backend warning delete error:', err);
        }
        const updated = safeWarnings.filter(item => item.id !== w.id && item.number !== w.number);
        onWarningsUpdated(updated);
        setDeleteConfirm(null);
        if (editingWarnId === w.id) {
          handleCancelEdit();
        }
      }
    });
  };

  // Excel Batch Import Handler
  const handleExcelImport = async (importedRecords: WarningRecord[], mode: 'merge' | 'replace') => {
    try {
      if (mode === 'replace') {
        await apiDb.clearAllSafetyWarnings();
      }

      // Batch save via database backend API
      await apiDb.saveSafetyWarningsBatch(importedRecords);

      // Re-fetch authoritative list from database
      const fresh = await apiDb.getSafetyWarnings();
      const updatedList = Array.isArray(fresh) && fresh.length > 0 
        ? fresh 
        : (mode === 'replace' ? importedRecords : [...safeWarnings, ...importedRecords]);

      const { clean } = deduplicateWarningRecords(updatedList);
      onWarningsUpdated(clean);

      // Audit Log for import operation
      if (activeUser?.username) {
        addAuditLog(
          activeUser.username,
          `ورود گروهی ${importedRecords.length} اخطار ایمنی از فایل اکسل (حالت: ${mode === 'replace' ? 'جایگزینی کامل' : 'ادغام و به‌روزرسانی'})`,
          'موفقیت‌آمیز',
          {
            module: 'ثبت و مدیریت اخطارها',
            description: `تعداد ردیف‌های واردشده: ${importedRecords.length}`
          }
        );
      }

      // Central Notification
      CentralNotificationService.sendNotification({
        title: 'ورود اطلاعات از اکسل به اخطارهای ایمنی',
        body: `${importedRecords.length} فقره اخطار جدید از فایل اکسل با موفقیت در پایگاه داده ثبت و پردازش گردید.`,
        category: 'info',
        priority: 'medium',
        sourceModule: 'warnings',
        actionUrl: '#warnings',
        sender: activeUser?.fullName || activeUser?.username || 'مدیر سیستم',
        playSound: true
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to import warnings from Excel:', err);
      const combined = mode === 'replace' ? importedRecords : [...safeWarnings, ...importedRecords];
      const { clean } = deduplicateWarningRecords(combined);
      onWarningsUpdated(clean);
    }
  };

  // Export to Excel (.xlsx)
  const handleExportWarnExcel = () => {
    exportWarningsToExcel(safeWarnings);
  };

  // Export to CSV
  const handleExportWarnCSV = () => {
    const headers = isFa 
      ? "ردیف,تاریخ,شماره ابلاغیه,سایت,نام,کد پرسنلی,کد ملی,سمت,واحد سازمانی,دپارتمان,سرپرست مستقیم,نوع اخطار,علت اخطار\n"
      : "Row,Date,Notice ID,Field,Name,Personnel Code,National Code,Position,Unit,Department,Supervisor,Warning Type,Violation Details\n";
    
    const rows = safeWarnings.map((w, idx) => {
      const reasonEsc = (w.reason || '').replace(/"/g, '""');
      return `${idx + 1},"${w.day || 1} ${w.month || 'فروردین'} ${w.year || 1404}","${w.number || ''}","${w.site || ''}","${w.name || ''}","${w.personnelCode || ''}","${w.nationalCode || ''}","${w.jobTitle || ''}","${w.unit || ''}","${w.department || ''}","${w.supervisor || ''}","${w.type || 'فردی'}","${reasonEsc}"`;
    }).join("\n");

    downloadCsvFile(`HSE_Warnings_Ledger_${new Date().toISOString().slice(0, 10)}.csv`, headers + rows);
  };

  // Filtered warnings for ledger
  const filteredWarnings = useMemo(() => {
    if (!searchTerm.trim()) return safeWarnings;
    const q = searchTerm.toLowerCase();
    return safeWarnings.filter(w => 
      (w.name || '').toLowerCase().includes(q) ||
      (w.number || '').toLowerCase().includes(q) ||
      (w.unit || '').toLowerCase().includes(q) ||
      (w.site || '').toLowerCase().includes(q) ||
      (w.reason || '').toLowerCase().includes(q) ||
      (w.personnelCode || '').toLowerCase().includes(q) ||
      (w.jobTitle || '').toLowerCase().includes(q) ||
      (w.department || '').toLowerCase().includes(q) ||
      (w.supervisor || '').toLowerCase().includes(q)
    );
  }, [safeWarnings, searchTerm]);

  // Aggregations
  const aggByUnit = useMemo(() => {
    const map = new Map<string, number>();
    safeWarnings.forEach(w => map.set(w.unit, (map.get(w.unit) || 0) + 1));
    return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }, [safeWarnings]);

  const aggByType = useMemo(() => {
    const map = new Map<string, number>();
    safeWarnings.forEach(w => map.set(w.type, (map.get(w.type) || 0) + 1));
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
  }, [safeWarnings]);

  const aggByMonth = useMemo(() => {
    return MONTHS.map(m => {
      const count = safeWarnings.filter(w => w.month === m).length;
      return { month: m, count };
    });
  }, [safeWarnings]);

  const aggByName = useMemo(() => {
    const map = new Map<string, number>();
    safeWarnings.forEach(w => map.set(w.name, (map.get(w.name) || 0) + 1));
    return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [safeWarnings]);

  const aggByYear = useMemo(() => {
    const map = new Map<number, number>();
    safeWarnings.forEach(w => map.set(w.year, (map.get(w.year) || 0) + 1));
    return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => a.label - b.label);
  }, [safeWarnings]);

  // Total metrics
  const totalCount = safeWarnings.length;
  const individualCount = safeWarnings.filter(w => w.type === 'فردی').length;
  const unitCount = safeWarnings.filter(w => w.type === 'واحدی').length;
  const topUnit = aggByUnit[0]?.label || '—';

  // Print Notice Function (Official A5 Format with rich user and organizational metadata)
  const handlePrint = (w: WarningRecord) => {
    setPrintNoticeRecord(w);
  };

  const handleLegacyPrint = (w: WarningRecord) => {
    handlePrint(w);
  };
  const _unusedOldPrint = (w: WarningRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const persianDate = `${w.day} ${w.month} ${w.year}`;
    const printCompany = companyNameFa || 'مجتمع پتروشیمی رجال';
    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="Logo" class="print-logo" />` : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <title>حکم اخطار ایمنی - ${w.number}</title>
        <style>
          @page {
            size: A5 landscape;
            margin: 8mm;
          }
          body {
            font-family: 'Vazirmatn', 'B Nazanin', Tahoma, sans-serif;
            margin: 0;
            padding: 10px;
            color: #1e293b;
            background: #fff;
            box-sizing: border-box;
            font-size: 11px;
            line-height: 1.6;
          }
          .notice-card {
            border: 3px solid #1b365d;
            border-radius: 8px;
            padding: 16px;
            position: relative;
            background: #ffffff;
            box-sizing: border-box;
            height: 96%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #1b365d;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }
          .company-info {
            text-align: center;
            flex-grow: 1;
          }
          .company-info h2 {
            margin: 0;
            font-size: 15px;
            font-weight: 900;
            color: #1b365d;
          }
          .company-info h3 {
            margin: 4px 0 0;
            font-size: 12px;
            font-weight: bold;
            color: #1e293b;
          }
          .meta-info {
            text-align: left;
            font-size: 10px;
            font-weight: bold;
            min-width: 140px;
          }
          .meta-info div {
            margin-bottom: 3px;
          }
          .print-logo {
            max-height: 48px;
            max-width: 90px;
            object-fit: contain;
          }
          .org-badge-table {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0;
            font-size: 10px;
          }
          .org-badge-table td {
            border: 1px solid #bfdbfe;
            padding: 5px 8px;
            background: #f8fafc;
          }
          .org-badge-table td.label {
            font-weight: bold;
            color: #1b365d;
            background: #eff6ff;
            width: 20%;
          }
          .org-badge-table td.val {
            font-weight: 800;
            color: #0f172a;
          }
          .body-content {
            margin: 10px 0;
            font-size: 11px;
            text-align: justify;
            line-height: 1.8;
          }
          .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            margin-top: 14px;
            border: 1px solid #1b365d;
            text-align: center;
            padding: 6px;
          }
          .sig-block {
            font-size: 10px;
            font-weight: bold;
          }
          .sig-space {
            height: 35px;
          }
        </style>
      </head>
      <body>
        <div class="notice-card">
          <div class="header">
            <div>${logoHtml}</div>
            <div class="company-info">
              <h2>${printCompany}</h2>
              <h3>مرکز بهداشت، ایمنی و محیط زیست (HSE)</h3>
              <div style="font-size: 11.5px; font-weight: 800; color: #991b1b; margin-top: 4px;">
                برگه رسمی اخطار کتبی و تذکر انضباطی رعایت الزامات ایمنی
              </div>
            </div>
            <div class="meta-info">
              <div>شماره ابلاغیه: <span style="font-family: monospace; color: #dc2626;">${w.number}</span></div>
              <div>تاریخ صدور: <span>${persianDate}</span></div>
              <div>نوع اخطار: <span>${w.type}</span></div>
            </div>
          </div>

          <div class="body-content">
            جناب آقای <strong>${w.name || '................'}</strong> واحد / پیمانکار <strong>${w.unit || '................'}</strong> بدینوسیله برای <strong>${w.repetitionText || 'اولین'}</strong> بار به دلیل <strong>« ${w.reason} »</strong> به شما اخطار داده می‌شود تا نسبت به عدم تکرار مورد فوق و رعایت مقررات بهداشت ، ایمنی و محیط زیست مطابق با دستورالعمل ${printCompany} اقدام فرمایید .
          </div>

          <div class="signatures">
            <div class="sig-block">
              <div>صادرکننده اخطار</div>
              <div style="font-size: 9px; color: #1b365d;">(کارشناس / ناظر HSE)</div>
              <div class="sig-space"></div>
              <div>امضاء و تاریخ</div>
            </div>
            <div class="sig-block">
              <div>مرکز HSE</div>
              <div style="font-size: 9px; color: #1b365d;">${printCompany}</div>
              <div class="sig-space"></div>
              <div>مهر و امضاء</div>
            </div>
            <div class="sig-block">
              <div>مدیریت مجتمع</div>
              <div style="font-size: 9px; color: #1b365d;">${printCompany}</div>
              <div class="sig-space"></div>
              <div>مهر و امضاء نهایی</div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6" id="warnings-management-module">
      {/* Header Banner & Two Primary Navigation Tabs */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-xs">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{isFa ? 'ثبت و مدیریت اخطارهای کتبی و گزارش خطا' : 'HSE Written Warnings & Infraction Management'}</span>
                <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-300 dark:border-blue-800">
                  {safeWarnings.length} {isFa ? 'پرونده' : 'cases'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                {isFa 
                  ? 'سامانه یکپارچه پایش تخلفات ایمنی، ثبت احکام انضباطی با استخراج اطلاعات سازمانی از Master Data و داشبورد تحلیلی'
                  : 'Integrated system for tracking safety infractions, issuing disciplinary notices with auto-extracted org data, and analytics.'}
              </p>
            </div>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleOpenRegisterModal}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isFa ? 'ثبت اخطار جدید' : 'New Warning'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExcelImportModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
              title={isFa ? 'ورود اطلاعات اخطارها از فایل اکسل (.xlsx / .csv)' : 'Import Warnings from Excel'}
            >
              <UploadCloud className="w-4 h-4" />
              <span>{isFa ? 'ورود از اکسل' : 'Import Excel'}</span>
            </button>

            <button
              type="button"
              onClick={downloadWarningsExcelTemplate}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-200 dark:border-slate-700"
              title={isFa ? 'دانلود فایل اکسل نمونه استاندارد با راهنمای تکمیل' : 'Download Sample Excel Template with Instructions'}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isFa ? 'الگوی نمونه' : 'Template'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportWarnExcel}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-200 dark:border-slate-700"
              title={isFa ? 'خروجی اکسل استاندارد (.xlsx)' : 'Export to Excel (.xlsx)'}
            >
              <Download className="w-4 h-4" />
              <span>{isFa ? 'خروجی اکسل' : 'Export Excel'}</span>
            </button>
          </div>
        </div>

        {/* PRIMARY TWO-SECTION TABS AS REQUESTED */}
        <div className="flex items-center p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl gap-1.5 border border-slate-200/80 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'records'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md border border-blue-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileEdit className="w-4 h-4" />
            <span>{isFa ? 'بخش اول: ثبت و مدیریت گزارش خطا و پرونده‌ها' : 'Section 1: Violation Registration & Ledger'}</span>
            {editingWarnId && (
              <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                {isFa ? 'در حال ویرایش' : 'Editing'}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('charts')}
            className={`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'charts'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md border border-blue-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{isFa ? 'بخش دوم: نمایش نمودارها و داشبورد تحلیلی' : 'Section 2: Analytics & Visual Charts'}</span>
            <span className="text-[10px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
              {safeWarnings.length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: REGISTRATION & LEDGER MANAGEMENT (ثبت گزارش خطا و مدیریت پرونده‌ها) */}
      {/* ========================================================================= */}
      {activeTab === 'records' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Alert Banner if Duplicate Records are Detected in Warnings List */}
          {duplicateDetectedCount > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/50 border border-blue-300 dark:border-blue-700 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-200 dark:bg-amber-900/70 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <CopyX className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-black">
                    {isFa 
                      ? `شناسایی ${duplicateDetectedCount} رکورد تکراری در سامانه اخطارها` 
                      : `${duplicateDetectedCount} duplicate records detected in the ledger`}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                    {isFa 
                      ? 'رکوردهای با شماره ابلاغیه یا مشخصات نقض یکسان شناسایی شدند. جهت حذف آن‌ها دکمه زیر را بفشارید.' 
                      : 'Records with identical notice numbers or violation signatures detected.'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDeduplicateWarnings}
                disabled={isDeduplicating}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isFa ? 'حذف تمام داده‌های تکراری' : 'Purge All Duplicates'}</span>
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* REGISTRATION & EDIT MODAL / NEW PAGE (صحفه جدید جهت ثبت و ویرایش اخطار) */}
          {/* ========================================================================= */}
          {isRegisterModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
              <div ref={formSectionRef} className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="p-5 bg-gradient-to-r from-blue-600/10 via-slate-50 to-transparent dark:from-blue-950/30 dark:via-slate-900 dark:to-transparent border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <FileEdit className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>
                          {editingWarnId 
                            ? (isFa ? 'ویرایش اطلاعات اخطار و مشخصات سازمانی' : 'Edit Warning Notice & Org Metadata')
                            : (isFa ? 'فرم ثبت تخلف و صدور اخطار کتبی ایمنی' : 'Register Safety Infraction Notice')}
                        </span>
                        <span className="text-[11px] font-mono font-black text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-300 dark:border-blue-800">
                          {warnForm.number}
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isFa 
                          ? 'اطلاعات پرسنلی و سازمانی از Master Data استخراج شده و در بخش زیر به طور کامل قابل ویرایش است.' 
                          : 'Personnel & organizational data are auto-extracted from settings and fully editable below.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition cursor-pointer"
                    title={isFa ? 'بستن فرم' : 'Close'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleWarnSubmit} className="p-5 sm:p-6 space-y-6 overflow-y-auto">
              
              {/* BLOCK 1: Basic Notice Attributes (Date, ID, Field Site) */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                  <span>{isFa ? '۱. مشخصات شناسنامه اخطار و تاریخ ثبت' : '1. Notice Document & Date Attributes'}</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  {/* Notice Number */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      {isFa ? 'شماره پرونده / ابلاغیه' : 'Notice Number'}
                    </label>
                    <input
                      type="text"
                      value={warnForm.number}
                      onChange={e => setWarnForm(prev => ({ ...prev, number: e.target.value }))}
                      placeholder="HSE/w/..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-blue-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Day */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">{isFa ? 'روز' : 'Day'}</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={warnForm.day}
                      onChange={e => setWarnForm(prev => ({ ...prev, day: parseInt(e.target.value) || 1 }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 text-center"
                    />
                  </div>

                  {/* Month */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">{isFa ? 'ماه' : 'Month'}</label>
                    <select
                      value={warnForm.month}
                      onChange={e => setWarnForm(prev => ({ ...prev, month: e.target.value }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                      {MONTHS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Year */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">{isFa ? 'سال' : 'Year'}</label>
                    <input
                      type="number"
                      value={warnForm.year}
                      onChange={e => setWarnForm(prev => ({ ...prev, year: parseInt(e.target.value) || 1404 }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 text-center"
                    />
                  </div>

                  {/* Field Site */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">{isFa ? 'سایت / مجتمع' : 'Site / Field'}</label>
                    <input
                      list="site-list"
                      type="text"
                      value={warnForm.site}
                      onChange={e => setWarnForm(prev => ({ ...prev, site: e.target.value }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                    <datalist id="site-list">
                      {extractedSites.map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* BLOCK 2: Personnel Selector from Master Data Settings */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-500" />
                    <span>{isFa ? '۲. جستجو و انتخاب فرد یا مسئول دریافت‌کننده اخطار از Master Data پرسنل' : '2. Select Personnel from Master Data'}</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {isFa ? 'انتخاب از تنظیمات چارت و پرسنل مجتمع' : 'Linked to Organization Structure Settings'}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <CentralPersonnelSelector
                    language={isFa ? 'fa' : 'en'}
                    label={isFa ? 'جستجوی هوشمند در پایگاه داده مرکزی پرسنل' : 'Search Master Personnel Data'}
                    required={false}
                    selectedPersonnelCode={warnForm.personnelCode}
                    onSelectPersonnel={handleSelectPersonnel}
                    showOrgBadges={false} // We suppress the static read-only card in favor of the fully editable card below!
                    placeholder={isFa ? 'نام، کد پرسنلی یا کد ملی را تایپ کنید...' : 'Type name, code or national ID...'}
                  />
                </div>
              </div>

              {/* BLOCK 3: REDESIGNED FULLY-EDITABLE USER & ORGANIZATIONAL METADATA CARD */}
              <div className="bg-blue-50/40 dark:bg-slate-800/60 p-5 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200/60 dark:border-slate-700/60 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span>{isFa ? '۳. اطلاعات هویتی و سازمانی استخراج‌شده از تنظیمات (کاملاً قابل ویرایش)' : '3. Extracted User & Organizational Metadata (Fully Editable)'}</span>
                        {warnForm.name || warnForm.personnelCode ? (
                          isOrgCustomized ? (
                            <span className="text-[9px] bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-md font-bold">
                              {isFa ? 'ویرایش‌شده توسط کاربر' : 'Customized'}
                            </span>
                          ) : (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-md font-bold">
                              {isFa ? 'هماهنگ با تنظیمات' : 'Synced with Settings'}
                            </span>
                          )
                        ) : (
                          <span className="text-[9px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-md font-medium">
                            {isFa ? 'هنوز کاربری انتخاب نشده است' : 'No user selected'}
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {isFa ? 'شما می‌توانید هر یک از مقادیر زیر را به صورت دستی تصحیح، تکمیل یا شخصی‌سازی فرمایید.' : 'You can edit or customize any field below.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 11 Fully Editable Input Fields in Responsive Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                  
                  {/* Field 1: Full Name */}
                  <div>
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                      <User className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isFa ? 'نام و نام خانوادگی' : 'Full Name'}</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={warnForm.name}
                      onChange={e => {
                        setWarnForm(prev => ({ ...prev, name: e.target.value }));
                        setIsOrgCustomized(true);
                      }}
                      placeholder={isFa ? 'نام و نام خانوادگی' : 'Full Name'}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Field 2: Personnel Code */}
                  <div>
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                      <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isFa ? 'کد پرسنلی' : 'Personnel Code'}</span>
                    </label>
                    <input
                      type="text"
                      value={warnForm.personnelCode}
                      onChange={e => {
                        setWarnForm(prev => ({ ...prev, personnelCode: e.target.value }));
                        setIsOrgCustomized(true);
                      }}
                      placeholder="123456"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Field 3: National Code */}
                  <div>
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isFa ? 'کد ملی' : 'National Code'}</span>
                    </label>
                    <input
                      type="text"
                      value={warnForm.nationalCode}
                      onChange={e => {
                        setWarnForm(prev => ({ ...prev, nationalCode: e.target.value }));
                        setIsOrgCustomized(true);
                      }}
                      placeholder="1810000000"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Field 4: Contact Phone */}
                  <div>
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                      <Phone className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isFa ? 'تلفن تماس' : 'Phone'}</span>
                    </label>
                    <input
                      type="text"
                      value={warnForm.phone}
                      onChange={e => {
                        setWarnForm(prev => ({ ...prev, phone: e.target.value }));
                        setIsOrgCustomized(true);
                      }}
                      placeholder="09120000000"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Field 5: Job Title */}
                  <div>
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                      <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isFa ? 'سمت سازمانی / شغل' : 'Job Title / Position'}</span>
                    </label>
                    <input
                      type="text"
                      value={warnForm.jobTitle}
                      onChange={e => {
                        setWarnForm(prev => ({ ...prev, jobTitle: e.target.value }));
                        setIsOrgCustomized(true);
                      }}
                      placeholder={isFa ? 'مثال: کارشناس فرآیند' : 'e.g. Process Specialist'}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Field 6: Unit / Plant */}
                  <div>
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                      <Building className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isFa ? 'واحد / پلنت سازمانی' : 'Unit / Plant'}</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <UniversalOrgUnitSelect
                      value={warnForm.unit}
                      unitId={warnForm.unitId}
                      onChange={(id, name, unitObj) => {
                        setWarnForm(prev => ({
                          ...prev,
                          unitId: id,
                          unit: name,
                          department: unitObj?.parentName || prev.department,
                          site: unitObj?.location || prev.site
                        }));
                        setIsOrgCustomized(true);
                      }}
                      required
                      isFa={isFa}
                      placeholder={isFa ? '-- انتخاب واحد سازمانی --' : '-- Select Unit --'}
                    />
                  </div>

                  {/* Field 7: Department */}
                  <div>
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                      <Building2 className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isFa ? 'اداره / دپارتمان تابعه' : 'Department'}</span>
                    </label>
                    <input
                      list="extracted-depts-list"
                      type="text"
                      value={warnForm.department}
                      onChange={e => {
                        setWarnForm(prev => ({ ...prev, department: e.target.value }));
                        setIsOrgCustomized(true);
                      }}
                      placeholder={isFa ? 'اداره یا دپارتمان' : 'Department'}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                    <datalist id="extracted-depts-list">
                      {extractedDepts.map(d => <option key={d} value={d} />)}
                    </datalist>
                  </div>

                  {/* Field 8: Direct Supervisor */}
                  <div>
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                      <User className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isFa ? 'سرپرست مستقیم / مدیر واحد' : 'Supervisor'}</span>
                    </label>
                    <input
                      type="text"
                      value={warnForm.supervisor}
                      onChange={e => {
                        setWarnForm(prev => ({ ...prev, supervisor: e.target.value }));
                        setIsOrgCustomized(true);
                      }}
                      placeholder={isFa ? 'نام سرپرست مستقیم' : 'Supervisor Name'}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Field 9: Location */}
                  <div>
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isFa ? 'موقعیت فیزیکی' : 'Physical Location'}</span>
                    </label>
                    <input
                      type="text"
                      value={warnForm.location}
                      onChange={e => {
                        setWarnForm(prev => ({ ...prev, location: e.target.value }));
                        setIsOrgCustomized(true);
                      }}
                      placeholder={isFa ? 'موقعیت فیزیکی استقرار' : 'Work Location'}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Field 10: Cost Center */}
                  <div>
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                      <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isFa ? 'مرکز هزینه (Cost Center)' : 'Cost Center'}</span>
                    </label>
                    <input
                      type="text"
                      value={warnForm.costCenter}
                      onChange={e => {
                        setWarnForm(prev => ({ ...prev, costCenter: e.target.value }));
                        setIsOrgCustomized(true);
                      }}
                      placeholder="CC-1020"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Field 11: Full Org Path (Spans 2 columns) */}
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                      <Layers className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isFa ? 'مسیر سلسله‌مراتب سازمانی' : 'Organizational Hierarchy Path'}</span>
                    </label>
                    <input
                      type="text"
                      value={warnForm.fullOrgPath}
                      onChange={e => {
                        setWarnForm(prev => ({ ...prev, fullOrgPath: e.target.value }));
                        setIsOrgCustomized(true);
                      }}
                      placeholder={isFa ? 'پتروشیمی > سایت > مدیریت > اداره کل > واحد' : 'Hierarchy chain'}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                </div>
              </div>

              {/* BLOCK 4: Warning Type & Violation Reason */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-blue-500" />
                  <span>{isFa ? '۴. نوع اخطار و شرح دقیق تخلف ایمنی' : '4. Notice Type & Infraction Details'}</span>
                </span>

                {/* Warning Type Radios */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1.5">
                    {isFa ? 'نوع اخطار کتبی:' : 'Warning Type:'}
                  </label>
                  <div className="flex items-center gap-3">
                    <label
                      onClick={() => setWarnForm(prev => ({ ...prev, type: 'فردی' }))}
                      className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                        warnForm.type === 'فردی'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-black'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      <span className="text-xs">{isFa ? 'اخطار فردی (شخصی)' : 'Individual Notice'}</span>
                    </label>

                    <label
                      onClick={() => setWarnForm(prev => ({ ...prev, type: 'واحدی' }))}
                      className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                        warnForm.type === 'واحدی'
                          ? 'bg-violet-600 text-white border-violet-600 shadow-sm font-black'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span className="text-xs">{isFa ? 'اخطار واحدی (گروهی / پیمانکار)' : 'Departmental / Group Notice'}</span>
                    </label>
                  </div>
                </div>

                {/* Repetition / Recurrence Order */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                      {isFa ? 'نوبت اخطار (سابقه تکرار تخلف):' : 'Warning Occurrence / Repetition:'}
                    </label>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                      {isFa ? `درج در عبارت قانونی: برای ${warnForm.repetitionText || 'اولین'} بار` : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {['اولین', 'دومین', 'سومین', 'چهارمین', 'پنجمین'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setWarnForm(prev => ({ ...prev, repetitionText: opt }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                          warnForm.repetitionText === opt
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt} بار
                      </button>
                    ))}
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={warnForm.repetitionText || ''}
                        onChange={e => setWarnForm(prev => ({ ...prev, repetitionText: e.target.value }))}
                        placeholder={isFa ? 'سایر (مثلا: اولین)' : 'Other (e.g. 1st)'}
                        className="w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-slate-100"
                      />
                      <span className="text-xs text-slate-500 font-bold">بار</span>
                    </div>
                  </div>
                </div>

                {/* Violation Reason & Quick HSE Tags */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                      {isFa ? 'علت و شرح تخلف کتبی:' : 'Violation Description:'}
                      <span className="text-rose-500 mr-1">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {isFa ? 'یا از موارد پرکاربرد زیر انتخاب کنید:' : 'Or choose common violation:'}
                    </span>
                  </div>

                  {/* Common Preset Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {COMMON_HSE_VIOLATIONS.map((violationText, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setWarnForm(prev => ({ ...prev, reason: violationText }))}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 transition cursor-pointer"
                      >
                        + {violationText}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    required
                    value={warnForm.reason}
                    onChange={e => setWarnForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder={isFa ? 'شرح کامل تخلف ایمنی، شرایط ناایمن ایجاد شده، تاریخ، مکان و ارجاع به دستورالعمل‌های HSE...' : 'Detailed description of the safety violation...'}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                {/* Official Mandated Notice Sentence - Fully Editable Form Control */}
                <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800 rounded-xl space-y-2">
                  <div className="text-[10.5px] font-black text-blue-900 dark:text-blue-300 flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-1.5">
                      <FileEdit className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>{isFa ? `متن رسمی ابلاغیه (قالب مصوب ${companyNameFa || 'مجتمع'} - قابل ویرایش):` : 'Official Mandated Notice Text (Editable):'}</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isNoticeCustomized && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsNoticeCustomized(false);
                            setWarnForm(prev => ({ ...prev, noticeText: defaultNoticeText }));
                          }}
                          className="text-[9.5px] px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-blue-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 font-bold transition flex items-center gap-1 cursor-pointer"
                          title={isFa ? 'بازنشانی به متن استاندارد قالب مصوب' : 'Reset to default template text'}
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{isFa ? 'بازنشانی به قالب مصوب' : 'Reset to Template'}</span>
                        </button>
                      )}
                      <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800 font-bold">
                        {isFa ? 'قابل ویرایش' : 'Editable'}
                      </span>
                      <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold">
                        A5 استانداردهای HSE
                      </span>
                    </div>
                  </div>

                  <textarea
                    rows={4}
                    value={currentNoticeText}
                    onChange={e => {
                      setIsNoticeCustomized(true);
                      setWarnForm(prev => ({ ...prev, noticeText: e.target.value }));
                    }}
                    placeholder={isFa ? 'متن ابلاغیه رسمی اخطار کتبی ایمنی...' : 'Official written warning notice text...'}
                    className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-slate-700 rounded-lg p-3 text-xs font-medium text-slate-800 dark:text-slate-100 leading-relaxed text-justify shadow-2xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-y"
                  />

                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                    <span>
                      {isFa 
                        ? 'این متن به صورت خودکار از فیلدهای بالا تولید می‌شود و مستقیماً در این کادر قابل ویرایش بوده و در حکم چاپی A5 اعمال می‌گردد.' 
                        : 'This notice text is auto-generated and can be directly edited here. It reflects on the official A5 printout.'}
                    </span>
                    {isNoticeCustomized && (
                      <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                        <span>{isFa ? '✏️ متن توسط کاربر ویرایش گردید' : '✏️ Customized'}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Error Notification */}
              {warnError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 shrink-0" />
                  <span>{warnError}</span>
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-slate-400">
                  {editingWarnId 
                    ? (isFa ? 'در حال به روزرسانی پرونده موجود' : 'Updating existing record')
                    : (isFa ? 'ثبت پرونده با قابلیت استخراج و چاپ فوری' : 'Ready to record and print')}
                </div>

                <div className="flex items-center gap-2">
                  {editingWarnId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                    >
                      {isFa ? 'انصراف' : 'Cancel'}
                    </button>
                  )}

                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-600/20 transition flex items-center gap-2 cursor-pointer"
                  >
                    {editingWarnId ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{isFa ? 'ذخیره تغییرات پرونده' : 'Save Changes'}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>{isFa ? 'ثبت و صدور اخطار کتبی' : 'Issue Written Warning'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

          {/* WARNINGS LEDGER & RECORDS TABLE */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    {isFa ? 'دفتر ثبت و سوابق اخطارهای کتبی صادرشده' : 'Safety Infraction Ledger & Case History'}
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {isFa 
                      ? `${filteredWarnings.length} پرونده ثبت‌شده • امکان جستجو، چاپ حکم رسمی A5 و ویرایش پرونده‌ها`
                      : `${filteredWarnings.length} cases registered • Search, print official notice, and edit.`}
                  </p>
                </div>
              </div>

              {/* Search in Ledger */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Search Input */}
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder={isFa ? 'جستجو در نام، شماره، واحد، علت...' : 'Search by name, ID, unit, reason...'}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto text-[11px] custom-scrollbar">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200 dark:border-slate-800 font-bold bg-slate-50/50 dark:bg-slate-800/30">
                    <th className="py-2.5 px-2 text-right">{isFa ? 'ردیف' : 'Row'}</th>
                    <th className="py-2.5 px-2 text-center">{isFa ? 'تاریخ' : 'Date'}</th>
                    <th className="py-2.5 px-2 text-center">{isFa ? 'شماره ابلاغیه' : 'Notice ID'}</th>
                    <th className="py-2.5 px-2 text-right">{isFa ? 'سایت' : 'Site'}</th>
                    <th className="py-2.5 px-2 text-right">{isFa ? 'کارمند / فرد خاطی' : 'Personnel'}</th>
                    <th className="py-2.5 px-2 text-right">{isFa ? 'واحد سازمانی' : 'Unit'}</th>
                    <th className="py-2.5 px-2 text-right">{isFa ? 'سمت' : 'Position'}</th>
                    <th className="py-2.5 px-2 text-center">{isFa ? 'نوع' : 'Type'}</th>
                    <th className="py-2.5 px-2 text-right max-w-xs">{isFa ? 'شرح و علت تخلف' : 'Violation Details'}</th>
                    <th className="py-2.5 px-2 text-center">{isFa ? 'عملیات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-400">
                  {filteredWarnings.slice().reverse().map((w, idx) => {
                    const isRowEditing = editingWarnId === w.id;
                    return (
                      <tr 
                        key={w.id} 
                        className={`transition-colors ${
                          isRowEditing 
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-600' 
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="py-3 px-2 text-right font-mono text-slate-400">{filteredWarnings.length - idx}</td>
                        <td className="py-3 px-2 text-center font-mono whitespace-nowrap">{`${w.day} ${w.month} ${w.year}`}</td>
                        <td className="py-3 px-2 text-center font-mono font-bold text-blue-600 dark:text-blue-400">{w.number}</td>
                        <td className="py-3 px-2 text-right font-semibold text-slate-700 dark:text-slate-200">{w.site}</td>
                        <td className="py-3 px-2 text-right">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{w.name}</div>
                          {w.personnelCode && (
                            <div className="text-[10px] font-mono text-slate-400">#{w.personnelCode}</div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{w.unit}</span>
                          {w.department && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-[120px]">{w.department}</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[110px]">
                          {w.jobTitle || '—'}
                        </td>
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            w.type === 'فردی' 
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800' 
                              : 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800'
                          }`}>
                            {w.type}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-slate-500 text-xs truncate max-w-xs" title={w.reason}>
                          {w.reason}
                        </td>
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <div className="flex gap-1.5 justify-center">
                            <button 
                              onClick={() => setReferralWarning(w)} 
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer" 
                              title={isFa ? 'ارجاع سند اخطار جهت بررسی، تأیید و امضا' : 'Refer Warning Document'}
                            >
                              <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </button>
                            <button 
                              onClick={() => setTrackerWarning(w)} 
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer" 
                              title={isFa ? 'رهگیری گردش کار و امضاها' : 'Workflow & Signatures Tracker'}
                            >
                              <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </button>
                            <button 
                              onClick={() => handlePrint(w)} 
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition cursor-pointer" 
                              title={isFa ? 'چاپ حکم اخطار A5' : 'Print Notice'}
                            >
                              <Printer className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                            </button>
                            <button 
                              onClick={() => startEditWarn(w)} 
                              className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition cursor-pointer" 
                              title={isFa ? 'ویرایش پرونده و اطلاعات سازمانی' : 'Edit Case'}
                            >
                              <Edit3 className="w-4 h-4 text-sky-600" />
                            </button>
                            <button 
                              onClick={() => deleteWarningRecord(w)} 
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer" 
                              title={isFa ? 'حذف اخطار' : 'Delete'}
                            >
                              <Trash2 className="w-4 h-4 text-rose-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredWarnings.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-16 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2.5 max-w-md mx-auto px-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                            <FileWarning className="w-6 h-6 text-slate-400" />
                          </div>
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {isFa ? 'هیچ پرونده اخطاری در سامانه وجود ندارد' : 'No warnings registered'}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            {isFa 
                              ? 'کلیه سوابق پاکسازی شده‌اند و هیچ داده پیش‌فرضی در سامانه قرار ندارد. برای ثبت اولین اخطار، روی دکمه زیر کلیک فرمایید.' 
                              : 'All records have been cleared and zero default records exist. Click below to issue the first warning.'}
                          </p>
                          <button
                            type="button"
                            onClick={handleOpenRegisterModal}
                            className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-600/20 transition cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>{isFa ? 'ثبت اخطار جدید' : 'Issue New Warning'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: VISUAL CHARTS & ANALYTICS DASHBOARD (نمایش نمودارها و داشبورد تحلیلی) */}
      {/* ========================================================================= */}
      {activeTab === 'charts' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="warnings-metrics-grid">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400">{isFa ? 'کل اخطارهای صادره' : 'Total Warnings'}</span>
                <h3 className="text-2xl font-black font-mono text-slate-800 dark:text-slate-100">{totalCount}</h3>
                <span className="text-[10px] text-slate-500">{isFa ? 'ثبت‌شده در کل سایت‌ها' : 'Across all sites'}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400">{isFa ? 'اخطارهای انفرادی' : 'Individual Warnings'}</span>
                <h3 className="text-2xl font-black font-mono text-blue-600">{individualCount}</h3>
                <span className="text-[10px] text-slate-500">
                  {totalCount > 0 ? `${Math.round((individualCount / totalCount) * 100)}%` : '0%'} {isFa ? 'از کل اخطارها' : 'of total'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400">{isFa ? 'اخطارهای واحدی / گروهی' : 'Unit Warnings'}</span>
                <h3 className="text-2xl font-black font-mono text-violet-600">{unitCount}</h3>
                <span className="text-[10px] text-slate-500">
                  {totalCount > 0 ? `${Math.round((unitCount / totalCount) * 100)}%` : '0%'} {isFa ? 'از کل اخطارها' : 'of total'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400">{isFa ? 'پرتکرارترین واحد متخلف' : 'Top Violation Unit'}</span>
                <h3 className="text-lg font-black text-rose-600 truncate max-w-[140px]" title={topUnit}>{topUnit}</h3>
                <span className="text-[10px] text-slate-500">{aggByUnit[0]?.count || 0} {isFa ? 'مورد تخلف ثبت‌شده' : 'violations'}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Quick Action to Register From Charts */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <FileEdit className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black">{isFa ? 'نیاز به ثبت گزارش خطای جدید دارید؟' : 'Need to record a new infraction?'}</h4>
                <p className="text-xs text-blue-100 font-medium">
                  {isFa ? 'می‌توانید فوراً به بخش ثبت گزارش خطا بازگشته و پرونده جدید با استخراج اطلاعات سازمانی ایجاد کنید.' : 'Quickly jump to the registration tab to issue an official notice.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab('records');
                handleOpenRegisterModal();
              }}
              className="px-4 py-2 rounded-xl bg-white text-blue-700 font-black text-xs hover:bg-blue-50 transition shadow-sm cursor-pointer whitespace-nowrap"
            >
              {isFa ? '➕ ثبت و صدور اخطار کتبی جدید' : '➕ Register New Notice'}
            </button>
          </div>

          {/* Chart View Switcher: Customizable Advanced vs Classic */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                {isFa ? 'حالت نمایش نمودارهای تحلیلی:' : 'Chart Display Mode:'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setChartViewMode('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  chartViewMode === 'custom'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isFa ? 'داشبورد پیشرفته شخصی‌سازی‌شده' : 'Customizable Dashboard'}</span>
              </button>

              <button
                type="button"
                onClick={() => setChartViewMode('classic')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  chartViewMode === 'classic'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{isFa ? 'نمای کلاسیک نمودارها' : 'Classic View'}</span>
              </button>
            </div>
          </div>

          {/* RENDER CHARTS: Custom or Classic */}
          {chartViewMode === 'custom' ? (
            <CustomizableWarningCharts 
              warnings={safeWarnings} 
              language={language}
              currentUser={currentUser}
            />
          ) : (
            <div className="space-y-6">
              {/* Classic Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Chart 1: Warnings by Unit */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Building className="w-4 h-4 text-blue-500" />
                      <span>{isFa ? 'توزیع اخطارهای ایمنی بر اساس واحد سازمانی' : 'Warnings by Department / Unit'}</span>
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400">{aggByUnit.length} {isFa ? 'واحد' : 'units'}</span>
                  </div>

                  <div className="h-64 w-full min-w-0">
                    <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={230} debounce={50}>
                      <BarChart data={aggByUnit} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-30} textAnchor="end" />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '11px' }}
                          formatter={(value: any) => [`${value} اخطار`, 'تعداد']}
                        />
                        <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Warnings Monthly Trend */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-sky-500" />
                      <span>{isFa ? 'روند زمانی صدور اخطارها در طول ماه‌های سال' : 'Monthly Warning Distribution'}</span>
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400">۱۴۰۴ - ۱۴۰۵</span>
                  </div>

                  <div className="h-64 w-full min-w-0">
                    <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={230} debounce={50}>
                      <BarChart data={aggByMonth} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-30} textAnchor="end" />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '11px' }}
                          formatter={(value: any) => [`${value} اخطار`, 'تعداد']}
                        />
                        <Bar dataKey="count" fill="#0284c7" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Aggregations Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4" id="warnings-aggregations-grid">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                {isFa ? 'پرتکرارترین دریافت‌کنندگان اخطار' : 'Warnings by Employee'}
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
                {aggByName.map((n, idx) => (
                  <div key={idx} className="flex justify-between items-center text-slate-600 dark:text-slate-400 py-1 border-b border-slate-50 dark:border-slate-800/40">
                    <span className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[130px]">{n.label}</span>
                    <span className="font-mono bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 px-2 py-0.5 rounded font-black border border-red-200 dark:border-red-900">
                      {n.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                {isFa ? 'خطا به تفکیک واحد' : 'Warnings by Unit'}
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
                {aggByUnit.slice(0, 6).map((u, idx) => (
                  <div key={idx} className="flex justify-between items-center text-slate-600 dark:text-slate-400 py-1 border-b border-slate-50 dark:border-slate-800/40">
                    <span className="truncate max-w-[130px] text-slate-700 dark:text-slate-200 font-bold">{u.label}</span>
                    <span className="font-mono bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300 px-2 py-0.5 rounded font-black border border-violet-200 dark:border-violet-900">
                      {u.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                {isFa ? 'بر پایه دسته‌بندی' : 'Warnings by Category'}
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
                {aggByType.map((t, idx) => (
                  <div key={idx} className="flex justify-between items-center text-slate-600 dark:text-slate-400 py-1 border-b border-slate-50 dark:border-slate-800/40">
                    <span className="text-slate-700 dark:text-slate-200 font-bold">{t.label}</span>
                    <span className="font-mono bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 px-2 py-0.5 rounded font-black border border-teal-200 dark:border-teal-900">
                      {t.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                {isFa ? 'آمار سالانه اخطارها' : 'Warnings by Year'}
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
                {aggByYear.map((y, idx) => (
                  <div key={idx} className="flex justify-between items-center text-slate-600 dark:text-slate-400 py-1 border-b border-slate-50 dark:border-slate-800/40">
                    <span className="font-mono text-slate-700 dark:text-slate-200 font-bold">{y.label}</span>
                    <span className="font-mono bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded font-black border border-blue-200 dark:border-blue-900">
                      {y.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE MODAL --- */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 dark:bg-red-950/60 rounded-2xl">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h4 className="font-black text-slate-900 dark:text-slate-100 text-sm">{isFa ? 'تایید حذف اطلاعات پرونده' : 'Confirm Delete'}</h4>
            </div>

            <div className="space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-100 text-xs leading-relaxed">{deleteConfirm.title}</p>
              {deleteConfirm.description && (
                <p className="text-[11px] text-slate-500 leading-relaxed">{deleteConfirm.description}</p>
              )}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={deleteConfirm.onConfirm}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                {isFa ? 'حذف قطعی' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- OFFICIAL A5 PRINT & PDF MODAL --- */}
      {printNoticeRecord && (
        <WarningNoticePrintModal
          warning={printNoticeRecord}
          allWarnings={safeWarnings}
          currentUser={activeUser}
          onClose={() => setPrintNoticeRecord(null)}
          isFa={isFa}
        />
      )}

      {/* --- UNIFIED REFERRAL MODAL --- */}
      {referralWarning && (
        <CreateReferralModal
          documentType="WARNING"
          documentId={referralWarning.id}
          documentNumber={referralWarning.number}
          documentTitle={`اخطار انضباطی ${referralWarning.name} - ${referralWarning.reason}`}
          currentUser={activeUser}
          isFa={isFa}
          onClose={() => setReferralWarning(null)}
          onSuccess={() => {
            setReferralWarning(null);
            alert(isFa ? 'سند اخطار با موفقیت جهت بررسی، تأیید و امضا ارجاع گردید.' : 'Warning referred successfully.');
          }}
        />
      )}

      {/* --- UNIFIED WORKFLOW TRACKER MODAL --- */}
      {trackerWarning && (
        <DocumentWorkflowTrackerModal
          documentType="WARNING"
          documentId={trackerWarning.id}
          documentNumber={trackerWarning.number}
          documentTitle={`اخطار انضباطی ${trackerWarning.name} - ${trackerWarning.reason}`}
          currentUser={activeUser}
          isFa={isFa}
          onClose={() => setTrackerWarning(null)}
        />
      )}

      {/* --- EXCEL BATCH IMPORT MODAL --- */}
      <WarningsExcelImportModal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        existingRecords={safeWarnings}
        onImport={handleExcelImport}
        isFa={isFa}
        currentUser={activeUser}
      />
    </div>
  );
}
