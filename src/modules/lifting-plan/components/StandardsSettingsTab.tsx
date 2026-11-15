import React, { useState } from 'react';
import { BookOpen, Sliders } from 'lucide-react';
import LiftingFormModalShell from './LiftingFormModalShell';
import { liftingApi } from '../services/liftingApi';
import type { LiftingStandardConfig } from '../types';

interface Props {
  standards: LiftingStandardConfig[];
  canApprove: boolean;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function StandardsSettingsTab({ standards, canApprove, onRefresh, onToast }: Props) {
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [edition, setEdition] = useState('');
  const [notes, setNotes] = useState('');
  const [factorsJson, setFactorsJson] = useState('{}');
  const [clausesJson, setClausesJson] = useState('{}');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const openEdit = (std: LiftingStandardConfig) => {
    setEditingCode(std.standardCode);
    setEdition(std.edition);
    setNotes(std.notes || '');
    setFactorsJson(JSON.stringify(std.engineeringFactors || {}, null, 2));
    setClausesJson(JSON.stringify(std.activeClauses || {}, null, 2));
    setIsActive(std.isActive);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCode) return;
    let parsedFactors: Record<string, any> = {};
    let parsedClauses: Record<string, any> = {};
    try {
      parsedFactors = JSON.parse(factorsJson || '{}');
      parsedClauses = JSON.parse(clausesJson || '{}');
    } catch {
      onToast('فرمت JSON ضرایب یا بندهای استاندارد نامعتبر است.', 'error');
      return;
    }

    setSaving(true);
    try {
      await liftingApi.updateStandard(editingCode, {
        edition: edition.trim(),
        notes: notes.trim() || null,
        isActive,
        engineeringFactors: parsedFactors,
        activeClauses: parsedClauses,
      });
      setEditingCode(null);
      onToast(`تنظیمات استاندارد ${editingCode} با موفقیت ذخیره و در موتور محاسباتی اعمال شد.`, 'success');
      await onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'خطا در به‌روزرسانی استاندارد', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-xs">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-600" />
            <span>مدیریت استانداردهای مهندسی باربرداری (ASME &amp; Crane References)</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            ضرایب طراحی، آستانه‌های مجاز و ویرایش‌های استاندارد ذخیره‌شده در PostgreSQL که مستقیماً توسط موتور محاسباتی اعمال می‌شوند.
          </p>
        </div>
        {!canApprove && (
          <span className="px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-bold">
            فقط کاربر دارای دسترسی Approver / مدیر ایمنی مجاز به ویرایش ضرایب مرجع است.
          </span>
        )}
      </div>

      {/* Separate Standard Settings Modal */}
      <LiftingFormModalShell
        isOpen={Boolean(editingCode)}
        title={`ویرایش تنظیمات استاندارد مرجع: ${editingCode || ''}`}
        subtitle="ضرایب طراحی و بندهای فنی ذخیره‌شده مستقیماً توسط موتور محاسباتی اعمال می‌شوند."
        icon={Sliders}
        maxWidthClass="max-w-3xl"
        submitting={saving}
        submitLabel="ذخیره تنظیمات استاندارد"
        headerActions={
          <label className="inline-flex items-center gap-1.5 font-bold text-xs cursor-pointer px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>استاندارد فعال در موتور</span>
          </label>
        }
        onClose={() => setEditingCode(null)}
        onSubmit={handleSave}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold mb-1.5">ویرایش مرجع (Edition)</label>
            <input
              type="text"
              value={edition}
              onChange={(e) => setEdition(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">توضیحات اجرایی مجتمع</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">ضرایب مهندسی فعال (Engineering Factors JSON)</label>
            <textarea
              rows={6}
              dir="ltr"
              value={factorsJson}
              onChange={(e) => setFactorsJson(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-[11px]"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">بندهای فنی فعال (Active Clauses JSON)</label>
            <textarea
              rows={6}
              dir="ltr"
              value={clausesJson}
              onChange={(e) => setClausesJson(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-[11px]"
            />
          </div>
        </div>
      </LiftingFormModalShell>

      {/* Standards Catalog */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {standards.map((std) => (
          <div
            key={std.standardCode}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-sm text-sky-700 dark:text-sky-300">{std.standardCode}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 font-mono text-[10px]">
                    Ed. {std.edition}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      std.isActive
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {std.isActive ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>
                <div className="font-bold text-slate-900 dark:text-white mt-1">{std.titleFa}</div>
                <div className="text-[11px] text-slate-500">{std.titleEn}</div>
              </div>
              {canApprove && (
                <button
                  type="button"
                  onClick={() => openEdit(std)}
                  className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  تنظیمات
                </button>
              )}
            </div>

            {std.engineeringFactors && Object.keys(std.engineeringFactors).length > 0 && (
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-700 dark:text-slate-300 flex flex-wrap gap-x-4 gap-y-1" dir="ltr">
                {Object.entries(std.engineeringFactors).map(([k, v]) => (
                  <span key={k}>
                    <strong>{k}:</strong> {String(v)}
                  </span>
                ))}
              </div>
            )}

            {std.notes && <p className="text-[11px] text-slate-500 leading-relaxed">{std.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
