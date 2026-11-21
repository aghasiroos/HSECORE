import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Settings2,
  Check,
  ToggleLeft,
  ToggleRight,
  Flame,
  Snowflake,
  Layers,
  HelpCircle,
  ShieldAlert
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  PermitCustomField,
  PermitFieldType,
  PermitFieldScope,
  PermitFieldSection,
  PERMIT_FIELD_SECTIONS,
  fetchPermitFieldConfigs,
  savePermitFieldConfigs,
  addPermitField,
  updatePermitField,
  deletePermitField,
  resetToDefaultFields
} from './services/permitFieldConfigService';
import { toast } from 'react-hot-toast';
import { showConfirmDialog } from '../common/ConfirmDialogModal';

interface PermitFieldManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFa?: boolean;
  currentUser?: UserProfile;
}

export const PermitFieldManagerModal: React.FC<PermitFieldManagerModalProps> = ({
  isOpen,
  onClose,
  isFa = true,
  currentUser
}) => {
  const [fields, setFields] = useState<PermitCustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'All' | 'Both' | 'Hot' | 'Cold'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit / Create Form State
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<{
    labelFa: string;
    key: string;
    type: PermitFieldType;
    scope: PermitFieldScope;
    section: PermitFieldSection;
    required: boolean;
    isActive: boolean;
    placeholder: string;
    description: string;
    optionsText: string;
    defaultValue: string;
  }>({
    labelFa: '',
    key: '',
    type: 'text',
    scope: 'Both',
    section: 'general',
    required: false,
    isActive: true,
    placeholder: '',
    description: '',
    optionsText: '',
    defaultValue: ''
  });

  const isAuthorized = !currentUser || 
    currentUser.role === 'Administrator' || 
    currentUser.role === 'HSE Manager' || 
    currentUser.role === 'Safety Officer' || 
    (currentUser as any).role === 'admin' ||
    Boolean(currentUser.permissions && currentUser.permissions['PTW']?.edit);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await fetchPermitFieldConfigs(true);
      setFields(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const filteredFields = fields.filter(f => {
    if (activeTab !== 'All') {
      if (activeTab === 'Both' && f.scope !== 'Both') return false;
      if (activeTab === 'Hot' && f.scope !== 'Hot') return false;
      if (activeTab === 'Cold' && f.scope !== 'Cold') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        f.labelFa.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        (f.labelEn && f.labelEn.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleStartAdd = () => {
    setEditingFieldId(null);
    setFormData({
      labelFa: '',
      key: '',
      type: 'text',
      scope: activeTab === 'Hot' ? 'Hot' : activeTab === 'Cold' ? 'Cold' : 'Both',
      section: 'general',
      required: false,
      isActive: true,
      placeholder: '',
      description: '',
      optionsText: '',
      defaultValue: ''
    });
    setShowAddForm(true);
  };

  const handleStartEdit = (f: PermitCustomField) => {
    setEditingFieldId(f.id);
    setFormData({
      labelFa: f.labelFa,
      key: f.key,
      type: f.type,
      scope: f.scope,
      section: f.section,
      required: f.required,
      isActive: f.isActive,
      placeholder: f.placeholder || '',
      description: f.description || '',
      optionsText: (f.options || []).join('\n'),
      defaultValue: f.defaultValue ? String(f.defaultValue) : ''
    });
    setShowAddForm(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.labelFa.trim()) return;

    let fieldKey = formData.key.trim();
    if (!fieldKey) {
      fieldKey = 'f_' + Math.random().toString(36).substring(2, 8);
    }

    const options = formData.type === 'select'
      ? formData.optionsText.split('\n').map(o => o.trim()).filter(Boolean)
      : undefined;

    const payload = {
      labelFa: formData.labelFa.trim(),
      key: fieldKey,
      type: formData.type,
      scope: formData.scope,
      section: formData.section,
      sectionTitleFa: PERMIT_FIELD_SECTIONS.find(s => s.id === formData.section)?.titleFa,
      required: formData.required,
      isActive: formData.isActive,
      placeholder: formData.placeholder.trim() || undefined,
      description: formData.description.trim() || undefined,
      defaultValue: formData.defaultValue ? formData.defaultValue : undefined,
      options
    };

    if (editingFieldId) {
      await updatePermitField(editingFieldId, payload);
      showToast('فیلد با موفقیت ویرایش و ذخیره گردید.');
    } else {
      await addPermitField(payload);
      showToast('فیلد سفارشی جدید با موفقیت افزوده شد.');
    }

    setShowAddForm(false);
    setEditingFieldId(null);
    await loadData();
  };

  const handleToggleActive = async (f: PermitCustomField) => {
    if (!isAuthorized) {
      toast.error('شما مجوز تغییر وضعیت فیلدهای فرم را ندارید.');
      return;
    }
    await updatePermitField(f.id, { isActive: !f.isActive });
    await loadData();
    showToast(f.isActive ? 'فیلد غیرفعال شد.' : 'فیلد فعال شد.');
  };

  const handleDelete = async (id: string) => {
    if (!isAuthorized) {
      toast.error('شما مجوز حذف فیلدهای فرم را ندارید.');
      return;
    }
    const f = fields.find(item => item.id === id);
    if (!f) return;

    const confirmed = await showConfirmDialog({
      title: 'غیرفعال‌سازی فیلد فرم',
      message: `آیا از غیرفعال‌سازی فیلد «${f.labelFa}» اطمینان دارید؟ جهت حفظ یکپارچگی اطلاعات تاریخی، داده‌های پروانه‌های ثبت‌شده قبلی کاملاً در دیتابیس محفوظ خواهند ماند.`,
      confirmLabel: 'غیرفعال‌سازی',
      cancelLabel: 'انصراف',
      tone: 'warning',
    });
    if (confirmed) {
      // Soft-delete: mark inactive without erasing field definition
      await deletePermitField(id, false);
      await loadData();
      showToast('فیلد غیرفعال شد و اطلاعات رکوردهای قبلی حفظ گردید.');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (!isAuthorized) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= fields.length) return;

    const copy = [...fields];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);

    setFields(copy);
    await savePermitFieldConfigs(copy);
  };

  const handleResetDefaults = async () => {
    if (!isAuthorized) {
      toast.error('شما مجوز بازنشانی تنظیمات فرم را ندارید.');
      return;
    }
    const confirmed = await showConfirmDialog({
      title: 'بازنشانی تنظیمات فرم',
      message: 'آیا مایل به بازنشانی فیلدها به تنظیمات کارخانه و استانداردهای اولیه هستید؟',
      confirmLabel: 'بازنشانی',
      cancelLabel: 'انصراف',
      tone: 'warning',
    });
    if (confirmed) {
      const reset = await resetToDefaultFields();
      setFields(reset);
      showToast('فیلدها به حالت استاندارد کارخانه بازنشانی شدند.');
    }
  };

  const getTypeLabel = (type: PermitFieldType) => {
    switch (type) {
      case 'text': return 'متن کوتاه';
      case 'number': return 'عدد';
      case 'textarea': return 'چندخطی';
      case 'select': return 'لیست انتخابی';
      case 'checkbox': return 'چک‌باکس (بله/خیر)';
      case 'date': return 'تاریخ شمسی';
      case 'time': return 'ساعت';
      default: return type;
    }
  };

  const getScopeBadge = (scope: PermitFieldScope) => {
    switch (scope) {
      case 'Hot':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800">
            <Flame className="w-3 h-3 text-red-600" />
            اختصاصی کار گرم
          </span>
        );
      case 'Cold':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Snowflake className="w-3 h-3 text-blue-600" />
            اختصاصی کار سرد
          </span>
        );
      case 'Both':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Layers className="w-3 h-3 text-slate-600" />
            مشترک (گرم و سرد)
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        dir={isFa ? 'rtl' : 'ltr'}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                مدیریت و پیکربندی فیلدهای پروانه کار (گرم و سرد)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                شخصی‌سازی فیلدهای ورودی، الزامات، نوع داده و چیدمان فرم‌ها در پایگاه داده
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mx-5 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Navigation Tabs & Actions Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('All')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'All'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              همه ({fields.length})
            </button>
            <button
              onClick={() => setActiveTab('Both')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'Both'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              مشترک ({fields.filter(f => f.scope === 'Both').length})
            </button>
            <button
              onClick={() => setActiveTab('Hot')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                activeTab === 'Hot'
                  ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-red-600'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              اختصاصی گرم ({fields.filter(f => f.scope === 'Hot').length})
            </button>
            <button
              onClick={() => setActiveTab('Cold')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                activeTab === 'Cold'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-blue-600'
              }`}
            >
              <Snowflake className="w-3.5 h-3.5" />
              اختصاصی سرد ({fields.filter(f => f.scope === 'Cold').length})
            </button>
          </div>

          {/* Search & Add Button */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="جستجو در فیلدها..."
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-48"
            />
            {isAuthorized ? (
              <>
                <button
                  onClick={handleStartAdd}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>فیلد جدید</span>
                </button>
                <button
                  onClick={handleResetDefaults}
                  title="بازنشانی فیلدها به حالت استاندارد"
                  className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </>
            ) : (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>مشاهده (فقط خواندنی)</span>
              </span>
            )}
          </div>
        </div>

        {/* Modal Body / Field List or Form */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
          {showAddForm ? (
            /* Field Add / Edit Form */
            <form onSubmit={handleSaveForm} className="space-y-4 max-w-2xl mx-auto bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-blue-600" />
                  {editingFieldId ? 'ویرایش فیلد پروانه کار' : 'تعریف فیلد جدید در پروانه کار'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  انصراف
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    عنوان فارسی فیلد <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.labelFa}
                    onChange={e => setFormData({ ...formData, labelFa: e.target.value })}
                    placeholder="مثلاً: دمای محفظه، نوع کپسول و..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    کلید سیستمی فیلد (Key)
                  </label>
                  <input
                    type="text"
                    value={formData.key}
                    onChange={e => setFormData({ ...formData, key: e.target.value })}
                    placeholder="اختیاری - شناسه انگلیسی در دیتابیس"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نوع داده فیلد
                  </label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as PermitFieldType })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="text">متن کوتاه (Text)</option>
                    <option value="number">عدد (Number)</option>
                    <option value="textarea">توضیحات چندخطی (Textarea)</option>
                    <option value="select">لیست کشویی انتخابی (Select Box)</option>
                    <option value="checkbox">تاییدیه دو وضعیتی (Checkbox)</option>
                    <option value="date">تاریخ شمسی (Date)</option>
                    <option value="time">ساعت (Time)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    قلمرو و نوع پروانه کار
                  </label>
                  <select
                    value={formData.scope}
                    onChange={e => setFormData({ ...formData, scope: e.target.value as PermitFieldScope })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Both">مشترک در هر دو پروانه گرم و سرد</option>
                    <option value="Hot">فقط اختصاصی پروانه کار گرم (Hot Work)</option>
                    <option value="Cold">فقط اختصاصی پروانه کار سرد (Cold Work)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    بخش فرم جهت نمایش فیلد
                  </label>
                  <select
                    value={formData.section}
                    onChange={e => setFormData({ ...formData, section: e.target.value as PermitFieldSection })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {PERMIT_FIELD_SECTIONS.map(sec => (
                      <option key={sec.id} value={sec.id}>{sec.titleFa}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    متن راهنما (Placeholder)
                  </label>
                  <input
                    type="text"
                    value={formData.placeholder}
                    onChange={e => setFormData({ ...formData, placeholder: e.target.value })}
                    placeholder="متن کم‌رنگ داخل فیلد..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {formData.type === 'select' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    گزینه‌های انتخابی (هر گزینه در یک سطر جدید)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.optionsText}
                    onChange={e => setFormData({ ...formData, optionsText: e.target.value })}
                    placeholder="گزینه اول&#10;گزینه دوم&#10;گزینه سوم"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  توضیحات تکمیلی یا دستورالعمل ایمنی
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="توضیح کوتاه زیر عنوان فیلد برای راهنمایی کاربران..."
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Toggles: Required & Active */}
              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={formData.required}
                    onChange={e => setFormData({ ...formData, required: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>تکمیل این فیلد اجباری است</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>وضعیت فیلد فعال باشد</span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-colors"
                >
                  {editingFieldId ? 'ذخیره تغییرات' : 'افزودن فیلد به فرم'}
                </button>
              </div>
            </form>
          ) : (
            /* Fields Table / List */
            <div className="space-y-3">
              {filteredFields.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <HelpCircle className="w-12 h-12 mx-auto mb-2 stroke-[1.5]" />
                  <p className="text-sm font-medium">هیچ فیلدی با معیارهای انتخابی یافت نشد.</p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredFields.map((field, idx) => (
                    <div
                      key={field.id}
                      className={`p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        field.isActive
                          ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          : 'bg-slate-100/70 dark:bg-slate-800/30 opacity-60'
                      }`}
                    >
                      {/* Left: Info */}
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                          {isAuthorized && (
                            <button
                              disabled={idx === 0}
                              onClick={() => handleMove(idx, 'up')}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded"
                              title="انتقال به بالا"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            {idx + 1}
                          </span>
                          {isAuthorized && (
                            <button
                              disabled={idx === filteredFields.length - 1}
                              onClick={() => handleMove(idx, 'down')}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded"
                              title="انتقال به پایین"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                              {field.labelFa}
                            </span>
                            {getScopeBadge(field.scope)}
                            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                              {getTypeLabel(field.type)}
                            </span>
                            {field.required && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900 px-1.5 py-0.2 rounded">
                                اجباری *
                              </span>
                            )}
                            {!field.isActive && (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                غیرفعال
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                            <span className="font-mono">کلید: {field.key}</span>
                            <span>بخش: {field.sectionTitleFa || field.section}</span>
                            {field.options && field.options.length > 0 && (
                              <span>گزینه‌ها: {field.options.length} مورد</span>
                            )}
                            {field.description && (
                              <span className="text-slate-500 dark:text-slate-400 italic">
                                ({field.description})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      {isAuthorized && (
                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                          <button
                            onClick={() => handleToggleActive(field)}
                            className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
                              field.isActive
                                ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                            title={field.isActive ? 'غیرفعال‌سازی فیلد' : 'فعال‌سازی فیلد'}
                          >
                            {field.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                          <button
                            onClick={() => handleStartEdit(field)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                            title="ویرایش فیلد"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(field.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                            title="غیرفعال‌سازی / حذف فیلد"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-500">
          <span>
            تغییرات فیلدها بلافاصله در پروانه‌های جدید و سوابق ثبت‌شده در پایگاه داده اعمال می‌گردند.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 font-bold bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-xl hover:opacity-90 transition-opacity"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
