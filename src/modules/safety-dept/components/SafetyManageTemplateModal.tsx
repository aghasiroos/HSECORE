import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Plus, Edit2, Trash2, Check, AlertCircle, AlertTriangle,
  Building2, Flame, Box, Scale, Shovel, Zap, Truck, ShieldAlert,
  Layers, Info, ShieldCheck, RotateCcw, CheckCircle2, ChevronUp,
  ChevronDown, Sliders, ToggleLeft, ToggleRight, Sparkles, Search,
  Copy, CheckSquare, FileText
} from 'lucide-react';
import { 
  SafetyChecklistTypeTemplate, 
  SafetyChecklistItem,
  OperationalSafetyInspection
} from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  templates: SafetyChecklistTypeTemplate[];
  inspections?: OperationalSafetyInspection[];
  selectedTemplateId?: string;
  onSaveTemplate: (template: SafetyChecklistTypeTemplate) => Promise<any>;
  onDeleteTemplate: (templateId: string) => Promise<any>;
  onAddChecklistItem: (templateId: string, item: Omit<SafetyChecklistItem, 'id'>) => Promise<any>;
  onUpdateChecklistItem: (templateId: string, item: SafetyChecklistItem) => Promise<any>;
  onDeleteChecklistItem: (templateId: string, itemId: string) => Promise<any>;
  onReorderChecklistItems?: (templateId: string, items: SafetyChecklistItem[]) => Promise<any>;
  onResetTemplate?: (templateId: string) => Promise<any>;
  onRestoreAllDefaults?: () => Promise<any>;
  onEditInspection?: (inspection: OperationalSafetyInspection) => void;
  currentUser?: any;
  isFa?: boolean;
}

