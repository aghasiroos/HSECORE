import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Check, AlertTriangle, CheckCircle2, MinusCircle, 
  Building2, Coffee, UtensilsCrossed, Ambulance, Bath,
  Calendar, Clock, MapPin, User, ShieldCheck, Camera, 
  FileText, Plus, Trash2, AlertCircle, Save, Paperclip, 
  Upload, Download, Eye, Repeat, FileSpreadsheet
} from 'lucide-react';
import { 
  HealthEnvInspection, 
  HealthEnvChecklistTypeTemplate, 
  HealthEnvChecklistType, 
  HealthEnvChecklistInspectionItem,
  HealthEnvChecklistItemVerdict,
  HealthEnvScheduleType,
  HealthEnvPeriodicInterval,
  HealthEnvAttachment
} from '../../types/checklistTypes';
import CentralPersonnelSelector from '../../../../components/CentralPersonnelSelector';
import Checklist3TierSignatures from '../../../../components/common/Checklist3TierSignatures';
import { ComplexPersonnel, PersonnelOrgDetails } from '../../../../utils/personnelHelper';
import { getOrgSites, getUnits } from '../../../../utils/orgHelper';
import { getTodayJalaliDate, calculateNextInspectionDate } from '../../../../utils/inspectionScheduleHelper';
import { SafetyAuditPhoto } from '../../../safety-dept/types';
import { toast } from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  templates: HealthEnvChecklistTypeTemplate[];
  initialData?: HealthEnvInspection | null;
  defaultTypeId?: HealthEnvChecklistType;
  onSave: (inspection: Partial<HealthEnvInspection>) => Promise<any>;
  currentUser?: any;
}

