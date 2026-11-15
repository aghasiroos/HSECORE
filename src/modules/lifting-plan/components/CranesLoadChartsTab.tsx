import React, { useState, useEffect } from 'react';
import { Plus, Save, Trash2, Upload, Truck, AlertCircle } from 'lucide-react';
import ConfirmDeleteModal from '../../../components/common/ConfirmDeleteModal';
import PersianDatePicker from '../../../components/common/PersianDatePicker';
import LiftingFormModalShell from './LiftingFormModalShell';
import { liftingApi } from '../services/liftingApi';
import type { CraneLoadChartRow, LiftingCrane, LiftingIntegrationContext } from '../types';

interface Props {
  cranes: LiftingCrane[];
  integration: LiftingIntegrationContext | null;
  canWrite: boolean;
  canApprove: boolean;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function CranesLoadChartsTab({
  cranes,
  integration,
  canWrite,
  canApprove,
  onRefresh,
  onToast,
}: Props) {
  const [selectedCraneId, setSelectedCraneId] = useState<number | null>(cranes[0]?.id || null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [savingCrane, setSavingCrane] = useState(false);
  const [craneDraft, setCraneDraft] = useState<Partial<LiftingCrane>>({
    name: '',
    model: '',
    manufacturer: '',
    craneType: 'MOBILE_ALL_TERRAIN',
    maxRatedCapacityTon: 80,
    minBoomLengthM: 12,
    maxBoomLengthM: 50,
    maxRadiusM: 40,
    counterweightTon: 18,
    outriggerSpreadM: 7.5,
    hookBlockWeightTon: 0.6,
    ownershipType: 'COMPANY',
    status: 'ACTIVE',
  });

  const selectedCrane = cranes.find((c) => c.id === selectedCraneId) || null;
  const [chartRows, setChartRows] = useState<CraneLoadChartRow[]>([]);
  const [savingChart, setSavingChart] = useState(false);
  const [craneToDelete, setCraneToDelete] = useState<LiftingCrane | null>(null);

  useEffect(() => {
    if (!selectedCraneId && cranes.length > 0) {
      setSelectedCraneId(cranes[0].id);
    }
  }, [cranes, selectedCraneId]);

  useEffect(() => {
    if (selectedCrane) {
      setChartRows(selectedCrane.loadChartRows ? [...selectedCrane.loadChartRows] : []);
    } else {
      setChartRows([]);
    }
  }, [selectedCrane]);

  const handleSaveCrane = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCrane(true);
    try {
      if (craneDraft.id) {
        await liftingApi.updateCrane(craneDraft.id, craneDraft);
        onToast('اطلاعات جرثقیل به‌روزرسانی شد.', 'success');
      } else {
        const created = await liftingApi.createCrane(craneDraft);
        setSelectedCraneId(created.id);
        onToast(`جرثقیل ${created.craneCode} ثبت شد. اکنون جدول بار واقعی (Load Chart) آن را وارد کنید.`, 'success');
      }
      setShowNewForm(false);
      await onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'خطا در ثبت جرثقیل', 'error');
    } finally {
      setSavingCrane(false);
    }
  };

