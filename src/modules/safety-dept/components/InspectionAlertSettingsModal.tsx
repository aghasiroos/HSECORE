import React, { useState, useEffect } from 'react';
import { X, Save, Sliders, AlertTriangle, Settings, Bell } from 'lucide-react';
import { SafetyChecklistTypeTemplate } from '../types';
import { InspectionAlertSettings } from '../../../utils/inspectionScheduleHelper';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  templates: SafetyChecklistTypeTemplate[];
  currentSettings: InspectionAlertSettings;
  onSettingsSaved: (settings: InspectionAlertSettings) => void;
  isFa?: boolean;
}

export default function InspectionAlertSettingsModal({
  isOpen,
  onClose,
  templates,
  currentSettings,
  onSettingsSaved,
  isFa = true
}: Props) {
  const [settings, setSettings] = useState<InspectionAlertSettings>(currentSettings);

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSettingsSaved(settings);
    // Dispatch event so other components know about the update
    const event = new CustomEvent('hse_inspection_alert_settings_updated', { 
      detail: settings 
    });
    window.dispatchEvent(event);
    onClose();
  };

  const handleTemplateThresholdChange = (templateId: string, value: string) => {
    const numValue = parseInt(value);
    if (isNaN(numValue)) return;
    
    setSettings(prev => ({
      ...prev,
      customThresholdsByType: {
        ...(prev.customThresholdsByType || {}),
        [templateId]: numValue
      }
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl ${isFa ? 'rtl' : 'ltr'}`}>
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {isFa ? 'تنظیمات هشدار سررسید بازرسی‌ها' : 'Inspection Alert Settings'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isFa ? 'مدیریت آستانه زمان هشدار برای چک‌لیست‌های دوره‌ای' : 'Manage alert thresholds for periodic checklists'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* General Settings */}
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-500" />
              {isFa ? 'تنظیمات عمومی' : 'General Settings'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isFa ? 'آستانه هشدار (روز قبل از موعد)' : 'Warning Threshold (Days)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={settings.warningThresholdDays}
                    onChange={e => setSettings({...settings, warningThresholdDays: parseInt(e.target.value) || 7})}
                    className="w-full h-11 px-4 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  />
                  <Bell className={`absolute ${isFa ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500`} />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isFa ? 'آستانه فوریت (روز قبل از موعد)' : 'Urgent Threshold (Days)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={settings.urgentThresholdDays}
                    onChange={e => setSettings({...settings, urgentThresholdDays: parseInt(e.target.value) || 2})}
                    className="w-full h-11 px-4 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  />
                  <AlertTriangle className={`absolute ${isFa ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-rose-500`} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.highlightRowColor}
                  onChange={e => setSettings({...settings, highlightRowColor: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {isFa ? 'رنگ‌بندی سطرها بر اساس وضعیت' : 'Highlight rows based on status'}
                </span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.bannerAlertEnabled}
                  onChange={e => setSettings({...settings, bannerAlertEnabled: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {isFa ? 'نمایش بنر هشدار در داشبورد' : 'Show top alert banner'}
                </span>
              </label>
            </div>
          </div>

          <div className="h-px bg-slate-200 dark:bg-slate-700" />

          {/* Per-Checklist Settings */}
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-500" />
              {isFa ? 'تنظیمات اختصاصی نوع بازرسی' : 'Per-Checklist Settings'}
            </h3>
            
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isFa ? 'شما می‌توانید برای انواع خاصی از بازرسی‌ها، زمان هشدار متفاوتی تنظیم کنید.' : 'You can override the warning threshold for specific inspection types.'}
            </p>

            <div className="space-y-3">
              {templates.map(template => (
                <div key={template.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex-1">
                    <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                      {isFa ? template.titleFa : template.titleEn}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {isFa ? 'هشدار:' : 'Alert:'}
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={settings.customThresholdsByType?.[template.id] || ''}
                      placeholder={settings.warningThresholdDays.toString()}
                      onChange={e => handleTemplateThresholdChange(template.id, e.target.value)}
                      className="w-20 h-9 px-3 text-center border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-500">
                      {isFa ? 'روز' : 'days'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-800/50 rounded-b-3xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {isFa ? 'انصراف' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Save className="w-4 h-4" />
            {isFa ? 'ذخیره تنظیمات' : 'Save Settings'}
          </button>
        </div>

      </div>
    </div>
  );
}
