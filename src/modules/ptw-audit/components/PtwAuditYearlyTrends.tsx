import React, { useState } from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  LineChart as LineIcon, 
  Eye, 
  Activity,
  Radar as RadarIcon,
  History,
  PlusCircle,
  Sparkles,
  Layers,
  Percent,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  LabelList,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend
} from 'recharts';
import { YearlyTrendStat, MonthlyTrendStat, extractJalaliYear } from '../services/ptwAuditAnalytics';
import { 
  ChartSettings, 
  THEME_PALETTES, 
  YearlyChartType, 
  MonthlyChartType 
} from './ChartCustomizationModal';

interface PtwAuditYearlyTrendsProps {
  yearlyTrends: YearlyTrendStat[];
  monthlyTrends: MonthlyTrendStat[];
  selectedYear: string;
  chartSettings: ChartSettings;
  onUpdateChartSettings?: (newSettings: ChartSettings) => void;
  onOpenDrillDown: (title: string, description: string, filter: (a: any) => boolean) => void;
  onOpenHistoricalModal?: () => void;
}

export default function PtwAuditYearlyTrends({
  yearlyTrends,
  monthlyTrends,
  selectedYear,
  chartSettings,
  onUpdateChartSettings,
  onOpenDrillDown,
  onOpenHistoricalModal
}: PtwAuditYearlyTrendsProps) {
  const yearlyView = chartSettings.yearlyTrendChart || 'bar';
  const monthlyView = chartSettings.monthlyTrendChart || 'area';

  // Metric focus selector for multi-year trends: 'counts' | 'rates' | 'defects'
  const [metricMode, setMetricMode] = useState<'counts' | 'rates' | 'defects'>('counts');

  const palette = THEME_PALETTES[chartSettings.colorTheme] || THEME_PALETTES.safety;

  const handleSetYearlyView = (type: YearlyChartType) => {
    if (onUpdateChartSettings) {
      onUpdateChartSettings({ ...chartSettings, yearlyTrendChart: type });
    }
  };

  const handleSetMonthlyView = (type: MonthlyChartType) => {
    if (onUpdateChartSettings) {
      onUpdateChartSettings({ ...chartSettings, monthlyTrendChart: type });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6" id="ptw-yearly-trends-component">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                روند سالانه ممیزی پروانه کار و مقایسه عملکرد سال‌ها
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                مقایسه حجم کل ممیزی‌ها، خطاهای کشف‌شده و میانگین امتیاز انطباق سال جاری (خودکار) با سنوات گذشته (ثبت دستی)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Historical Data Entry Button */}
          {onOpenHistoricalModal && (
            <button
              onClick={onOpenHistoricalModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              title="ورود دستی یا ویرایش آمار و اطلاعات سال‌های گذشته"
            >
              <History className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>مدیریت آمار سنوات قبل</span>
            </button>
          )}

          {/* Metric Mode Toggle */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setMetricMode('counts')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                metricMode === 'counts'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              تعداد ممیزی و خطا
            </button>
            <button
              onClick={() => setMetricMode('rates')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                metricMode === 'rates'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              درصد خطا و انطباق
            </button>
            <button
              onClick={() => setMetricMode('defects')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                metricMode === 'defects'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              مجموع کل خطاها
            </button>
          </div>

          {/* Quick Switcher for Yearly Chart Type */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => handleSetYearlyView('bar')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                yearlyView === 'bar'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار ستونی مقایسه‌ای"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetYearlyView('line')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                yearlyView === 'line'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار خطی روند"
            >
              <LineIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetYearlyView('area')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                yearlyView === 'area'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار مساحتی (Area)"
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetYearlyView('radar')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                yearlyView === 'radar'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار راداری چندساله"
            >
              <RadarIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Yearly Multi-Bar / Line / Area / Radar Chart (2 Cols) */}
        <div className="lg:col-span-2 h-76 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280} debounce={50}>
            {yearlyView === 'bar' ? (
              <BarChart data={yearlyTrends} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />}
                <XAxis dataKey="year" tickFormatter={(y) => `سال ${y}`} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(val: any, name: any) => {
                    if (name === 'totalAudits') return [`${val} ممیزی`, 'کل ممیزی‌ها'];
                    if (name === 'defectiveAudits') return [`${val} پروانه`, 'پروانه‌های دارای خطا'];
                    if (name === 'cleanAudits') return [`${val} پروانه`, 'پروانه‌های منطبق'];
                    if (name === 'defectRate') return [`${val}%`, 'درصد خطا'];
                    if (name === 'avgComplianceScore') return [`${val}%`, 'میانگین امتیاز انطباق'];
                    if (name === 'totalDefectsSum') return [`${val} نقص`, 'مجموع خطاها'];
                    return [val, name];
                  }}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                />
                
                {metricMode === 'counts' && (
                  <>
                    <Bar 
                      dataKey="totalAudits" 
                      name="totalAudits" 
                      fill={palette.primary} 
                      radius={[6, 6, 0, 0]} 
                      maxBarSize={40}
                      isAnimationActive={chartSettings.enableAnimation}
                    >
                      {chartSettings.showDataLabels && (
                        <LabelList dataKey="totalAudits" position="top" fill="#64748b" fontSize={11} fontWeight="bold" />
                      )}
                    </Bar>
                    <Bar 
                      dataKey="defectiveAudits" 
                      name="defectiveAudits" 
                      fill={palette.secondary} 
                      radius={[6, 6, 0, 0]} 
                      maxBarSize={40}
                      isAnimationActive={chartSettings.enableAnimation}
                    >
                      {chartSettings.showDataLabels && (
                        <LabelList dataKey="defectiveAudits" position="top" fill="#e11d48" fontSize={11} fontWeight="bold" />
                      )}
                    </Bar>
                  </>
                )}

                {metricMode === 'rates' && (
                  <>
                    <Bar 
                      dataKey="avgComplianceScore" 
                      name="avgComplianceScore" 
                      fill="#10b981" 
                      radius={[6, 6, 0, 0]} 
                      maxBarSize={40}
                      isAnimationActive={chartSettings.enableAnimation}
                    >
                      {chartSettings.showDataLabels && (
                        <LabelList dataKey="avgComplianceScore" position="top" fill="#10b981" fontSize={11} fontWeight="bold" formatter={(v: any) => `${v}%`} />
                      )}
                    </Bar>
                    <Bar 
                      dataKey="defectRate" 
                      name="defectRate" 
                      fill="#f59e0b" 
                      radius={[6, 6, 0, 0]} 
                      maxBarSize={40}
                      isAnimationActive={chartSettings.enableAnimation}
                    >
                      {chartSettings.showDataLabels && (
                        <LabelList dataKey="defectRate" position="top" fill="#d97706" fontSize={11} fontWeight="bold" formatter={(v: any) => `${v}%`} />
                      )}
                    </Bar>
                  </>
                )}

                {metricMode === 'defects' && (
                  <Bar 
                    dataKey="totalDefectsSum" 
                    name="totalDefectsSum" 
                    fill="#ef4444" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={50}
                    isAnimationActive={chartSettings.enableAnimation}
                  >
                    {chartSettings.showDataLabels && (
                      <LabelList dataKey="totalDefectsSum" position="top" fill="#ef4444" fontSize={11} fontWeight="bold" />
                    )}
                  </Bar>
                )}
              </BarChart>
            ) : yearlyView === 'line' ? (
              <LineChart data={yearlyTrends} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />}
                <XAxis dataKey="year" tickFormatter={(y) => `سال ${y}`} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                />
                {metricMode === 'counts' ? (
                  <>
                    <Line 
                      type="monotone" 
                      dataKey="totalAudits" 
                      name="کل ممیزی‌ها"
                      stroke={palette.primary} 
                      strokeWidth={3} 
                      dot={{ r: 5 }} 
                      isAnimationActive={chartSettings.enableAnimation}
                    >
                      {chartSettings.showDataLabels && (
                        <LabelList dataKey="totalAudits" position="top" fill={palette.primary} fontSize={11} fontWeight="bold" />
                      )}
                    </Line>
                    <Line 
                      type="monotone" 
                      dataKey="defectiveAudits" 
                      name="پروانه‌های دارای خطا"
                      stroke={palette.secondary} 
                      strokeWidth={3} 
                      dot={{ r: 5 }} 
                      isAnimationActive={chartSettings.enableAnimation}
                    >
                      {chartSettings.showDataLabels && (
                        <LabelList dataKey="defectiveAudits" position="bottom" fill={palette.secondary} fontSize={11} fontWeight="bold" />
                      )}
                    </Line>
                  </>
                ) : metricMode === 'rates' ? (
                  <>
                    <Line 
                      type="monotone" 
                      dataKey="avgComplianceScore" 
                      name="امتیاز انطباق (%)"
                      stroke="#10b981" 
                      strokeWidth={3} 
                      dot={{ r: 5 }} 
                      isAnimationActive={chartSettings.enableAnimation}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="defectRate" 
                      name="درصد خطا (%)"
                      stroke="#f59e0b" 
                      strokeWidth={3} 
                      dot={{ r: 5 }} 
                      isAnimationActive={chartSettings.enableAnimation}
                    />
                  </>
                ) : (
                  <Line 
                    type="monotone" 
                    dataKey="totalDefectsSum" 
                    name="مجموع خطاها"
                    stroke="#ef4444" 
                    strokeWidth={3} 
                    dot={{ r: 5 }} 
                    isAnimationActive={chartSettings.enableAnimation}
                  />
                )}
                <Legend />
              </LineChart>
            ) : yearlyView === 'area' ? (
              <AreaChart data={yearlyTrends} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorYearlyPrimary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={palette.primary} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={palette.primary} stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorYearlySecondary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={palette.secondary} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={palette.secondary} stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
                <XAxis dataKey="year" tickFormatter={(y) => `سال ${y}`} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                />
                <Area 
                  type="monotone" 
                  dataKey={metricMode === 'rates' ? 'avgComplianceScore' : 'totalAudits'} 
                  name={metricMode === 'rates' ? 'میانگین امتیاز انطباق' : 'کل ممیزی‌ها'}
                  stroke={palette.primary} 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorYearlyPrimary)" 
                  isAnimationActive={chartSettings.enableAnimation}
                />
                <Line 
                  type="monotone" 
                  dataKey={metricMode === 'rates' ? 'defectRate' : 'defectiveAudits'} 
                  name={metricMode === 'rates' ? 'درصد خطا' : 'پروانه‌های دارای خطا'}
                  stroke={palette.secondary} 
                  strokeWidth={3} 
                  dot={{ r: 4 }} 
                  isAnimationActive={chartSettings.enableAnimation}
                />
                <Legend />
              </AreaChart>
            ) : (
              <RadarChart data={yearlyTrends}>
                <PolarGrid opacity={0.4} />
                <PolarAngleAxis dataKey="year" tickFormatter={(y) => `سال ${y}`} tick={{ fontSize: 11, fill: '#64748b' }} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                />
                <Radar 
                  name="کل ممیزی‌ها" 
                  dataKey="totalAudits" 
                  stroke={palette.primary} 
                  fill={palette.primary} 
                  fillOpacity={0.4} 
                  isAnimationActive={chartSettings.enableAnimation}
                />
                <Radar 
                  name="پروانه‌های دارای خطا" 
                  dataKey="defectiveAudits" 
                  stroke={palette.secondary} 
                  fill={palette.secondary} 
                  fillOpacity={0.5} 
                  isAnimationActive={chartSettings.enableAnimation}
                />
                <Legend />
              </RadarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Monthly Trend Mini Chart for Selected Year */}
        <div className="h-76 w-full bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            <span>توزیع ماهانه ممیزی‌ها (۱۲ ماه)</span>
            <div className="flex items-center gap-1.5">
              <span className="text-amber-600 font-mono text-[11px] font-bold">
                {selectedYear === 'ALL' ? 'همه سال‌ها' : `سال ${selectedYear}`}
              </span>
              <div className="flex items-center gap-0.5 bg-slate-200/80 dark:bg-slate-700 p-0.5 rounded-lg">
                <button
                  onClick={() => handleSetMonthlyView('area')}
                  className={`p-1 rounded-md text-[10px] cursor-pointer transition-all ${
                    monthlyView === 'area' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white font-bold shadow-xs' : 'text-slate-500'
                  }`}
                  title="مساحتی"
                >
                  <Activity className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleSetMonthlyView('bar')}
                  className={`p-1 rounded-md text-[10px] cursor-pointer transition-all ${
                    monthlyView === 'bar' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white font-bold shadow-xs' : 'text-slate-500'
                  }`}
                  title="ستونی"
                >
                  <BarChart3 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleSetMonthlyView('line')}
                  className={`p-1 rounded-md text-[10px] cursor-pointer transition-all ${
                    monthlyView === 'line' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white font-bold shadow-xs' : 'text-slate-500'
                  }`}
                  title="خطی"
                >
                  <LineIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="h-56 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={210} debounce={50}>
              {monthlyView === 'area' ? (
                <AreaChart data={monthlyTrends}>
                  <defs>
                    <linearGradient id="colorTotalMonthly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={palette.primary} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={palette.primary} stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
                  <XAxis dataKey="monthName" tick={{ fontSize: 9 }} interval={1} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    formatter={(val: any, name: any) => [val, name === 'totalAudits' ? 'کل ممیزی' : 'دارای خطا']}
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px', direction: 'rtl' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="totalAudits" 
                    stroke={palette.primary} 
                    fillOpacity={1} 
                    fill="url(#colorTotalMonthly)" 
                    isAnimationActive={chartSettings.enableAnimation}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="defectiveAudits" 
                    stroke={palette.secondary} 
                    strokeWidth={2} 
                    dot={{ r: 3 }} 
                    isAnimationActive={chartSettings.enableAnimation}
                  />
                </AreaChart>
              ) : monthlyView === 'bar' ? (
                <BarChart data={monthlyTrends}>
                  {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
                  <XAxis dataKey="monthName" tick={{ fontSize: 9 }} interval={1} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    formatter={(val: any, name: any) => [val, name === 'totalAudits' ? 'کل ممیزی' : 'دارای خطا']}
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px', direction: 'rtl' }}
                  />
                  <Bar 
                    dataKey="totalAudits" 
                    fill={palette.primary} 
                    radius={[4, 4, 0, 0]} 
                    isAnimationActive={chartSettings.enableAnimation}
                  >
                    {chartSettings.showDataLabels && (
                      <LabelList dataKey="totalAudits" position="top" fill="#64748b" fontSize={9} />
                    )}
                  </Bar>
                  <Bar 
                    dataKey="defectiveAudits" 
                    fill={palette.secondary} 
                    radius={[4, 4, 0, 0]} 
                    isAnimationActive={chartSettings.enableAnimation}
                  />
                </BarChart>
              ) : (
                <LineChart data={monthlyTrends}>
                  {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
                  <XAxis dataKey="monthName" tick={{ fontSize: 9 }} interval={1} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    formatter={(val: any, name: any) => [val, name === 'totalAudits' ? 'کل ممیزی' : 'دارای خطا']}
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px', direction: 'rtl' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="totalAudits" 
                    stroke={palette.primary} 
                    strokeWidth={2.5}
                    dot={{ r: 3 }} 
                    isAnimationActive={chartSettings.enableAnimation}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="defectiveAudits" 
                    stroke={palette.secondary} 
                    strokeWidth={2} 
                    dot={{ r: 3 }} 
                    isAnimationActive={chartSettings.enableAnimation}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="text-[10px] text-slate-400 text-center">
            پایش فصلی و ماهانه جهت بازرسی‌های دوره‌ای HSE
          </div>
        </div>

      </div>

      {/* Yearly Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold bg-slate-50/50 dark:bg-slate-800/40">
              <th className="py-3 px-3">سال</th>
              <th className="py-3 px-3 text-center">منبع داده</th>
              <th className="py-3 px-3 text-center">تعداد کل ممیزی‌ها</th>
              <th className="py-3 px-3 text-center">پروانه‌های دارای خطا</th>
              <th className="py-3 px-3 text-center">پروانه‌های منطبق (بدون خطا)</th>
              <th className="py-3 px-3 text-center">درصد پروانه‌های دارای خطا</th>
              <th className="py-3 px-3 text-center">مجموع کل خطاها</th>
              <th className="py-3 px-3 text-center">میانگین امتیاز انطباق</th>
              <th className="py-3 px-3 text-center">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
            {yearlyTrends.map((y, idx) => {
              const isManual = y.source === 'manual' || y.isManualEntry;
              return (
                <tr key={`yearly-row-${y.year || idx}-${isManual ? 'manual' : 'sys'}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3.5 px-3 font-bold font-mono text-slate-900 dark:text-white text-sm">
                    سال {y.year}
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    {isManual ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-300 dark:border-amber-800">
                        <span>ثبت دستی سنوات قبل</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-300 dark:border-emerald-800">
                        <span>محاسبه خودکار سیستمی</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono font-bold" style={{ color: palette.primary }}>
                    {y.totalAudits}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono font-bold" style={{ color: palette.secondary }}>
                    {y.defectiveAudits}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {y.cleanAudits}
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <span className={`font-mono font-bold px-2 py-0.5 rounded-lg ${
                      y.defectRate > 25 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                      y.defectRate > 10 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' :
                      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}>
                      {y.defectRate}%
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono font-bold text-amber-600">
                    {y.totalDefectsSum}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono font-bold text-emerald-600">
                    {y.avgComplianceScore}%
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    {!isManual ? (
                      <button
                        onClick={() => onOpenDrillDown(
                          `ممیزی‌های سال ${y.year}`,
                          `مشاهده تمام ${y.totalAudits} ممیزی ثبت‌شده در سال ${y.year}`,
                          (a) => extractJalaliYear(a.auditDate) === y.year
                        )}
                        className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-amber-500 hover:text-slate-950 dark:bg-slate-800 dark:hover:bg-amber-500 dark:hover:text-slate-950 text-slate-700 dark:text-slate-300 font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                        title="مشاهده رکوردهای ثبتی این سال"
                      >
                        <Eye className="w-3 h-3" />
                        <span>مشاهده ممیزی‌ها</span>
                      </button>
                    ) : (
                      <button
                        onClick={onOpenHistoricalModal}
                        className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-500 hover:text-slate-950 dark:bg-amber-950/50 dark:hover:bg-amber-500 dark:hover:text-slate-950 text-amber-800 dark:text-amber-300 font-bold transition-all cursor-pointer inline-flex items-center gap-1 border border-amber-300/50 dark:border-amber-800/50"
                        title="ویرایش اطلاعات این سال"
                      >
                        <History className="w-3 h-3" />
                        <span>ویرایش آمار</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}

