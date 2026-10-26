import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { HeartPulse, CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';

interface DashboardHealthChartProps {
  healthData?: {
    totalExams: number;
    fit: number;
    conditional: number;
    unfit: number;
    fitnessPercentage: number;
  };
  isFa: boolean;
  onNavigate?: (tab: any) => void;
}

export const DashboardHealthChart: React.FC<DashboardHealthChartProps> = ({
  healthData,
  isFa,
  onNavigate,
}) => {
  const fit = healthData?.fit || 0;
  const conditional = healthData?.conditional || 0;
  const unfit = healthData?.unfit || 0;
  const total = healthData?.totalExams || 0;
  const fitnessPercentage = total > 0 ? (healthData?.fitnessPercentage ?? Math.round(((fit + conditional) / total) * 100)) : 0;

  const chartData = total > 0 ? [
    { name: isFa ? 'کاملاً متناسب (Fit)' : 'Fit', value: fit, color: '#10b981' },
    { name: isFa ? 'متناسب مشروط (Conditional)' : 'Conditional', value: conditional, color: '#f59e0b' },
    { name: isFa ? 'نامتناسب با شغل (Unfit)' : 'Unfit', value: unfit, color: '#ef4444' },
  ] : [
    { name: isFa ? 'بدون داده معاینات' : 'No Data', value: 1, color: '#94a3b8' }
  ];

  return (
    <div 
      onClick={() => onNavigate && onNavigate('health-env')}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 h-full cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-base">
              {isFa ? 'پایش سلامت شغلی و تناسب طب کار' : 'Occupational Health & Fitness'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isFa ? 'نتایج معاینات دوره‌ای و شاخص سلامت پرسنل' : 'Periodic medical exam outcomes'}
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full">
          {fitnessPercentage}% {isFa ? 'تناسب کلی' : 'Fitness'}
        </span>
      </div>

      {/* Fitness Rate Visual */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50">
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">{isFa ? 'متناسب (Fit)' : 'Fit'}</span>
          <strong className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">{fit}</strong>
        </div>
        <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200/60 dark:border-amber-800/50">
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">{isFa ? 'مشروط' : 'Conditional'}</span>
          <strong className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">{conditional}</strong>
        </div>
        <div className="p-2.5 bg-rose-50/70 dark:bg-rose-950/40 rounded-xl border border-rose-200/60 dark:border-rose-800/50">
          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block">{isFa ? 'نامتناسب' : 'Unfit'}</span>
          <strong className="text-lg font-black font-mono text-rose-600 dark:text-rose-400">{unfit}</strong>
        </div>
      </div>

      {/* Donut Chart */}
      <div className="flex-1 min-h-[170px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={170} debounce={50}>
          <PieChart>
            <Pie
              data={chartData.some(d => d.value > 0) ? chartData.filter(d => d.value > 0) : [{ name: isFa ? 'بدون پرونده' : 'No records', value: 1, color: '#94a3b8' }]}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={65}
              paddingAngle={total > 0 ? 4 : 0}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--color-slate-900, #0f172a)', 
                color: '#fff', 
                borderRadius: '12px', 
                fontSize: '11px', 
                fontWeight: 'bold' 
              }} 
            />
            {total > 0 && <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />}
          </PieChart>
        </ResponsiveContainer>
      </div>

      {onNavigate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('health-env');
          }}
          className="w-full py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>{isFa ? 'ورود به ماژول سلامت شغلی و معاینات' : 'Go to Occupational Health'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
