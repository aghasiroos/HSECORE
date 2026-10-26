import React, { useState, useEffect } from 'react';
import { Award, X, Calendar, Hash, CheckCircle2, User } from 'lucide-react';
import { VehicleCertificate } from '../types/vehicleTypes';

interface Props {
  isOpen: boolean;
  language: 'fa' | 'en';
  vehicleCode: string;
  certificate?: VehicleCertificate | null;
  onSave: (data: Omit<VehicleCertificate, 'id'>) => void;
  onClose: () => void;
}

export default function VehicleCertificateModal({
  isOpen,
  language,
  vehicleCode,
  certificate,
  onSave,
  onClose
}: Props) {
  const isFa = language === 'fa';

  const [testType, setTestType] = useState('');
  const [equipment, setEquipment] = useState('');
  const [testDate, setTestDate] = useState(new Date().toLocaleDateString('fa-IR'));
  const [issueDate, setIssueDate] = useState(new Date().toLocaleDateString('fa-IR'));
  const [expiryDate, setExpiryDate] = useState('');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [issuer, setIssuer] = useState('');
  const [result, setResult] = useState<VehicleCertificate['result']>('مطلوب (Pass)');
  const [testValue, setTestValue] = useState('');
  const [allowedLimit, setAllowedLimit] = useState('');

  useEffect(() => {
    if (certificate) {
      setTestType(certificate.testType || '');
      setEquipment(certificate.equipment || '');
      setTestDate(certificate.testDate || new Date().toLocaleDateString('fa-IR'));
      setIssueDate(certificate.issueDate || new Date().toLocaleDateString('fa-IR'));
      setExpiryDate(certificate.expiryDate || '');
      setCertificateNumber(certificate.certificateNumber || '');
      setIssuer(certificate.issuer || '');
      setResult(certificate.result || 'مطلوب (Pass)');
      setTestValue(certificate.testValue || '');
      setAllowedLimit(certificate.allowedLimit || '');
    } else {
      setTestType('');
      setEquipment('');
      setTestDate(new Date().toLocaleDateString('fa-IR'));
      setIssueDate(new Date().toLocaleDateString('fa-IR'));
      setExpiryDate('');
      setCertificateNumber('');
      setIssuer('');
      setResult('مطلوب (Pass)');
      setTestValue('');
      setAllowedLimit('');
    }
  }, [certificate, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testType.trim() || !equipment.trim()) return;

    onSave({
      vehicleId: certificate?.vehicleId || '',
      testType: testType.trim(),
      equipment: equipment.trim(),
      testDate,
      issueDate,
      expiryDate: expiryDate.trim() || (isFa ? '۱۴۰۵/۱۲/۲۹' : '2027/03/20'),
      certificateNumber: certificateNumber.trim() || `CERT-${Date.now().toString().slice(-4)}`,
      issuer: issuer.trim() || (isFa ? 'مرکز آزمون و استاندارد آتش‌نشانی' : 'Fire Dept Testing Authority'),
      result,
      testValue: testValue.trim(),
      allowedLimit: allowedLimit.trim()
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
            <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 border border-purple-200 dark:border-purple-900/50">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {certificate ? (isFa ? 'ویرایش گواهینامه فنی و تست' : 'Edit Test Certificate') : (isFa ? 'ثبت گواهینامه فنی و آزمون تجهیز' : 'Add Test Certificate')}
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
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-purple-500" />
              <span>{isFa ? 'نوع آزمون / استاندارد:' : 'Test Type:'} <span className="text-red-500">*</span></span>
            </label>
            <input
              type="text"
              value={testType}
              onChange={e => setTestType(e.target.value)}
              placeholder={isFa ? 'تست هیدرواستاتیک، دبی پمپ آب، مقاومت عایقی نردبان...' : 'Hydrostatic Test, Pump Flow, Ladder test...'}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-bold text-slate-800 dark:text-slate-100"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                {isFa ? 'تجهیز مورد آزمون:' : 'Equipment:'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={equipment}
                onChange={e => setEquipment(e.target.value)}
                placeholder={isFa ? 'پمپ گودایوا، مخزن فوم، نردبان هیدرولیک...' : 'Water pump, foam tank...'}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-slate-800 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                {isFa ? 'نتیجه آزمون:' : 'Result:'}
              </label>
              <select
                value={result}
                onChange={e => setResult(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="مطلوب (Pass)">مطلوب (Pass)</option>
                <option value="نامطلوب (Fail)">نامطلوب (Fail)</option>
                <option value="مشروط">مشروط (Conditional)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                {isFa ? 'مقدار ثبت‌شده در آزمون:' : 'Test Value:'}
              </label>
              <input
                type="text"
                value={testValue}
                onChange={e => setTestValue(e.target.value)}
                placeholder="4200 L/min @ 10 Bar"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-mono text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                {isFa ? 'حد مجاز / حداقل استاندارد:' : 'Standard Limit:'}
              </label>
              <input
                type="text"
                value={allowedLimit}
                onChange={e => setAllowedLimit(e.target.value)}
                placeholder="حداقل 4000 لیتر"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span>{isFa ? 'شماره گواهینامه / رفرنس:' : 'Certificate No:'}</span>
              </label>
              <input
                type="text"
                value={certificateNumber}
                onChange={e => setCertificateNumber(e.target.value)}
                placeholder="CERT-NFPA-8910"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-mono text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>{isFa ? 'مرجع صادرکننده / آزمایشگاه:' : 'Issuer / Lab:'}</span>
              </label>
              <input
                type="text"
                value={issuer}
                onChange={e => setIssuer(e.target.value)}
                placeholder={isFa ? 'مرکز ملی استاندارد' : 'Testing Center'}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{isFa ? 'تاریخ انجام آزمون:' : 'Test Date:'}</span>
              </label>
              <input
                type="text"
                value={testDate}
                onChange={e => setTestDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-mono text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span>{isFa ? 'تاریخ انقضای گواهی:' : 'Expiry Date:'}</span>
              </label>
              <input
                type="text"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                placeholder="1405/12/29"
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
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Award className="w-4 h-4" />
              <span>{certificate ? (isFa ? 'ذخیره تغییرات' : 'Save Changes') : (isFa ? 'ثبت گواهینامه' : 'Save Certificate')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
