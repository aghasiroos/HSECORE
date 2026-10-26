import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, X } from 'lucide-react';

export interface FinalSubmitOptions {
  title?: string;
  message?: string;
  subMessage?: string;
  confirmText?: string;
  cancelText?: string;
  isFa?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface FinalSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: FinalSubmitOptions | null;
}

export const DEFAULT_FINAL_SUBMIT_MESSAGE_FA = 'آیا از ثبت نهایی اطلاعات اطمینان دارید؟ پس از ثبت نهایی امکان ویرایش وجود نخواهد داشت.';
export const DEFAULT_FINAL_SUBMIT_MESSAGE_EN = 'Are you sure you want to finalize this submission? Once finalized, edits will be permanently locked.';

export const DEFAULT_CONFIRM_TEXT_FA = 'تأیید و ثبت نهایی';
export const DEFAULT_CONFIRM_TEXT_EN = 'Confirm & Finalize';

export const DEFAULT_CANCEL_TEXT_FA = 'انصراف';
export const DEFAULT_CANCEL_TEXT_EN = 'Cancel';

export const FinalSubmitConfirmModal: React.FC<FinalSubmitModalProps> = ({
  isOpen,
  onClose,
  options
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !options) return null;

  const isFa = options.isFa !== false;
  const title = options.title || (isFa ? 'تأیید ثبت نهایی' : 'Confirm Final Submission');
  const message = options.message || (isFa ? DEFAULT_FINAL_SUBMIT_MESSAGE_FA : DEFAULT_FINAL_SUBMIT_MESSAGE_EN);
  const confirmText = options.confirmText || (isFa ? DEFAULT_CONFIRM_TEXT_FA : DEFAULT_CONFIRM_TEXT_EN);
  const cancelText = options.cancelText || (isFa ? DEFAULT_CANCEL_TEXT_FA : DEFAULT_CANCEL_TEXT_EN);

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await options.onConfirm();
      onClose();
    } catch (error) {
      console.error('Final submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    if (options.onCancel) {
      options.onCancel();
    }
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      dir={isFa ? 'rtl' : 'ltr'}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        id="final-submit-confirm-modal"
      >
        {/* Header Icon & Title */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 shadow-sm">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 leading-tight">
                {title}
              </h3>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
                title={cancelText}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              {isFa ? 'هشدار عدم امکان ویرایش مجدد' : 'Permanent Record Locking Notice'}
            </p>
          </div>
        </div>

        {/* Message Body */}
        <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed text-justify">
            {message}
          </p>
          {options.subMessage && (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
              {options.subMessage}
            </p>
          )}
          <div className="flex items-center gap-1.5 pt-1 text-[11px] font-bold text-blue-700 dark:text-blue-400">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>{isFa ? 'وضعیت رکورد به «ثبت نهایی» تغییر خواهد یافت.' : 'Record status will be changed to Finalized.'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleCancel}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50"
            id="final-submit-cancel-btn"
          >
            {cancelText}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] cursor-pointer flex items-center gap-2 disabled:opacity-50"
            id="final-submit-confirm-btn"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? (isFa ? 'در حال ثبت...' : 'Finalizing...') : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
