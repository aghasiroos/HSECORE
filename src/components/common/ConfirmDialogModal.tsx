import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Info, X } from 'lucide-react';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  tone?: 'danger' | 'warning' | 'info';
  isFa?: boolean;
}

export interface PromptDialogOptions {
  title?: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

type ActiveDialogState =
  | {
      kind: 'confirm';
      options: ConfirmDialogOptions;
      resolve: (value: boolean) => void;
    }
  | {
      kind: 'prompt';
      options: PromptDialogOptions;
      resolve: (value: string | null) => void;
    };

let enqueueDialog: ((dialog: ActiveDialogState) => void) | null = null;

export function showConfirmDialog(
  options: ConfirmDialogOptions | string,
  overrides?: Omit<ConfirmDialogOptions, 'message'> & { message?: string }
): Promise<boolean> {
  const base: ConfirmDialogOptions =
    typeof options === 'string' ? { message: options } : options;
  const merged: ConfirmDialogOptions = overrides
    ? { ...base, ...overrides, message: overrides.message ?? base.message }
    : base;
  const normalized: ConfirmDialogOptions = {
    ...merged,
    variant: merged.variant ?? merged.tone,
    confirmLabel: merged.confirmLabel ?? merged.confirmText,
    cancelLabel: merged.cancelLabel ?? merged.cancelText,
  };

  return new Promise<boolean>((resolve) => {
    if (!enqueueDialog) {
      resolve(false);
      return;
    }
    enqueueDialog({ kind: 'confirm', options: normalized, resolve });
  });
}

export function showPromptDialog(
  options: PromptDialogOptions | string
): Promise<string | null> {
  const normalized: PromptDialogOptions =
    typeof options === 'string' ? { message: options } : options;

  return new Promise<string | null>((resolve) => {
    if (!enqueueDialog) {
      resolve(null);
      return;
    }
    enqueueDialog({ kind: 'prompt', options: normalized, resolve });
  });
}

export const ConfirmDialogModal: React.FC = () => {
  const [queue, setQueue] = useState<ActiveDialogState[]>([]);
  const [inputVal, setInputVal] = useState('');

  useEffect(() => {
    enqueueDialog = (dialog) => {
      setQueue((prev) => [...prev, dialog]);
    };
    return () => {
      enqueueDialog = null;
    };
  }, []);

  const current = queue[0] || null;

  useEffect(() => {
    if (current?.kind === 'prompt') {
      setInputVal(current.options.defaultValue || '');
    } else {
      setInputVal('');
    }
  }, [current]);

  if (!current) return null;

  const isFa =
    typeof document === 'undefined' ||
    document.documentElement.lang === 'fa' ||
    document.documentElement.dir === 'rtl';

  const closeWithResult = (confirmed: boolean) => {
    setQueue((prev) => prev.slice(1));
    if (current.kind === 'confirm') {
      current.resolve(confirmed);
    } else {
      current.resolve(confirmed ? inputVal : null);
    }
  };

  const variant =
    current.kind === 'confirm' ? current.options.variant || 'danger' : 'info';

  const iconBg =
    variant === 'danger'
      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
      : variant === 'warning'
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
      : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';

  const confirmBtnCls =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
      : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20';

  const title =
    current.options.title ||
    (current.kind === 'prompt'
      ? isFa
        ? 'ورود اطلاعات'
        : 'Input Required'
      : variant === 'danger'
      ? isFa
        ? 'تأیید عملیات حساس'
        : 'Confirm Action'
      : isFa
      ? 'تأیید ادامه عملیات'
      : 'Confirm');

  const confirmLabel =
    current.options.confirmLabel ||
    (current.kind === 'prompt'
      ? isFa
        ? 'ثبت و ادامه'
        : 'Submit'
      : isFa
      ? 'تأیید و ادامه'
      : 'Confirm');

  const cancelLabel =
    current.options.cancelLabel || (isFa ? 'انصراف' : 'Cancel');

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      dir={isFa ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconBg}`}>
              {variant === 'danger' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : variant === 'warning' ? (
                <HelpCircle className="w-5 h-5" />
              ) : (
                <Info className="w-5 h-5" />
              )}
            </div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => closeWithResult(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label={cancelLabel}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs sm:text-sm leading-6 text-slate-600 dark:text-slate-300 whitespace-pre-line font-medium">
            {current.options.message}
          </p>

          {current.kind === 'prompt' && (
            <input
              type="text"
              autoFocus
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  closeWithResult(true);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  closeWithResult(false);
                }
              }}
              placeholder={current.options.placeholder || ''}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => closeWithResult(false)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => closeWithResult(true)}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer ${confirmBtnCls}`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialogModal;
