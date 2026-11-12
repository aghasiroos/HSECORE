import React, { useState } from 'react';
import {
  BarChart2,
  BarChart3,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Palette,
  Hash,
  Grid,
  Sparkles,
  X,
  Check,
  Layers,
  RotateCcw,
  Sliders,
  Table as TableIcon,
  LayoutGrid,
  Radar as RadarIcon,
  AlignLeft,
  Activity,
  Award,
  Building2,
  TrendingUp,
  ShieldAlert
} from 'lucide-react';

export type PermitChartType = 'donut' | 'pie' | 'bar' | 'barHorizontal' | 'radar' | 'cards';
export type UnitsChartType = 'table' | 'bar' | 'barHorizontal' | 'pie' | 'radar';
export type YearlyChartType = 'bar' | 'line' | 'area' | 'radar';
export type MonthlyChartType = 'area' | 'bar' | 'line';
export type PersonnelChartType = 'table' | 'bar' | 'barHorizontal' | 'line' | 'pie';
export type DefectAreasChartType = 'cards' | 'bar' | 'barHorizontal';

export interface ChartSettings {
  showDataLabels: boolean;
  colorTheme: 'safety' | 'petroleum' | 'ocean' | 'contrast';
  showGrid: boolean;
  enableAnimation: boolean;

  // Chart type selections
  permitTypeChart: PermitChartType;
  unitsDefectChart: UnitsChartType;
  yearlyTrendChart: YearlyChartType;
  monthlyTrendChart: MonthlyChartType;
  personnelRankingChart: PersonnelChartType;
  defectAreasChart: DefectAreasChartType;
}

export const THEME_PALETTES = {
  safety: {
    name: 'ایمنی استاندارد (Safety Standard)',
    description: 'رنگ‌های تفکیک‌شده آبی، قرمز، سبز، زرد و بنفش',
    primary: '#3b82f6',
    secondary: '#f43f5e',
    accent: '#10b981',
    warning: '#f59e0b',
    purple: '#8b5cf6',
    pieColors: ['#3b82f6', '#f43f5e', '#8b5cf6', '#f59e0b', '#10b981', '#06b6d4']
  },
  petroleum: {
    name: 'نفت و انرژی (Petroleum Gold)',
    description: 'تم اختصاصی صنعتی، زرد کاتالیزوری، مشکی و کهربایی',
    primary: '#d97706',
    secondary: '#e11d48',
    accent: '#059669',
    warning: '#f59e0b',
    purple: '#475569',
    pieColors: ['#f59e0b', '#d97706', '#b45309', '#0284c7', '#059669', '#64748b']
  },
  ocean: {
    name: 'اقیانوسی مدرن (Ocean Cyan)',
    description: 'طیف فیروزه‌ای، سورمه‌ای، سبز دریایی و یاقوتی',
    primary: '#0284c7',
    secondary: '#f43f5e',
    accent: '#0d9488',
    warning: '#eab308',
    purple: '#6366f1',
    pieColors: ['#0284c7', '#06b6d4', '#0d9488', '#6366f1', '#f43f5e', '#eab308']
  },
  contrast: {
    name: 'کنتراست بالا (High Contrast)',
    description: 'رنگ‌های تفکیک‌پذیر با بالاترین وضوح بینایی',
    primary: '#2563eb',
    secondary: '#dc2626',
    accent: '#16a34a',
    warning: '#d97706',
    purple: '#7c3aed',
    pieColors: ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777']
  }
};

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  showDataLabels: true,
  colorTheme: 'safety',
  showGrid: true,
  enableAnimation: true,
  permitTypeChart: 'donut',
  unitsDefectChart: 'table',
  yearlyTrendChart: 'bar',
  monthlyTrendChart: 'area',
  personnelRankingChart: 'table',
  defectAreasChart: 'cards'
};

export const CHART_SETTINGS_STORAGE_KEY = 'ptw_audit_chart_preferences_v2';

