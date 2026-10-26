import React from 'react';
import {
  Search,
  Filter,
  ShieldCheck,
  Users,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowLeft,
  FileText
} from 'lucide-react';

interface Props {
  title?: string;
  description?: string;
  totalCount: number;
  onQuickFilter?: (type: string, value: any) => void;
  onShowAll?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptySearchState: React.FC<Props> = ({
  title = 'جهت نمایش اطلاعات، جستجو کنید یا فیلتر را اعمال نمایید',
  description = 'به منظور افزایش امنیت اطلاعات سلامت پرسنل و دسترسی سریع، رکوردهای کاربران پس از درج نام، کدملی، کد پرسنلی یا انتخاب فیلترهای بالا نمایش داده می‌شوند.',
  totalCount,
  onQuickFilter,
  onShowAll,
  icon,
  className = ''
}) => {
  return (
    <div className={`w-full bg-white dark:bg-[#17222c] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center shadow-xs ${className}`}>
      {/* Icon Badge */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-teal-50 to-teal-100 dark:from-teal-950/80 dark:to-slate-800 border border-teal-200 dark:border-teal-800/80 flex items-center justify-center mb-5 text-teal-600 dark:text-teal-400 shadow-inner">
        {icon || <Search className="w-8 h-8 sm:w-10 sm:h-10" />}
      </div>

      {/* Main Heading */}
      <h3 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white mb-2 max-w-lg">
        {title}
      </h3>

      {/* Subtitle / Explanation */}
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed mb-6">
        {description}
      </p>

      {/* Database Stats Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 mb-6">
        <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
        <span>تعداد کل پرونده‌های ثبتی در پایگاه داده:</span>
        <span className="font-mono text-sm font-black text-teal-700 dark:text-teal-300">{totalCount} رکورد</span>
      </div>

      {/* Quick Search Suggestions */}
      {onQuickFilter && (
        <div className="w-full max-w-xl border-t border-slate-100 dark:border-slate-800 pt-6">
          <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-3">
            یا از فیلترهای سریع زیر استفاده کنید:
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onQuickFilter('opinion', 'مشروط')}
              className="px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 transition-all flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>نظریه مشروط طب کار</span>
            </button>

            <button
              type="button"
              onClick={() => onQuickFilter('followup', 'yes')}
              className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 transition-all flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              <span>پرسنل نیازمند پیگیری</span>
            </button>

            <button
              type="button"
              onClick={() => onQuickFilter('labAbnormalOnly', true)}
              className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>نتایج غیرطبیعی آزمایشگاه</span>
            </button>

            {onShowAll && (
              <button
                type="button"
                onClick={onShowAll}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-750 transition-all flex items-center gap-1.5"
              >
                <span>نمایش تمام {totalCount} پرونده</span>
                <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmptySearchState;
