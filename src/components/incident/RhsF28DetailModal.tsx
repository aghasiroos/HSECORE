import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertOctagon,
  CheckCircle2,
  Edit3,
  FileSpreadsheet,
  History,
  Lock,
  Paperclip,
  Printer,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  RhsF68AttachmentItem,
  SafetyIncidentRecord,
  UserProfile,
} from '../../types';
import { WORKFLOW_STAGE_META, getIncidentWorkflowStage } from '../../utils/rhsF68Config';
import { calculateDeadlineInfo, getCurrentJalaliDate } from '../../utils/incidentSupplementaryHelper';
import { toPersianDigits } from '../../utils/jalaliDate';
import { apiDb } from '../../services/apiDatabaseClient';
import { DigitalSignaturePad } from '../referral/DigitalSignaturePad';
import { RhsF68EvidencePanel } from './RhsF68EvidencePanel';
import { handleVersionConflict } from '../common/ConflictResolutionModal';
import CentralPersonnelSelector from '../CentralPersonnelSelector';

interface RhsF28DetailModalProps {
  incident: SafetyIncidentRecord | null;
  currentUser: UserProfile;
  onClose: () => void;
  onUpdated: (updated: SafetyIncidentRecord) => void;
  onEditDraft?: (record: SafetyIncidentRecord) => void;
  onOpenPrint: (record: SafetyIncidentRecord) => void;
  onOpenReferral: (record: SafetyIncidentRecord) => void;
  onOpenTracker: (record: SafetyIncidentRecord) => void;
  onOpenSupplementary?: (record: SafetyIncidentRecord) => void;
  onDelete?: (id: string) => void;
  isFa?: boolean;
}

