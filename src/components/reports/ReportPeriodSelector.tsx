import React from 'react';
import { Calendar, Clock, ChevronDown, Check } from 'lucide-react';

export type ReportPeriod = '3M' | '6M' | '1Y' | 'ALL';

export interface ReportPeriodSelectorProps {
  selectedPeriod: ReportPeriod;
  onPeriodChange: (period: ReportPeriod) => void;
  isFa?: boolean;
  startDate?: string;
  endDate?: string;
}

export const ReportPeriodSelector: React.FC<ReportPeriodSelectorProps> = ({
  selectedPeriod,
  onPeriodChange,
  isFa = true,
  startDate,
  endDate
}) => {
  const periods: { id: ReportPeriod; labelFa: string; labelEn: string; descFa: string; descEn: string }[] = [
    { id: '3M', labelFa: '۳ ماهه اخیر (فصلی)', labelEn: '3 Months (Quarterly)', descFa: '۹۰ روز گذشته', descEn: 'Last 90 Days' },
    { id: '6M', labelFa: '۶ ماهه اخیر (نیم‌سال)', labelEn: '6 Months (Bi-annual)', descFa: '۱۸۰ روز گذشته', descEn: 'Last 180 Days' },
    { id: '1Y', labelFa: '۱ سال اخیر (سالانه)', labelEn: '1 Year (Annual)', descFa: '۳۶۵ روز گذشته', descEn: 'Last 365 Days' },
    { id: 'ALL', labelFa: 'تمام دوره‌ها (کل سوابق)', labelEn: 'All Time (Full History)', descFa: 'مجموع سوابق ثبت‌شده', descEn: 'Complete Archive' },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
          <Calendar className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>{isFa ? 'بازه زمانی گزارشات و تحلیل آماری:' : 'Reporting Time Horizon:'}</span>
            <span className="text-blue-600 dark:text-blue-400 font-mono">
              {periods.find(p => p.id === selectedPeriod)?.[isFa ? 'descFa' : 'descEn']}
            </span>
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {isFa 
              ? 'داده‌ها و نمودارهای تمامی بخش‌ها به صورت خودکار با بازه انتخابی همگام‌سازی می‌شوند.'
              : 'All charts and metrics dynamically synchronize with the selected timeframe.'}
          </p>
        </div>
      </div>

      {/* Segmented Period Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl flex-wrap">
        {periods.map(period => {
          const isActive = selectedPeriod === period.id;
          return (
            <button
              key={period.id}
              type="button"
              onClick={() => onPeriodChange(period.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm font-black scale-102'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
              }`}
            >
              {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
              <span>{isFa ? period.labelFa : period.labelEn}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
export default ReportPeriodSelector;
