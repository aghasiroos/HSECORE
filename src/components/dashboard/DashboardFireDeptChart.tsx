import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Flame, ShieldAlert, CheckCircle2, Clock, ArrowRight, Activity } from 'lucide-react';

interface DashboardFireDeptChartProps {
  fireData?: {
    total: number;
    operational: number;
    needsInspection: number;
    readinessRate: number;
    byType?: {
      co2: number;
      powder: number;
      foam: number;
      hoses: number;
      hydrants: number;
      detectors: number;
    };
  };
  isFa: boolean;
  onNavigate?: (tab: any) => void;
}

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#06b6d4', '#3b82f6', '#8b5cf6'];

export const DashboardFireDeptChart: React.FC<DashboardFireDeptChartProps> = React.memo(({
  fireData,
  isFa,
  onNavigate,
}) => {
  const [viewType, setViewType] = useState<'bar' | 'pie'>('bar');

  const total = fireData?.total || 0;
  const operational = fireData?.operational || 0;
  const needsInspection = fireData?.needsInspection || 0;
  const readinessRate = total > 0 ? (fireData?.readinessRate ?? Math.round((operational / total) * 100)) : 0;

  const rawTypes = fireData?.byType || {
    co2: 0,
    powder: 0,
    foam: 0,
    hoses: 0,
    hydrants: 0,
    detectors: 0,
  };

  const chartData = [
    { name: isFa ? 'کپسول CO2' : 'CO2 Extinguisher', count: rawTypes.co2 },
    { name: isFa ? 'کپسول پودری' : 'Powder', count: rawTypes.powder },
    { name: isFa ? 'کپسول فوم' : 'Foam', count: rawTypes.foam },
    { name: isFa ? 'هوزریل و شیلنگ' : 'Fire Hose', count: rawTypes.hoses },
    { name: isFa ? 'هایدرانت محوطه' : 'Hydrants', count: rawTypes.hydrants },
    { name: isFa ? 'دتکتورهای دود/حرارت' : 'Detectors', count: rawTypes.detectors },
  ];

  return (
    <div 
      onClick={() => onNavigate && onNavigate('fire-dept')}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 h-full cursor-pointer hover:border-orange-400 dark:hover:border-orange-600 transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-base">
              {isFa ? 'واحد آتش‌نشانی و تجهیزات اطفاء حریق' : 'Fire Department & Emergency Gear'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isFa ? 'پایش آماده‌به‌کاری کپسول‌ها، هایدرانت‌ها و اعلام حریق' : 'Fire gear readiness, hydrants & detectors'}
            </p>
          </div>
        </div>

        <span className="text-xs font-black px-2.5 py-1 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded-full">
          {readinessRate}% {isFa ? 'ضریب آمادگی' : 'Readiness'}
        </span>
      </div>

      {/* Badges */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 bg-orange-50/70 dark:bg-orange-950/40 rounded-xl border border-orange-200/60 dark:border-orange-800/50">
          <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold block">{isFa ? 'کل تجهیزات اطفاء' : 'Total Assets'}</span>
          <strong className="text-lg font-black font-mono text-orange-600 dark:text-orange-400">{total}</strong>
        </div>
        <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50">
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">{isFa ? 'آماده و تاییدشده' : 'Operational'}</span>
          <strong className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">{operational}</strong>
        </div>
        <div className="p-2.5 bg-red-50/70 dark:bg-red-950/40 rounded-xl border border-red-200/60 dark:border-red-800/50">
          <span className="text-[10px] text-red-600 dark:text-red-400 font-bold block">{isFa ? 'نیازمند شارژ/بازرسی' : 'Due/Service'}</span>
          <strong className="text-lg font-black font-mono text-red-600 dark:text-red-400">{needsInspection}</strong>
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
            <Bar dataKey="count" name={isFa ? 'تعداد تجهیزات' : 'Equipment'} radius={[5, 5, 0, 0]}>
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
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('fire-dept');
          }}
          className="w-full py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-orange-600 hover:text-white dark:hover:bg-orange-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>{isFa ? 'ورود به ماژول واحد آتش‌نشانی' : 'Go to Fire Dept'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});

DashboardFireDeptChart.displayName = 'DashboardFireDeptChart';
