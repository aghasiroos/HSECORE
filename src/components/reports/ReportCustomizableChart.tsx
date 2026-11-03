import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList
} from 'recharts';
import {
  BarChart2,
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  Activity,
  Maximize2,
  Sliders,
  Download,
  ArrowUpDown,
  Tag,
  Palette
} from 'lucide-react';
import { downloadCsvFile } from '../../utils/fileHelpers';

export type ChartType = 'bar' | 'barHorizontal' | 'line' | 'area' | 'pie' | 'donut' | 'radar';

export interface ChartDataPoint {
  name: string;
  value?: number;
  [key: string]: any;
}

export interface ChartSeries {
  key: string;
  name: string;
  color?: string;
}

export interface ReportCustomizableChartProps {
  title: string;
  subtitle?: string;
  data: ChartDataPoint[];
  series?: ChartSeries[];
  defaultType?: ChartType;
  isFa?: boolean;
  height?: number;
  showPalettePicker?: boolean;
  showSortToggle?: boolean;
  showLabelsToggle?: boolean;
  allowTypeSwitching?: boolean;
  kpiHighlight?: {
    label: string;
    value: string | number;
    subLabel?: string;
    color?: string;
  };
}

const PALETTES = {
  indigo: ['#6366f1', '#4f46e5', '#818cf8', '#a5b4fc', '#c7d2fe', '#3730a3'],
  blue: ['#3b82f6', '#2563eb', '#60a5fa', '#93c5fd', '#1d4ed8', '#1e40af'],
  emerald: ['#10b981', '#059669', '#34d399', '#6ee7b7', '#047857', '#065f46'],
  amber: ['#f59e0b', '#d97706', '#fbbf24', '#fcd34d', '#b45309', '#92400e'],
  purple: ['#8b5cf6', '#7c3aed', '#a78bfa', '#c4b5fd', '#6d28d9', '#5b21b6'],
  rose: ['#f43f5e', '#e11d48', '#fb7185', '#fda4af', '#be123c', '#9f1239'],
  multi: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']
};

const SmartXAxisTick = (props: any) => {
  const { x, y, payload, dataLength = 6 } = props;
  if (!payload || payload.value === undefined) return null;
  const rawValue = String(payload.value);
  const isRotated = dataLength > 5;
  const maxLen = isRotated ? 13 : 9;
  const displayVal = rawValue.length > maxLen ? `${rawValue.slice(0, maxLen - 1)}…` : rawValue;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dx={isRotated ? -8 : 0}
        dy={isRotated ? 12 : 12}
        textAnchor={isRotated ? 'end' : 'middle'}
        transform={isRotated ? 'rotate(-35)' : undefined}
        fill="#475569"
        fontSize={10}
        fontWeight={700}
        className="dark:fill-slate-300"
      >
        <title>{rawValue}</title>
        {displayVal}
      </text>
    </g>
  );
};

const SmartYAxisTick = (props: any) => {
  const { x, y, payload } = props;
  if (!payload || payload.value === undefined) return null;
  const rawValue = String(payload.value);
  const maxLen = 14;
  const displayVal = rawValue.length > maxLen ? `${rawValue.slice(0, maxLen - 1)}…` : rawValue;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={-6}
        y={3.5}
        textAnchor="end"
        fill="#475569"
        fontSize={10}
        fontWeight={700}
        className="dark:fill-slate-300"
      >
        <title>{rawValue}</title>
        {displayVal}
      </text>
    </g>
  );
};

