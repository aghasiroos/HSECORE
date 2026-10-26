import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Edit2, Trash2, Check, AlertCircle, AlertTriangle,
  Building2, Coffee, UtensilsCrossed, Ambulance, Bath,
  Layers, Info, ShieldCheck, Tag, RotateCcw, CheckCircle2,
  ChevronUp, ChevronDown, Sliders, ToggleLeft, ToggleRight,
  Sparkles, Leaf, Droplets, Trash, HeartPulse, Activity
} from 'lucide-react';
import { 
  HealthEnvChecklistTypeTemplate, 
  HealthEnvChecklistItem, 
  HealthEnvChecklistType 
} from '../../types/checklistTypes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  templates: HealthEnvChecklistTypeTemplate[];
  selectedTypeId?: HealthEnvChecklistType;
  onSaveTemplate: (template: HealthEnvChecklistTypeTemplate) => Promise<any>;
  onDeleteTemplate: (templateId: string) => Promise<any>;
  onAddChecklistItem: (templateId: HealthEnvChecklistType, item: Omit<HealthEnvChecklistItem, 'id'>) => Promise<any>;
  onUpdateChecklistItem: (templateId: HealthEnvChecklistType, item: HealthEnvChecklistItem) => Promise<any>;
  onDeleteChecklistItem: (templateId: HealthEnvChecklistType, itemId: string) => Promise<any>;
  onReorderChecklistItems?: (templateId: HealthEnvChecklistType, items: HealthEnvChecklistItem[]) => Promise<any>;
  onResetTemplate?: (templateId: HealthEnvChecklistType) => Promise<any>;
  currentUser?: any;
}

