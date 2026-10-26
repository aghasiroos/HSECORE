import React from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Sparkles,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface Props {
  onGoToImport: () => void;
  downloadExcelTemplate: () => void;
  title?: string;
  description?: string;
}

export const EmptyDatabaseState: React.FC<Props> = ({
  onGoToImport,
  downloadExcelTemplate,
  title = 'هیچ اطلاعات یا پرونده معایناتی در سامانه بارگذاری نشده است',
  description = 'پایگاه داده سامانه طب کار در حال حاضر خالی است. برای فعال‌سازی داشبوردها، پرونده‌های سلامت، تحلیل‌های آزمایشگاهی و شاخص‌های آماری، لطفاً فایل اکسل معاینات ادواری سازمان خود را بارگذاری نمایید.'
}) => {
  return (
    <div className="w-full bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-8 sm:p-14 text-center flex flex-col items-center justify-center shadow-xs animate-fadeIn my-4">
      {/* Icon Badge */}
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/80 flex items-center justify-center mb-6 text-teal-600 dark:text-teal-400 shadow-sm">
        <FileSpreadsheet className="w-10 h-10 sm:w-12 sm:h-12" />
      </div>

      {/* Main Heading */}
      <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-2 max-w-xl">
        {title}
      </h2>

      {/* Description */}
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed mb-8">
        {description}
      </p>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onGoToImport}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-black shadow-md shadow-teal-600/20 transition-all cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>ورود فایل اکسل طب کار (.xlsx)</span>
        </button>

        <button
          type="button"
          onClick={downloadExcelTemplate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>دانلود قالب اکسل خام</span>
        </button>
      </div>

      {/* Security & Reliability Note */}
      <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
        <ShieldCheck className="w-4 h-4 text-teal-600" />
        <span>امکان بارگذاری هم‌زمان چند فایل اکسل، تفکیک بر اساس سال/سازمان و حذف مستقل هر فایل وجود دارد.</span>
      </div>
    </div>
  );
};

export default EmptyDatabaseState;
