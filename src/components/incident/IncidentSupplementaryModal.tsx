import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SafetyIncidentRecord, IncidentSupplementaryForm, UserProfile } from '../../types';
import { 
  getSupplementaryFormByIncidentId, 
  saveSupplementaryForm, 
  isUserAuthorizedToEditSupplementaryForm,
  calculateDeadlineInfo,
  getCurrentJalaliDate
} from '../../utils/incidentSupplementaryHelper';
import { 
  getComplexPersonnelList, 
  ComplexPersonnel 
} from '../../utils/personnelHelper';
import { useFinalSubmit } from '../../context/FinalSubmitContext';
import { useSystemBranding } from '../../utils/systemBrandingHelper';
import { HseLogo } from '../HseLogo';
import { printService } from '../../services/printService';
import {
  FileText,
  Printer,
  Save,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  Unlock,
  History,
  X,
  UserCheck,
  Info,
  Edit3,
  Eye,
  FileCheck,
  Search,
  Users,
  RotateCcw
} from 'lucide-react';
import PersianDatePicker from '../common/PersianDatePicker';
import { toast } from 'react-hot-toast';
import { showConfirmDialog } from '../common/ConfirmDialogModal';

interface IncidentSupplementaryModalProps {
  isFa: boolean;
  incident: SafetyIncidentRecord;
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedForm: IncidentSupplementaryForm) => void;
}

