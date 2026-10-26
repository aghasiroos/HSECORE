import React, { useState, useEffect } from 'react';
import { Wrench, X, Calendar, DollarSign, Clock, User, ShieldCheck } from 'lucide-react';
import { VehicleMaintenanceRecord } from '../types/vehicleTypes';

interface Props {
  isOpen: boolean;
  language: 'fa' | 'en';
  vehicleCode: string;
  maintenance?: VehicleMaintenanceRecord | null;
  onSave: (data: Omit<VehicleMaintenanceRecord, 'id'>) => void;
  onClose: () => void;
}

export function VehicleMaintenanceModal({
  isOpen,
  language,
  vehicleCode,
  maintenance,
  onSave,
  onClose
}: Props) {
  const isFa = language === 'fa';

  const [date, setDate] = useState(new Date().toLocaleDateString('fa-IR'));
  const [repairType, setRepairType] = useState<VehicleMaintenanceRecord['repairType']>('پیشگیرانه (PM)');
  const [failureDescription, setFailureDescription] = useState('');
  const [replacedParts, setReplacedParts] = useState('');
  const [cost, setCost] = useState<number>(0);
  const [downtimeDurationHours, setDowntimeDurationHours] = useState<number>(0);
  const [mechanic, setMechanic] = useState('');
  const [status, setStatus] = useState<VehicleMaintenanceRecord['status']>('پایان یافته');

  useEffect(() => {
    if (maintenance) {
      setDate(maintenance.date || new Date().toLocaleDateString('fa-IR'));
      setRepairType(maintenance.repairType || 'پیشگیرانه (PM)');
      setFailureDescription(maintenance.failureDescription || '');
      setReplacedParts(maintenance.replacedParts ? maintenance.replacedParts.join('، ') : '');
      setCost(maintenance.cost || 0);
      setDowntimeDurationHours(maintenance.downtimeDurationHours || 0);
      setMechanic(maintenance.mechanic || '');
      setStatus(maintenance.status || 'پایان یافته');
    } else {
      setDate(new Date().toLocaleDateString('fa-IR'));
      setRepairType('پیشگیرانه (PM)');
      setFailureDescription('');
      setReplacedParts('');
      setCost(0);
      setDowntimeDurationHours(0);
      setMechanic('');
      setStatus('پایان یافته');
    }
  }, [maintenance, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!failureDescription.trim()) return;

    const partsArray = replacedParts
      ? replacedParts.split(/[,،]+/).map(p => p.trim()).filter(Boolean)
      : [];

    onSave({
      vehicleId: maintenance?.vehicleId || '',
      vehicleCode: vehicleCode,
      date,
      repairType,
      failureDescription: failureDescription.trim(),
      replacedParts: partsArray,
      cost: Number(cost) || 0,
      downtimeDurationHours: Number(downtimeDurationHours) || 0,
      mechanic: mechanic.trim() || (isFa ? 'واحد ترابری و تعمیرگاه مرکزی' : 'Central Workshop'),
      status,
      docs: maintenance?.docs || [],
      mileage: maintenance?.mileage || 0
    });

    onClose();
  };

  if (!isOpen) return null;

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
            <div className="p-2.5 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 border border-sky-200 dark:border-sky-900/50">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {maintenance ? (isFa ? 'ویرایش گزارش تعمیرات و سرویس' : 'Edit Maintenance Log') : (isFa ? 'ثبت گزارش تعمیرات و سرویس خودرو' : 'New Maintenance Log')}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {isFa ? `خودرو: ${vehicleCode}` : `Vehicle: ${vehicleCode}`}
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
                <Calendar className="w-3.5 h-3.5 text-sky-500" />
                <span>{isFa ? 'تاریخ انجام عملیات:' : 'Date:'}</span>
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
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5 text-sky-500" />
                <span>{isFa ? 'نوع اقدام / تعمیرات:' : 'Action Type:'}</span>
              </label>
              <select
                value={repairType}
                onChange={e => setRepairType(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="پیشگیرانه (PM)">پیشگیرانه (PM)</option>
                <option value="اصلاحی (CM)">اصلاحی (CM)</option>
                <option value="اورژانسی / اضطراری">اورژانسی / اضطراری</option>
                <option value="اورهال اساسی">اورهال اساسی</option>
                <option value="تعویض روغن و سرویس دوره‌ای">تعویض روغن و سرویس دوره‌ای</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
              {isFa ? 'شرح عملیات و شرح عیب:' : 'Description:'} <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              value={failureDescription}
              onChange={e => setFailureDescription(e.target.value)}
              placeholder={isFa ? 'شرح کامل اقدامات انجام‌شده و قطعات اصلاح‌شده...' : 'Maintenance details...'}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-slate-100"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
              {isFa ? 'قطعات مصرف‌شده / تعویضی (با کاما جدا کنید):' : 'Replaced Parts (comma separated):'}
            </label>
            <input
              type="text"
              value={replacedParts}
              onChange={e => setReplacedParts(e.target.value)}
              placeholder={isFa ? 'فیلتر روغن، لنت ترمز، تسمه دینام...' : 'Oil filter, brake pads...'}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>{isFa ? 'تکنسین / تعمیرگاه:' : 'Mechanic / Workshop:'}</span>
              </label>
              <input
                type="text"
                value={mechanic}
                onChange={e => setMechanic(e.target.value)}
                placeholder={isFa ? 'تعمیرگاه مرکزی ترابری' : 'Workshop name'}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>{isFa ? 'وضعیت گزارش:' : 'Status:'}</span>
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="پایان یافته">{isFa ? 'پایان یافته (تکمیل شده)' : 'Completed'}</option>
                <option value="در حال انجام">{isFa ? 'در حال انجام' : 'In Progress'}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>{isFa ? 'هزینه (ریال):' : 'Cost (IRR):'}</span>
              </label>
              <input
                type="number"
                value={cost}
                onChange={e => setCost(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-mono text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{isFa ? 'مدت توقف (ساعت):' : 'Downtime (Hours):'}</span>
              </label>
              <input
                type="number"
                value={downtimeDurationHours}
                onChange={e => setDowntimeDurationHours(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-mono text-slate-800 dark:text-slate-100"
              />
            </div>
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
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Wrench className="w-4 h-4" />
              <span>{maintenance ? (isFa ? 'ذخیره تغییرات' : 'Save Changes') : (isFa ? 'ثبت گزارش تعمیرات' : 'Save Log')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default VehicleMaintenanceModal;

