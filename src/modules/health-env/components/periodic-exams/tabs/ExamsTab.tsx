import React, { useState } from 'react';
import {
  Calendar,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Building2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { AdvancedFilterPanel, AdvancedFilterState } from '../AdvancedFilterPanel';
import { EmptySearchState } from '../EmptySearchState';
import { VirtualizedDataTable, VirtualizedColumn } from '../../../../../components/common/virtualized/VirtualizedDataTable';

interface Props {
  joinedRecords: any[];
  filters: AdvancedFilterState;
  setFilters: (f: AdvancedFilterState) => void;
  isFilterActive: boolean;
  matchesAdvancedFilter: (r: any, f: AdvancedFilterState) => boolean;
  prioritySearch: (records: any[], q: string) => any[];
  jumpToPerson: (pid: string, year?: string) => void;
  renderOpinionBadge: (op: string) => React.ReactNode;
}

export const ExamsTab: React.FC<Props> = ({
  joinedRecords,
  filters,
  setFilters,
  isFilterActive,
  matchesAdvancedFilter,
  prioritySearch,
  jumpToPerson,
  renderOpinionBadge
}) => {
  const [explicitShowAll, setExplicitShowAll] = useState<boolean>(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'exam_date', dir: 'desc' });

  const companies = React.useMemo(() => {
    return [...new Set(joinedRecords.map(r => r.company).filter(Boolean))].sort();
  }, [joinedRecords]);

  const years = React.useMemo(() => {
    return [...new Set(joinedRecords.map(r => r.exam_year).filter(Boolean))].sort();
  }, [joinedRecords]);

  // Filtered records
  const filteredRecords = React.useMemo(() => {
    if (!isFilterActive && !explicitShowAll) {
      return [];
    }

    let list = joinedRecords.filter(r => matchesAdvancedFilter(r, filters));

    if (filters.search && filters.search.trim()) {
      list = prioritySearch(list, filters.search);
    }

    // Sort
    list.sort((a, b) => {
      const valA = (a[sortConfig.key] || '').toString();
      const valB = (b[sortConfig.key] || '').toString();
      return sortConfig.dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    return list;
  }, [joinedRecords, isFilterActive, explicitShowAll, filters, matchesAdvancedFilter, prioritySearch, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportFilteredToExcel = () => {
    if (!filteredRecords.length) return;
    const exportData = filteredRecords.map(r => ({
      'نام': r.fname,
      'نام خانوادگی': r.lname,
      'محل خدمت': r.company,
      'کد ملی': r.nid,
      'کد پرسنلی': r.pcode,
      'سن': r.age,
      'تاریخ معاینه': r.exam_date,
      'سال': r.exam_year,
      'قد (cm)': r.height,
      'وزن (kg)': r.weight,
      'BMI': r.bmi,
      'فشار سیستولیک': r.bp_sys,
      'فشار دیاستولیک': r.bp_dia,
      'قند ناشتا': r.fbs,
      'کلسترول': r.chol,
      'تری‌گلیسیرید': r.tg,
      'نظریه نهایی': r.final_opinion,
      'پزشک معاین': r.final_doctor,
      'نیاز به پیگیری': r.final_followup_needed || 'خیر'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'معاینات ادواری');
    XLSX.writeFile(wb, `Periodic_Medical_Exams_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const examColumns = React.useMemo<VirtualizedColumn<any>[]>(() => [
    {
      key: 'name',
      header: (
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort('fname')}>
          <span>نام و نام‌خانوادگی</span>
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
        </div>
      ),
      width: 150,
      render: (r) => (
        <div className="font-bold text-teal-800 dark:text-teal-300">
          <div>{r.fname} {r.lname}</div>
          <div className="text-[10px] text-slate-400 font-mono font-normal">کدملی: {r.nid || '—'}</div>
        </div>
      )
    },
    {
      key: 'company',
      header: (
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort('company')}>
          <span>محل خدمت</span>
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
        </div>
      ),
      width: 140,
      render: (r) => <span className="text-slate-700 dark:text-slate-300">{r.company || '—'}</span>
    },
    {
      key: 'age',
      header: (
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort('age')}>
          <span>سن</span>
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
        </div>
      ),
      width: 60,
      render: (r) => <span className="font-mono text-slate-600 dark:text-slate-300">{r.age || '—'}</span>
    },
    {
      key: 'exam_date',
      header: (
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort('exam_date')}>
          <span>تاریخ معاینه</span>
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
        </div>
      ),
      width: 100,
      render: (r) => <span className="font-mono text-slate-600 dark:text-slate-300">{r.exam_date || '—'}</span>
    },
    {
      key: 'bmi',
      header: (
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort('bmi')}>
          <span>BMI</span>
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
        </div>
      ),
      width: 70,
      render: (r) => <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{r.bmi || '—'}</span>
    },
    {
      key: 'bp',
      header: 'فشار خون',
      width: 90,
      render: (r) => (
        <span className="font-mono text-slate-700 dark:text-slate-300">
          {r.bp_sys || '—'} / {r.bp_dia || '—'}
        </span>
      )
    },
    {
      key: 'final_opinion',
      header: (
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort('final_opinion')}>
          <span>نتیجه نظریه</span>
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
        </div>
      ),
      width: 140,
      render: (r) => renderOpinionBadge(r.final_opinion)
    },
    {
      key: 'followup',
      header: 'نیاز به پیگیری',
      width: 100,
      render: (r) => (
        r.final_followup_needed === 'بله' ? (
          <span className="px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold text-[10px] border border-rose-200 dark:border-rose-900">
            نیازمند پیگیری
          </span>
        ) : (
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium text-[10px]">
            عادی
          </span>
        )
      )
    },
    {
      key: 'action',
      header: 'عملیات',
      width: 80,
      headerClassName: 'text-center',
      className: 'text-center',
      render: (r) => (
        <button
          type="button"
          onClick={() => jumpToPerson(r.personnel_id, r.exam_year)}
          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950 text-teal-700 dark:text-teal-400 font-bold text-[11px] transition-all flex items-center gap-1 mx-auto cursor-pointer"
        >
          <Eye className="w-3 h-3" />
          <span>پرونده</span>
        </button>
      )
    }
  ], [sortConfig, renderOpinionBadge, jumpToPerson]);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Advanced Filter Panel */}
      <AdvancedFilterPanel
        filters={filters}
        onFilterChange={(f) => {
          setFilters(f);
          setExplicitShowAll(false);
        }}
        companies={companies}
        years={years}
        totalRecordsCount={joinedRecords.length}
        filteredRecordsCount={filteredRecords.length}
        isFiltered={isFilterActive || explicitShowAll}
        onShowAll={() => setExplicitShowAll(true)}
        placeholderText="جستجوی سوابق معاینات: نام پرسنل، کد ملی، کد پرسنلی، واحد سازمانی..."
      />

      {/* Main Table or Empty State */}
      {!isFilterActive && !explicitShowAll ? (
        <EmptySearchState
          title="جهت مشاهده سوابق معاینات ادواری، جستجو کنید یا فیلتر را اعمال نمایید"
          description="بر اساس استاندارد محرمانگی اطلاعات سلامت، سوابق معاینات ادواری پس از جستجوی پرسنل یا انتخاب واحد و فیلترهای بالا نمایش داده می‌شوند."
          totalCount={joinedRecords.length}
          onQuickFilter={(key, val) => {
            setFilters({ ...filters, [key]: val });
          }}
          onShowAll={() => setExplicitShowAll(true)}
          icon={<Calendar className="w-9 h-9 sm:w-10 sm:h-10" />}
        />
      ) : (
        <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          {/* Table Header Action Bar */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-850/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                نتایج استخراج‌شده:
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800">
                {filteredRecords.length} رکورد معاینه
              </span>
            </div>

            <button
              onClick={exportFilteredToExcel}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-teal-600 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 hover:bg-teal-100 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>خروجی اکسل ({filteredRecords.length})</span>
            </button>
          </div>

          {/* Records Table with Virtualization */}
          <div className="overflow-hidden">
            <VirtualizedDataTable
              data={filteredRecords}
              columns={examColumns}
              height={520}
              isFa={true}
              emptyMessage="هیچ رکوردی منطبق با فیلترهای جستجو یافت نشد."
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamsTab;
