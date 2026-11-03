import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { ClipboardCheck, CheckCircle2, AlertTriangle, ArrowRight, Wrench } from 'lucide-react';

interface DashboardSafetyInspectionChartProps {
  inspectionData?: {
    total: number;
    compliant: number;
    defective: number;
    passRate: number;
    byType: {
      equipment: number;
      scaffolding: number;
      crane: number;
      electrical: number;
      excavation: number;
      siteRoutine: number;
    };
  };
  isFa: boolean;
  onNavigate?: (tab: any) => void;
}

const COLORS = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export const DashboardSafetyInspectionChart: React.FC<DashboardSafetyInspectionChartProps> = React.memo(({
  inspectionData,
  isFa,
  onNavigate,
}) => {
  const total = inspectionData?.total || 0;
  const compliant = inspectionData?.compliant || 0;
  const defective = inspectionData?.defective || 0;
  const passRate = total > 0 ? (inspectionData?.passRate ?? Math.round((compliant / total) * 100)) : 0;

  const rawTypes = inspectionData?.byType || {
    equipment: 0,
    scaffolding: 0,
    crane: 0,
    electrical: 0,
    excavation: 0,
    siteRoutine: 0,
  };

  const chartData = [
    { name: isFa ? 'ماشین‌آلات و تجهیزات' : 'Equipment', count: rawTypes.equipment },
    { name: isFa ? 'داربست‌بندی' : 'Scaffolding', count: rawTypes.scaffolding },
    { name: isFa ? 'جرثقیل و لیفتینگ' : 'Crane & Rigging', count: rawTypes.crane },
    { name: isFa ? 'تابلوهای برق' : 'Electrical', count: rawTypes.electrical },
    { name: isFa ? 'گودبرداری و ترانشه' : 'Excavation', count: rawTypes.excavation },
    { name: isFa ? 'پایش روزانه سایت' : 'Daily Routine', count: rawTypes.siteRoutine },
  ];

  return (
    <div 
      onClick={() => onNavigate && onNavigate('safety-unit')}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 h-full cursor-pointer hover:border-sky-400 dark:hover:border-sky-600 transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-base">
              {isFa ? 'واحد ایمنی (چک‌لیست‌ها و بازرسی‌های فنی)' : 'Safety Checklists & Technical Inspections'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isFa ? 'پایش چک‌لیست‌های داربست، جرثقیل، برق، ماشین‌آلات و ترانشه' : 'Scaffolding, crane, electrical & machine checklists'}
            </p>
          </div>
        </div>

        <span className="text-xs font-black px-2.5 py-1 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 rounded-full">
          {passRate}% {isFa ? 'انطباق چک‌لیست' : 'Pass Rate'}
        </span>
      </div>

      {/* Badges */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 bg-sky-50/70 dark:bg-sky-950/40 rounded-xl border border-sky-200/60 dark:border-sky-800/50">
          <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold block">{isFa ? 'کل بازرسی‌ها' : 'Total'}</span>
          <strong className="text-lg font-black font-mono text-sky-600 dark:text-sky-400">{total}</strong>
        </div>
        <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50">
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">{isFa ? 'تاییدشده و سالم' : 'Compliant'}</span>
          <strong className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">{compliant}</strong>
        </div>
        <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200/60 dark:border-amber-800/50">
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">{isFa ? 'دارای نقص فنی' : 'Defective'}</span>
          <strong className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">{defective}</strong>
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
            <Bar dataKey="count" name={isFa ? 'تعداد چک‌لیست' : 'Checklists'} radius={[5, 5, 0, 0]}>
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
            onNavigate('safety-unit');
          }}
          className="w-full py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-sky-600 hover:text-white dark:hover:bg-sky-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>{isFa ? 'ورود به سامانه چک‌لیست‌ها و بازرسی ایمنی' : 'Go to Safety Checklists'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});

DashboardSafetyInspectionChart.displayName = 'DashboardSafetyInspectionChart';