export const loadSavedChartSettings = (): ChartSettings => {
  try {
    const saved = localStorage.getItem(CHART_SETTINGS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_CHART_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load chart preferences from localStorage', e);
  }
  return DEFAULT_CHART_SETTINGS;
};

export const saveChartSettingsToStorage = (settings: ChartSettings) => {
  try {
    localStorage.setItem(CHART_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save chart preferences to localStorage', e);
  }
};

interface ChartCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ChartSettings;
  onChangeSettings: (newSettings: ChartSettings) => void;
}

export default function ChartCustomizationModal({
  isOpen,
  onClose,
  settings,
  onChangeSettings
}: ChartCustomizationModalProps) {
  const [activeTab, setActiveTab] = useState<'types' | 'appearance'>('types');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleUpdate = (updated: ChartSettings) => {
    onChangeSettings(updated);
    saveChartSettingsToStorage(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleReset = () => {
    handleUpdate(DEFAULT_CHART_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>شخصی‌سازی نوع و تنظیمات نمودارها</span>
                {savedSuccess && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold animate-in fade-in duration-150">
                    ذخیره شد ✓
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                تغییر نوع نمودارها (ستونی، خطی، دایره‌ای، راداری و ...) و ذخیره پایدار در سیستم
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-5 pt-3 bg-slate-50/50 dark:bg-slate-900/50 gap-2">
          <button
            onClick={() => setActiveTab('types')}
            className={`pb-3 px-3 text-xs font-black transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeTab === 'types'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>انتخاب نوع نمودارها (Chart Types)</span>
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`pb-3 px-3 text-xs font-black transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeTab === 'appearance'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>پالت رنگی و استایل دیداری</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 overflow-y-auto flex-1">
          
          {activeTab === 'types' ? (
            <div className="space-y-6">
              
              {/* 1. Permit Types Chart */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        ۱. نمودار توزیع انواع پروانه کار
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        نمایش مقایسه‌ای حجم ممیزی و درصد خطای پروانه‌های گرم، سرد، فضای بسته و ...
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold">
                    {settings.permitTypeChart === 'donut' ? 'دونات' :
                     settings.permitTypeChart === 'pie' ? 'دایره‌ای' :
                     settings.permitTypeChart === 'bar' ? 'ستونی عمودی' :
                     settings.permitTypeChart === 'barHorizontal' ? 'میله‌ای افقی' :
                     settings.permitTypeChart === 'radar' ? 'راداری' : 'کارت‌ها'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
                  {[
                    { id: 'donut', label: 'دونات', icon: <PieIcon className="w-4 h-4" /> },
                    { id: 'pie', label: 'دایره‌ای', icon: <PieIcon className="w-4 h-4" /> },
                    { id: 'bar', label: 'ستونی', icon: <BarChart3 className="w-4 h-4" /> },
                    { id: 'barHorizontal', label: 'میله‌ای افقی', icon: <AlignLeft className="w-4 h-4" /> },
                    { id: 'radar', label: 'راداری', icon: <RadarIcon className="w-4 h-4" /> },
                    { id: 'cards', label: 'کارت‌ها', icon: <LayoutGrid className="w-4 h-4" /> }
                  ].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleUpdate({ ...settings, permitTypeChart: option.id as PermitChartType })}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        settings.permitTypeChart === option.id
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="mb-1 text-slate-500">{option.icon}</div>
                      <span className="text-[11px]">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Operational Units Ranking Chart */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-500" />
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        ۲. نمودار رتبه‌بندی خطای واحدهای عملیاتی
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        پایش میزان عدم انطباق‌ها و رتبه‌بندی رعایت اصول ایمنی در سایت‌ها
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 font-bold">
                    {settings.unitsDefectChart === 'table' ? 'جدول' :
                     settings.unitsDefectChart === 'bar' ? 'ستونی عمودی' :
                     settings.unitsDefectChart === 'barHorizontal' ? 'میله‌ای افقی' :
                     settings.unitsDefectChart === 'pie' ? 'دایره‌ای' : 'راداری'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
                  {[
                    { id: 'table', label: 'جدول تحلیلی', icon: <TableIcon className="w-4 h-4" /> },
                    { id: 'barHorizontal', label: 'میله‌ای افقی', icon: <AlignLeft className="w-4 h-4" /> },
                    { id: 'bar', label: 'ستونی عمودی', icon: <BarChart3 className="w-4 h-4" /> },
                    { id: 'pie', label: 'دایره‌ای', icon: <PieIcon className="w-4 h-4" /> },
                    { id: 'radar', label: 'راداری', icon: <RadarIcon className="w-4 h-4" /> }
                  ].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleUpdate({ ...settings, unitsDefectChart: option.id as UnitsChartType })}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        settings.unitsDefectChart === option.id
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="mb-1 text-slate-500">{option.icon}</div>
                      <span className="text-[11px]">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Yearly Multi-Year Trend Chart */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        ۳. نمودار مقایسه و روند سالانه ممیزی‌ها
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        روند چندساله تعداد کل پروانه‌ها، موارد دارای خطا و درصد تغییرات
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-bold">
                    {settings.yearlyTrendChart === 'bar' ? 'ستونی چندگانه' :
                     settings.yearlyTrendChart === 'line' ? 'خطی روند' :
                     settings.yearlyTrendChart === 'area' ? 'مساحتی (Area)' : 'راداری'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { id: 'bar', label: 'ستونی مقایسه‌ای', icon: <BarChart3 className="w-4 h-4" /> },
                    { id: 'line', label: 'خطی پیوسته', icon: <LineIcon className="w-4 h-4" /> },
                    { id: 'area', label: 'مساحتی (سطحی)', icon: <Activity className="w-4 h-4" /> },
                    { id: 'radar', label: 'راداری مقایسه‌ای', icon: <RadarIcon className="w-4 h-4" /> }
                  ].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleUpdate({ ...settings, yearlyTrendChart: option.id as YearlyChartType })}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        settings.yearlyTrendChart === option.id
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="mb-1 text-slate-500">{option.icon}</div>
                      <span className="text-[11px]">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Monthly Trend Chart */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-500" />
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        ۴. نمودار پایش روند ماهانه (۱۲ ماهه سال)
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        نمایش توزیع زمانی خطاهای ثبت‌شده در فروردین تا اسفند سال انتخابی
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 font-bold">
                    {settings.monthlyTrendChart === 'area' ? 'مساحتی (سطحی)' :
                     settings.monthlyTrendChart === 'bar' ? 'ستونی' : 'خطی'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { id: 'area', label: 'مساحتی (Area)', icon: <Activity className="w-4 h-4" /> },
                    { id: 'bar', label: 'ستونی (Bar)', icon: <BarChart3 className="w-4 h-4" /> },
                    { id: 'line', label: 'خطی (Line)', icon: <LineIcon className="w-4 h-4" /> }
                  ].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleUpdate({ ...settings, monthlyTrendChart: option.id as MonthlyChartType })}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        settings.monthlyTrendChart === option.id
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="mb-1 text-slate-500">{option.icon}</div>
                      <span className="text-[11px]">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Top 10 Personnel Ranking Chart */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-rose-500" />
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        ۵. نمودار رتبه‌بندی ۱۰ نفر دارای بیشترین خطا
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        تفکیک بر اساس مسئول محوطه، کشیک ارشد، مجری و ناظر ایمنی
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 font-bold">
                    {settings.personnelRankingChart === 'table' ? 'جدول رتبه‌بندی' :
                     settings.personnelRankingChart === 'barHorizontal' ? 'میله‌ای افقی' :
                     settings.personnelRankingChart === 'bar' ? 'ستونی عمودی' :
                     settings.personnelRankingChart === 'line' ? 'خطی' : 'دایره‌ای'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
                  {[
                    { id: 'table', label: 'جدول کامل', icon: <TableIcon className="w-4 h-4" /> },
                    { id: 'barHorizontal', label: 'میله‌ای افقی', icon: <AlignLeft className="w-4 h-4" /> },
                    { id: 'bar', label: 'ستونی عمودی', icon: <BarChart3 className="w-4 h-4" /> },
                    { id: 'line', label: 'خطی', icon: <LineIcon className="w-4 h-4" /> },
                    { id: 'pie', label: 'دایره‌ای سهم', icon: <PieIcon className="w-4 h-4" /> }
                  ].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleUpdate({ ...settings, personnelRankingChart: option.id as PersonnelChartType })}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        settings.personnelRankingChart === option.id
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="mb-1 text-slate-500">{option.icon}</div>
                      <span className="text-[11px]">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. Defect Areas (Hazards, PPE, Precautions) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        ۶. نمایش دسته‌بندی ۳ گانه خطاها (خطرات، PPE، تمهیدات)
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        نمایش اقلام ثبت‌شده توسط کاربر در فرم‌های پیوستی
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 font-bold">
                    {settings.defectAreasChart === 'cards' ? 'کارت‌های تفصیلی' :
                     settings.defectAreasChart === 'barHorizontal' ? 'میله‌ای افقی' : 'ستونی عمودی'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { id: 'cards', label: 'کارت‌های تفصیلی', icon: <LayoutGrid className="w-4 h-4" /> },
                    { id: 'barHorizontal', label: 'میله‌ای افقی', icon: <AlignLeft className="w-4 h-4" /> },
                    { id: 'bar', label: 'ستونی عمودی', icon: <BarChart3 className="w-4 h-4" /> }
                  ].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleUpdate({ ...settings, defectAreasChart: option.id as DefectAreasChartType })}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        settings.defectAreasChart === option.id
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="mb-1 text-slate-500">{option.icon}</div>
                      <span className="text-[11px]">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="space-y-5">
              
              {/* 1. Show Data Labels Switch */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                    <Hash className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      نمایش اعداد و مقادیر روی نمودار (Data Labels)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      درج مستقیم ارقام و درصدهای آماری بالای ستون‌ها و بخش‌های نمودار
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showDataLabels}
                    onChange={(e) => handleUpdate({ ...settings, showDataLabels: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* 2. Color Theme Selection */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                  <Palette className="w-4 h-4 text-amber-500" />
                  <span>پالت رنگی سراسری نمودارها</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(Object.keys(THEME_PALETTES) as Array<keyof typeof THEME_PALETTES>).map((key) => {
                    const theme = THEME_PALETTES[key];
                    const isSelected = settings.colorTheme === key;
                    return (
                      <div
                        key={key}
                        onClick={() => handleUpdate({ ...settings, colorTheme: key })}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 ring-2 ring-amber-500/20 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {theme.name.split('(')[0]}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 font-bold" />}
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                          {theme.pieColors.slice(0, 6).map((color, idx) => (
                            <span
                              key={idx}
                              className="w-4 h-4 rounded-full border border-white/40 shadow-xs"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                          {theme.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Grid Lines Toggle */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                    <Grid className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      خطوط راهنمای شبکه (Grid Lines)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      نمایش خطوط شطرنجی پس‌زمینه برای خوانش دقیق‌تر محورها
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showGrid}
                    onChange={(e) => handleUpdate({ ...settings, showGrid: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* 4. Animation Toggle */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      پویانمایی روان نمودارها (Animations)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      حرکت پویا و نرم ستون‌ها و منحنی‌ها هنگام تغییر فیلترها
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableAnimation}
                    onChange={(e) => handleUpdate({ ...settings, enableAnimation: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>بازنشانی به حالت استاندارد</span>
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-all shadow-md cursor-pointer active:scale-95"
            >
              ذخیره و بستن
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