  const handleSaveChart = async () => {
    if (!selectedCrane) return;
    setSavingChart(true);
    try {
      await liftingApi.replaceLoadChart(selectedCrane.id, chartRows);
      onToast(`جدول بار جرثقیل ${selectedCrane.name} با ${chartRows.length} ردیف در پایگاه داده ذخیره شد.`, 'success');
      await onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'خطا در ذخیره جدول بار', 'error');
    } finally {
      setSavingChart(false);
    }
  };

  const handleAddRow = () => {
    setChartRows((prev) => [
      ...prev,
      {
        chartName: 'Main Boom',
        outriggerConfig: '100_OUTRIGGERS',
        counterweightTon: selectedCrane?.counterweightTon || 15,
        boomLengthM: 20,
        radiusM: 10,
        ratedCapacityTon: 25,
      },
    ]);
  };

  const handleBulkMatrixTemplate = () => {
    // Explicit user-triggered ASME template matrix builder scaled to crane maxRatedCapacityTon
    const baseCap = selectedCrane?.maxRatedCapacityTon || 60;
    const minB = Math.max(12, selectedCrane?.minBoomLengthM || 15);
    const midB = Math.round((minB + (selectedCrane?.maxBoomLengthM || 45)) / 2);
    const maxB = Math.max(midB + 5, selectedCrane?.maxBoomLengthM || 45);
    const radii = [6, 10, 14, 18, 24, 30];
    const generated: CraneLoadChartRow[] = [];
    for (const boom of [minB, midB, maxB]) {
      for (const r of radii) {
        if (r >= boom) continue;
        const cap = Math.max(1.5, Math.round(((baseCap * 0.92 * (minB / boom) * (6 / r)) ** 0.78) * 10) / 10);
        generated.push({
          chartName: `Boom ${boom}m`,
          outriggerConfig: '100_OUTRIGGERS',
          counterweightTon: selectedCrane?.counterweightTon || 15,
          boomLengthM: boom,
          radiusM: r,
          ratedCapacityTon: Math.min(baseCap, cap),
        });
      }
    }
    setChartRows(generated);
    onToast('ماتریس اولیه جدول بار تولید شد؛ مقادیر را دقیقاً مطابق کاتالوگ سازنده اصلاح و ذخیره کنید.', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Truck className="w-5 h-5 text-amber-600" />
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">بانک جرثقیل‌ها و جداول بار واقعی (Load Chart)</h3>
            <p className="text-[11px] text-slate-500">ظرفیت مجاز جرثقیل فقط از این جداول خوانده می‌شود و هرگز بر اساس نام مدل حدس زده نمی‌شود.</p>
          </div>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => {
              setCraneDraft({
                name: '',
                model: '',
                manufacturer: '',
                craneType: 'MOBILE_ALL_TERRAIN',
                maxRatedCapacityTon: 80,
                minBoomLengthM: 12,
                maxBoomLengthM: 50,
                maxRadiusM: 40,
                counterweightTon: 18,
                outriggerSpreadM: 7.5,
                hookBlockWeightTon: 0.6,
                ownershipType: 'COMPANY',
                status: 'ACTIVE',
              });
              setShowNewForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت جرثقیل جدید</span>
          </button>
        )}
      </div>

      <LiftingFormModalShell
        isOpen={showNewForm}
        title={craneDraft.id ? `ویرایش مشخصات جرثقیل (${craneDraft.craneCode})` : 'ثبت جرثقیل جدید در ناوگان'}
        subtitle="ظرفیت مجاز عملیات فقط از جدول Load Chart واقعی همین جرثقیل خوانده می‌شود."
        icon={Truck}
        maxWidthClass="max-w-4xl"
        submitting={savingCrane}
        submitLabel={craneDraft.id ? 'به‌روزرسانی جرثقیل' : 'ذخیره و ثبت جرثقیل'}
        onClose={() => setShowNewForm(false)}
        onSubmit={handleSaveCrane}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block font-bold mb-1.5">نام / تگ جرثقیل *</label>
            <input
              required
              type="text"
              value={craneDraft.name || ''}
              onChange={(e) => setCraneDraft({ ...craneDraft, name: e.target.value })}
              placeholder="مثال: جرثقیل ۱۰۰ تن تادانو"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">مدل و سازنده *</label>
            <input
              required
              type="text"
              value={craneDraft.model || ''}
              onChange={(e) => setCraneDraft({ ...craneDraft, model: e.target.value })}
              placeholder="مثال: Tadano ATF 100G-4"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">ظرفیت اسمی (تن) *</label>
            <input
              required
              type="number"
              value={craneDraft.maxRatedCapacityTon || 80}
              onChange={(e) => setCraneDraft({ ...craneDraft, maxRatedCapacityTon: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">نوع جرثقیل</label>
            <select
              value={craneDraft.craneType || 'MOBILE_ALL_TERRAIN'}
              onChange={(e) => setCraneDraft({ ...craneDraft, craneType: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="MOBILE_ALL_TERRAIN">موبایل All-Terrain</option>
              <option value="ROUGH_TERRAIN">کارگاهی Rough-Terrain</option>
              <option value="CRAWLER">شنی (Crawler)</option>
              <option value="TRUCK_MOUNTED">نصب‌شده روی کامیون</option>
              <option value="OVERHEAD_GANTRY">سقفی / دروازه‌ای</option>
            </select>
          </div>
          <div>
            <label className="block font-bold mb-1.5">شماره گواهینامه بازرسی فنی</label>
            <input
              type="text"
              value={craneDraft.certificateNumber || ''}
              onChange={(e) => setCraneDraft({ ...craneDraft, certificateNumber: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">انقضای گواهینامه</label>
            <PersianDatePicker
              value={craneDraft.certificateExpiryDate || ''}
              onChange={(jalaliStr, gregorianStr) =>
                setCraneDraft({ ...craneDraft, certificateExpiryDate: gregorianStr || jalaliStr })
              }
              isFa
              showGregorianPreview={false}
              inputClassName="py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">مالکیت / پیمانکار</label>
            <input
              list="crane-contractors-list"
              type="text"
              value={craneDraft.contractorName || ''}
              onChange={(e) => setCraneDraft({ ...craneDraft, contractorName: e.target.value })}
              placeholder="سازمانی یا نام پیمانکار"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <datalist id="crane-contractors-list">
              {(integration?.contractors || []).map((c, idx) => (
                <option key={idx} value={c.name} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block font-bold mb-1.5">فاصله عرضی جک‌ها (m)</label>
            <input
              type="number"
              step="0.5"
              value={craneDraft.outriggerSpreadM || 7.5}
              onChange={(e) => setCraneDraft({ ...craneDraft, outriggerSpreadM: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">وزن خالص جرثقیل (ton)</label>
            <input
              type="number"
              step="0.5"
              value={craneDraft.deadWeightTon ?? ''}
              onChange={(e) =>
                setCraneDraft({
                  ...craneDraft,
                  deadWeightTon: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              placeholder="مثال: 48"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5">مساحت پیش‌فرض کفشک جک (m²)</label>
            <input
              type="number"
              step="0.1"
              value={craneDraft.defaultOutriggerPadAreaM2 ?? ''}
              onChange={(e) =>
                setCraneDraft({
                  ...craneDraft,
                  defaultOutriggerPadAreaM2: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              placeholder="مثال: 1.44"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
            />
          </div>
        </div>
      </LiftingFormModalShell>

      {/* Split: Cranes Fleet List + Load Chart Matrix Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2 text-xs">
          <h4 className="font-black text-sm text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-700">
            ناوگان جرثقیل‌های ثبت‌شده ({cranes.length})
          </h4>
          {cranes.length === 0 ? (
            <p className="py-8 text-center text-slate-500">هیچ جرثقیلی ثبت نشده است.</p>
          ) : (
            <div className="space-y-2">
              {cranes.map((c) => {
                const isSel = c.id === selectedCraneId;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCraneId(c.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSel
                        ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {c.name} <span className="font-mono text-slate-500">({c.craneCode})</span>
                      </div>
                      <span className="font-mono font-bold tabular-nums text-sky-700 dark:text-sky-400">
                        {c.maxRatedCapacityTon} t
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{c.model} · {c.loadChartRows.length} ردیف چارت</span>
                      <span
                        className={
                          c.certExpiryState === 'EXPIRED'
                            ? 'text-red-600 font-bold'
                            : c.certExpiryState === 'VALID'
                              ? 'text-emerald-600 font-bold'
                              : 'text-amber-600 font-bold'
                        }
                      >
                        گواهی: {c.certificateExpiryDate || 'ثبت‌نشده'}
                      </span>
                    </div>
                    {canWrite && (
                      <div className="mt-2 flex items-center gap-3 text-[11px]" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setCraneDraft(c);
                            setShowNewForm(true);
                          }}
                          className="text-sky-600 font-bold hover:underline cursor-pointer"
                        >
                          ویرایش مشخصات
                        </button>
                        {canApprove && (
                          <button
                            type="button"
                            onClick={() => setCraneToDelete(c)}
                            className="text-red-600 font-bold hover:underline cursor-pointer"
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Load Chart Editor */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 text-xs">
          {!selectedCrane ? (
            <p className="py-12 text-center text-slate-500">یک جرثقیل را از ستون مقابل انتخاب کنید.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-white">
                    جدول بار واقعی (Load Chart): {selectedCrane.name}
                  </h4>
                  <p className="text-[11px] text-slate-500">ردیف‌های جدول بر اساس آرایش جک، طول بوم (m)، شعاع کار (m) و ظرفیت (ton)</p>
                </div>
                {canWrite && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBulkMatrixTemplate}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>تولید ماتریس پایه</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-sky-600 text-sky-600 hover:bg-sky-50 font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن ردیف</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveChart}
                      disabled={savingChart}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingChart ? 'در حال ذخیره...' : 'ذخیره Load Chart'}</span>
                    </button>
                  </div>
                )}
              </div>

              {chartRows.length === 0 ? (
                <div className="p-6 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>هیچ ردیف Load Chart برای این جرثقیل ثبت نشده است. موتور محاسبات بدون جدول بار وضعیت NOT VERIFIED برمی‌گرداند.</span>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                        <th className="py-1.5 px-1">آرایش جک</th>
                        <th className="py-1.5 px-1">طول بوم (m)</th>
                        <th className="py-1.5 px-1">شعاع (m)</th>
                        <th className="py-1.5 px-1">ظرفیت مجاز (t)</th>
                        <th className="py-1.5 px-1">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {chartRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 px-1">
                            <select
                              value={row.outriggerConfig}
                              onChange={(e) => {
                                const copy = [...chartRows];
                                copy[idx] = { ...copy[idx], outriggerConfig: e.target.value };
                                setChartRows(copy);
                              }}
                              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                            >
                              <option value="100_OUTRIGGERS">100_OUTRIGGERS</option>
                              <option value="75_OUTRIGGERS">75_OUTRIGGERS</option>
                              <option value="ON_TIRES">ON_TIRES</option>
                              <option value="CRAWLER_360">CRAWLER_360</option>
                            </select>
                          </td>
                          <td className="py-1.5 px-1">
                            <input
                              type="number"
                              step="0.5"
                              value={row.boomLengthM}
                              onChange={(e) => {
                                const copy = [...chartRows];
                                copy[idx] = { ...copy[idx], boomLengthM: Number(e.target.value) };
                                setChartRows(copy);
                              }}
                              className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
                            />
                          </td>
                          <td className="py-1.5 px-1">
                            <input
                              type="number"
                              step="0.5"
                              value={row.radiusM}
                              onChange={(e) => {
                                const copy = [...chartRows];
                                copy[idx] = { ...copy[idx], radiusM: Number(e.target.value) };
                                setChartRows(copy);
                              }}
                              className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
                            />
                          </td>
                          <td className="py-1.5 px-1">
                            <input
                              type="number"
                              step="0.1"
                              value={row.ratedCapacityTon}
                              onChange={(e) => {
                                const copy = [...chartRows];
                                copy[idx] = { ...copy[idx], ratedCapacityTon: Number(e.target.value) };
                                setChartRows(copy);
                              }}
                              className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums font-bold"
                            />
                          </td>
                          <td className="py-1.5 px-1">
                            <button
                              type="button"
                              onClick={() => setChartRows(chartRows.filter((_, i) => i !== idx))}
                              className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={Boolean(craneToDelete)}
        isFa
        title="تأیید حذف جرثقیل"
        itemType="جرثقیل"
        itemName={craneToDelete ? `${craneToDelete.name} (${craneToDelete.craneCode})` : ''}
        onConfirm={async () => {
          if (!craneToDelete) return;
          try {
            await liftingApi.deleteCrane(craneToDelete.id);
            onToast('جرثقیل بایگانی شد.', 'success');
            await onRefresh();
          } catch (err: any) {
            onToast(err?.message || 'امکان حذف جرثقیل نیست', 'error');
          } finally {
            setCraneToDelete(null);
          }
        }}
        onClose={() => setCraneToDelete(null)}
      />
    </div>
  );
}