export default function HealthEnvManageTemplateModal({
  isOpen,
  onClose,
  templates,
  selectedTypeId,
  onSaveTemplate,
  onDeleteTemplate,
  onAddChecklistItem,
  onUpdateChecklistItem,
  onDeleteChecklistItem,
  onReorderChecklistItems,
  onResetTemplate,
  currentUser
}: Props) {
  const [activeType, setActiveType] = useState<HealthEnvChecklistType>(
    selectedTypeId || (templates[0]?.id || 'premises-buildings')
  );

  // Item edit / add state
  const [editingItem, setEditingItem] = useState<HealthEnvChecklistItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New item form state
  const [itemTitle, setItemTitle] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemRequirement, setItemRequirement] = useState('');
  const [itemStandardRef, setItemStandardRef] = useState('');

  // Template edit / add state
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  const [isCreatingNewTemplate, setIsCreatingNewTemplate] = useState(false);
  const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Template form inputs
  const [tmplId, setTmplId] = useState('');
  const [tmplTitleFa, setTmplTitleFa] = useState('');
  const [tmplTitleEn, setTmplTitleEn] = useState('');
  const [tmplCategoryFa, setTmplCategoryFa] = useState('');
  const [tmplIconName, setTmplIconName] = useState('ShieldCheck');
  const [tmplDescriptionFa, setTmplDescriptionFa] = useState('');
  const [tmplStandardRef, setTmplStandardRef] = useState('');
  const [tmplDefaultFrequency, setTmplDefaultFrequency] = useState('ماهانه');
  const [tmplIsActive, setTmplIsActive] = useState(true);

  // Item deletion confirmation modal state
  const [itemToDelete, setItemToDelete] = useState<HealthEnvChecklistItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Template deletion confirmation modal state
  const [templateToDelete, setTemplateToDelete] = useState<HealthEnvChecklistTypeTemplate | null>(null);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [deleteTemplateError, setDeleteTemplateError] = useState<string | null>(null);

  // Reset template confirmation modal state
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Temporary feedback toast
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (selectedTypeId) {
      setActiveType(selectedTypeId);
    }
  }, [selectedTypeId]);

  useEffect(() => {
    if (feedbackToast) {
      const timer = setTimeout(() => setFeedbackToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [feedbackToast]);

  const currentTemplate = templates.find(t => t.id === activeType) || templates[0];

  const getTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case 'Building2': return <Building2 className="w-4 h-4" />;
      case 'Coffee': return <Coffee className="w-4 h-4" />;
      case 'UtensilsCrossed': return <UtensilsCrossed className="w-4 h-4" />;
      case 'Ambulance': return <Ambulance className="w-4 h-4" />;
      case 'Bath': return <Bath className="w-4 h-4" />;
      case 'Leaf': return <Leaf className="w-4 h-4" />;
      case 'Droplets': return <Droplets className="w-4 h-4" />;
      case 'Trash': return <Trash className="w-4 h-4" />;
      case 'HeartPulse': return <HeartPulse className="w-4 h-4" />;
      case 'Activity': return <Activity className="w-4 h-4" />;
      case 'Sparkles': return <Sparkles className="w-4 h-4" />;
      default: return <ShieldCheck className="w-4 h-4" />;
    }
  };

  // --- ITEM HANDLERS ---
  const handleStartAdd = () => {
    setEditingItem(null);
    setItemTitle('');
    setItemCategory(currentTemplate?.defaultItems[0]?.category || 'بهداشت عمومی');
    setItemRequirement('');
    setItemStandardRef(currentTemplate?.standardRef || '');
    setIsAddingNew(true);
    setError(null);
  };

  const handleStartEdit = (item: HealthEnvChecklistItem) => {
    setEditingItem(item);
    setItemTitle(item.title);
    setItemCategory(item.category);
    setItemRequirement(item.requirement);
    setItemStandardRef(item.standardRef || '');
    setIsAddingNew(false);
    setError(null);
  };

  const handleCancelForm = () => {
    setIsAddingNew(false);
    setEditingItem(null);
    setError(null);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim()) {
      setError('عنوان مورد کنترلی الزامی است.');
      return;
    }
    if (!itemCategory.trim()) {
      setError('دسته‌بندی الزامی است.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (editingItem) {
        await onUpdateChecklistItem(activeType, {
          ...editingItem,
          title: itemTitle.trim(),
          category: itemCategory.trim(),
          requirement: itemRequirement.trim(),
          standardRef: itemStandardRef.trim() || undefined
        });
        setFeedbackToast({ type: 'success', text: 'تغییرات آیتم ارزیابی با موفقیت ذخیره شد.' });
      } else {
        await onAddChecklistItem(activeType, {
          title: itemTitle.trim(),
          category: itemCategory.trim(),
          requirement: itemRequirement.trim(),
          standardRef: itemStandardRef.trim() || undefined
        });
        setFeedbackToast({ type: 'success', text: 'آیتم جدید با موفقیت به الگوی چک‌لیست اضافه شد.' });
      }
      handleCancelForm();
    } catch (err: any) {
      setError(err?.message || 'خطا در ذخیره‌سازی آیتم.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeletingItem(true);
    setDeleteError(null);
    try {
      await onDeleteChecklistItem(activeType, itemToDelete.id);
      setFeedbackToast({ 
        type: 'success', 
        text: `آیتم «${itemToDelete.title}» با موفقیت از الگوی چک‌لیست حذف گردید.` 
      });
      setItemToDelete(null);
    } catch (err: any) {
      setDeleteError(err?.message || 'خطا در حذف آیتم از پایگاه داده.');
    } finally {
      setIsDeletingItem(false);
    }
  };

  const handleMoveItem = async (index: number, direction: 'up' | 'down') => {
    if (!currentTemplate || !onReorderChecklistItems) return;
    const items = [...currentTemplate.defaultItems];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;

    const temp = items[index];
    items[index] = items[targetIdx];
    items[targetIdx] = temp;

    try {
      await onReorderChecklistItems(activeType, items);
      setFeedbackToast({ type: 'success', text: 'ترتیب آیتم‌ها با موفقیت تغییر کرد.' });
    } catch (err: any) {
      setFeedbackToast({ type: 'error', text: 'خطا در تغییر ترتیب آیتم‌ها.' });
    }
  };

  // --- TEMPLATE HANDLERS ---
  const handleOpenCreateTemplate = () => {
    setIsCreatingNewTemplate(true);
    setTmplId(`custom-${Date.now().toString(36)}`);
    setTmplTitleFa('');
    setTmplTitleEn('');
    setTmplCategoryFa('بهداشت محیط');
    setTmplIconName('Leaf');
    setTmplDescriptionFa('');
    setTmplStandardRef('HSE Health Standard');
    setTmplDefaultFrequency('ماهانه');
    setTmplIsActive(true);
    setTemplateError(null);
    setIsTemplateFormOpen(true);
  };

  const handleOpenEditTemplate = (tmpl: HealthEnvChecklistTypeTemplate) => {
    setIsCreatingNewTemplate(false);
    setTmplId(tmpl.id);
    setTmplTitleFa(tmpl.titleFa);
    setTmplTitleEn(tmpl.titleEn);
    setTmplCategoryFa(tmpl.categoryFa);
    setTmplIconName(tmpl.iconName || 'ShieldCheck');
    setTmplDescriptionFa(tmpl.descriptionFa);
    setTmplStandardRef(tmpl.standardRef);
    setTmplDefaultFrequency(tmpl.defaultFrequency);
    setTmplIsActive(tmpl.isActive !== false);
    setTemplateError(null);
    setIsTemplateFormOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tmplTitleFa.trim()) {
      setTemplateError('عنوان فارسی الگو الزامی است.');
      return;
    }

    setIsSubmittingTemplate(true);
    setTemplateError(null);
    try {
      const payload: HealthEnvChecklistTypeTemplate = {
        id: tmplId.trim(),
        titleFa: tmplTitleFa.trim(),
        titleEn: tmplTitleEn.trim() || tmplTitleFa.trim(),
        categoryFa: tmplCategoryFa.trim() || 'بهداشت و محیط زیست',
        iconName: tmplIconName,
        descriptionFa: tmplDescriptionFa.trim(),
        standardRef: tmplStandardRef.trim() || 'استاندارد بهداشت و محیط زیست',
        defaultFrequency: tmplDefaultFrequency.trim() || 'ماهانه',
        isActive: tmplIsActive,
        defaultItems: isCreatingNewTemplate ? [] : (currentTemplate?.defaultItems || [])
      };

      await onSaveTemplate(payload);
      setActiveType(payload.id);
      setIsTemplateFormOpen(false);
      setFeedbackToast({ 
        type: 'success', 
        text: isCreatingNewTemplate ? 'الگوی جدید چک‌لیست با موفقیت ایجاد شد.' : 'مشخصات الگو با موفقیت ویرایش گردید.' 
      });
    } catch (err: any) {
      setTemplateError(err?.message || 'خطا در ذخیره‌سازی الگو.');
    } finally {
      setIsSubmittingTemplate(false);
    }
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!templateToDelete) return;
    setIsDeletingTemplate(true);
    setDeleteTemplateError(null);
    try {
      await onDeleteTemplate(templateToDelete.id);
      setFeedbackToast({ 
        type: 'success', 
        text: `الگوی «${templateToDelete.titleFa}» با موفقیت حذف گردید.` 
      });
      setTemplateToDelete(null);
      // Switch to remaining template
      const remaining = templates.filter(t => t.id !== templateToDelete.id);
      if (remaining.length > 0) {
        setActiveType(remaining[0].id);
      }
    } catch (err: any) {
      setDeleteTemplateError(err?.message || 'خطا در حذف الگو از پایگاه داده.');
    } finally {
      setIsDeletingTemplate(false);
    }
  };

  const handleConfirmResetTemplate = async () => {
    if (!onResetTemplate) return;
    setIsResetting(true);
    try {
      await onResetTemplate(activeType);
      setFeedbackToast({ 
        type: 'success', 
        text: `الگوی چک‌لیست «${currentTemplate?.titleFa}» به وضعیت استاندارد پیش‌فرض بازنشانی شد.` 
      });
      setIsConfirmingReset(false);
    } catch (err: any) {
      setFeedbackToast({ 
        type: 'error', 
        text: err?.message || 'خطا در بازنشانی الگوی چک‌لیست.' 
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-white">
                مدیریت الگوها و اقلام کنترلی چک‌لیست‌های بهداشت و محیط زیست
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تعریف الگوهای بازرسی، افزودن، ویرایش، حذف کنترل‌شده و مرتب‌سازی اقلام با حفظ سوابق در پایگاه داده
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenCreateTemplate}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>ایجاد الگوی جدید</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Toast Banner */}
        {feedbackToast && (
          <div className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b animate-in fade-in duration-200 ${
            feedbackToast.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 text-emerald-800 dark:text-emerald-300' 
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 text-rose-800 dark:text-rose-300'
          }`}>
            {feedbackToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackToast.text}</span>
          </div>
        )}

        {/* Checklist Templates Selector Tabs */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/20 flex gap-2 overflow-x-auto shrink-0">
          {templates.map(tmpl => {
            const isSelected = tmpl.id === activeType;
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => {
                  setActiveType(tmpl.id);
                  handleCancelForm();
                  setIsTemplateFormOpen(false);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {getTemplateIcon(tmpl.iconName || 'ShieldCheck')}
                <span>{tmpl.titleFa}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}>
                  {tmpl.defaultItems?.length || 0}
                </span>
                {tmpl.isActive === false && (
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded">
                    غیرفعال
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Active Template Info Bar & Actions */}
          {currentTemplate && (
            <div className="bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-900/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-teal-900 dark:text-teal-200 flex items-center gap-2">
                    {getTemplateIcon(currentTemplate.iconName || 'ShieldCheck')}
                    <span>{currentTemplate.titleFa}</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300">
                    {currentTemplate.id}
                  </span>
                  {currentTemplate.isActive === false && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                      غیرفعال در فرم‌ها
                    </span>
                  )}
                </div>
                <p className="text-xs text-teal-800/80 dark:text-teal-300/80 mt-1">
                  {currentTemplate.descriptionFa || 'بدون توضیحات تکمیلی'}
                </p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-teal-700 dark:text-teal-400 font-mono">
                  <span>مرجع: {currentTemplate.standardRef || 'HSE Standard'}</span>
                  <span>•</span>
                  <span>تواتر توصیه شده: {currentTemplate.defaultFrequency || 'ماهانه'}</span>
                </div>
              </div>

              <div className="flex items-center flex-wrap gap-2 shrink-0">
                {/* Edit Template details button */}
                <button
                  type="button"
                  onClick={() => handleOpenEditTemplate(currentTemplate)}
                  className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="ویرایش مشخصات، نام، آیکون و وضعیت الگو"
                >
                  <Sliders className="w-3.5 h-3.5 text-teal-600" />
                  <span>ویرایش الگو</span>
                </button>

                {/* Delete Template button */}
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTemplateError(null);
                    setTemplateToDelete(currentTemplate);
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="حذف کنترل‌شده الگو با تأیید"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>حذف الگو</span>
                </button>

                {onResetTemplate && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingReset(true)}
                    className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="بازنشانی آیتم‌ها به استاندارد اولیه سامانه"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    <span>بازنشانی پیش‌فرض</span>
                  </button>
                )}

                {!isAddingNew && !editingItem && (
                  <button
                    type="button"
                    onClick={handleStartAdd}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-teal-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن آیتم جدید</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TEMPLATE EDIT / CREATE FORM PANEL */}
          {isTemplateFormOpen && (
            <form onSubmit={handleSaveTemplate} className="bg-slate-50 dark:bg-slate-850 border-2 border-teal-500 rounded-2xl p-4 space-y-4 shadow-md animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-teal-600" />
                  <span>{isCreatingNewTemplate ? 'ایجاد الگوی جدید چک‌لیست بهداشت و محیط زیست' : `ویرایش مشخصات الگوی: ${tmplTitleFa}`}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsTemplateFormOpen(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  انصراف
                </button>
              </div>

              {templateError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{templateError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    شناسه یکتا (کد لاتین الگو) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={tmplId}
                    onChange={e => setTmplId(e.target.value)}
                    disabled={!isCreatingNewTemplate}
                    placeholder="مثال: custom-waste, kitchen-hygiene..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-mono disabled:opacity-60"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    عنوان فارسی الگو <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={tmplTitleFa}
                    onChange={e => setTmplTitleFa(e.target.value)}
                    placeholder="مثال: بازرسی بهداشت اماکن و آشپزخانه..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-bold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    عنوان انگلیسی
                  </label>
                  <input
                    type="text"
                    value={tmplTitleEn}
                    onChange={e => setTmplTitleEn(e.target.value)}
                    placeholder="مثال: Kitchen & Food Hygiene..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    دسته‌بندی موضوعی
                  </label>
                  <input
                    type="text"
                    value={tmplCategoryFa}
                    onChange={e => setTmplCategoryFa(e.target.value)}
                    placeholder="مثال: بهداشت محیط، تغذیه، پسماند، تجهیزات..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    آیکون الگو
                  </label>
                  <select
                    value={tmplIconName}
                    onChange={e => setTmplIconName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-bold cursor-pointer"
                  >
                    <option value="ShieldCheck">سپر حفاظتی (ShieldCheck)</option>
                    <option value="Building2">ساختمان و اماکن (Building2)</option>
                    <option value="Coffee">آبدارخانه و پذیرایی (Coffee)</option>
                    <option value="UtensilsCrossed">رستوران و طبخ غذا (UtensilsCrossed)</option>
                    <option value="Ambulance">آمبولانس و تجهیزات امدادی (Ambulance)</option>
                    <option value="Bath">سرویس بهداشتی و حمام (Bath)</option>
                    <option value="Leaf">محیط زیست و طبیعت (Leaf)</option>
                    <option value="Droplets">آب آشامیدنی و پساب (Droplets)</option>
                    <option value="Trash">مدیریت پسماند (Trash)</option>
                    <option value="HeartPulse">سلامت شغلی و بالینی (HeartPulse)</option>
                    <option value="Activity">پایش و معاینات (Activity)</option>
                    <option value="Sparkles">بهداشت عمومی و ۵S (Sparkles)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    دوره تناوب پیشنهادی
                  </label>
                  <input
                    type="text"
                    value={tmplDefaultFrequency}
                    onChange={e => setTmplDefaultFrequency(e.target.value)}
                    placeholder="مثال: روزانه، هفتگی، ماهانه، فصلی..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    مرجع قانونی و استاندارد
                  </label>
                  <input
                    type="text"
                    value={tmplStandardRef}
                    onChange={e => setTmplStandardRef(e.target.value)}
                    placeholder="مثال: دستورالعمل بهداشت محیط وزارت بهداشت، ISO 14001, OHSAS 18001..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    وضعیت الگو در سامانه
                  </label>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setTmplIsActive(!tmplIsActive)}
                      className="flex items-center gap-2 cursor-pointer text-xs font-bold"
                    >
                      {tmplIsActive ? (
                        <>
                          <ToggleRight className="w-6 h-6 text-emerald-600" />
                          <span className="text-emerald-700 dark:text-emerald-300">فعال (در دسترس برای ثبت)</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-6 h-6 text-slate-400" />
                          <span className="text-slate-500">غیرفعال (مخفی در ثبت جدید)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1 md:col-span-3">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    شرح و دامنه کاربرد الگو
                  </label>
                  <textarea
                    rows={2}
                    value={tmplDescriptionFa}
                    onChange={e => setTmplDescriptionFa(e.target.value)}
                    placeholder="توضیح هدف ارزیابی و حوزه تحت پوشش این چک‌لیست..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsTemplateFormOpen(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTemplate}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-teal-600/30"
                >
                  {isSubmittingTemplate ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>در حال ذخیره الگو...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{isCreatingNewTemplate ? 'ایجاد و ذخیره الگو' : 'ذخیره تغییرات الگو'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ITEM ADD / EDIT FORM PANEL */}
          {(isAddingNew || editingItem) && (
            <form onSubmit={handleSaveItem} className="bg-white dark:bg-slate-850 border-2 border-teal-500/40 rounded-2xl p-4 space-y-4 shadow-sm animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>{editingItem ? 'ویرایش آیتم چک‌لیست' : 'افزودن آیتم ارزیابی جدید'}</span>
                </h4>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  انصراف
                </button>
              </div>

              {error && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    عنوان آیتم بازرسی <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={itemTitle}
                    onChange={e => setItemTitle(e.target.value)}
                    placeholder="مثال: بررسی سلامت و فشار کپسول‌های اکسیژن ثابت و پرتابل..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-teal-500/40"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    دسته‌بندی موضوعی <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={itemCategory}
                    onChange={e => setItemCategory(e.target.value)}
                    placeholder="مثال: روشنایی، تهویه، تجهیزات تنفسی، بهداشت فردی..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-teal-500/40"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    مرجع قانونی / استاندارد
                  </label>
                  <input
                    type="text"
                    value={itemStandardRef}
                    onChange={e => setItemStandardRef(e.target.value)}
                    placeholder="مثال: OHSAS 18001, آیین‌نامه بهداشت محیط..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-teal-500/40"
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    معیار پذیرش / شرح الزام کنترلی
                  </label>
                  <textarea
                    rows={2}
                    value={itemRequirement}
                    onChange={e => setItemRequirement(e.target.value)}
                    placeholder="معیار دقیق ارزیابی و حد مطلوب مورد پذیرش..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-teal-500/40"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-teal-600/30"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>در حال ذخیره...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingItem ? 'ذخیره تغییرات' : 'افزودن به الگو'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* CHECKLIST ITEMS LIST TABLE / CARDS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
              <span>فهرست بندهای استاندارد ارزیابی (تعداد: {currentTemplate?.defaultItems?.length || 0})</span>
              <span className="text-[11px] text-slate-400">جابجایی ترتیب آیتم‌ها با فلش‌های بالا و پایین</span>
            </div>

            {(!currentTemplate?.defaultItems || currentTemplate.defaultItems.length === 0) ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  هیچ بند کنترلی برای این الگو تعریف نشده است.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  با کلیک روی «افزودن آیتم جدید» می‌توانید اولین بند کنترلی را تعریف کنید.
                </p>
                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="mt-3 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>افزودن اولین بند کنترلی</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {currentTemplate.defaultItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-teal-300 dark:hover:border-teal-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Order buttons */}
                      <div className="flex flex-col items-center justify-center gap-0.5 pt-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveItem(index, 'up')}
                          className="p-1 rounded text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 cursor-pointer"
                          title="انتقال به بالا"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          disabled={index === currentTemplate.defaultItems.length - 1}
                          onClick={() => handleMoveItem(index, 'down')}
                          className="p-1 rounded text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 cursor-pointer"
                          title="انتقال به پایین"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {item.category}
                          </span>
                          {item.standardRef && (
                            <span className="text-[10px] font-mono text-teal-600 dark:text-teal-400">
                              {item.standardRef}
                            </span>
                          )}
                          {item.isCustom && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
                              سفارشی
                            </span>
                          )}
                        </div>

                        <h5 className="text-xs font-bold text-slate-800 dark:text-white leading-relaxed">
                          {item.title}
                        </h5>

                        {item.requirement && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                            معیار الزام: {item.requirement}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="p-2 text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                        title="ویرایش آیتم"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setItemToDelete(item);
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                        title="حذف آیتم"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>پایگاه داده مرکزی: هرگونه تغییر در الگوها و اقلام در جدول پیکربندی سرور ثبت و اعتبارسنجی می‌شود.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>

      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. Item Deletion Confirmation Modal                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900/50">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                تأیید حذف آیتم ارزیابی چک‌لیست
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                آیا از حذف آیتم زیر از الگوی چک‌لیست <span className="font-bold text-slate-800 dark:text-slate-200">«{currentTemplate?.titleFa}»</span> اطمینان دارید؟
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">شناسه: {itemToDelete.id}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/50">
                  {itemToDelete.category}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">شرح مورد کنترلی:</span>
                <strong className="text-slate-900 dark:text-white leading-snug block">
                  {itemToDelete.title}
                </strong>
              </div>
              {itemToDelete.requirement && (
                <div className="text-[11px] text-slate-500 leading-relaxed pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">معیار پذیرش و وضعیت مطلوب:</span>
                  <span>{itemToDelete.requirement}</span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>با حذف این آیتم، این مورد در بازدیدهای جدید درج نخواهد شد، ولی سوابق ثبت‌شده قبلی در پایگاه داده بدون تغییر حفظ می‌گردند.</span>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingItem}
                onClick={() => {
                  setItemToDelete(null);
                  setDeleteError(null);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isDeletingItem}
                onClick={handleConfirmDeleteItem}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-md shadow-rose-600/30 flex items-center justify-center gap-1.5"
              >
                {isDeletingItem ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>در حال حذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تأیید و حذف دائم</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. Template Deletion Confirmation Modal                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {templateToDelete && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-rose-200 dark:border-rose-900/60 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto border border-rose-300 dark:border-rose-800">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-rose-900 dark:text-rose-300">
                تأیید حذف کامل الگوی چک‌لیست
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                آیا از حذف الگوی چک‌لیست <span className="font-bold text-rose-600">«{templateToDelete.titleFa}»</span> اطمینان قطعی دارید؟
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">شناسه الگو: {templateToDelete.id}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  {templateToDelete.defaultItems?.length || 0} بند کنترلی
                </span>
              </div>
              <div className="text-slate-700 dark:text-slate-200 font-bold">
                عنوان الگو: {templateToDelete.titleFa}
              </div>
              <div className="text-[11px] text-slate-500">
                دسته‌بندی: {templateToDelete.categoryFa || 'بهداشت و محیط زیست'}
              </div>
            </div>

            <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                <strong className="block">حفاظت از سوابق ثبت‌شده تاریخی:</strong>
                <span>با حذف این الگو، امکان ثبت فرم‌های جدید با این الگو متوقف می‌شود. کلیه بازرسی‌ها و سوابقی که قبلاً با این الگو در پایگاه داده ثبت شده‌اند، جهت قابلیت استناد و ممیزی قانونی محفوظ خواهند ماند.</span>
              </div>
            </div>

            {deleteTemplateError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteTemplateError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingTemplate}
                onClick={() => {
                  setTemplateToDelete(null);
                  setDeleteTemplateError(null);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isDeletingTemplate}
                onClick={handleConfirmDeleteTemplate}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-md shadow-rose-600/30 flex items-center justify-center gap-1.5"
              >
                {isDeletingTemplate ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>در حال حذف الگو...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تأیید و حذف نهایی الگو</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. Reset Template Confirmation Modal                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isConfirmingReset && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-900/50">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                تأیید بازنشانی به آیتم‌های استاندارد
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                آیا از بازنشانی کلیه آیتم‌های چک‌لیست <span className="font-bold text-slate-800 dark:text-slate-200">«{currentTemplate?.titleFa}»</span> به وضعیت استاندارد اولیه سازمانی اطمینان دارید؟ تغییرات سفارشی اعمال‌شده به حالت پیش‌فرض بازخواهند گشت.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setIsConfirmingReset(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleConfirmResetTemplate}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-md shadow-amber-600/30 flex items-center justify-center gap-1.5"
              >
                {isResetting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>در حال بازنشانی...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تأیید و بازنشانی استاندارد</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
