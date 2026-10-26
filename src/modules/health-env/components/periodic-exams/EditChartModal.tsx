import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Sliders,
  Palette,
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  Layers,
  LayoutGrid,
  Check,
  HelpCircle
} from 'lucide-react';
import { AVAILABLE_METRICS, MetricDefinition, getMetricIcon } from './chartMetrics';
import { ChartType, ChartPalette, PALETTES } from './CustomizableChart';

export interface UserChartItemConfig {
  id: string;
  metricKey: string;
  title: string;
  subtitle: string;
  chartType: ChartType;
  palette: ChartPalette;
  width: 'half' | 'full';
  height?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: UserChartItemConfig) => void;
  initialConfig?: UserChartItemConfig | null;
  filteredRecords: any[];
}

export const EditChartModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
  filteredRecords
}) => {
  const [selectedMetricKey, setSelectedMetricKey] = useState<string>('opinion');
  const [title, setTitle] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('');
  const [chartType, setChartType] = useState<ChartType>('donut');
  const [palette, setPalette] = useState<ChartPalette>('multi');
  const [width, setWidth] = useState<'half' | 'full'>('half');
  const [activeCategory, setActiveCategory] = useState<string>('همه');

  // Initialize form when opened
  useEffect(() => {
    if (initialConfig) {
      setSelectedMetricKey(initialConfig.metricKey);
      setTitle(initialConfig.title);
      setSubtitle(initialConfig.subtitle || '');
      setChartType(initialConfig.chartType);
      setPalette(initialConfig.palette);
      setWidth(initialConfig.width || 'half');
    } else {
      // Default new chart
      const firstMetric = AVAILABLE_METRICS['opinion'] || Object.values(AVAILABLE_METRICS)[0];
      setSelectedMetricKey(firstMetric.key);
      setTitle(firstMetric.defaultTitle);
      setSubtitle(firstMetric.defaultSubtitle);
      setChartType(firstMetric.defaultType);
      setPalette(firstMetric.defaultPalette);
      setWidth('half');
    }
  }, [initialConfig, isOpen]);

  // When metric changes, auto-fill defaults if adding new or if user hasn't overridden
  const handleMetricSelect = (mKey: string) => {
    setSelectedMetricKey(mKey);
    const def = AVAILABLE_METRICS[mKey];
    if (def) {
      if (!initialConfig || title === '' || title === AVAILABLE_METRICS[selectedMetricKey]?.defaultTitle) {
        setTitle(def.defaultTitle);
        setSubtitle(def.defaultSubtitle);
        setChartType(def.defaultType);
        setPalette(def.defaultPalette);
      }
    }
  };

  if (!isOpen) return null;

  const categories = ['همه', 'عمومی و سازمانی', 'ارزیابی‌های پایه و بالینی', 'آزمایشگاه', 'تست‌های پاراکلینیک', 'عوامل زیان‌آور و بیماری‌ها'];

  const filteredMetricsList = Object.values(AVAILABLE_METRICS).filter(m => {
    if (activeCategory === 'همه') return true;
    return m.category === activeCategory;
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const config: UserChartItemConfig = {
      id: initialConfig ? initialConfig.id : `chart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      metricKey: selectedMetricKey,
      title: title.trim() || AVAILABLE_METRICS[selectedMetricKey]?.defaultTitle || 'نمودار تحلیلی',
      subtitle: subtitle.trim(),
      chartType,
      palette,
      width,
      height: 260
    };
    onSave(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-[#17222c] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800 dark:text-white">
                {initialConfig ? 'شخصی‌سازی و ویرایش نمودار' : 'افزودن نمودار تحلیلی جدید به داشبورد'}
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                انتخاب شاخص سلامت شغلی، نوع نمایش هندسی، پالت رنگ و ابعاد
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 text-right">
          {/* Step 1: Metric Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-200">
              ۱. انتخاب شاخص تحلیلی داده‌های معاینات:
            </label>

            {/* Categories filter tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeCategory === cat
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-200 dark:border-slate-800 rounded-xl">
              {filteredMetricsList.map(m => {
                const isSelected = selectedMetricKey === m.key;
                return (
                  <div
                    key={m.key}
                    onClick={() => handleMetricSelect(m.key)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100 shadow-xs ring-1 ring-teal-500'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                      {getMetricIcon(m.icon)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold truncate">{m.label}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{m.description}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Title and Subtitle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                ۲. عنوان اختصاصی نمودار:
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="مثلاً: توزیع شاخص توده بدنی در سال ۱۴۰۳"
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                زیرعنوان یا توضیح تکمیلی (اختیاری):
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={e => setSubtitle(e.target.value)}
                placeholder="توضیحات مربوط به شاخص یا جامعه هدف"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Step 3: Chart Type */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-200">
              ۳. انتخاب فرم هندسی نمودار:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { type: 'bar' as ChartType, label: 'ستونی عمودی', icon: <BarChart3 className="w-4 h-4" /> },
                { type: 'hbar' as ChartType, label: 'میله‌ای افقی', icon: <div className="w-4 h-4 flex flex-col justify-between py-0.5"><div className="h-0.5 bg-current w-full"></div><div className="h-0.5 bg-current w-3/4"></div><div className="h-0.5 bg-current w-1/2"></div></div> },
                { type: 'line' as ChartType, label: 'خطی پیوسته', icon: <TrendingUp className="w-4 h-4" /> },
                { type: 'area' as ChartType, label: 'مساحتی سطحی', icon: <Layers className="w-4 h-4" /> },
                { type: 'donut' as ChartType, label: 'دایره‌ای / دونات', icon: <PieIcon className="w-4 h-4" /> }
              ].map(item => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setChartType(item.type)}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs transition-all ${
                    chartType === item.type
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-bold ring-1 ring-teal-500 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <div className={chartType === item.type ? 'text-teal-600' : 'text-slate-400'}>{item.icon}</div>
                  <span className="text-[11px]">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 4: Palette & Layout Width */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Palette */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5 text-teal-600" />
                ۴. پالت رنگی نمودار:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(PALETTES) as ChartPalette[]).map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPalette(key)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] transition-all ${
                      palette === key
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-bold ring-1 ring-teal-500'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex -space-x-1 shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PALETTES[key].colors[0] }} />
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PALETTES[key].colors[1] }} />
                    </div>
                    <span className="truncate">{PALETTES[key].name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Width Span */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                <LayoutGrid className="w-3.5 h-3.5 text-teal-600" />
                ۵. ابعاد قرارگیری در شبکه:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWidth('half')}
                  className={`p-3 rounded-xl border text-xs text-center transition-all ${
                    width === 'half'
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-bold ring-1 ring-teal-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="font-bold">نیم‌عرض (۱ ستون)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">مناسب برای کنار هم قرار گرفتن دو نمودار</div>
                </button>
                <button
                  type="button"
                  onClick={() => setWidth('full')}
                  className={`p-3 rounded-xl border text-xs text-center transition-all ${
                    width === 'full'
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-bold ring-1 ring-teal-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="font-bold">تمام‌عرض (۲ ستون)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">مناسب برای نمایش افقی یا روندهای طولانی</div>
                </button>
              </div>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{initialConfig ? 'ذخیره تغییرات نمودار' : 'افزودن نمودار به داشبورد'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
