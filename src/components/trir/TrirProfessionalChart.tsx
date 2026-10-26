import React, { useState, useMemo, useRef } from 'react';
import { toPng } from 'html-to-image';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ReferenceLine, 
  ReferenceArea,
  LabelList
} from 'recharts';
import {
  Download,
  Sliders,
  Maximize2,
  Minimize2,
  RefreshCw,
  Calendar,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  Palette,
  Loader2
} from 'lucide-react';
import { TrirSeriesPoint } from '../../types';
import { exportTrirFullExcel } from './trirExcelService';

interface TrirProfessionalChartProps {
  data: TrirSeriesPoint[];
  trirTarget: number;
  onTrirTargetChange?: (newTarget: number) => void;
  isFa: boolean;
}

export type TimeRangeFilter = 'all' | 'last12' | 'last24' | '1405' | '1404' | '1403' | '1402';
export type CurveType = 'monotone' | 'linear' | 'step';
export type ColorTheme = 'modern-hse' | 'emerald-indigo' | 'high-contrast';

export default function TrirProfessionalChart({
  data,
  trirTarget,
  onTrirTargetChange,
  isFa
}: TrirProfessionalChartProps) {
  // --- Customization States ---
  const [showSettings, setShowSettings] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Layers visibility
  const [showIncidents, setShowIncidents] = useState(true);
  const [showRollingTRIR, setShowRollingTRIR] = useState(true);
  const [showMonthlyTRIR, setShowMonthlyTRIR] = useState(true);
  const [showTargetLine, setShowTargetLine] = useState(true);
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [showDataLabels, setShowDataLabels] = useState(false);

  // Styling & Options
  const [curveType, setCurveType] = useState<CurveType>('monotone');
  const [colorTheme, setColorTheme] = useState<ColorTheme>('modern-hse');
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('all');
  const [barWidth, setBarWidth] = useState<number>(20);
  const [isExporting, setIsExporting] = useState(false);

  const chartRef = useRef<HTMLDivElement>(null);

  // --- Filter data by selected time range ---
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    if (timeRange === 'last12') {
      return data.slice(-12);
    }
    if (timeRange === 'last24') {
      return data.slice(-24);
    }
    if (['1405', '1404', '1403', '1402'].includes(timeRange)) {
      const yr = parseInt(timeRange, 10);
      return data.filter(d => d.year === yr);
    }
    return data;
  }, [data, timeRange]);

  // Color palettes
  const colors = useMemo(() => {
    switch (colorTheme) {
      case 'emerald-indigo':
        return {
          bar: '#0284c7', // Sky blue
          rolling: '#4f46e5', // Indigo
          monthly: '#10b981', // Emerald
          target: '#e11d48', // Rose
          safeZone: 'rgba(16, 185, 129, 0.05)',
        };
      case 'high-contrast':
        return {
          bar: '#0f766e', // Teal dark
          rolling: '#2563eb', // Blue standard
          monthly: '#0284c7', // Sky
          target: '#dc2626', // Red
          safeZone: 'rgba(37, 99, 235, 0.05)',
        };
      case 'modern-hse':
      default:
        return {
          bar: '#0891b2', // Cyan 600
          rolling: '#f59e0b', // Amber 500 (standard professional TRIR gold)
          monthly: '#38bdf8', // Light sky blue
          target: '#ef4444', // Red 500
          safeZone: 'rgba(34, 197, 94, 0.06)', // Soft light green
        };
    }
  }, [colorTheme]);

  // Summary statistics for the active filtered window
  const windowStats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const totalHours = filteredData.reduce((acc, c) => acc + c.totalHours, 0);
    const totalIncidents = filteredData.reduce((acc, c) => acc + c.incidents, 0);
    const latestRolling = filteredData[filteredData.length - 1]?.rollingTRIR || 0;
    const maxRolling = Math.max(...filteredData.map(d => d.rollingTRIR || 0));
    return {
      totalHours,
      totalIncidents,
      latestRolling,
      maxRolling
    };
  }, [filteredData]);

  // Robust Image export without oklch parsing errors
  const handleExportPNG = async () => {
    if (!chartRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const isDark = document.documentElement.classList.contains('dark');
      const bgColor = isDark ? '#0f172a' : '#ffffff';

      // Primary strategy: html-to-image toPng (uses native browser rendering, natively supports oklch/Tailwind v4)
      // skipFonts: true and fontEmbedCSS: '' prevent inspecting external stylesheets / cssRules which causes CORS errors
      try {
        const dataUrl = await toPng(chartRef.current, {
          backgroundColor: bgColor,
          pixelRatio: 2.5,
          cacheBust: true,
          skipFonts: true,
          fontEmbedCSS: '',
          filter: (node) => {
            // Exclude tooltips or unwanted floating overlays if any
            if ((node as HTMLElement)?.classList?.contains?.('recharts-tooltip-wrapper')) {
              return false;
            }
            return true;
          }
        });

        const link = document.createElement('a');
        link.download = `TRIR_Analytical_Chart_${timeRange}_${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        return;
      } catch (toPngErr) {
        console.warn('toPng export fallback triggered:', toPngErr);
      }

      // Secondary fallback: Direct SVG serialization and canvas rendering
      const svgElement = chartRef.current.querySelector('svg.recharts-surface') || chartRef.current.querySelector('svg');
      if (svgElement) {
        const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
        const rect = svgElement.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 400;

        svgClone.setAttribute('width', String(width));
        svgClone.setAttribute('height', String(height));

        const svgData = new XMLSerializer().serializeToString(svgClone);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const blobUrl = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const scale = 2.5;
              canvas.width = width * scale;
              canvas.height = height * scale;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.scale(scale, scale);
                ctx.fillStyle = bgColor;
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                const pngUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = `TRIR_Analytical_Chart_${timeRange}_${Date.now()}.png`;
                link.href = pngUrl;
                link.click();
              }
              URL.revokeObjectURL(blobUrl);
              resolve();
            } catch (drawErr) {
              reject(drawErr);
            }
          };
          img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error('Failed to render SVG onto canvas'));
          };
          img.src = blobUrl;
        });
      } else {
        throw new Error('No SVG chart element found to export');
      }
    } catch (err) {
      console.error('Failed to export chart image:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const rowData = payload[0]?.payload as TrirSeriesPoint;
    if (!rowData) return null;

    const rol = (!isNaN(rowData.rollingTRIR) ? rowData.rollingTRIR : 0);
    const mon = (!isNaN(rowData.monthlyTRIR) ? rowData.monthlyTRIR : 0);

    const isExceedTarget = rol > trirTarget;

    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl text-xs space-y-2.5 min-w-[240px] text-right font-sans">
        {/* Period & Badge */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 font-black text-slate-800 dark:text-slate-100 text-sm">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span>{rowData.month} {rowData.year}</span>
          </div>
          <span 
            className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
              rol <= trirTarget * 0.8 
                ? 'trir-badge-safe text-emerald-700 bg-emerald-50 border-emerald-300 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-700'
                : isExceedTarget
                  ? 'trir-badge-danger text-red-700 bg-red-50 border-red-300 dark:text-red-300 dark:bg-red-950/50 dark:border-red-700'
                  : 'trir-badge-warning text-amber-700 bg-amber-50 border-amber-300 dark:text-amber-300 dark:bg-amber-950/50 dark:border-amber-700'
            }`}
            style={{
              color: rol <= trirTarget * 0.8 ? '#047857' : isExceedTarget ? '#b91c1c' : '#b45309',
              backgroundColor: rol <= trirTarget * 0.8 ? '#ecfdf5' : isExceedTarget ? '#fef2f2' : '#fffbeb',
              borderColor: rol <= trirTarget * 0.8 ? '#a7f3d0' : isExceedTarget ? '#fca5a5' : '#fde68a'
            }}
          >
            {rol <= trirTarget * 0.8 ? (isFa ? 'ایمن' : 'Safe') : isExceedTarget ? (isFa ? 'فراتر از هدف' : 'High') : (isFa ? 'مرز هدف' : 'Near')}
          </span>
        </div>

        {/* Indicators */}
        <div className="space-y-1.5 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-bold font-sans flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.rolling }} />
              {isFa ? 'نرخ TRIR رولینگ ۱۲ ماهه:' : 'Rolling TRIR:'}
            </span>
            <span 
              className="font-black text-sm"
              style={{ color: rol <= trirTarget * 0.8 ? '#059669' : isExceedTarget ? '#dc2626' : '#d97706' }}
            >
              {rol.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-bold font-sans flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.monthly }} />
              {isFa ? 'نرخ TRIR ماه جاری:' : 'Monthly TRIR:'}
            </span>
            <span className="font-bold text-sky-600 dark:text-sky-400">
              {mon.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-bold font-sans flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors.bar }} />
              {isFa ? 'تعداد حوادث LTI:' : 'LTI Incidents:'}
            </span>
            <span className={`font-black ${rowData.incidents > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600'}`}>
              {rowData.incidents} {isFa ? 'مورد' : 'cases'}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 font-sans">{isFa ? 'مجموع کارکرد کارگاه:' : 'Total Hours:'}</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {rowData.totalHours.toLocaleString('en-US')} {isFa ? 'ساعت' : 'hrs'}
            </span>
          </div>

          {rowData.notes && (
            <div className="text-[10px] font-sans text-slate-500 dark:text-slate-400 pt-1 italic">
              {rowData.notes}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all ${
        isExpanded ? 'fixed inset-4 z-50 overflow-auto p-6 shadow-2xl flex flex-col' : 'p-5 space-y-4'
      }`}
      id="trir-chart-card"
    >
      {/* Top Header & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base">
              {isFa ? 'نمودار تحلیل روند پایش TRIR (رولینگ ۱۲ ماهه در برابر هدف کارگاه)' : 'TRIR Trend Analysis (12-Month Rolling vs Site Target)'}
            </h3>
          </div>
          <p className="text-[11px] text-slate-400">
            {isFa 
              ? `پایش شاخص فراوانی تجمعی در پنجره زمانی ۱۲ ماهه • هدف تعیین‌شده: ${trirTarget.toFixed(2)}` 
              : `Cumulative 12-Month window analysis • Target: ${trirTarget.toFixed(2)}`}
          </p>
        </div>

        {/* Toolbar buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Time range quick filters */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <button
              onClick={() => setTimeRange('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${timeRange === 'all' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {isFa ? 'همه' : 'All'}
            </button>
            <button
              onClick={() => setTimeRange('last12')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${timeRange === 'last12' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {isFa ? '۱۲ ماه اخیر' : '12M'}
            </button>
            <button
              onClick={() => setTimeRange('last24')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${timeRange === 'last24' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {isFa ? '۲۴ ماه اخیر' : '24M'}
            </button>
            <button
              onClick={() => setTimeRange('1404')}
              className={`px-2 py-1 rounded-lg font-bold transition-all ${timeRange === '1404' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              ۱۴۰۴
            </button>
            <button
              onClick={() => setTimeRange('1403')}
              className={`px-2 py-1 rounded-lg font-bold transition-all ${timeRange === '1403' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              ۱۴۰۳
            </button>
          </div>

          {/* Settings / Customize button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              showSettings 
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs' 
                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isFa ? 'شخصی‌سازی نمودار' : 'Customize'}</span>
          </button>

          {/* Export PNG */}
          <button
            onClick={handleExportPNG}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-bold transition-colors cursor-pointer border border-sky-200/60 dark:border-sky-800/60"
            title={isFa ? 'ذخیره عکس با کیفیت بالا' : 'Download PNG'}
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600 dark:text-sky-400" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isExporting ? (isFa ? 'در حال تهیه...' : 'Exporting...') : (isFa ? 'خروجی عکس' : 'PNG')}</span>
          </button>

          {/* Export full Excel */}
          <button
            onClick={() => exportTrirFullExcel(data, trirTarget)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-emerald-200/60 dark:border-emerald-800/60"
            title={isFa ? 'دانلود گزارش کامل اکسل' : 'Download Excel Report'}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isFa ? 'اکسل تحلیلی' : 'Excel'}</span>
          </button>

          {/* Maximize / Fullscreen Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isExpanded ? (isFa ? 'خروج از حالت تمام صفحه' : 'Exit Fullscreen') : (isFa ? 'تمام صفحه' : 'Maximize')}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsible Chart Customization Drawer */}
      {showSettings && (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3.5 text-xs animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700 pb-2">
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-amber-500" />
              {isFa ? 'تنظیمات و شخصی‌سازی ظاهر و عناصر نمودار' : 'Chart Customization & Appearance Settings'}
            </span>
            <button 
              onClick={() => {
                setShowIncidents(true);
                setShowRollingTRIR(true);
                setShowMonthlyTRIR(true);
                setShowTargetLine(true);
                setShowSafeZone(true);
                setShowDataLabels(false);
                setCurveType('monotone');
                setColorTheme('modern-hse');
                setBarWidth(20);
              }}
              className="text-[11px] text-amber-600 hover:underline flex items-center gap-1 font-bold cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{isFa ? 'بازنشانی تنظیمات' : 'Reset to Default'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Layers Toggles */}
            <div className="space-y-2">
              <span className="font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'لایه‌های قابل نمایش:' : 'Visible Layers:'}</span>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showIncidents} 
                  onChange={(e) => setShowIncidents(e.target.checked)} 
                  className="rounded text-amber-500"
                />
                <span>{isFa ? 'ستون‌های تعداد حوادث LTI' : 'LTI Incidents Bars'}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showRollingTRIR} 
                  onChange={(e) => setShowRollingTRIR(e.target.checked)} 
                  className="rounded text-amber-500"
                />
                <span>{isFa ? 'خط نرخ TRIR رولینگ ۱۲ ماهه' : '12M Rolling TRIR'}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showMonthlyTRIR} 
                  onChange={(e) => setShowMonthlyTRIR(e.target.checked)} 
                  className="rounded text-amber-500"
                />
                <span>{isFa ? 'خط نرخ TRIR ماه جاری' : 'Monthly TRIR'}</span>
              </label>
            </div>

            {/* Target & Boundary Toggles */}
            <div className="space-y-2">
              <span className="font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'حدود آستانه و راهنما:' : 'Threshold & Guides:'}</span>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showTargetLine} 
                  onChange={(e) => setShowTargetLine(e.target.checked)} 
                  className="rounded text-amber-500"
                />
                <span>{isFa ? 'خط هدف گذاری کل کارگاه' : 'Site Target Line'}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showSafeZone} 
                  onChange={(e) => setShowSafeZone(e.target.checked)} 
                  className="rounded text-amber-500"
                />
                <span>{isFa ? 'سایه‌روشن محدوده ایمن (زیر هدف)' : 'Safe Zone Shading'}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showDataLabels} 
                  onChange={(e) => setShowDataLabels(e.target.checked)} 
                  className="rounded text-amber-500"
                />
                <span>{isFa ? 'نمایش مقادیر روی نقاط داده' : 'Show Data Labels'}</span>
              </label>
            </div>

            {/* Line Curve & Bar Width */}
            <div className="space-y-2">
              <span className="font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'فرمت خطوط و ستون‌ها:' : 'Curve & Bar Sizing:'}</span>
              
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-slate-500 w-20">{isFa ? 'نوع منحنی:' : 'Curve:'}</label>
                <select 
                  value={curveType}
                  onChange={(e) => setCurveType(e.target.value as CurveType)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs flex-1"
                >
                  <option value="monotone">{isFa ? 'منحنی نرم (Smooth Spline)' : 'Smooth (Monotone)'}</option>
                  <option value="linear">{isFa ? 'خط مستقیم (Linear)' : 'Linear'}</option>
                  <option value="step">{isFa ? 'پله‌ای (Step)' : 'Step'}</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-slate-500 w-20">{isFa ? 'عرض ستون:' : 'Bar Width:'}</label>
                <input 
                  type="range"
                  min={10}
                  max={35}
                  value={barWidth}
                  onChange={(e) => setBarWidth(parseInt(e.target.value, 10))}
                  className="flex-1 accent-amber-500 cursor-pointer"
                />
                <span className="font-mono text-[11px] w-6 text-left">{barWidth}</span>
              </div>
            </div>

            {/* Color Palette */}
            <div className="space-y-2">
              <span className="font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'تم و پالت رنگی:' : 'Color Theme:'}</span>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="colorTheme" 
                    checked={colorTheme === 'modern-hse'} 
                    onChange={() => setColorTheme('modern-hse')} 
                  />
                  <span>{isFa ? 'استاندارد ایمنی HSE (طلایی، فیروزه‌ای، سرخ)' : 'Standard HSE'}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="colorTheme" 
                    checked={colorTheme === 'emerald-indigo'} 
                    onChange={() => setColorTheme('emerald-indigo')} 
                  />
                  <span>{isFa ? 'صنعتی نیلی و زمردی' : 'Indigo & Emerald'}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="colorTheme" 
                    checked={colorTheme === 'high-contrast'} 
                    onChange={() => setColorTheme('high-contrast')} 
                  />
                  <span>{isFa ? 'کنتراست بالا (High Contrast)' : 'High Contrast'}</span>
                </label>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Chart Canvas Area */}
      <div 
        ref={chartRef}
        className={`w-full min-w-0 bg-white dark:bg-slate-900 p-2 sm:p-4 rounded-xl transition-all ${
          isExpanded ? 'flex-1 min-h-[500px]' : 'h-80 sm:h-96 min-h-[320px]'
        }`}
        id="trir-analytical-chart"
      >
        {filteredData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} debounce={50}>
            <ComposedChart data={filteredData} margin={{ top: 20, right: 20, left: 10, bottom: 25 }}>
              <defs>
                {/* Modern subtle gradient for bars */}
                <linearGradient id="incidentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.bar} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={colors.bar} stopOpacity={0.4} />
                </linearGradient>
                {/* Subtle gradient for rolling line glow */}
                <linearGradient id="rollingGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.rolling} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={colors.rolling} stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid 
                strokeDasharray="4 4" 
                stroke="#e2e8f0" 
                className="dark:stroke-slate-800"
                vertical={false} 
              />

              {/* X Axis */}
              <XAxis 
                dataKey="label" 
                interval="preserveStartEnd"
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                tickLine={{ stroke: '#cbd5e1' }}
                dy={8}
              />

              {/* Y Axis Left: TRIR Index */}
              <YAxis 
                yAxisId="left" 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                tickLine={{ stroke: '#cbd5e1' }}
                label={{ 
                  value: 'TRIR Index', 
                  angle: -90, 
                  position: 'insideLeft', 
                  style: { fill: '#64748b', fontSize: 11, fontWeight: 700 } 
                }} 
              />

              {/* Y Axis Right: Incidents count */}
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                tickLine={{ stroke: '#cbd5e1' }}
                allowDecimals={false}
                label={{ 
                  value: isFa ? 'تعداد حوادث' : 'Incident Cases', 
                  angle: 90, 
                  position: 'insideRight', 
                  style: { fill: '#64748b', fontSize: 11, fontWeight: 700 } 
                }} 
              />

              <Tooltip content={<CustomTooltip />} />
              
              <Legend 
                wrapperStyle={{ paddingTop: '16px', fontSize: 11, fontWeight: 700 }}
                iconType="circle"
              />

              {/* Safe zone background under target */}
              {showSafeZone && showTargetLine && (
                <ReferenceArea 
                  {...({
                    yAxisId: "left",
                    y1: 0,
                    y2: trirTarget,
                    fill: colors.safeZone,
                    ifOverflow: "extendDomain"
                  } as any)}
                />
              )}

              {/* Target Line Reference */}
              {showTargetLine && (
                <ReferenceLine 
                  yAxisId="left" 
                  y={trirTarget} 
                  stroke={colors.target} 
                  strokeDasharray="6 4" 
                  strokeWidth={2}
                  label={{ 
                    value: isFa ? `هدف کارگاه (${trirTarget})` : `Target (${trirTarget})`, 
                    fill: colors.target, 
                    fontSize: 10, 
                    fontWeight: 800,
                    position: 'insideTopLeft'
                  }} 
                />
              )}

              {/* Bar: Incidents */}
              {showIncidents && (
                <Bar 
                  yAxisId="right" 
                  dataKey="incidents" 
                  name={isFa ? "تعداد حوادث LTI" : "Incidents"} 
                  fill="url(#incidentGradient)" 
                  radius={[4, 4, 0, 0]} 
                  barSize={barWidth}
                >
                  {showDataLabels && (
                    <LabelList 
                      dataKey="incidents" 
                      position="top" 
                      style={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                      formatter={(val: any) => val > 0 ? val : ''}
                    />
                  )}
                </Bar>
              )}

              {/* Line: Monthly TRIR */}
              {showMonthlyTRIR && (
                <Line 
                  yAxisId="left" 
                  type={curveType} 
                  dataKey="monthlyTRIR" 
                  name={isFa ? "نرخ TRIR ماهیانه" : "Monthly TRIR"} 
                  stroke={colors.monthly} 
                  strokeWidth={2} 
                  strokeDasharray="4 4" 
                  dot={{ r: 3, fill: colors.monthly, strokeWidth: 1 }} 
                  activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                />
              )}

              {/* Line: Rolling 12M TRIR */}
              {showRollingTRIR && (
                <Line 
                  yAxisId="left" 
                  type={curveType} 
                  dataKey="rollingTRIR" 
                  name={isFa ? "نرخ TRIR رولینگ ۱۲ ماهه" : "Rolling 12M TRIR"} 
                  stroke={colors.rolling} 
                  strokeWidth={3.5} 
                  dot={{ r: 4, fill: colors.rolling, stroke: '#ffffff', strokeWidth: 1.5 }} 
                  activeDot={{ r: 7, fill: colors.rolling, stroke: '#ffffff', strokeWidth: 2 }}
                >
                  {showDataLabels && (
                    <LabelList 
                      dataKey="rollingTRIR" 
                      position="top" 
                      style={{ fill: colors.rolling, fontSize: 10, fontWeight: 800 }} 
                      formatter={(val: any) => val ? Number(val).toFixed(2) : ''}
                    />
                  )}
                </Line>
              )}

            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
            <TrendingUp className="w-8 h-8 stroke-1 text-slate-300" />
            <p className="text-xs">{isFa ? 'داده‌ای در این بازه زمانی یافت نشد.' : 'No data in selected range.'}</p>
          </div>
        )}
      </div>

      {/* Bottom KPI Indicators Banner */}
      {windowStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between">
            <span className="text-[11px] text-slate-400">{isFa ? 'آخرین TRIR رولینگ:' : 'Latest Rolling:'}</span>
            <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
              {windowStats.latestRolling.toFixed(2)}
            </span>
          </div>

          <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between">
            <span className="text-[11px] text-slate-400">{isFa ? 'بیشترین TRIR دوره:' : 'Max in Window:'}</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-sm">
              {windowStats.maxRolling.toFixed(2)}
            </span>
          </div>

          <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between">
            <span className="text-[11px] text-slate-400">{isFa ? 'کل ساعات کارکرد بازه:' : 'Total Hours:'}</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
              {windowStats.totalHours.toLocaleString('en-US')}
            </span>
          </div>

          <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between">
            <span className="text-[11px] text-slate-400">{isFa ? 'حوادث LTI بازه:' : 'Incidents:'}</span>
            <span className={`font-mono font-black text-sm ${windowStats.totalIncidents > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {windowStats.totalIncidents}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
