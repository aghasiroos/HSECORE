import React from 'react';
import { Layers, Flame, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

interface DashboardFiveSTrendChartProps {
  fiveSData?: {
    total: number;
    averageScore: number;
  };
  fireData?: {
    total: number;
    operational: number;
    needsInspection: number;
    readinessRate: number;
  };
  isFa: boolean;
  onNavigate?: (tab: any) => void;
}

export const DashboardFiveSTrendChart: React.FC<DashboardFiveSTrendChartProps> = React.memo(({
  fiveSData,
  fireData,
  isFa,
  onNavigate,
}) => {
  const avg5S = (fiveSData?.total || 0) > 0 ? (fiveSData?.averageScore ?? 0) : 0;
  const totalFire = fireData?.total ?? 0;
  const operationalFire = fireData?.operational ?? 0;
  const fireRate = totalFire > 0 ? (fireData?.readinessRate ?? Math.round((operationalFire / totalFire) * 100)) : 0;

  const chartData = [
    { name: isFa ? 'امتیاز نظام آراستگی (5S)' : '5S Score', value: avg5S, color: '#ec4899', max: 100 },
    { name: isFa ? 'آمادگی اطفای حریق' : 'Fire Readiness', value: fireRate, color: '#f97316', max: 100 },
  ];

  return (
    <div 
      onClick={() => onNavigate && onNavigate('fire-dept')}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 h-full cursor-pointer hover:border-pink-400 dark:hover:border-pink-600 transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-pink-500/10 text-pink-600 dark:text-pink-400 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-base">
              {isFa ? 'نظام آراستگی (5S) و ایمنی حریق' : '5S Housekeeping & Fire Safety'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isFa ? 'شاخص‌های ممیزی محیط کار و آمادگی کپسول‌ها و آتش‌نشانی' : 'Workplace audit scores & fire gear readiness'}
            </p>
          </div>
        </div>

        <span className="text-xs font-black px-2.5 py-1 bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800 rounded-full">
          {avg5S}% {isFa ? 'شاخص آراستگی' : '5S Index'}
        </span>
      </div>

      {/* Progress Bars & Badges */}
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-700 dark:text-slate-200 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-pink-500" />
              <span>{isFa ? 'میانگین نمره ممیزی 5S:' : '5S Average:'}</span>
            </span>
            <span className="font-black font-mono text-pink-600">{avg5S} / ۱۰۰</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, avg5S)}%` }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-700 dark:text-slate-200 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span>{isFa ? 'آمادگی کپسول‌ها و تجهیزات حریق:' : 'Fire Gear Readiness:'}</span>
            </span>
            <span className="font-black font-mono text-orange-600">{fireRate}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, fireRate)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2 Mini Status Boxes */}
      <div className="grid grid-cols-2 gap-2 text-center pt-1">
        <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700">
          <span className="text-[10px] text-slate-500 font-bold block">{isFa ? 'کل ممیزی‌های 5S' : '5S Audits'}</span>
          <strong className="text-base font-black font-mono text-slate-800 dark:text-slate-100">{fiveSData?.total || 0}</strong>
        </div>
        <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700">
          <span className="text-[10px] text-slate-500 font-bold block">{isFa ? 'تجهیزات آماده حریق' : 'Fire Gear'}</span>
          <strong className="text-base font-black font-mono text-slate-800 dark:text-slate-100">{operationalFire} / {totalFire}</strong>
        </div>
      </div>

      {onNavigate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('fire-dept');
          }}
          className="w-full py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-pink-600 hover:text-white dark:hover:bg-pink-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>{isFa ? 'مدیریت ایمنی آتش‌نشانی و 5S' : 'Go to Fire & 5S Module'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});

DashboardFiveSTrendChart.displayName = 'DashboardFiveSTrendChart';
