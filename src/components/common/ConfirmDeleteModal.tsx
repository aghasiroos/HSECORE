import React from 'react';
import { AlertTriangle, Trash2, X, FileText, Building2, Calendar, User } from 'lucide-react';
import { PtwAuditRecord } from '../../modules/ptw-audit/types';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  language?: 'fa' | 'en';
  isFa?: boolean;
  title?: string;
  itemName?: string;
  itemType?: string;
  message?: string;
  audit?: PtwAuditRecord | null;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDeleteModal({
  isOpen,
  language,
  isFa: isFaProp,
  title,
  itemName,
  itemType,
  message,
  audit,
  onConfirm,
  onClose,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;
  if (audit !== undefined && !audit) return null;

  const isFa = language ? language === 'fa' : (isFaProp ?? true);

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs font-sans animate-fadeIn"
      dir={isFa ? 'rtl' : 'ltr'}
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full ${
          audit ? 'max-w-lg' : 'max-w-md'
        } shadow-2xl space-y-4 animate-scaleIn text-slate-800 dark:text-slate-100`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Icon */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-3 text-rose-600">
            <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {title ||
                  (audit
                    ? isFa
                      ? 'تایید حذف ممیزی پروانه کار'
                      : 'Confirm PTW Audit Deletion'
                    : isFa
                    ? 'تایید نهایی عملیات حذف'
                    : 'Confirm Deletion')}
              </h3>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold mt-0.5">
                {isFa ? 'این عملیات غیر قابل بازگشت است' : 'This action cannot be undone'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Optional PTW Audit Details Summary Card */}
        {audit && (
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>شماره پروانه کار:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  {audit.permitNumber}
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                  audit.permitType === 'HOT'
                    ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                    : audit.permitType === 'COLD'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                }`}
              >
                {audit.permitType === 'HOT'
                  ? 'پروانه گرم'
                  : audit.permitType === 'COLD'
                  ? 'پروانه سرد'
                  : 'فضای بسته'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>واحد:</span>
                <strong className="text-slate-800 dark:text-slate-200">{audit.unitName || '—'}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>تاریخ ممیزی:</span>
                <strong className="font-mono text-slate-800 dark:text-slate-200">{audit.auditDate}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>ممیز ثبت‌کننده:</span>
                <strong className="text-slate-800 dark:text-slate-200">
                  {audit.hseAuditor?.auditorName || 'نماینده HSE'}
                </strong>
              </div>
              <div className="flex items-center gap-1.5">
                <span>شاخص انطباق:</span>
                <strong className="font-mono text-slate-800 dark:text-slate-200">
                  {audit.complianceScore ?? 100}%
                </strong>
                {audit.defectsCount && audit.defectsCount > 0 ? (
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    ({audit.defectsCount} عدم انطباق)
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Body Message */}
        <div className="py-1">
          {message ? (
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-bold">
              {message}
            </p>
          ) : audit ? (
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isFa
                ? 'آیا از حذف کامل این رکورد ممیزی اطمینان دارید؟ با تایید این اقدام، تمام اطلاعات ممیزی ۳۰ گانه، بررسی خطرات و وسایل حفاظت فردی، ضمائم و محاسبات آماری مربوط به این ممیزی از سامانه حذف خواهد شد.'
                : 'Are you sure you want to permanently delete this PTW audit record? All checklist answers, hazard checks, attachments, and metrics will be permanently removed.'}
            </p>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-bold">
              {isFa ? (
                <>
                  آیا از حذف {itemType || 'مورد'} انتخابی
                  {itemName && (
                    <strong className="mx-1 text-slate-950 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 font-mono inline-block">
                      «{itemName}»
                    </strong>
                  )}
                  به طور کامل اطمینان دارید؟ تمامی سوابق و اطلاعات مرتبط حذف خواهند شد.
                </>
              ) : (
                <>
                  Are you sure you want to permanently delete {itemType || 'item'}
                  {itemName && (
                    <strong className="mx-1 text-slate-950 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 font-mono inline-block">
                      "{itemName}"
                    </strong>
                  )}
                  ? All related records will be removed.
                </>
              )}
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {audit
                ? isFa
                  ? 'بله، حذف ممیزی'
                  : 'Yes, Delete Audit'
                : isFa
                ? 'بله، حذف شود'
                : 'Yes, Delete'}
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 active:scale-98 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            {isFa ? 'انصراف' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