export const RhsF28DetailModal: React.FC<RhsF28DetailModalProps> = ({
  incident,
  currentUser,
  onClose,
  onUpdated,
  onEditDraft,
  onOpenPrint,
  onOpenReferral,
  onOpenTracker,
  onOpenSupplementary,
  onDelete,
  isFa = true,
}) => {
  const [activeTab, setActiveTab] = useState<'form' | 'evidence' | 'audit'>('form');
  const [saving, setSaving] = useState(false);

  const [headNotes, setHeadNotes] = useState('');
  const [headSignature, setHeadSignature] = useState('');
  const [assignedF34ExpertCode, setAssignedF34ExpertCode] = useState('');
  const [assignedF34ExpertName, setAssignedF34ExpertName] = useState('');
  const [attachments, setAttachments] = useState<RhsF68AttachmentItem[]>([]);

  const roleUpper = (currentUser?.role || '').toUpperCase().replace(/[\s_]+/g, '');
  const isHseHead =
    ['ADMIN', 'ADMINISTRATOR', 'HSEMANAGER', 'EXECUTIVEMANAGER'].includes(roleUpper) ||
    roleUpper.includes('ADMIN') ||
    Boolean(currentUser?.permissions?.Incidents?.approve);

  useEffect(() => {
    if (!incident) return;
    setActiveTab('form');
    const f28 = incident.rhsF28;
    setHeadNotes(f28?.hseCenterHeadNotes || '');
    setHeadSignature(f28?.hseCenterHeadSignature || '');
    setAssignedF34ExpertCode(incident.supplementaryForm?.assignedExpertCode || '');
    setAssignedF34ExpertName(incident.supplementaryForm?.assignedExpertName || '');
    setAttachments(Array.isArray(f28?.attachments) ? f28.attachments : []);
  }, [incident]);

  if (!incident) return null;

  const f28 = incident.rhsF28;
  const stage = getIncidentWorkflowStage(incident);
  const stageMeta = WORKFLOW_STAGE_META[stage];
  const canEditReporter =
    stage !== 'CLOSED' &&
    (stage === 'DRAFT' ||
      stage === 'RETURNED' ||
      isHseHead ||
      (Boolean(currentUser?.personnelNumber) &&
        currentUser?.personnelNumber === incident.reporterPersonnelCode));

  const canHeadSign =
    stage !== 'CLOSED' &&
    isHseHead &&
    (stage === 'HSE_FINAL_APPROVAL' || stage === 'HSE_HEAD_TRIAGE');

  const handleAttachmentsChange = async (updatedList: RhsF68AttachmentItem[]) => {
    setAttachments(updatedList);
    try {
      const updated = await apiDb.updateIncident(incident.reportNumber || incident.id, {
        attachmentsOnly: true,
        expectedVersion: incident.version,
        rhsF28: { attachments: updatedList },
      });
      onUpdated(updated);
    } catch (err: any) {
      toast.error(err?.message || (isFa ? 'خطا در بروزرسانی پیوست‌ها' : 'Attachment update error'));
    }
  };

  const handleHeadDecision = async (decision: 'APPROVE_CLOSE' | 'RETURN_FOR_REVISION') => {
    if (decision === 'RETURN_FOR_REVISION' && !headNotes.trim()) {
      toast.error(
        isFa ? 'در صورت عودت گزارش جهت اصلاح، درج علت در توضیحات الزامی است.' : 'Notes required on return.'
      );
      return;
    }

    setSaving(true);
    try {
      const updated = await apiDb.finalApproveIncidentWorkflow(incident.reportNumber || incident.id, {
        decision,
        returnTo: 'REPORTER',
        expectedVersion: incident.version,
        conclusionNotes: headNotes.trim(),
        hseCenterHeadNotes: headNotes.trim(),
        finalHseHeadName: currentUser?.fullName || currentUser?.username || 'رئیس مرکز HSE',
        finalHseHeadPersonnelCode: currentUser?.personnelNumber || '',
        finalHseHeadSignature: headSignature,
        finalApprovedDate: getCurrentJalaliDate(),
        assignedF34ExpertCode: assignedF34ExpertCode || undefined,
        assignedF34ExpertName: assignedF34ExpertName || undefined,
      });
      toast.success(
        decision === 'APPROVE_CLOSE'
          ? isFa
            ? 'گزارش RHS-F28 تایید شد و پرونده تجزیه و تحلیل حادثه (RHS-F34) با مهلت ۱۰ روزه به‌صورت خودکار ایجاد گردید.'
            : 'Report signed & RHS-F34 analysis auto-created.'
          : isFa
          ? 'گزارش جهت اصلاح به گزارش‌دهنده عودت داده شد.'
          : 'Returned to reporter.'
      );
      onUpdated(updated);
    } catch (err: any) {
      if (err?.status === 409 || err?.code === 'VERSION_CONFLICT') {
        await handleVersionConflict(err, {
          localRecord: incident,
          onReloadLatest: onClose,
        });
      } else {
        toast.error(err?.message || (isFa ? 'خطا در ثبت تصمیم رئیس مرکز HSE' : 'Approval failed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const auditHistory = Array.isArray(f28?.auditHistory) ? f28.auditHistory : [];

  const fmt = (v?: string | null) => {
    const s = String(v || '').trim();
    return s ? (isFa ? toPersianDigits(s) : s) : '—';
  };

  return createPortal(
    <div className="fixed inset-0 z-[99997] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div
        dir={isFa ? 'rtl' : 'ltr'}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {/* Top Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-400/30 font-mono text-[10px] font-black">
                  RHS - F28 - Rev 01
                </span>
                <span className="px-2 py-0.5 rounded bg-white/10 text-slate-100 font-mono text-[11px] font-bold tabular-nums">
                  {incident.reportNumber}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${stageMeta.badgeClass}`}>
                  {stage === 'HSE_FINAL_APPROVAL'
                    ? isFa
                      ? 'در انتظار بررسی و امضای رئیس مرکز HSE'
                      : 'Pending HSE Head Sign-Off'
                    : stageMeta.labelFa}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-white mt-1 truncate">
                {incident.title || 'گزارش حادثه / رویداد (پتروشیمی رجال)'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => onOpenPrint(incident)}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isFa ? 'چاپ رسمی A4' : 'Print A4'}</span>
            </button>

            {canEditReporter && onEditDraft && (
              <button
                type="button"
                onClick={() => onEditDraft(incident)}
                className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isFa ? 'ویرایش فرم' : 'Edit'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenReferral(incident)}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isFa ? 'ارجاع' : 'Refer'}</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenTracker(incident)}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <History className="w-3.5 h-3.5" />
              <span>{isFa ? 'رهگیری' : 'Tracker'}</span>
            </button>

            {onOpenSupplementary && (
              <button
                type="button"
                onClick={() => onOpenSupplementary(incident)}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>RHS-F34</span>
              </button>
            )}

            {onDelete && stage !== 'CLOSED' && (
              <button
                type="button"
                onClick={() => onDelete(incident.id)}
                title={isFa ? 'حذف گزارش' : 'Delete'}
                className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 cursor-pointer transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

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

        {/* Navigation Tabs */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === 'form'
                ? 'bg-slate-900 dark:bg-rose-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isFa ? 'مشخصات فرم و تایید رئیس مرکز HSE' : 'Form & HSE Sign-Off'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('evidence')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === 'evidence'
                ? 'bg-slate-900 dark:bg-rose-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>
              {isFa ? `مستندات و پیوست‌ها (${attachments.length})` : `Evidence (${attachments.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === 'audit'
                ? 'bg-slate-900 dark:bg-rose-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{isFa ? `تاریخچه گردش کار (${auditHistory.length})` : `Audit (${auditHistory.length})`}</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {activeTab === 'form' && (
            <>
              {/* Return Notice if RETURNED */}
              {stage === 'RETURNED' && f28?.hseCenterHeadNotes && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200">
                  <div className="font-black text-xs mb-1">
                    {isFa ? 'عودت شده جهت اصلاح توسط رئیس مرکز HSE:' : 'Returned for revision:'}
                  </div>
                  <p className="text-xs leading-relaxed">{f28.hseCenterHeadNotes}</p>
                </div>
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30">
                <div>
                  <span className="text-[11px] text-slate-500 block">تاریخ گزارش</span>
                  <span className="font-black text-slate-900 dark:text-white font-mono tabular-nums">
                    {fmt(f28?.reportDate || incident.reportDate)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">گزارش‌دهنده</span>
                  <span className="font-black text-slate-900 dark:text-white">
                    {fmt(f28?.reporterName || incident.reporterName)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">شماره پرسنلی</span>
                  <span className="font-black text-slate-900 dark:text-white font-mono tabular-nums">
                    {fmt(f28?.reporterPersonnelCode || incident.reporterPersonnelCode)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">واحد سازمانی</span>
                  <span className="font-black text-slate-900 dark:text-white">
                    {fmt(f28?.department || incident.department)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">زمان مشاهده</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                    {fmt(f28?.observationDate || incident.eventDate)} — {fmt(f28?.observationTime || incident.eventTime)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">مکان بروز</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {fmt(f28?.locationSite || incident.locationSite)}
                    {f28?.exactLocation ? ` (${f28.exactLocation})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">نوع ثبت</span>
                  <span className="font-black text-rose-700 dark:text-rose-300">
                    {f28?.isIncidentEvent !== false ? 'رویداد (حادثه) ✓' : 'رویداد'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">مصدوم / عضو آسیب‌دیده</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {f28?.injuredPersonName
                      ? `${f28.injuredPersonName}${f28.injuredPersonJobTitle ? ` (${f28.injuredPersonJobTitle})` : ''}${f28.injuredBodyPart ? ` — ${f28.injuredBodyPart}` : ''}`
                      : 'ثبت نشده'}
                  </span>
                </div>
              </div>

              {/* 5 Narrative Fields */}
              <div className="space-y-3">
                {[
                  { label: 'شرح مورد:', value: f28?.description || incident.description },
                  { label: 'خسارات وارده / آسیب به فرد(افراد):', value: f28?.damagesOrInjuries },
                  { label: 'شرح اقدامات انجام شده:', value: f28?.actionsTaken || incident.immediateActionTaken },
                  {
                    label: 'توصیه برای رفع و اصلاح / پیشگیری از بروز مجدد مورد:',
                    value: f28?.recommendations,
                  },
                  { label: 'سایر توضیحات:', value: f28?.otherNotes },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  >
                    <div className="font-black text-slate-800 dark:text-slate-100 mb-1.5">{item.label}</div>
                    <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {item.value?.trim() || '—'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Reporter Signature Summary */}
              {f28?.reporterSignature && (
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-black text-slate-800 dark:text-slate-100">امضای گزارش‌دهنده:</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {fmt(f28.reporterName)} — تاریخ: {fmt(f28.reporterSignedDate)}
                    </div>
                  </div>
                  <img
                    src={f28.reporterSignature}
                    alt="امضای گزارش‌دهنده"
                    className="h-12 object-contain bg-white rounded-lg border border-slate-200 p-1"
                  />
                </div>
              )}

              {/* HSE Center Head Sign-Off Section */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>رئیس مرکز ایمنی، بهداشت و محیط زیست</span>
                  </h3>
                  {stage === 'CLOSED' ? (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-black text-[11px]">
                      تایید و امضا شده
                    </span>
                  ) : !canHeadSign ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                      <Lock className="w-3.5 h-3.5" />
                      <span>در اختیار رئیس مرکز HSE</span>
                    </span>
                  ) : null}
                </div>

                {stage === 'CLOSED' ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          تاییدکننده: {fmt(f28?.hseCenterHeadName)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          تاریخ امضا و مبدأ مهلت ۱۰ روزه تحلیل: <span className="font-mono tabular-nums font-bold">{fmt(f28?.hseCenterHeadSignedDate)}</span>
                        </div>
                        {f28?.hseCenterHeadNotes && (
                          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                            توضیحات: {f28.hseCenterHeadNotes}
                          </p>
                        )}
                      </div>
                      {f28?.hseCenterHeadSignature && (
                        <img
                          src={f28.hseCenterHeadSignature}
                          alt="امضای رئیس مرکز HSE"
                          className="h-14 object-contain bg-white rounded-xl border border-slate-200 p-1.5"
                        />
                      )}
                    </div>

                    {/* Linked Mandatory RHS-F34 Analysis Banner */}
                    {(() => {
                      const f34 = incident.supplementaryForm;
                      const anchor = f34?.f28FinalApprovedDate || f34?.startDate || f28?.hseCenterHeadSignedDate || '';
                      const dl = calculateDeadlineInfo(anchor, f34?.status);
                      const isCompleted = f34?.status === 'completed' || f34?.workflowStage === 'COMPLETED';
                      const isOverdue = !isCompleted && (f34?.isExpired || dl.isExpired);
                      const isNear = !isCompleted && !isOverdue && (f34?.isNearDeadline || dl.isNearDeadline);
                      return (
                        <div
                          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isCompleted
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                              : isOverdue
                              ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                              : isNear
                              ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                              : 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                              <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              <span>پرونده الزامی تجزیه و تحلیل حادثه (RHS-F34)</span>
                              {f34?.formNumber && (
                                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                  ({f34.formNumber})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span>
                                مهلت قانونی: <strong className="font-mono tabular-nums">{fmt(f34?.startDate || anchor)}</strong> تا{' '}
                                <strong className="font-mono tabular-nums">{fmt(f34?.deadlineDate || dl.deadlineDate)}</strong>
                              </span>
                              <span>·</span>
                              <span className="font-bold">
                                {isCompleted
                                  ? 'تکمیل و تأیید نهایی شده'
                                  : isOverdue
                                  ? `دارای ${toPersianDigits(Math.abs(dl.daysRemaining))} روز تأخیر`
                                  : `${toPersianDigits(dl.daysRemaining)} روز تا سررسید`}
                              </span>
                              {f34?.assignedExpertName && (
                                <>
                                  <span>·</span>
                                  <span>کارشناس مسئول: <strong>{f34.assignedExpertName}</strong></span>
                                </>
                              )}
                              {f34?.nonConformanceTrackingCode && (
                                <>
                                  <span>·</span>
                                  <span className="font-black text-rose-700 dark:text-rose-300">
                                    عدم انطباق خودکار: {f34.nonConformanceTrackingCode}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {onOpenSupplementary && (
                            <button
                              type="button"
                              onClick={() => onOpenSupplementary(incident)}
                              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-black whitespace-nowrap shrink-0 cursor-pointer transition"
                            >
                              {isCompleted ? 'مشاهده و چاپ RHS-F34' : 'ورود و تکمیل RHS-F34'}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : canHeadSign ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                        {isFa ? 'نظریه / دستور بررسی رئیس مرکز HSE:' : 'HSE Center Head Notes:'}
                      </label>
                      <textarea
                        rows={2}
                        value={headNotes}
                        onChange={(e) => setHeadNotes(e.target.value)}
                        placeholder="توضیحات، دستورات پیگیری یا علت عودت..."
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>

                    <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2">
                      <div className="text-[11px] font-black text-indigo-900 dark:text-indigo-200">
                        {isFa
                          ? 'تعیین کارشناس مسئول تجزیه و تحلیل حادثه RHS-F34 (ایجاد خودکار با مهلت ۱۰ روزه پس از تأیید نهایی):'
                          : 'Assign RHS-F34 HSE Analyst (auto-created on approval):'}
                      </div>
                      <CentralPersonnelSelector
                        isFa={isFa}
                        value={assignedF34ExpertName}
                        placeholder={isFa ? 'انتخاب کارشناس HSE جهت ارجاع خودکار پرونده RHS-F34 (اختیاری)...' : 'Select HSE analyst...'}
                        onSelect={(person) => {
                          setAssignedF34ExpertName(person?.fullName || '');
                          setAssignedF34ExpertCode(person?.personnelCode || person?.effectiveCode || '');
                        }}
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
                        onClick={() => handleHeadDecision('RETURN_FOR_REVISION')}
                        className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{isFa ? 'عودت جهت اصلاح به گزارش‌دهنده' : 'Return for Revision'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleHeadDecision('APPROVE_CLOSE')}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {saving
                            ? 'در حال ثبت...'
                            : isFa
                            ? 'تایید نهایی RHS-F28 و ایجاد خودکار RHS-F34'
                            : 'Approve & Auto-Create RHS-F34'}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-xs">
                    {stage === 'DRAFT'
                      ? 'این گزارش هنوز در حالت پیش‌نویس است و به رئیس مرکز HSE ارسال نشده است.'
                      : 'این گزارش در انتظار بررسی و امضای رئیس مرکز ایمنی، بهداشت و محیط زیست قرار دارد.'}
                  </p>
                )}
              </div>
            </>
          )}

          {activeTab === 'evidence' && (
            <RhsF68EvidencePanel
              entityId={incident.reportNumber || String(incident.id)}
              attachments={attachments}
              onChange={handleAttachmentsChange}
              readOnly={stage === 'CLOSED'}
              isFa={isFa}
            />
          )}

          {activeTab === 'audit' && (
            <div className="space-y-3">
              {auditHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold">
                  {isFa ? 'سابقه‌ای ثبت نشده است' : 'No audit records'}
                </div>
              ) : (
                auditHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="font-black text-slate-900 dark:text-white">{entry.action}</div>
                      <div className="text-[11px] text-slate-500">
                        اقدام‌کننده: <strong className="text-slate-700 dark:text-slate-200">{entry.actorName}</strong>
                        {entry.referredToName ? ` ← ارجاع به: ${entry.referredToName}` : ''}
                      </div>
                      {entry.details && <div className="text-xs text-slate-700 dark:text-slate-300">{entry.details}</div>}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 tabular-nums">
                      {entry.jalaliDateTime || entry.timestamp}
                    </span>
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
};
