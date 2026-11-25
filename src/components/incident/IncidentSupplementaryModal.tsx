import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck,
  FileSpreadsheet,
  History,
  Lock,
  Paperclip,
  Printer,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  IncidentSupplementaryForm,
  RhsF68AttachmentItem,
  SafetyIncidentRecord,
  UserProfile,
} from '../../types';
import {
  calculateDeadlineInfo,
  getCurrentJalaliDate,
  getSupplementaryFormByIncidentId,
  isUserAuthorizedToEditSupplementaryForm,
  isUserHseHeadForRhsF34,
} from '../../utils/incidentSupplementaryHelper';
import { toPersianDigits } from '../../utils/jalaliDate';
import { apiDb } from '../../services/apiDatabaseClient';
import { printService } from '../../services/printService';
import { useSystemBranding } from '../../utils/systemBrandingHelper';
import PersianDatePicker from '../common/PersianDatePicker';
import CentralPersonnelSelector from '../CentralPersonnelSelector';
import { DigitalSignaturePad } from '../referral/DigitalSignaturePad';
import { RhsF68EvidencePanel } from './RhsF68EvidencePanel';

interface IncidentSupplementaryModalProps {
  isFa: boolean;
  incident: SafetyIncidentRecord;
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedForm: IncidentSupplementaryForm, updatedIncident?: SafetyIncidentRecord) => void;
}

const SEVERITY_OPTIONS: Array<{
  value: 'High' | 'Medium' | 'Low' | 'Minimal';
  labelFa: string;
  descFa: string;
  activeClass: string;
}> = [
  {
    value: 'High',
    labelFa: 'شدید (High)',
    descFa: 'فوت، نقص عضو دائم یا خسارت عمده فرآیندی',
    activeClass: 'border-rose-600 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200',
  },
  {
    value: 'Medium',
    labelFa: 'متوسط (Medium)',
    descFa: 'آسیب با روزهای تلف‌شده یا خسارت قابل توجه',
    activeClass: 'border-amber-600 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  },
  {
    value: 'Low',
    labelFa: 'کم (Low)',
    descFa: 'کمک‌های اولیه یا خسارت محدود تجهیزاتی',
    activeClass: 'border-sky-600 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
  },
  {
    value: 'Minimal',
    labelFa: 'ناچیز (Minimal)',
    descFa: 'اثر جزئی بدون توقف یا آسیب جدی',
    activeClass: 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
  },
];

function RegalPetrochemicalLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', direction: 'ltr' }}>
      <svg width="34" height="34" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M20 4C11.16 4 4 11.16 4 20c0 5.45 2.73 10.26 6.9 13.15L14.5 28C11.78 26.15 10 23.27 10 20c0-5.52 4.48-10 10-10 4.47 0 8.25 2.94 9.53 7h6.16C34.33 9.56 27.82 4 20 4z"
          fill="#1f2937"
        />
        <path
          d="M17 15h8.2c2.8 0 4.8 1.7 4.8 4.2 0 1.9-1.1 3.3-2.9 3.9l3.6 5.9h-4.3l-3.1-5.2h-2.5V29H17V15zm3.8 5.9h3.9c1.1 0 1.8-.6 1.8-1.6s-.7-1.6-1.8-1.6h-3.9v3.2z"
          fill="#0f172a"
        />
      </svg>
      <div style={{ lineHeight: 1.05, textAlign: 'left' }}>
        <div style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.06em', color: '#334155' }}>
          PETROCHEMICAL
        </div>
        <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', fontFamily: 'Georgia, serif' }}>
          Regal
        </div>
      </div>
    </div>
  );
}

