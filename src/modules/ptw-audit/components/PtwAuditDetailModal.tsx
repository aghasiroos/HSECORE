import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Building2, 
  FileText, 
  User, 
  Flame, 
  Snowflake, 
  Box, 
  ShieldCheck, 
  ShieldAlert, 
  HardHat, 
  Eye, 
  Check, 
  Ban, 
  MinusCircle, 
  UserCheck, 
  Paperclip, 
  Download, 
  ExternalLink, 
  Maximize2, 
  FileImage, 
  Trash2,
  Send,
  GitCommit,
  PenTool,
  Lock
} from 'lucide-react';
import { PtwAuditRecord, PtwAuditAttachment } from '../types';
import { calculateAuditMetrics } from '../services/ptwAuditService';
import { getReferralsForDocument } from '../../../utils/referralHelper';
import ConfirmDeleteModal from '../../../components/common/ConfirmDeleteModal';
import { apiDb } from '../../../services/apiDatabaseClient';
import { formatFileSize } from '../../../utils/fileHelpers';

interface PtwAuditDetailModalProps {
  audit: PtwAuditRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (audit: PtwAuditRecord) => void;
  onPrint: (audit: PtwAuditRecord) => void;
  onDelete?: (id: string) => void;
  onOpenReferral?: (audit: PtwAuditRecord) => void;
  onOpenWorkflowTracker?: (audit: PtwAuditRecord) => void;
  isFa?: boolean;
}

