import React, { useState, useEffect } from 'react';
import {
  PermitCustomField,
  PermitFieldSection,
  PERMIT_FIELD_SECTIONS,
  fetchPermitFieldConfigs
} from './services/permitFieldConfigService';
import PersianDatePicker from '../common/PersianDatePicker';
import PersianTimePicker from '../common/PersianTimePicker';
import { Sparkles } from 'lucide-react';

interface PermitDynamicFieldsSectionProps {
  permitType: 'Hot' | 'Cold';
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  isReadOnly?: boolean;
  isFa?: boolean;
  sectionFilter?: PermitFieldSection;
}

export const PermitDynamicFieldsSection: React.FC<PermitDynamicFieldsSectionProps> = ({
  permitType,
  values,
  onChange,
  isReadOnly = false,
  isFa = true,
  sectionFilter
}) => {
  const [fields, setFields] = useState<PermitCustomField[]>([]);

  useEffect(() => {
    fetchPermitFieldConfigs().then(all => {
      setFields(all);
    });

    const handleUpdate = (e: any) => {
      if (e.detail) {
        setFields(e.detail);
      }
    };

    window.addEventListener('ptw_fields_updated', handleUpdate);
    return () => {
      window.removeEventListener('ptw_fields_updated', handleUpdate);
    };
  }, []);

  // Filter fields applicable to this permit type and active status
  const activeFields = fields.filter(f => {
    if (!f.isActive) return false;
    if (f.scope !== 'Both' && f.scope !== permitType) return false;
    if (sectionFilter && f.section !== sectionFilter) return false;
    return true;
  });

  if (activeFields.length === 0) return null;

  // Group by sections if not filtered by specific section
  const sectionsToRender = sectionFilter 
    ? [PERMIT_FIELD_SECTIONS.find(s => s.id === sectionFilter)!] 
    : PERMIT_FIELD_SECTIONS.filter(s => activeFields.some(f => f.section === s.id));

  return (
    <div className="space-y-4 text-xs font-sans">
      {sectionsToRender.map(sec => {
        const secFields = activeFields.filter(f => f.section === sec.id);
        if (secFields.length === 0) return null;

        return (
          <div key={sec.id} className="border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/20 space-y-3">
            {!sectionFilter && (
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-1.5 text-slate-800 dark:text-slate-200 font-bold text-xs">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>{sec.titleFa}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {secFields.map(field => {
                const curVal = values[field.key] !== undefined ? values[field.key] : (field.defaultValue ?? '');

                return (
                  <div key={field.id} className={field.type === 'textarea' ? 'sm:col-span-2 md:col-span-3' : ''}>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {field.labelFa}
                      {field.required && <span className="text-red-500 mr-1">*</span>}
                    </label>

                    {/* Text Field */}
                    {field.type === 'text' && (
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={curVal}
                        onChange={e => onChange(field.key, e.target.value)}
                        placeholder={field.placeholder || ''}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800"
                      />
                    )}

                    {/* Number Field */}
                    {field.type === 'number' && (
                      <input
                        type="number"
                        disabled={isReadOnly}
                        value={curVal}
                        onChange={e => onChange(field.key, e.target.value)}
                        placeholder={field.placeholder || ''}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800 font-mono"
                      />
                    )}

                    {/* Textarea Field */}
                    {field.type === 'textarea' && (
                      <textarea
                        rows={2}
                        disabled={isReadOnly}
                        value={curVal}
                        onChange={e => onChange(field.key, e.target.value)}
                        placeholder={field.placeholder || ''}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800"
                      />
                    )}

                    {/* Select Dropdown */}
                    {field.type === 'select' && (
                      <select
                        disabled={isReadOnly}
                        value={curVal}
                        onChange={e => onChange(field.key, e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800"
                      >
                        <option value="">{field.placeholder || 'انتخاب نمایید...'}</option>
                        {(field.options || []).map((opt, oIdx) => (
                          <option key={oIdx} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}

                    {/* Checkbox */}
                    {field.type === 'checkbox' && (
                      <label className="flex items-center gap-2 mt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={isReadOnly}
                          checked={Boolean(curVal)}
                          onChange={e => onChange(field.key, e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-700"
                        />
                        <span className="text-xs text-slate-700 dark:text-slate-300">
                          {field.description || 'تایید و اقدام گردید'}
                        </span>
                      </label>
                    )}

                    {/* Date Picker */}
                    {field.type === 'date' && (
                      <PersianDatePicker
                        value={curVal}
                        onChange={val => onChange(field.key, val)}
                        disabled={isReadOnly}
                        placeholder={field.placeholder || '۱۴۰۴/--/--'}
                      />
                    )}

                    {/* Time Picker */}
                    {field.type === 'time' && (
                      <PersianTimePicker
                        value={curVal}
                        onChange={val => onChange(field.key, val)}
                        isFa={isFa}
                        size="sm"
                        disabled={isReadOnly}
                        placeholder="HH:mm"
                      />
                    )}

                    {field.description && field.type !== 'checkbox' && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {field.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