export default function IncidentSupplementaryModal({
  isFa,
  incident,
  currentUser,
  isOpen,
  onClose,
  onSaved
}: IncidentSupplementaryModalProps) {
  const { confirmFinalSubmit } = useFinalSubmit();
  const { branding } = useSystemBranding();
  // Load form from storage or auto-populate from incident
  const [formData, setFormData] = useState<IncidentSupplementaryForm>(() => {
    return getSupplementaryFormByIncidentId(incident.id, incident, currentUser);
  });

  const [activeView, setActiveView] = useState<'form' | 'pdf_preview' | 'audit_log'>('form');
  const [showSaveNotification, setShowSaveNotification] = useState<string | null>(null);

  // Personnel Search & Modal State
  const [personnelModalOpen, setPersonnelModalOpen] = useState(false);
  const [personnelTargetField, setPersonnelTargetField] = useState<'victim' | 'reporter' | 'hseExpert' | null>(null);
  const [personnelSearchQuery, setPersonnelSearchQuery] = useState('');
  const [personnelDeptFilter, setPersonnelDeptFilter] = useState('ALL');
  
  // Inline Autocomplete Suggestions State
  const [showVictimCodeSuggestions, setShowVictimCodeSuggestions] = useState(false);
  const [showVictimNameSuggestions, setShowVictimNameSuggestions] = useState(false);
  const codeDropdownRef = useRef<HTMLDivElement>(null);
  const nameDropdownRef = useRef<HTMLDivElement>(null);

  // All personnel list from settings
  const [personnelListState, setPersonnelListState] = useState<ComplexPersonnel[]>(() => getComplexPersonnelList());

  useEffect(() => {
    const refresh = () => setPersonnelListState(getComplexPersonnelList());
    refresh();
    window.addEventListener('hse_personnel_updated', refresh);
    window.addEventListener('app_data_mutated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('hse_personnel_updated', refresh);
      window.removeEventListener('app_data_mutated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [isOpen]);

  const allPersonnelList = personnelListState;

  // Departments list for personnel filter
  const departmentsList = useMemo<string[]>(() => {
    const depts = new Set<string>();
    allPersonnelList.forEach(p => {
      if (p.department) depts.add(p.department);
      if (p.unit) depts.add(p.unit);
    });
    return Array.from(depts).filter(Boolean);
  }, [allPersonnelList]);

  // Filtered personnel for modal picker
  const filteredPersonnel = useMemo(() => {
    const query = personnelSearchQuery.trim().toLowerCase();
    return allPersonnelList.filter(p => {
      const matchDept = personnelDeptFilter === 'ALL' || p.department === personnelDeptFilter || p.unit === personnelDeptFilter;
      if (!matchDept) return false;
      if (!query) return true;
      return (
        p.personnelCode?.toLowerCase().includes(query) ||
        p.effectiveCode?.toLowerCase().includes(query) ||
        p.fullName?.toLowerCase().includes(query) ||
        p.firstName?.toLowerCase().includes(query) ||
        p.lastName?.toLowerCase().includes(query) ||
        p.nationalCode?.toLowerCase().includes(query) ||
        p.jobTitle?.toLowerCase().includes(query) ||
        p.department?.toLowerCase().includes(query) ||
        p.unit?.toLowerCase().includes(query)
      );
    });
  }, [allPersonnelList, personnelSearchQuery, personnelDeptFilter]);

  // Inline suggestions for victim personnel code
  const victimCodeSuggestions = useMemo(() => {
    const q = (formData.victimPersonnelCode || '').trim().toLowerCase();
    if (!q || q.length < 1) return [];
    return allPersonnelList.filter(p => 
      p.personnelCode?.toLowerCase().includes(q) ||
      p.effectiveCode?.toLowerCase().includes(q) ||
      p.nationalCode?.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [allPersonnelList, formData.victimPersonnelCode]);

  // Inline suggestions for victim full name
  const victimNameSuggestions = useMemo(() => {
    const q = (formData.victimName || '').trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return allPersonnelList.filter(p => 
      p.fullName?.toLowerCase().includes(q) ||
      p.firstName?.toLowerCase().includes(q) ||
      p.lastName?.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [allPersonnelList, formData.victimName]);

  // Select personnel and fill relevant fields
  const handleSelectPersonnel = (person: ComplexPersonnel, target: 'victim' | 'reporter' | 'hseExpert') => {
    if (target === 'victim') {
      setFormData(prev => ({
        ...prev,
        victimPersonnelCode: person.personnelCode || person.effectiveCode || '',
        victimName: person.fullName || `${person.firstName} ${person.lastName}`.trim(),
        victimDepartment: person.department || person.unit || person.section || prev.victimDepartment,
        victimOrgUnit: prev.victimOrgUnit || person.department || person.unit || '',
        victimWorkExperience: prev.victimWorkExperience || (person.age && person.age > 22 ? `${person.age - 22} سال` : '')
      }));
      setShowVictimCodeSuggestions(false);
      setShowVictimNameSuggestions(false);
    } else if (target === 'reporter') {
      const roleStr = person.jobTitle ? ` - ${person.jobTitle}` : (person.position ? ` - ${person.position}` : '');
      setFormData(prev => ({
        ...prev,
        reporterNameAndRole: `${person.fullName}${roleStr}`
      }));
    } else if (target === 'hseExpert') {
      setFormData(prev => ({
        ...prev,
        hseExpertName: person.fullName
      }));
    }
    setPersonnelModalOpen(false);
  };

  // Reset/Clear form entirely (Requirement 3: no pre-filled values)
  const handleClearForm = async () => {
    const confirmed = await showConfirmDialog({
      title: isFa ? 'پاکسازی فیلدهای فرم' : 'Clear Form Fields',
      message: isFa ? 'آیا مطمئن هستید که می‌خواهید تمام فیلدهای این فرم را پاکسازی و خالی کنید؟' : 'Are you sure you want to clear all form fields?',
      confirmLabel: isFa ? 'پاکسازی' : 'Clear',
      cancelLabel: isFa ? 'انصراف' : 'Cancel',
      tone: 'warning',
    });
    if (confirmed) {
      setFormData({
        id: `supp-${incident.id}`,
        incidentId: incident.id,
        incidentReportNumber: incident.reportNumber || '',
        formCode: 'RHS – F34',
        revision: '00',
        formNumber: '',
        formDate: '',
        distributionList: 'توزیع نسخ: ۱- مدیریت امور مجتمع  ۲- واحد HSE  ۳- امور اداری',
        eventDateTime: '',
        eventDate: '',
        eventTime: '',
        exactLocation: '',
        reportDateTime: '',
        reportDate: '',
        reportTime: '',
        locationOccurrence: '',
        reporterNameAndRole: '',
        victimOrgUnit: '',
        activityDuringIncident: '',
        victimCount: '',
        estimatedLoss: '',
        briefDescription: '',
        riskSeverityMatrix: '',
        directCauses: '',
        indirectCauses: '',
        rootCauses: '',
        victimName: '',
        victimPersonnelCode: '',
        victimDepartment: '',
        victimWorkExperience: '',
        injuryType: '',
        injuredBodyPart: '',
        medicalTreatment: '',
        lostWorkDays: '',
        capaFormNumber: '',
        capaRequiredActions: '',
        startDate: '',
        endDate: '',
        hseExpertName: '',
        hseExpertApproved: false,
        status: 'in_progress',
        deadlineDate: '',
        daysRemaining: 10,
        isExpired: false,
        auditLogs: [
          ...(formData.auditLogs || []),
          {
            id: `audit-${Date.now()}`,
            user: currentUser?.fullName || 'کاربر سیستم',
            userCode: currentUser?.personnelNumber,
            role: currentUser?.role || 'کارشناس HSE',
            action: 'update',
            actionFa: 'پاکسازی و خالی کردن فرم جهت ثبت مجدد',
            timestamp: `${getCurrentJalaliDate()} - ${new Date().toLocaleTimeString('fa-IR')}`,
            details: 'حذف کلیه داده‌های پیش‌فرض و ایجاد فرم خام'
          }
        ],
        createdAt: formData.createdAt || `${getCurrentJalaliDate()} ${new Date().toLocaleTimeString('fa-IR')}`,
        updatedAt: `${getCurrentJalaliDate()} ${new Date().toLocaleTimeString('fa-IR')}`
      });
      setShowSaveNotification(isFa ? 'تمامی فیلدهای فرم با موفقیت پاکسازی و خالی شدند.' : 'All fields cleared.');
      setTimeout(() => setShowSaveNotification(null), 3000);
    }
  };

  // Sync if incident changes
  useEffect(() => {
    if (incident) {
      const loaded = getSupplementaryFormByIncidentId(incident.id, incident, currentUser);
      setFormData(loaded);
    }
  }, [incident, currentUser]);

  // Recalculate deadline metrics
  const deadlineInfo = useMemo(() => {
    return calculateDeadlineInfo(formData.startDate?.replace(/\./g, '/') || incident.eventDate, formData.status);
  }, [formData.startDate, incident.eventDate, formData.status]);

  const isAuthorized = useMemo(() => {
    return isUserAuthorizedToEditSupplementaryForm(currentUser, formData);
  }, [currentUser, formData]);

  const isLocked = useMemo(() => {
    // If expired and not authorized, lock the form
    if (formData.status === 'expired' || deadlineInfo.isExpired) {
      if (!isAuthorized) return true;
    }
    // If finalized/completed and not authorized, lock the form
    if (formData.status === 'completed' && !isAuthorized) {
      return true;
    }
    return false;
  }, [formData.status, deadlineInfo.isExpired, isAuthorized]);

  if (!isOpen) return null;

  const handleFieldChange = (field: keyof IncidentSupplementaryForm, value: any) => {
    if (isLocked) return;
    setFormData(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // Auto-update endDate (10 days after) when startDate changes
      if (field === 'startDate' && typeof value === 'string') {
        const cleanStart = value.replace(/\./g, '/');
        const dInfo = calculateDeadlineInfo(cleanStart);
        updated.endDate = dInfo.deadlineDate;
      }
      
      return updated;
    });
  };

  const handleSaveDraft = () => {
    const updated = saveSupplementaryForm(
      {
        ...formData,
        status: formData.status === 'completed' ? 'completed' : 'in_progress'
      },
      currentUser,
      'draft_save',
      'ذخیره موقت تغییرات توسط کاربر'
    );
    setFormData(updated);
    if (onSaved) onSaved(updated);
    setShowSaveNotification(isFa ? 'پیش‌نویس فرم تکمیلی با موفقیت ذخیره شد.' : 'Draft saved successfully.');
    setTimeout(() => setShowSaveNotification(null), 3500);
  };

  const handleFinalize = () => {
    if (!formData.briefDescription.trim()) {
      toast.error(isFa ? 'لطفاً شرح مختصر رویداد را وارد نمایید.' : 'Please enter incident description.');
      return;
    }

    confirmFinalSubmit({
      isFa,
      onConfirm: () => {
        const updated = saveSupplementaryForm(
          {
            ...formData,
            status: 'completed',
            hseExpertApproved: true
          },
          currentUser,
          'finalize',
          'تکمیل و ثبت نهایی فرم تجزیه و تحلیل رویداد (RHS-F34)'
        );
        setFormData(updated);
        if (onSaved) onSaved(updated);
        setShowSaveNotification(isFa ? 'فرم تکمیلی با موفقیت تکمیل و به پرونده حادثه پیوست شد.' : 'Supplementary form completed & attached.');
        setTimeout(() => setShowSaveNotification(null), 4000);
      }
    });
  };

  const handlePrint = () => {
    printService.printElement('rhs-f34-print-document', {
      title: `فرم گزارش و بررسی تکمیلی حادثه (RHS-F34) - پرونده ${incident.reportNumber || ''}`,
      orientation: 'portrait',
      pageSize: 'A4',
      documentCode: `RHS-F34 / ${incident.reportNumber || ''}`,
      documentDate: incident.eventDate,
      isFa: isFa,
      autoPrint: true
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Print CSS specific to RHS-F34 exact layout */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #rhs-f34-print-document, #rhs-f34-print-document * {
            visibility: visible !important;
          }
          #rhs-f34-print-document {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 210mm !important;
            margin: 0 auto !important;
            padding: 8mm 10mm !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
          }
          .no-print, .print\\:hidden {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
          }
        }
      `}</style>

      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full max-h-[94vh] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* MODAL HEADER & CONTROLS (NON-PRINT) */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600/30 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                  RHS – F34
                </span>
                <span className="text-[11px] text-rose-200 font-bold">
                  {isFa ? 'فرم تکمیلی تجزیه و تحلیل رویداد' : 'Incident Analysis Supplementary Form'}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-white mt-0.5">
                {incident.title}
                <span className="text-xs text-slate-300 font-mono mr-2">
                  ({incident.reportNumber})
                </span>
              </h2>
            </div>
          </div>

          {/* Navigation Views & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-white/10 p-1 rounded-xl flex items-center gap-1">
              <button
                onClick={() => setActiveView('form')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeView === 'form' 
                    ? 'bg-rose-600 text-white shadow-sm' 
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                {isFa ? 'تکمیل فرم' : 'Edit Form'}
              </button>

              <button
                onClick={() => setActiveView('pdf_preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeView === 'pdf_preview' 
                    ? 'bg-rose-600 text-white shadow-sm' 
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {isFa ? 'نمای سند PDF' : 'PDF Preview'}
              </button>

              <button
                onClick={() => setActiveView('audit_log')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeView === 'audit_log' 
                    ? 'bg-rose-600 text-white shadow-sm' 
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                {isFa ? 'سوابق تغییرات' : 'Audit Logs'}
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              title={isFa ? 'چاپ استاندارد A4' : 'Print A4 Form'}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isFa ? 'چاپ A4' : 'Print'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* NOTIFICATION TOAST */}
        {showSaveNotification && (
          <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shrink-0 shadow-inner animate-fade-in print:hidden">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>{showSaveNotification}</span>
            </div>
            <button onClick={() => setShowSaveNotification(null)} className="text-white/80 hover:text-white font-bold">✕</button>
          </div>
        )}

        {/* DEADLINE & EXPIRY STATUS BAR (NON-PRINT) */}
        <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 p-3 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 print:hidden">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            {/* Status Badge */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">{isFa ? 'وضعیت فرم:' : 'Status:'}</span>
              <span className={`px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm ${
                formData.status === 'completed' 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : formData.status === 'expired' || deadlineInfo.isExpired
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : formData.status === 'in_progress'
                  ? 'bg-amber-100 text-amber-900 border border-blue-300'
                  : 'bg-slate-200 text-slate-700 border border-slate-300'
              }`}>
                {formData.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                {formData.status === 'expired' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                {(formData.status === 'in_progress' || formData.status === 'not_started') && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                <span>
                  {formData.status === 'completed' ? (isFa ? 'تکمیل شده (پیوست نهایی)' : 'Completed') :
                   formData.status === 'expired' || deadlineInfo.isExpired ? (isFa ? 'مهلت تکمیل به پایان رسیده (منقضی)' : 'Expired') :
                   formData.status === 'in_progress' ? (isFa ? 'در حال تکمیل' : 'In Progress') :
                   (isFa ? 'تکمیل نشده' : 'Not Started')}
                </span>
              </span>
            </div>

            {/* 10-Day Countdown Info */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {isFa ? 'مهلت ۱۰ روزه:' : '10-Day Deadline:'}
              </span>
              <span className="font-mono text-slate-500">
                ({formData.startDate} تا {deadlineInfo.deadlineDate})
              </span>
              <span className={`font-black px-2 py-0.5 rounded-md text-[11px] ${
                formData.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 font-bold'
                  : deadlineInfo.daysRemaining > 3
                  ? 'bg-emerald-50 text-emerald-700'
                  : deadlineInfo.daysRemaining >= 0
                  ? 'bg-amber-50 text-amber-800 animate-pulse'
                  : 'bg-rose-50 text-rose-700'
              }`}>
                {formData.status === 'completed' 
                  ? (isFa ? 'تکمیل در موعد مقرر' : 'Completed')
                  : deadlineInfo.daysRemaining > 0 
                  ? (isFa ? `${deadlineInfo.daysRemaining} روز باقیمانده` : `${deadlineInfo.daysRemaining} days left`)
                  : deadlineInfo.daysRemaining === 0
                  ? (isFa ? 'امروز آخرین مهلت است' : 'Last day')
                  : (isFa ? `${Math.abs(deadlineInfo.daysRemaining)} روز تأخیر و انقضا` : 'Overdue & Expired')}
              </span>
            </div>
          </div>

          {/* Access / Lock indicator */}
          <div className="flex items-center gap-2">
            {isLocked ? (
              <div className="flex items-center gap-1.5 bg-rose-50 text-rose-800 px-3 py-1 rounded-xl border border-rose-200 text-[11px] font-bold">
                <Lock className="w-3.5 h-3.5 text-rose-600" />
                <span>{isFa ? '🔒 ویرایش قفل است (مهلت پایان یافته)' : 'Locked'}</span>
              </div>
            ) : isAuthorized && (formData.status === 'expired' || deadlineInfo.isExpired) ? (
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-xl border border-emerald-200 text-[11px] font-bold">
                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isFa ? '✓ ویرایش فعال با سطح دسترسی مجاز' : 'Admin Override Active'}</span>
              </div>
            ) : null}

            <div className="text-[11px] text-slate-400">
              {isFa ? 'کد فرم:' : 'Code:'} <strong className="font-mono text-slate-700 dark:text-slate-300">RHS – F34</strong>
            </div>
          </div>
        </div>

        {/* MODAL BODY CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60 dark:bg-slate-950/40">
          
          {/* TAB 1: FORM COMPLETION / EDIT MODE */}
          {activeView === 'form' && (
            <div className="max-w-4xl mx-auto space-y-5">
              
              {/* Form Warning Banner if Expired */}
              {(formData.status === 'expired' || deadlineInfo.isExpired) && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-blue-200 text-amber-900 flex items-start gap-3 text-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-black mb-0.5">
                      {isFa ? 'توجه: مهلت ۱۰ روزه تکمیل این فرم منقضی شده است' : 'Attention: The 10-day completion deadline has expired'}
                    </strong>
                    <p className="text-amber-800 leading-relaxed">
                      {isAuthorized 
                        ? (isFa ? 'شما با دسترسی مدیریت / کارشناسی ارشد HSE مجاز به ویرایش، تکمیل و بازنگری این فرم می‌باشید.' : 'You are authorized to edit and finalize this form.')
                        : (isFa ? 'امکان ویرایش عادی برای این فرم غیرفعال است. جهت ویرایش و ثبت با مدیر واحد HSE تماس حاصل فرمایید.' : 'Editing is disabled. Contact HSE Admin.')}
                    </p>
                  </div>
                </div>
              )}

              {/* PDF MATCHING DOCUMENT CONTAINER (Exact visual schema) */}
              <div id="rhs-f34-print-document" className="bg-white rounded-2xl p-5 sm:p-8 shadow-sm border border-slate-300 text-slate-900 font-sans space-y-4">
                
                {/* 1. DOCUMENT HEADER (Matching PDF) */}
                <div className="border-b-2 border-slate-800 pb-3 flex items-center justify-between gap-4">
                  {/* Right Logo (Only Logo, No Text) */}
                  <div className="flex items-center justify-center min-w-[70px] h-14 bg-white p-1 rounded-lg border border-slate-200 overflow-hidden">
                    {branding.logoUrl ? (
                      <img 
                        src={branding.logoUrl} 
                        alt="Logo" 
                        className="max-h-full max-w-full object-contain select-none"
                      />
                    ) : (
                      <HseLogo size="md" target="header" showShadow={false} />
                    )}
                  </div>

                  {/* Center Titles */}
                  <div className="text-center flex-1">
                    <h1 className="text-base sm:text-lg font-black text-slate-900">
                      تجزيه و تحليل رويداد
                    </h1>
                    <h2 className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5">
                      واحد بهداشت ، ايمني و محيط زيست پتروشيمي رجال
                    </h2>
                  </div>

                  {/* Left Metadata (Date & Form Number) */}
                  <div className="text-left font-mono text-xs space-y-1">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="font-bold text-slate-700">تاريخ :</span>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={formData.formDate}
                        onChange={e => handleFieldChange('formDate', e.target.value)}
                        className="w-24 text-center p-1 border border-slate-300 rounded font-mono text-xs bg-slate-50"
                      />
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <span className="font-bold text-slate-700">شماره :</span>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={formData.formNumber}
                        onChange={e => handleFieldChange('formNumber', e.target.value)}
                        className="w-32 text-center p-1 border border-slate-300 rounded font-mono text-xs bg-slate-50 font-bold text-rose-700"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. SECTION 1: EVENT & REPORT DETAILS TABLE (Matching PDF) */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-slate-400 text-xs">
                    <tbody>
                      {/* Row 1 */}
                      <tr className="border-b border-slate-400">
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold text-slate-800">
                          تاریخ و ساعت رویداد :
                        </td>
                        <td className="w-1/4 p-1.5 border-l border-slate-400">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 min-w-[110px]">
                              <PersianDatePicker
                                disabled={isLocked}
                                includeTime={false}
                                value={formData.eventDate}
                                onChange={(jStr) => handleFieldChange('eventDate', jStr)}
                                isFa={isFa}
                                inputClassName="p-1 text-xs"
                              />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] font-bold text-slate-500">ساعت:</span>
                              <input
                                type="text"
                                disabled={isLocked}
                                value={formData.eventTime || ''}
                                onChange={e => handleFieldChange('eventTime', e.target.value)}
                                placeholder="14:30"
                                dir="ltr"
                                className="w-14 p-1 text-center border border-slate-300 rounded font-mono text-xs bg-white"
                              />
                            </div>
                          </div>
                        </td>
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold text-slate-800">
                          محل دقيق رويداد :
                        </td>
                        <td className="w-1/4 p-1.5">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={formData.exactLocation}
                            onChange={e => handleFieldChange('exactLocation', e.target.value)}
                            placeholder="نام کارگاه، طبقه، موقعیت جغرافیایی..."
                            className="w-full p-1 border border-slate-200 rounded text-xs"
                          />
                        </td>
                      </tr>

                      {/* Row 2 */}
                      <tr className="border-b border-slate-400">
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold text-slate-800">
                          تاریخ و ساعت گزارش رویداد :
                        </td>
                        <td className="w-1/4 p-1.5 border-l border-slate-400">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 min-w-[110px]">
                              <PersianDatePicker
                                disabled={isLocked}
                                includeTime={false}
                                value={formData.reportDate}
                                onChange={(jStr) => handleFieldChange('reportDate', jStr)}
                                isFa={isFa}
                                inputClassName="p-1 text-xs"
                              />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] font-bold text-slate-500">ساعت:</span>
                              <input
                                type="text"
                                disabled={isLocked}
                                value={formData.reportTime || ''}
                                onChange={e => handleFieldChange('reportTime', e.target.value)}
                                placeholder="14:30"
                                dir="ltr"
                                className="w-14 p-1 text-center border border-slate-300 rounded font-mono text-xs bg-white"
                              />
                            </div>
                          </div>
                        </td>
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold text-slate-800">
                          مکان بروز :
                        </td>
                        <td className="w-1/4 p-1.5">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={formData.locationOccurrence}
                            onChange={e => handleFieldChange('locationOccurrence', e.target.value)}
                            placeholder="واحد عملیاتی / اداری..."
                            className="w-full p-1 border border-slate-200 rounded text-xs"
                          />
                        </td>
                      </tr>

                      {/* Row 3 */}
                      <tr className="border-b border-slate-400">
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold text-slate-800">
                          نام و سمت گزارش دهنده :
                        </td>
                        <td className="w-1/4 p-1.5 border-l border-slate-400">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              disabled={isLocked}
                              value={formData.reporterNameAndRole}
                              onChange={e => handleFieldChange('reporterNameAndRole', e.target.value)}
                              placeholder="نام، نام خانوادگی و سمت..."
                              className="w-full p-1 border border-slate-200 rounded text-xs font-bold"
                            />
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPersonnelTargetField('reporter');
                                  setPersonnelSearchQuery('');
                                  setPersonnelModalOpen(true);
                                }}
                                title="انتخاب از بانک پرسنل مجتمع"
                                className="p-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-300 rounded text-slate-600 transition shrink-0"
                              >
                                <Users className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold text-slate-800">
                          واحد سازمانی مصدوم :
                        </td>
                        <td className="w-1/4 p-1.5">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={formData.victimOrgUnit}
                            onChange={e => handleFieldChange('victimOrgUnit', e.target.value)}
                            placeholder="واحد سازمانی..."
                            className="w-full p-1 border border-slate-200 rounded text-xs"
                          />
                        </td>
                      </tr>

                      {/* Row 4 */}
                      <tr className="border-b border-slate-400">
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold text-slate-800">
                          فعاليت حين حادثه :
                        </td>
                        <td className="w-1/4 p-1.5 border-l border-slate-400">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={formData.activityDuringIncident}
                            onChange={e => handleFieldChange('activityDuringIncident', e.target.value)}
                            className="w-full p-1 border border-slate-200 rounded text-xs"
                          />
                        </td>
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold text-slate-800">
                          تعداد مصدومين /قربانيان :
                        </td>
                        <td className="w-1/4 p-1.5">
                          <input
                            type="number"
                            disabled={isLocked}
                            value={formData.victimCount}
                            onChange={e => handleFieldChange('victimCount', e.target.value)}
                            className="w-full p-1 border border-slate-200 rounded text-xs font-mono font-bold text-rose-700"
                          />
                        </td>
                      </tr>

                      {/* Row 5: Damage Assessment */}
                      <tr>
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold text-slate-800">
                          برآورد ميزان خسارات جاني / مالي :
                        </td>
                        <td colSpan={3} className="p-1.5">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={formData.estimatedLoss}
                            onChange={e => handleFieldChange('estimatedLoss', e.target.value)}
                            placeholder="شرح برآورد خسارت جانی، تجهیزاتی و مالی..."
                            className="w-full p-1.5 border border-slate-200 rounded text-xs"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. SECTION 2: BRIEF INCIDENT DESCRIPTION */}
                <div className="border border-slate-400 rounded p-2.5 space-y-1.5">
                  <label className="block font-black text-slate-900 text-xs">
                    ۲- شرح مختصر رويداد :
                  </label>
                  <textarea
                    rows={3}
                    disabled={isLocked}
                    value={formData.briefDescription}
                    onChange={e => handleFieldChange('briefDescription', e.target.value)}
                    placeholder="شرح کامل چگونگی وقوع حادثه و جزییات عملیاتی..."
                    className="w-full p-2 border border-slate-300 rounded text-xs leading-relaxed focus:ring-2 focus:ring-rose-500 bg-white"
                  />
                </div>

                {/* 4. SECTION 3: SEVERITY MATRIX DATA (Matching PDF 4 blocks) */}
                <div className="border border-slate-400 rounded p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-black text-slate-900 text-xs">
                      ۳- داده هاي ماتريس شدت ( شدت ريسك ) :
                    </label>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {isFa ? 'سطح منتخب با علامت * مشخص می‌گردد' : 'Selected level marked with *'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { key: 'High', labelFa: 'High (بحرانی / شدت بالا)', color: 'border-rose-300 bg-rose-50' },
                      { key: 'Medium', labelFa: 'Medium (شدت متوسط)', color: 'border-blue-300 bg-amber-50' },
                      { key: 'Low', labelFa: 'Low (شدت پایین)', color: 'border-sky-300 bg-sky-50' },
                      { key: 'Minimal', labelFa: 'Minimal (ناچیز / جزئی)', color: 'border-emerald-300 bg-emerald-50' }
                    ].map((matrix) => {
                      const isSelected = formData.riskSeverityMatrix === matrix.key;
                      return (
                        <button
                          key={matrix.key}
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleFieldChange('riskSeverityMatrix', matrix.key)}
                          className={`p-2.5 rounded-lg border-2 text-center transition flex flex-col items-center justify-center gap-1 ${
                            isSelected 
                              ? 'border-rose-600 bg-rose-50/80 font-black shadow-sm' 
                              : 'border-slate-300 hover:border-slate-400 bg-white text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center border ${isSelected ? 'border-rose-600 bg-rose-600 text-white font-bold' : 'border-slate-400'}`}>
                              {isSelected ? '✓' : ''}
                            </span>
                            <span className="font-bold">{matrix.key}</span>
                            {isSelected && <span className="text-rose-600 font-black">*</span>}
                          </div>
                          <span className="text-[10px] text-slate-500">{matrix.labelFa}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. SECTIONS 4, 5, 6: CAUSES (Direct, Indirect, Root) */}
                <div className="space-y-2">
                  <div className="border border-slate-400 rounded p-2.5 space-y-1">
                    <label className="block font-black text-slate-900 text-xs">
                      ۴- علل مستقيم :
                    </label>
                    <textarea
                      rows={2}
                      disabled={isLocked}
                      value={formData.directCauses}
                      onChange={e => handleFieldChange('directCauses', e.target.value)}
                      placeholder="علل مستقیم، اعمال ناایمن و خطاهای رخ داده در صحنه..."
                      className="w-full p-2 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>

                  <div className="border border-slate-400 rounded p-2.5 space-y-1">
                    <label className="block font-black text-slate-900 text-xs">
                      ۵- علل غيرمستقيم :
                    </label>
                    <textarea
                      rows={2}
                      disabled={isLocked}
                      value={formData.indirectCauses}
                      onChange={e => handleFieldChange('indirectCauses', e.target.value)}
                      placeholder="علل غیرمستقیم، شرایط محیطی، وضعیت نگهداری تجهیزات و..."
                      className="w-full p-2 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>

                  <div className="border border-slate-400 rounded p-2.5 space-y-1">
                    <label className="block font-black text-slate-900 text-xs">
                      ۶- علل ريشه اي :
                    </label>
                    <textarea
                      rows={2}
                      disabled={isLocked}
                      value={formData.rootCauses}
                      onChange={e => handleFieldChange('rootCauses', e.target.value)}
                      placeholder="علل ریشه‌ای سیستمی، مدیریتی، دستورالعمل‌ها و آموزش‌های دوره‌ای..."
                      className="w-full p-2 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                </div>

                {/* 6. SECTION 7: VICTIM / INJURED PERSON TABLE (With Personnel Code Search) */}
                <div className="border border-slate-400 rounded p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-black text-slate-900 text-xs">
                      ۷- اطلاعات مصدوم (قرباني) :
                    </label>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => {
                          setPersonnelTargetField('victim');
                          setPersonnelSearchQuery('');
                          setPersonnelModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>جستجو در پرسنل مجتمع</span>
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto w-full"><table className="w-full min-w-[540px] border-collapse border border-slate-400 text-xs">
                    <tbody>
                      <tr className="border-b border-slate-400">
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold">
                          نام و نام خانوادگي :
                        </td>
                        <td className="w-1/4 p-1.5 border-l border-slate-400 relative">
                          <div className="relative">
                            <input
                              type="text"
                              disabled={isLocked}
                              value={formData.victimName}
                              onChange={e => {
                                handleFieldChange('victimName', e.target.value);
                                setShowVictimNameSuggestions(true);
                              }}
                              onFocus={() => setShowVictimNameSuggestions(true)}
                              placeholder="نام و نام خانوادگی..."
                              className="w-full p-1 border border-slate-200 rounded text-xs font-bold"
                            />
                            {/* Inline name suggestions dropdown */}
                            {showVictimNameSuggestions && victimNameSuggestions.length > 0 && !isLocked && (
                              <div 
                                ref={nameDropdownRef}
                                className="absolute z-20 top-full right-0 left-0 mt-1 bg-white border border-indigo-200 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                              >
                                <div className="p-1 text-[10px] bg-indigo-50 text-indigo-700 font-bold border-b border-indigo-100 flex items-center justify-between">
                                  <span>پیشنهادها از پرسنل مجتمع:</span>
                                  <button 
                                    type="button" 
                                    onClick={() => setShowVictimNameSuggestions(false)}
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                {victimNameSuggestions.map((person) => (
                                  <div
                                    key={person.id}
                                    onClick={() => handleSelectPersonnel(person, 'victim')}
                                    className="p-1.5 hover:bg-indigo-50/80 cursor-pointer border-b border-slate-100 last:border-0 text-right transition"
                                  >
                                    <div className="font-bold text-slate-800 text-xs">{person.fullName}</div>
                                    <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                      <span className="font-mono">کد: {person.personnelCode}</span>
                                      <span>|</span>
                                      <span>{person.department || person.unit || 'بدون واحد'}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold">
                          شماره پرسنلي :
                        </td>
                        <td className="w-1/4 p-1.5 relative">
                          <div className="relative flex items-center gap-1">
                            <input
                              type="text"
                              disabled={isLocked}
                              value={formData.victimPersonnelCode}
                              onChange={e => {
                                handleFieldChange('victimPersonnelCode', e.target.value);
                                setShowVictimCodeSuggestions(true);
                              }}
                              onFocus={() => setShowVictimCodeSuggestions(true)}
                              placeholder="مثال: 94012"
                              className="w-full p-1 border border-slate-200 rounded text-xs font-mono font-bold"
                            />
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPersonnelTargetField('victim');
                                  setPersonnelSearchQuery(formData.victimPersonnelCode || '');
                                  setPersonnelModalOpen(true);
                                }}
                                title="جستجوی پرسنل مجتمع با شماره پرسنلی"
                                className="p-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-300 rounded text-slate-600 transition shrink-0"
                              >
                                <Search className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Inline personnel code suggestions */}
                            {showVictimCodeSuggestions && victimCodeSuggestions.length > 0 && !isLocked && (
                              <div 
                                ref={codeDropdownRef}
                                className="absolute z-20 top-full right-0 left-0 mt-1 bg-white border border-indigo-200 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                              >
                                <div className="p-1 text-[10px] bg-indigo-50 text-indigo-700 font-bold border-b border-indigo-100 flex items-center justify-between">
                                  <span>کدهای مشابه در پرسنل مجتمع:</span>
                                  <button 
                                    type="button" 
                                    onClick={() => setShowVictimCodeSuggestions(false)}
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                {victimCodeSuggestions.map((person) => (
                                  <div
                                    key={person.id}
                                    onClick={() => handleSelectPersonnel(person, 'victim')}
                                    className="p-1.5 hover:bg-indigo-50/80 cursor-pointer border-b border-slate-100 last:border-0 text-right transition"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono font-bold text-indigo-700 text-xs">{person.personnelCode}</span>
                                      <span className="font-bold text-slate-800 text-xs">{person.fullName}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      {person.department || person.unit || 'بدون واحد'} {person.jobTitle ? `(${person.jobTitle})` : ''}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>

                      <tr className="border-b border-slate-400">
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold">
                          واحد سازماني :
                        </td>
                        <td className="w-1/4 p-1.5 border-l border-slate-400">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={formData.victimDepartment}
                            onChange={e => handleFieldChange('victimDepartment', e.target.value)}
                            placeholder="واحد سازماني..."
                            className="w-full p-1 border border-slate-200 rounded text-xs"
                          />
                        </td>
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold">
                          سابقه كار :
                        </td>
                        <td className="w-1/4 p-1.5">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={formData.victimWorkExperience}
                            onChange={e => handleFieldChange('victimWorkExperience', e.target.value)}
                            placeholder="مثال: ۵ سال"
                            className="w-full p-1 border border-slate-200 rounded text-xs"
                          />
                        </td>
                      </tr>

                      <tr className="border-b border-slate-400">
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold">
                          نوع آسيب :
                        </td>
                        <td className="w-1/4 p-1.5 border-l border-slate-400">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={formData.injuryType}
                            onChange={e => handleFieldChange('injuryType', e.target.value)}
                            placeholder="سوختگی، بریدگی، کوفتگی..."
                            className="w-full p-1 border border-slate-200 rounded text-xs font-bold text-rose-700"
                          />
                        </td>
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold">
                          عضو آسيب ديده :
                        </td>
                        <td className="w-1/4 p-1.5">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={formData.injuredBodyPart}
                            onChange={e => handleFieldChange('injuredBodyPart', e.target.value)}
                            placeholder="دست راست، مچ، چشم..."
                            className="w-full p-1 border border-slate-200 rounded text-xs"
                          />
                        </td>
                      </tr>

                      <tr>
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold">
                          اقدام درماني :
                        </td>
                        <td className="w-1/4 p-1.5 border-l border-slate-400">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={formData.medicalTreatment}
                            onChange={e => handleFieldChange('medicalTreatment', e.target.value)}
                            placeholder="پانسمان سرپایی، اعزام به بیمارستان..."
                            className="w-full p-1 border border-slate-200 rounded text-xs"
                          />
                        </td>
                        <td className="w-1/4 p-2 bg-slate-100/70 border-l border-slate-400 font-bold">
                          تعداد روزهاي تلف شده :
                        </td>
                        <td className="w-1/4 p-1.5">
                          <input
                            type="number"
                            disabled={isLocked}
                            value={formData.lostWorkDays}
                            onChange={e => handleFieldChange('lostWorkDays', e.target.value)}
                            placeholder="۰"
                            className="w-full p-1 border border-slate-200 rounded text-xs font-mono font-bold text-rose-700"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table></div>
                </div>

                {/* 7. SECTION 8: CORRECTIVE & PREVENTIVE ACTIONS (CAPA) */}
                <div className="border border-slate-400 rounded p-2.5 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="block font-black text-slate-900 text-xs">
                      ۸- اقدام اصلاحي و پيشگيرانه مورد نياز :
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 text-xs">شماره فرم اقدام اصلاحي/ پيشگيرانه :</span>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={formData.capaFormNumber}
                        onChange={e => handleFieldChange('capaFormNumber', e.target.value)}
                        placeholder="مثال: CAPA-1403-08"
                        className="w-48 p-1 border border-slate-300 rounded font-mono text-xs bg-slate-50 font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    disabled={isLocked}
                    value={formData.capaRequiredActions}
                    onChange={e => handleFieldChange('capaRequiredActions', e.target.value)}
                    placeholder="شرح اقدامات اصلاحی و پیشگیرانه، بازه زمانی اجرا و مسئولین اقدام..."
                    className="w-full p-2 border border-slate-300 rounded text-xs bg-white"
                  />
                </div>

                {/* 8. SIGNATURE & HSE EXPERT DETAILS (Matching PDF) */}
                <div className="border border-slate-400 rounded p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 whitespace-nowrap">تاريخ شروع :</span>
                      <div className="w-36">
                        <PersianDatePicker
                          disabled={isLocked}
                          value={formData.startDate}
                          onChange={(jStr) => handleFieldChange('startDate', jStr)}
                          isFa={isFa}
                          inputClassName="p-1 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 whitespace-nowrap">تاريخ پايان :</span>
                      <div className="w-36">
                        <PersianDatePicker
                          disabled={true}
                          value={deadlineInfo.deadlineDate}
                          onChange={(jStr) => handleFieldChange('endDate', jStr)}
                          isFa={isFa}
                          inputClassName="p-1 text-xs bg-slate-100 text-slate-500 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="block font-bold text-slate-700">نام و نام خانوادگي كارشناس واحد HSE:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        disabled={isLocked}
                        value={formData.hseExpertName}
                        onChange={e => handleFieldChange('hseExpertName', e.target.value)}
                        placeholder="نام کارشناس HSE..."
                        className="w-full p-1 border border-slate-300 rounded font-bold text-xs bg-slate-50"
                      />
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => {
                            setPersonnelTargetField('hseExpert');
                            setPersonnelSearchQuery('');
                            setPersonnelModalOpen(true);
                          }}
                          title="انتخاب کارشناس از بانک پرسنل"
                          className="p-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-300 rounded text-slate-600 transition shrink-0"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stamp & E-Signature Box */}
                  <div className="p-2 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-center flex flex-col items-center justify-center min-h-[60px]">
                    <span className="text-[10px] text-slate-500 font-bold mb-1">امضا و تأیید کارشناس واحد HSE</span>
                    <div className="font-serif italic font-bold text-indigo-900 text-sm flex items-center gap-1">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span>{formData.hseExpertName || 'کارشناس HSE'}</span>
                    </div>
                    <span className="text-[9px] text-emerald-600 font-mono">
                      {formData.completedAt ? `تأیید سیستمی: ${formData.completedAt}` : 'تأیید الکترونیکی HSE'}
                    </span>
                  </div>
                </div>

                {/* 9. FOOTER (Matching PDF exactly) */}
                <div className="pt-3 border-t border-slate-400 flex flex-wrap items-center justify-between text-[11px] font-bold text-slate-700 gap-2">
                  <div>
                    <span>کد فرم: </span>
                    <strong className="font-mono text-slate-900">RHS – F34</strong>
                  </div>
                  <div>
                    <span>بازنگري: </span>
                    <strong className="font-mono text-slate-900">00</strong>
                  </div>
                  <div>
                    <span>توزيع نسخ: ۱- مديريت امور مجتمع ۲- واحد HSE ۳- امور اداري</span>
                  </div>
                </div>

              </div>

              {/* FORM ACTION CONTROLS */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
                <div className="flex items-center gap-2">
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={handleClearForm}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
                      title="پاکسازی تمام فیلدها و ساخت فرم خام بدون پیش‌فرض"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isFa ? 'پاکسازی فیلدها (فرم خام)' : 'Clear Form'}</span>
                    </button>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Info className="w-4 h-4 text-slate-400" />
                    <span>
                      {formData.status === 'completed' 
                        ? (isFa ? '✓ فرم نهایی شده و در پرونده حادثه ثبت گردیده است.' : 'Form finalized.') 
                        : (isFa ? 'می‌توانید فرم را ذخیره موقت کرده یا پس از تکمیل، ثبت نهایی نمایید.' : 'Save draft or submit final.')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                  >
                    {isFa ? 'بستن' : 'Close'}
                  </button>

                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={handleSaveDraft}
                    className={`px-4 py-2 font-bold text-xs rounded-xl flex items-center gap-1.5 transition ${
                      isLocked 
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md'
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isFa ? 'ذخیره موقت' : 'Save Draft'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={handleFinalize}
                    className={`px-5 py-2 font-black text-xs rounded-xl flex items-center gap-1.5 transition shadow-lg ${
                      isLocked
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isFa ? 'تکمیل و ثبت نهایی فرم' : 'Finalize & Attach'}</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: PDF PREVIEW VIEW */}
          {activeView === 'pdf_preview' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-indigo-900 print:hidden">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <span>{isFa ? 'پیش‌نمایش خروجی سند رسمی استاندارد (A4 Portrait) جهت چاپ یا صدور PDF' : 'Print / Export Ready Document View'}</span>
                </div>
                <button
                  onClick={handlePrint}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isFa ? 'چاپ یا دریافت PDF' : 'Print / Export PDF'}</span>
                </button>
              </div>

              {/* READONLY PERFECT REPLICA */}
              <div className="bg-white rounded-2xl p-6 sm:p-10 shadow-lg border border-slate-300 text-slate-900 font-sans space-y-4">
                {/* Header */}
                <div className="border-b-2 border-slate-800 pb-3 flex items-center justify-between gap-4">
                  {/* Right Logo (Only Logo, No Text) */}
                  <div className="flex items-center justify-center min-w-[70px] h-14 bg-white p-1 rounded-lg border border-slate-200 overflow-hidden">
                    {branding.logoUrl ? (
                      <img 
                        src={branding.logoUrl} 
                        alt="Logo" 
                        className="max-h-full max-w-full object-contain select-none"
                      />
                    ) : (
                      <HseLogo size="md" target="header" showShadow={false} />
                    )}
                  </div>

                  <div className="text-center flex-1">
                    <h1 className="text-lg font-black text-slate-900">تجزيه و تحليل رويداد</h1>
                    <h2 className="text-xs font-bold text-slate-700 mt-0.5">واحد بهداشت ، ايمني و محيط زيست پتروشيمي رجال</h2>
                  </div>

                  <div className="text-left font-mono text-xs space-y-1">
                    <div><span className="font-bold text-slate-700">تاريخ : </span><strong>{formData.formDate}</strong></div>
                    <div><span className="font-bold text-slate-700">شماره : </span><strong className="text-rose-700">{formData.formNumber}</strong></div>
                  </div>
                </div>

                {/* Table 1 */}
                <div className="overflow-x-auto w-full"><table className="w-full border-collapse border border-slate-400 text-xs">
                  <tbody>
                    <tr className="border-b border-slate-400">
                      <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">تاریخ و ساعت رویداد :</td>
                      <td className="w-1/4 p-2 border-l border-slate-400 font-mono">
                        {formData.eventDate || formData.eventDateTime || '-'} {formData.eventTime ? `ساعت ${formData.eventTime}` : ''}
                      </td>
                      <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">محل دقيق رويداد :</td>
                      <td className="w-1/4 p-2">{formData.exactLocation}</td>
                    </tr>
                    <tr className="border-b border-slate-400">
                      <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">تاریخ و ساعت گزارش رویداد :</td>
                      <td className="w-1/4 p-2 border-l border-slate-400 font-mono">
                        {formData.reportDate || formData.reportDateTime || '-'} {formData.reportTime ? `ساعت ${formData.reportTime}` : ''}
                      </td>
                      <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">مکان بروز :</td>
                      <td className="w-1/4 p-2">{formData.locationOccurrence}</td>
                    </tr>
                    <tr className="border-b border-slate-400">
                      <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">نام و سمت گزارش دهنده :</td>
                      <td className="w-1/4 p-2 border-l border-slate-400 font-bold">{formData.reporterNameAndRole}</td>
                      <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">واحد سازمانی مصدوم :</td>
                      <td className="w-1/4 p-2">{formData.victimOrgUnit}</td>
                    </tr>
                    <tr className="border-b border-slate-400">
                      <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">فعاليت حين حادثه :</td>
                      <td className="w-1/4 p-2 border-l border-slate-400">{formData.activityDuringIncident}</td>
                      <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">تعداد مصدومين /قربانيان :</td>
                      <td className="w-1/4 p-2 font-mono font-bold">{formData.victimCount}</td>
                    </tr>
                    <tr>
                      <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">برآورد ميزان خسارات جاني / مالي :</td>
                      <td colSpan={3} className="p-2">{formData.estimatedLoss || '-'}</td>
                    </tr>
                  </tbody>
                </table></div>

                {/* Section 2 */}
                <div className="border border-slate-400 rounded p-2.5 space-y-1">
                  <div className="font-black text-xs">۲- شرح مختصر رويداد :</div>
                  <p className="text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">{formData.briefDescription}</p>
                </div>

                {/* Section 3 */}
                <div className="border border-slate-400 rounded p-2.5 space-y-1.5">
                  <div className="font-black text-xs">۳- داده هاي ماتريس شدت ( شدت ريسك ):</div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    {['High', 'Medium', 'Low', 'Minimal'].map(sev => (
                      <div key={sev} className={`p-2 rounded border ${formData.riskSeverityMatrix === sev ? 'border-slate-900 bg-slate-100 font-black' : 'border-slate-300'}`}>
                        {sev} {formData.riskSeverityMatrix === sev ? '*' : ''}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sections 4, 5, 6 */}
                <div className="border border-slate-400 rounded p-2.5 space-y-1">
                  <div className="font-black text-xs">۴- علل مستقيم :</div>
                  <p className="text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">{formData.directCauses || '-'}</p>
                </div>

                <div className="border border-slate-400 rounded p-2.5 space-y-1">
                  <div className="font-black text-xs">۵- علل غيرمستقيم :</div>
                  <p className="text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">{formData.indirectCauses || '-'}</p>
                </div>

                <div className="border border-slate-400 rounded p-2.5 space-y-1">
                  <div className="font-black text-xs">۶- علل ريشه اي :</div>
                  <p className="text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">{formData.rootCauses || '-'}</p>
                </div>

                {/* Section 7 */}
                <div className="border border-slate-400 rounded p-2.5 space-y-1">
                  <div className="font-black text-xs">۷- اطلاعات مصدوم (قرباني) :</div>
                  <div className="overflow-x-auto w-full"><table className="w-full border-collapse border border-slate-400 text-xs">
                    <tbody>
                      <tr className="border-b border-slate-400">
                        <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">نام و نام خانوادگي :</td>
                        <td className="w-1/4 p-2 border-l border-slate-400 font-bold">{formData.victimName}</td>
                        <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">شماره پرسنلي :</td>
                        <td className="w-1/4 p-2 font-mono">{formData.victimPersonnelCode}</td>
                      </tr>
                      <tr className="border-b border-slate-400">
                        <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">واحد سازماني :</td>
                        <td className="w-1/4 p-2 border-l border-slate-400">{formData.victimDepartment}</td>
                        <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">سابقه كار :</td>
                        <td className="w-1/4 p-2">{formData.victimWorkExperience}</td>
                      </tr>
                      <tr className="border-b border-slate-400">
                        <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">نوع آسيب :</td>
                        <td className="w-1/4 p-2 border-l border-slate-400 font-bold text-rose-700">{formData.injuryType}</td>
                        <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">عضو آسيب ديده :</td>
                        <td className="w-1/4 p-2">{formData.injuredBodyPart}</td>
                      </tr>
                      <tr>
                        <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">اقدام درماني :</td>
                        <td className="w-1/4 p-2 border-l border-slate-400">{formData.medicalTreatment}</td>
                        <td className="w-1/4 p-2 bg-slate-100 border-l border-slate-400 font-bold">تعداد روزهاي تلف شده :</td>
                        <td className="w-1/4 p-2 font-mono font-bold">{formData.lostWorkDays}</td>
                      </tr>
                    </tbody>
                  </table></div>
                </div>

                {/* Section 8 */}
                <div className="border border-slate-400 rounded p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <strong className="font-black">۸- اقدام اصلاحي و پيشگيرانه مورد نياز :</strong>
                    <div><span className="font-bold">شماره فرم اقدام اصلاحي/ پيشگيرانه : </span><span className="font-mono font-bold">{formData.capaFormNumber}</span></div>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">{formData.capaRequiredActions || '-'}</p>
                </div>

                {/* Signatures */}
                <div className="border border-slate-400 rounded p-3 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div><span className="font-bold">تاريخ شروع : </span><span className="font-mono">{formData.startDate}</span></div>
                    <div><span className="font-bold">تاريخ پايان : </span><span className="font-mono">{deadlineInfo.deadlineDate}</span></div>
                  </div>

                  <div>
                    <span className="font-bold">نام و نام خانوادگي كارشناس واحد HSE : </span>
                    <strong>{formData.hseExpertName}</strong>
                  </div>

                  <div className="text-center font-serif italic text-indigo-900 font-bold text-sm">
                    {formData.hseExpertName} (تأیید الکترونیک)
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-2 border-t border-slate-400 flex items-center justify-between text-[10px] text-slate-600 font-bold">
                  <div>کد فرم : <span className="font-mono">RHS – F34</span></div>
                  <div>بازنگري : <span className="font-mono">00</span></div>
                  <div>توزيع نسخ: ۱- مديريت امور مجتمع ۲- واحد HSE ۳- امور اداري</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT LOGS VIEW */}
          {activeView === 'audit_log' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="font-black text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-600" />
                    {isFa ? 'سوابق ثبت، ویرایش و تغییرات فرم تکمیلی (Audit Trail)' : 'Supplementary Form Audit Trail'}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono font-bold">
                    {formData.auditLogs?.length || 0} {isFa ? 'رویداد ثبت‌شده' : 'Events'}
                  </span>
                </div>

                <div className="space-y-3">
                  {formData.auditLogs && formData.auditLogs.length > 0 ? (
                    formData.auditLogs.map((log, idx) => (
                      <div key={log.id || idx} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                            <strong className="text-slate-900 dark:text-slate-100 font-bold">{log.actionFa}</strong>
                            <span className="text-[10px] text-slate-500 bg-slate-200/70 dark:bg-slate-700 px-2 py-0.5 rounded font-medium">
                              {log.role}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-500">
                            {log.timestamp}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                          <span>کاربر ثبت‌کننده: <strong className="text-slate-800 dark:text-slate-200">{log.user}</strong> {log.userCode ? `(کد: ${log.userCode})` : ''}</span>
                          {log.details && (
                            <span className="text-slate-400 text-[11px]">{log.details}</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-6 text-slate-400 text-xs font-bold">
                      {isFa ? 'هیچ رکوردی در تاریخچه ثبت نشده است.' : 'No audit records.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* COMPLEX PERSONNEL SEARCH & SELECTION MODAL */}
      {personnelModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" dir={isFa ? 'rtl' : 'ltr'}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                    {personnelTargetField === 'victim' && (isFa ? 'جستجو و انتخاب مصدوم از پرسنل مجتمع' : 'Select Victim Personnel')}
                    {personnelTargetField === 'reporter' && (isFa ? 'جستجو و انتخاب گزارش‌دهنده از پرسنل مجتمع' : 'Select Reporter')}
                    {personnelTargetField === 'hseExpert' && (isFa ? 'جستجو و انتخاب کارشناس واحد HSE' : 'Select HSE Expert')}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFa ? 'جستجو بر اساس شماره پرسنلی، نام، کدملی یا واحد سازمانی تعریف شده در تنظیمات' : 'Search by code, name, national ID or department'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPersonnelModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-3.5 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-2.5">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={personnelSearchQuery}
                  onChange={e => setPersonnelSearchQuery(e.target.value)}
                  placeholder={isFa ? 'جستجوی شماره پرسنلی، نام و نام خانوادگی، کدملی...' : 'Search by code or name...'}
                  className="w-full pr-9 pl-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>

              {departmentsList.length > 0 && (
                <div className="w-full sm:w-48 shrink-0">
                  <select
                    value={personnelDeptFilter}
                    onChange={e => setPersonnelDeptFilter(e.target.value)}
                    className="w-full py-2 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300"
                  >
                    <option value="ALL">{isFa ? 'همه واحدها' : 'All Departments'}</option>
                    {departmentsList.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Personnel List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPersonnel.length > 0 ? (
                filteredPersonnel.map((person) => (
                  <div
                    key={person.id}
                    onClick={() => personnelTargetField && handleSelectPersonnel(person, personnelTargetField)}
                    className="pt-2 first:pt-0 p-2.5 rounded-xl hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 cursor-pointer flex items-center justify-between gap-3 transition group border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/60 text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 transition overflow-hidden">
                        {person.profilePhoto ? (
                          <img src={person.profilePhoto} alt={person.fullName} className="w-full h-full object-cover" />
                        ) : (
                          person.fullName ? person.fullName.charAt(0) : 'P'
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 transition">
                            {person.fullName}
                          </span>
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                            کد پرسنلی: {person.personnelCode || person.effectiveCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                          <span>{person.jobTitle || person.position || 'پرسنل مجتمع'}</span>
                          {person.department && (
                            <>
                              <span>•</span>
                              <span>{person.department}</span>
                            </>
                          )}
                          {person.unit && (
                            <>
                              <span>•</span>
                              <span>واحد {person.unit}</span>
                            </>
                          )}
                          {person.nationalCode && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[10px]">کدملی: {person.nationalCode}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 bg-indigo-600 group-hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1 shadow-sm"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isFa ? 'انتخاب' : 'Select'}</span>
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 space-y-2">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-bold">
                    {isFa ? 'هیچ پرسنلی با این مشخصات یافت نشد.' : 'No personnel found.'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {isFa ? 'می‌توانید اطلاعات پرسنل را در بخش «تنظیمات سامانه > مدیریت پرسنل» ثبت و بروزرسانی فرمایید.' : 'You can add personnel in System Settings.'}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
              <span>{filteredPersonnel.length} {isFa ? 'نفر از کل پرسنل مجتمع' : 'personnel found'}</span>
              <button
                type="button"
                onClick={() => setPersonnelModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
