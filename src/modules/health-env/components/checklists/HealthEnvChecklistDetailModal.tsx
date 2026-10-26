import React, { useState } from 'react';
import { 
  X, Printer, Edit2, CheckCircle2, AlertTriangle, MinusCircle, 
  Building2, Coffee, UtensilsCrossed, Ambulance, Bath,
  Calendar, Clock, MapPin, User, ShieldCheck, CheckCheck, 
  RotateCcw, AlertCircle, FileText, Camera, ArrowLeft, Send,
  GitCommit, Paperclip, Download, Eye, Repeat, Trash2
} from 'lucide-react';
import { 
  HealthEnvInspection, 
  HealthEnvChecklistType, 
  ChecklistItemVerdict 
} from '../../types/checklistTypes';
import { getReferralsForDocument } from '../../../../utils/referralHelper';
import { PrintDocumentSignaturesBox } from '../../../../components/referral/PrintDocumentSignaturesBox';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  inspection: HealthEnvInspection | null;
  onEdit: (inspection: HealthEnvInspection) => void;
  onOpenPrint: () => void;
  onApprove: (id: string, comment?: string) => Promise<any>;
  onReject: (id: string, comment: string) => Promise<any>;
  onOpenReferral?: (inspection: HealthEnvInspection) => void;
  onOpenWorkflowTracker?: (inspection: HealthEnvInspection) => void;
  onDelete?: (id: string) => void;
  currentUser?: any;
}

