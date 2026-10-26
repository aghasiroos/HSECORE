import React, { useState } from 'react';
import {
  UserCheck,
  Search,
  Building2,
  Calendar,
  AlertTriangle,
  Heart,
  Scale,
  Activity,
  FileText,
  Printer,
  ChevronLeft,
  Paperclip,
  Stethoscope
} from 'lucide-react';
import { AdvancedFilterPanel, AdvancedFilterState } from '../AdvancedFilterPanel';
import { EmptySearchState } from '../EmptySearchState';
import { LAB_DEFS } from '../seedData';
import { DossierAttachmentManager } from '../DossierAttachmentManager';
import { PersonnelDossierPrintModal } from '../PersonnelDossierPrintModal';

interface Props {
  personnelMap: Record<string, any>;
  personnelList: any[];
  examinations: any[];
  joinedRecords: any[];
  selectedPersonId: string | null;
  selectedPersonYear: string;
  setSelectedPersonId: (id: string | null) => void;
  setSelectedPersonYear: (year: string) => void;
  filters: AdvancedFilterState;
  setFilters: (f: AdvancedFilterState) => void;
  isFilterActive: boolean;
  prioritySearch: (records: any[], q: string) => any[];
  matchesAdvancedFilter: (rec: any, f: AdvancedFilterState) => boolean;
  examsFor: (pid: string) => any[];
  toNum: (v: any) => number | null;
  splitMulti: (v: any) => string[];
  labStatus: (key: string, val: number | null) => any;
  renderStatusBadge: (st: string) => React.ReactNode;
  renderOpinionBadge: (op: string) => React.ReactNode;
}