export default function IncidentSupplementaryModal({
  isFa,
  incident,
  currentUser,
  isOpen,
  onClose,
  onSaved,
}: IncidentSupplementaryModalProps) {
  const { branding } = useSystemBranding();

  const [formData, setFormData] = useState<IncidentSupplementaryForm>(() =>
    getSupplementaryFormByIncidentId(incident.id, incident, currentUser)
  );
  const [activeTab, setActiveTab] = useState<'form' | 'evidence' | 'nc' | 'print' | 'audit'>('form');
  const [saving, setSaving] = useState(false);

  // HSE Head review state
  const [reviewNotes, setReviewNotes] = useState('');
  const [headSignature, setHeadSignature] = useState('');

  // Linked Non-Conformity editable state
  const [ncOwnerCode, setNcOwnerCode] = useState('');
  const [ncOwnerName, setNcOwnerName] = useState('');
  const [ncDueDate, setNcDueDate] = useState('');
  const [ncCorrectiveAction, setNcCorrectiveAction] = useState('');
  const [ncStatus, setNcStatus] = useState('REGISTERED');
  const [savingNc, setSavingNc] = useState(false);

  useEffect(() => {
    if (!isOpen || !incident) return;
    const loaded = getSupplementaryFormByIncidentId(incident.id, incident, currentUser);
    setFormData(loaded);
    setReviewNotes(loaded.hseHeadReviewNotes || '');
    setHeadSignature(loaded.hseHeadSignature || '');
    setNcOwnerCode(loaded.nonConformanceAssignedTo || loaded.assignedExpertCode || '');
    setNcOwnerName(loaded.nonConformanceAssignedToName || loaded.assignedExpertName || '');
    setNcDueDate(loaded.nonConformanceDueDate || '');
    setNcCorrectiveAction(loaded.nonConformanceCorrectiveAction || '');
    setNcStatus(loaded.nonConformanceStatus || 'REGISTERED');
  }, [isOpen, incident, currentUser]);

  if (!isOpen) return null;

  const isHseHead = isUserHseHeadForRhsF34(currentUser);
  const canEditBase = isUserAuthorizedToEditSupplementaryForm(currentUser, formData);
  const isCompleted = formData.status === 'completed' || formData.workflowStage === 'COMPLETED';
  const isPendingApproval = formData.workflowStage === 'PENDING_APPROVAL' || formData.status === 'pending_approval';
  const isReturned = formData.workflowStage === 'RETURNED' || formData.status === 'returned';
  const isReadOnly = isCompleted || (!canEditBase && !isHseHead);

  const anchorDate =
    formData.f28FinalApprovedDate ||
    formData.startDate ||
    incident.rhsF28?.hseCenterHeadSignedDate ||
    incident.reportDate ||
    getCurrentJalaliDate();
  const deadlineInfo = calculateDeadlineInfo(anchorDate, formData.status);
  const isOverdue = !isCompleted && (formData.isExpired || deadlineInfo.isExpired);
  const isNearDeadline = !isCompleted && !isOverdue && (formData.isNearDeadline || deadlineInfo.isNearDeadline);

  const fmt = (val?: string | number | null) => {
    if (val === undefined || val === null || String(val).trim() === '') return '—';
    return isFa ? toPersianDigits(String(val)) : String(val);
  };

  const setField = <K extends keyof IncidentSupplementaryForm>(key: K, value: IncidentSupplementaryForm[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveToServer = async (options?: {
    submitForApproval?: boolean;
    actionType?: 'draft_save' | 'update' | 'assign';
    overrideForm?: Partial<IncidentSupplementaryForm>;
  }) => {
    const payloadForm: IncidentSupplementaryForm = {
      ...formData,
      ...(options?.overrideForm || {}),
    };

    if (options?.submitForApproval) {
      if (!payloadForm.briefDescription?.trim()) {
        toast.error('تکمیل بخش «۲- شرح مختصر رویداد» پیش از ارسال جهت تأیید الزامی است.');
        return;
      }
      if (!payloadForm.riskSeverityMatrix) {
        toast.error('انتخاب سطح شدت ریسک در «۳- داده‌های ماتریس شدت» الزامی است.');
        return;
      }
      if (!payloadForm.directCauses?.trim() && !payloadForm.rootCauses?.trim()) {
        toast.error('ثبت حداقل «علل مستقیم» یا «علل ریشه‌ای» پیش از ارسال جهت تأیید الزامی است.');
        return;
      }
    }

    setSaving(true);
    try {
      const updatedIncident = await apiDb.saveIncidentRhsF34(incident.reportNumber || incident.id, {
        form: payloadForm,
        submitForApproval: Boolean(options?.submitForApproval),
        actionType: options?.actionType || 'update',
      });
      const updatedForm: IncidentSupplementaryForm =
        updatedIncident?.supplementaryForm || payloadForm;
      setFormData(updatedForm);
      onSaved?.(updatedForm, updatedIncident);
      toast.success(
        options?.submitForApproval
          ? 'پرونده تجزیه و تحلیل حادثه (RHS-F34) با موفقیت تکمیل و جهت تأیید نهایی به رئیس HSE ارسال شد.'
          : 'اطلاعات فرم تجزیه و تحلیل حادثه (RHS-F34) در پایگاه داده ذخیره شد.'
      );
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ذخیره فرم تجزیه و تحلیل حادثه (RHS-F34)');
    } finally {
      setSaving(false);
    }
  };

  const handleAttachmentsChange = async (nextAttachments: RhsF68AttachmentItem[]) => {
    setFormData((prev) => ({ ...prev, attachments: nextAttachments }));
    await handleSaveToServer({
      actionType: 'update',
      overrideForm: { attachments: nextAttachments },
    });
  };

  const handleHeadReview = async (decision: 'APPROVE' | 'RETURN') => {
    if (decision === 'RETURN' && !reviewNotes.trim()) {
      toast.error('در صورت عودت پرونده جهت اصلاح، درج علت و نکات اصلاحی الزامی است.');
      return;
    }

    setSaving(true);
    try {
      const updatedIncident = await apiDb.reviewIncidentRhsF34(incident.reportNumber || incident.id, {
        decision,
        reviewNotes: reviewNotes.trim(),
        reviewerName: currentUser.fullName || currentUser.username,
        reviewerCode: currentUser.personnelNumber || '',
        signature: headSignature,
      });
      const updatedForm: IncidentSupplementaryForm =
        updatedIncident?.supplementaryForm || formData;
      setFormData(updatedForm);
      onSaved?.(updatedForm, updatedIncident);
      toast.success(
        decision === 'APPROVE'
          ? 'تجزیه و تحلیل حادثه (RHS-F34) توسط رئیس HSE تأیید نهایی و مختومه شد.'
          : 'پرونده بدون حذف سوابق قبلی جهت اصلاح به کارشناس HSE عودت داده شد.'
      );
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت نتیجه بررسی رئیس HSE');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateNonConformance = async () => {
    setSavingNc(true);
    try {
      const res = await apiDb.updateIncidentRhsF34NonConformance(incident.reportNumber || incident.id, {
        assignedTo: ncOwnerCode,
        assignedToName: ncOwnerName,
        dueDate: ncDueDate,
        correctiveAction: ncCorrectiveAction,
        status: ncStatus,
      });
      const updatedIncident = res?.incident;
      const updatedForm: IncidentSupplementaryForm =
        updatedIncident?.supplementaryForm || formData;
      setFormData(updatedForm);
      onSaved?.(updatedForm, updatedIncident);
      toast.success('اطلاعات عدم انطباق تأخیر تحلیل حادثه با موفقیت بروزرسانی شد.');
    } catch (err: any) {
      toast.error(err?.message || 'خطا در بروزرسانی عدم انطباق مرتبط');
    } finally {
      setSavingNc(false);
    }
  };

  const handlePrintA4 = () => {
    const triggerPrint = () => {
      printService.printElement('rhs-f34-a4-print-root', {
        title: `تجزیه و تحلیل رویداد RHS-F34 - ${formData.formNumber || incident.reportNumber}`,
      });
    };
    if (activeTab !== 'print') {
      setActiveTab('print');
      setTimeout(triggerPrint, 220);
    } else {
      triggerPrint();
    }
  };

  const workflowStatusLabel = isCompleted
    ? 'تکمیل و تأیید نهایی شده'
    : isPendingApproval
    ? 'در انتظار تأیید نهایی رئیس HSE'
    : isReturned
    ? 'عودت شده جهت اصلاح'
    : isOverdue
    ? `دارای تأخیر (${fmt(Math.abs(deadlineInfo.daysRemaining))} روز پس از مهلت)`
    : 'در انتظار تکمیل / تأیید تحلیل';

  const auditLogs = Array.isArray(formData.auditLogs) ? [...formData.auditLogs].reverse() : [];
  const attachments = Array.isArray(formData.attachments) ? formData.attachments : [];

  const renderMatrixMark = (target: 'High' | 'Medium' | 'Low' | 'Minimal') => {
    if (formData.riskSeverityMatrix === target) {
      return <span style={{ fontSize: '18px', fontWeight: 900, lineHeight: 1 }}>✽</span>;
    }
    return <span style={{ fontSize: '11px', color: '#444' }}>·</span>;
  };

  const formatPrintDate = (d?: string) => {
    const clean = String(d || '').trim().replace(/\//g, '.');
    return clean ? toPersianDigits(clean) : '';
  };

  return createPortal(
    <div className="fixed inset-0 z-[99998] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div
        dir={isFa ? 'rtl' : 'ltr'}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-6xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {/* Top Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-300">
                <span className="font-mono font-black text-indigo-300">RHS – F34 (Rev 00)</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-white font-bold">
                  {formData.formNumber || 'RGC-HSE'}
                </span>
                <span aria-hidden="true">·</span>
                <span>متصل به حادثه {incident.reportNumber}</span>
                <span aria-hidden="true">·</span>
                <span
                  className={`font-black ${
                    isCompleted
                      ? 'text-emerald-300'
                      : isOverdue
                      ? 'text-rose-300'
                      : isNearDeadline
                      ? 'text-amber-300'
                      : 'text-sky-300'
                  }`}
                >
                  {workflowStatusLabel}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-white mt-1 truncate">
                تجزیه و تحلیل حادثه / رویداد — واحد HSE پتروشیمی رجال
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handlePrintA4}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>چاپ رسمی A4 / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Legal 10-Day SLA Bar */}
        <div
          className={`px-5 py-2.5 border-b text-xs flex flex-wrap items-center justify-between gap-3 shrink-0 ${
            isCompleted
              ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200'
              : isOverdue
              ? 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200'
              : isNearDeadline
              ? 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200'
              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-black">
              {isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : isOverdue ? (
                <ShieldAlert className="w-4 h-4 text-rose-600" />
              ) : (
                <Clock className="w-4 h-4 text-indigo-600" />
              )}
              <span>مهلت قانونی ۱۰ روز تقویمی:</span>
            </span>
            <span>
              شروع (تأیید نهایی RHS-F28):{' '}
              <strong className="font-mono tabular-nums">{fmt(anchorDate)}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              پایان مهلت:{' '}
              <strong className="font-mono tabular-nums">
                {fmt(formData.deadlineDate || deadlineInfo.deadlineDate)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-black">
              {isCompleted
                ? `تکمیل در ${fmt(formData.completedAt)}`
                : isOverdue
                ? `عبور از مهلت (${fmt(Math.abs(deadlineInfo.daysRemaining))} روز تأخیر)`
                : `${fmt(deadlineInfo.daysRemaining)} روز باقی‌مانده`}
            </span>
          </div>

          {formData.nonConformanceTrackingCode && (
            <button
              type="button"
              onClick={() => setActiveTab('nc')}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black inline-flex items-center gap-1.5 cursor-pointer transition"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>عدم انطباق خودکار: {formData.nonConformanceTrackingCode}</span>
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {[
            { id: 'form' as const, label: 'فرم تجزیه و تحلیل (RHS-F34)', icon: FileCheck },
            { id: 'evidence' as const, label: `مستندات و پیوست‌ها (${fmt(attachments.length)})`, icon: Paperclip },
            {
              id: 'nc' as const,
              label: formData.nonConformanceTrackingCode
                ? `عدم انطباق تأخیر (${formData.nonConformanceTrackingCode})`
                : 'کنترل عدم انطباق تأخیر',
              icon: ShieldAlert,
            },
            { id: 'print' as const, label: 'پیش‌نمایش رسمی A4 / PDF', icon: Printer },
            { id: 'audit' as const, label: `سوابق و رهگیری (${fmt(auditLogs.length)})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-xs font-black inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition ${
                  active
                    ? 'bg-slate-900 dark:bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* TAB 1: FORM & APPROVAL WORKFLOW */}
          {activeTab === 'form' && (
            <div className="space-y-5">
              {/* Return banner if returned */}
              {isReturned && formData.hseHeadReviewNotes && (
                <div className="p-4 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 space-y-1">
                  <div className="font-black flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4" />
                    <span>عودت شده جهت اصلاح توسط {formData.hseHeadReviewerName || 'رئیس HSE'}:</span>
                  </div>
                  <p className="leading-relaxed">{formData.hseHeadReviewNotes}</p>
                </div>
              )}

              {/* Assignment & Form Number Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">شماره فرم تحلیل</label>
                  <input
                    type="text"
                    disabled={isReadOnly}
                    value={formData.formNumber}
                    onChange={(e) => setField('formNumber', e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">تاریخ فرم</label>
                  <PersianDatePicker
                    value={formData.formDate.replace(/\./g, '/')}
                    onChange={(v) => setField('formDate', v.replace(/\//g, '.'))}
                    disabled={isReadOnly}
                    className="w-full"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    کارشناس مسئول پیگیری و تجزیه و تحلیل HSE
                  </label>
                  <CentralPersonnelSelector
                    isFa={isFa}
                    value={formData.assignedExpertName || formData.hseExpertName}
                    disabled={isReadOnly}
                    placeholder="انتخاب کارشناس HSE از فهرست پرسنل..."
                    onSelect={(person) => {
                      if (!person) {
                        setFormData((prev) => ({
                          ...prev,
                          assignedExpertName: '',
                          assignedExpertCode: '',
                        }));
                        return;
                      }
                      setFormData((prev) => ({
                        ...prev,
                        assignedExpertName: person.fullName || '',
                        assignedExpertCode: person.personnelCode || person.effectiveCode || '',
                        hseExpertName: person.fullName || prev.hseExpertName,
                        hseExpertPersonnelCode: person.personnelCode || person.effectiveCode || prev.hseExpertPersonnelCode,
                      }));
                    }}
                  />
                </div>
              </div>

              {/* Section 1: Auto-Linked Base Event Data from RHS-F28 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    ۱- اطلاعات پایه رویداد و محل وقوع (فراخوانی خودکار از RHS-F28)
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">گزارش مرجع: {incident.reportNumber}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">تاریخ رویداد</label>
                    <PersianDatePicker
                      value={formData.eventDate}
                      onChange={(v) => setField('eventDate', v)}
                      disabled={isReadOnly}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">ساعت رویداد</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formData.eventTime}
                      onChange={(e) => setField('eventTime', e.target.value)}
                      placeholder="10:30"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">محل دقیق رویداد</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formData.exactLocation}
                      onChange={(e) => setField('exactLocation', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">مکان بروز</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formData.locationOccurrence}
                      onChange={(e) => setField('locationOccurrence', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">تاریخ گزارش رویداد</label>
                    <PersianDatePicker
                      value={formData.reportDate}
                      onChange={(v) => setField('reportDate', v)}
                      disabled={isReadOnly}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">ساعت گزارش رویداد</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formData.reportTime}
                      onChange={(e) => setField('reportTime', e.target.value)}
                      placeholder="11:00"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">نام و سمت گزارش‌دهنده</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formData.reporterNameAndRole}
                      onChange={(e) => setField('reporterNameAndRole', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">واحد سازمانی مصدوم</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formData.victimOrgUnit}
                      onChange={(e) => setField('victimOrgUnit', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-60"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">فعالیت حین حادثه</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formData.activityDuringIncident}
                      onChange={(e) => setField('activityDuringIncident', e.target.value)}
                      placeholder="شرح دقیق عملیات یا فعالیت در حال انجام حین بروز حادثه..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">تعداد مصدومین / قربانیان</label>
                    <input
                      type="number"
                      min={0}
                      disabled={isReadOnly}
                      value={formData.victimCount}
                      onChange={(e) => setField('victimCount', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono tabular-nums disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2 & Estimated Loss */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block font-black text-slate-900 dark:text-white mb-1.5">
                    ۲- شرح مختصر رویداد <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    rows={4}
                    disabled={isReadOnly}
                    value={formData.briefDescription}
                    onChange={(e) => setField('briefDescription', e.target.value)}
                    placeholder="شرح دقیق توالی رویداد و نحوه وقوع حادثه..."
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 leading-relaxed disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-900 dark:text-white mb-1.5">
                    برآورد میزان خسارات جانی / مالی
                  </label>
                  <textarea
                    rows={4}
                    disabled={isReadOnly}
                    value={formData.estimatedLoss}
                    onChange={(e) => setField('estimatedLoss', e.target.value)}
                    placeholder="برآورد خسارات جانی، تجهیزاتی، توقف تولید و هزینه‌های مرتبط..."
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 leading-relaxed disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Section 3: Risk Severity Matrix */}
              <div className="space-y-2">
                <label className="block font-black text-slate-900 dark:text-white">
                  ۳- داده‌های ماتریس شدت (شدت ریسک) <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {SEVERITY_OPTIONS.map((opt) => {
                    const selected = formData.riskSeverityMatrix === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => setField('riskSeverityMatrix', opt.value)}
                        className={`p-3 rounded-xl border text-right transition cursor-pointer disabled:cursor-not-allowed ${
                          selected
                            ? `${opt.activeClass} ring-2 ring-offset-1 ring-slate-900/10`
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between font-black">
                          <span>{opt.labelFa}</span>
                          {selected && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{opt.descFa}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sections 4, 5, 6: Causes */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block font-black text-slate-900 dark:text-white mb-1.5">
                    ۴- علل مستقیم <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    rows={4}
                    disabled={isReadOnly}
                    value={formData.directCauses}
                    onChange={(e) => setField('directCauses', e.target.value)}
                    placeholder="اعمال و شرایط ناایمن بلاواسطه منجر به وقوع حادثه..."
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 leading-relaxed disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-900 dark:text-white mb-1.5">۵- علل غیرمستقیم</label>
                  <textarea
                    rows={4}
                    disabled={isReadOnly}
                    value={formData.indirectCauses}
                    onChange={(e) => setField('indirectCauses', e.target.value)}
                    placeholder="عوامل زمینه‌ای، فردی، فنی و محیطی مؤثر..."
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 leading-relaxed disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-900 dark:text-white mb-1.5">
                    ۶- علل ریشه‌ای <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    rows={4}
                    disabled={isReadOnly}
                    value={formData.rootCauses}
                    onChange={(e) => setField('rootCauses', e.target.value)}
                    placeholder="نقص‌های سیستمی، مدیریتی، آموزشی یا دستورالعملی..."
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 leading-relaxed disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Section 7: Victim Info */}
              <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">۷- اطلاعات مصدوم (قربانی)</h3>
                  {!isReadOnly && (
                    <div className="w-full sm:w-72">
                      <CentralPersonnelSelector
                        isFa={isFa}
                        value={formData.victimName}
                        placeholder="انتخاب سریع مصدوم از فهرست پرسنل..."
                        onSelect={(person) => {
                          if (!person) return;
                          setFormData((prev) => ({
                            ...prev,
                            victimName: person.fullName || prev.victimName,
                            victimPersonnelCode: person.personnelCode || person.effectiveCode || prev.victimPersonnelCode,
                            victimDepartment: person.department || person.unit || prev.victimDepartment,
                            victimOrgUnit: prev.victimOrgUnit || person.department || person.unit || '',
                          }));
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">نام و نام خانوادگی</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formData.victimName}
                      onChange={(e) => setField('victimName', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">شماره پرسنلی</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formData.victimPersonnelCode}
                      onChange={(e) => setField('victimPersonnelCode', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">واحد سازمانی</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formData.victimDepartment}
                      onChange={(e) => setField('victimDepartment', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">سابقه کار</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formData.victimWorkExperience}
                      onChange={(e) => setField('victimWorkExperience', e.target.value)}
                      placeholder="مثلاً ۶ سال"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">نوع آسیب</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formData.injuryType}
                      onChange={(e) => setField('injuryType', e.target.value)}
                      placeholder="بریدگی، سوختگی، کوفتگی..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">عضو آسیب‌دیده</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formData.injuredBodyPart}
                      onChange={(e) => setField('injuredBodyPart', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">اقدام درمانی</label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formData.medicalTreatment}
                      onChange={(e) => setField('medicalTreatment', e.target.value)}
                      placeholder="پانسمان، اعزام به درمانگاه / بیمارستان..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">تعداد روزهای تلف‌شده</label>
                    <input
                      type="number"
                      min={0}
                      disabled={isReadOnly}
                      value={formData.lostWorkDays}
                      onChange={(e) => setField('lostWorkDays', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono tabular-nums disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* Section 8: CAPA & Expert Sign-off */}
              <div className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
                  <div className="lg:col-span-2">
                    <label className="block font-black text-slate-900 dark:text-white mb-1.5">
                      ۸- اقدام اصلاحی و پیشگیرانه مورد نیاز
                    </label>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      شماره فرم اقدام اصلاحی / پیشگیرانه
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      disabled={isReadOnly}
                      value={formData.capaFormNumber}
                      onChange={(e) => setField('capaFormNumber', e.target.value)}
                      placeholder="R\1405\E112\21212"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono disabled:opacity-60"
                    />
                  </div>
                </div>

                <textarea
                  rows={4}
                  disabled={isReadOnly}
                  value={formData.capaRequiredActions}
                  onChange={(e) => setField('capaRequiredActions', e.target.value)}
                  placeholder="فهرست اقدامات اصلاحی و پیشگیرانه، مسئولین اجرا و الزامات رفع علل ریشه‌ای..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 leading-relaxed disabled:opacity-60"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      تاریخ شروع (مبدأ تأیید RHS-F28)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={fmt(anchorDate)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">تاریخ پایان اقدامات</label>
                    <PersianDatePicker
                      value={formData.endDate}
                      onChange={(v) => setField('endDate', v)}
                      disabled={isReadOnly}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      نام و نام خانوادگی کارشناس واحد HSE
                    </label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={formData.hseExpertName}
                      onChange={(e) => setField('hseExpertName', e.target.value)}
                      placeholder="نام کارشناس تحلیل‌گر HSE..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold disabled:opacity-60"
                    />
                  </div>
                </div>

                {!isReadOnly && (
                  <div className="pt-2">
                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                      امضای دیجیتال کارشناس واحد HSE:
                    </div>
                    <DigitalSignaturePad
                      initialSignature={formData.hseExpertSignature || ''}
                      onSave={(sig) => setField('hseExpertSignature', sig)}
                      onClear={() => setField('hseExpertSignature', '')}
                      isFa={isFa}
                      signerTarget={currentUser}
                    />
                  </div>
                )}

                {!isReadOnly && (
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveToServer({ actionType: 'draft_save', submitForApproval: false })}
                      className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-slate-100 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveToServer({ submitForApproval: true })}
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{saving ? 'در حال ارسال...' : 'ارسال جهت بررسی و تأیید نهایی رئیس HSE'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* HSE Head Approval / Return Box */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>تأیید نهایی یا عودت اصلاحی رئیس مرکز HSE</span>
                  </h3>
                  {isCompleted ? (
                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأیید نهایی شده</span>
                    </span>
                  ) : !isHseHead ? (
                    <span className="text-[11px] font-bold text-slate-500 inline-flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>در اختیار رئیس مرکز HSE</span>
                    </span>
                  ) : null}
                </div>

                {isCompleted ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 dark:text-white">
                        تأییدکننده نهایی: {fmt(formData.hseHeadReviewerName || formData.completedBy)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        زمان تأیید نهایی: <span className="font-mono tabular-nums">{fmt(formData.hseHeadApprovedAt || formData.completedAt)}</span>
                      </div>
                      {formData.hseHeadReviewNotes && (
                        <div className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                          توضیحات: {formData.hseHeadReviewNotes}
                        </div>
                      )}
                    </div>
                    {formData.hseHeadSignature && (
                      <img
                        src={formData.hseHeadSignature}
                        alt="امضای رئیس HSE"
                        className="h-14 object-contain bg-white rounded-lg border border-slate-200 p-1"
                      />
                    )}
                  </div>
                ) : isHseHead ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        نظریه رئیس HSE (در صورت عودت برای اصلاح، درج توضیحات الزامی است):
                      </label>
                      <textarea
                        rows={2}
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="ملاحظات تأیید نهایی یا موارد نیازمند اصلاح توسط کارشناس HSE..."
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>

                    <DigitalSignaturePad
                      initialSignature={headSignature}
                      onSave={setHeadSignature}
                      onClear={() => setHeadSignature('')}
                      isFa={isFa}
                      signerTarget={currentUser}
                    />

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleHeadReview('RETURN')}
                        className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>عودت برای اصلاح (حفظ سوابق قبلی)</span>
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleHeadReview('APPROVE')}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{saving ? 'در حال ثبت...' : 'تأیید نهایی و اختتام تحلیل RHS-F34'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500">
                    پس از تکمیل و ارسال فرم توسط کارشناس HSE، پرونده جهت بررسی و تأیید نهایی در اختیار رئیس مرکز HSE قرار می‌گیرد.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EVIDENCE & ATTACHMENTS */}
          {activeTab === 'evidence' && (
            <RhsF68EvidencePanel
              entityId={`RHS-F34-${incident.reportNumber || incident.id}`}
              attachments={attachments}
              onChange={handleAttachmentsChange}
              readOnly={isReadOnly}
              isFa={isFa}
            />
          )}

          {/* TAB 3: AUTOMATIC OVERDUE NON-CONFORMITY */}
          {activeTab === 'nc' && (
            <div className="space-y-4">
              {!formData.nonConformanceId ? (
                <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <div className="font-black text-slate-900 dark:text-white text-sm">
                    عدم انطباق تأخیری برای این پرونده ثبت نشده است
                  </div>
                  <p className="text-slate-500 max-w-xl mx-auto leading-relaxed">
                    در صورت عدم تکمیل و تأیید نهایی فرم تجزیه و تحلیل حادثه (RHS-F34) تا پایان مهلت قانونی ۱۰ روز تقویمی (
                    <span className="font-mono font-bold">{fmt(formData.deadlineDate || deadlineInfo.deadlineDate)}</span>
                    )، سامانه به‌صورت خودکار عدم انطباق «عدم تکمیل تجزیه و تحلیل حادثه در مهلت مقرر» را ثبت و به این پرونده متصل می‌کند.
                  </p>
                </div>
              ) : (
                <div className="p-5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-rose-200 dark:border-rose-900/60">
                    <div>
                      <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300 font-mono">
                        کد عدم انطباق خودکار: {formData.nonConformanceTrackingCode || formData.nonConformanceId}
                      </div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                        {formData.nonConformanceTitle || 'عدم تکمیل تجزیه و تحلیل حادثه در مهلت مقرر'}
                      </h3>
                    </div>
                    <span className="text-xs font-black text-rose-700 dark:text-rose-300">
                      متصل به حادثه {incident.reportNumber}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        مسئول پیگیری عدم انطباق
                      </label>
                      <CentralPersonnelSelector
                        isFa={isFa}
                        value={ncOwnerName}
                        disabled={!canEditBase && !isHseHead}
                        placeholder="انتخاب مسئول پیگیری..."
                        onSelect={(person) => {
                          setNcOwnerName(person?.fullName || '');
                          setNcOwnerCode(person?.personnelCode || person?.effectiveCode || '');
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        مهلت اصلاح عدم انطباق
                      </label>
                      <PersianDatePicker
                        value={ncDueDate}
                        onChange={setNcDueDate}
                        disabled={!canEditBase && !isHseHead}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        وضعیت عدم انطباق
                      </label>
                      <select
                        value={ncStatus}
                        disabled={!canEditBase && !isHseHead}
                        onChange={(e) => setNcStatus(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                      >
                        <option value="REGISTERED">ثبت شده (باز)</option>
                        <option value="IN_PROGRESS">در دست اقدام اصلاحی</option>
                        <option value="PENDING_VERIFICATION">در انتظار ارزیابی اثربخشی</option>
                        <option value="CLOSED">بسته شده / رفع عدم انطباق</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      اقدامات اصلاحی ثبت‌شده جهت رفع تأخیر و جلوگیری از تکرار:
                    </label>
                    <textarea
                      rows={3}
                      disabled={!canEditBase && !isHseHead}
                      value={ncCorrectiveAction}
                      onChange={(e) => setNcCorrectiveAction(e.target.value)}
                      placeholder="شرح علت تأخیر و اقدام اصلاحی مصوب جهت تکمیل فوری تحلیل حادثه..."
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>

                  {(canEditBase || isHseHead) && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={savingNc}
                        onClick={handleUpdateNonConformance}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingNc ? 'در حال ذخیره...' : 'ذخیره اطلاعات عدم انطباق'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EXACT A4 PRINT / PDF PREVIEW (RHS-F34 REJAL PETROCHEMICAL) */}
          {activeTab === 'print' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="w-full flex items-center justify-between bg-slate-100 dark:bg-slate-800/60 px-4 py-2.5 rounded-xl">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  پیش‌نمایش استاندارد چاپی A4 — مطابق فرم رسمی RHS-F34 پتروشیمی رجال
                </span>
                <button
                  type="button"
                  onClick={handlePrintA4}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ / خروجی PDF</span>
                </button>
              </div>

              <div className="w-full overflow-x-auto pb-4 flex justify-center">
                <div
                  id="rhs-f34-a4-print-root"
                  dir="rtl"
                  style={{
                    width: '210mm',
                    minHeight: '297mm',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    padding: '10mm 12mm 8mm 12mm',
                    fontFamily: 'Vazirmatn, Tahoma, Arial, sans-serif',
                    fontSize: '11px',
                    lineHeight: 1.5,
                    boxSizing: 'border-box',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                  }}
                >
                  {/* Top Header Outside Outer Frame */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '28%', verticalAlign: 'middle', textAlign: 'right' }}>
                          {(branding?.formalHeader?.useCustom && branding?.formalHeader?.logoUrl) || branding?.logoUrl ? (
                            <img
                              src={(branding?.formalHeader?.useCustom && branding?.formalHeader?.logoUrl) || branding?.logoUrl || ''}
                              alt="لوگوی پتروشیمی رجال"
                              referrerPolicy="no-referrer"
                              style={{ maxHeight: '40px', maxWidth: '130px', objectFit: 'contain' }}
                            />
                          ) : (
                            <RegalPetrochemicalLogo />
                          )}
                        </td>
                        <td style={{ width: '44%', verticalAlign: 'middle', textAlign: 'center' }}>
                          <div style={{ fontSize: '15px', fontWeight: 900, color: '#000' }}>
                            تجزیه و تحلیل رویداد
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: '#000', marginTop: '2px' }}>
                            واحد بهداشت ، ایمنی و محیط زیست پتروشیمی رجال
                          </div>
                        </td>
                        <td style={{ width: '28%', verticalAlign: 'middle', textAlign: 'left', fontSize: '11px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                              <tr>
                                <td style={{ textAlign: 'right', fontWeight: 700, width: '46px' }}>تاریخ :</td>
                                <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, direction: 'ltr' }}>
                                  {formatPrintDate(formData.formDate || formData.deadlineDate)}
                                </td>
                              </tr>
                              <tr>
                                <td style={{ textAlign: 'right', fontWeight: 700, paddingTop: '4px' }}>شماره :</td>
                                <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, paddingTop: '4px', direction: 'ltr' }}>
                                  {formData.formNumber || `RGC-HSE/${incident.reportNumber}`}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Outer Black Frame */}
                  <div style={{ border: '1.5px solid #000000' }}>
                    {/* Empty Top Strip matching official PDF */}
                    <div style={{ height: '16px', borderBottom: '1px solid #000000' }} />

                    {/* 1. Base Event Metadata Table (4x4) */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '21%' }} />
                        <col style={{ width: '29%' }} />
                        <col style={{ width: '21%' }} />
                        <col style={{ width: '29%' }} />
                      </colgroup>
                      <tbody>
                        <tr>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            تاریخ و ساعت رویداد :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                            {toPersianDigits([formData.eventDate, formData.eventTime].filter(Boolean).join(' - '))}
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            محل دقیق رویداد:
                          </td>
                          <td style={{ borderBottom: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                            {formData.exactLocation}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            تاریخ و ساعت گزارش رویداد :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                            {toPersianDigits([formData.reportDate, formData.reportTime].filter(Boolean).join(' - '))}
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            مکان بروز :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                            {formData.locationOccurrence}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            نام و سمت گزارش دهنده :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                            {formData.reporterNameAndRole}
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            واحد سازمانی مصدوم :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                            {formData.victimOrgUnit}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            فعالیت حین حادثه :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                            {formData.activityDuringIncident}
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            تعداد مصدومین /قربانیان :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', padding: '4px 6px', textAlign: 'center', fontWeight: 700 }}>
                            {formData.victimCount !== '' && formData.victimCount !== undefined
                              ? toPersianDigits(String(formData.victimCount))
                              : '۰'}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* 2. Brief Description */}
                    <div style={{ borderBottom: '1px solid #000', padding: '5px 8px', minHeight: '56px' }}>
                      <div style={{ fontWeight: 900, marginBottom: '3px' }}>۲- شرح مختصر رویداد :</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{formData.briefDescription}</div>
                    </div>

                    {/* Estimated Loss */}
                    <div style={{ borderBottom: '1px solid #000', padding: '5px 8px', minHeight: '42px' }}>
                      <div style={{ fontWeight: 900, marginBottom: '3px' }}>برآورد میزان خسارات جانی / مالی :</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{formData.estimatedLoss}</div>
                    </div>

                    {/* 3. Severity Matrix (Exact 2x2 Layout) */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '32%' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '18%' }} />
                      </colgroup>
                      <tbody>
                        <tr>
                          <td
                            rowSpan={2}
                            style={{
                              borderBottom: '1px solid #000',
                              borderLeft: '1px solid #000',
                              padding: '6px 8px',
                              fontWeight: 900,
                              verticalAlign: 'top',
                            }}
                          >
                            ۳- داده های ماتریس شدت ( شدت ریسک ):
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '5px', textAlign: 'center', fontFamily: 'serif', fontSize: '12px', fontWeight: 700 }}>
                            High
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '5px', textAlign: 'center' }}>
                            {renderMatrixMark('High')}
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '5px', textAlign: 'center', fontFamily: 'serif', fontSize: '12px', fontWeight: 700 }}>
                            Medium
                          </td>
                          <td style={{ borderBottom: '1px solid #000', padding: '5px', textAlign: 'center' }}>
                            {renderMatrixMark('Medium')}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '5px', textAlign: 'center', fontFamily: 'serif', fontSize: '12px', fontWeight: 700 }}>
                            Minimal
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '5px', textAlign: 'center' }}>
                            {renderMatrixMark('Minimal')}
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '5px', textAlign: 'center', fontFamily: 'serif', fontSize: '12px', fontWeight: 700 }}>
                            Low
                          </td>
                          <td style={{ borderBottom: '1px solid #000', padding: '5px', textAlign: 'center' }}>
                            {renderMatrixMark('Low')}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* 4. Direct Causes */}
                    <div style={{ borderBottom: '1px solid #000', padding: '5px 8px', minHeight: '72px' }}>
                      <div style={{ fontWeight: 900, marginBottom: '3px' }}>۴- علل مستقیم :</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{formData.directCauses}</div>
                    </div>

                    {/* 5. Indirect Causes */}
                    <div style={{ borderBottom: '1px solid #000', padding: '5px 8px', minHeight: '72px' }}>
                      <div style={{ fontWeight: 900, marginBottom: '3px' }}>۵- علل غیرمستقیم :</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{formData.indirectCauses}</div>
                    </div>

                    {/* 6. Root Causes */}
                    <div style={{ borderBottom: '1px solid #000', padding: '5px 8px', minHeight: '48px' }}>
                      <div style={{ fontWeight: 900, marginBottom: '3px' }}>۶- علل ریشه ای :</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{formData.rootCauses}</div>
                    </div>

                    {/* 7. Victim Details Header + 4x4 Table */}
                    <div style={{ borderBottom: '1px solid #000', padding: '4px 8px', fontWeight: 900 }}>
                      ۷- اطلاعات مصدوم (قربانی) :
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '32%' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '32%' }} />
                      </colgroup>
                      <tbody>
                        <tr>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            نام و نام خانوادگی :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                            {formData.victimName || '-'}
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            شماره پرسنلی :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                            {formData.victimPersonnelCode ? toPersianDigits(formData.victimPersonnelCode) : '-'}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            واحد سازمانی :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                            {formData.victimDepartment || '-'}
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            سابقه کار :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                            {formData.victimWorkExperience ? toPersianDigits(formData.victimWorkExperience) : '-'}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            نوع آسیب :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                            {formData.injuryType || '-'}
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            عضو آسیب دیده :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                            {formData.injuredBodyPart || '-'}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            اقدام درمانی :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                            {formData.medicalTreatment || '-'}
                          </td>
                          <td style={{ borderBottom: '1px solid #000', borderLeft: '1px solid #000', padding: '4px 6px', fontWeight: 700 }}>
                            تعداد روزهای تلف شده :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                            {formData.lostWorkDays !== '' && formData.lostWorkDays !== undefined
                              ? toPersianDigits(String(formData.lostWorkDays))
                              : '-'}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* 8. Corrective & Preventive Actions with Top-Left CAPA Form Box */}
                    <div style={{ borderBottom: '1px solid #000', minHeight: '205px', position: 'relative' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ padding: '5px 8px', fontWeight: 900, width: '50%' }}>
                              ۸- اقدام اصلاحی و پیشگیرانه مورد نیاز :
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, width: '32%', fontSize: '10.5px' }}>
                              شماره فرم اقدام اصلاحی/ پیشگیرانه
                            </td>
                            <td
                              style={{
                                width: '18%',
                                borderRight: '1px solid #000',
                                borderBottom: '1px solid #000',
                                padding: '4px 6px',
                                textAlign: 'center',
                                fontFamily: 'monospace',
                                fontWeight: 800,
                                fontSize: '10.5px',
                                direction: 'ltr',
                              }}
                            >
                              {formData.capaFormNumber || '\u00A0'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <div style={{ padding: '6px 10px 10px 10px', whiteSpace: 'pre-wrap' }}>
                        {formData.capaRequiredActions}
                      </div>
                    </div>

                    {/* Bottom Signature Strip */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', height: '58px' }}>
                      <tbody>
                        <tr>
                          <td style={{ width: '28%', padding: '6px 10px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                              <span style={{ fontWeight: 700 }}>تاریخ شروع :</span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, direction: 'ltr' }}>
                                {formatPrintDate(formData.startDate || anchorDate)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 700 }}>تاریخ پایان :</span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, direction: 'ltr' }}>
                                {formatPrintDate(formData.endDate || formData.deadlineDate)}
                              </span>
                            </div>
                          </td>
                          <td style={{ width: '44%', padding: '6px 10px', verticalAlign: 'top', textAlign: 'center' }}>
                            <span style={{ fontWeight: 700 }}>نام و نام خانوادگی کارشناس واحد HSE : </span>
                            <span style={{ fontWeight: 900, marginRight: '8px' }}>
                              {formData.hseExpertName || formData.assignedExpertName || ''}
                            </span>
                            {formData.hseHeadReviewerName && isCompleted && (
                              <div style={{ fontSize: '9.5px', marginTop: '6px', color: '#111' }}>
                                تأیید نهایی رئیس HSE: <strong>{formData.hseHeadReviewerName}</strong>
                              </div>
                            )}
                          </td>
                          <td style={{ width: '28%', padding: '4px 10px', verticalAlign: 'middle', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              {formData.hseExpertSignature && (
                                <img
                                  src={formData.hseExpertSignature}
                                  alt="امضای کارشناس HSE"
                                  style={{ maxHeight: '42px', maxWidth: '88px', objectFit: 'contain' }}
                                />
                              )}
                              {formData.hseHeadSignature && isCompleted && (
                                <img
                                  src={formData.hseHeadSignature}
                                  alt="امضای رئیس HSE"
                                  style={{ maxHeight: '42px', maxWidth: '88px', objectFit: 'contain' }}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Outer Footer matching exact PDF */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '6px',
                      fontSize: '10px',
                      fontWeight: 800,
                      color: '#000',
                    }}
                  >
                    <div>
                      <span>کد فرم : {formData.formCode || 'RHS – F34'}</span>
                      <span style={{ marginRight: '18px' }}>بازنگری : {formData.revision || '00'}</span>
                    </div>
                    <div>
                      {formData.distributionList || 'توزیع نسخ: ۱- مدیریت امور مجتمع ۲- واحد HSE ۳- امور اداری'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: IMMUTABLE AUDIT LOG */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold">سابقه‌ای ثبت نشده است.</div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="font-black text-slate-900 dark:text-white">{log.actionFa}</div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-2">
                        <span>
                          اقدام‌کننده: <strong>{log.user}</strong>
                        </span>
                        {log.userCode && <span>({fmt(log.userCode)})</span>}
                        {log.outcome && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-bold text-indigo-700 dark:text-indigo-300">
                              نتیجه: {log.outcome}
                            </span>
                          </>
                        )}
                      </div>
                      {log.details && (
                        <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{log.details}</div>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                      {fmt(log.timestamp)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
