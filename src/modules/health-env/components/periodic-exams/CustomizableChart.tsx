import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid
} from 'recharts';
import {
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  SlidersHorizontal,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Eye,
  EyeOff,
  Palette,
  Percent,
  Download,
  GripVertical,
  X,
  Edit3,
  Layers,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface ChartDataItem {
  label: string;
  value: number;
  secondaryValue?: number;
  color?: string;
  subLabel?: string;
  category?: string;
}

export type ChartType = 'bar' | 'hbar' | 'line' | 'donut' | 'area';
export type ChartPalette = 'teal' | 'indigo' | 'amber' | 'multi' | 'rose' | 'slate';

export interface CustomizableChartProps {
  id?: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  data: ChartDataItem[];
  unit?: string;
  totalCount?: number;
  height?: number;
  defaultType?: ChartType;
  defaultPalette?: ChartPalette;
  allowTypeSwitch?: boolean;
  allowCustomization?: boolean;
  isDraggable?: boolean;
  onEditConfig?: () => void;
  onRemove?: () => void;
  onTypeChange?: (type: ChartType) => void;
  onPaletteChange?: (palette: ChartPalette) => void;
  className?: string;
  dragHandleProps?: any;
}

export const PALETTES: Record<ChartPalette, { name: string; colors: string[] }> = {
  teal: {
    name: 'فیروزه‌ای طب کار',
    colors: ['#0d9488', '#14b8a6', '#2dd4bf', '#0f766e', '#115e59', '#042f2e', '#5eead4', '#99f6e4']
  },
  indigo: {
    name: 'سرمه‌ای مدرن',
    colors: ['#4338ca', '#6366f1', '#818cf8', '#3730a3', '#312e81', '#a5b4fc', '#4f46e5', '#c7d2fe']
  },
  amber: {
    name: 'کهربایی و هشدار',
    colors: ['#d97706', '#f59e0b', '#fbbf24', '#b45309', '#92400e', '#78350f', '#fde68a', '#fef3c7']
  },
  multi: {
    name: 'پالت چندرنگ تحلیلی',
    colors: ['#0d9488', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#10b981', '#ec4899', '#2563eb', '#64748b']
  },
  rose: {
    name: 'رز و سلامت',
    colors: ['#e11d48', '#f43f5e', '#fb7185', '#be123c', '#9f1239', '#881337', '#fda4af', '#fecdd3']
  },
  slate: {
    name: 'طوسی مینیمال',
    colors: ['#475569', '#64748b', '#94a3b8', '#334155', '#1e293b', '#0f172a', '#cbd5e1', '#e2e8f0']
  }
};

export const CustomizableChart: React.FC<CustomizableChartProps> = ({
  id,
  title,
  subtitle,
  icon,
  data,
  unit = 'نفر',
  totalCount,
  height = 250,
  defaultType = 'bar',
  defaultPalette = 'teal',
  allowTypeSwitch = true,
  allowCustomization = true,
  isDraggable = false,
  onEditConfig,
  onRemove,
  onTypeChange,
  onPaletteChange,
  className = '',
  dragHandleProps
}) => {
  const [chartType, setChartType] = useState<ChartType>(defaultType);
  const [palette, setPalette] = useState<ChartPalette>(defaultPalette);
  const [sortOrder, setSortOrder] = useState<'none' | 'desc' | 'asc'>('none');
  const [showDataLabels, setShowDataLabels] = useState<boolean>(true);
  const [showPercentages, setShowPercentages] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Sync internal state if external props change
  React.useEffect(() => {
    setChartType(defaultType);
  }, [defaultType]);

  React.useEffect(() => {
    setPalette(defaultPalette);
  }, [defaultPalette]);

  const handleTypeChange = (newType: ChartType) => {
    setChartType(newType);
    if (onTypeChange) onTypeChange(newType);
  };

  const handlePaletteChange = (newPal: ChartPalette) => {
    setPalette(newPal);
    if (onPaletteChange) onPaletteChange(newPal);
  };

  // Total calculation
  const total = useMemo(() => {
    if (totalCount !== undefined && totalCount > 0) return totalCount;
    const sum = data.reduce((acc, item) => acc + (item.value || 0), 0);
    return sum > 0 ? sum : 1;
  }, [data, totalCount]);

  // Processed and sorted data
  const processedData = useMemo(() => {
    let list = [...data];
    if (sortOrder === 'desc') {
      list.sort((a, b) => b.value - a.value);
    } else if (sortOrder === 'asc') {
      list.sort((a, b) => a.value - b.value);
    }
    return list;
  }, [data, sortOrder]);

  const activeColors = PALETTES[palette]?.colors || PALETTES.teal.colors;

  const maxValue = useMemo(() => {
    const max = Math.max(...processedData.map(d => d.value), 0);
    return max > 0 ? max : 1;
  }, [processedData]);

  // Export this chart data to Excel
  const exportChartToExcel = () => {
    try {
      const rows = processedData.map(item => ({
        'عنوان شاخص': item.label,
        'مقدار': item.value,
        'واحد': unit,
        'درصد': `${((item.value / total) * 100).toFixed(1)}%`,
        'توضیحات تکمیلی': item.subLabel || ''
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'داده‌های نمودار');
      const safeTitle = (title || 'Chart_Data').replace(/[/\\?%*:|"<>]/g, '_');
      XLSX.writeFile(wb, `${safeTitle}.xlsx`);
    } catch (err) {
      console.error('Error exporting chart to Excel:', err);
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className={`bg-white dark:bg-[#17222c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">{title}</h3>
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              title="حذف این نمودار"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
          <span>اطلاعاتی با فیلترهای جاری برای این نمودار یافت نشد.</span>
          <span className="text-[10px] text-slate-400/80 mt-1">می‌توانید فیلترهای بالا را تغییر دهید.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:shadow-md relative ${className}`}>
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 max-w-[60%]">
          {/* Drag Handle if enabled */}
          {isDraggable && (
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="برای جابه‌جایی نمودار بکشید و رها کنید (Drag & Drop)"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          {icon && <span className="text-teal-600 dark:text-teal-400 shrink-0">{icon}</span>}
          <div className="truncate">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 truncate">
              <span className="truncate">{title}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60 shrink-0">
                {data.length} ردیف
              </span>
            </h3>
            {subtitle && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>

        {/* Quick Customization Toolbar */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Chart Type Selector */}
          {allowTypeSwitch && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleTypeChange('bar')}
                title="نمودار ستونی عمودی (Bar Chart)"
                className={`p-1.5 rounded-md text-xs transition-all ${
                  chartType === 'bar'
                    ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('hbar')}
                title="نمودار میله‌ای افقی (Horizontal Bar)"
                className={`p-1.5 rounded-md text-xs transition-all ${
                  chartType === 'hbar'
                    ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div className="w-3.5 h-3.5 flex flex-col justify-between py-0.5">
                  <div className="h-0.5 bg-current w-full rounded-xs"></div>
                  <div className="h-0.5 bg-current w-3/4 rounded-xs"></div>
                  <div className="h-0.5 bg-current w-1/2 rounded-xs"></div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('line')}
                title="نمودار خطی (Line Chart)"
                className={`p-1.5 rounded-md text-xs transition-all ${
                  chartType === 'line'
                    ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('area')}
                title="نمودار مساحتی و سطحی (Area Chart)"
                className={`p-1.5 rounded-md text-xs transition-all ${
                  chartType === 'area'
                    ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('donut')}
                title="نمودار دونات و سهم درصدی (Donut / Pie)"
                className={`p-1.5 rounded-md text-xs transition-all ${
                  chartType === 'donut'
                    ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <PieIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Sort Order Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder(prev => (prev === 'none' ? 'desc' : prev === 'desc' ? 'asc' : 'none'))}
            title={sortOrder === 'desc' ? 'مرتب‌سازی: نزولی (بیشترین)' : sortOrder === 'asc' ? 'مرتب‌سازی: صعودی (کمترین)' : 'مرتب‌سازی: استاندارد'}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
              sortOrder !== 'none'
                ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 font-bold'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {sortOrder === 'desc' ? (
              <ArrowDownWideNarrow className="w-3.5 h-3.5" />
            ) : sortOrder === 'asc' ? (
              <ArrowUpNarrowWide className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownWideNarrow className="w-3.5 h-3.5 opacity-50" />
            )}
          </button>

          {/* Export to Excel */}
          <button
            type="button"
            onClick={exportChartToExcel}
            title="دانلود اکسل داده‌های این نمودار"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-teal-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-xs"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Edit / Customize Metric & Title Modal */}
          {onEditConfig && (
            <button
              type="button"
              onClick={onEditConfig}
              title="تغییر شاخص تحلیلی و ویرایش عنوان"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Toggle In-Place Settings */}
          {allowCustomization && (
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              title="شخصی‌سازی رنگ و برچسب‌های نمودار"
              className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
                showSettings
                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Remove / Hide Chart */}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="حذف این نمودار از چیدمان"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expandable Customization Settings */}
      {showSettings && (
        <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-850/80 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3 text-xs animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Palettes */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5 text-teal-600" />
                تم رنگی:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(Object.keys(PALETTES) as ChartPalette[]).map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePaletteChange(key)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] transition-all ${
                      palette === key
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-bold ring-1 ring-teal-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: PALETTES[key].colors[0] }}
                    />
                    <span>{PALETTES[key].name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Labels Options */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowDataLabels(!showDataLabels)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] transition-all ${
                  showDataLabels
                    ? 'bg-teal-100 dark:bg-teal-950/60 border-teal-400 text-teal-800 dark:text-teal-200 font-bold'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500'
                }`}
              >
                {showDataLabels ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>اعداد بالای نمودار</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPercentages(!showPercentages)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] transition-all ${
                  showPercentages
                    ? 'bg-teal-100 dark:bg-teal-950/60 border-teal-400 text-teal-800 dark:text-teal-200 font-bold'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500'
                }`}
              >
                <Percent className="w-3 h-3" />
                <span>نمایش درصدها</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chart Canvas Rendering Area */}
      <div className="relative pt-4 pb-2" style={{ minHeight: `${height}px` }}>
        {/* 1. VERTICAL BAR CHART WITH DATA LABELS ON TOP */}
        {chartType === 'bar' && (() => {
          const plotHeight = Math.max(height - 75, 175);
          return (
            <div className="w-full flex flex-col">
              {/* Plot Area with Grid & Bars */}
              <div className="w-full relative" style={{ height: `${plotHeight}px` }}>
                {/* Horizontal Guide Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-1">
                  {[1, 0.75, 0.5, 0.25, 0].map((ratio, i) => (
                    <div key={i} className="w-full flex items-center gap-2">
                      <span className="text-[9px] font-mono text-slate-400/70 dark:text-slate-500/70 shrink-0 w-6 text-left">
                        {Math.round(maxValue * ratio)}
                      </span>
                      <div className="w-full border-b border-dashed border-slate-200/80 dark:border-slate-800/80" />
                    </div>
                  ))}
                </div>

                {/* Vertical Bars Columns */}
                <div className="relative z-10 w-full h-full flex items-end justify-around gap-2 sm:gap-3 pr-8 pl-1">
                  {processedData.map((item, idx) => {
                    const pct = ((item.value / total) * 100).toFixed(0);
                    const heightPct = Math.max(Math.min((item.value / maxValue) * 100, 100), 3);
                    const barColor = item.color || activeColors[idx % activeColors.length];
                    const isHovered = hoveredIndex === idx;

                    return (
                      <div
                        key={item.label + idx}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer min-w-[28px] max-w-[76px]"
                      >
                        {/* Numbers & Percentages on Top of Bar */}
                        {showDataLabels && (
                          <div
                            className={`absolute flex flex-col items-center z-20 pointer-events-none transition-all duration-200 ${
                              isHovered ? 'scale-110 -translate-y-1' : ''
                            }`}
                            style={{ bottom: `calc(${heightPct}% + 6px)` }}
                          >
                            <div className="px-2 py-0.5 rounded-md bg-slate-900/95 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] sm:text-[11px] font-mono font-extrabold shadow-md whitespace-nowrap flex items-center gap-1 border border-white/10 dark:border-slate-900/10">
                              <span>{item.value.toLocaleString('fa-IR')}</span>
                              {showPercentages && (
                                <span className="text-[9px] text-teal-300 dark:text-teal-700 font-bold">
                                  ({pct}٪)
                                </span>
                              )}
                            </div>
                            <div className="w-1.5 h-1.5 rotate-45 bg-slate-900/95 dark:bg-slate-100 -mt-1 shadow-xs"></div>
                          </div>
                        )}

                        {/* Bar Track & Fill */}
                        <div className="w-full h-full flex items-end justify-center relative">
                          {/* Subtle background track */}
                          <div className="w-full h-full absolute inset-0 bg-slate-100/60 dark:bg-slate-800/30 rounded-t-lg pointer-events-none" />

                          {/* Solid Bar */}
                          <div
                            className={`w-full rounded-t-lg transition-all duration-500 ease-out relative group-hover:brightness-110 shadow-xs ${
                              isHovered ? 'ring-2 ring-teal-400 ring-offset-1 dark:ring-offset-slate-900' : ''
                            }`}
                            style={{
                              height: `${heightPct}%`,
                              minHeight: '6px',
                              backgroundColor: barColor,
                              backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.18), transparent)`
                            }}
                          >
                            <div className="absolute inset-x-0 top-0 h-1 bg-white/40 rounded-t-lg"></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Labels Row */}
              <div className="w-full flex justify-around gap-2 sm:gap-3 pr-8 pl-1 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                {processedData.map((item, idx) => {
                  const isHovered = hoveredIndex === idx;
                  const pct = ((item.value / total) * 100).toFixed(0);

                  return (
                    <div
                      key={item.label + idx}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className="flex-1 text-center cursor-pointer min-w-[28px] max-w-[76px]"
                    >
                      <span
                        title={item.label}
                        className={`block text-[10px] sm:text-[11px] leading-tight font-bold text-slate-700 dark:text-slate-300 transition-colors ${
                          isHovered ? 'text-teal-600 dark:text-teal-400' : ''
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.subLabel ? (
                        <span className="block text-[9px] text-slate-400 truncate mt-0.5" title={item.subLabel}>
                          {item.subLabel}
                        </span>
                      ) : (
                        <span className="block text-[9px] text-slate-400 font-mono mt-0.5">
                          {pct}٪
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 2. HORIZONTAL BAR CHART */}
        {chartType === 'hbar' && (
          <div className="space-y-3 pt-2">
            {processedData.map((item, idx) => {
              const pct = ((item.value / total) * 100).toFixed(0);
              const widthPct = Math.max((item.value / maxValue) * 100, 3);
              const barColor = item.color || activeColors[idx % activeColors.length];

              return (
                <div key={item.label + idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[65%]">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-extrabold text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {item.value} {unit}
                      </span>
                      {showPercentages && (
                        <span className="text-[11px] text-teal-600 dark:text-teal-400 font-bold">
                          {pct}٪
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-500 shadow-xs relative"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: barColor
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 rounded-full"></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. LINE CHART */}
        {chartType === 'line' && (
          <div className="w-full min-w-0 pt-4 pb-2" style={{ height: `${height}px` }}>
            <ResponsiveContainer width="100%" height={height || 220} minWidth={0} minHeight={height || 200} debounce={50}>
              <LineChart data={processedData} margin={{ top: 15, right: 15, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  interval={0}
                  tickFormatter={(val: string) => (val && val.length > 14 ? `${val.slice(0, 12)}…` : val)}
                  angle={processedData.length > 5 ? -18 : 0}
                  textAnchor={processedData.length > 5 ? 'end' : 'middle'}
                  height={processedData.length > 5 ? 40 : 25}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  domain={[0, 'auto']}
                />
                <RechartsTooltip
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      const pct = ((item.value / total) * 100).toFixed(1);
                      return (
                        <div className="bg-slate-900/95 dark:bg-slate-900/95 text-white p-2.5 rounded-xl shadow-xl border border-slate-700/50 backdrop-blur-md text-xs dir-rtl text-right min-w-[140px] z-50">
                          <p className="font-bold text-slate-100 text-[11px] mb-0.5">{item.label}</p>
                          {item.subLabel && (
                            <p className="text-[10px] text-slate-400 mb-1">{item.subLabel}</p>
                          )}
                          <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-700/60 font-mono">
                            <span className="text-teal-400 font-bold">{item.value.toLocaleString('fa-IR')} {unit || 'نفر'}</span>
                            <span className="text-slate-300 text-[10px]">({pct}٪)</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={title}
                  stroke={activeColors[0]}
                  strokeWidth={3}
                  dot={{ r: 4.5, fill: '#fff', stroke: activeColors[0], strokeWidth: 2.5 }}
                  activeDot={{ r: 7, fill: activeColors[0], stroke: '#fff', strokeWidth: 2.5 }}
                  animationDuration={600}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 4. AREA / SURFACE GRADIENT CHART */}
        {chartType === 'area' && (
          <div className="w-full min-w-0 pt-4 pb-2" style={{ height: `${height}px` }}>
            <ResponsiveContainer width="100%" height={height || 220} minWidth={0} minHeight={height || 200} debounce={50}>
              <AreaChart data={processedData} margin={{ top: 15, right: 15, left: -20, bottom: 25 }}>
                <defs>
                  <linearGradient id={`area-grad-${id || 'chart'}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeColors[0]} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={activeColors[0]} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  interval={0}
                  tickFormatter={(val: string) => (val && val.length > 14 ? `${val.slice(0, 12)}…` : val)}
                  angle={processedData.length > 5 ? -18 : 0}
                  textAnchor={processedData.length > 5 ? 'end' : 'middle'}
                  height={processedData.length > 5 ? 40 : 25}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  domain={[0, 'auto']}
                />
                <RechartsTooltip
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      const pct = ((item.value / total) * 100).toFixed(1);
                      return (
                        <div className="bg-slate-900/95 dark:bg-slate-900/95 text-white p-2.5 rounded-xl shadow-xl border border-slate-700/50 backdrop-blur-md text-xs dir-rtl text-right min-w-[140px] z-50">
                          <p className="font-bold text-slate-100 text-[11px] mb-0.5">{item.label}</p>
                          {item.subLabel && (
                            <p className="text-[10px] text-slate-400 mb-1">{item.subLabel}</p>
                          )}
                          <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-700/60 font-mono">
                            <span className="text-teal-400 font-bold">{item.value.toLocaleString('fa-IR')} {unit || 'نفر'}</span>
                            <span className="text-slate-300 text-[10px]">({pct}٪)</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={title}
                  stroke={activeColors[0]}
                  strokeWidth={3}
                  fill={`url(#area-grad-${id || 'chart'})`}
                  fillOpacity={1}
                  dot={{ r: 4, fill: '#fff', stroke: activeColors[0], strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: activeColors[0], stroke: '#fff', strokeWidth: 2.5 }}
                  animationDuration={600}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 5. DONUT & PIE CHART */}
        {chartType === 'donut' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="relative flex items-center justify-center py-2">
              <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 100 100">
                {(() => {
                  let accumulated = 0;
                  return processedData.map((item, idx) => {
                    const pct = item.value / total;
                    const strokeDasharray = `${pct * 251.2} 251.2`;
                    const strokeDashoffset = -accumulated * 251.2;
                    accumulated += pct;
                    const color = item.color || activeColors[idx % activeColors.length];

                    return (
                      <circle
                        key={item.label + idx}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke={color}
                        strokeWidth="16"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-300 hover:opacity-85 cursor-pointer"
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-[10px] text-slate-400 font-bold">مجموع کل</span>
                <span className="text-lg font-black font-mono text-slate-800 dark:text-white">{total}</span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">{unit}</span>
              </div>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {processedData.map((item, idx) => {
                const pct = ((item.value / total) * 100).toFixed(0);
                const color = item.color || activeColors[idx % activeColors.length];

                return (
                  <div
                    key={item.label + idx}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate max-w-[65%]">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-extrabold text-slate-900 dark:text-white px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 shadow-xs border border-slate-200 dark:border-slate-600">
                        {item.value}
                      </span>
                      {showPercentages && (
                        <span className="text-[10px] text-slate-400">({pct}٪)</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomizableChart;
