import React, { useState, useEffect } from 'react';
import { 
  X, Check, AlertTriangle, CheckCircle2, MinusCircle, 
  Calendar, Clock, MapPin, User, ShieldCheck, Camera, 
  FileText, Plus, Trash2, AlertCircle, Save, Paperclip, 
  Upload, Download, Eye, Repeat, RotateCw, Sparkles, RefreshCw,
  Truck, Scale, Link2, CheckSquare, Layers, GitBranch, Bell
} from 'lucide-react';
import { 
  OperationalSafetyInspection, 
  SafetyChecklistTypeTemplate, 
  SafetyChecklistInspectionItem,
  ChecklistItemVerdict,
  SafetyAuditPhoto
} from '../types';
import ChecklistPersonnelSignatures from './ChecklistPersonnelSignatures';
import SafetyPhotoAttachmentSection from './SafetyPhotoAttachmentSection';
import SafetyItemPhotoModal from './SafetyItemPhotoModal';
import SafetyPhotoLightboxModal from './SafetyPhotoLightboxModal';
import { getOrgSites, getUnits } from '../../../utils/orgHelper';
import { 
  UnifiedInspectionTimingType, 
  PeriodicIntervalType,
  PERIODIC_INTERVAL_OPTIONS,
  INSPECTION_TIMING_OPTIONS,
  calculateNextInspectionDate,
  getPeriodicIntervalLabel,
  getTodayJalaliDate,
  isMachineryChecklist,
  getMachineryCategory
} from '../../../utils/inspectionScheduleHelper';
import { useFinalSubmit } from '../../../context/FinalSubmitContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  templates: SafetyChecklistTypeTemplate[];
  initialData?: OperationalSafetyInspection | null;
  defaultTemplateId?: string;
  isReinspectionMode?: boolean;
  reinspectSourceInspection?: OperationalSafetyInspection | null;
  onSave: (inspection: Partial<OperationalSafetyInspection>) => Promise<any> | void;
  currentUser?: any;
  isFa?: boolean;
}

