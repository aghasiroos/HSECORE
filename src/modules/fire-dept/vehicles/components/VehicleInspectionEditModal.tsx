import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Calendar, User, Gauge, FileText, CheckCircle2 } from 'lucide-react';
import { VehicleInspectionRecord } from '../types/vehicleTypes';
import Checklist3TierSignatures from '../../../../components/common/Checklist3TierSignatures';

interface Props {
  isOpen: boolean;
  language: 'fa' | 'en';
  vehicleCode: string;
  inspection: VehicleInspectionRecord | null;
  onSave: (data: Partial<VehicleInspectionRecord>) => void;
  onClose: () => void;
}

export default function VehicleInspectionEditModal({
  isOpen,
  language,
  vehicleCode,
  inspection,
  onSave,
  onClose
}: Props) {
  const isFa = language === 'fa';

  const [inspectorName, setInspectorName] = useState('');
  const [inspectorCode, setInspectorCode] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorCode, setSupervisorCode] = useState('');
  const [hseManagerName, setHseManagerName] = useState('');
  const [hseManagerCode, setHseManagerCode] = useState('');
  const [date, setDate] = useState('');
  const [shift, setShift] = useState('');
  const [mileageAtInspection, setMileageAtInspection] = useState<number>(0);
  const [overallState, setOverallState] = useState<VehicleInspectionRecord['overallState']>('تأیید آماده‌به‌کار کامل');
  const [notes, setNotes] = useState('');
  const [complianceScore, setComplianceScore] = useState<number>(100);

  useEffect(() => {
    if (inspection) {
      setInspectorName(inspection.inspectorName || '');
      setInspectorCode(inspection.inspectorCode || '');
      setSupervisorName(inspection.supervisorName || '');
      setSupervisorCode(inspection.supervisorCode || '');
      setHseManagerName(inspection.hseManagerName || '');
      setHseManagerCode(inspection.hseManagerCode || '');
      setDate(inspection.date || '');
      setShift(inspection.shift || 'شیفت A');
      setMileageAtInspection(inspection.mileageAtInspection || 0);
      setOverallState(inspection.overallState || 'تأیید آماده‌به‌کار کامل');
      setNotes(inspection.notes || '');
      setComplianceScore(inspection.complianceScore || 100);
    }
  }, [inspection, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      inspectorName: inspectorName.trim(),
      inspectorCode: inspectorCode.trim() || undefined,
      supervisorName: supervisorName.trim() || undefined,
      supervisorCode: supervisorCode.trim() || undefined,
      hseManagerName: hseManagerName.trim() || undefined,
      hseManagerCode: hseManagerCode.trim() || undefined,
      date: date.trim(),
      shift: shift.trim(),
      mileageAtInspection: Number(mileageAtInspection) || 0,
      overallState,
      notes: notes.trim(),
      complianceScore: Number(complianceScore) || 0
    });
    onClose();
  };

  if (!isOpen || !inspection) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs font-sans animate-fadeIn overflow-y-auto"
      style={{ direction: isFa ? 'rtl' : 'ltr' }}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-scaleIn my-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-600 border border-red-200 dark:border-red-900/50">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {isFa ? `ویرایش بازرسی ${inspection?.inspectionType || ''}` : 'Edit Inspection Record'}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {isFa ? `خودرو: ${vehicleCode} • شناسه: ${inspection?.id || ''}` : `Vehicle: ${vehicleCode} • ID: ${inspection?.id || ''}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-red-500" />
                <span>{isFa ? 'تاریخ بازرسی:' : 'Date:'}</span>
              </label>
              <input
                type="text"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-mono text-slate-800 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                {isFa ? 'شیفت عملیاتی:' : 'Shift:'}
              </label>
              <input
                type="text"
                value={shift}
                onChange={e => setShift(e.target.value)}
                placeholder="شیفت A"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {/* 3-Tier Official Signatures Matrix */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <Checklist3TierSignatures
              isFa={isFa}
              formData={{
                inspectorName,
                inspectorCode,
                supervisorName,
                supervisorCode,
                hseManagerName,
                hseManagerCode
              }}
              onChange={(updated) => {
                if (updated.inspectorName !== undefined) setInspectorName(updated.inspectorName);
                if (updated.inspectorCode !== undefined) setInspectorCode(updated.inspectorCode);
                if (updated.supervisorName !== undefined) setSupervisorName(updated.supervisorName);
                if (updated.supervisorCode !== undefined) setSupervisorCode(updated.supervisorCode);
                if (updated.hseManagerName !== undefined) setHseManagerName(updated.hseManagerName);
                if (updated.hseManagerCode !== undefined) setHseManagerCode(updated.hseManagerCode);
              }}
              tier1Title={isFa ? 'کارشناس / نماینده بازرسی آتش‌نشانی' : 'Fire Inspector'}
              tier1Subtitle={isFa ? 'بازرس و ثبت‌کننده فنی ناوگان' : 'Vehicle Technical Auditor'}
              tier2Title={isFa ? 'سرپرست / مسئول ایستگاه آتش‌نشانی' : 'Fire Station Lead'}
              tier2Subtitle={isFa ? 'مسئول تجهیزات و آماده‌به‌کاری' : 'Station Readiness Lead'}
              tier3Title={isFa ? 'رئیس مرکز HSE' : 'Head of HSE Center'}
              tier3Subtitle={isFa ? 'تصویب و تایید نهایی' : 'Final Approval'}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-slate-400" />
                <span>{isFa ? 'کارکرد کیلومتر:' : 'Mileage (km):'}</span>
              </label>
              <input
                type="number"
                value={mileageAtInspection}
                onChange={e => setMileageAtInspection(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-mono text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                {isFa ? 'شاخص انطباق (%):' : 'Score (%):'}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={complianceScore}
                onChange={e => setComplianceScore(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-mono font-black text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
              {isFa ? 'نتیجه کلی وضعیت:' : 'Overall State:'}
            </label>
            <select
              value={overallState}
              onChange={e => setOverallState(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-bold text-slate-800 dark:text-slate-100"
            >
              <option value="تأیید آماده‌به‌کار کامل">تأیید آماده‌به‌کار کامل</option>
              <option value="مشروط با نواقص جزئی">مشروط با نواقص جزئی</option>
              <option value="عدم تأیید و توقف عملیات">عدم تأیید و توقف عملیات</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>{isFa ? 'توضیحات و یادداشت بازرس:' : 'Notes:'}</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-colors cursor-pointer"
            >
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isFa ? 'ذخیره تغییرات بازرسی' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
