import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Info,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Check,
  X,
  Volume2,
  Bell,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Flame,
  Thermometer,
  FileText,
  AlertOctagon,
  Share2,
  PenTool,
  CheckSquare,
  ShieldCheck,
  ClipboardCheck,
  HeartPulse,
  Shield,
} from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { AppNotification } from '../../services/notificationService';

export const NotificationPopupModal: React.FC = () => {
  const {
    activePopupAlert,
    popupQueue,
    closePopup,
    acknowledgeAlert,
    markAsRead,
  } = useNotification();

  const [ackNote, setAckNote] = useState('');
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);
  const [showNoteField, setShowNoteField] = useState(false);

  if (!activePopupAlert) return null;

  const notif = activePopupAlert;
  const isCritical = notif.category === 'critical_hse' || notif.priority === 'critical';
  const isWarning = notif.category === 'warning' || notif.priority === 'high';
  const isError = notif.category === 'error';
  const isSuccess = notif.category === 'success';

  // Module info mapper
  const getModuleMeta = (mod: string) => {
    switch (mod?.toLowerCase()) {
      case 'referral':
      case 'referrals':
      case 'workflow':
        return { label: 'کارتابل ارجاعات و گردش اسناد', icon: Share2, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' };
      case 'signature':
      case 'signatures':
      case 'approval':
        return { label: 'امضای دیجیتال و تأییدیه رسمی', icon: PenTool, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800' };
      case 'ptw':
      case 'permit':
      case 'work_permit':
        return { label: 'پروانه کار (PTW)', icon: FileText, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' };
      case 'warnings':
      case 'warning':
        return { label: 'اخطار کتبی و عدم انطباق HSE', icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800' };
      case 'incidents':
      case 'incident':
        return { label: 'حوادث و شبه‌حوادث', icon: AlertOctagon, color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800' };
      case 'ptw-audit':
      case 'audit':
      case '5s':
        return { label: 'ممیزی تخصصی HSE و 5S', icon: CheckSquare, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' };
      case 'safety-unit':
      case 'safety':
      case 'inspections':
      case 'inspection':
        return { label: 'بازرسی‌های ایمنی و چک‌لیست‌ها', icon: ClipboardCheck, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800' };
      case 'health-env':
      case 'health':
      case 'medical':
        return { label: 'بهداشت حرفه‌ای و طب کار', icon: HeartPulse, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800' };
      case 'ppe':
        return { label: 'تجهیزات حفاظت فردی (PPE)', icon: ShieldCheck, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800' };
      case 'risk':
        return { label: 'ارزیابی و ماتریس ریسک', icon: Shield, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800' };
      case 'heat':
      case 'heat_stress':
        return { label: 'استرس حرارتی و پایش جوی', icon: Thermometer, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' };
      case 'fire-dept':
      case 'fire':
        return { label: 'آتش‌نشانی و تجهیزات', icon: Flame, color: 'text-red-500 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800' };
      default:
        return { label: 'سامانه مرکزی HSECORE', icon: Layers, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' };
    }
  };

  const moduleMeta = getModuleMeta(notif.sourceModule);
  const ModuleIcon = moduleMeta.icon;

  const handleNavigate = () => {
    markAsRead(notif.notifId);
    closePopup();
    if (notif.actionUrl) {
      if (notif.actionUrl.startsWith('#')) {
        window.location.hash = notif.actionUrl;
      } else {
        window.location.href = notif.actionUrl;
      }
    }
  };

  const handleAcknowledge = async () => {
    setIsSubmittingAck(true);
    try {
      await acknowledgeAlert(notif.notifId, ackNote.trim() || undefined);
      setAckNote('');
      setShowNoteField(false);
    } finally {
      setIsSubmittingAck(false);
    }
  };

  const handleSimpleDismiss = () => {
    markAsRead(notif.notifId);
    closePopup();
  };

  const formatPersianTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      style={{ direction: 'rtl' }}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
        onClick={notif.requiresAck ? undefined : handleSimpleDismiss}
      />

      {/* Central Modal Card */}
      <div
        className={`relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 transition-all duration-300 overflow-hidden z-10 animate-in zoom-in-95 ${
          isCritical
            ? 'border-rose-500/80 ring-4 ring-rose-500/20 shadow-rose-900/40'
            : isWarning
            ? 'border-amber-500/70 ring-4 ring-amber-500/15'
            : isError
            ? 'border-red-500/70 ring-4 ring-red-500/15'
            : isSuccess
            ? 'border-emerald-500/70 ring-4 ring-emerald-500/15'
            : 'border-blue-500/70 ring-4 ring-blue-500/15'
        }`}
      >
        {/* Top Emergency Visual Flasher Banner for Critical Alerts */}
        {isCritical && (
          <div className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white px-4 py-2 text-xs font-black flex items-center justify-between shadow-inner animate-pulse">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 animate-bounce" />
              <span>هشدار بحرانی ایمنی و بهداشت (HSE CRITICAL ALERT)</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] bg-rose-950/40 px-2 py-0.5 rounded-full">
              <Volume2 className="w-3 h-3" />
              <span>هشدار صوتی فعال</span>
            </div>
          </div>
        )}

        <div className="p-6 sm:p-7 space-y-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`p-3 rounded-2xl shrink-0 shadow-sm ${
                  isCritical
                    ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 ring-2 ring-rose-400'
                    : isWarning
                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 ring-2 ring-amber-400'
                    : isError
                    ? 'bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400'
                    : isSuccess
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                    : 'bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400'
                }`}
              >
                {isCritical ? (
                  <ShieldAlert className="w-7 h-7" />
                ) : isWarning ? (
                  <AlertTriangle className="w-7 h-7" />
                ) : isError ? (
                  <XCircle className="w-7 h-7" />
                ) : isSuccess ? (
                  <CheckCircle2 className="w-7 h-7" />
                ) : (
                  <Info className="w-7 h-7" />
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${moduleMeta.color}`}
                  >
                    <ModuleIcon className="w-3 h-3" />
                    <span>{moduleMeta.label}</span>
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isCritical
                        ? 'bg-rose-500 text-white'
                        : isWarning
                        ? 'bg-amber-500 text-white'
                        : isError
                        ? 'bg-red-500 text-white'
                        : isSuccess
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {isCritical
                      ? 'اولویت: بحرانی'
                      : notif.priority === 'high'
                      ? 'اولویت: بالا'
                      : notif.priority === 'low'
                      ? 'اولویت: عادی'
                      : 'اولویت: متوسط'}
                  </span>

                  {popupQueue.length > 1 && (
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold">
                      اعلان ۱ از {popupQueue.length}
                    </span>
                  )}
                </div>

                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-snug">
                  {notif.title}
                </h3>
              </div>
            </div>

            {/* Close button if not strictly requiring ack */}
            {!notif.requiresAck && (
              <button
                onClick={handleSimpleDismiss}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Body Content */}
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800/80 leading-relaxed text-sm text-slate-700 dark:text-slate-200">
              <p className="whitespace-pre-line font-medium leading-relaxed">{notif.body}</p>
            </div>

            {/* Optional Metadata Display */}
            {notif.metadata && Object.keys(notif.metadata).length > 0 && (
              <div className="p-3 bg-slate-100/70 dark:bg-slate-800/40 rounded-xl text-xs space-y-1.5 border border-slate-200/60 dark:border-slate-700/60">
                <span className="font-bold text-[11px] text-slate-500 dark:text-slate-400">اطلاعات تکمیلی رویداد:</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {Object.entries(notif.metadata).map(([key, val]) => (
                    <div key={key} className="flex justify-between border-b border-slate-200/40 dark:border-slate-700/40 pb-1">
                      <span className="text-slate-500">{key}:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Time & Sender info */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>زمان ثبت:</span>
                <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
                  {formatPersianTime(notif.createdAt)}
                </span>
              </div>
              {notif.sender && (
                <div className="text-[11px]">
                  <span>فرستنده: </span>
                  <span className="font-bold text-slate-600 dark:text-slate-300">{notif.sender}</span>
                </div>
              )}
            </div>

            {/* Optional Acknowledgment Note Field */}
            {notif.requiresAck && showNoteField && (
              <div className="space-y-1.5 pt-2 animate-in fade-in">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  توضیحات یا اقدام صورت‌گرفته (اختیاری):
                </label>
                <textarea
                  value={ackNote}
                  onChange={(e) => setAckNote(e.target.value)}
                  placeholder="مثال: دستور توقف کار صادر و نفرات به اتاق استراحت هدایت شدند..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {/* Action Link button */}
            {notif.actionUrl ? (
              <button
                type="button"
                onClick={handleNavigate}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 dark:text-blue-300 transition-colors cursor-pointer border border-blue-200 dark:border-blue-800 shadow-xs"
              >
                <ExternalLink className="w-4 h-4" />
                <span>
                  {notif.sourceModule === 'referral' || notif.sourceModule === 'signature' || notif.sourceModule === 'workflow'
                    ? 'مشاهده سند در کارتابل و اقدام'
                    : notif.sourceModule === 'ptw'
                    ? 'مشاهده پروانه کار'
                    : notif.sourceModule === 'warnings'
                    ? 'مشاهده اخطار کتبی'
                    : notif.sourceModule === 'incidents'
                    ? 'مشاهده گزارش حادثه'
                    : 'انتقال مستقیم به رکورد و ماژول'}
                </span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              {/* Mandatory or Optional Acknowledge Button */}
              {notif.requiresAck ? (
                <>
                  {!showNoteField && (
                    <button
                      type="button"
                      onClick={() => setShowNoteField(true)}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
                    >
                      افزودن یادداشت اقدام
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAcknowledge}
                    disabled={isSubmittingAck}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>{isSubmittingAck ? 'در حال ثبت...' : 'تأیید و اعلام آگاهی'}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSimpleDismiss}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors cursor-pointer shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>متوجه شدم</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
