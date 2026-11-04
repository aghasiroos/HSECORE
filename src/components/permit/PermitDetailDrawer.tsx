import React, { useState } from 'react';
import {
  X,
  FileText,
  RefreshCw,
  History,
  Clock,
  User,
  Wind,
  Box,
  Shovel,
  ArrowLeft,
  Trash2,
  Lock,
  Pencil,
  Send,
  GitCommit,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { WorkPermit, PermitWorkflowStatus, UserProfile } from '../../types';
import { PERMIT_CATEGORIES_CONFIG } from './PermitTypes';
import { PermitInspectionComparison } from './PermitInspectionComparison';
import { PermitAuditLogViewer } from './PermitAuditLogViewer';
import { getPermitFieldConfigsSync } from './services/permitFieldConfigService';
import { getPermitReferralSignerStatus } from '../../utils/referralHelper';

interface PermitDetailDrawerProps {
  permit: WorkPermit;
  currentUser: UserProfile;
  isFa: boolean;
  initialTab?: 'details' | 'inspection' | 'audit';
  onClose: () => void;
  onUpdateStatus: (newStatus: PermitWorkflowStatus, actionName: string, details: string, extraData?: Partial<WorkPermit>) => void;
  onOpenReInspection?: () => void;
  onOpenPrintModal: () => void;
  onOpenQrModal?: () => void;
  onOpenReferral?: (permit: WorkPermit) => void;
  onOpenWorkflowTracker?: (permit: WorkPermit) => void;
  onDeletePermit?: (permitId: string) => void;
  onEditPermit?: (permit: WorkPermit) => void;
}

export const PermitDetailDrawer: React.FC<PermitDetailDrawerProps> = ({
  permit,
  currentUser,
  isFa,
  initialTab = 'details',
  onClose,
  onUpdateStatus,
  onOpenReInspection,
  onOpenPrintModal,
  onOpenQrModal,
  onOpenReferral,
  onOpenWorkflowTracker,
  onDeletePermit,
  onEditPermit
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'inspection' | 'audit'>(initialTab);

  const categoryConfig = PERMIT_CATEGORIES_CONFIG[permit.permitCategory] || {
    titleFa: permit.permitCategory || permit.permitType,
    titleEn: permit.permitCategory || permit.permitType,
    badgeColor: 'bg-slate-100 text-slate-800'
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-end z-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl bg-slate-50 dark:bg-slate-900 h-full flex flex-col shadow-2xl border-r border-slate-200 dark:border-slate-800 animate-in slide-in-from-left duration-300"
        dir={isFa ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-extrabold text-blue-600 dark:text-blue-400">
                  {permit.serialNumber}
                </span>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${categoryConfig.badgeColor}`}>
                  {isFa ? categoryConfig.titleFa : categoryConfig.titleEn}
                </span>
                {permit.status === 'Draft' && (
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-400 dark:border-amber-700 flex items-center gap-1 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                    {isFa ? 'پیش‌نویس' : 'Draft'}
                  </span>
                )}
                {permit.riskLevel && (
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                    permit.riskLevel === 'Critical' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                    permit.riskLevel === 'High' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    ریسک: {permit.riskLevel}
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white mt-1 line-clamp-1">
                {permit.description}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Edit Permit / Complete Draft */}
            {onEditPermit && (
              permit.status === 'Draft' ? (
                <button
                  onClick={() => onEditPermit(permit)}
                  title={isFa ? 'تکمیل و صدور رسمی پروانه کار پیش‌نویس' : 'Complete & Issue Draft Permit'}
                  className="px-3 py-1.5 rounded-xl border border-amber-400 dark:border-amber-600 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{isFa ? 'تکمیل و صدور پیش‌نویس' : 'Complete Draft'}</span>
                </button>
              ) : currentUser.role === 'Administrator' ? (
                <button
                  onClick={() => onEditPermit(permit)}
                  title={isFa ? 'ویرایش پروانه کار (ویژه مدیر اصلی سامانه)' : 'Edit Permit (Admin Only)'}
                  className="p-2 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => onEditPermit(permit)}
                  title={isFa ? 'ویرایش پروانه کار فقط برای مدیر اصلی سامانه فعال است' : 'Edit restricted to Administrator'}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 opacity-60 hover:text-amber-500 cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )
            )}

            {/* Delete Permit (Admin Only) */}
            {onDeletePermit && (
              currentUser.role === 'Administrator' ? (
                <button
                  onClick={() => {
                    onDeletePermit(permit.id);
                    onClose();
                  }}
                  title={isFa ? 'حذف پروانه کار (ویژه مدیر اصلی)' : 'Delete Permit (Admin Only)'}
                  className="p-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => onDeletePermit(permit.id)}
                  title={isFa ? 'حذف فقط برای مدیر اصلی سامانه فعال است' : 'Delete restricted to Administrator'}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 opacity-60 hover:text-amber-500 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                </button>
              )
            )}

            {/* Referral Button */}
            {onOpenReferral && (
              <button
                onClick={() => onOpenReferral(permit)}
                title={isFa ? 'ارجاع پروانه جهت بررسی، تأیید و امضا' : 'Refer Permit for Review / Signature'}
                className="px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white transition cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isFa ? 'ارجاع و امضا' : 'Refer'}</span>
              </button>
            )}

            {/* Workflow Tracker Button */}
            {onOpenWorkflowTracker && (
              <button
                onClick={() => onOpenWorkflowTracker(permit)}
                title={isFa ? 'رهگیری گردش کار و امضاهای پروانه' : 'Track Referral Workflow'}
                className="p-2 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition cursor-pointer"
              >
                <GitCommit className="w-4 h-4" />
              </button>
            )}

            {/* Print Master */}
            <button
              onClick={onOpenPrintModal}
              title={isFa ? 'چاپ رسمی پروانه' : 'Print Permit'}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
            >
              <FileText className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white dark:bg-slate-900 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 px-3.5 border-b-2 font-bold text-xs flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'details'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{isFa ? 'شناسنامه و مشخصات پروانه' : 'Permit Details'}</span>
          </button>

          <button
            onClick={() => setActiveTab('inspection')}
            className={`py-3 px-3.5 border-b-2 font-bold text-xs flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'inspection'
                ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>{isFa ? 'بازرسی مجدد و مقایسه دوره‌ها' : 'Re-Inspections & History'}</span>
            {permit.inspectionCycles && permit.inspectionCycles.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 text-[10px]">
                {permit.inspectionCycles.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-3.5 border-b-2 font-bold text-xs flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'audit'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{isFa ? 'سوابق و لاگ ممیزی (Audit Log)' : 'Audit Trail'}</span>
            {permit.auditLogs && permit.auditLogs.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[10px]">
                {permit.auditLogs.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Draft Notification Banner */}
          {permit.status === 'Draft' && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border-2 border-blue-400/80 dark:border-blue-700/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 rounded-xl shadow-xs shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-amber-950 dark:text-amber-200">
                      {isFa ? 'این پروانه کار در وضعیت «پیش‌نویس» ذخیره شده است' : 'This permit is saved as Draft'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-600">
                      DRAFT
                    </span>
                  </div>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300 mt-1">
                    {isFa
                      ? 'این پروانه به عنوان پیش‌نویس ذخیره گردیده و هنوز رسمیت قانونی ندارد. جهت تکمیل اطلاعات و صدور رسمی بر روی دکمه تکمیل کلیک نمایید.'
                      : 'This permit is saved as draft and not yet officially issued. Click Complete to issue.'}
                  </p>
                </div>
              </div>
              {onEditPermit && (
                <button
                  onClick={() => onEditPermit(permit)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition shrink-0 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{isFa ? 'تکمیل و صدور رسمی' : 'Complete & Issue'}</span>
                </button>
              )}
            </div>
          )}

          {/* TAB 1: FULL SPECS & DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-6 text-xs">
              {/* Primary Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] font-semibold">تاریخ صدور و اعتبار</span>
                  <div className="font-bold text-slate-900 dark:text-white text-sm">
                    {permit.year}/{permit.month}/{permit.day}
                  </div>
                  <div className="text-slate-500 font-mono text-[11px]">
                    ساعت: {permit.startHour} تا {permit.endHour} ({permit.workShift === 'Morning' ? 'صبح' : permit.workShift === 'Evening' ? 'عصر' : 'شب'})
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] font-semibold">محل اجرای عملیات</span>
                  <div className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">
                    {permit.location}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    واحد: {permit.department || 'فرآیندی / عمومی'}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] font-semibold">تجهیز و شماره دستور کار</span>
                  <div className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">
                    {permit.equipmentName || 'سازه و خطوط فرآیندی'}
                  </div>
                  <div className="text-slate-500 font-mono text-[11px]">
                    تگ: {permit.equipmentNumber || '—'} | WO: {permit.woNumber || '—'}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] font-semibold">حضور ناظر ایمنی و استندبای</span>
                  <div className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">
                    {permit.standByHse || 'افسر کشیک HSE'}
                  </div>
                  <div className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                    بازرسی ایمنی: {permit.safetyInspection === 'Approved' ? 'تأیید شده' : 'نیازمند تایید'}
                  </div>
                </div>
              </div>

              {/* Holiday Audit Card if permit was issued on a holiday */}
              {(permit.holidayAuditTrail || (permit as any).formData?.holidayAuditTrail) && (
                <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 font-black text-xs text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>سوابق ممیزی و تأییدیه صدور پروانه کار گرم در روز تعطیل (کشیک ارشد)</span>
                  </div>
                  {(() => {
                    const audit = permit.holidayAuditTrail || (permit as any).formData?.holidayAuditTrail;
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-amber-950 dark:text-amber-100 pt-1 border-t border-amber-200 dark:border-amber-800/60">
                        <div>مناسبت تعطیل: <strong>{audit.holidayTitle || 'تعطیل رسمی'} ({audit.dateShamsi || '—'})</strong></div>
                        <div>زمان ثبت تأییدیه: <strong>{audit.timeTehran || '—'} (Asia/Tehran)</strong></div>
                        <div>نام صادرکننده: <strong>{audit.issuerName || '—'} ({audit.issuerPersonnelCode || '—'})</strong></div>
                        <div>سمت شغلی استعلام‌شده: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{audit.issuerVerifiedJobTitle || 'کشیک ارشد'}</strong></div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 4-Tier Approvals & Signatures (مطابق با فرم رسمی و تصویر پیوست) */}
              {(() => {
                const issuerStatus = getPermitReferralSignerStatus(permit.id, 'issuer', 'کشیک ارشد تولید / صادر کننده', permit.signatures4Tier?.issuer?.name || permit.responsibles?.unitSupervisor);
                const executorStatus = getPermitReferralSignerStatus(permit.id, 'executor', 'مسئول انجام کار', permit.signatures4Tier?.executor?.name || permit.responsibles?.jobExecutor || permit.qualifiedPersonnel);
                const areaStatus = getPermitReferralSignerStatus(permit.id, 'areaSupervisor', 'مسئول محوطه', permit.signatures4Tier?.areaSupervisor?.name || permit.responsibles?.unitSupervisor);
                const safetyStatus = getPermitReferralSignerStatus(permit.id, 'safetyUnit', 'واحد ایمنی', permit.signatures4Tier?.safetyUnit?.name || permit.responsibles?.safetyUnit || permit.standByHse);

                const tierBoxes = [
                  { key: 'issuer', title: 'کشیک ارشد تولید / صادر کننده', statusInfo: issuerStatus, fallbackTime: permit.signatures4Tier?.issuer?.time || permit.startHour },
                  { key: 'executor', title: 'مسئول انجام کار', statusInfo: executorStatus, fallbackTime: permit.signatures4Tier?.executor?.time || permit.startHour },
                  { key: 'areaSupervisor', title: 'مسئول محوطه', statusInfo: areaStatus, fallbackTime: permit.signatures4Tier?.areaSupervisor?.time },
                  { key: 'safetyUnit', title: 'واحد ایمنی (HSE)', statusInfo: safetyStatus, fallbackTime: permit.signatures4Tier?.safetyUnit?.time }
                ];

                return (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-500" />
                        <span>تأییدیه‌ها و امضاهای چهارگانه پروانه کار</span>
                      </h4>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        همگام‌سازی خودکار با ارجاع و امضا
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                      {tierBoxes.map((tb, idx) => {
                        const s = tb.statusInfo;
                        const isApp = s.status === 'APPROVED';
                        const isRej = s.status === 'REJECTED';
                        const isPend = s.status === 'PENDING';

                        return (
                          <div 
                            key={tb.key} 
                            className={`p-3 rounded-xl space-y-2 flex flex-col justify-between border transition-all ${
                              isApp
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                                : isRej
                                  ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800'
                                  : isPend
                                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">
                                  {tb.title}
                                </span>
                                {isApp ? (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded shrink-0">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    تأییدشده
                                  </span>
                                ) : isRej ? (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950 px-1.5 py-0.2 rounded shrink-0">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    ردشده
                                  </span>
                                ) : isPend ? (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-1.5 py-0.2 rounded shrink-0">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    در انتظار
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-slate-400 font-mono">مرحله {idx + 1}</span>
                                )}
                              </div>

                              <div className="font-bold text-xs text-slate-900 dark:text-white mt-1">
                                {s.fullName || '—'}
                              </div>

                              {s.jobTitle && s.jobTitle !== tb.title && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                  سمت: {s.jobTitle}
                                </div>
                              )}
                            </div>

                            {s.signatureImage && (
                              <div className="h-8 flex items-center justify-center bg-white dark:bg-slate-900 border border-dashed border-emerald-300 rounded my-1">
                                <img src={s.signatureImage} alt="امضا" className="max-h-7 max-w-full object-contain" />
                              </div>
                            )}

                            <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-1 mt-auto">
                              <span>تاریخ و ساعت:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300 truncate mr-1">
                                {s.signedAtPersian || (s.time ? s.time : tb.fallbackTime || '—')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Dynamic Custom Fields */}
              {permit.customFields && Object.keys(permit.customFields).length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span>فیلدها و الزامات تکمیلی پروانه</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                    {Object.entries(permit.customFields).map(([k, v]) => {
                      const fieldDef = getPermitFieldConfigsSync().find(f => f.key === k || f.id === k);
                      const label = fieldDef?.labelFa || k;
                      return (
                        <div key={k} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                          <span className="text-[10px] text-slate-400 font-semibold block">{label}:</span>
                          <div className="font-bold text-xs text-slate-900 dark:text-white mt-0.5">
                            {typeof v === 'boolean' ? (v ? 'بله / تایید شد' : 'خیر') : String(v)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Atmospheric Gas Testing Section */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <Wind className="w-4 h-4 text-blue-500" />
                    <span>تست گاز و سلامت اتمسفر (Atmospheric Gas Test)</span>
                  </h4>
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                    permit.gasTestRequired === 'Completed'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {permit.gasTestRequired === 'Completed' ? 'تست گاز انجام شد' : 'تست گاز الزامی نیست'}
                  </span>
                </div>

                {permit.gasTest ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-center">
                      <span className="text-slate-400 text-[11px] block">اکسیژن O2</span>
                      <span className="text-base font-extrabold font-mono text-emerald-600">{permit.gasTest.o2}%</span>
                      <span className="text-[9px] text-slate-400 block">استاندارد: 19.5-23.5%</span>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-center">
                      <span className="text-slate-400 text-[11px] block">گازهای قابل اشتعال LEL</span>
                      <span className="text-base font-extrabold font-mono text-emerald-600">{permit.gasTest.lel}%</span>
                      <span className="text-[9px] text-slate-400 block">حد مجاز: &lt; 5%</span>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-center">
                      <span className="text-slate-400 text-[11px] block">سولفید هیدروژن H2S</span>
                      <span className="text-base font-extrabold font-mono text-slate-700 dark:text-slate-300">{permit.gasTest.h2s} ppm</span>
                      <span className="text-[9px] text-slate-400 block">حد مجاز: &lt; 10 ppm</span>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-center">
                      <span className="text-slate-400 text-[11px] block">مونوکسید کربن CO</span>
                      <span className="text-base font-extrabold font-mono text-slate-700 dark:text-slate-300">{permit.gasTest.co} ppm</span>
                      <span className="text-[9px] text-slate-400 block">حد مجاز: &lt; 25 ppm</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">برای این نوع عملیات تست گاز ثبت نشده است.</p>
                )}
              </div>

              {/* Category-Specific Supplementary Details */}
              {permit.excavationDetails && (
                <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-blue-200 dark:border-blue-900/50 p-5 space-y-2">
                  <h4 className="font-extrabold text-amber-900 dark:text-amber-300 text-sm flex items-center gap-2">
                    <Shovel className="w-4 h-4" />
                    <span>الزامات تکمیلی پروانه حفاری و کانال‌کنی</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                    <div>عمق حفاری: <strong>{permit.excavationDetails.depthMeter} متر</strong></div>
                    <div>نوع خاک: <strong>{permit.excavationDetails.soilType}</strong></div>
                    <div>استفاده از کابل‌یاب: <strong>{permit.excavationDetails.cableDetectorUsed ? 'بله' : 'خیر'}</strong></div>
                    <div>شمع‌کوبی و حفاظت: <strong>{permit.excavationDetails.shoringRequired ? 'الزامی' : 'خیر'}</strong></div>
                  </div>
                </div>
              )}

              {permit.confinedSpaceDetails && (
                <div className="bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl border border-purple-200 dark:border-purple-900/50 p-5 space-y-2">
                  <h4 className="font-extrabold text-purple-900 dark:text-purple-300 text-sm flex items-center gap-2">
                    <Box className="w-4 h-4" />
                    <span>الزامات تکمیلی ورود به فضای بسته (Confined Space)</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                    <div>نام فضا: <strong>{permit.confinedSpaceDetails.spaceName}</strong></div>
                    <div>نگهبان ورودی: <strong>{permit.confinedSpaceDetails.standbyWatcherName}</strong></div>
                    <div>روش تهویه: <strong>{permit.confinedSpaceDetails.ventilationMethod}</strong></div>
                    <div>طرح نجات و امداد: <strong>{permit.confinedSpaceDetails.rescuePlanAttached ? 'پیوست دارد' : 'ندارد'}</strong></div>
                  </div>
                </div>
              )}

              {/* Renewals History */}
              {permit.renewals && permit.renewals.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>سوابق تمدید اعتبار پروانه ({permit.renewals.length} مورد)</span>
                  </h4>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {permit.renewals.map((r, i) => (
                      <div key={i} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">تمدید تا ساعت {r.extendedUntil}</span>
                          <span className="text-slate-400 mr-2 text-[11px]">({r.reason || 'ادامه کار'})</span>
                        </div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          تأییدکننده: {r.approvedBy} | {r.date}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RE-INSPECTION & COMPARISON */}
          {activeTab === 'inspection' && (
            <PermitInspectionComparison
              permit={permit}
              isFa={isFa}
            />
          )}

          {/* AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <PermitAuditLogViewer
              permit={permit}
              isFa={isFa}
            />
          )}
        </div>
      </div>
    </div>
  );
};
