import React, { useState } from 'react';
import {
  Scale,
  Search,
  Filter,
  TrendingUp,
  Activity,
  AlertTriangle,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { CustomizableChart } from '../CustomizableChart';
import { AdvancedFilterPanel, AdvancedFilterState } from '../AdvancedFilterPanel';
import { EmptySearchState } from '../EmptySearchState';
import { BMI_CATS } from '../seedData';

interface Props {
  joinedRecords: any[];
  filters: AdvancedFilterState;
  setFilters: (f: AdvancedFilterState) => void;
  isFilterActive: boolean;
  matchesAdvancedFilter: (r: any, f: AdvancedFilterState) => boolean;
  prioritySearch: (records: any[], q: string) => any[];
  toNum: (v: any) => number | null;
  avg: (nums: (number | null)[]) => number | null;
  bmiCat: (v: number | null) => any;
  jumpToPerson: (pid: string, year?: string) => void;
}

export const BmiTab: React.FC<Props> = ({
  joinedRecords,
  filters,
  setFilters,
  isFilterActive,
  matchesAdvancedFilter,
  prioritySearch,
  toNum,
  avg,
  bmiCat,
  jumpToPerson
}) => {
  const [explicitShowAll, setExplicitShowAll] = useState<boolean>(false);

  const companies = React.useMemo(() => {
    return [...new Set(joinedRecords.map(r => r.company).filter(Boolean))].sort();
  }, [joinedRecords]);

  const years = React.useMemo(() => {
    return [...new Set(joinedRecords.map(r => r.exam_year).filter(Boolean))].sort();
  }, [joinedRecords]);

  const validBmiRecords = React.useMemo(() => {
    return joinedRecords.filter(r => toNum(r.bmi) !== null);
  }, [joinedRecords, toNum]);

  const filteredRecords = React.useMemo(() => {
    if (!isFilterActive && !explicitShowAll) return [];

    let list = validBmiRecords.filter(r => matchesAdvancedFilter(r, filters));

    if (filters.search && filters.search.trim()) {
      list = prioritySearch(list, filters.search);
    }

    return list;
  }, [validBmiRecords, isFilterActive, explicitShowAll, filters, matchesAdvancedFilter, prioritySearch]);

  // BMI Category distribution chart data
  const chartData = React.useMemo(() => {
    const total = validBmiRecords.length || 1;
    return BMI_CATS.map(cat => {
      const count = validBmiRecords.filter(r => bmiCat(toNum(r.bmi))?.key === cat.key).length;
      return {
        label: cat.label_fa,
        value: count,
        color: cat.color,
        subLabel: `${cat.range} (${((count / total) * 100).toFixed(0)}٪)`
      };
    });
  }, [validBmiRecords, bmiCat, toNum]);

  const meanBmi = React.useMemo(() => {
    return avg(validBmiRecords.map(r => toNum(r.bmi)))?.toFixed(1) || '—';
  }, [validBmiRecords, avg, toNum]);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* BMI Overview Banner */}
      <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white">
                ارزیابی شاخص توده بدنی (BMI) پرسنل
              </h3>
              <p className="text-[11px] text-slate-400">
                بررسی نسبت وزن به مجذور قد (kg/m²) بر اساس استانداردهای سازمان بهداشت جهانی (WHO)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">میانگین شاخص سازمان:</span>
            <span className="text-base font-black font-mono text-teal-700 dark:text-teal-300 px-3 py-1 bg-teal-50 dark:bg-teal-950/60 rounded-xl border border-teal-200 dark:border-teal-800">
              {meanBmi} kg/m²
            </span>
          </div>
        </div>

        {/* 5 Categories Visual Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {BMI_CATS.map(cat => {
            const count = validBmiRecords.filter(r => bmiCat(toNum(r.bmi))?.key === cat.key).length;
            const pct = ((count / (validBmiRecords.length || 1)) * 100).toFixed(0);
            return (
              <div
                key={cat.key}
                onClick={() => {
                  setFilters({ ...filters, bmiCat: filters.bmiCat === cat.key ? '' : cat.key });
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer text-center ${
                  filters.bmiCat === cat.key
                    ? 'ring-2 ring-teal-500 bg-teal-50/50 dark:bg-teal-950/40 border-teal-400'
                    : 'bg-slate-50 dark:bg-slate-850/80 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100'
                }`}
              >
                <div className="w-3 h-3 rounded-full mx-auto mb-1.5" style={{ backgroundColor: cat.color }} />
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">{cat.label_fa}</span>
                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{cat.range}</span>
                <div className="text-lg font-black font-mono mt-1" style={{ color: cat.color }}>{count}</div>
                <span className="text-[10px] text-slate-400 font-bold">{pct}٪ سازمان</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Customizable Chart with numbers on top */}
      <CustomizableChart
        title="نمودار توزیع فراوانی رده‌های BMI"
        subtitle="تعداد کارکنان در هر رده وزنی با قابلیت تغییر پالت رنگی و قالب نمودار"
        icon={<TrendingUp className="w-4 h-4" />}
        data={chartData}
        unit="نفر"
        defaultType="bar"
        defaultPalette="multi"
        height={250}
      />

      {/* Advanced Filter Panel */}
      <AdvancedFilterPanel
        filters={filters}
        onFilterChange={(f) => {
          setFilters(f);
          setExplicitShowAll(false);
        }}
        companies={companies}
        years={years}
        totalRecordsCount={validBmiRecords.length}
        filteredRecordsCount={filteredRecords.length}
        isFiltered={isFilterActive || explicitShowAll}
        onShowAll={() => setExplicitShowAll(true)}
        placeholderText="جستجوی پرسنل در سوابق BMI: نام، کدملی، واحد سازمانی..."
      />

      {/* Table or Empty State */}
      {!isFilterActive && !explicitShowAll ? (
        <EmptySearchState
          title="جهت مشاهده فهرست انفرادی BMI پرسنل، جستجو یا فیلتر کنید"
          description="برای مشاهده لیست افراد و جزئیات قد و وزن، روی دسته‌های وزنی بالا کلیک کنید یا نام و کد ملی فرد را جستجو فرمایید."
          totalCount={validBmiRecords.length}
          onQuickFilter={(key, val) => {
            setFilters({ ...filters, [key]: val });
          }}
          onShowAll={() => setExplicitShowAll(true)}
          icon={<Scale className="w-9 h-9 sm:w-10 sm:h-10" />}
        />
      ) : (
        <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/80 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              نتایج تفکیکی BMI ({filteredRecords.length} نفر)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-[#f0f3f4] dark:bg-slate-800 font-extrabold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3.5">نام و نام‌خانوادگی</th>
                  <th className="p-3.5">محل خدمت</th>
                  <th className="p-3.5">قد (cm)</th>
                  <th className="p-3.5">وزن (kg)</th>
                  <th className="p-3.5">BMI</th>
                  <th className="p-3.5">وضعیت وزن</th>
                  <th className="p-3.5">سال معاینه</th>
                  <th className="p-3.5 text-center">پرونده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                      هیچ رکوردی منطبق با فیلتر BMI انتخاب‌شده یافت نشد.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(r => {
                    const v = toNum(r.bmi);
                    const cat = bmiCat(v);
                    return (
                      <tr
                        key={r.exam_id}
                        className="hover:bg-teal-50/40 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <td className="p-3.5 font-bold text-teal-800 dark:text-teal-300">
                          <div>{r.fname} {r.lname}</div>
                          <div className="text-[10px] text-slate-400 font-mono font-normal">کدملی: {r.nid || '—'}</div>
                        </td>
                        <td className="p-3.5 text-slate-700 dark:text-slate-300">{r.company}</td>
                        <td className="p-3.5 font-mono">{r.height || '—'}</td>
                        <td className="p-3.5 font-mono">{r.weight || '—'}</td>
                        <td className="p-3.5 font-mono font-black text-slate-900 dark:text-white">{v}</td>
                        <td className="p-3.5">
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ backgroundColor: `${cat?.color}22`, color: cat?.color }}
                          >
                            {cat?.label_fa || '—'}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-500">{r.exam_year}</td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => jumpToPerson(r.personnel_id, r.exam_year)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-teal-50 text-teal-700 dark:text-teal-400 font-bold text-[11px]"
                          >
                            مشاهده
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BmiTab;
