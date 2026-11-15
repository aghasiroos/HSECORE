import React, { useEffect } from 'react';
import { Save, X } from 'lucide-react';

export interface LiftingFormModalShellProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  maxWidthClass?: string;
  submitting?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  cancelLabel?: string;
  hideFooterSubmit?: boolean;
  headerActions?: React.ReactNode;
  subHeader?: React.ReactNode;
  footerExtra?: React.ReactNode;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
}

export default function LiftingFormModalShell({
  isOpen,
  title,
  subtitle,
  icon: Icon,
  maxWidthClass = 'max-w-3xl',
  submitting = false,
  submitLabel = 'ذخیره اطلاعات',
  submittingLabel = 'در حال ذخیره‌سازی...',
  cancelLabel = 'انصراف',
  hideFooterSubmit = false,
  headerActions,
  subHeader,
  footerExtra,
  onClose,
  onSubmit,
  children,
}: LiftingFormModalShellProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => !submitting && onClose()}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full ${maxWidthClass} max-h-[93vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100`}
      >
        {/* Top Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="w-10 h-10 rounded-xl bg-sky-600/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">{title}</h3>
              {subtitle && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="بستن پنجره"
              aria-label="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Optional Sub-Header */}
        {subHeader}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar text-xs">{children}</div>

        {/* Sticky Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">{footerExtra}</div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              disabled={submitting}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {cancelLabel}
            </button>
            {!hideFooterSubmit && (
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-black cursor-pointer whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                <span>{submitting ? submittingLabel : submitLabel}</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