export default function PtwAuditDetailModal({
  audit,
  isOpen,
  onClose,
  onEdit,
  onPrint,
  onDelete,
  onOpenReferral,
  onOpenWorkflowTracker,
  isFa = true
}: PtwAuditDetailModalProps) {
  const [previewAttachment, setPreviewAttachment] = useState<PtwAuditAttachment | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (!isOpen || !audit) return null;

  const docReferrals = getReferralsForDocument('PTW_AUDIT', audit.id);
  const activeReferral = docReferrals[0];
  const hasReferral = Boolean(activeReferral);

  const metrics = calculateAuditMetrics(audit.inspectionItems || []);

  const getPermitTypeBadge = (type: string) => {
    switch (type) {
      case 'HOT':
        return { label: 'پروانه کار گرم (Hot Work)', color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800', icon: Flame };
      case 'COLD':
        return { label: 'پروانه کار سرد (Cold Work)', color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800', icon: Snowflake };
      case 'CONFINED_SPACE':
        return { label: 'ورود به فضای بسته (Confined Space)', color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800', icon: Box };
      default:
        return { label: type, color: 'bg-slate-100 text-slate-700 border-slate-200', icon: FileText };
    }
  };

  const badge = getPermitTypeBadge(audit.permitType || 'HOT');
  const BadgeIcon = badge.icon;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div 
        dir="rtl"
        className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  جزئیات ممیزی پروانه کار
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border flex items-center gap-1 ${badge.color}`}>
                  <BadgeIcon className="w-3.5 h-3.5" />
                  <span>{badge.label}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                <span>شماره پروانه: <strong className="font-mono text-slate-700 dark:text-slate-200">{audit.permitNumber}</strong></span>
                <span>•</span>
                <span>واحد: <strong className="text-slate-700 dark:text-slate-200">{audit.unitName || 'عمومی'}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Referral Button */}
            <button
              onClick={() => onOpenReferral?.(audit)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
              title="ارجاع این ممیزی جهت تایید و امضای مسئولین و سرپرستان"
            >
              <Send className="w-3.5 h-3.5" />
              <span>ارجاع و امضا</span>
            </button>

            {hasReferral && (
              <button
                onClick={() => onOpenWorkflowTracker?.(audit)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-xs rounded-xl border border-purple-200 dark:border-purple-800 transition cursor-pointer"
                title="مشاهده لاگ گردش کار و امضاها"
              >
                <GitCommit className="w-3.5 h-3.5" />
                <span>پیگیری امضاها</span>
              </button>
            )}

            <button
              onClick={async () => {
                const nonPassItems = (audit.inspectionItems || []).filter(item => item.status === 'O');
                const clauseDetails = nonPassItems.length > 0
                  ? nonPassItems.map((item, idx) => `${idx + 1}. بند [${item.questionNumber}]: ${item.questionFa || ''} (پاسخ: عدم انطباق/مشاهده)`).join('\n')
                  : 'عدم انطباق‌های مشخص شده در ممیزی پروانه کار';
                try {
                  const nc = await apiDb.createNonConformance({
                    title: `عدم انطباق ممیزی پروانه کار: پرمیت ${audit.permitNumber} (${audit.unitName || 'عمومی'})`,
                    sourceModule: 'ptw_audit',
                    sourceRecordId: String(audit.id),
                    sourceTitle: `ممیزی PTW #${audit.permitNumber}`,
                    unitName: audit.unitName,
                    riskLevel: (metrics.defectsCount || 0) >= 3 ? 'HIGH' : 'MEDIUM',
                    category: 'پروانه کار و ممیزی',
                    description: `ممیزی پروانه کار شماره ${audit.permitNumber} (نمره انطباق: ${metrics.complianceScore || 0}٪ | تعداد نواقص: ${metrics.defectsCount || 0})\nممیز: ${audit.hseAuditor?.auditorName || 'نماینده HSE'} | شرح کار: ${audit.workDescription || '-'}\n\nشرح بندهایی که دارای عدم انطباق هستند:\n${clauseDetails}`,
                    assignedToName: audit.signers?.workPerformerName || audit.signers?.areaResponsibleName || audit.hseAuditor?.auditorName,
                    status: 'REGISTERED'
                  });
                  setToastMsg(`عدم انطباق با کد رهگیری «${nc?.trackingCode || 'جدید'}» در سامانه CAPA ثبت گردید.`);
                  setTimeout(() => setToastMsg(null), 4000);
                } catch (e: any) {
                  setToastMsg(`خطا در ثبت: ${e?.message || e}`);
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition cursor-pointer"
              title="ارجاع عدم انطباق‌های این ممیزی به سامانه جامع CAPA"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>ثبت در CAPA</span>
            </button>

            <button
              onClick={() => onPrint(audit)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-xl border border-blue-200 dark:border-blue-800 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ فرم رسمی</span>
            </button>

            <button
              onClick={() => onEdit(audit)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold text-xs rounded-xl border border-amber-200 dark:border-amber-800 transition cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>ویرایش</span>
            </button>

            {onDelete && (
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                title="حذف این ممیزی"
              >
                <Trash2 className="w-4 h-4" />
                <span>حذف</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {toastMsg && (
          <div className="mx-5 mt-3 p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>{toastMsg}</span>
            </div>
            <button onClick={() => setToastMsg(null)} className="p-1 hover:bg-white/20 rounded-lg">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* Key Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center">
              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">موارد مطلوب (انطباق)</div>
              <div className="text-xl font-black font-mono text-emerald-800 dark:text-emerald-200 mt-0.5">{metrics.passedCount}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-center">
              <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300">نواقص مشاهده شده (عدم انطباق)</div>
              <div className="text-xl font-black font-mono text-rose-800 dark:text-rose-200 mt-0.5">{metrics.defectsCount}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">عدم شمول (نامرتبط)</div>
              <div className="text-xl font-black font-mono text-slate-800 dark:text-slate-200 mt-0.5">{metrics.naCount}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center">
              <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">شاخص انطباق ایمنی</div>
              <div className="text-xl font-black font-mono text-amber-800 dark:text-amber-200 mt-0.5">{metrics.complianceScore}%</div>
            </div>
          </div>

          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="font-bold text-slate-500">واحد و موقعیت مکانی:</div>
              <div className="font-black text-slate-900 dark:text-white text-sm">
                {audit.unitName} {audit.subUnitName ? `(${audit.subUnitName})` : ''}
              </div>
              <div className="text-slate-600 dark:text-slate-400">شیفت: {audit.shift}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="font-bold text-slate-500">زمان ممیزی:</div>
              <div className="font-black text-slate-900 dark:text-white text-sm font-mono">
                {audit.auditDate} - ساعت {audit.auditTime}
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                وضعیت سند: <span className="font-bold text-emerald-600">{audit.status === 'FINALIZED' ? 'نهایی' : 'پیش‌نویس'}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="font-bold text-slate-500">پروانه کار و شماره پرمیت:</div>
              <div className="font-black text-slate-900 dark:text-white text-sm font-mono flex items-center gap-1.5 flex-wrap">
                <span>{audit.permitNumber}</span>
                {audit.hasAttachedPermit && (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-sans font-black">
                    الحاقی: {audit.attachedPermitNumber || 'دارد'}
                  </span>
                )}
              </div>
              <div className="text-slate-600 dark:text-slate-400 text-xs">
                {audit.hasAttachedPermit ? (
                  <span>نوع الحاقی: {
                    audit.attachedPermitType === 'ConfinedSpace' ? 'ورود به فضای بسته (Confined)' :
                    audit.attachedPermitType === 'Excavation' ? 'حفاری و خاکبرداری' :
                    audit.attachedPermitType === 'ProcessMechanical' ? 'ایزولاسیون مکانیکی و فرآیندی' :
                    audit.attachedPermitType === 'ElectricalIsolation' ? 'ایزولاسیون الکتریکی LOTO' :
                    audit.attachedPermitType === 'Radiation' ? 'منابع پرتوزا (NDT)' :
                    audit.attachedPermitType === 'VehicleCrane' ? 'ورود جرثقیل / خودرو' :
                    audit.attachedPermitType === 'WorkingAtHeight' ? 'کار در ارتفاع' :
                    audit.attachedPermitTitleCustom || 'پروانه الحاقی'
                  }</span>
                ) : (
                  <span>پروانه منفرد بدون الحاقی</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="font-bold text-slate-500">کارشناس ممیزی‌کننده HSE:</div>
              <div className="font-black text-slate-900 dark:text-white text-sm">
                {audit.hseAuditor?.auditorName || audit.signers?.safetyUnitSignerName || 'نماینده واحد HSE'}
              </div>
              <div className="text-slate-600 dark:text-slate-400 text-[11px]">
                تایید شده در: {audit.hseAuditor?.signedAt || audit.auditDate}
              </div>
            </div>
          </div>

          {/* 4 Signers & Job Description */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="font-bold text-slate-500">مسئول محوطه: </span>
                <span className="font-black text-slate-800 dark:text-slate-200">{audit.signers?.areaResponsibleName || '-'}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500">کشیک ارشد: </span>
                <span className="font-black text-slate-800 dark:text-slate-200">{audit.signers?.seniorShiftSupervisorName || '-'}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500">مجری کار: </span>
                <span className="font-black text-slate-800 dark:text-slate-200">{audit.signers?.workPerformerName || '-'}</span>
              </div>
              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <span className="font-black text-emerald-800 dark:text-emerald-300">امضاکننده ایمنی پرمیت: </span>
                <span className="font-black text-emerald-900 dark:text-emerald-100">{audit.signers?.safetyUnitSignerName || '-'}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-bold text-slate-500">شرح کار: </span>
              <span className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">{audit.workDescription || '-'}</span>
            </div>
          </div>

          {/* Conditions, PPE & Precautions - DUAL SECTIONS (Selected vs Missed NC) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            
            {/* Hazards */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 bg-white dark:bg-slate-900 space-y-3">
              <div className="font-black text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>شرایط خطرناک محیط</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold">
                    {audit.environmentalHazards?.filter(h => h.selected).length || 0} در پروانه
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold">
                    {audit.environmentalHazards?.filter(h => h.missed).length || 0} عدم انطباق
                  </span>
                </div>
              </div>

              {/* Selected in Permit */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-500" />
                  <span>انتخاب‌شده در پروانه کار:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {audit.environmentalHazards?.filter(h => h.selected).length > 0 ? (
                    audit.environmentalHazards.filter(h => h.selected).map(h => (
                      <span key={h.id} className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${h.isCustom ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800'}`}>
                        ✓ {h.labelFa}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 text-[10px]">موردی در پروانه قید نشده</span>
                  )}
                </div>
              </div>

              {/* Missed / NC */}
              <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-black text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                  <span>الزامیِ انتخاب‌نشده (عدم انطباق NC):</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {audit.environmentalHazards?.filter(h => h.missed).length > 0 ? (
                    audit.environmentalHazards.filter(h => h.missed).map(h => (
                      <span key={h.id} className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${h.isCustom ? 'bg-rose-100 text-rose-900 border-rose-300' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'}`}>
                        ⚠️ {h.labelFa}
                      </span>
                    ))
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">عدم انطباق خطرات ثبت نشده</span>
                  )}
                </div>
              </div>

              {audit.customOtherHazardsText && (
                <div className="text-[10px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold">سایر خطرات: </span>{audit.customOtherHazardsText}
                </div>
              )}
            </div>

            {/* PPE */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 bg-white dark:bg-slate-900 space-y-3">
              <div className="font-black text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <HardHat className="w-4 h-4 text-blue-500" />
                  <span>وسایل استحفاظی فردی (PPE)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold">
                    {audit.requiredPpe?.filter(p => p.selected).length || 0} در پروانه
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold">
                    {audit.requiredPpe?.filter(p => p.missed).length || 0} عدم انطباق
                  </span>
                </div>
              </div>

              {/* Selected in Permit */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-500" />
                  <span>انتخاب‌شده در پروانه کار:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {audit.requiredPpe?.filter(p => p.selected).length > 0 ? (
                    audit.requiredPpe.filter(p => p.selected).map(p => (
                      <span key={p.id} className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${p.isCustom ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800'}`}>
                        ✓ {p.labelFa}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 text-[10px]">تجهیزی در پروانه قید نشده</span>
                  )}
                </div>
              </div>

              {/* Missed / NC */}
              <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-black text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                  <span>الزامیِ انتخاب‌نشده (عدم انطباق NC):</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {audit.requiredPpe?.filter(p => p.missed).length > 0 ? (
                    audit.requiredPpe.filter(p => p.missed).map(p => (
                      <span key={p.id} className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${p.isCustom ? 'bg-rose-100 text-rose-900 border-rose-300' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'}`}>
                        ⚠️ {p.labelFa}
                      </span>
                    ))
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">عدم انطباق PPE ثبت نشده</span>
                  )}
                </div>
              </div>

              {audit.customOtherPpeText && (
                <div className="text-[10px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold">سایر PPE: </span>{audit.customOtherPpeText}
                </div>
              )}
            </div>

            {/* Precautions */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 bg-white dark:bg-slate-900 space-y-3">
              <div className="font-black text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <ShieldAlert className="w-4 h-4 text-emerald-500" />
                  <span>پیش‌بینی‌ها و تمهیدات</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold">
                    {audit.precautionsTaken?.filter(p => p.selected).length || 0} در پروانه
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold">
                    {audit.precautionsTaken?.filter(p => p.missed).length || 0} عدم انطباق
                  </span>
                </div>
              </div>

              {/* Selected in Permit */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-500" />
                  <span>انتخاب‌شده در پروانه کار:</span>
                </div>
                <div className="space-y-0.5">
                  {audit.precautionsTaken?.filter(p => p.selected).length > 0 ? (
                    audit.precautionsTaken.filter(p => p.selected).map(p => (
                      <div key={p.id} className="flex items-center gap-1.5 text-[10px] text-blue-900 dark:text-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span>
                        <span className={`truncate ${p.isCustom ? 'font-bold' : ''}`}>{p.labelFa}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-400 text-[10px]">اقدامی در پروانه قید نشده</span>
                  )}
                </div>
              </div>

              {/* Missed / NC */}
              <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-black text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                  <span>الزامیِ انتخاب‌نشده (عدم انطباق NC):</span>
                </div>
                <div className="space-y-0.5">
                  {audit.precautionsTaken?.filter(p => p.missed).length > 0 ? (
                    audit.precautionsTaken.filter(p => p.missed).map(p => (
                      <div key={p.id} className="flex items-center gap-1.5 text-[10px] text-rose-800 dark:text-rose-300 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0"></span>
                        <span className="truncate">{p.labelFa}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">عدم انطباق تمهیدات ثبت نشده</span>
                  )}
                </div>
              </div>

              {audit.customOtherPrecautionsText && (
                <div className="text-[10px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold">سایر تمهیدات: </span>{audit.customOtherPrecautionsText}
                </div>
              )}
            </div>

          </div>

          {/* 30 Items Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-xs font-black text-slate-700 dark:text-slate-300 flex justify-between items-center">
              <span>نتایج چک‌لیست ۳۰ گانه ممیزی پروانه کار</span>
              <span className="font-mono text-[11px]">۳۰ سئوال کنترلی استاندارد</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 text-xs">
              {audit.inspectionItems.map((item) => {
                const isPassed = item.status === 'P' || item.status === 'PASS';
                const isDefect = item.status === 'O' || item.status === 'DEFECT';
                const isNA = item.status === '-' || item.status === 'NA';

                const statusBadge = 
                  isPassed ? { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', text: '✓ مطلوب (انطباق)' } :
                  isDefect ? { bg: 'bg-rose-100 text-rose-800 border-rose-300 font-black', text: '✗ دارای نقص (عدم انطباق)' } :
                  isNA ? { bg: 'bg-slate-100 text-slate-600 border-slate-300', text: '- عدم شمول (نامرتبط)' } :
                  { bg: 'bg-slate-50 text-slate-400 border-slate-200', text: 'ثبت نشده' };

                return (
                  <div key={item.id} className="p-3 flex items-start justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <div className="flex items-start gap-2.5 flex-1">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        {item.questionNumber}
                      </span>
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">{item.questionFa}</div>
                        {item.remarks && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            توضیحات / ملاحظات: {item.remarks}
                          </div>
                        )}
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border shrink-0 ${statusBadge.bg}`}>
                      {statusBadge.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audit Summary & Defects */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <div className="font-black text-slate-800 dark:text-slate-200">
              گزارش ممیزی و نتیجه‌گیری نهایی:
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {audit.auditSummaryReport || 'کلیه موارد ممیزی در محل بررسی شد.'}
            </p>
            {audit.defectsAndNonConformances && (
              <div className="mt-2 p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300">
                <span className="font-bold">نواقص ثبت شده: </span>
                <span>{audit.defectsAndNonConformances}</span>
              </div>
            )}
          </div>

          {/* Referral & Digital Signatures Workflow Section */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-slate-50 dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900 border border-indigo-200/80 dark:border-indigo-900/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 dark:border-indigo-900/50 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span>ماتریس تاییدات، ارجاعات و امضاهای دیجیتال سند</span>
                    {hasReferral && (
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                        activeReferral.overallStatus === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : activeReferral.overallStatus === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {activeReferral.overallStatus === 'COMPLETED' ? 'تکمیل و امضا شده' : activeReferral.overallStatus === 'REJECTED' ? 'رد شده' : 'در جریان اقدام'}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    کنترل اصالت و ردیابی وضعیت تاییدات سرپرستان، بازرسین و مسئولین مربوطه
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenReferral?.(audit)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{hasReferral ? 'ارجاع مجدد / گام جدید' : 'ایجاد گردش کار و ارجاع'}</span>
                </button>

                {hasReferral && (
                  <button
                    type="button"
                    onClick={() => onOpenWorkflowTracker?.(audit)}
                    className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <GitCommit className="w-3.5 h-3.5" />
                    <span>رهگیری لاگ کامل</span>
                  </button>
                )}
              </div>
            </div>

            {hasReferral ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {activeReferral.assignees.map((asg) => {
                    const isCompleted = asg.status === 'APPROVED' || asg.status === 'SIGNED';
                    const isRejected = asg.status === 'REJECTED';
                    const isPending = asg.status === 'PENDING';

                    return (
                      <div
                        key={asg.id}
                        className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 transition bg-white dark:bg-slate-800 ${
                          isCompleted
                            ? 'border-emerald-200 dark:border-emerald-800/80 shadow-xs'
                            : isRejected
                            ? 'border-rose-200 dark:border-rose-800/80 shadow-xs'
                            : 'border-amber-200 dark:border-amber-800/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                              {asg.userName}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {asg.userJobTitle || asg.userRole || 'مسئول'} {asg.department ? `(${asg.department})` : ''}
                            </div>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              isCompleted
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : isRejected
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            }`}
                          >
                            {asg.status === 'SIGNED'
                              ? 'امضا شده'
                              : asg.status === 'APPROVED'
                              ? 'تأیید شده'
                              : asg.status === 'REJECTED'
                              ? 'رد شده'
                              : 'در انتظار اقدام'}
                          </span>
                        </div>

                        {asg.comment && (
                          <div className="text-[10px] bg-slate-50 dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                            <span className="font-bold">نظر: </span>
                            {asg.comment}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-100 dark:border-slate-700">
                          <span>اقدام: {asg.actionType === 'SIGN' || asg.actionType === 'APPROVE_AND_SIGN' ? 'امضای دیجیتال' : 'بررسی و تایید'}</span>
                          <span>{asg.signedAtPersian || asg.statusDate || (asg.deadline ? `مهلت: ${asg.deadline}` : 'بدون مهلت')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 space-y-2 bg-white/60 dark:bg-slate-800/40 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-900/60 p-4">
                <Clock className="w-6 h-6 mx-auto text-indigo-400 opacity-80" />
                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                  هنوز برای این ممیزی ارجاع و گردش کار تایید/امضا ایجاد نشده است.
                </p>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                  با کلیک روی دکمه «ایجاد گردش کار و ارجاع»، می‌توانید این ممیزی را به سرپرستان واحد، مسئولین HSE و مدیران مجتمع جهت تایید، ثبت نظر و امضای دیجیتال ارجاع دهید.
                </p>
              </div>
            )}
          </div>

          {/* Attachments Section */}
          {audit.attachments && audit.attachments.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                  <Paperclip className="w-4 h-4 text-amber-500" />
                  <span>اسناد و تصاویر پیوست ممیزی (Attachments)</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold font-mono text-[10px]">
                    {audit.attachments.length} فایل
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  حجم کل: {formatFileSize(audit.attachments.reduce((acc, curr) => acc + (curr.size || 0), 0))}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                {audit.attachments.map((att) => {
                  const isImg = att.type === 'image' || att.mimeType.startsWith('image/');
                  const isPdf = att.type === 'pdf' || att.mimeType.includes('pdf');

                  return (
                    <div
                      key={att.id}
                      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 flex flex-col justify-between space-y-2 shadow-xs"
                    >
                      <div className="relative rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 aspect-video flex items-center justify-center">
                        {isImg ? (
                          <img
                            src={att.dataUrl}
                            alt={att.name}
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                            onClick={() => setPreviewAttachment(att)}
                          />
                        ) : isPdf ? (
                          <div className="flex flex-col items-center justify-center p-2 text-center">
                            <FileText className="w-6 h-6 text-rose-500 mb-1" />
                            <span className="text-[10px] font-bold text-rose-600 font-mono">PDF DOCUMENT</span>
                          </div>
                        ) : (
                          <FileText className="w-6 h-6 text-slate-400" />
                        )}

                        <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded text-[9px] font-bold text-white shadow-xs ${
                          isImg ? 'bg-amber-600' : 'bg-rose-600'
                        }`}>
                          {isImg ? 'عکس' : 'PDF'}
                        </span>
                      </div>

                      <div>
                        <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate" title={att.name}>
                          {att.name}
                        </div>
                        {att.description && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {att.description}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono mt-1">
                          <span>{formatFileSize(att.size)}</span>
                          <span>{att.uploadedAt}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-100 dark:border-slate-700">
                        {isImg ? (
                          <button
                            type="button"
                            onClick={() => setPreviewAttachment(att)}
                            className="p-1 text-slate-600 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 rounded transition cursor-pointer"
                            title="مشاهده تصویر"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <a
                            href={att.dataUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded transition cursor-pointer"
                            title="مشاهده سند PDF"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <a
                          href={att.dataUrl}
                          download={att.name}
                          className="p-1 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded transition cursor-pointer"
                          title="دانلود فایل"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-500">
            شناسه یکتای ممیزی: <code className="font-mono text-slate-700 dark:text-slate-300">{audit.id}</code>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrint(audit)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ فرم A4</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>

      </div>

      {/* Lightbox Preview */}
      {previewAttachment && (
        <div 
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewAttachment(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-slate-950 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2 text-white">
                <FileImage className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold truncate max-w-xs sm:max-w-md">
                  {previewAttachment.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({formatFileSize(previewAttachment.size)})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewAttachment.dataUrl}
                  download={previewAttachment.name}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
                  title="دانلود تصویر"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-2 bg-slate-950/80 flex items-center justify-center">
              <img
                src={previewAttachment.dataUrl}
                alt={previewAttachment.name}
                className="max-w-full max-h-[75vh] object-contain rounded-xl"
              />
            </div>

            {previewAttachment.description && (
              <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-xs text-slate-300">
                <span className="font-bold text-amber-400">توضیح: </span>
                <span>{previewAttachment.description}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Audit Deletion */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        audit={audit}
        onConfirm={() => {
          if (onDelete && audit) {
            onDelete(audit.id);
            setIsDeleteModalOpen(false);
            onClose();
          }
        }}
        onClose={() => setIsDeleteModalOpen(false)}
        isFa={isFa}
      />

    </div>
  );
}