export const PersonnelDossierTab: React.FC<Props> = ({
  personnelMap,
  personnelList,
  examinations,
  joinedRecords,
  selectedPersonId,
  selectedPersonYear,
  setSelectedPersonId,
  setSelectedPersonYear,
  filters,
  setFilters,
  isFilterActive,
  prioritySearch,
  matchesAdvancedFilter,
  examsFor,
  toNum,
  splitMulti,
  labStatus,
  renderStatusBadge,
  renderOpinionBadge
}) => {
  const [explicitShowAll, setExplicitShowAll] = React.useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  const [dossierViewMode, setDossierViewMode] = useState<'both' | 'clinical' | 'attachments'>('both');

  const companies = React.useMemo(() => {
    return [...new Set(personnelList.map(p => p.company).filter(Boolean))].sort();
  }, [personnelList]);

  const years = React.useMemo(() => {
    return [...new Set(examinations.map(e => e.exam_year).filter(Boolean))].sort();
  }, [examinations]);

  // Filtered personnel list - ONLY when filter/search is active or explicitly requested
  const filteredPersonnel = React.useMemo(() => {
    if (!isFilterActive && !explicitShowAll) {
      return [];
    }

    let list = personnelList.filter(p => {
      // Find latest exam or matching exam
      const exams = examinations.filter(e => e.personnel_id === p.personnel_id);
      const combined = { ...p, ...(exams[exams.length - 1] || {}) };
      return matchesAdvancedFilter(combined, filters);
    });

    if (filters.search && filters.search.trim()) {
      list = prioritySearch(list, filters.search);
    }

    return list;
  }, [personnelList, examinations, isFilterActive, explicitShowAll, filters, matchesAdvancedFilter, prioritySearch]);

  const hasVisibleList = isFilterActive || explicitShowAll;

  // Clear selected person dossier immediately when search/filters are cleared
  React.useEffect(() => {
    if (!hasVisibleList) {
      setSelectedPersonId(null);
    }
  }, [hasVisibleList, setSelectedPersonId]);

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
        totalRecordsCount={personnelList.length}
        filteredRecordsCount={filteredPersonnel.length}
        isFiltered={isFilterActive || explicitShowAll}
        onShowAll={() => setExplicitShowAll(true)}
        placeholderText="جستجوی پرونده: کدملی (اولویت ۱) ← کد پرسنلی (اولویت ۲) ← نام پرسنل (اولویت ۳)..."
      />

      {/* Main Container */}
      {!hasVisibleList ? (
        <EmptySearchState
          title="جهت مشاهده پرونده سلامت پرسنل، لطفاً جستجو یا فیلتر کنید"
          description="برای دسترسی به سوابق پزشکی، نام، کد ملی یا کد پرسنلی فرد مورد نظر را در کادر بالا وارد نمایید یا واحد سازمانی و شرایط نظریه را فیلتر کنید."
          totalCount={personnelList.length}
          onQuickFilter={(key, val) => {
            setFilters({ ...filters, [key]: val });
          }}
          onShowAll={() => setExplicitShowAll(true)}
          icon={<UserCheck className="w-9 h-9 sm:w-10 sm:h-10" />}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left List */}
          <div className="lg:col-span-4 bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-0 overflow-hidden shadow-xs">
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/80 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                <span>فهرست پرسنل منطبق</span>
              </span>
              <span className="text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200">
                {filteredPersonnel.length} نفر
              </span>
            </div>

            <div className="max-h-[68vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPersonnel.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  هیچ پرسنلی با مشخصات جستجو یا فیلتر فعلی یافت نشد.
                </div>
              ) : (
                filteredPersonnel.map(r => {
                  const isSelected = r.personnel_id === selectedPersonId;
                  return (
                    <div
                      key={r.personnel_id}
                      onClick={() => {
                        setSelectedPersonId(r.personnel_id);
                        setSelectedPersonYear('all');
                      }}
                      className={`p-3.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'hover:bg-teal-50/70 dark:hover:bg-teal-950/40 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs">{r.fname} {r.lname}</span>
                        {r.gender && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-teal-800 text-teal-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                            {r.gender}
                          </span>
                        )}
                      </div>
                      <div className={`text-[11px] mt-1 flex flex-wrap gap-x-2 ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                        <span>🏢 {r.company || '—'}</span>
                        <span>کدملی: <span className="font-mono">{r.nid || '—'}</span></span>
                        {r.pcode && <span>پرسنلی: <span className="font-mono">{r.pcode}</span></span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Dossier View */}
          <div className="lg:col-span-8 space-y-4">
            {selectedPersonId ? (
              (() => {
                const person = personnelMap[selectedPersonId];
                if (!person) {
                  return (
                    <div className="bg-white dark:bg-[#17222c] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
                      اطلاعات پرسنل در پایگاه داده یافت نشد.
                    </div>
                  );
                }

                const exams = examsFor(selectedPersonId);
                const yearsList = exams.map(e => e.exam_year);
                const activeExam = selectedPersonYear === 'all'
                  ? exams[exams.length - 1]
                  : exams.find(e => e.exam_year === selectedPersonYear) || exams[exams.length - 1];
                const activeFull = activeExam ? { ...person, ...activeExam } : person;

                const hazards = ['haz_phys', 'haz_chem', 'haz_bio', 'haz_ergo', 'haz_psych', 'haz_other'].flatMap(f => splitMulti(activeFull[f]));
                const diseases = [
                  ['بیماری غیرشغلی جدید', splitMulti(activeFull.dis_nonocc_new)],
                  ['بیماری غیرشغلی شناخته‌شده', splitMulti(activeFull.dis_nonocc_known)],
                  ['بیماری شغلی جدید', splitMulti(activeFull.dis_occ_new)],
                  ['بیماری شغلی شناخته‌شده', splitMulti(activeFull.dis_occ_known)],
                ].filter(([_, v]) => v.length > 0);

                return (
                  <div className="space-y-4">
                    {/* Year Selection Pills & View Mode Bar */}
                    <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 space-y-3 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-x-auto">
                          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">دوره معاینه:</span>
                          <button
                            onClick={() => setSelectedPersonYear('all')}
                            className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                              selectedPersonYear === 'all'
                                ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            همه دوره‌ها
                          </button>
                          {yearsList.map(y => (
                            <button
                              key={y}
                              onClick={() => setSelectedPersonYear(y)}
                              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                                selectedPersonYear === y
                                  ? 'bg-teal-600 text-white shadow-xs'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                              }`}
                            >
                              سال {y}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
                            <button
                              type="button"
                              onClick={() => setDossierViewMode('both')}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                                dossierViewMode === 'both'
                                  ? 'bg-white dark:bg-[#17222c] text-teal-700 dark:text-teal-300 shadow-xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                              }`}
                            >
                              نمایش یکپارچه
                            </button>
                            <button
                              type="button"
                              onClick={() => setDossierViewMode('clinical')}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer ${
                                dossierViewMode === 'clinical'
                                  ? 'bg-white dark:bg-[#17222c] text-teal-700 dark:text-teal-300 shadow-xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                              }`}
                            >
                              <Stethoscope className="w-3 h-3" />
                              <span>نتایج بالینی</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDossierViewMode('attachments')}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer ${
                                dossierViewMode === 'attachments'
                                  ? 'bg-white dark:bg-[#17222c] text-teal-700 dark:text-teal-300 shadow-xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                              }`}
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>پیوست اسناد</span>
                            </button>
                          </div>

                          <button
                            onClick={() => setShowPrintModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>چاپ پرونده</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Main Dossier Content */}
                    {(dossierViewMode === 'both' || dossierViewMode === 'clinical') && (
                    <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
                      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{activeFull.fname} {activeFull.lname}</span>
                            <span className="text-xs font-normal text-slate-400 font-mono">({activeFull.personnel_id})</span>
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-3">
                            <span>🏢 {activeFull.company || '—'}</span>
                            <span>{activeFull.gender || ''}</span>
                            <span>{activeFull.age ? `${activeFull.age} ساله` : ''}</span>
                            <span>{activeFull.marital || ''}</span>
                            <span>کد ملی: <b className="font-mono">{activeFull.nid || '—'}</b></span>
                            {activeFull.pcode && <span>کد پرسنلی: <b className="font-mono">{activeFull.pcode}</b></span>}
                          </p>
                        </div>
                        <div>
                          {renderOpinionBadge(activeFull.final_opinion)}
                        </div>
                      </div>

                      {/* Hazards */}
                      <div>
                        <h4 className="text-xs font-extrabold text-teal-800 dark:text-teal-400 mb-2 border-b border-teal-100 dark:border-teal-950 pb-1 flex items-center gap-1.5">
                          <span>⚠️ عوامل زیان‌آور محیط کار</span>
                        </h4>
                        {hazards.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {hazards.map(h => (
                              <span key={h} className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60 text-xs font-bold">
                                {h}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">مواجهه با عوامل زیان‌آور ثبت نشده است.</span>
                        )}
                      </div>

                      {/* Vitals */}
                      <div>
                        <h4 className="text-xs font-extrabold text-teal-800 dark:text-teal-400 mb-2 border-b border-teal-100 dark:border-teal-950 pb-1 flex items-center gap-1.5">
                          <span>🩺 علائم حیاتی و بیومتریک ({activeFull.exam_date || '—'})</span>
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {activeFull.weight && (
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                              <span className="text-[10px] text-slate-400 block font-bold">وزن</span>
                              <span className="font-bold text-slate-800 dark:text-white font-mono text-sm">{activeFull.weight} kg</span>
                            </div>
                          )}
                          {activeFull.height && (
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                              <span className="text-[10px] text-slate-400 block font-bold">قد</span>
                              <span className="font-bold text-slate-800 dark:text-white font-mono text-sm">{activeFull.height} cm</span>
                            </div>
                          )}
                          {activeFull.bmi && (
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                              <span className="text-[10px] text-slate-400 block font-bold">BMI</span>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className="font-bold text-slate-800 dark:text-white font-mono text-sm">{activeFull.bmi}</span>
                                {renderStatusBadge(labStatus('bmi', toNum(activeFull.bmi)))}
                              </div>
                            </div>
                          )}
                          {(activeFull.bp_sys || activeFull.bp_dia) && (
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                              <span className="text-[10px] text-slate-400 block font-bold">فشار خون</span>
                              <span className="font-bold text-slate-800 dark:text-white font-mono text-sm">{activeFull.bp_sys || '—'} / {activeFull.bp_dia || '—'}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Paraclinical & Labs */}
                      <div>
                        <h4 className="text-xs font-extrabold text-teal-800 dark:text-teal-400 mb-2 border-b border-teal-100 dark:border-teal-950 pb-1 flex items-center gap-1.5">
                          <span>🧪 آزمایش‌های پاراکلینیک و خون</span>
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {['chol', 'tg', 'hdl', 'ldl', 'fbs', 'hba1c', 'bun', 'creat', 'ast', 'alt', 'hb', 'hct', 'plt', 'wbc'].map(key => {
                            const val = toNum(activeFull[key]);
                            if (val === null) return null;
                            const def = LAB_DEFS[key];
                            const st = labStatus(key, val);
                            return (
                              <div key={key} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                <span className="text-[10px] text-slate-400 block truncate font-bold">{def.label}</span>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="font-mono font-bold text-slate-800 dark:text-white">{val} <span className="text-[9px] text-slate-400 font-normal">{def.unit}</span></span>
                                  {renderStatusBadge(st)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Specialized Tests */}
                      <div>
                        <h4 className="text-xs font-extrabold text-teal-800 dark:text-teal-400 mb-2 border-b border-teal-100 dark:border-teal-950 pb-1 flex items-center gap-1.5">
                          <span>👁️ بینایی / 👂 شنوایی / 🌬️ اسپیرومتری / ❤️ نوار قلب</span>
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                          {activeFull.vis_both_cor && (
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                              <span className="text-[10px] text-slate-400 block">دید با اصلاح</span>
                              <span className="font-bold">{activeFull.vis_both_cor}</span>
                            </div>
                          )}
                          {activeFull.audio_r && (
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                              <span className="text-[10px] text-slate-400 block">شنوایی راست</span>
                              <span className="font-bold">{activeFull.audio_r}</span>
                            </div>
                          )}
                          {activeFull.audio_l && (
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                              <span className="text-[10px] text-slate-400 block">شنوایی چپ</span>
                              <span className="font-bold">{activeFull.audio_l}</span>
                            </div>
                          )}
                          {activeFull.spiro_result && (
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                              <span className="text-[10px] text-slate-400 block">اسپیرومتری</span>
                              <span className="font-bold">{activeFull.spiro_result}</span>
                            </div>
                          )}
                          {activeFull.ecg && (
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                              <span className="text-[10px] text-slate-400 block">ECG</span>
                              <span className="font-bold">{activeFull.ecg}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Doctor Advices */}
                      {activeFull.final_advice && (
                        <div className="p-3.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-xs leading-relaxed">
                          <span className="font-bold text-teal-800 dark:text-teal-300 block mb-1">توصیه‌های پزشک طب کار:</span>
                          <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line">{activeFull.final_advice.replace(/\|/g, '\n')}</p>
                        </div>
                      )}
                    </div>
                    )}

                    {/* Dedicated Medical Attachments Section */}
                    {(dossierViewMode === 'both' || dossierViewMode === 'attachments') && (
                      <div className="bg-white dark:bg-[#17222c] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
                        <DossierAttachmentManager
                          personnelId={selectedPersonId}
                          personnelName={`${person.fname || ''} ${person.lname || ''}`.trim() || selectedPersonId}
                          nationalCode={person.nid}
                          personnelCode={person.pcode}
                          activeExamYear={selectedPersonYear}
                          availableYears={yearsList.length > 0 ? yearsList : years}
                        />
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="bg-white dark:bg-[#17222c] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-xs">یک نفر را از لیست سمت راست انتخاب کنید تا پرونده جامع او نمایش داده شود.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Formal Printable Dossier Modal */}
      {showPrintModal && selectedPersonId && personnelMap[selectedPersonId] && (
        <PersonnelDossierPrintModal
          person={personnelMap[selectedPersonId]}
          activeExam={(() => {
            const pExams = examsFor(selectedPersonId);
            return selectedPersonYear === 'all'
              ? (pExams[pExams.length - 1] || {})
              : (pExams.find(e => e.exam_year === selectedPersonYear) || pExams[pExams.length - 1] || {});
          })()}
          allExamsForPerson={examsFor(selectedPersonId)}
          selectedYear={selectedPersonYear}
          toNum={toNum}
          splitMulti={splitMulti}
          labStatus={labStatus}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};

export default PersonnelDossierTab;
