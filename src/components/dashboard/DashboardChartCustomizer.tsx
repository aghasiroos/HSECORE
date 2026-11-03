import React, { useState, useMemo, useEffect } from 'react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  ComposedChart, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine, 
  LabelList 
} from 'recharts';
import { 
  Sliders, 
  BarChart2, 
  Activity, 
  TrendingUp, 
  Calendar, 
  Eye, 
  Check, 
  X, 
  RotateCcw,
  Sparkles,
  Lock,
  Layers,
  Database
} from 'lucide-react';
import { TrirSeriesPoint } from '../../types';

export type DashboardChartType = 'area' | 'bar' | 'line' | 'composed';
export type DashboardChartHorizon = '3M' | '6M' | '12M' | 'all';
export type DashboardChartMetric = 'incidents' | 'trir' | 'manhours' | 'dual';

export interface DashboardChartConfig {
  chartType: DashboardChartType;
  horizon: DashboardChartHorizon;
  metric: DashboardChartMetric;
  showGrid: boolean;
  showDataLabels: boolean;
  showTargetLine: boolean;
  curveType: 'monotone' | 'linear' | 'step';
}

export const DEFAULT_CHART_CONFIG: DashboardChartConfig = {
  chartType: 'area',
  horizon: '12M',
  metric: 'incidents',
  showGrid: true,
  showDataLabels: true,
  showTargetLine: true,
  curveType: 'monotone',
};

interface DashboardChartCustomizerProps {
  trirSeries: TrirSeriesPoint[];
  trirTarget: number;
  isFa: boolean;
  onRemoveCard?: () => void;
  config?: DashboardChartConfig;
  onSaveConfig?: (newConfig: DashboardChartConfig) => void;
  isAdmin?: boolean;
  onNavigate?: (tab: any) => void;
}

