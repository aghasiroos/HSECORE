import React, { useState } from 'react';
import {
  FlaskConical,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Download,
  Building2,
  Activity
} from 'lucide-react';
import { CustomizableChart } from '../CustomizableChart';
import { AdvancedFilterPanel, AdvancedFilterState } from '../AdvancedFilterPanel';
import { EmptySearchState } from '../EmptySearchState';
import { LAB_DEFS } from '../seedData';
import { VirtualizedDataTable, VirtualizedColumn } from '../../../../../components/common/virtualized/VirtualizedDataTable';

interface Props {
  joinedRecords: any[];
  filters: AdvancedFilterState;
  setFilters: (f: AdvancedFilterState) => void;
  isFilterActive: boolean;
  matchesAdvancedFilter: (r: any, f: AdvancedFilterState) => boolean;
  prioritySearch: (records: any[], q: string) => any[];
  toNum: (v: any) => number | null;
  avg: (nums: (number | null)[]) => number | null;
  labStatus: (key: string, val: number | null) => any;
  renderStatusBadge: (st: string) => React.ReactNode;
  jumpToPerson: (pid: string, year?: string) => void;
}

export const LabTab: React.FC<Props> = ({
  joinedRecords,
  filters,
  setFilters,
  isFilterActive,
  matchesAdvancedFilter,
  prioritySearch,
  toNum,
  avg,
  labStatus,
  renderStatusBadge,
  jumpToPerson
}) => {
  const [labTest, setLabTest] = useState<string>('chol');
  const [explicitShowAll, setExplicitShowAll] = useState<boolean>(false);

  const companies = React.useMemo(() => {
    return [...new Set(joinedRecords.map(r => r.company).filter(Boolean))].sort();
  }, [joinedRecords]);

  const years = React.useMemo(() => {
    return [...new Set(joinedRecords.map(r => r.exam_year).filter(Boolean))].sort();
  }, [joinedRecords]);

  const def = (LAB_DEFS[labTest] || { label: labTest, unit: '', low: undefined, high: undefined }) as { label: string; unit: string; low?: number; high?: number };

  // Data rows with active test
  const validTestRows = React.useMemo(() => {
    return joinedRecords
      .map(r => ({ r, val: toNum(r[labTest]) }))
      .filter(x => x.val !== null);
  }, [joinedRecords, labTest, toNum]);

  // Filtered rows
  const filteredTestRows = React.useMemo(() => {
    let list = validTestRows.filter(x => matchesAdvancedFilter(x.r, filters));

    if (filters.search && filters.search.trim()) {
      const pSearched = prioritySearch(list.map(x => x.r), filters.search);
      const ids = new Set(pSearched.map(r => r.exam_id));
      list = list.filter(x => ids.has(x.r.exam_id));
    }

    return list;
  }, [validTestRows, filters, matchesAdvancedFilter, prioritySearch]);

  // Chart data: Distribution across companies with average
  const chartData = React.useMemo(() => {
    const byComp: Record<string, number[]> = {};
    validTestRows.forEach(x => {
      const c = x.r.company || 'نامشخص';
      if (!byComp[c]) byComp[c] = [];
      byComp[c].push(x.val!);
    });

    return Object.entries(byComp).map(([label, values]) => {
      const mean = avg(values) || 0;
      return {
        label,
        value: parseFloat(mean.toFixed(1)),
        subLabel: `${values.length} نفر (${def.unit})`
      };
    }).sort((a, b) => b.value - a.value);
  }, [validTestRows, avg, def.unit]);

  const abnCount = React.useMemo(() => {
    return validTestRows.filter(x => labStatus(labTest, x.val) !== 'normal').length;
  }, [validTestRows, labStatus, labTest]);

  const labColumns = React.useMemo<VirtualizedColumn<any>[]>(() => [
    {
      key: 'name',
      header: 'نام و نام‌خانوادگی',
      width: 160,
      render: (x) => (
        <div className="font-bold text-teal-800 dark:text-teal-300">
          <div>{x.r.fname} {x.r.lname}</div>
          <div className="text-[10px] text-slate-400 font-mono font-normal">کدملی: {x.r.nid || '—'}</div>
        </div>
      )
    },
    {
      key: 'company',
      header: 'محل خدمت',
      width: 140,
      render: (x) => <span className="text-slate-700 dark:text-slate-300">{x.r.company || '—'}</span>
    },
    {
      key: 'value',
      header: 'مقدار آزمایش',
      width: 110,
      render: (x) => (
        <span className="font-mono font-black text-slate-900 dark:text-white">
          {x.val} <span className="text-[10px] text-slate-400 font-normal">{def.unit}</span>
        </span>
      )
    },
    {
      key: 'status',
      header: 'وضعیت بالینی',
      width: 120,
      render: (x) => renderStatusBadge(labStatus(labTest, x.val))
    },
    {
      key: 'exam_date',
      header: 'تاریخ معاینه',
      width: 100,
      render: (x) => <span className="font-mono text-slate-500">{x.r.exam_date || '—'}</span>
    },
    {
      key: 'action',
      header: 'پرونده',
      width: 70,
      headerClassName: 'text-center',
      className: 'text-center',
      render: (x) => (
        <button
          type="button"
          onClick={() => jumpToPerson(x.r.personnel_id, x.r.exam_year)}
          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-teal-50 text-teal-700 dark:text-teal-400 font-bold text-[11px] cursor-pointer"
        >
          مشاهده
        </button>
      )
    }
  ], [def.unit, labTest, labStatus, renderStatusBadge, jumpToPerson]);

  const sortedFilteredTestRows = React.useMemo(() => {
    return [...filteredTestRows].sort((a, b) => (b.val || 0) - (a.val || 0));
  }, [filteredTestRows]);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Test Selector Strip */}
      <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
                انتخاب آزمایش پاراکلینیک و بیوشیمی
              </h3>
              <span className="text-[11px] text-slate-400">
                شاخص انتخابی: <b className="text-teal-700 dark:text-teal-400">{def.label}</b> {def.low !== undefined && `(بازه نرمال: ${def.low} تا ${def.high} ${def.unit})`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">انتخاب آزمایش:</span>
            <select
              value={labTest}
              onChange={(e) => setLabTest(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
            >
              {Object.entries(LAB_DEFS)
                .filter(([k]) => !['bp_sys', 'bp_dia', 'bmi'].includes(k))
                .map(([k, d]) => (
                  <option key={k} value={k}>{d.label} ({d.unit})</option>
                ))}
            </select>
          </div>
        </div>

        {/* Quick Test KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850/80 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">کل آزمایش‌های ثبت‌شده</span>
              <span className="text-xl font-black font-mono text-slate-800 dark:text-white">{validTestRows.length} نفر</span>
            </div>
            <Activity className="w-5 h-5 text-teal-600" />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850/80 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">موارد خارج از محدوده نرمال</span>
              <span className="text-xl font-black font-mono text-rose-600">{abnCount} نفر</span>
            </div>
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850/80 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">میانگین کل سازمان</span>
              <span className="text-xl font-black font-mono text-teal-700 dark:text-teal-300">
                {avg(validTestRows.map(x => x.val))?.toFixed(1) || '—'} {def.unit}
              </span>
            </div>
            <TrendingUp className="w-5 h-5 text-teal-600" />
          </div>
        </div>
      </div>

      {/* Customizable Chart with Data Labels On Top */}
      <CustomizableChart
        title={`میانگین ${def.label} به تفکیک محل خدمت`}
        subtitle={`مقایسه میانگین مقادیر آزمایشگاهی با برچسب اعداد بالای هر ستون (${def.unit})`}
        icon={<TrendingUp className="w-4 h-4" />}
        data={chartData}
        unit={def.unit}
        defaultType="bar"
        defaultPalette="teal"
        height={260}
      />

      {/* Advanced Filters */}
      <AdvancedFilterPanel
        filters={filters}
        onFilterChange={(f) => {
          setFilters(f);
          setExplicitShowAll(false);
        }}
        companies={companies}
        years={years}
        totalRecordsCount={validTestRows.length}
        filteredRecordsCount={filteredTestRows.length}
        isFiltered={isFilterActive || explicitShowAll}
        onShowAll={() => setExplicitShowAll(true)}
        placeholderText="جستجوی پرسنل در نتایج آزمایشگاه: نام، کدملی، پرسنلی..."
      />

      {/* Records Table or Empty State */}
      {!isFilterActive && !explicitShowAll ? (
        <EmptySearchState
          title={`جهت مشاهده لیست آزمایش‌های ${def.label}، جستجو یا فیلتر کنید`}
          description="رکوردهای انفرادی آزمایشگاه پس از جستجوی پرسنل یا انتخاب فیلترهای واحد سازمانی و غیرطبیعی بارگذاری می‌شوند."
          totalCount={validTestRows.length}
          onQuickFilter={(key, val) => {
            setFilters({ ...filters, [key]: val });
          }}
          onShowAll={() => setExplicitShowAll(true)}
          icon={<FlaskConical className="w-9 h-9 sm:w-10 sm:h-10" />}
        />
      ) : (
        <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/80 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              نتایج آزمایش {def.label} ({filteredTestRows.length} رکورد)
            </span>
          </div>

          <div className="overflow-hidden">
            <VirtualizedDataTable
              data={sortedFilteredTestRows}
              columns={labColumns}
              height={500}
              isFa={true}
              emptyMessage="هیچ رکوردی منطبق با فیلترهای اعمال‌شده یافت نشد."
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LabTab;