export default function HealthEnvChecklistDetailModal({
  isOpen,
  onClose,
  inspection,
  onEdit,
  onOpenPrint,
  onApprove,
  onReject,
  onOpenReferral,
  onOpenWorkflowTracker,
  onDelete,
  currentUser
}: Props) {
  const [filterVerdict, setFilterVerdict] = useState<'ALL' | 'FAIL' | 'PASS'>('ALL');
  const [showApprovalBox, setShowApprovalBox] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalComment, setApprovalComment] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  if (!isOpen || !inspection) return null;

  const docReferrals = getReferralsForDocument('AUDIT_CHECKLIST', inspection.id);
  const hasReferral = docReferrals.length > 0;

  const getIcon = (type: HealthEnvChecklistType) => {
    switch (type) {
      case 'premises-buildings': return <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'pantries-kitchenettes': return <Coffee className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case 'restaurant-dining': return <UtensilsCrossed className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'ambulance-equipment': return <Ambulance className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
      case 'workshop-restrooms': return <Bath className="w-5 h-5 text-sky-600 dark:text-sky-400" />;
      default: return <FileText className="w-5 h-5 text-slate-600" />;
    }
  };

  const getIntervalLabel = (interval?: string) => {
    switch (interval) {
      case 'DAILY': return 'روزانه';
      case 'MONTHLY': return 'ماهانه';
      case 'QUARTERLY': return 'سه‌ماهه (فصلی)';
      case 'SEMI_ANNUAL': return 'شش‌ماهه';
      case 'ANNUAL': return 'سالانه';
      default: return 'ماهانه';
    }
  };

  const filteredItems = inspection.items.filter(item => {
    if (filterVerdict === 'FAIL') return item.verdict === 'fail';
    if (filterVerdict === 'PASS') return item.verdict === 'pass';
    return true;
  });

  const failedItems = inspection.items.filter(item => item.verdict === 'fail');

  const handleApprovalSubmit = async () => {
    if (approvalAction === 'reject' && !approvalComment.trim()) {
      setApprovalError('در صورت رد گزارش، ذکر دلیل و توضیحات الزامی است.');
      return;
    }
    setApprovalError(null);
    setIsSubmittingApproval(true);
    try {
      if (approvalAction === 'approve') {
        await onApprove(inspection.id, approvalComment);
      } else {
        await onReject(inspection.id, approvalComment);
      }
      setShowApprovalBox(false);
      setApprovalComment('');
    } catch (err: any) {
      setApprovalError(err?.message || 'خطا در ثبت وضعیت تأیید');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" dir="rtl">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center border border-teal-500/20">
              {getIcon(inspection.checklistTypeId)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {inspection.title}
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  inspection.approvalStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                  inspection.approvalStatus === 'REJECTED' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                  'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                }`}>
                  {inspection.approvalStatus === 'APPROVED' ? 'تأییدشده رسمی' :
                   inspection.approvalStatus === 'REJECTED' ? 'رد شده' : 'در انتظار بررسی'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                کد سند: {inspection.id} | {inspection.checklistTypeNameFa}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Referral Button */}
            <button
              type="button"
              onClick={() => onOpenReferral?.(inspection)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-indigo-200 dark:border-indigo-800"
              title="ارجاع این چک‌لیست جهت بررسی و امضای الکترونیک مسئولان"
            >
              <Send className="w-3.5 h-3.5" />
              <span>ارجاع و امضا</span>
            </button>

            {/* Workflow Tracker Button */}
            {hasReferral && (
              <button
                type="button"
                onClick={() => onOpenWorkflowTracker?.(inspection)}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-purple-200 dark:border-purple-800"
                title="مشاهده گردش کار ارجاع و سوابق امضاها"
              >
                <GitCommit className="w-3.5 h-3.5" />
                <span>گردش کار</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenPrint}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>چاپ A4</span>
            </button>
            
            <button
              type="button"
              onClick={() => onEdit(inspection)}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>ویرایش</span>
            </button>

            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(inspection.id)}
                className="p-2 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                title="حذف چک‌لیست"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">تاریخ و ساعت:</span>
              <strong className="text-slate-800 dark:text-slate-200 font-mono">
                {inspection.inspectionDate} - {inspection.inspectionTime}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">موقعیت / ساختمان:</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {inspection.areaLocation || '-'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">واحد / اداره:</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {inspection.unit} ({inspection.site})
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">شناسه تجهیز / تسهیلات:</span>
              <strong className="text-slate-800 dark:text-slate-200 font-mono">
                {inspection.equipmentOrFacilityCode || '-'}
              </strong>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">کارشناس / نماینده واحد:</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {inspection.inspectorName}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">سرپرست / مسئول واحد:</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {inspection.supervisorName || '-'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">رئیس مرکز HSE:</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {inspection.hseManagerName || inspection.approvedBy || '-'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">نوع زمان‌بندی:</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {inspection.scheduleType === 'ADHOC' ? 'موردی (بر حسب نیاز)' : 'دوره‌ای و زمان‌بندی‌شده'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">تناوب و موعد بعدی:</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {inspection.scheduleType === 'ADHOC' 
                  ? 'فاقد تکرار دوره‌ای اجباری' 
                  : `${getIntervalLabel(inspection.periodicInterval)} ${inspection.nextInspectionDate ? `(${inspection.nextInspectionDate})` : ''}`
                }
              </strong>
            </div>
          </div>

          {/* Compliance & Score Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-center">
              <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300 block">درصد انطباق بهداشتی</span>
              <span className="text-2xl font-black text-teal-800 dark:text-teal-200 font-mono">
                {inspection.scorePercent}%
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 block">موارد مطلوب</span>
              <span className="text-2xl font-black text-emerald-800 dark:text-emerald-200 font-mono">
                {inspection.passedCount}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-center">
              <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 block">موارد عدم انطباق (نواقص)</span>
              <span className="text-2xl font-black text-rose-800 dark:text-rose-200 font-mono">
                {inspection.failedCount}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-[11px] font-bold text-slate-500 block">نامرتبط / کل موارد</span>
              <span className="text-2xl font-black text-slate-700 dark:text-slate-300 font-mono">
                {inspection.naCount} / {inspection.totalItems}
              </span>
            </div>
          </div>

          {/* Attachments Section */}
          {inspection.attachments && inspection.attachments.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-teal-600" />
                  <h3 className="text-xs font-black text-slate-800 dark:text-white">
                    فایل‌های پیوست و اسناد مرتبط ({inspection.attachments.length} مورد)
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400">ذخیره‌شده در پایگاه داده پایدار</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {inspection.attachments.map((att) => {
                  const isPdf = att.type === 'pdf' || att.name.toLowerCase().endsWith('.pdf');
                  return (
                    <div 
                      key={att.id}
                      className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isPdf 
                            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' 
                            : 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400'
                        }`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate" title={att.name}>
                            {att.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {Math.round(att.size / 1024)} KB
                          </span>
                        </div>
                      </div>
                      {att.dataUrl && (
                        <a
                          href={att.dataUrl}
                          download={att.name}
                          className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/40 transition"
                          title="دانلود فایل"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Photos Gallery */}
          {inspection.photos && inspection.photos.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-black text-slate-800 dark:text-white">
                  مستندات تصویری و عکس‌های ثبت‌شده ({inspection.photos.length})
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {inspection.photos.map(p => (
                  <div key={p.id} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black aspect-video flex items-center justify-center relative group">
                    <img src={p.url} alt={p.fileName} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <a href={p.url} target="_blank" rel="noreferrer" className="p-2 bg-white/90 text-slate-900 rounded-lg text-xs font-bold">
                        نمایش تصویر
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items / CAPA Table (if any defects) */}
          {failedItems.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>نواقص بهداشتی و اقدامات اصلاحی لازم (CAPA)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {failedItems.map((item, idx) => (
                  <div key={item.itemId || idx} className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                        {item.category}
                      </span>
                      {item.dueDate && (
                        <span className="text-[10px] font-mono font-bold text-rose-700 dark:text-rose-400">
                          مهلت: {item.dueDate}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-black text-slate-900 dark:text-white">
                      {item.title}
                    </div>
                    <div className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/30">
                      <strong>شرح نقص: </strong>
                      {item.defectDescription || item.comment || 'نقص بهداشتی مشاهده شد'}
                    </div>
                    {item.correctiveAction && (
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        <strong>اقدام اصلاحی: </strong>
                        {item.correctiveAction}
                      </div>
                    )}
                    {item.responsiblePerson && (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>مسئول پیگیری: {item.responsiblePerson}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checklist Evaluation Items List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 dark:text-white">
                جزئیات ارزیابی تمام آیتم‌ها ({inspection.items.length})
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFilterVerdict('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    filterVerdict === 'ALL'
                      ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  همه ({inspection.items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterVerdict('FAIL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    filterVerdict === 'FAIL'
                      ? 'bg-rose-600 text-white'
                      : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                  }`}
                >
                  نامطلوب ({inspection.failedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterVerdict('PASS')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    filterVerdict === 'PASS'
                      ? 'bg-emerald-600 text-white'
                      : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                  }`}
                >
                  مطلوب ({inspection.passedCount})
                </button>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {filteredItems.map((item, idx) => (
                <div key={item.itemId || idx} className="p-3.5 flex items-start justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {item.category}
                      </span>
                      {item.standardRef && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {item.standardRef}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white pr-7">
                      {item.title}
                    </div>
                    {item.requirement && (
                      <div className="text-[11px] text-slate-500 pr-7">
                        {item.requirement}
                      </div>
                    )}
                    {(item.defectDescription || item.comment) && (
                      <div className="text-xs text-slate-700 dark:text-slate-300 pr-7 pt-1">
                        <strong>ملاحظات: </strong>
                        {item.defectDescription || item.comment}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 pt-1">
                    {item.verdict === 'pass' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40">
                        <CheckCircle2 className="w-3.5 h-3.5" /> مطلوب
                      </span>
                    )}
                    {item.verdict === 'fail' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-lg border border-rose-200/60 dark:border-rose-800/40">
                        <AlertTriangle className="w-3.5 h-3.5" /> نامطلوب
                      </span>
                    )}
                    {item.verdict === 'na' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                        <MinusCircle className="w-3.5 h-3.5" /> نامرتبط
                      </span>
                    )}
                    {!item.verdict && (
                      <span className="text-xs text-slate-400">ارزیابی‌نشده</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Digital Signatures Matrix */}
          <div>
            <PrintDocumentSignaturesBox
              documentType="AUDIT_CHECKLIST"
              documentId={inspection.id}
              isFa={true}
              title="ماتریس تاییدات، امضاهای الکترونیکی و احراز اصالت سند"
              fallbackSignatories={[
                { roleTitle: 'کارشناس / نماینده واحد', subTitle: 'کارشناس بهداشت و محیط زیست', defaultName: inspection.inspectorName || 'کارشناس بهداشت' },
                { roleTitle: 'سرپرست / مسئول واحد', subTitle: 'مسئول هماهنگی و رفع نقص', defaultName: inspection.supervisorName || 'سرپرست واحد' },
                { roleTitle: 'رئیس مرکز HSE', subTitle: 'ریاست بهداشت، ایمنی و محیط زیست', defaultName: inspection.hseManagerName || inspection.approvedBy || 'رئیس مرکز HSE' }
              ]}
            />
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-500">
          <div>
            تاریخ آخرین ویرایش: {new Date(inspection.updatedAt).toLocaleDateString('fa-IR')}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            بستن
          </button>
        </div>

      </div>
    </div>
  );
}
