import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FireEquipment } from '../types';
import { ColumnDefinition } from '../config/columns';
import { getUnits } from '../../../utils/orgHelper';

interface Props {
  language: 'fa' | 'en';
  category: string;
  columns: ColumnDefinition[];
  initialData: FireEquipment | null;
  onSave: (data: any) => void;
  onClose: () => void;
}

export default function EquipmentModal({ language, category, columns, initialData, onSave, onClose }: Props) {
  const isFa = language === 'fa';
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      // Set sensible defaults if available
      const defaults: any = {};
      columns.forEach(col => {
        if (col.options && col.options.length > 0) {
          defaults[col.key] = col.options[0];
        }
      });
      setFormData(defaults);
    }
  }, [initialData, columns]);

  const handleChange = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
              {initialData ? (isFa ? 'ویرایش تجهیز' : 'Edit Equipment') : (isFa ? 'افزودن تجهیز جدید' : 'Add New Equipment')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{category}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="equipForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {columns.map(col => (
              <div key={col.key} className={col.type === 'array' ? 'md:col-span-2' : ''}>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? col.labelFa : col.labelEn}
                </label>
                {col.type === 'select' || col.options ? (
                  <select
                    value={formData[col.key] ?? (col.options?.[0] || '')}
                    onChange={(e) => handleChange(col.key, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  >
                    {col.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : col.type === 'array' ? (
                  <input 
                    type="text" 
                    placeholder={isFa ? 'مقادیر را با کاما جدا کنید (مثال: هوز, نازل, ولو)' : 'Comma separated (e.g. Hose, Nozzle, Valve)'}
                    value={Array.isArray(formData[col.key]) ? formData[col.key].join(', ') : (formData[col.key] || '')}
                    onChange={(e) => handleChange(col.key, e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                ) : (
                  <>
                    <input 
                      type={col.type === 'number' ? 'number' : 'text'}
                      list={(col.key === 'location' || col.key === 'unit') ? 'fire-equip-units-list' : undefined}
                      value={formData[col.key] ?? ''}
                      onChange={(e) => handleChange(col.key, col.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                      required={col.key === 'location' || col.key === 'type' || col.key === 'tag' || col.key === 'specializedCode' || col.key === 'fireBoxNo' || col.key === 'foamStationNo'}
                    />
                  </>
                )}
              </div>
            ))}
            <datalist id="fire-equip-units-list">
              {getUnits().map(u => <option key={u} value={u} />)}
            </datalist>
          </form>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
          >
            {isFa ? 'انصراف' : 'Cancel'}
          </button>
          <button 
            form="equipForm" 
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
          >
            {isFa ? 'ذخیره اطلاعات' : 'Save Details'}
          </button>
        </div>
      </div>
    </div>
  );
}
