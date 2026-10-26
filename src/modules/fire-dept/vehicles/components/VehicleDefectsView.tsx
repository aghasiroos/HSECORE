import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, AlertTriangle, CheckCircle2, Clock, Filter, 
  Search, Check, ShieldCheck, ChevronDown, User, Calendar
} from 'lucide-react';
import { FireVehicle, VehicleDefectRecord, DefectSeverity, DefectPriority } from '../types/vehicleTypes';

interface Props {
  language: 'fa' | 'en';
  vehicles: FireVehicle[];
  onSelectVehicle: (vehicle: FireVehicle) => void;
  onUpdateDefect: (vehicleId: string, defectId: string, updates: Partial<VehicleDefectRecord>) => void;
}

export default function VehicleDefectsView({
  language,
  vehicles,
  onSelectVehicle,
  onUpdateDefect
}: Props) {
  const isFa = language === 'fa';

  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected defect for editing CAPA
  const [selectedDefect, setSelectedDefect] = useState<{ defect: VehicleDefectRecord; vehicle: FireVehicle } | null>(null);
  const [capaRootCause, setCapaRootCause] = useState('');
  const [capaImmediateAction, setCapaImmediateAction] = useState('');
  const [capaPlan, setCapaPlan] = useState('');
  const [capaResponsible, setCapaResponsible] = useState('');
  const [capaDueDate, setCapaDueDate] = useState('');
  const [capaHseApproval, setCapaHseApproval] = useState(false);
  const [capaStatus, setCapaStatus] = useState<VehicleDefectRecord['status']>('در حال اقدام');

  // Flatten all defects across fleet
  const allDefects = useMemo(() => {
    const list: { defect: VehicleDefectRecord; vehicle: FireVehicle }[] = [];
    vehicles.forEach(v => {
      v.defects.forEach(d => {
        list.push({ defect: d, vehicle: v });
      });
    });
    return list;
  }, [vehicles]);

  const filteredDefects = useMemo(() => {
    return allDefects.filter(({ defect, vehicle }) => {
      if (severityFilter !== 'all' && defect.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && defect.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchItem = defect.item.toLowerCase().includes(q);
        const matchDesc = defect.description.toLowerCase().includes(q);
        const matchCode = vehicle.code.toLowerCase().includes(q);
        if (!matchItem && !matchDesc && !matchCode) return false;
      }
      return true;
    });
  }, [allDefects, severityFilter, statusFilter, searchQuery]);

  const openCapaModal = (defect: VehicleDefectRecord, vehicle: FireVehicle) => {
    setSelectedDefect({ defect, vehicle });
    setCapaRootCause(defect.correctiveAction?.rootCause || '');
    setCapaImmediateAction(defect.correctiveAction?.immediateAction || '');
    setCapaPlan(defect.correctiveAction?.correctiveActionPlan || '');
    setCapaResponsible(defect.correctiveAction?.responsible || defect.responsiblePerson || '');
    setCapaDueDate(defect.correctiveAction?.dueDate || defect.dueDate || '');
    setCapaHseApproval(!!defect.correctiveAction?.hseApproval);
    setCapaStatus(defect.status);
  };

  const handleSaveCapa = () => {
    if (!selectedDefect) return;
    onUpdateDefect(selectedDefect.vehicle.id, selectedDefect.defect.id, {
      status: capaStatus,
      correctiveAction: {
        rootCause: capaRootCause,
        immediateAction: capaImmediateAction,
        correctiveActionPlan: capaPlan,
        responsible: capaResponsible,
        startDate: selectedDefect.defect.correctiveAction?.startDate || new Date().toLocaleDateString('fa-IR'),
        dueDate: capaDueDate,
        hseApproval: capaHseApproval,
        finalStatus: capaStatus === 'بسته شده' ? 'تکمیل شده و تایید شده' : 'در دست اجرا'
      }
    });
    setSelectedDefect(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-600 text-white rounded-2xl shadow-xs">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">
              {isFa ? 'مرکز پایش مغایرت‌ها، عیب‌یابی و اقدامات اصلاحی ناوگان (CAPA Engine)' : 'Fleet Defect Tracking & CAPA Engine'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isFa ? 'ثبت ریشه‌ای خرابی‌ها، پیگیری مهلت اقدام اصلاحی و صدور تأییدیه HSE' : 'Root Cause Analysis, CAPA Action Plans & HSE Sign-offs'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-xl text-rose-700 dark:text-rose-300 font-bold">
            {allDefects.filter(d => d.defect.severity === 'بحرانی').length} {isFa ? 'مورد بحرانی' : 'Critical'}
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-xl text-amber-700 dark:text-amber-300 font-bold">
            {allDefects.filter(d => d.defect.status === 'باز').length} {isFa ? 'نقص باز' : 'Open'}
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl text-emerald-700 dark:text-emerald-300 font-bold">
            {allDefects.filter(d => d.defect.status === 'بسته شده').length} {isFa ? 'رفع شده' : 'Resolved'}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-[0px] w-full md:min-w-[200px]">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={isFa ? 'جستجو در عنوان نقص، کد خودرو یا شرح خرابی...' : 'Search defects...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl pr-9 pl-3 py-1.5 text-xs font-bold outline-none"
          />
        </div>

        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
          className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
        >
          <option value="all">{isFa ? 'همه سطوح شدت' : 'All Severities'}</option>
          <option value="بحرانی">{isFa ? 'بحرانی (Critical)' : 'Critical'}</option>
          <option value="بالا">{isFa ? 'بالا (High)' : 'High'}</option>
          <option value="متوسط">{isFa ? 'متوسط (Medium)' : 'Medium'}</option>
          <option value="جزئی">{isFa ? 'جزئی (Low)' : 'Low'}</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
        >
          <option value="all">{isFa ? 'همه وضعیت‌ها' : 'All Statuses'}</option>
          <option value="باز">{isFa ? 'باز' : 'Open'}</option>
          <option value="در حال اقدام">{isFa ? 'در حال اقدام' : 'In Progress'}</option>
          <option value="بسته شده">{isFa ? 'بسته شده' : 'Closed'}</option>
        </select>
      </div>

      {/* Defects List */}
      {filteredDefects.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-700 text-slate-400 text-xs">
          {isFa ? 'هیچ موردی با فیلترهای جاری یافت نشد.' : 'No matching defects found.'}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredDefects.map(({ defect, vehicle }) => (
            <div
              key={defect.id}
              className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border transition-all space-y-3 ${
                defect.severity === 'بحرانی' ? 'border-rose-300 dark:border-rose-800' :
                defect.status === 'بسته شده' ? 'border-emerald-200 dark:border-emerald-900/60' :
                'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-lg bg-red-600 text-white font-mono font-black text-xs">
                    {vehicle.code}
                  </span>
                  <span className="font-mono text-xs text-slate-500 font-bold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                    {defect.id}
                  </span>
                  <h3 className="font-black text-xs text-slate-900 dark:text-white">
                    {defect.item}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    defect.severity === 'بحرانی' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' :
                    defect.severity === 'بالا' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {isFa ? `شدت: ${defect.severity}` : defect.severity}
                  </span>
                  <span className="text-[10px] text-slate-400">({defect.category})</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    defect.status === 'بسته شده' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                    defect.status === 'در حال اقدام' ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' :
                    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {defect.status}
                  </span>
                  <button
                    onClick={() => openCapaModal(defect, vehicle)}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    {isFa ? 'اقدام اصلاحی و CAPA' : 'Manage CAPA'}
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-300">
                {defect.description}
              </p>

              {/* CAPA Plan Preview */}
              {defect.correctiveAction ? (
                <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-200 font-bold">
                    <span>{isFa ? 'خلاصه طرح اقدام اصلاحی ثبت‌شده:' : 'CAPA Plan Summary:'}</span>
                    {defect.correctiveAction.hseApproval ? (
                      <span className="text-emerald-600 text-[11px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isFa ? 'تأییدیه نهایی HSE صادر شده' : 'HSE Approved'}
                      </span>
                    ) : (
                      <span className="text-amber-600 text-[11px] font-bold">
                        {isFa ? 'در انتظار تأیید بازرس ایمنی' : 'Pending HSE Approval'}
                      </span>
                    )}
                  </div>
                  {defect.correctiveAction.rootCause && (
                    <div className="text-[11px]">
                      <span className="text-slate-400 font-bold">{isFa ? 'علت ریشه‌ای:' : 'Root Cause:'} </span>
                      <span className="text-slate-600 dark:text-slate-300">{defect.correctiveAction.rootCause}</span>
                    </div>
                  )}
                  {defect.correctiveAction.correctiveActionPlan && (
                    <div className="text-[11px]">
                      <span className="text-slate-400 font-bold">{isFa ? 'برنامه اقدام:' : 'Action Plan:'} </span>
                      <span className="text-slate-600 dark:text-slate-300">{defect.correctiveAction.correctiveActionPlan}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">
                  {isFa ? 'اقدام اصلاحی هنوز تعریف نشده است. جهت ثبت، روی «اقدام اصلاحی و CAPA» کلیک کنید.' : 'No CAPA plan defined yet.'}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700">
                <span>{isFa ? 'خودرو:' : 'Vehicle:'} {vehicle.brandModel} ({vehicle.fireStation})</span>
                <span>{isFa ? 'تاریخ ثبت:' : 'Created:'} {defect.createdDate}</span>
                <span>{isFa ? 'مهلت اقدام:' : 'Due:'} {defect.dueDate}</span>
                <span>{isFa ? 'مسئول پیگیری:' : 'Assignee:'} {defect.responsiblePerson}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: CAPA Action Form */}
      {selectedDefect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-2xl overflow-hidden animate-scaleIn">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <span>{isFa ? `ثبت و اصلاح CAPA برای خودرو ${selectedDefect.vehicle.code}` : 'CAPA Form'}</span>
              </h3>
              <button onClick={() => setSelectedDefect(null)} className="p-1.5 text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-slate-400 font-bold block">{isFa ? 'شرح نقص:' : 'Defect:'}</span>
                <p className="text-slate-800 dark:text-slate-200 font-bold mt-0.5">{selectedDefect.defect.description}</p>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'تحلیل علت ریشه‌ای (Root Cause Analysis):' : 'Root Cause:'}
                </label>
                <textarea
                  rows={2}
                  value={capaRootCause}
                  onChange={e => setCapaRootCause(e.target.value)}
                  placeholder={isFa ? 'علت وقوع نقص...' : 'Root cause...'}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'اقدام فوری (Immediate Action):' : 'Immediate Action:'}
                </label>
                <input
                  type="text"
                  value={capaImmediateAction}
                  onChange={e => setCapaImmediateAction(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'برنامه اقدام اصلاحی ریشه‌ای (CAPA Plan):' : 'Action Plan:'}
                </label>
                <textarea
                  rows={2}
                  value={capaPlan}
                  onChange={e => setCapaPlan(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">{isFa ? 'مسئول پیگیری:' : 'Responsible:'}</label>
                  <input
                    type="text"
                    value={capaResponsible}
                    onChange={e => setCapaResponsible(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">{isFa ? 'مهلت اقدام:' : 'Due Date:'}</label>
                  <input
                    type="text"
                    value={capaDueDate}
                    onChange={e => setCapaDueDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={capaHseApproval}
                    onChange={e => setCapaHseApproval(e.target.checked)}
                    className="w-4 h-4 rounded text-red-600"
                  />
                  <span>{isFa ? 'تأییدیه نهایی واحد ایمنی و آتش‌نشانی (HSE Sign-off)' : 'HSE Approved'}</span>
                </label>

                <select
                  value={capaStatus}
                  onChange={e => setCapaStatus(e.target.value as any)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-1.5 font-bold outline-none text-xs"
                >
                  <option value="باز">{isFa ? 'وضعیت: باز' : 'Open'}</option>
                  <option value="در حال اقدام">{isFa ? 'وضعیت: در حال اقدام' : 'In Progress'}</option>
                  <option value="بسته شده">{isFa ? 'وضعیت: بسته شده' : 'Closed'}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setSelectedDefect(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl font-bold"
                >
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveCapa}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {isFa ? 'ذخیره و به‌روزرسانی' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
