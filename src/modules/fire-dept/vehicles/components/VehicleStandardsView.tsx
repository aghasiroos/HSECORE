import React, { useState } from 'react';
import { Award, BookOpen, Plus, ExternalLink, ShieldCheck, Check, Edit3, Trash2 } from 'lucide-react';
import { VehicleStandard } from '../types/vehicleTypes';
import ConfirmDeleteModal from '../../../../components/common/ConfirmDeleteModal';

interface Props {
  language: 'fa' | 'en';
  standards: VehicleStandard[];
  onAddStandard: (std: Omit<VehicleStandard, 'id'>) => void;
  onUpdateStandard: (id: string, std: Partial<VehicleStandard>) => void;
  onDeleteStandard: (id: string) => void;
}

export default function VehicleStandardsView({
  language,
  standards,
  onAddStandard,
  onUpdateStandard,
  onDeleteStandard
}: Props) {
  const isFa = language === 'fa';
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingStandard, setDeletingStandard] = useState<VehicleStandard | null>(null);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState<'NFPA' | 'EN' | 'ISO' | 'ISIRI' | 'OSHA'>('NFPA');
  const [description, setDescription] = useState('');
  const [revisionYear, setRevisionYear] = useState('2022');
  const [scope, setScope] = useState('');
  const [category, setCategory] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddStandard({
      code,
      title,
      organization,
      description,
      revisionYear,
      scope,
      linkedCategories: category ? [category] : ['سیستم اطفاء']
    });
    setShowAddModal(false);
    setCode('');
    setTitle('');
    setDescription('');
    setScope('');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-600 text-white rounded-2xl shadow-xs">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">
              {isFa ? 'پایگاه استانداردها و الزامات فنی خودروهای آتش‌نشانی' : 'Fire Vehicle Technical Standards & NFPA / EN Library'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isFa ? 'اتصال خودکار آیتم‌های بازرسی به استانداردهای بین‌المللی NFPA 1901, NFPA 1911, EN 1846' : 'Standard linking, compliance criteria and revision tracking'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isFa ? 'افزودن استاندارد جدید' : 'Add Standard'}</span>
        </button>
      </div>

      {/* Standards Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {standards.map(std => (
          <div
            key={std.id}
            className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-mono font-black text-xs rounded-xl">
                  {std.code}
                </span>
                <span className="text-[11px] font-bold text-slate-400 font-mono">
                  {std.organization || 'NFPA'} • {std.revisionYear || std.version || '2023'}
                </span>
              </div>

              <h3 className="font-black text-xs text-slate-900 dark:text-white">
                {std.title}
              </h3>

              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3">
                {std.description || std.requirement}
              </p>

              {(std.scope || std.allowedLimit) && (
                <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{isFa ? 'دامنه کاربرد / حد مجاز:' : 'Scope / Limits:'} </span>
                  <span>{std.scope || std.allowedLimit}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {(std.linkedCategories || ['سیستم اطفاء']).map((c, idx) => (
                  <span key={idx} className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md text-[10px] font-bold">
                    {c}
                  </span>
                ))}
              </div>

              <button
                onClick={() => setDeletingStandard(std)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer transition-colors"
                title={isFa ? 'حذف استاندارد' : 'Delete'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg overflow-hidden animate-scaleIn">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-600" />
                <span>{isFa ? 'ثبت استاندارد مرجع جدید' : 'New Standard'}</span>
              </h3>
              <button onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">{isFa ? 'کد استاندارد:' : 'Code:'}</label>
                  <input
                    type="text"
                    placeholder="مثال: NFPA 1912"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-mono outline-none font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">{isFa ? 'سازمان مرجع:' : 'Org:'}</label>
                  <select
                    value={organization}
                    onChange={e => setOrganization(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold outline-none"
                  >
                    <option value="NFPA">NFPA</option>
                    <option value="EN">EN</option>
                    <option value="ISO">ISO</option>
                    <option value="ISIRI">ISIRI (استاندارد ملی ایران)</option>
                    <option value="OSHA">OSHA</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">{isFa ? 'عنوان استاندارد:' : 'Title:'}</label>
                <input
                  type="text"
                  placeholder="مثال: استاندارد بازسازی و نوسازی خودروهای آتش‌نشانی"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">{isFa ? 'شرح و الزامات کلیدی:' : 'Description:'}</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">{isFa ? 'سال ویرایش / نسخه:' : 'Revision:'}</label>
                  <input
                    type="text"
                    value={revisionYear}
                    onChange={e => setRevisionYear(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">{isFa ? 'بخش مرتبط:' : 'Category:'}</label>
                  <input
                    type="text"
                    placeholder="سیستم اطفاء، نجات، هیدرولیک..."
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">{isFa ? 'دامنه کاربرد فنی:' : 'Scope:'}</label>
                <input
                  type="text"
                  placeholder="تمام خودروهای سنگین و نیمه‌سنگین..."
                  value={scope}
                  onChange={e => setScope(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-xl font-bold">
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
                <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-xs">
                  {isFa ? 'ذخیره استاندارد' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deletingStandard && (
        <ConfirmDeleteModal
          isOpen={!!deletingStandard}
          language={language}
          itemName={`${deletingStandard.code} - ${deletingStandard.title}`}
          itemType={isFa ? 'استاندارد فنی مرجع' : 'Technical Standard'}
          onConfirm={() => {
            if (deletingStandard) {
              onDeleteStandard(deletingStandard.id);
              setDeletingStandard(null);
            }
          }}
          onClose={() => setDeletingStandard(null)}
        />
      )}
    </div>
  );
}