export default function HealthEnvChecklistFormModal({
  isOpen,
  onClose,
  templates,
  initialData,
  defaultTypeId = 'premises-buildings',
  onSave,
  currentUser
}: Props) {
  const [activeTab, setActiveTab] = useState<'info' | 'items' | 'schedule' | 'attachments' | 'summary'>('items');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentUploadProgress, setAttachmentUploadProgress] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<HealthEnvInspection>>(() => {
    const today = getTodayJalaliDate();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const selectedTmpl = templates.find(t => t.id === defaultTypeId) || templates[0];

    const initialItems: HealthEnvChecklistInspectionItem[] = selectedTmpl
      ? selectedTmpl.defaultItems.map(di => ({
          itemId: di.id,
          title: di.title,
          category: di.category,
          requirement: di.requirement,
          standardRef: di.standardRef,
          verdict: null,
          comment: '',
          defectDescription: '',
          correctiveAction: '',
          responsiblePerson: '',
          dueDate: ''
        }))
      : [];

    return {
      checklistTypeId: defaultTypeId,
      checklistTypeNameFa: selectedTmpl ? selectedTmpl.titleFa : 'چک‌لیست اماکن و ساختمان‌ها',
      title: selectedTmpl ? `بازرسی ${selectedTmpl.titleFa} - ${today}` : `بازرسی بهداشت - ${today}`,
      inspectionDate: today,
      inspectionTime: timeStr,
      site: 'مجتمع مرکزی',
      unit: 'واحد بهداشت و محیط زیست',
      areaLocation: '',
      equipmentOrFacilityCode: '',
      inspectorName: currentUser?.fullName || currentUser?.name || 'کارشناس بهداشت',
      inspectorCode: currentUser?.personnelNumber || '',
      supervisorName: '',
      status: 'IN_PROGRESS',
      approvalStatus: 'PENDING_APPROVAL',
      items: initialItems,
      findingsSummary: '',
      immediateActionsTaken: '',
      recommendedCapa: '',
      photos: [],
      scheduleType: 'PERIODIC',
      periodicInterval: 'MONTHLY',
      nextInspectionDate: calculateNextInspectionDate(today, 'PERIODIC', 'MONTHLY'),
      attachments: []
    };
  });

  // Re-populate when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({ ...initialData });
      } else {
        const today = getTodayJalaliDate();
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const selectedTmpl = templates.find(t => t.id === defaultTypeId) || templates[0];
        
        const initialItems: HealthEnvChecklistInspectionItem[] = selectedTmpl
          ? selectedTmpl.defaultItems.map(di => ({
              itemId: di.id,
              title: di.title,
              category: di.category,
              requirement: di.requirement,
              standardRef: di.standardRef,
              verdict: null,
              comment: '',
              defectDescription: '',
              correctiveAction: '',
              responsiblePerson: '',
              dueDate: ''
            }))
          : [];

        setFormData({
          checklistTypeId: defaultTypeId,
          checklistTypeNameFa: selectedTmpl ? selectedTmpl.titleFa : 'چک‌لیست بهداشت',
          title: selectedTmpl ? `بازرسی ${selectedTmpl.titleFa} - ${today}` : `بازرسی بهداشت - ${today}`,
          inspectionDate: today,
          inspectionTime: timeStr,
          site: 'مجتمع مرکزی',
          unit: 'واحد بهداشت و محیط زیست',
          areaLocation: '',
          equipmentOrFacilityCode: '',
          inspectorName: currentUser?.fullName || currentUser?.name || 'کارشناس بهداشت',
          inspectorCode: currentUser?.personnelNumber || '',
          supervisorName: '',
          status: 'IN_PROGRESS',
          approvalStatus: 'PENDING_APPROVAL',
          items: initialItems,
          findingsSummary: '',
          immediateActionsTaken: '',
          recommendedCapa: '',
          photos: [],
          scheduleType: 'PERIODIC',
          periodicInterval: 'MONTHLY',
          nextInspectionDate: calculateNextInspectionDate(today, 'PERIODIC', 'MONTHLY'),
          attachments: []
        });
      }
      setActiveTab('items');
      setError(null);
    }
  }, [isOpen, initialData, defaultTypeId, templates, currentUser]);

  // Recalculate next due date whenever schedule or inspection date changes
  const handleScheduleChange = (
    newType: HealthEnvScheduleType, 
    newInterval?: HealthEnvPeriodicInterval
  ) => {
    const curInterval = newInterval || formData.periodicInterval || 'MONTHLY';
    const insDate = formData.inspectionDate || getTodayJalaliDate();
    let nextDate = '';
    if (newType === 'PERIODIC') {
      nextDate = calculateNextInspectionDate(insDate, 'PERIODIC', curInterval);
    }
    setFormData(prev => ({
      ...prev,
      scheduleType: newType,
      periodicInterval: curInterval,
      nextInspectionDate: nextDate
    }));
  };

  const handleInspectionDateChange = (newDate: string) => {
    const schType = formData.scheduleType || 'PERIODIC';
    const curInterval = formData.periodicInterval || 'MONTHLY';
    let nextDate = '';
    if (schType === 'PERIODIC' && newDate) {
      nextDate = calculateNextInspectionDate(newDate, 'PERIODIC', curInterval);
    }
    setFormData(prev => ({
      ...prev,
      inspectionDate: newDate,
      nextInspectionDate: nextDate
    }));
  };

  // Handle switching checklist type (only if not an existing inspection)
  const handleSwitchType = (typeId: HealthEnvChecklistType) => {
    if (initialData?.id) return;
    const targetTmpl = templates.find(t => t.id === typeId);
    if (!targetTmpl) return;

    const today = formData.inspectionDate || getTodayJalaliDate();
    const newItems: HealthEnvChecklistInspectionItem[] = targetTmpl.defaultItems.map(di => ({
      itemId: di.id,
      title: di.title,
      category: di.category,
      requirement: di.requirement,
      standardRef: di.standardRef,
      verdict: null,
      comment: '',
      defectDescription: '',
      correctiveAction: '',
      responsiblePerson: '',
      dueDate: ''
    }));

    setFormData(prev => ({
      ...prev,
      checklistTypeId: typeId,
      checklistTypeNameFa: targetTmpl.titleFa,
      title: `بازرسی ${targetTmpl.titleFa} - ${today}`,
      items: newItems
    }));
  };

  const handleVerdictChange = (itemIdx: number, verdict: HealthEnvChecklistItemVerdict) => {
    setFormData(prev => {
      const items = [...(prev.items || [])];
      const target = { ...items[itemIdx] };
      target.verdict = target.verdict === verdict ? null : verdict;
      items[itemIdx] = target;
      return { ...prev, items };
    });
  };

  const handleItemFieldChange = (itemIdx: number, field: keyof HealthEnvChecklistInspectionItem, val: string) => {
    setFormData(prev => {
      const items = [...(prev.items || [])];
      items[itemIdx] = { ...items[itemIdx], [field]: val };
      return { ...prev, items };
    });
  };

  const handleSelectInspector = (person: ComplexPersonnel | null, org: PersonnelOrgDetails) => {
    if (person) {
      setFormData(prev => ({
        ...prev,
        inspectorName: person.fullName,
        inspectorCode: person.personnelCode
      }));
    }
  };

  const handleSelectSupervisor = (person: ComplexPersonnel | null, org: PersonnelOrgDetails) => {
    if (person) {
      setFormData(prev => ({
        ...prev,
        supervisorName: person.fullName
      }));
    }
  };

  // Photo upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const newPhoto: SafetyAuditPhoto = {
          id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          url: reader.result as string,
          fileName: file.name,
          fileSize: `${Math.round(file.size / 1024)} KB`,
          uploadedAt: formData.inspectionDate || getTodayJalaliDate(),
          uploadedBy: formData.inspectorName
        };
        setFormData(prev => ({
          ...prev,
          photos: [...(prev.photos || []), newPhoto]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (photoId: string) => {
    setFormData(prev => ({
      ...prev,
      photos: (prev.photos || []).filter(p => p.id !== photoId)
    }));
  };

  // Attachment (PDF / Images / Docs) upload handler
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setAttachmentUploadProgress(true);
    const today = getTodayJalaliDate();

    Array.from(files).forEach(file => {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`فایل ${file.name} بیشتر از ۲۵ مگابایت است.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImg = file.type.startsWith('image/');
        const newAtt: HealthEnvAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          type: isImg ? 'image' : (isPdf ? 'pdf' : 'other'),
          mimeType: file.type || (isPdf ? 'application/pdf' : 'application/octet-stream'),
          size: file.size,
          dataUrl: reader.result as string,
          uploadedAt: today,
          uploadedBy: formData.inspectorName || currentUser?.fullName || 'کاربر سیستم'
        };

        setFormData(prev => ({
          ...prev,
          attachments: [...(prev.attachments || []), newAtt]
        }));
      };
      reader.readAsDataURL(file);
    });

    setAttachmentUploadProgress(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (attId: string) => {
    setFormData(prev => ({
      ...prev,
      attachments: (prev.attachments || []).filter(a => a.id !== attId)
    }));
  };

  // Quick stats calculation
  const items = formData.items || [];
  const passedCount = items.filter(i => i.verdict === 'pass').length;
  const failedCount = items.filter(i => i.verdict === 'fail').length;
  const naCount = items.filter(i => i.verdict === 'na').length;
  const effectiveTotal = items.length - naCount;
  const scorePercent = effectiveTotal > 0 ? Math.round((passedCount / effectiveTotal) * 100) : 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title?.trim()) {
      setError('عنوان بازرسی الزامی است.');
      setActiveTab('info');
      return;
    }
    if (!formData.areaLocation?.trim()) {
      setError('موقعیت / نام محل یا ساختمان الزامی است.');
      setActiveTab('info');
      return;
    }
    if (!formData.inspectorName?.trim()) {
      setError('نام بازرس الزامی است.');
      setActiveTab('info');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'خطا در ثبت و ذخیره چک‌لیست بازرسی در پایگاه داده');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sites = getOrgSites();
  const units = getUnits();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4" dir="rtl">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Topbar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center border border-teal-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {initialData?.id ? 'ویرایش چک‌لیست بازرسی بهداشت' : 'ثبت چک‌لیست جدید بازرسی بهداشت و محیط زیست'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {formData.checklistTypeNameFa} | ذخیره‌سازی داده‌ها در سرور و پایگاه داده مرکزی
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template Selector (only for new inspections) */}
        {!initialData?.id && (
          <div className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">نوع بازرسی:</span>
            {templates.map(tmpl => {
              const active = formData.checklistTypeId === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleSwitchType(tmpl.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-teal-50 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span>{tmpl.titleFa}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Modal Tabs Navigation Bar */}
        <div className="px-6 pt-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('items')}
              className={`px-4 py-2.5 font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'items'
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              <span>۱. چک‌لیست ارزیابی</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-mono">
                {items.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`px-4 py-2.5 font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'schedule'
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>۲. زمان‌بندی و تناوب</span>
              {formData.scheduleType === 'PERIODIC' && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-100 dark:bg-teal-900/50 text-teal-700 font-bold">
                  دوره‌ای
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`px-4 py-2.5 font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'info'
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              <span>۳. مشخصات و مسئولان</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('attachments')}
              className={`px-4 py-2.5 font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'attachments'
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>۴. پیوست‌ها و فایل‌ها</span>
              {(formData.attachments?.length || 0) > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 font-mono font-bold">
                  {formData.attachments?.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2.5 font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'summary'
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              <span>۵. جمع‌بندی، CAPA و تصاویر</span>
              {(formData.photos?.length || 0) > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-mono">
                  {formData.photos?.length} عکس
                </span>
              )}
            </button>
          </div>

          {/* Quick Score Badge in Topbar */}
          <div className="flex items-center gap-3 py-1 font-mono text-xs">
            <span className="text-emerald-600 font-bold">{passedCount} مطلوب</span>
            <span className="text-rose-600 font-bold">{failedCount} نامطلوب</span>
            <span className={`px-2.5 py-1 rounded-xl font-black text-xs ${
              scorePercent >= 80 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60' :
              scorePercent >= 60 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60' :
              'bg-rose-50 text-rose-700 dark:bg-rose-950/60'
            }`}>
              انطباق: {scorePercent}%
            </span>
          </div>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: CHECKLIST ITEMS */}
          {activeTab === 'items' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  برای هر مورد وضعیت انطباق را تعیین کنید. در صورت ثبت «نامطلوب»، کادر درج نقص و اقدام اصلاحی فعال می‌گردد.
                </span>
                <div className="text-[11px] text-slate-400">
                  کل موارد: {items.length}
                </div>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => {
                  const isFail = item.verdict === 'fail';
                  return (
                    <div
                      key={item.itemId || idx}
                      className={`p-4 rounded-2xl border transition ${
                        isFail
                          ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/10'
                          : item.verdict === 'pass'
                          ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/10'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {item.category}
                            </span>
                            {item.standardRef && (
                              <span className="text-[9px] font-mono text-teal-600 dark:text-teal-400">
                                {item.standardRef}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white pr-7">
                            {item.title}
                          </h4>
                          {item.requirement && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 pr-7 leading-relaxed">
                              الزام: {item.requirement}
                            </p>
                          )}
                        </div>

                        {/* Verdict Toggle Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleVerdictChange(idx, 'pass')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                              item.verdict === 'pass'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>مطلوب</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleVerdictChange(idx, 'fail')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                              item.verdict === 'fail'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>نامطلوب</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleVerdictChange(idx, 'na')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                              item.verdict === 'na'
                                ? 'bg-slate-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            <MinusCircle className="w-3.5 h-3.5" />
                            <span>نامرتبط</span>
                          </button>
                        </div>
                      </div>

                      {/* Defect & CAPA form (expanded when FAIL) */}
                      {isFail && (
                        <div className="mt-3 pt-3 border-t border-rose-200 dark:border-rose-900/60 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-rose-800 dark:text-rose-300">
                              شرح نقص مشاهده‌شده:
                            </label>
                            <input
                              type="text"
                              value={item.defectDescription || ''}
                              onChange={e => handleItemFieldChange(idx, 'defectDescription', e.target.value)}
                              placeholder="عدم رعایت نظافت، خرابی سیستم تهویه، شکستگی کاشی..."
                              className="w-full px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-rose-500/30"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              اقدام اصلاحی لازم (CAPA):
                            </label>
                            <input
                              type="text"
                              value={item.correctiveAction || ''}
                              onChange={e => handleItemFieldChange(idx, 'correctiveAction', e.target.value)}
                              placeholder="ضدعفونی فوری، تعمیر فن، تعویض سطل زباله..."
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-teal-500/30"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              مسئول پیگیری رفع نقص:
                            </label>
                            <input
                              type="text"
                              value={item.responsiblePerson || ''}
                              onChange={e => handleItemFieldChange(idx, 'responsiblePerson', e.target.value)}
                              placeholder="نام مسئول واحد / پیمانکار خدمات..."
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-teal-500/30"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              مهلت رفع نقص (تاریخ شمسی):
                            </label>
                            <input
                              type="text"
                              value={item.dueDate || ''}
                              onChange={e => handleItemFieldChange(idx, 'dueDate', e.target.value)}
                              placeholder="مثال: 1404/08/01"
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-mono focus:ring-2 focus:ring-teal-500/30"
                            />
                          </div>
                        </div>
                      )}

                      {/* Optional Notes for Pass or N/A */}
                      {!isFail && (
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <input
                            type="text"
                            value={item.comment || ''}
                            onChange={e => handleItemFieldChange(idx, 'comment', e.target.value)}
                            placeholder="توضیحات و مشاهدات تکمیلی (اختیاری)..."
                            className="w-full px-3 py-1 text-[11px] rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-teal-500 bg-transparent text-slate-600 dark:text-slate-300"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: SCHEDULE & TIMING (زمان‌بندی چک‌لیست‌ها: دوره‌ای یا موردی) */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Repeat className="w-5 h-5 text-teal-600" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    تنظیم الگوی زمان‌بندی و تناوب اجرای چک‌لیست
                  </h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  تعیین کنید آیا این چک‌لیست دارای تکرار دوره‌ای مشخص (روزانه، ماهانه، فصلی، سالانه) است و یا به صورت موردی (بر اساس نیاز و وقوع رخداد) اجرا می‌گردد.
                </p>

                {/* Schedule Type Selection: Periodic vs Ad-Hoc */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div 
                    onClick={() => handleScheduleChange('PERIODIC')}
                    className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
                      formData.scheduleType === 'PERIODIC'
                        ? 'border-teal-600 bg-teal-50/50 dark:bg-teal-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-teal-300'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="scheduleType" 
                      checked={formData.scheduleType === 'PERIODIC'} 
                      onChange={() => handleScheduleChange('PERIODIC')} 
                      className="mt-1 text-teal-600 focus:ring-teal-500"
                    />
                    <div className="space-y-1">
                      <strong className="text-xs font-black text-slate-900 dark:text-white block">
                        چک‌لیست دوره‌ای (دارای سررسید منظم)
                      </strong>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        دارای دوره‌های زمانی مشخص؛ سیستم به صورت خودکار موعد بعدی بازرسی را محاسبه نموده و وضعیت سررسید را نمایش می‌دهد.
                      </p>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleScheduleChange('ADHOC')}
                    className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
                      formData.scheduleType === 'ADHOC'
                        ? 'border-teal-600 bg-teal-50/50 dark:bg-teal-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-teal-300'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="scheduleType" 
                      checked={formData.scheduleType === 'ADHOC'} 
                      onChange={() => handleScheduleChange('ADHOC')} 
                      className="mt-1 text-teal-600 focus:ring-teal-500"
                    />
                    <div className="space-y-1">
                      <strong className="text-xs font-black text-slate-900 dark:text-white block">
                        چک‌لیست موردی (Ad-Hoc / بر حسب نیاز)
                      </strong>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        اجرا بر اساس درخواست، ممیزی اتفاقی، تعمیرات یا تغییر شرایط، بدون الزام تکرار دوره‌ای و فاقد موعد سررسید بعدی.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Periodic Intervals Selection */}
                {formData.scheduleType === 'PERIODIC' && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      دوره تناوب تکرار بازرسی:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { key: 'DAILY', label: 'روزانه (Daily)' },
                        { key: 'MONTHLY', label: 'ماهانه (Monthly)' },
                        { key: 'QUARTERLY', label: 'سه‌ماهه (فصلی)' },
                        { key: 'SEMI_ANNUAL', label: 'شش‌ماهه' },
                        { key: 'ANNUAL', label: 'سالانه (Annual)' }
                      ].map(interval => (
                        <button
                          key={interval.key}
                          type="button"
                          onClick={() => handleScheduleChange('PERIODIC', interval.key as HealthEnvPeriodicInterval)}
                          className={`p-2.5 rounded-xl text-xs font-bold transition text-center border cursor-pointer ${
                            formData.periodicInterval === interval.key
                              ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-teal-300'
                          }`}
                        >
                          {interval.label}
                        </button>
                      ))}
                    </div>

                    {/* Next Due Date Calculated Display */}
                    <div className="mt-4 p-3.5 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-200 dark:border-teal-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 font-bold">
                        <Calendar className="w-4 h-4 text-teal-600" />
                        <span>تاریخ موعد بعدی بازرسی (محاسبه خودکار):</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={formData.nextInspectionDate || ''}
                          onChange={e => setFormData(prev => ({ ...prev, nextInspectionDate: e.target.value }))}
                          placeholder="مثال: 1404/08/15"
                          className="px-3 py-1 font-mono font-bold text-center rounded-lg border border-teal-300 bg-white text-teal-900 text-xs"
                        />
                        <span className="text-[11px] text-teal-600">هجری شمسی</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: BASIC INFO & OFFICIALS */}
          {activeTab === 'info' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    عنوان رسمی بازرسی <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="مثال: بازرسی بهداشت محیط ساختمان اداری مرکزی..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold focus:ring-2 focus:ring-teal-500/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    تاریخ بازرسی (شمسی) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.inspectionDate || ''}
                    onChange={e => handleInspectionDateChange(e.target.value)}
                    placeholder="1404/07/15"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-mono focus:ring-2 focus:ring-teal-500/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    ساعت بازرسی
                  </label>
                  <input
                    type="text"
                    value={formData.inspectionTime || ''}
                    onChange={e => setFormData(prev => ({ ...prev, inspectionTime: e.target.value }))}
                    placeholder="10:30"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-mono focus:ring-2 focus:ring-teal-500/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    سایت / محل مجتمع
                  </label>
                  <select
                    value={formData.site || ''}
                    onChange={e => setFormData(prev => ({ ...prev, site: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-teal-500/30"
                  >
                    {sites.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    واحد / اداره
                  </label>
                  <select
                    value={formData.unit || ''}
                    onChange={e => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-teal-500/30"
                  >
                    {units.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    موقعیت دقیق / نام ساختمان یا پلاک <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.areaLocation || ''}
                    onChange={e => setFormData(prev => ({ ...prev, areaLocation: e.target.value }))}
                    placeholder="مثال: ساختمان مهندسی، طبقه اول، آشپزخانه غربی"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-teal-500/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    شناسه محل / پلاک آمبولانس / کد تسهیلات
                  </label>
                  <input
                    type="text"
                    value={formData.equipmentOrFacilityCode || ''}
                    onChange={e => setFormData(prev => ({ ...prev, equipmentOrFacilityCode: e.target.value }))}
                    placeholder="مثال: BLD-04 یا 12-ب-345"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-mono focus:ring-2 focus:ring-teal-500/30"
                  />
                </div>
              </div>

              {/* Responsible Personnel Selection - 3-Tier Unified Standard */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <Checklist3TierSignatures
                  isFa={true}
                  formData={{
                    inspectorName: formData.inspectorName,
                    inspectorCode: formData.inspectorCode,
                    supervisorName: formData.supervisorName,
                    supervisorCode: formData.supervisorCode,
                    hseManagerName: formData.hseManagerName,
                    hseManagerCode: formData.hseManagerCode
                  }}
                  onChange={(updated) => {
                    setFormData(prev => ({
                      ...prev,
                      ...updated
                    }));
                  }}
                  tier1Title="کارشناس / نماینده بهداشت و محیط زیست"
                  tier1Subtitle="بازرس و ثبت‌کننده میدانی"
                  tier2Title="سرپرست / مسئول واحد"
                  tier2Subtitle="مسئول هماهنگی و رفع نقص"
                  tier3Title="رئیس مرکز HSE"
                  tier3Subtitle="تأیید و تصویب نهایی"
                />
              </div>
            </div>
          )}

          {/* TAB 4: ATTACHMENTS (پیوست فایل: تصاویر، PDF و اسناد با حفظ در پایگاه داده) */}
          {activeTab === 'attachments' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-teal-600" />
                    <span>پیوست اسناد، گزارش‌ها و فایل‌های PDF / تصاویر</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    امکان بارگذاری، مشاهده و دانلود فایل‌های PDF و تصاویر برای هر چک‌لیست (حداکثر ۲۵ مگابایت به ازای هر فایل)
                  </p>
                </div>
                <div>
                  <label className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1.5 shadow-sm">
                    <Upload className="w-4 h-4" />
                    <span>بارگذاری فایل جدید</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,image/*,.doc,.docx"
                      multiple
                      onChange={handleAttachmentUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Attachments List */}
              {formData.attachments && formData.attachments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {formData.attachments.map((att) => {
                    const isPdf = att.type === 'pdf' || att.name.toLowerCase().endsWith('.pdf');
                    return (
                      <div 
                        key={att.id}
                        className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isPdf 
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' 
                              : 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400'
                          }`}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={att.name}>
                              {att.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                              <span>{Math.round(att.size / 1024)} KB</span>
                              <span>•</span>
                              <span>{att.uploadedAt}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {att.dataUrl && (
                            <a
                              href={att.dataUrl}
                              download={att.name}
                              className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/40 transition"
                              title="دانلود فایل"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(att.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="حذف پیوست"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
                  <Paperclip className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>هنوز فایلی ضمیمه این چک‌لیست نشده است.</p>
                  <p className="text-[10px] text-slate-400">
                    می‌توانید تفاهم‌نامه‌ها، نتایج آزمایشگاهی، فایل‌های PDF دستورالعمل و تصاویر وضعیت را پیوست کنید.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SUMMARY, CAPA & PHOTOS */}
          {activeTab === 'summary' && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  خلاصه مشاهدات و ارزیابی کلی بازرسی
                </label>
                <textarea
                  rows={3}
                  value={formData.findingsSummary || ''}
                  onChange={e => setFormData(prev => ({ ...prev, findingsSummary: e.target.value }))}
                  placeholder="مشاهدات عمومی از شرایط بهداشتی، تهویه، نظافت و انطباق استانداردها..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-teal-500/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  اقدامات فوری انجام‌شده در حین بازدید
                </label>
                <textarea
                  rows={2}
                  value={formData.immediateActionsTaken || ''}
                  onChange={e => setFormData(prev => ({ ...prev, immediateActionsTaken: e.target.value }))}
                  placeholder="تذکرات شفاهی داده‌شده، جمع‌آوری اقلام غیراستاندارد، ضدعفونی در محل..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-teal-500/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  توصیه‌های کلان و برنامه اقدامات اصلاحی پیشگیرانه (CAPA)
                </label>
                <textarea
                  rows={2}
                  value={formData.recommendedCapa || ''}
                  onChange={e => setFormData(prev => ({ ...prev, recommendedCapa: e.target.value }))}
                  placeholder="پیشنهادات ارتقای تسهیلات بهداشتی، سرویس‌های دوره‌ای، پیگیری خرید تجهیزات..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-teal-500/30"
                />
              </div>

              {/* Photos upload gallery */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-teal-600" />
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      مستندات تصویری و عکس‌های بازدید
                    </h3>
                  </div>
                  <label className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1.5 shadow-xs">
                    <Camera className="w-3.5 h-3.5" />
                    <span>بارگذاری تصویر</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {formData.photos && formData.photos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    {formData.photos.map(p => (
                      <div key={p.id} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black aspect-video flex items-center justify-center">
                        <img src={p.url} alt={p.fileName} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(p.id)}
                          className="absolute top-1 left-1 p-1 bg-rose-600 text-white rounded-lg opacity-90 hover:opacity-100 transition cursor-pointer"
                          title="حذف عکس"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1 text-[9px] text-white truncate text-center font-mono">
                          {p.fileName || 'تصویر'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    هنوز تصویری ضمیمه این بازرسی نشده است. می‌توانید عکس‌های نواقص یا وضعیت محل را بارگذاری کنید.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Save & Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>ذخیره‌سازی اطلاعات به صورت امن و پایدار در پایگاه داده انجام خواهد شد.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-md shadow-teal-600/30"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'در حال ثبت در پایگاه داده...' : 'ثبت و نهایی‌سازی بازرسی'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