export const DashboardChartCustomizer: React.FC<DashboardChartCustomizerProps> = ({
  trirSeries,
  trirTarget,
  isFa,
  onRemoveCard,
  config: externalConfig,
  onSaveConfig,
  isAdmin = true,
  onNavigate,
}) => {
  // Sync state with layout config persisted in database
  const [internalConfig, setInternalConfig] = useState<DashboardChartConfig>(() => {
    return externalConfig || DEFAULT_CHART_CONFIG;
  });

  useEffect(() => {
    if (externalConfig) {
      setInternalConfig(externalConfig);
    }
  }, [externalConfig]);

  const config = externalConfig || internalConfig;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Update helper that immediately notifies parent to persist to database
  const updateConfig = (updater: (prev: DashboardChartConfig) => DashboardChartConfig) => {
    if (!isAdmin) return;
    const nextConfig = updater(config);
    setInternalConfig(nextConfig);
    if (onSaveConfig) {
      onSaveConfig(nextConfig);
    }
  };

  // Dark mode detection for chart SVGs
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', checkDark);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', checkDark);
    };
  }, []);

  // Filter series according to selected horizon
  const filteredSeries = useMemo(() => {
    if (!trirSeries || trirSeries.length === 0) return [];
    switch (config.horizon) {
      case '3M': return trirSeries.slice(-3);
      case '6M': return trirSeries.slice(-6);
      case '12M': return trirSeries.slice(-12);
      case 'all': return trirSeries;
      default: return trirSeries.slice(-12);
    }
  }, [trirSeries, config.horizon]);

  // Transform data for charting
  const chartData = useMemo(() => {
    return filteredSeries.map(point => {
      const manHours = Number(point.totalHours || (point.attendance + point.mission + point.contractor) || 0);
      return {
        ...point,
        label: `${point.month} ${point.year}`,
        incidentsCount: Number(point.incidents || 0),
        monthlyTRIR: Number(point.monthlyTRIR || 0),
        rollingTRIR: Number(point.rollingTRIR || 0),
        manHours: Math.round(manHours),
        manHoursInK: Math.round(manHours / 1000),
      };
    });
  }, [filteredSeries]);

  // Indicators calculations
  const totalIncidentsInView = useMemo(() => {
    return chartData.reduce((sum, p) => sum + p.incidentsCount, 0);
  }, [chartData]);

  const totalSafeHoursInView = useMemo(() => {
    return chartData.reduce((sum, p) => sum + p.manHours, 0);
  }, [chartData]);

  const avgTRIRInView = useMemo(() => {
    if (chartData.length === 0) return 0;
    const sum = chartData.reduce((acc, p) => acc + (p.rollingTRIR || p.monthlyTRIR || 0), 0);
    return (sum / chartData.length).toFixed(2);
  }, [chartData]);

  // Formatters
  const fmtNum = (n: number | undefined, dec = 1) => {
    if (n === undefined || isNaN(n)) return '—';
    return n.toLocaleString(isFa ? 'fa-IR' : 'en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec
    });
  };

  const fmtInt = (n: number | undefined) => {
    if (n === undefined || isNaN(n)) return '—';
    return n.toLocaleString(isFa ? 'fa-IR' : 'en-US');
  };

  // Label renderer with dark mode halo
  const renderDataLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (value === null || value === undefined || Number(value) < 0) return null;
    const formatted = typeof value === 'number' ? (value % 1 !== 0 ? value.toFixed(1) : value) : value;

    const fill = isDark ? '#f8fafc' : '#0f172a';
    const stroke = isDark ? '#0b0f19' : '#ffffff';

    const posX = width !== undefined ? Math.round(x + width / 2) : x;
    const posY = Math.round(y - 6);

    return (
      <text
        x={posX}
        y={posY}
        textAnchor="middle"
        fill={fill}
        fontSize={10}
        fontWeight="bold"
        style={{
          fill,
          fontWeight: 800,
          paintOrder: 'stroke fill',
          stroke,
          strokeWidth: 2.5,
          strokeLinejoin: 'round',
        }}
      >
        {formatted}
      </text>
    );
  };

  const activeMetricKey = config.metric === 'trir' ? 'rollingTRIR' : config.metric === 'manhours' ? 'manHoursInK' : 'incidentsCount';
  const activeMetricName = config.metric === 'trir' 
    ? (isFa ? 'شاخص TRIR' : 'TRIR Index') 
    : config.metric === 'manhours' 
    ? (isFa ? 'نفر-ساعت (هزار)' : 'Man-Hours (k)') 
    : (isFa ? 'تعداد حوادث' : 'Incident Count');

  return (
    <div 
      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 relative h-full"
      id="dashboard-combined-incident"
    >
      {/* Header with Title and Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-[18px]">
              {isFa ? 'روند و فراوانی شاخص‌های HSE' : 'Site HSE Trend & Analytics'}
            </h3>
            <span className="px-2 py-0.5 text-[9px] font-black bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 rounded-full text-indigo-600 dark:text-indigo-400 uppercase">
              {config.horizon === 'all' ? (isFa ? 'کل تاریخچه' : 'All') : `${config.horizon}`}
            </span>
            <span className="px-2 py-0.5 text-[9px] font-black bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 rounded-full text-blue-600 dark:text-blue-400">
              {activeMetricName}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isFa 
              ? `نمایش تحلیلی ${config.chartType === 'area' ? 'مساحتی' : config.chartType === 'bar' ? 'ستونی' : config.chartType === 'line' ? 'خطی' : 'ترکیبی'} بر اساس داده‌های استخراج‌شده از پایگاه داده`
              : `Dynamic ${config.chartType} analytical visualization directly connected to database`}
          </p>
        </div>

        {/* Quick Customization Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Quick Chart Type Buttons */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-xl p-0.5 border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => updateConfig(prev => ({ ...prev, chartType: 'area' }))}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${isAdmin ? 'cursor-pointer' : 'cursor-default'} ${
                config.chartType === 'area'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title={isFa ? 'نمودار مساحتی' : 'Area Chart'}
            >
              {isFa ? 'مساحتی' : 'Area'}
            </button>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => updateConfig(prev => ({ ...prev, chartType: 'bar' }))}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${isAdmin ? 'cursor-pointer' : 'cursor-default'} ${
                config.chartType === 'bar'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title={isFa ? 'نمودار ستونی' : 'Bar Chart'}
            >
              {isFa ? 'ستونی' : 'Bar'}
            </button>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => updateConfig(prev => ({ ...prev, chartType: 'line' }))}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${isAdmin ? 'cursor-pointer' : 'cursor-default'} ${
                config.chartType === 'line'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title={isFa ? 'نمودار خطی' : 'Line Chart'}
            >
              {isFa ? 'خطی' : 'Line'}
            </button>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => updateConfig(prev => ({ ...prev, chartType: 'composed', metric: 'dual' }))}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${isAdmin ? 'cursor-pointer' : 'cursor-default'} ${
                config.chartType === 'composed'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title={isFa ? 'نمودار ترکیبی حوادث و TRIR' : 'Composed'}
            >
              {isFa ? 'ترکیبی' : 'Dual'}
            </button>
          </div>

          {/* Quick Horizon Buttons */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-xl p-0.5 border border-slate-200/80 dark:border-slate-700/80 text-xs">
            {(['3M', '6M', '12M', 'all'] as DashboardChartHorizon[]).map(hz => (
              <button
                key={hz}
                type="button"
                disabled={!isAdmin}
                onClick={() => updateConfig(prev => ({ ...prev, horizon: hz }))}
                className={`px-2 py-1 rounded-lg font-bold transition ${isAdmin ? 'cursor-pointer' : 'cursor-default'} ${
                  config.horizon === hz
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {hz === 'all' ? (isFa ? 'کل' : 'All') : hz}
              </button>
            ))}
          </div>

          {/* Module Navigation Button */}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('hse-ms')}
              className="p-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
              title={isFa ? 'انتقال به ماژول پایش نرخ رویدادها و شاخص TRIR' : 'Open Incident Rates & TRIR Module'}
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isFa ? 'ماژول پایش نرخ رویدادها' : 'TRIR Module'}</span>
            </button>
          )}

          {/* Settings Toggle Button */}
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-1.5 rounded-xl border transition cursor-pointer ${
                isSettingsOpen 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
              title={isFa ? 'شخصی‌سازی پیشرفته نمودار (مدیر اصلی)' : 'Customize Chart Options (Admin)'}
            >
              <Sliders className="w-4 h-4" />
            </button>
          ) : (
            <span 
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700"
              title={isFa ? 'شخصی‌سازی نمودار فقط در اختیار مدیر اصلی است' : 'Chart settings controlled by Administrator'}
            >
              <Lock className="w-4 h-4" />
            </span>
          )}

          {/* Remove Card Button if in Admin Edit Mode */}
          {isAdmin && onRemoveCard && (
            <button
              type="button"
              onClick={onRemoveCard}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition cursor-pointer"
              title={isFa ? 'حذف این کارت از داشبورد' : 'Remove from dashboard'}
              aria-label="Remove card"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Advanced Chart Settings Popover Panel (Requirement 5: Chart Type, Metric, Horizon, Filters) */}
      {isAdmin && isSettingsOpen && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/60 pb-2">
            <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-500" />
              {isFa ? 'شخصی‌سازی پیشرفته شاخص و نمایش نمودار (ذخیره در پایگاه داده)' : 'Chart Metric & Visualization Settings (Saved to Database)'}
            </span>
            <button
              type="button"
              onClick={() => updateConfig(() => DEFAULT_CHART_CONFIG)}
              className="text-[10px] font-bold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{isFa ? 'بازنشانی تنظیمات' : 'Reset to Default'}</span>
            </button>
          </div>

          {/* Metric Selector (Requirement 5) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {isFa ? 'انتخاب شاخص داده مورد نمایش:' : 'Select Display Metric:'}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <button
                type="button"
                onClick={() => updateConfig(prev => ({ ...prev, metric: 'incidents', chartType: prev.chartType === 'composed' ? 'area' : prev.chartType }))}
                className={`p-2 rounded-xl border text-center font-bold transition cursor-pointer ${
                  config.metric === 'incidents'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                {isFa ? 'تعداد حوادث' : 'Incident Count'}
              </button>
              <button
                type="button"
                onClick={() => updateConfig(prev => ({ ...prev, metric: 'trir', chartType: prev.chartType === 'composed' ? 'line' : prev.chartType }))}
                className={`p-2 rounded-xl border text-center font-bold transition cursor-pointer ${
                  config.metric === 'trir'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                {isFa ? 'شاخص TRIR' : 'TRIR Index'}
              </button>
              <button
                type="button"
                onClick={() => updateConfig(prev => ({ ...prev, metric: 'manhours', chartType: prev.chartType === 'composed' ? 'bar' : prev.chartType }))}
                className={`p-2 rounded-xl border text-center font-bold transition cursor-pointer ${
                  config.metric === 'manhours'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                {isFa ? 'نفر-ساعت ایمن' : 'Safe Man-Hours'}
              </button>
              <button
                type="button"
                onClick={() => updateConfig(prev => ({ ...prev, metric: 'dual', chartType: 'composed' }))}
                className={`p-2 rounded-xl border text-center font-bold transition cursor-pointer ${
                  config.metric === 'dual'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                {isFa ? 'ترکیبی (حوادث + TRIR)' : 'Dual (Incident+TRIR)'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            {/* Toggle Data Labels */}
            <label className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 cursor-pointer">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {isFa ? 'نمایش ارقام روی نمودار' : 'Show Data Labels'}
              </span>
              <input
                type="checkbox"
                checked={config.showDataLabels}
                onChange={(e) => updateConfig(prev => ({ ...prev, showDataLabels: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
              />
            </label>

            {/* Toggle Grid Lines */}
            <label className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 cursor-pointer">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {isFa ? 'نمایش خطوط شبکه (Grid)' : 'Show Grid Lines'}
              </span>
              <input
                type="checkbox"
                checked={config.showGrid}
                onChange={(e) => updateConfig(prev => ({ ...prev, showGrid: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
              />
            </label>

            {/* Toggle Target Benchmark Line */}
            <label className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 cursor-pointer">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {isFa ? 'خط حد هدف OSHA' : 'Target Reference Line'}
              </span>
              <input
                type="checkbox"
                checked={config.showTargetLine}
                onChange={(e) => updateConfig(prev => ({ ...prev, showTargetLine: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
              />
            </label>
          </div>
        </div>
      )}

      {/* Main Chart Canvas */}
      <div className="h-44 sm:h-52 w-full min-w-0 flex-1" id="dashboard-trend-chart-compact">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={192} minWidth={0} minHeight={160} debounce={50}>
            {config.chartType === 'area' && config.metric !== 'dual' ? (
              <AreaChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncidentSCADA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                {config.showGrid && (
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'} />
                )}
                <XAxis 
                  dataKey="label" 
                  tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 10, fontWeight: 'bold' }}
                  axisLine={{ stroke: isDark ? '#475569' : '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 10, fontWeight: 'bold' }}
                  axisLine={{ stroke: isDark ? '#475569' : '#e2e8f0' }}
                  tickLine={false}
                  domain={[0, 'auto']}
                  allowDecimals={config.metric === 'trir'}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                    borderColor: isDark ? '#334155' : '#cbd5e1', 
                    borderRadius: '14px', 
                    color: isDark ? '#f8fafc' : '#0f172a', 
                    fontSize: '11px', 
                    fontWeight: 'bold',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
                  }}
                />
                {config.showTargetLine && config.metric === 'trir' && (
                  <ReferenceLine 
                    y={trirTarget} 
                    stroke="#ef4444" 
                    strokeDasharray="4 4" 
                    strokeWidth={2}
                    label={{
                      value: `Target: ${trirTarget}`,
                      fill: isDark ? '#fca5a5' : '#dc2626',
                      fontSize: 10,
                      fontWeight: 'bold',
                      position: 'insideTopRight'
                    }}
                  />
                )}
                <Area 
                  type={config.curveType} 
                  dataKey={activeMetricKey} 
                  name={activeMetricName} 
                  stroke="#4f46e5" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorIncidentSCADA)" 
                >
                  {config.showDataLabels && <LabelList dataKey={activeMetricKey} content={renderDataLabel} />}
                </Area>
              </AreaChart>
            ) : config.chartType === 'bar' && config.metric !== 'dual' ? (
              <BarChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barIncidentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#4338ca" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                {config.showGrid && (
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'} />
                )}
                <XAxis 
                  dataKey="label" 
                  tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 10, fontWeight: 'bold' }}
                  axisLine={{ stroke: isDark ? '#475569' : '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 10, fontWeight: 'bold' }}
                  axisLine={{ stroke: isDark ? '#475569' : '#e2e8f0' }}
                  tickLine={false}
                  domain={[0, 'auto']}
                  allowDecimals={config.metric === 'trir'}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                    borderColor: isDark ? '#334155' : '#cbd5e1', 
                    borderRadius: '14px', 
                    color: isDark ? '#f8fafc' : '#0f172a', 
                    fontSize: '11px', 
                    fontWeight: 'bold' 
                  }}
                />
                {config.showTargetLine && config.metric === 'trir' && (
                  <ReferenceLine 
                    y={trirTarget} 
                    stroke="#ef4444" 
                    strokeDasharray="4 4" 
                    strokeWidth={2}
                    label={{
                      value: `Target: ${trirTarget}`,
                      fill: isDark ? '#fca5a5' : '#dc2626',
                      fontSize: 10,
                      fontWeight: 'bold',
                      position: 'insideTopRight'
                    }}
                  />
                )}
                <Bar 
                  dataKey={activeMetricKey} 
                  name={activeMetricName} 
                  fill="url(#barIncidentGrad)" 
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                >
                  {config.showDataLabels && <LabelList dataKey={activeMetricKey} content={renderDataLabel} />}
                </Bar>
              </BarChart>
            ) : config.chartType === 'line' && config.metric !== 'dual' ? (
              <LineChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                {config.showGrid && (
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'} />
                )}
                <XAxis 
                  dataKey="label" 
                  tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 10, fontWeight: 'bold' }}
                  axisLine={{ stroke: isDark ? '#475569' : '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 10, fontWeight: 'bold' }}
                  axisLine={{ stroke: isDark ? '#475569' : '#e2e8f0' }}
                  tickLine={false}
                  domain={[0, 'auto']}
                  allowDecimals={config.metric === 'trir'}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                    borderColor: isDark ? '#334155' : '#cbd5e1', 
                    borderRadius: '14px', 
                    color: isDark ? '#f8fafc' : '#0f172a', 
                    fontSize: '11px', 
                    fontWeight: 'bold' 
                  }}
                />
                {config.showTargetLine && config.metric === 'trir' && (
                  <ReferenceLine 
                    y={trirTarget} 
                    stroke="#ef4444" 
                    strokeDasharray="4 4" 
                    strokeWidth={2}
                    label={{
                      value: `Target: ${trirTarget}`,
                      fill: isDark ? '#fca5a5' : '#dc2626',
                      fontSize: 10,
                      fontWeight: 'bold',
                      position: 'insideTopRight'
                    }}
                  />
                )}
                <Line 
                  type={config.curveType} 
                  dataKey={activeMetricKey} 
                  name={activeMetricName} 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#3b82f6', stroke: isDark ? '#0f172a' : '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 7 }}
                >
                  {config.showDataLabels && <LabelList dataKey={activeMetricKey} content={renderDataLabel} />}
                </Line>
              </LineChart>
            ) : (
              /* Composed: Incidents Bar on Left Axis + Rolling TRIR Line on Right Axis */
              <ComposedChart data={chartData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                {config.showGrid && (
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'} />
                )}
                <XAxis 
                  dataKey="label" 
                  tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 10, fontWeight: 'bold' }}
                  axisLine={{ stroke: isDark ? '#475569' : '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 10, fontWeight: 'bold' }}
                  axisLine={{ stroke: isDark ? '#475569' : '#e2e8f0' }}
                  tickLine={false}
                  domain={[0, 'auto']}
                  allowDecimals={false}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 10, fontWeight: 'bold' }}
                  axisLine={{ stroke: isDark ? '#475569' : '#e2e8f0' }}
                  tickLine={false}
                  domain={[0, 'auto']}
                  allowDecimals={true}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                    borderColor: isDark ? '#334155' : '#cbd5e1', 
                    borderRadius: '14px', 
                    color: isDark ? '#f8fafc' : '#0f172a', 
                    fontSize: '11px', 
                    fontWeight: 'bold' 
                  }}
                />
                {config.showTargetLine && (
                  <ReferenceLine 
                    yAxisId="right"
                    y={trirTarget} 
                    stroke="#ef4444" 
                    strokeDasharray="4 4" 
                    strokeWidth={2}
                    label={{
                      value: `Target: ${trirTarget}`,
                      fill: isDark ? '#fca5a5' : '#dc2626',
                      fontSize: 10,
                      fontWeight: 'bold',
                      position: 'insideTopRight'
                    }}
                  />
                )}
                <Bar 
                  yAxisId="left"
                  dataKey="incidentsCount" 
                  name={isFa ? "تعداد حوادث" : "Incidents"} 
                  fill="#6366f1" 
                  radius={[5, 5, 0, 0]}
                  maxBarSize={30}
                >
                  {config.showDataLabels && <LabelList dataKey="incidentsCount" content={renderDataLabel} />}
                </Bar>
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="rollingTRIR" 
                  name={isFa ? "شاخص TRIR" : "Rolling TRIR"} 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={{ r: 3.5, fill: '#10b981', stroke: isDark ? '#0f172a' : '#ffffff', strokeWidth: 1.5 }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-xs">
            {isFa ? 'داده‌ای یافت نشد.' : 'No trend data.'}
          </div>
        )}
      </div>

      {/* Indicators Grid below the chart */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-center">
        {/* Indicator 1: Incidents in View */}
        <div className="space-y-1">
          <span className="text-slate-500 dark:text-slate-400 text-[11px] font-black block leading-none truncate" title={isFa ? 'مجموع حوادث بازه انتخابی' : 'Total Incidents in Range'}>
            {isFa ? 'مجموع حوادث' : 'Total Incidents'}
          </span>
          <strong className="text-[30px] font-black font-mono tracking-tight text-red-600 block leading-tight">
            {fmtInt(totalIncidentsInView)}
          </strong>
          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black ${
            totalIncidentsInView === 0 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
          }`}>
            {totalIncidentsInView === 0 ? (isFa ? 'کاملاً ایمن' : 'Safe') : (isFa ? 'خطر حاد' : 'Hazard')}
          </span>
        </div>

        {/* Indicator 2: Safe Man-Hours in View */}
        <div className="space-y-1 border-x border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400 text-[11px] font-black block leading-none truncate" title={isFa ? 'کارکرد بدون حادثه' : 'Safe Man-Hours'}>
            {isFa ? 'کارکرد بدون حادثه' : 'Safe Man-Hours'}
          </span>
          <strong className="text-[20px] font-black font-mono tracking-tight text-slate-800 dark:text-slate-100 block leading-tight pt-1">
            {fmtInt(totalSafeHoursInView)}
          </strong>
          <span className="text-[9px] font-bold text-slate-400 block mt-1">{isFa ? 'نفر-ساعت ثبت‌شده' : 'Recorded Man-Hours'}</span>
        </div>

        {/* Indicator 3: Target TRIR or Average in View */}
        <div className="space-y-1">
          <span className="text-slate-500 dark:text-slate-400 text-[11px] font-black block leading-none truncate" title={isFa ? 'هدف سالانه TRIR' : 'Target TRIR'}>
            {isFa ? 'هدف عملکرد TRIR' : 'Target TRIR'}
          </span>
          <strong className="text-[30px] font-black font-mono tracking-tight text-indigo-600 dark:text-indigo-400 block leading-tight">
            {fmtNum(trirTarget, 2)}
          </strong>
          <span className="text-[9px] font-bold text-slate-400 block">
            {isFa ? `میانگین بازه: ${avgTRIRInView}` : `Avg: ${avgTRIRInView}`}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 font-bold px-1">
        <span>{isFa ? 'منبع داده: trir_monthly_records' : 'Source: trir_monthly_records'}</span>
        <span>{isFa ? 'شخصی‌سازی متمرکز و یکپارچه' : 'Centralized Synchronization'}</span>
      </div>
    </div>
  );
};
