import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, ShieldAlert, Tag, Calendar, User, CheckCircle2 } from 'lucide-react';
import { VehicleDefectRecord } from '../types/vehicleTypes';

interface Props {
  isOpen: boolean;
  language: 'fa' | 'en';
  vehicleCode: string;
  defect?: VehicleDefectRecord | null;
  onSave: (data: Omit<VehicleDefectRecord, 'id' | 'code'>) => void;
  onClose: () => void;
}

export default function VehicleDefectModal({
  isOpen,
  language,
  vehicleCode,
  defect,
  onSave,
  onClose
}: Props) {
  const isFa = language === 'fa';

  const [itemTitle, setItemTitle] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState<VehicleDefectRecord['severity']>('متوسط (Major)');
  const [priority, setPriority] = useState<VehicleDefectRecord['priority']>('متوسط');
  const [description, setDescription] = useState('');
  const [reportedDate, setReportedDate] = useState(new Date().toLocaleDateString('fa-IR'));
  const [reportedBy, setReportedBy] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<VehicleDefectRecord['status']>('باز');

  useEffect(() => {
    if (defect) {
      setItemTitle(defect.itemTitle || '');
      setCategory(defect.category || '');
      setSeverity(defect.severity || 'متوسط (Major)');
      setPriority(defect.priority || 'متوسط');
      setDescription(defect.description || '');
      setReportedDate(defect.reportedDate || new Date().toLocaleDateString('fa-IR'));
      setReportedBy(defect.reportedBy || '');
      setResponsiblePerson(defect.responsiblePerson || '');
      setDueDate(defect.dueDate || '');
      setStatus(defect.status || 'باز');
    } else {
      setItemTitle('');
      setCategory(isFa ? 'سامانه اطفاء حریق و پمپ' : 'Extinguishing System');
      setSeverity('متوسط (Major)');
      setPriority('متوسط');
      setDescription('');
      setReportedDate(new Date().toLocaleDateString('fa-IR'));
      setReportedBy('');
      setResponsiblePerson('');
      setDueDate('');
      setStatus('باز');
    }
  }, [defect, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    onSave({
      vehicleId: defect?.vehicleId || '',
      vehicleCode: vehicleCode,
      itemTitle: itemTitle.trim() || (isFa ? 'نقص فنی ثبت‌شده' : 'Reported Defect'),
      category: category.trim() || (isFa ? 'تجهیزات و بدنه' : 'General Equipment'),
      severity,
      priority,
      description: description.trim(),
      reportedDate,
      reportedBy: reportedBy.trim() || (isFa ? 'مسئول شیفت آتش‌نشانی' : 'Shift Officer'),
      responsiblePerson: responsiblePerson.trim(),
      dueDate: dueDate.trim(),
      status
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
            <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 border border-amber-200 dark:border-amber-900/50">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {defect ? (isFa ? 'ویرایش اطلاعات نقص فنی' : 'Edit Defect Record') : (isFa ? 'ثبت مستقیم نقص فنی جدید' : 'Report New Defect')}
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
                <Tag className="w-3.5 h-3.5 text-amber-500" />
                <span>{isFa ? 'عنوان بخش / قلم آسیب‌دیده:' : 'Item / Part Title:'}</span>
              </label>
              <input
                type="text"
                value={itemTitle}
                onChange={e => setItemTitle(e.target.value)}
                placeholder={isFa ? 'شیر تخلیه فوم، پمپ هیدرولیک، چراغ گردان...' : 'Foam discharge valve...'}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-bold text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                {isFa ? 'دسته‌بندی و سیستم:' : 'Category:'}
              </label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder={isFa ? 'سامانه اطفاء حریق / شاسی / هیدرولیک' : 'Extinguishing System'}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
              {isFa ? 'شرح کامل نقص و پیامدهای احتمالی:' : 'Defect Description:'} <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={isFa ? 'توضیحات عیب مشاهده‌شده، نشتی، شکستگی یا عدم کارایی...' : 'Defect details...'}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none text-slate-800 dark:text-slate-100"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                {isFa ? 'سطح شدت (Severity):' : 'Severity:'}
              </label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 outline-none font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="بحرانی (Critical)">بحرانی (Critical)</option>
                <option value="متوسط (Major)">متوسط (Major)</option>
                <option value="جزئی (Minor)">جزئی (Minor)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                {isFa ? 'اولویت اقدام:' : 'Priority:'}
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 outline-none font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="فوری (۲۴ ساعت)">فوری (۲۴ ساعت)</option>
                <option value="متوسط">متوسط</option>
                <option value="عادی">عادی</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                {isFa ? 'وضعیت پیگیری:' : 'Status:'}
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 outline-none font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="باز">{isFa ? 'باز' : 'Open'}</option>
                <option value="در حال اقدام">{isFa ? 'در حال اقدام' : 'In Progress'}</option>
                <option value="بسته شده">{isFa ? 'بسته شده' : 'Closed'}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>{isFa ? 'مسئول پیگیری / اقدام:' : 'Responsible:'}</span>
              </label>
              <input
                type="text"
                value={responsiblePerson}
                onChange={e => setResponsiblePerson(e.target.value)}
                placeholder={isFa ? 'مهندس ترابری / پیمانکار پمپ' : 'Responsible person'}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span>{isFa ? 'مهلت رفع نقص:' : 'Due Date:'}</span>
              </label>
              <input
                type="text"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                placeholder="1404/09/15"
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
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{defect ? (isFa ? 'ذخیره تغییرات' : 'Save Changes') : (isFa ? 'ثبت نقص فنی' : 'Report Defect')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
