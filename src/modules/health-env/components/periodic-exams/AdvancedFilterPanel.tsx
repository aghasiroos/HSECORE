import React, { useState } from 'react';
import {
  Search,
  Filter,
  X,
  RotateCcw,
  SlidersHorizontal,
  Building2,
  Calendar,
  UserCheck,
  AlertCircle,
  Users,
  Heart,
  Scale,
  Activity,
  Flame,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export interface AdvancedFilterState {
  search: string;
  company: string;
  year: string;
  opinion: string;
  followup: string;
  gender: string;
  ageRange: string;
  bmiCat: string;
  bpStatus: string;
  hazard: string;
  labAbnormalOnly: boolean;
  diseaseOnly: boolean;
  referralOnly: boolean;
}

export const INITIAL_FILTER_STATE: AdvancedFilterState = {
  search: '',
  company: '',
  year: '',
  opinion: '',
  followup: '',
  gender: '',
  ageRange: '',
  bmiCat: '',
  bpStatus: '',
  hazard: '',
  labAbnormalOnly: false,
  diseaseOnly: false,
  referralOnly: false
};

interface Props {
  filters: AdvancedFilterState;
  onFilterChange: (filters: AdvancedFilterState) => void;
  companies: string[];
  years: string[];
  hazards?: string[];
  totalRecordsCount: number;
  filteredRecordsCount: number;
  isFiltered: boolean;
  onShowAll?: () => void;
  placeholderText?: string;
  className?: string;
}

export const AdvancedFilterPanel: React.FC<Props> = ({
  filters,
  onFilterChange,
  companies,
  years,
  hazards = ['صدا', 'ارگونومی', 'گرد و غبار', 'مواد شیمیایی', 'شیفت کاری', 'روشنایی', 'ارتعاش'],
  totalRecordsCount,
  filteredRecordsCount,
  isFiltered,
  onShowAll,
  placeholderText = 'جستجوی سه‌سطحی: ۱) کدملی  ۲) کد پرسنلی  ۳) نام و نام خانوادگی...',
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const activeFilterCount = Object.entries(filters).filter(([key, val]) => {
    if (typeof val === 'boolean') return val === true;
    return val !== '' && val !== 'all';
  }).length;

  const updateField = (field: keyof AdvancedFilterState, value: any) => {
    onFilterChange({
      ...filters,
      [field]: value
    });
  };

  const resetFilters = () => {
    onFilterChange({ ...INITIAL_FILTER_STATE });
  };

  return (
    <div className={`bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3 ${className}`}>
      {/* Primary Search Bar + Quick Actions */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
        {/* Search Input Box */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-teal-600 dark:text-teal-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateField('search', e.target.value)}
            placeholder={placeholderText}
            className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-850/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => updateField('search', '')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Dropdown: Company */}
        <div className="w-full md:w-44 shrink-0">
          <select
            value={filters.company}
            onChange={(e) => updateField('company', e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-850/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-teal-500/30 outline-none cursor-pointer"
          >
            <option value="">🏢 تمام محل‌های خدمت</option>
            {companies.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Quick Dropdown: Year */}
        <div className="w-full md:w-32 shrink-0">
          <select
            value={filters.year}
            onChange={(e) => updateField('year', e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-850/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-teal-500/30 outline-none cursor-pointer"
          >
            <option value="">📅 همه سال‌ها</option>
            {years.map(y => (
              <option key={y} value={y}>سال {y}</option>
            ))}
          </select>
        </div>

        {/* Expand / Collapse Advanced Filters Button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all shrink-0 ${
            isExpanded || activeFilterCount > 0
              ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>فیلتر پیشرفته</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center font-mono font-bold">
              {activeFilterCount}
            </span>
          )}
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Reset Filters */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            title="پاکسازی تمام فیلترها"
            className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-bold flex items-center gap-1 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">حذف فیلترها</span>
          </button>
        )}
      </div>

      {/* Advanced Filters Expandable Grid */}
      {isExpanded && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs animate-fadeIn">
          {/* Final Medical Opinion */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-teal-600" />
              نظریه نهایی طب کار
            </label>
            <select
              value={filters.opinion}
              onChange={(e) => updateField('opinion', e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
            >
              <option value="">همه نظریه‌ها</option>
              <option value="بلامانع">بلامانع</option>
              <option value="مشروط">مشروط</option>
              <option value="عدم صلاحیت">عدم صلاحیت</option>
              <option value="ارجاع">ارجاع به متخصص</option>
              <option value="نیاز به بررسی مجدد">نیاز به بررسی مجدد</option>
            </select>
          </div>

          {/* Follow-up Required */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-amber-500" />
              وضعیت پیگیری سلامت
            </label>
            <select
              value={filters.followup}
              onChange={(e) => updateField('followup', e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
            >
              <option value="">همه وضعیت‌ها</option>
              <option value="yes">فقط نیازمند پیگیری</option>
              <option value="no">بدون نیاز به پیگیری</option>
            </select>
          </div>

          {/* BMI Category */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Scale className="w-3 h-3 text-indigo-500" />
              رده شاخص توده بدنی (BMI)
            </label>
            <select
              value={filters.bmiCat}
              onChange={(e) => updateField('bmiCat', e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
            >
              <option value="">همه وضعیت‌های BMI</option>
              <option value="under">کم‌وزن (زیر ۱۸.۵)</option>
              <option value="normal">طبیعی (۱۸.۵ تا ۲۴.۹)</option>
              <option value="over">اضافه‌وزن (۲۵ تا ۲۹.۹)</option>
              <option value="obese1">چاق (۳۰ تا ۳۴.۹)</option>
              <option value="obese2">چاقی مفرط (۳۵ به بالا)</option>
            </select>
          </div>

          {/* Blood Pressure Status */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Heart className="w-3 h-3 text-rose-500" />
              وضعیت فشار خون
            </label>
            <select
              value={filters.bpStatus}
              onChange={(e) => updateField('bpStatus', e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
            >
              <option value="">همه وضعیت‌های فشار خون</option>
              <option value="طبیعی">طبیعی</option>
              <option value="در آستانه">در آستانه (پیش‌فشار)</option>
              <option value="فشار خون بالا (مرحله ۱)">فشار خون بالا (مرحله ۱)</option>
              <option value="فشار خون بالا (مرحله ۲)">فشار خون بالا (مرحله ۲)</option>
            </select>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Users className="w-3 h-3 text-teal-600" />
              جنسیت
            </label>
            <select
              value={filters.gender}
              onChange={(e) => updateField('gender', e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
            >
              <option value="">همه</option>
              <option value="مرد">مرد</option>
              <option value="زن">زن</option>
            </select>
          </div>

          {/* Hazard Factors */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Flame className="w-3 h-3 text-blue-500" />
              عامل زیان‌آور محیط کار
            </label>
            <select
              value={filters.hazard}
              onChange={(e) => updateField('hazard', e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
            >
              <option value="">همه عوامل زیان‌آور</option>
              {hazards.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          {/* Special Toggle Badges */}
          <div className="sm:col-span-2 flex items-center gap-2 flex-wrap pt-2">
            <button
              type="button"
              onClick={() => updateField('labAbnormalOnly', !filters.labAbnormalOnly)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all ${
                filters.labAbnormalOnly
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-400 text-rose-700 dark:text-rose-300 ring-1 ring-rose-400'
                  : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-rose-500" />
              <span>فقط آزمایش‌های غیرطبیعی</span>
            </button>

            <button
              type="button"
              onClick={() => updateField('diseaseOnly', !filters.diseaseOnly)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all ${
                filters.diseaseOnly
                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400'
                  : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>دارای تشخیص بیماری</span>
            </button>

            <button
              type="button"
              onClick={() => updateField('referralOnly', !filters.referralOnly)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all ${
                filters.referralOnly
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-400'
                  : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>دارای ارجاع تخصصی</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs border-t border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          {isFiltered ? (
            <span className="flex items-center gap-1 text-teal-700 dark:text-teal-300 font-bold bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-md border border-teal-200 dark:border-teal-800">
              <span>نمایش</span>
              <span className="font-mono text-sm">{filteredRecordsCount}</span>
              <span>از مجموع {totalRecordsCount} پرونده سلامت</span>
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <span>🔒 حالت پیش‌فرض فعال: پرسنل بدون سرچ یا اعمال فیلتر نمایش داده نمی‌شوند.</span>
            </span>
          )}
        </div>

        {/* Quick override: Show all button if user requests */}
        {!isFiltered && onShowAll && (
          <button
            type="button"
            onClick={onShowAll}
            className="text-[11px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 underline underline-offset-4"
          >
            مشاهده تمام {totalRecordsCount} پرونده ثبت‌شده
          </button>
        )}
      </div>
    </div>
  );
};

export default AdvancedFilterPanel;
