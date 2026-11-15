import React, { useState } from 'react';
import { Plus, Trash2, Wrench, AlertTriangle, CheckCircle2 } from 'lucide-react';
import ConfirmDeleteModal from '../../../components/common/ConfirmDeleteModal';
import PersianDatePicker from '../../../components/common/PersianDatePicker';
import LiftingFormModalShell from './LiftingFormModalShell';
import { liftingApi } from '../services/liftingApi';
import type { RiggingEquipmentItem, LiftingIntegrationContext } from '../types';

interface Props {
  rigging: RiggingEquipmentItem[];
  integration: LiftingIntegrationContext | null;
  canWrite: boolean;
  canApprove: boolean;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function RiggingBankTab({
  rigging,
  integration,
  canWrite,
  canApprove,
  onRefresh,
  onToast,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [savingRigging, setSavingRigging] = useState(false);
  const [riggingToDelete, setRiggingToDelete] = useState<RiggingEquipmentItem | null>(null);
  const [draft, setDraft] = useState<Partial<RiggingEquipmentItem>>({
    name: '',
    category: 'WIRE_ROPE_SLING',
    standardRef: 'ASME B30.9',
    wllTon: 10,
    safetyFactor: 5,
    selfWeightKg: 15,
    lengthM: 6,
    diameterMm: 22,
    safetyLatchOk: true,
    conditionStatus: 'SERVICEABLE',
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRigging(true);
    try {
      if (draft.id) {
        await liftingApi.updateRigging(draft.id, draft);
        onToast('مشخصات تجهیز Rigging به‌روزرسانی شد.', 'success');
      } else {
        await liftingApi.createRigging(draft);
        onToast('تجهیز Rigging در بانک تجهیزات ثبت شد.', 'success');
      }
      setShowForm(false);
      await onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'خطا در ذخیره‌سازی تجهیز Rigging', 'error');
    } finally {
      setSavingRigging(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Wrench className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">بانک ادوات Rigging و متعلقات باربرداری (ASME B30.9 / B30.10 / B30.26)</h3>
            <p className="text-[11px] text-slate-500">تجهیزات با گواهینامه منقضی، قلاب بدون ضامن (Safety Latch) یا وضعیت معیوب در گردش کار مسدود می‌شوند.</p>
          </div>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => {
              setDraft({
                name: '',
                category: 'WIRE_ROPE_SLING',
                standardRef: 'ASME B30.9',
                wllTon: 10,
                safetyFactor: 5,
                selfWeightKg: 15,
                lengthM: 6,
                diameterMm: 22,
                safetyLatchOk: true,
                conditionStatus: 'SERVICEABLE',
              });
              setShowForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت تجهیز Rigging جدید</span>
          </button>
        )}
      </div>

      <LiftingFormModalShell
        isOpen={showForm}
        title={draft.id ? `ویرایش تجهیز Rigging (${draft.assetCode})` : 'ثبت تجهیز جدید در بانک Rigging'}
        subtitle="ثبت مشخصات فنی، WLL، گواهینامه و وضعیت سلامت ضامن ایمنی مطابق ASME B30.9 / B30.10 / B30.26"
        icon={Wrench}
        maxWidthClass="max-w-4xl"
        submitting={savingRigging}
        submitLabel={draft.id ? 'به‌روزرسانی تجهیز' : 'ذخیره تجهیز در بانک'}
        onClose={() => setShowForm(false)}
        onSubmit={handleSave}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block font-bold mb-1.5">نام و سایز تجهیز *</label>
            <input
              required
              type="text"
              value={draft.name || ''}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="مثال: وایرروپ ۲۲ میلیمتر ۶ متری"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">دسته‌بندی (ASME)</label>
            <select
              value={draft.category || 'WIRE_ROPE_SLING'}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="WIRE_ROPE_SLING">اسلینگ سیم‌بکسلی (Wire Rope)</option>
              <option value="WEB_SLING">تسمه برزنتی (Web Sling)</option>
              <option value="CHAIN_SLING">اسلینگ زنجیری (Chain)</option>
              <option value="SHACKLE">شگل (Shackle - B30.26)</option>
              <option value="HOOK">قلاب (Hook - B30.10)</option>
              <option value="SPREADER_BEAM">تیر پخش‌کننده (Spreader Beam)</option>
              <option value="LIFTING_BEAM">شاهین باربرداری (Lifting Beam)</option>
              <option value="MASTER_LINK">حلقه مادر (Master Link)</option>
            </select>
          </div>
          <div>
            <label className="block font-bold mb-1.5">ظرفیت مجاز WLL (تن) *</label>
            <input
              required
              type="number"
              step="0.1"
              value={draft.wllTon || 10}
              onChange={(e) => setDraft({ ...draft, wllTon: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">شماره سریال / کد پلاک</label>
            <input
              type="text"
              value={draft.serialNumber || ''}
              onChange={(e) => setDraft({ ...draft, serialNumber: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">شماره گواهینامه</label>
            <input
              type="text"
              value={draft.certificateNumber || ''}
              onChange={(e) => setDraft({ ...draft, certificateNumber: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">تاریخ انقضای گواهی</label>
            <PersianDatePicker
              value={draft.certificateExpiryDate || ''}
              onChange={(jalaliStr, gregorianStr) =>
                setDraft({ ...draft, certificateExpiryDate: gregorianStr || jalaliStr })
              }
              isFa
              showGregorianPreview={false}
              inputClassName="py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">وضعیت فنی</label>
            <select
              value={draft.conditionStatus || 'SERVICEABLE'}
              onChange={(e) => setDraft({ ...draft, conditionStatus: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="SERVICEABLE">سالم و آماده به کار</option>
              <option value="WARNING_DUE">نزدیک سررسید بازرسی</option>
              <option value="EXPIRED_CERT">گواهینامه منقضی</option>
              <option value="DEFECTIVE">معیوب / دارای ایراد</option>
              <option value="QUARANTINED">قرنطینه و جمع‌آوری‌شده</option>
            </select>
          </div>
          <div className="sm:col-span-2 flex items-end pb-2">
            <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={draft.safetyLatchOk !== false}
                onChange={(e) => setDraft({ ...draft, safetyLatchOk: e.target.checked })}
              />
              <span>سلامت ضامن ایمنی قلاب / پین</span>
            </label>
          </div>
        </div>
      </LiftingFormModalShell>

      {/* Rigging Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th className="py-2 px-2">کد دارایی</th>
                <th className="py-2 px-2">نام و دسته</th>
                <th className="py-2 px-2">WLL (تن)</th>
                <th className="py-2 px-2">گواهینامه و انقضا</th>
                <th className="py-2 px-2">سلامت فنی و ضامن</th>
                <th className="py-2 px-2">اقدام</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 tabular-nums">
              {rigging.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    هیچ تجهیز Rigging ثبت نشده است.
                  </td>
                </tr>
              ) : (
                rigging.map((r) => {
                  const hasIssue = r.conditionStatus !== 'SERVICEABLE' || !r.safetyLatchOk || r.certExpiryState === 'EXPIRED';
                  return (
                    <tr key={r.id}>
                      <td className="py-2.5 px-2 font-mono font-bold">{r.assetCode}</td>
                      <td className="py-2.5 px-2">
                        <div className="font-bold text-slate-900 dark:text-white">{r.name}</div>
                        <div className="text-[11px] text-slate-500">{r.category} · {r.standardRef}</div>
                      </td>
                      <td className="py-2.5 px-2 font-mono font-black text-sky-700 dark:text-sky-400">{r.wllTon} t</td>
                      <td className="py-2.5 px-2 font-mono text-[11px]">
                        <div>{r.certificateNumber || '—'}</div>
                        <div className={r.certExpiryState === 'EXPIRED' ? 'text-red-600 font-bold' : 'text-slate-500'}>
                          انقضا: {r.certificateExpiryDate || 'ثبت‌نشده'}
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        {hasIssue ? (
                          <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>مسدود ({r.conditionStatus})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>آماده به کار</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => {
                                setDraft(r);
                                setShowForm(true);
                              }}
                              className="text-sky-600 font-bold hover:underline cursor-pointer"
                            >
                              ویرایش
                            </button>
                          )}
                          {canApprove && (
                            <button
                              type="button"
                              onClick={() => setRiggingToDelete(r)}
                              className="text-red-600 hover:text-red-800 cursor-pointer"
                              title="حذف تجهیز"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={Boolean(riggingToDelete)}
        isFa
        title="تأیید حذف تجهیز Rigging"
        itemType="تجهیز باربرداری"
        itemName={riggingToDelete ? `${riggingToDelete.name} (${riggingToDelete.assetCode})` : ''}
        onConfirm={async () => {
          if (!riggingToDelete) return;
          try {
            await liftingApi.deleteRigging(riggingToDelete.id);
            onToast('تجهیز بایگانی شد.', 'success');
            await onRefresh();
          } catch (err: any) {
            onToast(err?.message || 'امکان حذف تجهیز نیست', 'error');
          } finally {
            setRiggingToDelete(null);
          }
        }}
        onClose={() => setRiggingToDelete(null)}
      />
    </div>
  );
}
