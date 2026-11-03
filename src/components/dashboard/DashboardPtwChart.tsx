import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { FileCheck, PieChart as PieIcon, BarChart2, CheckCircle2, AlertOctagon, Clock, Flame } from 'lucide-react';

interface DashboardPtwChartProps {
  permitsData?: {
    total: number;
    active: number;
    pending: number;
    closed: number;
    byType: {
      hot: number;
      cold: number;
      height: number;
      confined: number;
      electrical: number;
      excavation: number;
      other: number;
    };
  };
  isFa: boolean;
  onNavigate?: (tab: any) => void;
}

const COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#10b981', '#64748b'];

export const DashboardPtwChart: React.FC<DashboardPtwChartProps> = ({
  permitsData,
  isFa,
  onNavigate,
}) => {
  const [viewType, setViewType] = useState<'bar' | 'pie'>('bar');

  const rawByType = permitsData?.byType || {
    hot: 0,
    cold: 0,
    height: 0,
    confined: 0,
    electrical: 0,
    excavation: 0,
    other: 0,
  };

  const chartData = [
    { name: isFa ? 'کار گرم' : 'Hot Work', count: rawByType.hot, key: 'hot' },
    { name: isFa ? 'کار سرد' : 'Cold Work', count: rawByType.cold, key: 'cold' },
    { name: isFa ? 'کار در ارتفاع' : 'Height', count: rawByType.height, key: 'height' },
    { name: isFa ? 'فضای بسته' : 'Confined Space', count: rawByType.confined, key: 'confined' },
    { name: isFa ? 'برق و انرژی' : 'Electrical', count: rawByType.electrical, key: 'electrical' },
    { name: isFa ? 'حفاری' : 'Excavation', count: rawByType.excavation, key: 'excavation' },
  ].filter(item => item.count >= 0);

  const totalCount = permitsData?.total || 0;
  const activeCount = permitsData?.active || 0;
  const pendingCount = permitsData?.pending || 0;

  return (
    <div 
      onClick={() => onNavigate && onNavigate('permit')}
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 h-full cursor-pointer hover:border-amber-400 dark:hover:border-amber-600 transition-all duration-200"
      title={isFa ? 'کلیک جهت انتقال به ماژول پروانه کار (PTW)' : 'Click to navigate to Work Permits'}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-base">
              {isFa ? 'پایش پروانه‌های کار فعال و پرخطر (PTW)' : 'Work Permits (PTW) Monitoring'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {isFa ? 'تفکیک آماری مجوزهای کار به تفکیک نوع خطر و عملیات' : 'Statistical breakdown of work permits by hazard type'}
            </p>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-xl p-0.5 border border-slate-200/80 dark:border-slate-700/80 text-xs">
          <button
            type="button"
            onClick={() => setViewType('bar')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
              viewType === 'bar'
                ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>{isFa ? 'ستونی' : 'Bar'}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewType('pie')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
              viewType === 'pie'
                ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            <span>{isFa ? 'دایره‌ای' : 'Pie'}</span>
          </button>
        </div>
      </div>

      {/* Quick Summary Badges */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <span className="text-[10px] text-slate-500 font-bold block">{isFa ? 'کل مجوزها' : 'Total'}</span>
          <strong className="text-lg font-black font-mono text-slate-800 dark:text-slate-100">{totalCount}</strong>
        </div>
        <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-800/50">
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">{isFa ? 'فعال و جاری' : 'Active'}</span>
          <strong className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">{activeCount}</strong>
        </div>
        <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200/60 dark:border-amber-800/50">
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">{isFa ? 'در انتظار تایید' : 'Pending'}</span>
          <strong className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">{pendingCount}</strong>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="flex-1 min-h-[170px] w-full min-w-0">
        <ResponsiveContainer width="100%" height={170} minWidth={0} minHeight={170} debounce={50}>
          {viewType === 'bar' ? (
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
              <Bar dataKey="count" name={isFa ? 'تعداد مجوز' : 'Permits Count'} fill="#f59e0b" radius={[4, 4, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <PieChart>
              <Pie
                data={chartData.filter(d => d.count > 0).length > 0 ? chartData.filter(d => d.count > 0) : [{ name: isFa ? 'بدون داده' : 'No Data', count: 1 }]}
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={65}
                paddingAngle={3}
                dataKey="count"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
              <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>

      {onNavigate && (
        <button
          type="button"
          onClick={() => onNavigate('ptw')}
          className="w-full py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1"
        >
          <span>{isFa ? 'مشاهده و صدور پروانه‌های کار (PTW)' : 'Go to PTW Module'}</span>
        </button>
      )}
    </div>
  );
};
