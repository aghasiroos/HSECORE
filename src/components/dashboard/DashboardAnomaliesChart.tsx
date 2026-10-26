import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend } from 'recharts';
import { AlertOctagon, CheckCircle2, ShieldAlert, ArrowRight, EyeOff } from 'lucide-react';

interface DashboardAnomaliesChartProps {
  anomaliesData?: {
    total: number;
    open: number;
    resolved: number;
    byCategory: {
      unsafeActs: number;
      ppeViolations: number;
      equipmentAnomalies: number;
      environmentalAnomalies: number;
      nearMisses: number;
    };
  };
  isFa: boolean;
  onNavigate?: (tab: any) => void;
}

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#06b6d4', '#8b5cf6'];

export const DashboardAnomaliesChart: React.FC<DashboardAnomaliesChartProps> = React.memo(({
  anomaliesData,
  isFa,
  onNavigate,
}) => {
  const total = anomaliesData?.total || 0;
  const open = anomaliesData?.open || 0;
  const resolved = anomaliesData?.resolved || 0;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 100;

  const rawCats = anomaliesData?.byCategory || {
    unsafeActs: 0,
    ppeViolations: 0,
    equipmentAnomalies: 0,
    environmentalAnomalies: 0,
    nearMisses: 0,
  };

  const chartData = [
    { name: isFa ? 'اعمال ناایمن' : 'Unsafe Acts', count: rawCats.unsafeActs },
    { name: isFa ? 'تخلفات فردی PPE' : 'PPE Violations', count: rawCats.ppeViolations },
    { name: isFa ? 'نقص تجهیزات' : 'Equipment Defect', count: rawCats.equipmentAnomalies },
    { name: isFa ? 'ناهنجاری محیطی' : 'Environmental', count: rawCats.environmentalAnomalies },
    { name: isFa ? 'شبه‌حوادث' : 'Near Misses', count: rawCats.nearMisses },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-base">
              {isFa ? 'گزارشات ناهنجاری و رفتارهای ناایمن' : 'Anomalies & Unsafe Conditions'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isFa ? 'پایش انحرافات ایمنی، تخلفات فردی و شرایط خطرآفرین' : 'Safety deviations, unsafe behaviors & defects'}
            </p>
          </div>
        </div>

        <span className="text-xs font-black px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-full">
          {total} {isFa ? 'کل ناهنجاری‌ها' : 'Total'}
        </span>
      </div>

      {/* Badges */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 bg-rose-50/70 dark:bg-rose-950/40 rounded-xl border border-rose-200/60 dark:border-rose-800/50">
          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block">{isFa ? 'باز و در جریان' : 'Open'}</span>
          <strong className="text-lg font-black font-mono text-rose-600 dark:text-rose-400">{open}</strong>
        </div>
        <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50">
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">{isFa ? 'اصلاح و بسته' : 'Resolved'}</span>
          <strong className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">{resolved}</strong>
        </div>
        <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200/60 dark:border-blue-800/50">
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold block">{isFa ? 'نرخ اقدام اصلاحی' : 'Fix Rate'}</span>
          <strong className="text-lg font-black font-mono text-blue-600 dark:text-blue-400">{resolutionRate}%</strong>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="flex-1 min-h-[170px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={170} debounce={50}>
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
            <Bar dataKey="count" name={isFa ? 'تعداد گزارش' : 'Reports'} radius={[5, 5, 0, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
          <span>{isFa ? 'مشاهده پرونده‌های ناهنجاری و عدم انطباق' : 'Go to Anomalies & Warnings'}</span>
        </button>
      )}
    </div>
  );
});

DashboardAnomaliesChart.displayName = 'DashboardAnomaliesChart';
