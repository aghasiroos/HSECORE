import React, { useState } from 'react';
import { X, ShieldAlert, Check, AlertCircle } from 'lucide-react';
import { OccupationalRestrictionItem } from '../../types/personnelDossierTypes';
import { personnelDossierService } from '../../services/personnelDossierService';
import { getComplexPersonnelList } from '../../utils/personnelHelper';

interface PersonnelRestrictionModalProps {
  personnelCode: string;
  personnelName: string;
  isFa: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function PersonnelRestrictionModal({
  personnelCode,
  personnelName,
  isFa,
  onClose,
  onSaved
}: PersonnelRestrictionModalProps) {
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<OccupationalRestrictionItem['category']>('PHYSICAL');
  const [severity, setSeverity] = useState<OccupationalRestrictionItem['severity']>('TEMPORARY');
  const [startDate, setStartDate] = useState<string>(new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [endDate, setEndDate] = useState<string>('');
  const [physicianName, setPhysicianName] = useState<string>('');
  const [medicalCenter, setMedicalCenter] = useState<string>('مرکز بهداشت شغلی و طب کار مجتمع');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const personnelOptions = getComplexPersonnelList();

  const handleSave = () => {
    if (!title.trim()) {
      setErrorMsg(isFa ? 'لطفاً عنوان یا شرح محدودیت را وارد کنید.' : 'Please enter the restriction title.');
      return;
    }

    try {
      personnelDossierService.addRestriction({
        personnelCode,
        title: title.trim(),
        category,
        severity,
        startDate,
        endDate: endDate || undefined,
        physicianName: physicianName.trim() || 'پزشک طب کار',
        medicalCenter: medicalCenter.trim(),
        status: 'ACTIVE',
        notes: notes.trim()
      });

      onSaved();
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'خطا در ثبت محدودیت');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black">
                {isFa ? 'ثبت محدودیت شغلی یا منع کار تخصصی' : 'Add Occupational Restriction'}
              </h3>
              <p className="text-xs text-slate-400">
                {personnelName} (کد: {personnelCode})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh] text-slate-800 dark:text-slate-100">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
              {isFa ? 'عنوان محدودیت شغلی / پزشکی *:' : 'Restriction Title *:'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isFa ? 'مثال: عدم کار در ارتفاع بیش از ۲ متر، ممنوعیت حمل بار سنگین...' : 'e.g. No working at height...'}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                {isFa ? 'دسته‌بندی عامل خطر:' : 'Category:'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="PHYSICAL">فیزیکی و حرکتی</option>
                <option value="CHEMICAL">شیمیایی و تنفسی</option>
                <option value="ERGONOMIC">ارگونومی و اسکلتی-عضلانی</option>
                <option value="SHIFT_WORK">نوبت‌کاری و شیفت شب</option>
                <option value="ENVIRONMENTAL">محیطی (صدا، گرما، ارتفاع)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                {isFa ? 'ماهیت محدودیت:' : 'Nature:'}
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="TEMPORARY">موقت (دارای دوره بازنگری)</option>
                <option value="PERMANENT">دائمی (مادام‌العمر)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                {isFa ? 'تاریخ شروع اعمال:' : 'Start Date:'}
              </label>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="1404/01/01"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                {isFa ? 'تاریخ پایان / بازنگری:' : 'End / Review Date:'}
              </label>
              <input
                type="text"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder={isFa ? 'مثال: 1404/08/10 (خالی برای دائمی)' : '1404/08/10'}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                {isFa ? 'پزشک متخصص صادرکننده:' : 'Physician Name:'}
              </label>
              <input
                type="text"
                list="restriction-physician-list"
                value={physicianName}
                onChange={(e) => setPhysicianName(e.target.value)}
                placeholder={isFa ? 'جستجو یا وارد کردن نام پزشک...' : 'Select or enter physician...'}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <datalist id="restriction-physician-list">
                {personnelOptions.map(p => (
                  <option key={p.id || p.personnelCode} value={p.fullName}>
                    {p.jobTitle ? `${p.jobTitle} (${p.unit || ''})` : p.personnelCode}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                {isFa ? 'مرکز درمانی / طب کار:' : 'Medical Center:'}
              </label>
              <input
                type="text"
                value={medicalCenter}
                onChange={(e) => setMedicalCenter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
              {isFa ? 'علت پزشکی و توصیه‌ها به سرپرست:' : 'Justification & Recommendations:'}
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isFa ? 'شرح شرایط درمانی یا دستورات ارگونومی...' : 'Clinical notes...'}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            {isFa ? 'انصراف' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-rose-600/20"
          >
            <Check className="w-4 h-4" />
            <span>{isFa ? 'ثبت و ابلاغ محدودیت' : 'Save Restriction'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
