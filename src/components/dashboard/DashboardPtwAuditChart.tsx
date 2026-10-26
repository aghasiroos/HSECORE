import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { FileCheck2, ShieldCheck, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

interface DashboardPtwAuditChartProps {
  ptwData?: {
    total: number;
    active: number;
    auditComplianceRate: number;
    auditedCount: number;
    compliantAuditedCount: number;
  };
  isFa: boolean;
  onNavigate?: (tab: any) => void;
}

export const DashboardPtwAuditChart: React.FC<DashboardPtwAuditChartProps> = React.memo(({
  ptwData,
  isFa,
  onNavigate,
}) => {
  const auditedCount = ptwData?.auditedCount ?? 0;
  const compliantCount = ptwData?.compliantAuditedCount ?? 0;
  const complianceRate = auditedCount > 0 ? (ptwData?.auditComplianceRate ?? Math.round((compliantCount / auditedCount) * 100)) : 0;
  const nonCompliantCount = Math.max(0, auditedCount - compliantCount);

  const chartData = auditedCount > 0 ? [
    { name: isFa ? 'پروانه‌های کاملاً منطبق' : 'Compliant', value: compliantCount, color: '#10b981' },
    { name: isFa ? 'دارای انحراف ممیزی' : 'Deviations', value: nonCompliantCount, color: '#ef4444' },
  ] : [
    { name: isFa ? 'بدون داده ثبت‌شده' : 'No Data', value: 1, color: '#94a3b8' }
  ];

  return (
    <div 
      onClick={() => onNavigate && onNavigate('ptw-audit')}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 h-full cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-base">
              {isFa ? 'ممیزی پروانه کار و پایش انطباق (PTW Audit)' : 'PTW Audit & Compliance'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isFa ? 'پایش میدانی چک‌لیست‌های مجوز کار و امضاهای مجاز' : 'Field permit audits & signature compliance'}
            </p>
          </div>
        </div>

        <span className="text-xs font-black px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-full">
          {complianceRate}% {isFa ? 'انطباق ممیزی' : 'Compliance'}
        </span>
      </div>

      {/* Badges */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <span className="text-[10px] text-slate-500 font-bold block">{isFa ? 'کل ممیزی‌های PTW' : 'Audited PTWs'}</span>
          <strong className="text-lg font-black font-mono text-slate-800 dark:text-slate-100">{auditedCount}</strong>
        </div>
        <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50">
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">{isFa ? 'مجوزهای منطبق' : 'Compliant'}</span>
          <strong className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">{compliantCount}</strong>
        </div>
        <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200/60 dark:border-amber-800/50">
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">{isFa ? 'دارای عدم انطباق' : 'Defects'}</span>
          <strong className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">{nonCompliantCount}</strong>
        </div>
      </div>

      {/* Donut Chart */}
      <div className="flex-1 min-h-[170px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={170} debounce={50}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={68}
              paddingAngle={auditedCount > 0 ? 3 : 0}
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
            {auditedCount > 0 && <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />}
          </PieChart>
        </ResponsiveContainer>
      </div>

      {onNavigate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('ptw-audit');
          }}
          className="w-full py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>{isFa ? 'مشاهده و ممیزی پروانه‌های کار (PTW Audit)' : 'Go to PTW Audit Module'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});

DashboardPtwAuditChart.displayName = 'DashboardPtwAuditChart';
