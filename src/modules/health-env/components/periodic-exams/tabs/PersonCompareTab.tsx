import React, { useState } from 'react';
import {
  UserCheck,
  Search,
  Printer,
  TrendingUp,
  Activity,
  Calendar,
  Eye,
  CheckCircle2,
  X
} from 'lucide-react';
import { CustomizableChart } from '../CustomizableChart';
import { EmptySearchState } from '../EmptySearchState';
import { PersonCompareHealthCardPrintModal } from '../PersonCompareHealthCardPrintModal';

interface Props {
  personnelList: any[];
  personnelMap: Record<string, any>;
  examsFor: (pid: string) => any[];
  pcSelectedId: string | null;
  setPcSelectedId: (id: string | null) => void;
  pcSelectedYears: string[];
  setPcSelectedYears: (years: string[]) => void;
  prioritySearch: (records: any[], q: string) => any[];
  toNum: (v: any) => number | null;
  labStatus: (key: string, val: number | null) => any;
  renderStatusBadge: (st: string) => React.ReactNode;
}

export const PersonCompareTab: React.FC<Props> = ({
  personnelList,
  personnelMap,
  examsFor,
  pcSelectedId,
  setPcSelectedId,
  pcSelectedYears,
  setPcSelectedYears,
  prioritySearch,
  toNum,
  labStatus,
  renderStatusBadge
}) => {
  const [search, setSearch] = useState<string>('');
  const [showHealthCardPrintModal, setShowHealthCardPrintModal] = useState<boolean>(false);

  // Only return personnel matching the active search query - no default list
  const filteredPersonnel = React.useMemo(() => {
    if (!search.trim()) return [];
    return prioritySearch(personnelList, search);
  }, [personnelList, search, prioritySearch]);

  // Clear selected person comparison history immediately when search input is cleared
  React.useEffect(() => {
    if (!search.trim()) {
      setPcSelectedId(null);
    }
  }, [search, setPcSelectedId]);

  const person = pcSelectedId ? personnelMap[pcSelectedId] : null;
  const exams = pcSelectedId ? examsFor(pcSelectedId) : [];
  const selectedExams = exams.filter(e => pcSelectedYears.includes(e.exam_year));

  // Trend chart for selected person (BMI across years) with numbers on top
  const bmiTrendData = React.useMemo(() => {
    if (!exams.length) return [];
    return exams.map(e => ({
      label: `سال ${e.exam_year}`,
      value: toNum(e.bmi) || 0,
      subLabel: `وزن: ${e.weight || '—'} kg`
    }));
  }, [exams, toNum]);

  // Trend chart for Blood Pressure (Systolic)
  const bpTrendData = React.useMemo(() => {
    if (!exams.length) return [];
    return exams.map(e => ({
      label: `سال ${e.exam_year}`,
      value: toNum(e.bp_sys) || 0,
      subLabel: `دیاستولیک: ${e.bp_dia || '—'} mmHg`
    }));
  }, [exams, toNum]);

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Search Sidebar */}
        <div className="lg:col-span-4 bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-0 overflow-hidden shadow-xs">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/80">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="جستجو با کد ملی، پرسنلی یا نام..."
                className="w-full text-xs px-3 py-2 pr-8 pl-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
              />
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-3 text-slate-400" />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {search.trim() && (
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 px-1 font-bold">
                <span>نتایج جستجو:</span>
                <span className="font-mono text-teal-600 dark:text-teal-400">{filteredPersonnel.length} نفر</span>
              </div>
            )}
          </div>

          <div className="max-h-[65vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {!search.trim() ? (
              <div className="p-6 text-center text-xs text-slate-400 leading-relaxed">
                <Search className="w-6 h-6 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                جهت جستجوی پرسنل و مقایسه سنواتی، نام، کد ملی یا شماره پرسنلی را در کادر بالا وارد کنید.
              </div>
            ) : filteredPersonnel.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                پرسنلی با عبارت «{search}» یافت نشد.
              </div>
            ) : (
              filteredPersonnel.map(p => {
                const isSelected = p.personnel_id === pcSelectedId;
                const pExams = examsFor(p.personnel_id);
                return (
                  <div
                    key={p.personnel_id}
                    onClick={() => {
                      setPcSelectedId(p.personnel_id);
                      setPcSelectedYears(pExams.map(e => e.exam_year));
                    }}
                    className={`p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'hover:bg-teal-50/70 dark:hover:bg-teal-950/40 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs">{p.fname} {p.lname}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-teal-800 text-teal-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        {pExams.length} دوره
                      </span>
                    </div>
                    <div className={`text-[11px] mt-1 ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                      {p.company} · کد ملی: <span className="font-mono">{p.nid || '—'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Comparison Container */}
        <div className="lg:col-span-8 space-y-4">
          {!person ? (
            <EmptySearchState
              title="جهت مقایسه سنواتی نتایج معاینات، یک فرد را انتخاب یا جستجو کنید"
              description="از کادر جستجوی سمت راست، پرسنل مورد نظر را انتخاب نمایید تا تاریخچه و روند چندساله شاخص‌های سلامت و آزمایشگاهی او رسم شود."
              totalCount={personnelList.length}
              onQuickFilter={(k, v) => setSearch(v)}
              icon={<UserCheck className="w-9 h-9 sm:w-10 sm:h-10" />}
            />
          ) : (
            <div className="space-y-4">
              {/* Header Box */}
              <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    مقایسه سنواتی شاخص‌های سلامت: {person.fname} {person.lname}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {person.company} · کد ملی: <b className="font-mono">{person.nid || '—'}</b> · کد پرسنلی: <b className="font-mono">{person.pcode || '—'}</b>
                  </p>
                </div>
                <button
                  onClick={() => setShowHealthCardPrintModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>چاپ کارنامه سلامت</span>
                </button>
              </div>

              {/* 2 Visual Trend Charts with Numbers on Top */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CustomizableChart
                  title="روند تغییرات شاخص BMI پرسنل"
                  subtitle="تغییرات سالانه شاخص توده بدنی با برچسب اعداد بالای نمودار"
                  icon={<TrendingUp className="w-4 h-4 text-teal-600" />}
                  data={bmiTrendData}
                  unit="kg/m²"
                  defaultType="bar"
                  defaultPalette="teal"
                  height={220}
                />

                <CustomizableChart
                  title="روند فشار خون سیستولیک (mmHg)"
                  subtitle="پایش نوسانات فشار خون در سال‌های متوالی با اعداد روی ستون"
                  icon={<Activity className="w-4 h-4 text-rose-500" />}
                  data={bpTrendData}
                  unit="mmHg"
                  defaultType="bar"
                  defaultPalette="rose"
                  height={220}
                />
              </div>

              {/* Multi-Year Indicators Comparison Table */}
              <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/80">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    جدول تطبیقی شاخص‌های کلینیکی و پاراکلینیکی در سنوات مختلف
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-[#f0f3f4] dark:bg-slate-800 font-extrabold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3.5">شاخص پزشکی / آزمایشگاهی</th>
                        {selectedExams.map(e => (
                          <th key={e.exam_year} className="p-3.5 text-center font-mono">سال {e.exam_year}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {[
                        ['bmi', 'شاخص توده بدنی (BMI)', 'kg/m²'],
                        ['weight', 'وزن', 'kg'],
                        ['bp_sys', 'فشار خون سیستولیک', 'mmHg'],
                        ['bp_dia', 'فشار خون دیاستولیک', 'mmHg'],
                        ['chol', 'کلسترول تام (CHOL)', 'mg/dL'],
                        ['tg', 'تری‌گلیسیرید (TG)', 'mg/dL'],
                        ['fbs', 'قند ناشتا (FBS)', 'mg/dL'],
                        ['ast', 'آنزیم کبدی AST', 'U/L'],
                        ['alt', 'آنزیم کبدی ALT', 'U/L'],
                        ['hb', 'هموگلوبین (Hb)', 'g/dL'],
                      ].map(([k, label, unit]) => (
                        <tr key={k} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">
                            {label} <span className="text-[10px] text-slate-400 font-normal">({unit})</span>
                          </td>
                          {selectedExams.map(e => {
                            const val = toNum(e[k]);
                            const st = labStatus(k, val);
                            return (
                              <td key={e.exam_year} className="p-3.5 text-center font-mono">
                                {val !== null ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className="font-bold text-slate-900 dark:text-white">{val}</span>
                                    {renderStatusBadge(st)}
                                  </div>
                                ) : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Formal Printable Health Card Modal */}
      {showHealthCardPrintModal && person && (
        <PersonCompareHealthCardPrintModal
          person={person}
          exams={selectedExams.length > 0 ? selectedExams : exams}
          toNum={toNum}
          labStatus={labStatus}
          onClose={() => setShowHealthCardPrintModal(false)}
        />
      )}
    </div>
  );
};

export default PersonCompareTab;
