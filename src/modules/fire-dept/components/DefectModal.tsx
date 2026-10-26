import React, { useState, useEffect } from 'react';
import { X, Wrench } from 'lucide-react';
import { DefectRecord } from '../types';
import { getComplexPersonnelList } from '../../../utils/personnelHelper';
import { getUnits } from '../../../utils/orgHelper';

interface Props {
  language: 'fa' | 'en';
  initialData: DefectRecord | null;
  onSave: (data: DefectRecord) => void;
  onClose: () => void;
}

export default function DefectModal({ language, initialData, onSave, onClose }: Props) {
  const isFa = language === 'fa';
  const [formData, setFormData] = useState<Partial<DefectRecord>>({
    status: 'باز',
    date: new Date().toLocaleDateString('fa-IR')
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description) return;
    onSave(formData as DefectRecord);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                {initialData ? (isFa ? 'ویرایش نقص و اقدام اصلاحی' : 'Edit Defect & CAPA') : (isFa ? 'ثبت نقص و اقدام اصلاحی جدید' : 'Log New Defect & CAPA')}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[75vh]">
          <form id="defectForm" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isFa ? 'شرح نقص / مشکل مشاهده شده' : 'Defect Description'}
              </label>
              <textarea 
                rows={3}
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder={isFa ? 'مثال: افت فشار مانومتر کپسول یا نشتی شیر هیدرانت...' : 'E.g. Pressure gauge drop or hydrant valve leakage...'}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'شماره دستور کار (Work Order)' : 'Work Order No'}
                </label>
                <input 
                  type="text"
                  placeholder="WO-1404-..."
                  value={formData.workOrderNo || ''}
                  onChange={e => setFormData({ ...formData, workOrderNo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'وضعیت اقدام اصلاحی' : 'Status'}
                </label>
                <select 
                  value={formData.status || 'باز'}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                >
                  <option value="باز">{isFa ? '🔴 باز (در دست اقدام / پیگیری)' : 'Open'}</option>
                  <option value="بسته">{isFa ? '🟢 بسته (تکمیل شده و برطرف گشته)' : 'Closed'}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isFa ? 'شرح اقدام اصلاحی انجام شده / پیشنهادی' : 'Corrective Action'}
              </label>
              <input 
                type="text"
                value={formData.correctiveAction || ''}
                placeholder={isFa ? 'مثال: شارژ مجدد سیلندر، تعویض واشر، کالیبراسیون سنسور...' : 'Action taken / planned...'}
                onChange={e => setFormData({ ...formData, correctiveAction: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'مسئول پیگیری / اجرا' : 'Responsible Person'}
                </label>
                <input 
                  type="text"
                  list="fire-defect-responsible-list"
                  placeholder={isFa ? 'انتخاب شخص یا واحد سازمانی...' : 'Person or Department'}
                  value={formData.responsiblePerson || ''}
                  onChange={e => setFormData({ ...formData, responsiblePerson: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                />
                <datalist id="fire-defect-responsible-list">
                  {getComplexPersonnelList().map(p => (
                    <option key={p.id || p.personnelCode} value={p.fullName}>
                      {p.jobTitle ? `${p.jobTitle} (${p.unit || ''})` : p.personnelCode}
                    </option>
                  ))}
                  {getUnits().map(u => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'تاریخ اقدام' : 'Action Date'}
                </label>
                <input 
                  type="text"
                  placeholder={isFa ? '1404/05/20' : 'YYYY/MM/DD'}
                  value={formData.actionDate || ''}
                  onChange={e => setFormData({ ...formData, actionDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600"
          >
            {isFa ? 'انصراف' : 'Cancel'}
          </button>
          <button 
            form="defectForm" 
            type="submit" 
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
          >
            {isFa ? 'ذخیره نقص' : 'Save Defect'}
          </button>
        </div>
      </div>
    </div>
  );
}
