import React from 'react';
import { BarChart, Bar, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ShieldAlert, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';

interface DashboardRiskChartProps {
  risksData?: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  isFa: boolean;
  onNavigate?: (tab: any) => void;
}

export const DashboardRiskChart: React.FC<DashboardRiskChartProps> = ({
  risksData,
  isFa,
  onNavigate,
}) => {
  const high = risksData?.high || 0;
  const medium = risksData?.medium || 0;
  const low = risksData?.low || 0;
  const total = risksData?.total || 0;

  const chartData = [
    { name: isFa ? 'ریسک بالا (High)' : 'High Risk', count: high, color: '#ef4444' },
    { name: isFa ? 'ریسک متوسط (Medium)' : 'Medium', count: medium, color: '#f59e0b' },
    { name: isFa ? 'ریسک قابل قبول (Low)' : 'Low Risk', count: low, color: '#10b981' },
  ];

  return (
    <div 
      onClick={() => onNavigate && onNavigate('risk')}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 h-full cursor-pointer hover:border-red-400 dark:hover:border-red-600 transition-all duration-200"
      title={isFa ? 'کلیک جهت انتقال به ماژول ارزیابی ریسک' : 'Click to navigate to Risk Assessment'}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-base">
              {isFa ? 'ماتریس و توزیع ریسک‌های ایمنی' : 'Safety Risk Matrix & Hazards'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isFa ? 'ارزیابی ریسک فرآیندی و عملیاتی کل سایت' : 'Process and operational risk evaluation'}
            </p>
          </div>
        </div>

        <span className="text-xs font-black px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-700 dark:text-slate-300">
          {total} {isFa ? 'مورد شناسایی‌شده' : 'Identified'}
        </span>
      </div>

      {/* Badges */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 bg-red-50/70 dark:bg-red-950/40 rounded-xl border border-red-200/60 dark:border-red-800/50">
          <span className="text-[10px] text-red-600 dark:text-red-400 font-bold block">{isFa ? 'بحرانی / بالا' : 'High'}</span>
          <strong className="text-lg font-black font-mono text-red-600 dark:text-red-400">{high}</strong>
        </div>
        <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200/60 dark:border-amber-800/50">
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">{isFa ? 'متوسط' : 'Medium'}</span>
          <strong className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">{medium}</strong>
        </div>
        <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50">
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">{isFa ? 'کم‌خطر' : 'Low'}</span>
          <strong className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">{low}</strong>
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
            <Bar dataKey="count" name={isFa ? 'تعداد خطرات' : 'Hazards Count'} radius={[5, 5, 0, 0]}>
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
          onClick={() => onNavigate('risk-assessment')}
          className="w-full py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1"
        >
          <span>{isFa ? 'ورود به ماژول ارزیابی و ماتریس ریسک' : 'Go to Risk Assessment'}</span>
        </button>
      )}
    </div>
  );
};
