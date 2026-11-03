import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { AlertTriangle, ShieldAlert, CheckCircle2, FileText, ArrowRight } from 'lucide-react';

interface DashboardWarningsTrendChartProps {
  warningsData?: {
    total: number;
    active: number;
    penalized: number;
    list: any[];
  };
  isFa: boolean;
  onNavigate?: (tab: any) => void;
}

export const DashboardWarningsTrendChart: React.FC<DashboardWarningsTrendChartProps> = React.memo(({
  warningsData,
  isFa,
  onNavigate,
}) => {
  const total = warningsData?.total || 0;
  const active = warningsData?.active || 0;
  const penalized = warningsData?.penalized || 0;
  const resolved = Math.max(0, total - active);

  const chartData = [
    { name: isFa ? 'اخطارهای فعال' : 'Active', count: active, color: '#f59e0b' },
    { name: isFa ? 'دارای جریمه / معلق' : 'Penalized', count: penalized, color: '#ef4444' },
    { name: isFa ? 'اقدام و مختومه' : 'Resolved', count: resolved, color: '#10b981' },
  ];

  return (
    <div 
      onClick={() => onNavigate && onNavigate('warnings')}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 h-full cursor-pointer hover:border-purple-400 dark:hover:border-purple-600 transition-all duration-200"
      title={isFa ? 'کلیک جهت انتقال به ماژول اخطارهای ایمنی و عدم انطباق' : 'Click to navigate to Safety Warnings'}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-base">
              {isFa ? 'پایش اخطارهای کتبی و عدم انطباق‌ها' : 'Safety Warnings & Non-Conformities'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isFa ? 'وضعیت پرونده‌های باز، توبیخ‌ها و اقدامات اصلاحی' : 'Active notices, penalties and corrective actions'}
            </p>
          </div>
        </div>

        <span className="text-xs font-black px-2.5 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-full">
          {total} {isFa ? 'کل اخطارها' : 'Total'}
        </span>
      </div>

      {/* Badges */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200/60 dark:border-amber-800/50">
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">{isFa ? 'فعال / باز' : 'Active'}</span>
          <strong className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">{active}</strong>
        </div>
        <div className="p-2.5 bg-red-50/70 dark:bg-red-950/40 rounded-xl border border-red-200/60 dark:border-red-800/50">
          <span className="text-[10px] text-red-600 dark:text-red-400 font-bold block">{isFa ? 'جرایم و تعلیق' : 'Penalized'}</span>
          <strong className="text-lg font-black font-mono text-red-600 dark:text-red-400">{penalized}</strong>
        </div>
        <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50">
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">{isFa ? 'مختومه‌شده' : 'Resolved'}</span>
          <strong className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">{resolved}</strong>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="flex-1 min-h-[170px] w-full min-w-0">
        <ResponsiveContainer width="100%" height={170} minWidth={0} minHeight={170} debounce={50}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} />
            <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} allowDecimals={false} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--color-slate-900, #0f172a)', 
                color: '#fff', 
                borderRadius: '12px', 
                fontSize: '11px', 
                fontWeight: 'bold' 
              }} 
            />
            <Bar dataKey="count" name={isFa ? 'تعداد اخطار' : 'Warnings'} radius={[5, 5, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {onNavigate && (
        <button
          type="button"
          onClick={() => onNavigate('warnings')}
          className="w-full py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1"
        >
          <span>{isFa ? 'ورود به کارتابل اخطارهای کتبی' : 'Go to Written Warnings'}</span>
        </button>
      )}
    </div>
  );
});

DashboardWarningsTrendChart.displayName = 'DashboardWarningsTrendChart';
