import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Clock, 
  Users, 
  AlertTriangle, 
  FileText, 
  CheckCircle2, 
  Calculator, 
  TrendingUp, 
  ShieldAlert, 
  Info,
  Building2,
  Calendar
} from 'lucide-react';
import { TrirRecord } from '../../types';
import { PERSIAN_MONTHS } from './trirExcelService';

interface TrirRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: Omit<TrirRecord, 'id'>, editId?: string) => void;
  editingRecord?: TrirRecord | null;
  existingRecords: TrirRecord[];
  trirTarget: number;
  isFa: boolean;
}

export default function TrirRecordModal({
  isOpen,
  onClose,
  onSave,
  editingRecord,
  existingRecords,
  trirTarget,
  isFa
}: TrirRecordModalProps) {
  const currentJalaliYear = 1404;

  const [year, setYear] = useState<number>(currentJalaliYear);
  const [month, setMonth] = useState<string>(PERSIAN_MONTHS[0]);
  const [attendance, setAttendance] = useState<string>('');
  const [mission, setMission] = useState<string>('0');
  const [contractor, setContractor] = useState<string>('');
  const [incidents, setIncidents] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Populate form on edit
  useEffect(() => {
    if (editingRecord) {
      setYear(editingRecord.year);
      setMonth(editingRecord.month);
      setAttendance(String(editingRecord.attendance || 0));
      setMission(String(editingRecord.mission || 0));
      setContractor(String(editingRecord.contractor || 0));
      setIncidents(String(editingRecord.incidents || 0));
      setNotes(editingRecord.notes || '');
      setError('');
    } else {
      // Find latest unrecorded month
      const lastRec = existingRecords[existingRecords.length - 1];
      if (lastRec) {
        const lastMonthIdx = PERSIAN_MONTHS.indexOf(lastRec.month);
        if (lastMonthIdx !== -1 && lastMonthIdx < 11) {
          setMonth(PERSIAN_MONTHS[lastMonthIdx + 1]);
          setYear(lastRec.year);
        } else if (lastMonthIdx === 11) {
          setMonth(PERSIAN_MONTHS[0]);
          setYear(lastRec.year + 1);
        } else {
          setMonth(PERSIAN_MONTHS[0]);
          setYear(currentJalaliYear);
        }
      } else {
        setMonth(PERSIAN_MONTHS[0]);
        setYear(currentJalaliYear);
      }
      setAttendance('');
      setMission('0');
      setContractor('');
      setIncidents('0');
      setNotes('');
      setError('');
    }
  }, [editingRecord, isOpen, existingRecords]);

  // Real-time calculation
  const calculations = useMemo(() => {
    const att = Math.max(0, parseFloat(attendance.replace(/,/g, '')) || 0);
    const mis = Math.max(0, parseFloat(mission.replace(/,/g, '')) || 0);
    const con = Math.max(0, parseFloat(contractor.replace(/,/g, '')) || 0);
    const inc = Math.max(0, parseInt(incidents.replace(/[^\d]/g, ''), 10) || 0);

    const directStaffE = att + mis;
    const totalHours = directStaffE + con;
    const estimatedMonthlyTRIR = totalHours > 0 ? (inc * 1000000) / totalHours : 0;

    let statusType: 'safe' | 'warning' | 'danger' = 'safe';
    let statusText = isFa ? 'مطلوب و ایمن' : 'Safe / Within Target';
    let statusClass = 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800';

    if (estimatedMonthlyTRIR > trirTarget * 1.15) {
      statusType = 'danger';
      statusText = isFa ? 'بحرانی (فراتر از هدف کارگاه)' : 'Critical / Exceeds Target';
      statusClass = 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/40 dark:border-red-800';
    } else if (estimatedMonthlyTRIR > trirTarget * 0.8) {
      statusType = 'warning';
      statusText = isFa ? 'هشدار (نزدیک به سقف هدف)' : 'Warning / Near Threshold';
      statusClass = 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800';
    }

    return {
      att,
      mis,
      con,
      inc,
      directStaffE,
      totalHours,
      estimatedMonthlyTRIR,
      statusType,
      statusText,
      statusClass
    };
  }, [attendance, mission, contractor, incidents, trirTarget, isFa]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const attNum = calculations.att;
    const misNum = calculations.mis;
    const conNum = calculations.con;
    const incNum = calculations.inc;

    if (!year || year < 1300 || year > 1500) {
      setError(isFa ? 'لطفاً سال شمسی معتبر ۴ رقمی وارد کنید.' : 'Please enter a valid 4-digit Jalali year.');
      return;
    }

    if (calculations.totalHours <= 0) {
      setError(isFa ? 'مجموع ساعات کارکرد کارگاه نمی‌تواند صفر باشد.' : 'Total site man-hours cannot be zero.');
      return;
    }

    // Check duplicate
    const isDuplicate = existingRecords.some(r => 
      r.month === month && 
      r.year === year && 
      (!editingRecord || r.id !== editingRecord.id)
    );

    if (isDuplicate) {
      setError(isFa ? `برای دوره ${month} سال ${year} قبلاً رکوردی ثبت شده است. لطفاً دوره دیگری انتخاب یا رکورد قبلی را ویرایش کنید.` : `Record for ${month} ${year} already exists.`);
      return;
    }

    onSave({
      year,
      month,
      attendance: attNum,
      mission: misNum,
      contractor: conNum,
      incidents: incNum,
      notes: notes.trim() || undefined
    }, editingRecord ? editingRecord.id : undefined);

    onClose();
  };

  const fmt = (num: number) => num.toLocaleString('fa-IR');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn" id="trir-record-modal">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
        
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/20 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shadow-amber-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
                {editingRecord 
                  ? (isFa ? `ویرایش آمار کارکرد و حوادث: ${editingRecord.month} ${editingRecord.year}` : 'Edit Monthly Man-hours & Incident Record')
                  : (isFa ? 'ثبت و الحاق آمار کارکرد و حوادث ماهانه جدید' : 'Register New Monthly Man-hours & Incidents')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isFa ? 'ثبت ساعات حضور، مأموریت، کارکرد پیمانکاری و تعداد حوادث قابل ثبت LTI' : 'Record official site hours, mission, contractors and LTI cases'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isFa ? 'بستن' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Time period selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span>{isFa ? 'سال دوره (شمسی)' : 'Jalali Year'}</span>
                <span className="text-red-500">*</span>
              </label>
              <input 
                type="number"
                min={1380}
                max={1460}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || currentJalaliYear)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>{isFa ? 'ماه دوره' : 'Month'}</span>
                <span className="text-red-500">*</span>
              </label>
              <select 
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              >
                {PERSIAN_MONTHS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Hours Input Grid */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span>{isFa ? 'تفکیک ساعات کارکرد ماهانه' : 'Monthly Man-hours Breakdown'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Attendance */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  {isFa ? 'حضور پرسنل سایت (ساعت)' : 'Site Attendance (hrs)'}
                  <span className="text-red-500 mr-1">*</span>
                </label>
                <input 
                  type="text"
                  inputMode="numeric"
                  placeholder="مثال: 64500"
                  value={attendance}
                  onChange={(e) => setAttendance(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Mission */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  {isFa ? 'ماموریت اداری/شهری (ساعت)' : 'Mission Hours'}
                </label>
                <input 
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={mission}
                  onChange={(e) => setMission(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Contractor */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  {isFa ? 'ساعت پیمانکاری' : 'Contractor Hours'}
                </label>
                <input 
                  type="text"
                  inputMode="numeric"
                  placeholder="مثال: 3200"
                  value={contractor}
                  onChange={(e) => setContractor(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Incidents & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* LTI Incidents */}
            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-xs font-black text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{isFa ? 'تعداد حوادث LTI' : 'LTI Cases'}</span>
                <span className="text-red-500">*</span>
              </label>
              <input 
                type="number"
                min={0}
                max={50}
                value={incidents}
                onChange={(e) => setIncidents(e.target.value)}
                className="w-full bg-red-50/50 dark:bg-red-950/20 border-2 border-red-300 dark:border-red-800/80 rounded-xl p-2.5 text-sm font-mono font-black text-red-600 dark:text-red-400 focus:outline-none focus:border-red-500 text-center"
                required
              />
              <p className="text-[10px] text-slate-400 leading-tight">
                {isFa ? 'حوادث منتهی به از دست رفتن زمان کاری یا آسیب شدید' : 'Lost Time / Recordable incidents'}
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{isFa ? 'توضیحات کارگاه / عملیات خاص (اختیاری)' : 'Notes / Project Context (Optional)'}</span>
              </label>
              <input 
                type="text"
                placeholder={isFa ? 'مثال: عملیات تعمیرات اساسی واحد تفکیک گاز...' : 'e.g. Turnaround phase...'}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Live Calculation Panel */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-amber-500" />
                {isFa ? 'محاسبه آنی شاخص‌های کارکرد و TRIR این ماه' : 'Live Calculated Indicators for Selected Month'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${calculations.statusClass}`}>
                {calculations.statusText}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">{isFa ? 'مجموع شرکت (E)' : 'Direct E (Hrs)'}</span>
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
                  {calculations.directStaffE.toLocaleString('en-US')}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">{isFa ? 'کل کارکرد ماه (ساعت)' : 'Total Month Hours'}</span>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                  {calculations.totalHours.toLocaleString('en-US')}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">{isFa ? 'TRIR ماهیانه' : 'Monthly TRIR'}</span>
                <span className="text-xs font-mono font-black text-sky-600 dark:text-sky-400">
                  {calculations.estimatedMonthlyTRIR.toFixed(2)}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">{isFa ? 'هدف کارگاه' : 'Target TRIR'}</span>
                <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                  {trirTarget.toFixed(2)}
                </span>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              {isFa ? '* فرمول TRIR ماهانه = (تعداد حوادث × ۱,۰۰۰,۰۰۰) ÷ کل کارکرد کارگاه' : '* Formula = (Incidents × 1,000,000) / Total Man-hours'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-md shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{editingRecord ? (isFa ? 'ذخیره تغییرات' : 'Save Changes') : (isFa ? 'ثبت و الحاق نهایی' : 'Add Record')}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