export default function SafetyManageTemplateModal({
  isOpen,
  onClose,
  templates,
  inspections = [],
  selectedTemplateId,
  onSaveTemplate,
  onDeleteTemplate,
  onAddChecklistItem,
  onUpdateChecklistItem,
  onDeleteChecklistItem,
  onReorderChecklistItems,
  onResetTemplate,
  onRestoreAllDefaults,
  onEditInspection,
  currentUser,
  isFa = true
}: Props) {
  const [activeTemplateId, setActiveTemplateId] = useState<string>(
    selectedTemplateId || (templates[0]?.id || 'scaffolding')
  );
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemCategoryFilter, setItemCategoryFilter] = useState('ALL');
  const [selectedRecordedInspectionId, setSelectedRecordedInspectionId] = useState<string>('');
  const [isRestoringDefaults, setIsRestoringDefaults] = useState(false);
  
  // Item edit / add state
  const [editingItem, setEditingItem] = useState<SafetyChecklistItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  // Item form inputs
  const [itemTitle, setItemTitle] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemRequirement, setItemRequirement] = useState('');
  const [itemStandardRef, setItemStandardRef] = useState('');
  const [itemIsRequired, setItemIsRequired] = useState(true);
  const [itemResponseType, setItemResponseType] = useState<'verdict' | 'text' | 'number' | 'boolean'>('verdict');

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
  const [tmplDefaultFrequency, setTmplDefaultFrequency] = useState('ماهانه و قبل از عملیات');
  const [tmplIsActive, setTmplIsActive] = useState(true);

  // Deletion Confirmation state
  const [itemToDelete, setItemToDelete] = useState<SafetyChecklistItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [deleteItemError, setDeleteItemError] = useState<string | null>(null);

  const [templateToDelete, setTemplateToDelete] = useState<SafetyChecklistTypeTemplate | null>(null);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [deleteTemplateError, setDeleteTemplateError] = useState<string | null>(null);

  // Reset Template state
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (selectedTemplateId && templates.some(t => t.id === selectedTemplateId)) {
      setActiveTemplateId(selectedTemplateId);
    } else if (templates.length > 0 && !templates.some(t => t.id === activeTemplateId)) {
      setActiveTemplateId(templates[0].id);
    }
  }, [selectedTemplateId, templates, isOpen]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const currentTemplate = templates.find(t => t.id === activeTemplateId) || templates[0];

  const filteredTemplates = useMemo(() => {
    if (!templateSearchQuery.trim()) return templates;
    const q = templateSearchQuery.trim().toLowerCase();
    return templates.filter(t =>
      t.titleFa?.toLowerCase().includes(q) ||
      t.titleEn?.toLowerCase().includes(q) ||
      t.categoryFa?.toLowerCase().includes(q) ||
      t.standardRef?.toLowerCase().includes(q)
    );
  }, [templates, templateSearchQuery]);

  const availableItemCategories = useMemo(() => {
    if (!currentTemplate?.defaultItems) return [];
    const cats = new Set<string>();
    currentTemplate.defaultItems.forEach(it => {
      if (it.category) cats.add(it.category);
    });
    return Array.from(cats);
  }, [currentTemplate]);

  const filteredItems = useMemo(() => {
    const all = currentTemplate?.defaultItems || [];
    return all.filter(it => {
      if (itemCategoryFilter !== 'ALL' && it.category !== itemCategoryFilter) return false;
      if (itemSearchQuery.trim()) {
        const q = itemSearchQuery.trim().toLowerCase();
        const matchTitle = it.title?.toLowerCase().includes(q);
        const matchCat = it.category?.toLowerCase().includes(q);
        const matchReq = it.requirement?.toLowerCase().includes(q);
        const matchRef = it.standardRef?.toLowerCase().includes(q);
        if (!matchTitle && !matchCat && !matchReq && !matchRef) return false;
      }
      return true;
    });
  }, [currentTemplate, itemCategoryFilter, itemSearchQuery]);

  const handleSelectTemplate = (templateId: string) => {
    setActiveTemplateId(templateId);
    setItemCategoryFilter('ALL');
    setItemSearchQuery('');
    handleCancelItemForm();
    setIsTemplateFormOpen(false);
  };

  const getTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case 'Building2': return <Building2 className="w-4 h-4" />;
      case 'Flame': return <Flame className="w-4 h-4" />;
      case 'Box': return <Box className="w-4 h-4" />;
      case 'Scale': return <Scale className="w-4 h-4" />;
      case 'Shovel': return <Shovel className="w-4 h-4" />;
      case 'Zap': return <Zap className="w-4 h-4" />;
      case 'Truck': return <Truck className="w-4 h-4" />;
      case 'ShieldAlert': return <ShieldAlert className="w-4 h-4" />;
      default: return <Layers className="w-4 h-4" />;
    }
  };

  // --- ITEM HANDLERS ---
  const handleStartAddItem = () => {
    setEditingItem(null);
    setItemTitle('');
    setItemCategory(currentTemplate?.defaultItems[0]?.category || 'الزامات عمومی');
    setItemRequirement('');
    setItemStandardRef(currentTemplate?.standardRef || '');
    setItemIsRequired(true);
    setItemResponseType('verdict');
    setIsAddingItem(true);
    setItemError(null);
  };

  const handleStartEditItem = (item: SafetyChecklistItem) => {
    setEditingItem(item);
    setItemTitle(item.title);
    setItemCategory(item.category);
    setItemRequirement(item.requirement);
    setItemStandardRef(item.standardRef || '');
    setItemIsRequired(item.isRequired !== undefined ? item.isRequired : true);
    setItemResponseType(item.responseType || 'verdict');
    setIsAddingItem(false);
    setItemError(null);
  };

  const handleCancelItemForm = () => {
    setIsAddingItem(false);
    setEditingItem(null);
    setItemError(null);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim()) {
      setItemError('عنوان بند کنترلی الزامی است.');
      return;
    }
    if (!itemCategory.trim()) {
      setItemError('دسته‌بندی موضوعی الزامی است.');
      return;
    }

    setIsSubmittingItem(true);
    setItemError(null);
    try {
      if (editingItem) {
        await onUpdateChecklistItem(activeTemplateId, {
          ...editingItem,
          title: itemTitle.trim(),
          category: itemCategory.trim(),
          requirement: itemRequirement.trim(),
          standardRef: itemStandardRef.trim() || undefined,
          isRequired: itemIsRequired,
          responseType: itemResponseType
        });
        setToast({ type: 'success', text: 'بند کنترلی با موفقیت به‌روزرسانی شد.' });
      } else {
        await onAddChecklistItem(activeTemplateId, {
          title: itemTitle.trim(),
          category: itemCategory.trim(),
          requirement: itemRequirement.trim(),
          standardRef: itemStandardRef.trim() || undefined,
          isRequired: itemIsRequired,
          responseType: itemResponseType
        });
        setToast({ type: 'success', text: 'بند کنترلی جدید با موفقیت به الگو اضافه شد.' });
      }
      handleCancelItemForm();
    } catch (err: any) {
      setItemError(err?.message || 'خطا در ذخیره‌سازی آیتم.');
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeletingItem(true);
    setDeleteItemError(null);
    try {
      await onDeleteChecklistItem(activeTemplateId, itemToDelete.id);
      setToast({ 
        type: 'success', 
        text: `بند «${itemToDelete.title}» با موفقیت از الگوی چک‌لیست حذف شد.` 
      });
      setItemToDelete(null);
    } catch (err: any) {
      setDeleteItemError(err?.message || 'خطا در حذف بند کنترلی از پایگاه داده.');
    } finally {
      setIsDeletingItem(false);
    }
  };

  const handleMoveItem = async (itemId: string, direction: 'up' | 'down') => {
    if (!currentTemplate || !onReorderChecklistItems) return;
    const items = [...currentTemplate.defaultItems];
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;

    const temp = items[index];
    items[index] = items[targetIdx];
    items[targetIdx] = temp;

    try {
      await onReorderChecklistItems(activeTemplateId, items);
      setToast({ type: 'success', text: 'ترتیب آیتم‌ها با موفقیت تغییر کرد.' });
    } catch (err: any) {
      setToast({ type: 'error', text: 'خطا در جابجایی آیتم.' });
    }
  };

  // --- TEMPLATE HANDLERS ---
  const handleOpenCreateTemplate = () => {
    setIsCreatingNewTemplate(true);
    setTmplId(`custom-${Date.now().toString(36)}`);
    setTmplTitleFa('');
    setTmplTitleEn('');
    setTmplCategoryFa('عملیات و تجهیزات');
    setTmplIconName('ShieldCheck');
    setTmplDescriptionFa('');
    setTmplStandardRef('HSE-MS Standard');
    setTmplDefaultFrequency('ماهانه و قبل از عملیات');
    setTmplIsActive(true);
    setTemplateError(null);
    setIsTemplateFormOpen(true);
  };

  const handleDuplicateTemplate = async (tmpl: SafetyChecklistTypeTemplate) => {
    const newId = `${tmpl.id}-copy-${Date.now().toString(36).slice(-4)}`;
    const duplicated: SafetyChecklistTypeTemplate = {
      ...JSON.parse(JSON.stringify(tmpl)),
      id: newId,
      titleFa: `${tmpl.titleFa} (نسخه سفارشی)`,
      titleEn: `${tmpl.titleEn} (Custom)`,
      isActive: true,
      defaultItems: (tmpl.defaultItems || []).map((it, idx) => ({
        ...it,
        id: `item-${newId}-${idx + 1}`,
        isCustom: true
      }))
    };
    try {
      await onSaveTemplate(duplicated);
      setActiveTemplateId(duplicated.id);
      setToast({ type: 'success', text: `نسخه جدیدی از «${tmpl.titleFa}» جهت ویرایش ایجاد و انتخاب شد.` });
    } catch (err: any) {
      setToast({ type: 'error', text: err?.message || 'خطا در کپی الگوی چک‌لیست.' });
    }
  };

  const handleRestoreDefaults = async () => {
    if (!onRestoreAllDefaults) return;
    setIsRestoringDefaults(true);
    try {
      await onRestoreAllDefaults();
      setToast({ type: 'success', text: 'تمامی چک‌لیست‌های استاندارد ماژول واحد ایمنی بازیابی و همگام‌سازی شدند.' });
    } catch (err: any) {
      setToast({ type: 'error', text: err?.message || 'خطا در بازیابی چک‌لیست‌های استاندارد.' });
    } finally {
      setIsRestoringDefaults(false);
    }
  };

  const handleSyncFromRecordedInspection = async (insp: OperationalSafetyInspection) => {
    if (!insp) return;
    const existingTmpl = templates.find(t => t.id === insp.checklistTypeId);
    const syncedItems: SafetyChecklistItem[] = (insp.items || []).map((it, idx) => ({
      id: it.itemId || `item-${insp.checklistTypeId}-${idx + 1}`,
      title: it.title,
      category: it.category || 'الزامات عمومی',
      requirement: it.requirement || '',
      standardRef: it.standardRef,
      isRequired: true,
      orderIndex: idx + 1
    }));

    const payload: SafetyChecklistTypeTemplate = existingTmpl
      ? {
          ...existingTmpl,
          defaultItems: syncedItems.length > 0 ? syncedItems : existingTmpl.defaultItems
        }
      : {
          id: insp.checklistTypeId || `insp-tmpl-${Date.now().toString(36)}`,
          titleFa: insp.checklistTypeNameFa || insp.title,
          titleEn: insp.checklistTypeId || 'Safety Checklist',
          categoryFa: 'چک‌لیست عملیاتی واحد ایمنی',
          iconName: 'ShieldCheck',
          descriptionFa: `الگوی پیکربندی‌شده بر اساس چک‌لیست ${insp.title} (${insp.id})`,
          standardRef: 'HSE-MS Standard',
          defaultFrequency: 'ماهانه و دوره‌ای',
          isActive: true,
          defaultItems: syncedItems
        };

    try {
      await onSaveTemplate(payload);
      setActiveTemplateId(payload.id);
      setToast({
        type: 'success',
        text: `چک‌لیست «${payload.titleFa}» (${syncedItems.length} بند) بارگذاری و آماده ویرایش شد.`
      });
    } catch (err: any) {
      setToast({ type: 'error', text: err?.message || 'خطا در بارگذاری چک‌لیست.' });
    }
  };

  const handleOpenEditTemplate = (tmpl: SafetyChecklistTypeTemplate) => {
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
      const payload: SafetyChecklistTypeTemplate = {
        id: tmplId.trim(),
        titleFa: tmplTitleFa.trim(),
        titleEn: tmplTitleEn.trim() || tmplTitleFa.trim(),
        categoryFa: tmplCategoryFa.trim() || 'عملیات و تجهیزات',
        iconName: tmplIconName,
        descriptionFa: tmplDescriptionFa.trim(),
        standardRef: tmplStandardRef.trim() || 'HSE Standard',
        defaultFrequency: tmplDefaultFrequency.trim() || 'دوره‌ای',
        isActive: tmplIsActive,
        defaultItems: isCreatingNewTemplate ? [] : (currentTemplate?.defaultItems || [])
      };

      await onSaveTemplate(payload);
      setActiveTemplateId(payload.id);
      setIsTemplateFormOpen(false);
      setToast({ 
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
      setToast({ 
        type: 'success', 
        text: `الگوی «${templateToDelete.titleFa}» با موفقیت حذف گردید.` 
      });
      setTemplateToDelete(null);
      // Switch active template to another existing one
      const remaining = templates.filter(t => t.id !== templateToDelete.id);
      if (remaining.length > 0) {
        setActiveTemplateId(remaining[0].id);
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
      await onResetTemplate(activeTemplateId);
      setToast({ 
        type: 'success', 
        text: `الگوی «${currentTemplate?.titleFa}» به وضعیت استاندارد پیش‌فرض بازنشانی شد.` 
      });
      setIsConfirmingReset(false);
    } catch (err: any) {
      setToast({ type: 'error', text: err?.message || 'خطا در بازنشانی الگو.' });
    } finally {
      setIsResetting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-white">
                مدیریت و پیکربندی الگوها و آیتم‌های چک‌لیست واحد ایمنی
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                انتخاب چک‌لیست‌های موجود در ماژول واحد ایمنی جهت ویرایش مشخصات، مدیریت بندهای کنترلی، مرتب‌سازی و ایجاد الگو
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRestoreAllDefaults && (
              <button
                type="button"
                disabled={isRestoringDefaults}
                onClick={handleRestoreDefaults}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="فراخوانی و بازیابی تمامی چک‌لیست‌های استاندارد واحد ایمنی"
              >
                <RotateCcw className={`w-3.5 h-3.5 text-blue-600 ${isRestoringDefaults ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">همگام‌سازی چک‌لیست‌های ماژول</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenCreateTemplate}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>ایجاد چک‌لیست جدید</span>
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

        {/* Feedback Toast */}
        {toast && (
          <div className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b animate-in fade-in duration-200 ${
            toast.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 text-emerald-800 dark:text-emerald-300' 
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 text-rose-800 dark:text-rose-300'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{toast.text}</span>
          </div>
        )}

        {/* Prominent Checklist Selection Panel (Dropdown + Existing Records Selector + Quick Pills) */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/30 space-y-3 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* 1. Primary Dropdown to Select Any Checklist Template in the Safety Module */}
            <div className="md:col-span-6 space-y-1">
              <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>انتخاب چک‌لیست موجود در ماژول جهت ویرایش و مدیریت:</span>
                </span>
                <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold">
                  {templates.length} چک‌لیست در ماژول
                </span>
              </label>
              <select
                value={activeTemplateId}
                onChange={e => handleSelectTemplate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-black bg-white dark:bg-slate-900 border-2 border-blue-500/50 dark:border-blue-500/40 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
              >
                {templates.map((tmpl, index) => {
                  const usedCount = inspections.filter(i => i.checklistTypeId === tmpl.id).length;
                  return (
                    <option key={tmpl.id} value={tmpl.id}>
                      {`${index + 1}. ${tmpl.titleFa} — [${tmpl.categoryFa}] (${tmpl.defaultItems?.length || 0} بند کنترلی${usedCount > 0 ? ` | ${usedCount} سابقه ثبت‌شده` : ''})${tmpl.isActive === false ? ' [غیرفعال]' : ''}`}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 2. Search Filter Input for Checklists */}
            <div className="md:col-span-3 space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                جستجو در بین چک‌لیست‌های ماژول:
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={templateSearchQuery}
                  onChange={e => setTemplateSearchQuery(e.target.value)}
                  placeholder="نام چک‌لیست، دسته‌بندی یا استاندارد..."
                  className="w-full pr-8 pl-3 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 3. Select from Recorded Inspections in Operational History (if any exist) */}
            <div className="md:col-span-3 space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>سوابق چک‌لیست‌های اجراشده ({inspections.length}):</span>
              </label>
              {inspections.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedRecordedInspectionId}
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedRecordedInspectionId(val);
                      const targetInsp = inspections.find(i => i.id === val);
                      if (targetInsp) {
                        if (templates.some(t => t.id === targetInsp.checklistTypeId)) {
                          handleSelectTemplate(targetInsp.checklistTypeId);
                        } else {
                          handleSyncFromRecordedInspection(targetInsp);
                        }
                      }
                    }}
                    className="flex-1 min-w-0 px-2.5 py-2.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="">انتخاب از سوابق بازرسی...</option>
                    {inspections.map(insp => (
                      <option key={insp.id} value={insp.id}>
                        {insp.id} - {insp.title} ({insp.checklistTypeNameFa})
                      </option>
                    ))}
                  </select>
                  {selectedRecordedInspectionId && onEditInspection && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetInsp = inspections.find(i => i.id === selectedRecordedInspectionId);
                        if (targetInsp) onEditInspection(targetInsp);
                      }}
                      className="px-2.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer transition"
                      title="ویرایش مستقیم این سابقه بازرسی"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="px-3 py-2.5 rounded-xl bg-white/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-400 truncate">
                  سابقه‌ای ثبت نشده (الگوها آماده ویرایش‌اند)
                </div>
              )}
            </div>
          </div>

          {/* Horizontal Quick-Select Pills for Checklists */}
          <div className="flex items-center gap-2 overflow-x-auto pt-1 custom-scrollbar">
            {filteredTemplates.map(tmpl => {
              const isSelected = tmpl.id === activeTemplateId;
              const isActive = tmpl.isActive !== false;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tmpl.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20 ring-2 ring-blue-400/40'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {getTemplateIcon(tmpl.iconName)}
                  <span>{tmpl.titleFa}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    {tmpl.defaultItems?.length || 0}
                  </span>
                  {!isActive && (
                    <span className="w-2 h-2 rounded-full bg-slate-400" title="الگوی غیرفعال" />
                  )}
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleOpenCreateTemplate}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-dashed border-blue-300 dark:border-blue-700 shrink-0 cursor-pointer transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ ایجاد الگوی جدید</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Active Template Info Bar */}
          {currentTemplate && !isTemplateFormOpen && (
            <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    {getTemplateIcon(currentTemplate.iconName)}
                    <span>{currentTemplate.titleFa}</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">({currentTemplate.titleEn})</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    currentTemplate.isActive !== false
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {currentTemplate.isActive !== false ? 'فعال' : 'غیرفعال'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                    {currentTemplate.categoryFa}
                  </span>
                </div>
                
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {currentTemplate.descriptionFa}
                </p>
                
                <div className="flex items-center gap-3 pt-1 text-[11px] text-blue-700 dark:text-blue-400 font-mono flex-wrap">
                  <span>مرجع: {currentTemplate.standardRef}</span>
                  <span>•</span>
                  <span>تواتر توصیه شده: {currentTemplate.defaultFrequency}</span>
                  <span>•</span>
                  <span>تعداد بندهای کنترلی: {currentTemplate.defaultItems?.length || 0} بند</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleOpenEditTemplate(currentTemplate)}
                  className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="ویرایش مشخصات الگو"
                >
                  <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>ویرایش مشخصات چک‌لیست</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDuplicateTemplate(currentTemplate)}
                  className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="ایجاد یک چک‌لیست جدید از روی این چک‌لیست"
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-600" />
                  <span>کپی الگو</span>
                </button>

                {templates.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setTemplateToDelete(currentTemplate)}
                    className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="حذف این الگو"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>حذف الگو</span>
                  </button>
                )}

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

                {!isAddingItem && !editingItem && (
                  <button
                    type="button"
                    onClick={handleStartAddItem}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-blue-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن بند کنترلی جدید</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Template Edit / Create Panel */}
          {isTemplateFormOpen && (
            <form onSubmit={handleSaveTemplate} className="bg-white dark:bg-slate-850 border-2 border-blue-500/40 rounded-2xl p-4 space-y-4 shadow-sm animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isCreatingNewTemplate ? 'ایجاد الگوی جدید چک‌لیست ایمنی' : 'ویرایش مشخصات و اطلاعات الگوی چک‌لیست'}</span>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    عنوان فارسی الگو <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={tmplTitleFa}
                    onChange={e => setTmplTitleFa(e.target.value)}
                    placeholder="مثال: چک‌لیست ایمنی جوشکاری و برشکاری..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    عنوان انگلیسی (کد الگو)
                  </label>
                  <input
                    type="text"
                    value={tmplTitleEn}
                    onChange={e => setTmplTitleEn(e.target.value)}
                    placeholder="e.g. Hot Work Safety Checklist"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-mono"
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
                    placeholder="مثال: شعله و حرارت، کار در ارتفاع..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    مرجع استاندارد
                  </label>
                  <input
                    type="text"
                    value={tmplStandardRef}
                    onChange={e => setTmplStandardRef(e.target.value)}
                    placeholder="مثال: OSHA 1910.252 / NFPA 51B"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    تواتر بازرسی پیش‌فرض
                  </label>
                  <input
                    type="text"
                    value={tmplDefaultFrequency}
                    onChange={e => setTmplDefaultFrequency(e.target.value)}
                    placeholder="مثال: ماهانه و قبل از شروع کار"
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs"
                  >
                    <option value="ShieldCheck">سپر ایمنی (ShieldCheck)</option>
                    <option value="Building2">داربست و سازه (Building2)</option>
                    <option value="Flame">حرارت و آتش (Flame)</option>
                    <option value="Box">فضای بسته (Box)</option>
                    <option value="Scale">باربرداری و قلاب (Scale)</option>
                    <option value="Shovel">حفاری و گود (Shovel)</option>
                    <option value="Zap">برق و انرژی (Zap)</option>
                    <option value="Truck">ماشین‌آلات (Truck)</option>
                    <option value="ShieldAlert">خطرات عمومی (ShieldAlert)</option>
                  </select>
                </div>

                <div className="sm:col-span-2 md:col-span-3 space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    شرح و دامنه کاربرد الگو
                  </label>
                  <textarea
                    rows={2}
                    value={tmplDescriptionFa}
                    onChange={e => setTmplDescriptionFa(e.target.value)}
                    placeholder="توضیح کوتاه در مورد دامنه بازرسی و فرآیندهای تحت پوشش این الگو..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs"
                  />
                </div>

                <div className="sm:col-span-2 md:col-span-3 flex items-center gap-3 pt-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tmplIsActive}
                      onChange={e => setTmplIsActive(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span>الگوی فعال (نمایش در فرم‌های ثبت چک‌لیست جدید)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsTemplateFormOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTemplate}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-600/20"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSubmittingTemplate ? 'در حال ثبت...' : 'ذخیره الگو'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Add / Edit Item Panel */}
          {(isAddingItem || editingItem) && (
            <form onSubmit={handleSaveItem} className="bg-white dark:bg-slate-850 border-2 border-blue-500/40 rounded-2xl p-4 space-y-4 shadow-sm animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>{editingItem ? 'ویرایش بند کنترلی چک‌لیست' : 'افزودن بند کنترلی جدید به الگو'}</span>
                </h4>
                <button
                  type="button"
                  onClick={handleCancelItemForm}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  انصراف
                </button>
              </div>

              {itemError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{itemError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    عنوان و شرح بند کنترلی <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={itemTitle}
                    onChange={e => setItemTitle(e.target.value)}
                    placeholder="مثال: بررسی استحکام فونداسیون، بیس پلیت و کفشک پایه‌ها..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500"
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
                    placeholder="مثال: پایه‌ها و فونداسیون، سکوی کار، تجهیزات فردی..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    مرجع استاندارد یا ماده قانونی
                  </label>
                  <input
                    type="text"
                    value={itemStandardRef}
                    onChange={e => setItemStandardRef(e.target.value)}
                    placeholder="مثال: OSHA 1926.451(c)(2) / BS EN 12811"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-mono"
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    معیار پذیرش استاندارد و شرایط مطلوب
                  </label>
                  <textarea
                    rows={2}
                    value={itemRequirement}
                    onChange={e => setItemRequirement(e.target.value)}
                    placeholder="معیار ارزیابی و حد مطلوب بودن شرایط کنترلی را شرح دهید..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs"
                  />
                </div>

                <div className="flex items-center gap-4 pt-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemIsRequired}
                      onChange={e => setItemIsRequired(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span>پاسخ‌دهی به این بند الزامی است</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleCancelItemForm}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingItem}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-600/20"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSubmittingItem ? 'در حال ثبت...' : 'ذخیره بند کنترلی'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Checklist Items Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2 flex-wrap">
                <span>فهرست بندهای کنترلی چک‌لیست انتخابی</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-mono text-[11px]">
                  {filteredItems.length} / {currentTemplate?.defaultItems?.length || 0} بند
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {availableItemCategories.length > 1 && (
                  <select
                    value={itemCategoryFilter}
                    onChange={e => setItemCategoryFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="ALL">همه دسته‌بندی‌ها ({availableItemCategories.length})</option>
                    {availableItemCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={itemSearchQuery}
                    onChange={e => setItemSearchQuery(e.target.value)}
                    placeholder="جستجو در بندهای این چک‌لیست..."
                    className="pr-8 pl-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 w-48 sm:w-56"
                  />
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {!currentTemplate?.defaultItems || currentTemplate.defaultItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  هیچ بند کنترلی برای این الگو تعریف نشده است. جهت ایجاد، روی دکمه «افزودن بند کنترلی جدید» کلیک کنید.
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  هیچ بند کنترلی مطابق با عبارت جستجو یا دسته‌بندی انتخاب‌شده یافت نشد.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const realIdx = (currentTemplate.defaultItems || []).findIndex(i => i.id === item.id);
                  return (
                    <div key={item.id} className="p-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                            {realIdx + 1}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                            {item.category}
                          </span>
                          {item.isCustom && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
                              سفارشی
                            </span>
                          )}
                          {item.standardRef && (
                            <span className="text-[10px] font-mono text-slate-400">
                              Ref: {item.standardRef}
                            </span>
                          )}
                          {item.isRequired === false && (
                            <span className="text-[10px] text-slate-400">
                              (اختیاری)
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-bold text-slate-900 dark:text-white pr-7 leading-relaxed">
                          {item.title}
                        </div>

                        {item.requirement && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 pr-7 leading-relaxed">
                            معیار پذیرش: {item.requirement}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 pt-1">
                        {/* Move Up / Down Buttons */}
                        {onReorderChecklistItems && (
                          <>
                            <button
                              type="button"
                              disabled={realIdx <= 0}
                              onClick={() => handleMoveItem(item.id, 'up')}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 rounded-lg transition cursor-pointer"
                              title="انتقال به بالا"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={realIdx === (currentTemplate.defaultItems?.length || 0) - 1}
                              onClick={() => handleMoveItem(item.id, 'down')}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 rounded-lg transition cursor-pointer"
                              title="انتقال به پایین"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => handleStartEditItem(item)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition cursor-pointer"
                          title="ویرایش بند کنترلی"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                          title="حذف بند کنترلی با تأیید"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>پیکربندی الگوها و آیتم‌ها در پایگاه داده مرکزی ذخیره شده و از تداخل با سوابق تاریخی جلوگیری می‌شود</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>

      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. Item Delete Confirmation Dialog */}
      {/* ───────────────────────────────────────────────────────────── */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900/50">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                تأیید حذف بند کنترلی چک‌لیست
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                آیا از حذف این بند کنترلی از الگوی <span className="font-bold text-slate-800 dark:text-slate-200">«{currentTemplate?.titleFa}»</span> اطمینان دارید؟
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-2 text-right">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold">دسته‌بندی:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50">
                  {itemToDelete.category}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">شرح بند کنترلی:</span>
                <strong className="text-slate-900 dark:text-white leading-snug block">
                  {itemToDelete.title}
                </strong>
              </div>
              {itemToDelete.requirement && (
                <div className="text-[11px] text-slate-500 leading-relaxed pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">معیار پذیرش:</span>
                  <span>{itemToDelete.requirement}</span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>با حذف این بند، در چک‌لیست‌های جدید درج نخواهد شد اما سوابق ثبت‌شده گذشته در پایگاه داده بدون تغییر حفظ می‌گردند.</span>
            </div>

            {deleteItemError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteItemError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingItem}
                onClick={() => {
                  setItemToDelete(null);
                  setDeleteItemError(null);
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
                    <span>حذف قطعی بند</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. Template Delete Confirmation Dialog */}
      {/* ───────────────────────────────────────────────────────────── */}
      {templateToDelete && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900/50">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                تأیید حذف الگوی کامل چک‌لیست
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                آیا از حذف الگوی چک‌لیست <span className="font-bold text-slate-900 dark:text-white">«{templateToDelete.titleFa}»</span> شامل <span className="font-bold">{templateToDelete.defaultItems?.length || 0} بند کنترلی</span> اطمینان دارید؟
              </p>
            </div>

            <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>تمام بازرسی‌ها و سوابق ثبت‌شده گذشته با این الگو در سامانه حفظ خواهند ماند و هیچ داده تاریخی مخدوش نخواهد شد.</span>
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
                    <span>در حال حذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف قطعی الگو</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. Reset Template Confirmation Dialog */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isConfirmingReset && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-900/50">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                بازنشانی به الگوی استاندارد پیش‌فرض
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                آیا مایلید تمام بندهای الگوی <span className="font-bold text-slate-900 dark:text-white">«{currentTemplate?.titleFa}»</span> به مقادیر اولیه و رسمی استاندارد سامانه بازنشانی گردند؟
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
                  <span>در حال بازنشانی...</span>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تأیید بازنشانی</span>
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
