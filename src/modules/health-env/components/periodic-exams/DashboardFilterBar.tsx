import React, { useState } from 'react';
import {
  Filter,
  RotateCcw,
  Search,
  Calendar,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Users,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface DashboardFilterState {
  search: string;
  year: string;
  company: string;
  opinion: string;
  hazard: string;
  gender: string;
  followup: string;
}

export const INITIAL_DASHBOARD_FILTERS: DashboardFilterState = {
  search: '',
  year: 'all',
  company: 'all',
  opinion: 'all',
  hazard: 'all',
  gender: 'all',
  followup: 'all'
};

interface Props {
  filters: DashboardFilterState;
  onChange: (filters: DashboardFilterState) => void;
  availableYears: string[];
  availableCompanies: string[];
  totalRecordsCount: number;
  filteredRecordsCount: number;
  filteredRecords: any[];
  onPrintReport: () => void;
}

export const DashboardFilterBar: React.FC<Props> = ({
  filters,
  onChange,
  availableYears,
  availableCompanies,
  totalRecordsCount,
  filteredRecordsCount,
  filteredRecords,
  onPrintReport
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const activeFiltersCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'search') return typeof v === 'string' && v.trim() !== '';
    return v !== 'all' && v !== '';
  }).length;

  const handleFieldChange = (key: keyof DashboardFilterState, val: string) => {
    onChange({
      ...filters,
      [key]: val
    });
  };

  const handleReset = () => {
    onChange(INITIAL_DASHBOARD_FILTERS);
  };

  // Export filtered dataset to Excel
  const handleExportExcel = () => {
    try {
      const exportRows = filteredRecords.map((r, idx) => ({
        'ردیف': idx + 1,
        'نام و نام خانوادگی': [r.fname, r.lname].filter(Boolean).join(' '),
        'کد ملی': r.nid || '',
        'کد پرسنلی': r.pcode || '',
        'محل خدمت / واحد': r.company || '',
        'سن': r.age || '',
        'جنسیت': r.gender || '',
        'تاریخ معاینه': r.exam_date || '',
        'سال معاینه': r.exam_year || '',
        'قد (cm)': r.height || '',
        'وزن (kg)': r.weight || '',
        'BMI': r.bmi || '',
        'فشارخون سیستول': r.bp_sys || '',
        'فشارخون دیاستول': r.bp_dia || '',
        'قند ناشتا FBS': r.fbs || '',
        'کلسترول': r.chol || '',
        'تری‌گلیسرید': r.tg || '',
        'اسپیرومتری': r.spiro_result || '',
        'اودیومتری راست': r.audio_r || '',
        'اودیومتری چپ': r.audio_l || '',
        'عوامل زیان آور': [r.haz_phys, r.haz_chem, r.haz_ergo, r.haz_bio].filter(Boolean).join(' | '),
        'بیماری ها': [r.dis_nonocc_new, r.dis_nonocc_known, r.dis_occ_new, r.dis_occ_known].filter(Boolean).join(' | '),
        'نظریه نهایی طب کار': r.final_opinion || '',
        'نیاز به پیگیری': r.final_followup_needed || '',
        'توصیه‌های پزشکی': r.final_advice || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'معاینات فیلترشده');
      XLSX.writeFile(wb, `Occupational_Health_Filtered_Exams_${Date.now()}.xlsx`);
    } catch (err) {
      console.error('Error exporting filtered exams to Excel:', err);
    }
  };

  return (
    <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3 transition-all">
      {/* Top Filter Bar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Title & Active Filter Summary */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                فیلترهای همزمان داشبورد و نمودارها
              </span>
              {activeFiltersCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  {activeFiltersCount} فیلتر فعال
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              نمایش {filteredRecordsCount} از {totalRecordsCount} پرونده معاینات ادواری
            </p>
          </div>
        </div>

        {/* Action Buttons: Reset, Excel, PDF, Toggle */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 transition-colors"
              title="پاکسازی تمام فیلترها"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بازنشانی فیلترها</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-teal-200 dark:border-teal-800/80 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-xs font-bold hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors"
            title="خروجی فایل اکسل از داده‌های فیلتر شده"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی اکسل</span>
          </button>

          <button
            type="button"
            onClick={onPrintReport}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="چاپ یا خروجی PDF داشبورد رسمی"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>خروجی PDF / چاپ</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isExpanded ? 'بستن پنل فیلتر' : 'باز کردن پنل فیلتر'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Filter Fields */}
      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
          {/* 1. Text Search */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
              جستجو در پرونده‌ها:
            </label>
            <div className="relative">
              <input
                type="text"
                value={filters.search}
                onChange={e => handleFieldChange('search', e.target.value)}
                placeholder="نام، کد ملی، پرسنلی..."
                className="w-full pl-2 pr-7 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5" />
            </div>
          </div>

          {/* 2. Year Filter */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-teal-600" />
              سال معاینه:
            </label>
            <select
              value={filters.year}
              onChange={e => handleFieldChange('year', e.target.value)}
              className="w-full px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">همه سال‌ها</option>
              {availableYears.map(y => (
                <option key={y} value={y}>سال {y}</option>
              ))}
            </select>
          </div>

          {/* 3. Company / Unit Filter */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-teal-600" />
              محل خدمت / واحد:
            </label>
            <select
              value={filters.company}
              onChange={e => handleFieldChange('company', e.target.value)}
              className="w-full px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">همه واحدها ({availableCompanies.length})</option>
              {availableCompanies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 4. Final Opinion Status */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-teal-600" />
              وضعیت نظریه طب کار:
            </label>
            <select
              value={filters.opinion}
              onChange={e => handleFieldChange('opinion', e.target.value)}
              className="w-full px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">تمام نظریه‌ها</option>
              <option value="بلامانع">بلامانع (Fit)</option>
              <option value="مشروط">مشروط (Conditional)</option>
              <option value="عدم صلاحیت">عدم صلاحیت (Unfit)</option>
              <option value="ارجاع">ارجاع تخصصی</option>
            </select>
          </div>

          {/* 5. Work Hazard */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-teal-600" />
              عوامل زیان‌آور:
            </label>
            <select
              value={filters.hazard}
              onChange={e => handleFieldChange('hazard', e.target.value)}
              className="w-full px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">همه عوامل زیان‌آور</option>
              <option value="صدا">سر و صدا / صوتی</option>
              <option value="حرارت">استرس حرارتی / گرما</option>
              <option value="ارگونومی">ارگونومی / حمل بار / ایستادن</option>
              <option value="شیمیایی">مواد شیمیایی / بخارات / گاز</option>
              <option value="غبار">گرد و غبار</option>
              <option value="نوبت">نوبت‌کاری / شیفت</option>
            </select>
          </div>

          {/* 6. Gender & Followup */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Users className="w-3 h-3 text-teal-600" />
              جنسیت / پیگیری:
            </label>
            <div className="grid grid-cols-2 gap-1">
              <select
                value={filters.gender}
                onChange={e => handleFieldChange('gender', e.target.value)}
                className="w-full px-1.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              >
                <option value="all">جنسیت: همه</option>
                <option value="مرد">آقا</option>
                <option value="زن">خانم</option>
              </select>
              <select
                value={filters.followup}
                onChange={e => handleFieldChange('followup', e.target.value)}
                className="w-full px-1.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              >
                <option value="all">پیگیری: همه</option>
                <option value="بله">دارد</option>
                <option value="خیر">ندارد</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
