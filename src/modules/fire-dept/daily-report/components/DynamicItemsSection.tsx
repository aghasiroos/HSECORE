import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, Check, X, Sliders, 
  Sparkles, Layers, BookmarkPlus, DownloadCloud, AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
  DynamicReportCustomItem, 
  EquipmentOperationalStatus 
} from '../types/dailyReportTypes';
import { fireDailyReportService } from '../services/dailyReportService';

interface Props {
  tabId: string;
  tabTitleFa: string;
  items: DynamicReportCustomItem[];
  onChange: (items: DynamicReportCustomItem[]) => void;
  isFa?: boolean;
}

const STATUS_OPTIONS: EquipmentOperationalStatus[] = [
  'سالم / نرمال',
  'دارای نقص',
  'در حال سرویس',
  'خارج از مدار',
  'تست شده'
];

export default function DynamicItemsSection({
  tabId,
  tabTitleFa,
  items,
  onChange,
  isFa = true
}: Props) {
  // Filter items belonging to this specific tab
  const tabItems = items.filter(item => item.tabId === tabId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DynamicReportCustomItem | null>(null);

  // Form inputs
  const [formNameFa, setFormNameFa] = useState('');
  const [formCategoryFa, setFormCategoryFa] = useState('');
  const [formItemType, setFormItemType] = useState<'status' | 'number' | 'text' | 'boolean'>('number');
  const [formUnit, setFormUnit] = useState('عدد');
  const [formStatusValue, setFormStatusValue] = useState<EquipmentOperationalStatus>('سالم / نرمال');
  const [formNumericValue, setFormNumericValue] = useState<number>(0);
  const [formTextValue, setFormTextValue] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const [saveAsTemplate, setSaveAsTemplate] = useState(true);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormNameFa('');
    setFormCategoryFa(tabTitleFa);
    setFormItemType('number');
    setFormUnit('عدد');
    setFormStatusValue('سالم / نرمال');
    setFormNumericValue(0);
    setFormTextValue('');
    setFormNotes('');
    setSaveAsTemplate(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: DynamicReportCustomItem) => {
    setEditingItem(item);
    setFormNameFa(item.nameFa);
    setFormCategoryFa(item.categoryFa || tabTitleFa);
    setFormItemType(item.itemType || 'number');
    setFormUnit(item.unit || '');
    setFormStatusValue((item.statusValue as EquipmentOperationalStatus) || 'سالم / نرمال');
    setFormNumericValue(item.numericValue ?? 0);
    setFormTextValue(item.textValue || '');
    setFormNotes(item.notes || '');
    setSaveAsTemplate(false);
    setIsModalOpen(true);
  };

  const handleSaveModal = async () => {
    if (!formNameFa.trim()) {
      toast.error(isFa ? 'لطفاً نام آیتم را وارد نمایید.' : 'Please enter item name.');
      return;
    }

    const newItem: DynamicReportCustomItem = {
      id: editingItem?.id || `dyn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      tabId,
      categoryFa: formCategoryFa.trim() || tabTitleFa,
      nameFa: formNameFa.trim(),
      itemType: formItemType,
      unit: formUnit.trim(),
      statusValue: formItemType === 'status' ? formStatusValue : undefined,
      numericValue: formItemType === 'number' ? Number(formNumericValue) : undefined,
      textValue: formItemType === 'text' ? formTextValue : undefined,
      notes: formNotes.trim() || undefined
    };

    let updatedList: DynamicReportCustomItem[];
    if (editingItem) {
      updatedList = items.map(it => it.id === editingItem.id ? newItem : it);
      toast.success(isFa ? `آیتم «${newItem.nameFa}» به‌روزرسانی شد.` : 'Item updated.');
    } else {
      updatedList = [...items, newItem];
      toast.success(isFa ? `آیتم جدید «${newItem.nameFa}» به این تب افزوده شد.` : 'Item added.');
    }

    onChange(updatedList);
    setIsModalOpen(false);

    // Save as persistent global template in پایگاه داده if requested
    if (saveAsTemplate && !editingItem) {
      try {
        const templates = await fireDailyReportService.getCustomFieldsTemplates();
        if (!templates.some(t => t.nameFa === newItem.nameFa && t.tabId === newItem.tabId)) {
          await fireDailyReportService.saveCustomFieldsTemplates([...templates, newItem]);
        }
      } catch (err) {
        console.warn('Failed to save field template to database:', err);
      }
    }
  };

  const handleDeleteItem = (itemId: string, itemName: string) => {
    const filtered = items.filter(it => it.id !== itemId);
    onChange(filtered);
    toast.success(isFa ? `آیتم «${itemName}» از این گزارش حذف شد.` : 'Item removed.');
  };

  const handleUpdateItemValue = (itemId: string, patch: Partial<DynamicReportCustomItem>) => {
    const updated = items.map(it => it.id === itemId ? { ...it, ...patch } : it);
    onChange(updated);
  };

  const handleLoadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const templates = await fireDailyReportService.getCustomFieldsTemplates();
      const tabTemplates = templates.filter(t => t.tabId === tabId);
      if (tabTemplates.length === 0) {
        toast(isFa ? 'الگوی ذخیره‌شده‌ای برای این تب در پایگاه داده وجود ندارد.' : 'No saved templates for this tab.');
        return;
      }

      // Add templates not already in the report
      let addedCount = 0;
      const newItems = [...items];
      tabTemplates.forEach(t => {
        if (!newItems.some(existing => existing.nameFa === t.nameFa && existing.tabId === t.tabId)) {
          newItems.push({
            ...t,
            id: `dyn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
          });
          addedCount++;
        }
      });

      if (addedCount > 0) {
        onChange(newItems);
        toast.success(isFa ? `${addedCount} آیتم از الگوهای دیتابیس بارگذاری شد.` : `${addedCount} items loaded.`);
      } else {
        toast(isFa ? 'تمامی آیتم‌های الگو در حال حاضر در گزارش وجود دارند.' : 'All template items already present.');
      }
    } catch {
      toast.error(isFa ? 'خطا در دریافت الگوها از پایگاه داده.' : 'Error loading templates.');
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  return (
    <div className="pt-4 border-t border-slate-200 dark:border-slate-700/80 space-y-3">
      {/* Header of Dynamic Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-gradient-to-r from-slate-100 to-indigo-50/50 dark:from-slate-800/80 dark:to-indigo-950/20 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>{isFa ? `آیتم‌ها و فیلدهای داینامیک تب «${tabTitleFa}»` : `Dynamic Custom Items (${tabTitleFa})`}</span>
              {tabItems.length > 0 && (
                <span className="bg-indigo-600 text-white font-mono text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {tabItems.length}
                </span>
              )}
            </h4>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
              {isFa 
                ? 'امکان تعریف، ویرایش و حذف نامحدود فیلدها و سنجه‌های تخصصی بدون تغییر در کدهای سامانه' 
                : 'Add, edit and delete dynamic items saved in database without code changes'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLoadTemplates}
            disabled={isLoadingTemplates}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title={isFa ? 'بارگذاری آیتم‌های پیش‌فرض این تب از پایگاه داده' : 'Load from Database Templates'}
          >
            <DownloadCloud className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-[11px]">{isFa ? 'بارگذاری از الگوها' : 'Load Templates'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[11px]">{isFa ? 'افزودن آیتم داینامیک' : 'Add Custom Item'}</span>
          </button>
        </div>
      </div>

      {/* Grid of Dynamic Items */}
      {tabItems.length === 0 ? (
        <div className="p-3 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/20 text-slate-400 text-xs flex items-center justify-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>
            {isFa 
              ? 'در حال حاضر آیتم داینامیک اختصاصی برای این تب ثبت نشده است (جهت افزودن سنجه جدید روی دکمه بالا کلیک کنید).' 
              : 'No dynamic items in this tab yet. Click above to add.'}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {tabItems.map(item => (
            <div 
              key={item.id} 
              className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-indigo-200/70 dark:border-indigo-900/40 shadow-xs space-y-2 hover:border-indigo-400 dark:hover:border-indigo-700 transition"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">
                      {item.nameFa}
                    </span>
                    {item.categoryFa && item.categoryFa !== tabTitleFa && (
                      <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                        {item.categoryFa}
                      </span>
                    )}
                  </div>
                  {item.unit && (
                    <span className="text-[10px] text-slate-400 font-normal">
                      {isFa ? `واحد: ${item.unit}` : `Unit: ${item.unit}`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition cursor-pointer"
                    title={isFa ? 'ویرایش پارامتر' : 'Edit item'}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id, item.nameFa)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                    title={isFa ? 'حذف پارامتر' : 'Delete item'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Value Input by Item Type */}
              <div className="pt-1 border-t border-slate-100 dark:border-slate-700/60">
                {item.itemType === 'status' && (
                  <select
                    value={item.statusValue || 'سالم / نرمال'}
                    onChange={(e) => handleUpdateItemValue(item.id, { statusValue: e.target.value as EquipmentOperationalStatus })}
                    className={`w-full text-xs p-1.5 rounded-lg font-bold border ${
                      item.statusValue === 'دارای نقص' || item.statusValue === 'خارج از مدار'
                        ? 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200'
                        : item.statusValue === 'در حال سرویس'
                        ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200'
                    }`}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}

                {item.itemType === 'number' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateItemValue(item.id, { numericValue: Math.max(0, (item.numericValue || 0) - 1) })}
                      className="w-7 h-7 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-lg font-bold text-xs flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={item.numericValue ?? 0}
                      onChange={(e) => handleUpdateItemValue(item.id, { numericValue: Number(e.target.value) || 0 })}
                      className="flex-1 text-center font-mono font-black text-xs p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateItemValue(item.id, { numericValue: (item.numericValue || 0) + 1 })}
                      className="w-7 h-7 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-lg font-bold text-xs flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                    {item.unit && (
                      <span className="text-[11px] text-slate-500 font-semibold px-1">{item.unit}</span>
                    )}
                  </div>
                )}

                {item.itemType === 'text' && (
                  <input
                    type="text"
                    value={item.textValue || ''}
                    placeholder={isFa ? 'مقدار متنی یا شرح وضعیت...' : 'Text value...'}
                    onChange={(e) => handleUpdateItemValue(item.id, { textValue: e.target.value })}
                    className="w-full text-xs p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg"
                  />
                )}

                {item.itemType === 'boolean' && (
                  <label className="flex items-center gap-2 cursor-pointer p-1">
                    <input
                      type="checkbox"
                      checked={Boolean(item.numericValue)}
                      onChange={(e) => handleUpdateItemValue(item.id, { numericValue: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {item.numericValue ? (isFa ? 'فعال / تأیید شده' : 'Active / Passed') : (isFa ? 'غیرفعال / نامساعد' : 'Inactive')}
                    </span>
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for Adding / Editing Dynamic Item */}
      {isModalOpen && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3" dir={isFa ? 'rtl' : 'ltr'}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg p-5 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  {editingItem 
                    ? (isFa ? 'ویرایش مشخصات آیتم داینامیک' : 'Edit Dynamic Item')
                    : (isFa ? `افزودن آیتم داینامیک به تب «${tabTitleFa}»` : `Add Dynamic Item to ${tabTitleFa}`)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Item Name */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'عنوان / نام فیلد یا پارامتر :' : 'Item Title / Name :'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={isFa ? 'مثلاً: مانیتور اطفاء کفی، نازل توربوجت، سطح آب مخزن...' : 'e.g. Foam Monitor, Turbo Nozzle...'}
                  value={formNameFa}
                  onChange={(e) => setFormNameFa(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-bold"
                  autoFocus
                />
              </div>

              {/* Category & Field Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'دسته‌بندی / گروه :' : 'Category :'}
                  </label>
                  <input
                    type="text"
                    value={formCategoryFa}
                    onChange={(e) => setFormCategoryFa(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'نوع فیلد ورودی :' : 'Input Type :'}
                  </label>
                  <select
                    value={formItemType}
                    onChange={(e) => setFormItemType(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-bold cursor-pointer"
                  >
                    <option value="number">{isFa ? 'عددی (Number / Stepper)' : 'Number'}</option>
                    <option value="status">{isFa ? 'وضعیت عملیاتی (Status Select)' : 'Operational Status'}</option>
                    <option value="text">{isFa ? 'متنی (Text / Description)' : 'Text'}</option>
                    <option value="boolean">{isFa ? 'بلی / خیر (Boolean Toggle)' : 'Boolean'}</option>
                  </select>
                </div>
              </div>

              {/* Unit (if number) */}
              {formItemType === 'number' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isFa ? 'واحد اندازه‌گیری :' : 'Unit :'}
                    </label>
                    <input
                      type="text"
                      placeholder="عدد، دستگاه، مورد، bar، ppm..."
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isFa ? 'مقدار اولیه :' : 'Initial Value :'}
                    </label>
                    <input
                      type="number"
                      value={formNumericValue}
                      onChange={(e) => setFormNumericValue(Number(e.target.value) || 0)}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-mono font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Status Select (if status) */}
              {formItemType === 'status' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'وضعیت اولیه :' : 'Initial Status :'}
                  </label>
                  <select
                    value={formStatusValue}
                    onChange={(e) => setFormStatusValue(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-bold cursor-pointer"
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'یادداشت یا استاندارد مرجع (اختیاری) :' : 'Notes / Standard (optional) :'}
                </label>
                <input
                  type="text"
                  placeholder={isFa ? 'توضیحات و مشخصات تکمیلی...' : 'Additional notes...'}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                />
              </div>

              {/* Save as Global Template in پایگاه داده */}
              {!editingItem && (
                <label className="flex items-center gap-2 p-2 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300">
                    {isFa 
                      ? 'ذخیره در الگوی دائمی پایگاه داده (در فرم‌های آینده نیز این آیتم در دسترس خواهد بود)' 
                      : 'Save as database template for future reports'}
                  </span>
                </label>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>{editingItem ? (isFa ? 'ذخیره تغییرات' : 'Save Changes') : (isFa ? 'افزودن آیتم' : 'Add Item')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
