import React, { useState } from 'react';
import {
  FileSpreadsheet,
  AlertTriangle,
  Stethoscope,
  Share2,
  CalendarClock,
  Search,
  Download,
  Eye,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';
import { CustomizableChart } from '../CustomizableChart';
import { AdvancedFilterPanel, AdvancedFilterState } from '../AdvancedFilterPanel';
import { EmptySearchState } from '../EmptySearchState';

interface Props {
  joinedRecords: any[];
  filters: AdvancedFilterState;
  setFilters: (f: AdvancedFilterState) => void;
  isFilterActive: boolean;
  matchesAdvancedFilter: (r: any, f: AdvancedFilterState) => boolean;
  prioritySearch: (records: any[], q: string) => any[];
  toNum: (v: any) => number | null;
  jumpToPerson: (pid: string, year?: string) => void;
}

export const SmartReportsTab: React.FC<Props> = ({
  joinedRecords,
  filters,
  setFilters,
  isFilterActive,
  matchesAdvancedFilter,
  prioritySearch,
  toNum,
  jumpToPerson
}) => {
  const [currentReport, setCurrentReport] = useState<'risk' | 'dx' | 'referral' | 'followup'>('risk');
  const [explicitShowAll, setExplicitShowAll] = useState<boolean>(false);

  const companies = React.useMemo(() => {
    return [...new Set(joinedRecords.map(r => r.company).filter(Boolean))].sort();
  }, [joinedRecords]);

  const years = React.useMemo(() => {
    return [...new Set(joinedRecords.map(r => r.exam_year).filter(Boolean))].sort();
  }, [joinedRecords]);

  // Risk calculation
  const riskList = React.useMemo(() => {
    return joinedRecords
      .map(r => {
        const flags: string[] = [];
        const b = toNum(r.bmi);
        if (b !== null && b >= 30) flags.push('چاقی (BMI≥۳۰)');
        const sys = toNum(r.bp_sys), dia = toNum(r.bp_dia);
        if ((sys !== null && sys >= 140) || (dia !== null && dia >= 90)) flags.push('فشار خون بالا');
        const f = toNum(r.fbs);
        if (f !== null && f >= 126) flags.push('قند بالا (دیابت)');
        if ((r.audio_r && r.audio_r !== 'Normal') || (r.audio_l && r.audio_l !== 'Normal')) flags.push('کاهش شنوایی');
        if (r.final_opinion && r.final_opinion !== 'بلامانع') flags.push(`نظریه: ${r.final_opinion}`);
        return { r, flags };
      })
      .filter(x => x.flags.length > 0);
  }, [joinedRecords, toNum]);

  // Filtered risk list
  const filteredRiskList = React.useMemo(() => {
    let list = riskList.filter(x => matchesAdvancedFilter(x.r, filters));
    if (filters.search && filters.search.trim()) {
      const pSearched = prioritySearch(list.map(x => x.r), filters.search);
      const ids = new Set(pSearched.map(r => r.exam_id));
      list = list.filter(x => ids.has(x.r.exam_id));
    }
    return list;
  }, [riskList, filters, matchesAdvancedFilter, prioritySearch]);

  // Risk chart data with numbers on top
  const riskChartData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    riskList.forEach(x => {
      x.flags.forEach(fl => {
        counts[fl] = (counts[fl] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, subLabel: `${value} نفر` }));
  }, [riskList]);

  // Referrals
  const referralList = React.useMemo(() => {
    return joinedRecords.flatMap(r => {
      return [1, 2, 3, 4]
        .map(i => ({ r, type: r[`ref${i}_type`], status: r[`ref${i}_status`] }))
        .filter(x => x.type);
    });
  }, [joinedRecords]);

  // Follow-up list
  const followupList = React.useMemo(() => {
    return joinedRecords.filter(r => r.final_followup_needed === 'بله');
  }, [joinedRecords]);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Sub-report selector tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentReport('risk')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              currentReport === 'risk'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#17222c] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>شناسایی افراد پرخطر ({riskList.length})</span>
          </button>

          <button
            onClick={() => setCurrentReport('referral')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              currentReport === 'referral'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#17222c] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>ارجاعات تخصصی ({referralList.length})</span>
          </button>

          <button
            onClick={() => setCurrentReport('followup')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              currentReport === 'followup'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#17222c] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>نیازمند پیگیری درمانی ({followupList.length})</span>
          </button>
        </div>
      </div>

      {/* Report 1: Risk Assessment */}
      {currentReport === 'risk' && (
        <div className="space-y-4">
          <CustomizableChart
            title="فراوانی شاخص‌های خطر سلامت در میان پرسنل"
            subtitle="تعداد کارکنان دارای هر ریسک با مقادیر مشخص روی نمودار"
            icon={<AlertTriangle className="w-4 h-4 text-rose-500" />}
            data={riskChartData}
            unit="نفر"
            defaultType="hbar"
            defaultPalette="rose"
            height={260}
          />

          <AdvancedFilterPanel
            filters={filters}
            onFilterChange={(f) => {
              setFilters(f);
              setExplicitShowAll(false);
            }}
            companies={companies}
            years={years}
            totalRecordsCount={riskList.length}
            filteredRecordsCount={filteredRiskList.length}
            isFiltered={isFilterActive || explicitShowAll}
            onShowAll={() => setExplicitShowAll(true)}
            placeholderText="جستجو در افراد پرخطر: نام، کدملی، واحد سازمانی..."
          />

          {!isFilterActive && !explicitShowAll ? (
            <EmptySearchState
              title="جهت مشاهده لیست تفکیکی افراد پرخطر، جستجو یا فیلتر نمایید"
              description="برای دسترسی به اطلاعات انفرادی پرسنل دارای ریسک‌های سلامت، واحد سازمانی یا نام فرد را جستجو فرمایید."
              totalCount={riskList.length}
              onQuickFilter={(key, val) => {
                setFilters({ ...filters, [key]: val });
              }}
              onShowAll={() => setExplicitShowAll(true)}
              icon={<AlertTriangle className="w-9 h-9 sm:w-10 sm:h-10 text-rose-500" />}
            />
          ) : (
            <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-[#f0f3f4] dark:bg-slate-800 font-extrabold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3.5">نام و نام‌خانوادگی</th>
                      <th className="p-3.5">محل خدمت</th>
                      <th className="p-3.5">عوامل خطر شناسایی‌شده</th>
                      <th className="p-3.5 text-center">پرونده</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRiskList.map(x => (
                      <tr key={x.r.exam_id} className="hover:bg-rose-50/30 dark:hover:bg-slate-800/60 transition-colors">
                        <td className="p-3.5 font-bold text-teal-800 dark:text-teal-300">
                          <div>{x.r.fname} {x.r.lname}</div>
                          <div className="text-[10px] text-slate-400 font-mono font-normal">کدملی: {x.r.nid || '—'}</div>
                        </td>
                        <td className="p-3.5 text-slate-700 dark:text-slate-300">{x.r.company}</td>
                        <td className="p-3.5">
                          <div className="flex flex-wrap gap-1">
                            {x.flags.map(fl => (
                              <span key={fl} className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-[10px] font-bold border border-rose-200 dark:border-rose-900">
                                {fl}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => jumpToPerson(x.r.personnel_id, x.r.exam_year)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-teal-50 text-teal-700 dark:text-teal-400 font-bold text-[11px]"
                          >
                            مشاهده
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Report 2: Referrals */}
      {currentReport === 'referral' && (
        <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/80">
            <h3 className="text-xs font-black text-slate-800 dark:text-white">
              🔁 لیست ارجاعات تخصصی پرسنل به پزشکان متخصص ({referralList.length} ارجاع)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-[#f0f3f4] dark:bg-slate-800 font-extrabold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3.5">نام و نام‌خانوادگی</th>
                  <th className="p-3.5">محل خدمت</th>
                  <th className="p-3.5">تخصص ارجاعی</th>
                  <th className="p-3.5">وضعیت پیگیری</th>
                  <th className="p-3.5 text-center">پرونده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {referralList.map((x, i) => (
                  <tr key={`${x.r.exam_id}_${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="p-3.5 font-bold text-teal-800 dark:text-teal-300">{x.r.fname} {x.r.lname}</td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">{x.r.company}</td>
                    <td className="p-3.5 font-bold text-slate-800 dark:text-white">{x.type}</td>
                    <td className="p-3.5">
                      {x.status === 'تکمیل شده' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">تکمیل شده</span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200">{x.status || 'در انتظار'}</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => jumpToPerson(x.r.personnel_id, x.r.exam_year)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-teal-50 text-teal-700 dark:text-teal-400 font-bold text-[11px]"
                      >
                        مشاهده
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 3: Follow-up */}
      {currentReport === 'followup' && (
        <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/80">
            <h3 className="text-xs font-black text-slate-800 dark:text-white">
              📌 پرسنل نیازمند پیگیری درمانی و بازآزمایی ({followupList.length} نفر)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-[#f0f3f4] dark:bg-slate-800 font-extrabold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3.5">نام و نام‌خانوادگی</th>
                  <th className="p-3.5">محل خدمت</th>
                  <th className="p-3.5">علت پیگیری</th>
                  <th className="p-3.5">تاریخ پیگیری</th>
                  <th className="p-3.5 text-center">پرونده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {followupList.map(r => (
                  <tr key={r.exam_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="p-3.5 font-bold text-teal-800 dark:text-teal-300">{r.fname} {r.lname}</td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">{r.company}</td>
                    <td className="p-3.5 text-slate-800 dark:text-white">{r.final_followup_reason || '—'}</td>
                    <td className="p-3.5 font-mono text-slate-500">{r.final_followup_date || '—'}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartReportsTab;
