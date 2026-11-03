import React from 'react';
import { 
  PieChart as PieIcon, 
  BarChart3, 
  LayoutGrid, 
  Building2, 
  Layers, 
  Table as TableIcon, 
  Eye,
  AlignLeft,
  Radar as RadarIcon
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  LabelList,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend
} from 'recharts';
import { PermitTypeDistribution, UnitDefectStat } from '../services/ptwAuditAnalytics';
import { 
  ChartSettings, 
  THEME_PALETTES, 
  PermitChartType, 
  UnitsChartType 
} from './ChartCustomizationModal';

interface PtwAuditPermitDistributionProps {
  permitDistribution: PermitTypeDistribution[];
  unitRankings: UnitDefectStat[];
  chartSettings: ChartSettings;
  onUpdateChartSettings?: (newSettings: ChartSettings) => void;
  onOpenDrillDown: (title: string, description: string, filter: (a: any) => boolean) => void;
}

export default function PtwAuditPermitDistribution({
  permitDistribution,
  unitRankings,
  chartSettings,
  onUpdateChartSettings,
  onOpenDrillDown
}: PtwAuditPermitDistributionProps) {
  const permitView = chartSettings.permitTypeChart || 'donut';
  const unitView = chartSettings.unitsDefectChart || 'table';

  const palette = THEME_PALETTES[chartSettings.colorTheme] || THEME_PALETTES.safety;

  // Chart data for Permit Types
  const permitPieData = permitDistribution.map((p, idx) => ({
    name: p.titleFa,
    value: p.totalCount,
    defectiveCount: p.defectiveCount,
    defectRate: p.defectRate,
    permitTypeKey: p.permitTypeKey,
    color: palette.pieColors[idx % palette.pieColors.length]
  }));

  // Chart data for Units (top 10)
  const unitChartData = unitRankings.map((u, idx) => ({
    name: u.unitName.length > 16 ? u.unitName.slice(0, 16) + '...' : u.unitName,
    fullName: u.unitName,
    totalAudits: u.totalAudits,
    defectiveAudits: u.defectiveAudits,
    totalDefects: u.totalDefects,
    defectRate: u.defectRate,
    avgScore: u.avgScore,
    color: palette.pieColors[idx % palette.pieColors.length]
  })).slice(0, 10);

  const handleSetPermitView = (type: PermitChartType) => {
    if (onUpdateChartSettings) {
      onUpdateChartSettings({ ...chartSettings, permitTypeChart: type });
    }
  };

  const handleSetUnitView = (type: UnitsChartType) => {
    if (onUpdateChartSettings) {
      onUpdateChartSettings({ ...chartSettings, unitsDefectChart: type });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* ========================================================================= */}
      {/* 1. Permit Types Distribution */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" />
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                توزیع خطا بر اساس نوع پروانه کار
              </h2>
              <p className="text-xs text-slate-400">
                بررسی آسیب‌پذیری و نرخ خطای فرآیندی در انواع پروانه‌ها
              </p>
            </div>
          </div>

          {/* Quick Chart Type Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => handleSetPermitView('donut')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                permitView === 'donut'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار دونات (Donut)"
            >
              <PieIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetPermitView('pie')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                permitView === 'pie'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار دایره‌ای (Pie)"
            >
              <PieIcon className="w-3.5 h-3.5 fill-current opacity-70" />
            </button>
            <button
              onClick={() => handleSetPermitView('bar')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                permitView === 'bar'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار ستونی عمودی"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetPermitView('barHorizontal')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                permitView === 'barHorizontal'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار میله‌ای افقی"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetPermitView('radar')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                permitView === 'radar'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار راداری (عنکبوتی)"
            >
              <RadarIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetPermitView('cards')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                permitView === 'cards'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمای کارت‌های تحلیلی"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content View */}
        {permitView === 'donut' || permitView === 'pie' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240} debounce={50}>
                <PieChart>
                  <Tooltip 
                    formatter={(val: any, name: any) => [`${val} پروانه ممیزی‌شده`, name]}
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                  />
                  <Pie
                    data={permitPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={permitView === 'donut' ? 55 : 0}
                    outerRadius={85}
                    paddingAngle={permitView === 'donut' ? 3 : 1}
                    isAnimationActive={chartSettings.enableAnimation}
                  >
                    {permitPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {permitDistribution.map((p, idx) => (
                <div 
                  key={p.permitTypeKey}
                  onClick={() => onOpenDrillDown(
                    `ممیزی‌های پروانه ${p.titleFa}`,
                    `مشاهده تمام ${p.totalCount} ممیزی انجام‌شده برای پروانه‌های نوع ${p.titleFa}`,
                    (a) => a.permitType === p.permitTypeKey || (p.permitTypeKey === 'HOT' && a.permitType === 'HOT') || (p.permitTypeKey === 'COLD' && a.permitType === 'COLD')
                  )}
                  className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-blue-400 transition-all cursor-pointer flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full shrink-0" 
                      style={{ backgroundColor: palette.pieColors[idx % palette.pieColors.length] }} 
                    />
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {p.titleFa}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {p.totalCount} پروانه
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      p.defectRate > 20 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}>
                      {p.defectRate}% خطا
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : permitView === 'bar' ? (
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240} debounce={50}>
              <BarChart data={permitDistribution} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
                {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
                <XAxis dataKey="titleFa" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(val: any, name: any) => [
                    name === 'totalCount' ? `${val} کل` : `${val} دارای خطا`,
                    name === 'totalCount' ? 'کل ممیزی‌ها' : 'پروانه‌های دارای خطا'
                  ]}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                />
                <Bar 
                  dataKey="totalCount" 
                  name="totalCount" 
                  fill={palette.primary} 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={40}
                  isAnimationActive={chartSettings.enableAnimation}
                >
                  {chartSettings.showDataLabels && (
                    <LabelList dataKey="totalCount" position="top" fill="#64748b" fontSize={11} fontWeight="bold" />
                  )}
                </Bar>
                <Bar 
                  dataKey="defectiveCount" 
                  name="defectiveCount" 
                  fill={palette.secondary} 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={40}
                  isAnimationActive={chartSettings.enableAnimation}
                >
                  {chartSettings.showDataLabels && (
                    <LabelList dataKey="defectiveCount" position="top" fill="#e11d48" fontSize={11} fontWeight="bold" />
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : permitView === 'barHorizontal' ? (
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240} debounce={50}>
              <BarChart 
                data={permitDistribution} 
                layout="vertical"
                margin={{ top: 10, right: 30, left: 30, bottom: 5 }}
              >
                {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="titleFa" type="category" tick={{ fontSize: 11 }} width={90} />
                <Tooltip 
                  formatter={(val: any, name: any) => [
                    name === 'totalCount' ? `${val} کل` : `${val} دارای خطا`,
                    name === 'totalCount' ? 'کل ممیزی‌ها' : 'پروانه‌های دارای خطا'
                  ]}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                />
                <Bar 
                  dataKey="totalCount" 
                  name="totalCount" 
                  fill={palette.primary} 
                  radius={[0, 6, 6, 0]} 
                  maxBarSize={28}
                  isAnimationActive={chartSettings.enableAnimation}
                >
                  {chartSettings.showDataLabels && (
                    <LabelList dataKey="totalCount" position="right" fill="#64748b" fontSize={11} fontWeight="bold" />
                  )}
                </Bar>
                <Bar 
                  dataKey="defectiveCount" 
                  name="defectiveCount" 
                  fill={palette.secondary} 
                  radius={[0, 6, 6, 0]} 
                  maxBarSize={28}
                  isAnimationActive={chartSettings.enableAnimation}
                >
                  {chartSettings.showDataLabels && (
                    <LabelList dataKey="defectiveCount" position="right" fill="#e11d48" fontSize={11} fontWeight="bold" />
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : permitView === 'radar' ? (
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240} debounce={50}>
              <RadarChart data={permitDistribution}>
                <PolarGrid opacity={0.4} />
                <PolarAngleAxis dataKey="titleFa" tick={{ fontSize: 11, fill: '#64748b' }} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                />
                <Radar 
                  name="کل ممیزی‌ها" 
                  dataKey="totalCount" 
                  stroke={palette.primary} 
                  fill={palette.primary} 
                  fillOpacity={0.4} 
                  isAnimationActive={chartSettings.enableAnimation}
                />
                <Radar 
                  name="پروانه‌های دارای خطا" 
                  dataKey="defectiveCount" 
                  stroke={palette.secondary} 
                  fill={palette.secondary} 
                  fillOpacity={0.5} 
                  isAnimationActive={chartSettings.enableAnimation}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {permitDistribution.map((p) => (
              <div 
                key={p.permitTypeKey}
                onClick={() => onOpenDrillDown(
                  `ممیزی‌های پروانه ${p.titleFa}`,
                  `مشاهده تمام ${p.totalCount} ممیزی انجام‌شده برای پروانه‌های نوع ${p.titleFa}`,
                  (a) => a.permitType === p.permitTypeKey || (p.permitTypeKey === 'HOT' && a.permitType === 'HOT') || (p.permitTypeKey === 'COLD' && a.permitType === 'COLD')
                )}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-blue-400 transition-all cursor-pointer space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{p.titleFa}</span>
                  <span className="font-mono text-xs font-bold text-slate-500">{p.totalCount} ممیزی</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                  <div className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] text-slate-400">دارای خطا</div>
                    <div className="font-mono font-bold text-rose-600 mt-0.5">{p.defectiveCount}</div>
                  </div>
                  <div className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] text-slate-400">مجموع خطا</div>
                    <div className="font-mono font-bold text-amber-600 mt-0.5">{p.totalDefectsSum}</div>
                  </div>
                  <div className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] text-slate-400">نرخ خطا</div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">{p.defectRate}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 2. Operational Units Ranking */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                رتبه‌بندی خطای واحدهای عملیاتی
              </h2>
              <p className="text-xs text-slate-400">
                پایش میزان عدم انطباق‌ها و رتبه‌بندی انطباق ایمنی در واحدها
              </p>
            </div>
          </div>

          {/* Quick Chart Type Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => handleSetUnitView('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                unitView === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمای جدول آماری"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetUnitView('barHorizontal')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                unitView === 'barHorizontal'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار میله‌ای افقی"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetUnitView('bar')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                unitView === 'bar'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار ستونی عمودی"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetUnitView('pie')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                unitView === 'pie'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار دایره‌ای سهم خطا"
            >
              <PieIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetUnitView('radar')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                unitView === 'radar'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار راداری واحدها"
            >
              <RadarIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content View */}
        {unitRankings.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            هیچ رکوردی برای واحدهای عملیاتی یافت نشد.
          </div>
        ) : unitView === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                  <th className="py-2.5 px-2">نام واحد</th>
                  <th className="py-2.5 px-2 text-center">ممیزی‌ها</th>
                  <th className="py-2.5 px-2 text-center">دارای خطا</th>
                  <th className="py-2.5 px-2 text-center">مجموع خطا</th>
                  <th className="py-2.5 px-2 text-center">انطباق</th>
                  <th className="py-2.5 px-2 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {unitRankings.slice(0, 7).map((u) => (
                  <tr key={u.unitName} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-200">
                      {u.unitName}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono">{u.totalAudits}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-rose-600">{u.defectiveAudits}</td>
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-600">{u.totalDefects}</td>
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-600">{u.avgScore}%</td>
                    <td className="py-2.5 px-2 text-center">
                      <button
                        onClick={() => onOpenDrillDown(
                          `ممیزی‌های واحد ${u.unitName}`,
                          `مشاهده تمام ${u.totalAudits} ممیزی ثبت‌شده در واحد عملیاتی ${u.unitName}`,
                          (a) => a.unitName === u.unitName
                        )}
                        className="p-1 rounded-lg bg-slate-100 hover:bg-amber-500 hover:text-slate-950 dark:bg-slate-800 text-slate-600 dark:text-slate-400 transition-all cursor-pointer"
                        title="مشاهده پروانه‌ها"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : unitView === 'barHorizontal' ? (
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240} debounce={50}>
              <BarChart 
                data={unitChartData} 
                layout="vertical"
                margin={{ top: 5, right: 30, left: 30, bottom: 5 }}
              >
                {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                <Tooltip 
                  formatter={(val: any, name: any) => [
                    name === 'totalDefects' ? `${val} خطا` : `${val} ممیزی`,
                    name === 'totalDefects' ? 'مجموع خطاها' : 'کل ممیزی‌ها'
                  ]}
                  labelFormatter={(lbl, p) => p && p[0] ? (p[0].payload as any).fullName : lbl}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px', direction: 'rtl' }}
                />
                <Bar 
                  dataKey="totalDefects" 
                  name="totalDefects" 
                  fill={palette.secondary} 
                  radius={[0, 6, 6, 0]}
                  isAnimationActive={chartSettings.enableAnimation}
                >
                  {chartSettings.showDataLabels && (
                    <LabelList dataKey="totalDefects" position="right" fill="#e11d48" fontSize={11} fontWeight="bold" />
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : unitView === 'bar' ? (
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240} debounce={50}>
              <BarChart data={unitChartData} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
                {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip 
                  formatter={(val: any) => [`${val} خطا`, 'مجموع خطاها']}
                  labelFormatter={(lbl, p) => p && p[0] ? (p[0].payload as any).fullName : lbl}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px', direction: 'rtl' }}
                />
                <Bar 
                  dataKey="totalDefects" 
                  name="totalDefects" 
                  fill={palette.warning} 
                  radius={[6, 6, 0, 0]}
                  maxBarSize={35}
                  isAnimationActive={chartSettings.enableAnimation}
                >
                  {chartSettings.showDataLabels && (
                    <LabelList dataKey="totalDefects" position="top" fill="#f59e0b" fontSize={11} fontWeight="bold" />
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : unitView === 'pie' ? (
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240} debounce={50}>
              <PieChart>
                <Tooltip 
                  formatter={(val: any, name: any) => [`${val} خطا`, name]}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px', direction: 'rtl' }}
                />
                <Pie
                  data={unitChartData.filter(u => u.totalDefects > 0)}
                  dataKey="totalDefects"
                  nameKey="fullName"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  isAnimationActive={chartSettings.enableAnimation}
                >
                  {unitChartData.map((entry, index) => (
                    <Cell key={`cell-unit-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={240} debounce={50}>
              <RadarChart data={unitChartData.slice(0, 6)}>
                <PolarGrid opacity={0.4} />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 9 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px', direction: 'rtl' }}
                />
                <Radar 
                  name="مجموع خطاهای واحد" 
                  dataKey="totalDefects" 
                  stroke={palette.secondary} 
                  fill={palette.secondary} 
                  fillOpacity={0.4} 
                  isAnimationActive={chartSettings.enableAnimation}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>

    </div>
  );
}
