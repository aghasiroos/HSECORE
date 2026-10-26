import React, { useState, useEffect } from 'react';
import { Printer, AlertTriangle, ExternalLink, X } from 'lucide-react';
import { POPUP_BLOCKED_EVENT, PopupBlockedEventDetail } from '../../services/printService';

export const PrintNotificationModal: React.FC = () => {
  const [blockedDetail, setBlockedDetail] = useState<PopupBlockedEventDetail | null>(null);

  useEffect(() => {
    const handlePopupBlocked = (e: Event) => {
      const customEvent = e as CustomEvent<PopupBlockedEventDetail>;
      if (customEvent.detail) {
        setBlockedDetail(customEvent.detail);
      }
    };

    window.addEventListener(POPUP_BLOCKED_EVENT, handlePopupBlocked);
    return () => {
      window.removeEventListener(POPUP_BLOCKED_EVENT, handlePopupBlocked);
    };
  }, []);

  if (!blockedDetail) return null;

  const handleOpenManually = () => {
    if (blockedDetail.openAction) {
      blockedDetail.openAction();
    }
    setBlockedDetail(null);
  };

  return (
    <div className="fixed inset-0 z-100000 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-900 dark:text-white space-y-4">
        
        {/* Header Icon */}
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/30">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              مسدود شدن پنجره چاپ توسط مرورگر
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {blockedDetail.title}
            </p>
          </div>
          <button
            onClick={() => setBlockedDetail(null)}
            className="mr-auto p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Explanatory Body */}
        <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-2">
          <p>
            تنظیمات امنیتی مرورگر شما از باز شدن خودکار تب جدید برای چاپ سند جلوگیری کرده است.
          </p>
          <p className="text-[11px] bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
            💡 <strong>راهنما:</strong> با کلیک روی دکمه زیر، سند رسمی بلافاصله در صفحه جدید گشوده شده و کادر پرینتر برای شما باز خواهد شد.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setBlockedDetail(null)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            انصراف
          </button>

          <button
            type="button"
            onClick={handleOpenManually}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-blue-600/30 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>باز کردن و چاپ فرم در تب جدید</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </button>
        </div>

      </div>
    </div>
  );
};