export const ReportCustomizableChart: React.FC<ReportCustomizableChartProps> = ({
  title,
  subtitle,
  data,
  series,
  defaultType = 'bar',
  isFa = true,
  height = 290,
  showPalettePicker = true,
  showSortToggle = true,
  showLabelsToggle = true,
  allowTypeSwitching = true,
  kpiHighlight
}) => {
  const [chartType, setChartType] = useState<ChartType>(defaultType);
  const [selectedPalette, setSelectedPalette] = useState<keyof typeof PALETTES>('multi');
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>('default');
  const [showValues, setShowValues] = useState<boolean>(true);
  const [showControls, setShowControls] = useState<boolean>(false);

  // Active color list
  const activeColors = PALETTES[selectedPalette] || PALETTES.multi;

  // Resolved Series
  const resolvedSeries = useMemo(() => {
    if (series && series.length > 0) {
      return series.map((s, idx) => ({
        ...s,
        color: s.color || activeColors[idx % activeColors.length]
      }));
    }
    return [
      { key: 'value', name: isFa ? 'مقدار' : 'Value', color: activeColors[0] }
    ];
  }, [series, activeColors, isFa]);

  // Sorted data
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const copy = [...data];
    if (sortOrder === 'asc') {
      return copy.sort((a, b) => {
        const valA = Number(a.value ?? a[resolvedSeries[0]?.key] ?? 0);
        const valB = Number(b.value ?? b[resolvedSeries[0]?.key] ?? 0);
        return valA - valB;
      });
    }
    if (sortOrder === 'desc') {
      return copy.sort((a, b) => {
        const valA = Number(a.value ?? a[resolvedSeries[0]?.key] ?? 0);
        const valB = Number(b.value ?? b[resolvedSeries[0]?.key] ?? 0);
        return valB - valA;
      });
    }
    return copy;
  }, [data, sortOrder, resolvedSeries]);

  // Statistics Summary
  const stats = useMemo(() => {
    if (!data || data.length === 0) return { total: 0, avg: 0, max: 0, min: 0 };
    const primaryKey = resolvedSeries[0]?.key || 'value';
    const values = data.map(d => Number(d[primaryKey] ?? d.value ?? 0)).filter(v => !isNaN(v));
    if (values.length === 0) return { total: 0, avg: 0, max: 0, min: 0 };
    const total = values.reduce((acc, v) => acc + v, 0);
    const avg = total / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    return {
      total: Number(total.toFixed(1)),
      avg: Number(avg.toFixed(1)),
      max: Number(max.toFixed(1)),
      min: Number(min.toFixed(1))
    };
  }, [data, resolvedSeries]);

  // Export CSV Handler
  const handleExportCsv = () => {
    if (!processedData.length) return;
    const headers = ['Name', ...resolvedSeries.map(s => s.name || s.key)];
    const rows = processedData.map(row => {
      return [
        `"${row.name}"`,
        ...resolvedSeries.map(s => row[s.key] ?? row.value ?? 0)
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadCsvFile(`${title.replace(/\s+/g, '_')}_data.csv`, csvContent);
  };

  const renderLabel = (props: any) => {
    if (!showValues) return null;
    const { x, y, width, height: barHeight, value } = props;
    if (value === null || value === undefined || value === 0) return null;
    const isHorizontal = chartType === 'barHorizontal';
    return (
      <text
        x={isHorizontal ? x + width + 8 : x + width / 2}
        y={isHorizontal ? y + barHeight / 2 + 3.5 : y - 8}
        fill="#0f172a"
        textAnchor={isHorizontal ? 'start' : 'middle'}
        fontSize={10}
        fontWeight={800}
        paintOrder="stroke fill"
        stroke="#ffffff"
        strokeWidth={2.5}
        strokeLinejoin="round"
        className="dark:fill-slate-100 dark:stroke-slate-900"
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </text>
    );
  };

  const renderPieLabel = (props: any) => {
    if (!showValues) return null;
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    if (!percent || percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.58;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10.5}
        fontWeight={900}
        paintOrder="stroke fill"
        stroke="#0f172a"
        strokeWidth={2}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs transition hover:shadow-md space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
              {title}
            </h3>
            {kpiHighlight && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${kpiHighlight.color || 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'}`}>
                {kpiHighlight.label}: {kpiHighlight.value}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {subtitle}
            </p>
          )}
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {allowTypeSwitching && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-slate-600 dark:text-slate-300">
              <button
                type="button"
                onClick={() => setChartType('bar')}
                title={isFa ? 'نمودار ستونی عمودی' : 'Vertical Bar'}
                className={`p-1.5 rounded-lg transition cursor-pointer ${chartType === 'bar' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'hover:text-slate-900'}`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setChartType('barHorizontal')}
                title={isFa ? 'نمودار ستونی افقی' : 'Horizontal Bar'}
                className={`p-1.5 rounded-lg transition cursor-pointer ${chartType === 'barHorizontal' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'hover:text-slate-900'}`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setChartType('line')}
                title={isFa ? 'نمودار خطی' : 'Line Chart'}
                className={`p-1.5 rounded-lg transition cursor-pointer ${chartType === 'line' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'hover:text-slate-900'}`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setChartType('area')}
                title={isFa ? 'نمودار مساحتی' : 'Area Chart'}
                className={`p-1.5 rounded-lg transition cursor-pointer ${chartType === 'area' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'hover:text-slate-900'}`}
              >
                <Activity className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setChartType('donut')}
                title={isFa ? 'نمودار دایره‌ای / دونات' : 'Donut Chart'}
                className={`p-1.5 rounded-lg transition cursor-pointer ${chartType === 'donut' || chartType === 'pie' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'hover:text-slate-900'}`}
              >
                <PieIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Settings Menu Toggle */}
          <button
            type="button"
            onClick={() => setShowControls(prev => !prev)}
            title={isFa ? 'تنظیمات شخصی‌سازی نمودار' : 'Customize Chart'}
            className={`p-1.5 rounded-xl border transition cursor-pointer ${showControls ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {/* Export Data */}
          <button
            type="button"
            onClick={handleExportCsv}
            title={isFa ? 'خروجی فایل داده‌ها (CSV)' : 'Export CSV'}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expandable Customization Sub-Bar */}
      {showControls && (
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          {/* Palette Picker */}
          {showPalettePicker && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold flex items-center gap-1 text-[11px]">
                <Palette className="w-3 h-3 text-indigo-500" />
                {isFa ? 'پالت رنگ:' : 'Palette:'}
              </span>
              <div className="flex items-center gap-1">
                {(['multi', 'indigo', 'blue', 'emerald', 'amber', 'purple', 'rose'] as const).map(pal => (
                  <button
                    key={pal}
                    type="button"
                    onClick={() => setSelectedPalette(pal)}
                    className={`w-5 h-5 rounded-full border-2 transition cursor-pointer ${selectedPalette === pal ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent opacity-80 hover:opacity-100'}`}
                    style={{
                      backgroundColor: PALETTES[pal][0]
                    }}
                    title={pal}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sort & Labels Toggles */}
          <div className="flex items-center gap-2">
            {showSortToggle && (
              <button
                type="button"
                onClick={() => {
                  setSortOrder(prev => prev === 'default' ? 'desc' : prev === 'desc' ? 'asc' : 'default');
                }}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${sortOrder !== 'default' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
              >
                <ArrowUpDown className="w-3 h-3" />
                <span>
                  {sortOrder === 'desc' ? (isFa ? 'مرتب‌سازی: بیشترین' : 'Sort: Desc') :
                   sortOrder === 'asc' ? (isFa ? 'مرتب‌سازی: کمترین' : 'Sort: Asc') :
                   (isFa ? 'مرتب‌سازی: پیش‌فرض' : 'Sort: Default')}
                </span>
              </button>
            )}

            {showLabelsToggle && (
              <button
                type="button"
                onClick={() => setShowValues(prev => !prev)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${showValues ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}
              >
                <Tag className="w-3 h-3" />
                <span>{showValues ? (isFa ? 'نمایش ارقام: روشن' : 'Labels: On') : (isFa ? 'نمایش ارقام: خاموش' : 'Labels: Off')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="w-full min-w-0" style={{ height: `${height}px` }}>
        {processedData.length > 0 ? (
          <ResponsiveContainer width="100%" height={height} minWidth={0} minHeight={height - 20} debounce={50}>
            {chartType === 'bar' ? (
              <BarChart data={processedData} margin={{ top: 25, right: 15, left: -15, bottom: processedData.length > 5 ? 55 : 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis
                  dataKey="name"
                  tick={<SmartXAxisTick dataLength={processedData.length} />}
                  interval={0}
                  height={processedData.length > 5 ? 55 : 32}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    borderColor: '#cbd5e1',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
                {resolvedSeries.length > 1 && <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />}
                {resolvedSeries.map((s, idx) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    fill={s.color || activeColors[idx % activeColors.length]}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                  >
                    {resolvedSeries.length === 1 && processedData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={activeColors[index % activeColors.length]} />
                    ))}
                    {showValues && <LabelList dataKey={s.key} content={renderLabel} />}
                  </Bar>
                ))}
              </BarChart>
            ) : chartType === 'barHorizontal' ? (
              <BarChart data={processedData} layout="vertical" margin={{ top: 15, right: 45, left: 10, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={<SmartYAxisTick />}
                  width={115}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    borderColor: '#cbd5e1',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                />
                {resolvedSeries.length > 1 && <Legend wrapperStyle={{ fontSize: '11px' }} />}
                {resolvedSeries.map((s, idx) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    fill={s.color || activeColors[idx % activeColors.length]}
                    radius={[0, 6, 6, 0]}
                    maxBarSize={28}
                  >
                    {resolvedSeries.length === 1 && processedData.map((_, index) => (
                      <Cell key={`cell-h-${index}`} fill={activeColors[index % activeColors.length]} />
                    ))}
                    {showValues && <LabelList dataKey={s.key} content={renderLabel} />}
                  </Bar>
                ))}
              </BarChart>
            ) : chartType === 'line' ? (
              <LineChart data={processedData} margin={{ top: 25, right: 20, left: -15, bottom: processedData.length > 5 ? 55 : 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis
                  dataKey="name"
                  tick={<SmartXAxisTick dataLength={processedData.length} />}
                  interval={0}
                  height={processedData.length > 5 ? 55 : 32}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    borderColor: '#cbd5e1',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                />
                {resolvedSeries.length > 1 && <Legend wrapperStyle={{ fontSize: '11px' }} />}
                {resolvedSeries.map((s, idx) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color || activeColors[idx % activeColors.length]}
                    strokeWidth={3}
                    dot={{ r: 4, fill: s.color || activeColors[idx % activeColors.length], stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  >
                    {showValues && <LabelList dataKey={s.key} content={renderLabel} />}
                  </Line>
                ))}
              </LineChart>
            ) : chartType === 'area' ? (
              <AreaChart data={processedData} margin={{ top: 25, right: 20, left: -15, bottom: processedData.length > 5 ? 55 : 25 }}>
                <defs>
                  {resolvedSeries.map((s, idx) => (
                    <linearGradient key={`grad-${s.key}`} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={s.color || activeColors[idx % activeColors.length]} stopOpacity={0.7} />
                      <stop offset="95%" stopColor={s.color || activeColors[idx % activeColors.length]} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis
                  dataKey="name"
                  tick={<SmartXAxisTick dataLength={processedData.length} />}
                  interval={0}
                  height={processedData.length > 5 ? 55 : 32}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    borderColor: '#cbd5e1',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                />
                {resolvedSeries.length > 1 && <Legend wrapperStyle={{ fontSize: '11px' }} />}
                {resolvedSeries.map((s, idx) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color || activeColors[idx % activeColors.length]}
                    strokeWidth={2.5}
                    fill={`url(#grad-${s.key})`}
                  >
                    {showValues && <LabelList dataKey={s.key} content={renderLabel} />}
                  </Area>
                ))}
              </AreaChart>
            ) : chartType === 'radar' ? (
              <RadarChart data={processedData} margin={{ top: 15, right: 25, bottom: 15, left: 25 }}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569', fontWeight: 'bold' }} />
                <PolarRadiusAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    borderColor: '#cbd5e1',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                />
                {resolvedSeries.map((s, idx) => (
                  <Radar
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color || activeColors[idx % activeColors.length]}
                    fill={s.color || activeColors[idx % activeColors.length]}
                    fillOpacity={0.5}
                  />
                ))}
                {resolvedSeries.length > 1 && <Legend wrapperStyle={{ fontSize: '11px' }} />}
              </RadarChart>
            ) : (
              /* Pie / Donut Chart */
              <PieChart>
                <Pie
                  data={processedData}
                  dataKey={resolvedSeries[0]?.key || 'value'}
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={Math.min(height * 0.35, 100)}
                  innerRadius={chartType === 'donut' ? Math.min(height * 0.2, 55) : 0}
                  paddingAngle={3}
                  label={renderPieLabel}
                >
                  {processedData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={activeColors[index % activeColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    borderColor: '#cbd5e1',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </PieChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-bold border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <span>{isFa ? 'داده‌ای در این بازه زمانی یافت نشد' : 'No data available for this timeframe'}</span>
          </div>
        )}
      </div>

      {/* Mini Stats Footer */}
      {processedData.length > 0 && (
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
          <div className="text-center bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-xl">
            <span className="block text-[9px] text-slate-400 font-sans font-bold">{isFa ? 'مجموع' : 'Total'}</span>
            <strong className="font-black text-slate-800 dark:text-slate-200">{stats.total.toLocaleString()}</strong>
          </div>
          <div className="text-center bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-xl">
            <span className="block text-[9px] text-slate-400 font-sans font-bold">{isFa ? 'میانگین' : 'Average'}</span>
            <strong className="font-black text-slate-800 dark:text-slate-200">{stats.avg.toLocaleString()}</strong>
          </div>
          <div className="text-center bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-xl">
            <span className="block text-[9px] text-slate-400 font-sans font-bold">{isFa ? 'بیشترین' : 'Maximum'}</span>
            <strong className="font-black text-emerald-600 dark:text-emerald-400">{stats.max.toLocaleString()}</strong>
          </div>
          <div className="text-center bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-xl">
            <span className="block text-[9px] text-slate-400 font-sans font-bold">{isFa ? 'کمترین' : 'Minimum'}</span>
            <strong className="font-black text-slate-700 dark:text-slate-300">{stats.min.toLocaleString()}</strong>
          </div>
        </div>
      )}
    </div>
  );
};
export default ReportCustomizableChart;