export default function SafetyChecklistFormModal({
  isOpen,
  onClose,
  templates,
  initialData,
  defaultTemplateId,
  isReinspectionMode = false,
  reinspectSourceInspection,
  onSave,
  currentUser,
  isFa = true
}: Props) {
  const { confirmFinalSubmit } = useFinalSubmit();
  const [activeTab, setActiveTab] = useState<'info' | 'items' | 'photos' | 'summary'>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active templates list
  const activeTemplates = templates.filter(t => t.isActive !== false);
  const effectiveTemplates = activeTemplates.length > 0 ? activeTemplates : templates;

  // Selected template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    if (initialData?.checklistTypeId) return initialData.checklistTypeId;
    if (reinspectSourceInspection?.checklistTypeId) return reinspectSourceInspection.checklistTypeId;
    if (defaultTemplateId) return defaultTemplateId;
    return effectiveTemplates[0]?.id || 'scaffolding';
  });

  // Basic Form States
  const [formTitle, setFormTitle] = useState('');
  const [formInspectionType, setFormInspectionType] = useState<UnifiedInspectionTimingType>('PERIODIC');
  const [formPeriodicInterval, setFormPeriodicInterval] = useState<PeriodicIntervalType>('MONTHLY');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formNextInspectionDate, setFormNextInspectionDate] = useState('');
  const [isNextDateManual, setIsNextDateManual] = useState(false);
  const [formRelatedOperationId, setFormRelatedOperationId] = useState('');
  const [formRelatedOperationTitle, setFormRelatedOperationTitle] = useState('');
  const [formSite, setFormSite] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formArea, setFormArea] = useState('');
  const [formPermitNumber, setFormPermitNumber] = useState('');
  const [formInspectorName, setFormInspectorName] = useState('');
  const [formInspectorCode, setFormInspectorCode] = useState('');
  const [formSupervisorName, setFormSupervisorName] = useState('');
  const [formSupervisorCode, setFormSupervisorCode] = useState('');
  const [formHseManagerName, setFormHseManagerName] = useState('');
  const [formHseManagerCode, setFormHseManagerCode] = useState('');
  const [formContractorName, setFormContractorName] = useState('');

  // Machinery States
  const [formMachineryType, setFormMachineryType] = useState('');
  const [formMachinerySpecs, setFormMachinerySpecs] = useState('');
  const [formMachineryTonnage, setFormMachineryTonnage] = useState('');
  const [formMachineryTagNumber, setFormMachineryTagNumber] = useState('');

  // Checklist Items State
  const [formItems, setFormItems] = useState<SafetyChecklistInspectionItem[]>([]);

  // Photos & Summary States
  const [formPhotos, setFormPhotos] = useState<SafetyAuditPhoto[]>([]);
  const [formFindings, setFormFindings] = useState('');
  const [formImmediateActions, setFormImmediateActions] = useState('');
  const [formRecommendedCapa, setFormRecommendedCapa] = useState('');

  // Item Photo Modal State
  const [activeItemForPhotoModal, setActiveItemForPhotoModal] = useState<{
    item: SafetyChecklistInspectionItem;
    index: number;
  } | null>(null);

  // Lightbox Photo State
  const [lightboxPhoto, setLightboxPhoto] = useState<SafetyAuditPhoto | null>(null);

  // Personnel Selector Modals
  const [isInspectorSelectorOpen, setIsInspectorSelectorOpen] = useState(false);
  const [isSupervisorSelectorOpen, setIsSupervisorSelectorOpen] = useState(false);
  const [activeItemRespSelectorIdx, setActiveItemRespSelectorIdx] = useState<number | null>(null);

  // Org Structure data
  const availableSites = getOrgSites() || [];
  const availableUnits = getUnits() || [];

  // Helper to build initial items from template
  const buildItemsFromTemplate = (templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId) || templates[0];
    if (!tmpl || !tmpl.defaultItems) return [];
    return tmpl.defaultItems.map(di => ({
      itemId: di.id,
      title: di.title,
      category: di.category,
      requirement: di.requirement,
      standardRef: di.standardRef,
      verdict: null as ChecklistItemVerdict,
      comment: '',
      defectDescription: '',
      correctiveAction: '',
      responsiblePerson: '',
      dueDate: '',
      riskLevel: 'LOW' as const,
      photos: []
    }));
  };

  // Populate data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const today = getTodayJalaliDate();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (isReinspectionMode && reinspectSourceInspection) {
      // Re-inspection mode: initialize with prior record context and fresh items carrying prior notes
      setSelectedTemplateId(reinspectSourceInspection.checklistTypeId);
      const nextCycle = (reinspectSourceInspection.reinspectionCycle || 1) + 1;
      setFormTitle(`بازرسی دوره‌ای جدید - ${reinspectSourceInspection.checklistTypeNameFa} (نوبت ${nextCycle})`);
      setFormInspectionType('PERIODIC');
      const interval = reinspectSourceInspection.periodicInterval || 'MONTHLY';
      setFormPeriodicInterval(interval);
      setFormDate(today);
      setFormTime(timeStr);
      setFormNextInspectionDate(calculateNextInspectionDate(today, 'PERIODIC', interval));
      setIsNextDateManual(false);
      setFormSite(reinspectSourceInspection.site || availableSites[0] || 'مجتمع مرکزی');
      setFormUnit(reinspectSourceInspection.unit || availableUnits[0] || 'عملیات');
      setFormArea(reinspectSourceInspection.areaLocation || '');
      setFormPermitNumber(reinspectSourceInspection.permitNumber || '');
      setFormInspectorName(currentUser?.fullName || currentUser?.name || 'کارشناس ایمنی');
      setFormInspectorCode(currentUser?.personnelNumber || '');
      setFormSupervisorName(reinspectSourceInspection.supervisorName || '');
      setFormHseManagerName(reinspectSourceInspection.hseManagerName || '');
      setFormContractorName(reinspectSourceInspection.contractorName || '');
      setFormMachineryType(reinspectSourceInspection.machineryType || '');
      setFormMachinerySpecs(reinspectSourceInspection.machinerySpecs || '');
      setFormMachineryTonnage(reinspectSourceInspection.machineryTonnage || '');
      setFormMachineryTagNumber(reinspectSourceInspection.machineryTagNumber || '');
      
      // Items carrying over previous failures for comparison
      const cleanItems = (reinspectSourceInspection.items || []).map(it => ({
        itemId: it.itemId,
        title: it.title,
        category: it.category,
        requirement: it.requirement,
        standardRef: it.standardRef,
        verdict: 'pass' as ChecklistItemVerdict,
        comment: '',
        defectDescription: '',
        correctiveAction: '',
        responsiblePerson: '',
        dueDate: '',
        riskLevel: 'LOW' as const,
        previousVerdict: it.verdict,
        previousComment: it.comment || it.defectDescription,
        photos: []
      }));
      setFormItems(cleanItems);
      setFormPhotos([]);
      setFormFindings('');
      setFormImmediateActions('');
      setFormRecommendedCapa('');
      setActiveTab('info');
    } else if (initialData) {
      // Edit mode: populate existing inspection record
      setSelectedTemplateId(initialData.checklistTypeId);
      setFormTitle(initialData.title);
      setFormInspectionType(initialData.inspectionType || 'PERIODIC');
      setFormPeriodicInterval(initialData.periodicInterval || 'MONTHLY');
      setFormDate(initialData.inspectionDate);
      setFormTime(initialData.inspectionTime || timeStr);
      setFormNextInspectionDate(initialData.nextInspectionDate || '');
      setIsNextDateManual(Boolean(initialData.nextInspectionDate));
      setFormRelatedOperationId(initialData.relatedOperationId || '');
      setFormRelatedOperationTitle(initialData.relatedOperationTitle || '');
      setFormSite(initialData.site);
      setFormUnit(initialData.unit);
      setFormArea(initialData.areaLocation || '');
      setFormPermitNumber(initialData.permitNumber || '');
      setFormInspectorName(initialData.inspectorName);
      setFormInspectorCode(initialData.inspectorCode || '');
      setFormSupervisorName(initialData.supervisorName || '');
      setFormSupervisorCode(initialData.supervisorCode || '');
      setFormHseManagerName(initialData.hseManagerName || '');
      setFormHseManagerCode(initialData.hseManagerCode || '');
      setFormContractorName(initialData.contractorName || '');
      setFormMachineryType(initialData.machineryType || '');
      setFormMachinerySpecs(initialData.machinerySpecs || '');
      setFormMachineryTonnage(initialData.machineryTonnage || '');
      setFormMachineryTagNumber(initialData.machineryTagNumber || '');
      setFormItems(initialData.items || []);
      setFormPhotos(initialData.photos || []);
      setFormFindings(initialData.findingsSummary || '');
      setFormImmediateActions(initialData.immediateActionsTaken || '');
      setFormRecommendedCapa(initialData.recommendedCapa || '');
      setActiveTab('info');
    } else {
      // Create new inspection
      const initialTmplId = defaultTemplateId || effectiveTemplates[0]?.id || 'scaffolding';
      setSelectedTemplateId(initialTmplId);
      const tmpl = templates.find(t => t.id === initialTmplId) || templates[0];
      setFormTitle(tmpl ? `بازرسی ${tmpl.titleFa} - ${today}` : `بازرسی ایمنی - ${today}`);
      setFormInspectionType('PERIODIC');
      setFormPeriodicInterval('MONTHLY');
      setFormDate(today);
      setFormTime(timeStr);
      setFormNextInspectionDate(calculateNextInspectionDate(today, 'PERIODIC', 'MONTHLY'));
      setIsNextDateManual(false);
      setFormRelatedOperationId('');
      setFormRelatedOperationTitle('');
      setFormSite(availableSites[0] || 'مجتمع اصلی');
      setFormUnit(availableUnits[0] || 'عملیات');
      setFormArea('');
      setFormPermitNumber('');
      setFormInspectorName(currentUser?.fullName || currentUser?.name || 'کارشناس ایمنی');
      setFormInspectorCode(currentUser?.personnelNumber || '');
      setFormSupervisorName('');
      setFormSupervisorCode('');
      setFormHseManagerName('');
      setFormHseManagerCode('');
      setFormContractorName('');
      setFormMachineryType('');
      setFormMachinerySpecs('');
      setFormMachineryTonnage('');
      setFormMachineryTagNumber('');
      setFormItems(buildItemsFromTemplate(initialTmplId));
      setFormPhotos([]);
      setFormFindings('');
      setFormImmediateActions('');
      setFormRecommendedCapa('');
      setActiveTab('info');
    }
  }, [isOpen, initialData, defaultTemplateId, isReinspectionMode, reinspectSourceInspection]);

  // Handle template selection change in form
  const handleTemplateChange = (newTmplId: string) => {
    setSelectedTemplateId(newTmplId);
    const tmpl = templates.find(t => t.id === newTmplId);
    if (!initialData && !isReinspectionMode) {
      if (tmpl) {
        setFormTitle(`بازرسی ${tmpl.titleFa} - ${formDate || getTodayJalaliDate()}`);
      }
      setFormItems(buildItemsFromTemplate(newTmplId));
    }
  };

  // Handle Inspection Type change
  const handleInspectionTypeChange = (newType: UnifiedInspectionTimingType) => {
    setFormInspectionType(newType);
    if (newType === 'PERIODIC') {
      const actualDate = formDate || getTodayJalaliDate();
      setFormNextInspectionDate(calculateNextInspectionDate(actualDate, 'PERIODIC', formPeriodicInterval));
    } else {
      setFormNextInspectionDate('');
    }
  };

  // Handle Periodic Interval change
  const handlePeriodicIntervalChange = (newInterval: PeriodicIntervalType) => {
    setFormPeriodicInterval(newInterval);
    const actualDate = formDate || getTodayJalaliDate();
    setFormNextInspectionDate(calculateNextInspectionDate(actualDate, 'PERIODIC', newInterval));
    setIsNextDateManual(false);
  };

  // Handle Date change
  const handleDateChange = (newDate: string) => {
    setFormDate(newDate);
    if (formInspectionType === 'PERIODIC' && !isNextDateManual && newDate.length >= 10) {
      setFormNextInspectionDate(calculateNextInspectionDate(newDate, 'PERIODIC', formPeriodicInterval));
    }
  };

  // Recalculate next inspection date
  const handleAutoRecalculateNextDate = () => {
    const actualDate = formDate || getTodayJalaliDate();
    const calculated = calculateNextInspectionDate(actualDate, 'PERIODIC', formPeriodicInterval);
    setFormNextInspectionDate(calculated);
    setIsNextDateManual(false);
  };

  // Item modifications
  const handleItemVerdictChange = (index: number, verdict: ChecklistItemVerdict) => {
    setFormItems(prev => {
      const updated = [...prev];
      updated[index] = { 
        ...updated[index], 
        verdict,
        correctiveActionRequired: verdict === 'fail'
      };
      return updated;
    });
  };

  const handleItemFieldChange = (index: number, field: keyof SafetyChecklistInspectionItem, value: any) => {
    setFormItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Scores calculation
  const totalItemsCount = formItems.length;
  const passedCount = formItems.filter(i => i.verdict === 'pass').length;
  const failedCount = formItems.filter(i => i.verdict === 'fail').length;
  const warningCount = formItems.filter(i => i.verdict === 'warning').length;
  const naCount = formItems.filter(i => i.verdict === 'na').length;
  const effectiveTotal = totalItemsCount - naCount;
  const scorePercent = effectiveTotal > 0 ? Math.round((passedCount / effectiveTotal) * 100) : 100;

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setError('عنوان بازرسی الزامی است.');
      return;
    }
    if (!formSite.trim()) {
      setError('انتخاب سایت مجتمع الزامی است.');
      return;
    }

    const currentTmpl = templates.find(t => t.id === selectedTemplateId);
    const tmplNameFa = currentTmpl ? currentTmpl.titleFa : 'چک‌لیست ایمنی';

    const payload: Partial<OperationalSafetyInspection> = {
      ...(initialData || {}),
      checklistTypeId: selectedTemplateId,
      checklistTypeNameFa: tmplNameFa,
      title: formTitle.trim(),
      inspectionType: formInspectionType,
      periodicInterval: formInspectionType === 'PERIODIC' ? formPeriodicInterval : undefined,
      inspectionDate: formDate,
      inspectionTime: formTime,
      nextInspectionDate: formNextInspectionDate ? formNextInspectionDate.trim() : undefined,
      relatedOperationId: formRelatedOperationId.trim() || undefined,
      relatedOperationTitle: formRelatedOperationTitle.trim() || undefined,
      site: formSite,
      unit: formUnit,
      areaLocation: formArea.trim(),
      permitNumber: formPermitNumber.trim() || undefined,
      inspectorName: formInspectorName.trim(),
      inspectorCode: formInspectorCode.trim() || undefined,
      supervisorName: formSupervisorName.trim() || undefined,
      supervisorCode: formSupervisorCode.trim() || undefined,
      hseManagerName: formHseManagerName.trim() || undefined,
      hseManagerCode: formHseManagerCode.trim() || undefined,
      contractorName: formContractorName.trim() || undefined,
      machineryType: formMachineryType.trim() || undefined,
      machinerySpecs: formMachinerySpecs.trim() || undefined,
      machineryTonnage: formMachineryTonnage.trim() || undefined,
      machineryTagNumber: formMachineryTagNumber.trim() || undefined,
      items: formItems,
      photos: formPhotos,
      findingsSummary: formFindings.trim(),
      immediateActionsTaken: formImmediateActions.trim(),
      recommendedCapa: formRecommendedCapa.trim(),
      scorePercent,
      totalItems: totalItemsCount,
      passedCount,
      failedCount,
      warningCount,
      naCount,
      status: failedCount > 0 ? 'ACTION_REQUIRED' : 'COMPLETED'
    };

    if (isReinspectionMode && reinspectSourceInspection) {
      payload.isReinspection = true;
      payload.previousInspectionId = reinspectSourceInspection.id;
      payload.rootInspectionId = reinspectSourceInspection.rootInspectionId || reinspectSourceInspection.id;
      payload.reinspectionCycle = (reinspectSourceInspection.reinspectionCycle || 1) + 1;
      payload.reinspectionNotes = `بازرسی دوره‌ای جدید نوبت ${(reinspectSourceInspection.reinspectionCycle || 1) + 1} پیرو سابقه ${reinspectSourceInspection.id}`;
    }

    const executeSave = async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        await onSave(payload);
        onClose();
      } catch (err: any) {
        setError(err?.message || 'خطا در ذخیره‌سازی چک‌لیست ایمنی.');
      } finally {
        setIsSubmitting(false);
      }
    };

    confirmFinalSubmit({
      title: isReinspectionMode ? 'تأیید ثبت نوبت جدید بازرسی' : initialData ? 'تأیید ویرایش بازرسی' : 'تأیید ثبت نهایی بازرسی ایمنی',
      message: `آیا از ثبت نهایی اطلاعات این بازرسی با نمره انطباق ${scorePercent}٪ و ${failedCount} مورد عدم انطباق اطمینان دارید؟`,
      onConfirm: executeSave
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className={`p-5 border-b flex items-center justify-between shrink-0 ${
          isReinspectionMode 
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60' 
            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl text-white ${isReinspectionMode ? 'bg-amber-600' : 'bg-blue-600'}`}>
              {isReinspectionMode ? <RotateCw className="w-5 h-5" /> : <CheckSquare className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h2 className="font-black text-slate-800 dark:text-white text-base flex items-center gap-2">
                {isReinspectionMode ? (
                  <>
                    <span>ثبت بازرسی دوره‌ای جدید (نوبت {(reinspectSourceInspection?.reinspectionCycle || 1) + 1})</span>
                    {reinspectSourceInspection && (
                      <span className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 font-mono text-xs">
                        عطف: {reinspectSourceInspection.id}
                      </span>
                    )}
                  </>
                ) : initialData ? (
                  `ویرایش بازرسی: ${initialData.id}`
                ) : (
                  'ثبت ممیزی و بازرسی عملیاتی ایمنی جدید'
                )}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isReinspectionMode 
                  ? 'ایجاد رکورد جدید و مستقل در پایگاه داده با حفظ سابقه و نتایج بازرسی قبلی' 
                  : 'تکمیل مشخصات زمان‌بندی، آیتم‌های کنترلی و استانداردهای رسمی HSE'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold text-xs font-mono">
              امتیاز انطباق: {scorePercent}٪
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/20 flex items-center gap-1 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'info'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-black'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>مشخصات، زمان‌بندی و موقعیت</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'items'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-black'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>بندهای کنترلی و مغایرت‌ها</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
              {totalItemsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'photos'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-black'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>گالری تصاویر و مستندات</span>
            {formPhotos.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                {formPhotos.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'summary'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-black'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>خلاصه مشاهدات، CAPA و امضاها</span>
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border-b border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* RE-INSPECTION AUDIT INTEGRITY BANNER */}
          {isReinspectionMode && reinspectSourceInspection && (
            <div className="p-4 bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 rounded-2xl flex items-start gap-3.5 text-amber-950 dark:text-amber-200 shadow-xs">
              <div className="p-2 bg-amber-200 dark:bg-amber-900/70 rounded-xl shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5 text-amber-900 dark:text-amber-200" />
              </div>
              <div className="space-y-1.5 text-xs flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap font-black">
                  <span className="text-sm text-amber-950 dark:text-amber-100">
                    چرخه بازرسی دوره‌ای جدید تجهیز / فرآیند
                  </span>
                  <span className="font-mono text-[11px] bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 px-2 py-0.5 rounded-md">
                    سابقه قبلی: {reinspectSourceInspection.id} (مورخ {reinspectSourceInspection.inspectionDate})
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  با ثبت این فرم، یک <strong>رکورد جدید و مستقل</strong> در پایگاه داده ایجاد می‌شود. سابقه بازرسی قبلی شامل تمام بندهای کنترلی، نتایج، نواقص ({reinspectSourceInspection.failedCount} نقص)، امتیاز ({reinspectSourceInspection.scorePercent}٪) و امضاها <strong>کاملاً حفظ و غیرقابل‌تغییر</strong> باقی خواهند ماند.
                </p>
                <div className="flex items-center gap-4 pt-1 text-[11px] font-bold text-amber-900 dark:text-amber-300 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-700" />
                    تاریخ انجام جدید: بر اساس تاریخ روز ({formDate})
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    موعد بازرسی بعدی: محاسبه خودکار ({formNextInspectionDate})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: BASIC INFO & SMART SCHEDULING */}
          {activeTab === 'info' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Inspection Type & Scheduling Block */}
              <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>نوع بازرسی و زمان‌بندی هوشمند موعد بعدی</span>
                  </span>
                  <span className="text-[11px] text-blue-700 dark:text-blue-400 font-medium">
                    {formInspectionType === 'PERIODIC' 
                      ? `دوره انتخابی: ${getPeriodicIntervalLabel(formPeriodicInterval, isFa)} (محاسبه خودکار از تاریخ انجام)` 
                      : 'متصل به رویداد/عملیات (بدون زمان‌بندی سالانه یا ثابت)'}
                  </span>
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-2 ${formInspectionType === 'PERIODIC' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
                  {/* Inspection Type Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نوع بازرسی *
                    </label>
                    <select
                      value={formInspectionType}
                      onChange={e => handleInspectionTypeChange(e.target.value as UnifiedInspectionTimingType)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-black text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                    >
                      {INSPECTION_TIMING_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {isFa ? opt.labelFa : opt.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Periodic Interval Dropdown */}
                  {formInspectionType === 'PERIODIC' && (
                    <div>
                      <label className="block text-xs font-bold text-blue-900 dark:text-blue-300 mb-1">
                        دوره بازرسی (بازه تکرار) *
                      </label>
                      <select
                        value={formPeriodicInterval}
                        onChange={e => handlePeriodicIntervalChange(e.target.value as PeriodicIntervalType)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border-2 border-blue-400 dark:border-blue-600 rounded-xl font-black text-blue-800 dark:text-blue-200 focus:ring-2 focus:ring-blue-500 shadow-xs"
                      >
                        {PERIODIC_INTERVAL_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {isFa ? opt.labelFa : opt.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Actual Inspection Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      تاریخ واقعی انجام بازرسی *
                    </label>
                    <input
                      type="text"
                      required
                      value={formDate}
                      onChange={e => handleDateChange(e.target.value)}
                      placeholder="1404/06/04"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-mono font-bold"
                    />
                  </div>

                  {/* Next Inspection Date */}
                  {formInspectionType === 'PERIODIC' ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {`تاریخ بازرسی بعدی (${getPeriodicIntervalLabel(formPeriodicInterval, isFa)}) *`}
                        </label>
                        <button
                          type="button"
                          onClick={handleAutoRecalculateNextDate}
                          className="text-[10px] text-blue-600 hover:text-blue-800 dark:text-blue-400 font-bold flex items-center gap-1 cursor-pointer"
                          title="محاسبه مجدد خودکار"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>محاسبه مجدد</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={formNextInspectionDate}
                        onChange={e => {
                          setFormNextInspectionDate(e.target.value);
                          setIsNextDateManual(true);
                        }}
                        placeholder="1404/07/04"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-blue-400 dark:border-blue-600 rounded-xl font-mono font-black text-blue-700 dark:text-blue-300"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-purple-800 dark:text-purple-300 mb-1">
                        شناسه عملیات / پروانه متصل
                      </label>
                      <input
                        type="text"
                        value={formRelatedOperationId}
                        onChange={e => setFormRelatedOperationId(e.target.value)}
                        placeholder="مثال: PTW-1404-0231"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-600 rounded-xl font-mono font-bold"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* General Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الگوی چک‌لیست عملیاتی *
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={e => handleTemplateChange(e.target.value)}
                    disabled={!!initialData || isReinspectionMode}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.titleFa} {t.isActive === false ? '(غیرفعال)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    عنوان بازرسی *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    سایت مجتمع *
                  </label>
                  <select
                    required
                    value={formSite}
                    onChange={e => setFormSite(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  >
                    <option value="">-- انتخاب سایت --</option>
                    {availableSites.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    واحد عملیاتی *
                  </label>
                  <select
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  >
                    {availableUnits.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    محل دقیق / تجهیز
                  </label>
                  <input
                    type="text"
                    value={formArea}
                    onChange={e => setFormArea(e.target.value)}
                    placeholder="مثال: واحد ۲۰ - اطراف برج تقطیر T-201"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    شماره پروانه کار
                  </label>
                  <input
                    type="text"
                    value={formPermitNumber}
                    onChange={e => setFormPermitNumber(e.target.value)}
                    placeholder="مثال: PTW-1404-0985"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ساعت بازرسی
                  </label>
                  <input
                    type="text"
                    value={formTime}
                    onChange={e => setFormTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    کارشناس / بازرس ایمنی
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formInspectorName}
                      onChange={e => setFormInspectorName(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setIsInspectorSelectorOpen(true)}
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      انتخاب
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    سرپرست / ناظر عملیات
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formSupervisorName}
                      onChange={e => setFormSupervisorName(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setIsSupervisorSelectorOpen(true)}
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      انتخاب
                    </button>
                  </div>
                </div>
              </div>

              {/* Machinery & SWL Tonnage Section (Auto-Enabled for Crane / Forklift) */}
              {isMachineryChecklist(selectedTemplateId) && (
                <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/25 border-2 border-amber-300/90 dark:border-amber-700/70 space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-amber-800/60 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-amber-950 dark:text-amber-200 block">
                          مشخصات فنی و تناژ مجاز ماشین‌آلات و ادوات باربرداری (SWL)
                        </span>
                        <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                          این بخش به دلیل انتخاب الگوی جرثقیل / لیفتراک به صورت خودکار فعال شده است.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-amber-950 dark:text-amber-200 mb-1">
                        دسته‌بندی دستگاه
                      </label>
                      <input
                        type="text"
                        value={formMachineryType}
                        onChange={e => setFormMachineryType(e.target.value)}
                        placeholder="مثال: جرثقیل متحرک بوم تلسکوپی"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-amber-950 dark:text-amber-200 mb-1">
                        مدل و مشخصات فنی
                      </label>
                      <input
                        type="text"
                        value={formMachinerySpecs}
                        onChange={e => setFormMachinerySpecs(e.target.value)}
                        placeholder="مثال: تادانو Tadano GR-500EX"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-amber-950 dark:text-amber-200 mb-1">
                        تناژ و ظرفیت مجاز باربرداری (SWL) *
                      </label>
                      <input
                        type="text"
                        value={formMachineryTonnage}
                        onChange={e => setFormMachineryTonnage(e.target.value)}
                        placeholder="مثال: ۵۰ تن"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-600 rounded-xl font-black font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-amber-950 dark:text-amber-200 mb-1">
                        پلاک / شماره تگ دستگاه
                      </label>
                      <input
                        type="text"
                        value={formMachineryTagNumber}
                        onChange={e => setFormMachineryTagNumber(e.target.value)}
                        placeholder="مثال: CR-050-RJ"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CHECKLIST CONTROL ITEMS & VERDICTS */}
          {activeTab === 'items' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                    <span>بندهای کنترلی، نتایج بررسی، شرح مغایرت و اقدامات اصلاحی</span>
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    برای هر بند نتیجه بررسی را مشخص فرمایید؛ در صورت عدم‌انطباق (Fail) یا هشدار، ثبت مغایرت و اقدام اصلاحی الزامی است.
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {passedCount} تایید
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                    {failedCount} نقص
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                    {warningCount} هشدار
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                <div className="w-full overflow-x-auto custom-scrollbar">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3 w-10 text-center">#</th>
                        <th className="p-3 w-1/3">بند کنترلی و الزام استاندارد</th>
                        <th className="p-3 w-56 text-center">نتیجه بررسی (Verdict)</th>
                        <th className="p-3 w-28 text-center">مستند تصویری</th>
                        <th className="p-3">شرح مغایرت، اقدام اصلاحی (CAPA) و مسئول</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {formItems.map((item, idx) => (
                        <tr key={item.itemId || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-3 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-white leading-snug">{item.title}</div>
                            {item.category && (
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 block mt-0.5">
                                دسته‌بندی: {item.category}
                              </span>
                            )}
                            {item.requirement && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                الزام: {item.requirement}
                              </div>
                            )}
                            {item.standardRef && (
                              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                Ref: {item.standardRef}
                              </span>
                            )}
                            {item.previousVerdict && (item.previousVerdict === 'fail' || item.previousVerdict === 'warning') && (
                              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/80 text-[10px] font-black text-amber-900 dark:text-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>
                                  نقص در نوبت قبل ({item.previousVerdict === 'fail' ? 'عدم‌انطباق' : 'هشدار'}): {item.previousComment || 'بررسی رفع نقص'}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                              <button
                                type="button"
                                onClick={() => handleItemVerdictChange(idx, 'pass')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  item.verdict === 'pass'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-500 hover:text-emerald-600'
                                }`}
                              >
                                تایید (Pass)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleItemVerdictChange(idx, 'fail')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  item.verdict === 'fail'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'text-slate-500 hover:text-rose-600'
                                }`}
                              >
                                نقص (Fail)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleItemVerdictChange(idx, 'warning')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  item.verdict === 'warning'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-slate-500 hover:text-amber-600'
                                }`}
                              >
                                هشدار
                              </button>
                              <button
                                type="button"
                                onClick={() => handleItemVerdictChange(idx, 'na')}
                                className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  item.verdict === 'na'
                                    ? 'bg-slate-600 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                              >
                                N/A
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {item.photos && item.photos.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setActiveItemForPhotoModal({ item, index: idx })}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 flex items-center gap-1 cursor-pointer"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  <span>{item.photos.length} عکس</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setActiveItemForPhotoModal({ item, index: idx })}
                                  className="px-2 py-1 rounded-lg text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-slate-300 flex items-center gap-1 cursor-pointer"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  <span>+ عکس</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-3 space-y-2">
                            {/* Defect Description */}
                            <input
                              type="text"
                              value={item.defectDescription || item.comment || ''}
                              onChange={e => {
                                handleItemFieldChange(idx, 'defectDescription', e.target.value);
                                handleItemFieldChange(idx, 'comment', e.target.value);
                              }}
                              placeholder={item.verdict === 'fail' ? 'شرح نقص و مغایرت مشاهده‌شده...' : 'توضیحات و مشاهدات تکمیلی...'}
                              className={`w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border rounded-lg ${
                                item.verdict === 'fail' ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 dark:border-slate-700'
                              }`}
                            />

                            {/* Corrective Action (CAPA), Responsible & Due date */}
                            {(item.verdict === 'fail' || item.verdict === 'warning' || item.correctiveAction) && (
                              <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                                <input
                                  type="text"
                                  value={item.correctiveAction || ''}
                                  onChange={e => handleItemFieldChange(idx, 'correctiveAction', e.target.value)}
                                  placeholder="اقدام اصلاحی لازم جهت رفع نقص..."
                                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 rounded-lg text-blue-900 dark:text-blue-200"
                                />

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="flex gap-1">
                                    <input
                                      type="text"
                                      value={item.responsiblePerson || ''}
                                      onChange={e => handleItemFieldChange(idx, 'responsiblePerson', e.target.value)}
                                      placeholder="مسئول پیگیری..."
                                      className="flex-1 px-2 py-1 text-[11px] bg-white dark:bg-slate-900 border border-slate-200 rounded-lg"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setActiveItemRespSelectorIdx(idx)}
                                      className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                                    >
                                      پرسنل
                                    </button>
                                  </div>

                                  <input
                                    type="text"
                                    value={item.dueDate || ''}
                                    onChange={e => handleItemFieldChange(idx, 'dueDate', e.target.value)}
                                    placeholder="مهلت رفع (1404/07/15)"
                                    className="w-full px-2 py-1 text-[11px] bg-white dark:bg-slate-900 border border-slate-200 rounded-lg font-mono"
                                  />
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OVERALL PHOTO EVIDENCE GALLERY */}
          {activeTab === 'photos' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <SafetyPhotoAttachmentSection
                photos={formPhotos}
                onChange={setFormPhotos}
                isFa={isFa}
                currentUser={currentUser}
                title="گالری تصاویر و مستندات تصویری بازرسی و ممیزی ایمنی"
                subtitle="تصاویر کلی از محل کار، داربست‌ها، ماشین‌آلات، تابلوها، مجوزها و علائم ایمنی را بارگذاری نمایید."
              />
            </div>
          )}

          {/* TAB 4: SUMMARY, FINDINGS & SIGNATURES */}
          {activeTab === 'summary' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    خلاصه مشاهدات و ارزیابی نهایی
                  </label>
                  <textarea
                    rows={4}
                    value={formFindings}
                    onChange={e => setFormFindings(e.target.value)}
                    placeholder="شرح کلی وضعیت ایمنی محیط، ریسک‌ها و نکات مثبت یا منفی..."
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اقدامات فوری انجام‌شده در محل
                  </label>
                  <textarea
                    rows={4}
                    value={formImmediateActions}
                    onChange={e => setFormImmediateActions(e.target.value)}
                    placeholder="اقدامات بلافاصله مثل توقف عملیات، ایزولاسیون یا اخطار شفاهی..."
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اقدامات اصلاحی و پیشگیرانه کلی (CAPA)
                  </label>
                  <textarea
                    rows={4}
                    value={formRecommendedCapa}
                    onChange={e => setFormRecommendedCapa(e.target.value)}
                    placeholder="اقدامات ریشه‌ای سازمانی جهت جلوگیری از تکرار حوادث..."
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              {/* Personnel Signatures - 3-Tier Unified Standard */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <ChecklistPersonnelSignatures
                  isFa={isFa}
                  formData={{
                    inspectorName: formInspectorName,
                    inspectorCode: formInspectorCode,
                    supervisorName: formSupervisorName,
                    supervisorCode: formSupervisorCode,
                    hseManagerName: formHseManagerName,
                    hseManagerCode: formHseManagerCode
                  }}
                  onChange={(updated) => {
                    if (updated.inspectorName !== undefined) setFormInspectorName(updated.inspectorName);
                    if (updated.inspectorCode !== undefined) setFormInspectorCode(updated.inspectorCode);
                    if (updated.supervisorName !== undefined) setFormSupervisorName(updated.supervisorName);
                    if (updated.supervisorCode !== undefined) setFormSupervisorCode(updated.supervisorCode);
                    if (updated.hseManagerName !== undefined) setFormHseManagerName(updated.hseManagerName);
                    if (updated.hseManagerCode !== undefined) setFormHseManagerCode(updated.hseManagerCode);
                  }}
                />
              </div>
            </div>
          )}

          {/* Footer Submit Buttons */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>تمام اطلاعات با امنیت کامل در پایگاه داده مرکزی ثبت و ذخیره می‌شود</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-7 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-xl text-xs shadow-lg shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'در حال ذخیره‌سازی...' : isReinspectionMode ? 'ثبت نوبت جدید بازرسی' : 'ثبت و ذخیره نهایی بازرسی'}</span>
              </button>
            </div>
          </div>
        </form>

      </div>

      {/* Item Photo Modal */}
      {activeItemForPhotoModal && (
        <SafetyItemPhotoModal
          isOpen={Boolean(activeItemForPhotoModal)}
          onClose={() => setActiveItemForPhotoModal(null)}
          item={activeItemForPhotoModal.item}
          itemIndex={activeItemForPhotoModal.index}
          onUpdateItemPhotos={(idx, photos) => {
            handleItemFieldChange(idx, 'photos', photos);
          }}
          isFa={isFa}
          currentUser={currentUser}
        />
      )}

      {/* Lightbox Modal */}
      <SafetyPhotoLightboxModal
        photo={lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
        isFa={isFa}
      />

    </div>
  );
}
