import React, { useState, useEffect, useMemo } from 'react';
import { EyeOff, Radio, Save, ShieldAlert } from 'lucide-react';
import CentralPersonnelSelector from '../../../components/CentralPersonnelSelector';
import StatusBadge from './StatusBadge';
import Lifting3DViewport from './Lifting3DViewport';
import { evaluateTandemLift } from '../../../../shared/lifting-engine/index';
import { liftingApi } from '../services/liftingApi';
import type { LiftingCrane, LiftingPlanRecord } from '../types';

interface Props {
  plan: LiftingPlanRecord | null;
  cranes: LiftingCrane[];
  canWrite: boolean;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function SpecialOpsTab({ plan, cranes, canWrite, onRefresh, onToast }: Props) {
  const [saving, setSaving] = useState(false);

  const [tandem, setTandem] = useState({
    enabled: false,
    grossLoadTon: 25,
    dynamicFactor: 1.1,
    crane1DistanceFromCogM: 4,
    crane2DistanceFromCogM: 6,
    cogUncertaintyM: 0.4,
    outOfLevelDeg: 1.5,
    crane1RatedCapacityTon: 40,
    crane2RatedCapacityTon: 35,
  });

  const [blind, setBlind] = useState({
    enabled: false,
    signalerName: '',
    signalerCode: '',
    backupSignalerName: '',
    primaryRadioChannel: 'CH-04 HSE',
    backupRadioChannel: 'CH-07 OPS',
    blindZonesDescription: '',
    handSignalsAgreed: true,
    emergencyStopProcedure: 'توقف فوری قلاب با فرمان صوتی یا بوق سه‌باره + پایین آوردن کنترل‌شده در منطقه امن',
    obstructionHeightM: 5.5,
  });

  useEffect(() => {
    if (!plan) return;
    if (plan.tandemConfig && Object.keys(plan.tandemConfig).length > 0) {
      setTandem((prev) => ({ ...prev, ...plan.tandemConfig }));
    } else {
      setTandem((prev) => ({
        ...prev,
        enabled: plan.liftCategory === 'TANDEM',
        grossLoadTon: Number(plan.netLoadWeightTon || 25) + Number(plan.riggingAccessoryWeightTon || 0),
        dynamicFactor: Number(plan.dynamicFactor || 1.1),
      }));
    }
    if (plan.blindConfig && Object.keys(plan.blindConfig).length > 0) {
      setBlind((prev) => ({ ...prev, ...plan.blindConfig }));
    } else {
      setBlind((prev) => ({ ...prev, enabled: plan.liftCategory === 'BLIND' }));
    }
  }, [plan]);

  const tandemEval = useMemo(() => evaluateTandemLift(tandem), [tandem]);

  const blindReady =
    !blind.enabled ||
    (Boolean(blind.signalerName?.trim()) &&
      Boolean(blind.primaryRadioChannel?.trim()) &&
      Boolean(blind.emergencyStopProcedure?.trim()) &&
      Boolean(blind.handSignalsAgreed));

  const primaryCrane = cranes.find((c) => c.id === Number(plan?.craneSetup?.primaryCraneId)) || null;

  if (!plan) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center text-sm text-slate-500">
        ابتدا یک طرح باربرداری را انتخاب کنید تا عملیات ویژه (Tandem Lift / Blind Lift) روی آن تنظیم شود.
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await liftingApi.updatePlan(plan.id, {
        tandemConfig: tandem,
        blindConfig: blind,
        changeReason: 'تنظیم پارامترهای عملیات ویژه Tandem Lift / Blind Lift',
      });
      onToast('تنظیمات عملیات ویژه در سرور ثبت و بازمحاسبه شد.', 'success');
      await onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'خطا در ذخیره‌سازی عملیات ویژه', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            مدیریت عملیات ویژه: باربرداری همزمان (Tandem Lift) و باربرداری کور (Blind Lift)
          </h3>
          <p className="text-[11px] text-slate-500">
            مطابق ASME P30.1 / ASME B30.5: سقف مجاز بهره‌برداری در Tandem Lift برابر ۷۵٪ است و در Blind Lift حضور سیگنال‌دهنده مجاز الزامی است.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات عملیات ویژه'}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tandem Lift Box */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
            <label className="inline-flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white cursor-pointer">
              <input
                type="checkbox"
                checked={tandem.enabled}
                onChange={(e) => setTandem({ ...tandem, enabled: e.target.checked })}
              />
              <span>فعال‌سازی Tandem Lift (۲ جرثقیل همزمان)</span>
            </label>
            <StatusBadge status={tandemEval.status} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">بار کل استاتیکی (تن)</label>
              <input
                type="number"
                step="0.5"
                value={tandem.grossLoadTon}
                onChange={(e) => setTandem({ ...tandem, grossLoadTon: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">عدم قطعیت CoG (متر)</label>
              <input
                type="number"
                step="0.1"
                value={tandem.cogUncertaintyM}
                onChange={(e) => setTandem({ ...tandem, cogUncertaintyM: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">فاصله جرثقیل ۱ تا CoG (m)</label>
              <input
                type="number"
                step="0.2"
                value={tandem.crane1DistanceFromCogM}
                onChange={(e) => setTandem({ ...tandem, crane1DistanceFromCogM: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">فاصله جرثقیل ۲ تا CoG (m)</label>
              <input
                type="number"
                step="0.2"
                value={tandem.crane2DistanceFromCogM}
                onChange={(e) => setTandem({ ...tandem, crane2DistanceFromCogM: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">ظرفیت جدول جرثقیل ۱ (t)</label>
              <input
                type="number"
                value={tandem.crane1RatedCapacityTon}
                onChange={(e) => setTandem({ ...tandem, crane1RatedCapacityTon: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">ظرفیت جدول جرثقیل ۲ (t)</label>
              <input
                type="number"
                value={tandem.crane2RatedCapacityTon}
                onChange={(e) => setTandem({ ...tandem, crane2RatedCapacityTon: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
          </div>

          {tandem.enabled && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 space-y-1.5 font-mono tabular-nums">
              <div className="flex justify-between">
                <span>سهم بدبینانه جرثقیل ۱:</span>
                <span className="font-bold">
                  {tandemEval.crane1WorstCaseLoadTon} t ({tandemEval.crane1UtilizationPct ?? '—'}% / max 75%)
                </span>
              </div>
              <div className="flex justify-between">
                <span>سهم بدبینانه جرثقیل ۲:</span>
                <span className="font-bold">
                  {tandemEval.crane2WorstCaseLoadTon} t ({tandemEval.crane2UtilizationPct ?? '—'}% / max 75%)
                </span>
              </div>
              {tandemEval.blockers.map((b, i) => (
                <div key={i} className="text-red-600 dark:text-red-400 font-sans font-bold">
                  • {b}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blind Lift Box */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
            <label className="inline-flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white cursor-pointer">
              <input
                type="checkbox"
                checked={blind.enabled}
                onChange={(e) => setBlind({ ...blind, enabled: e.target.checked })}
              />
              <EyeOff className="w-4 h-4 text-amber-600" />
              <span>فعال‌سازی کنترل عملیات کور (Blind Lift)</span>
            </label>
            <StatusBadge status={blind.enabled ? (blindReady ? 'PASS' : 'FAIL') : 'NOT_VERIFIED'} />
          </div>

          <div className="space-y-3">
            <CentralPersonnelSelector
              label="سیگنال‌دهنده اختصاصی / Spotter (الزامی برای Blind Lift)"
              compact
              selectedPersonnelCode={blind.signalerCode}
              value={blind.signalerName}
              onSelectPersonnel={(p) =>
                setBlind({
                  ...blind,
                  signalerName: p?.fullName || '',
                  signalerCode: p?.personnelCode || '',
                })
              }
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">کانال رادیویی اصلی *</label>
                <input
                  type="text"
                  value={blind.primaryRadioChannel}
                  onChange={(e) => setBlind({ ...blind, primaryRadioChannel: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">کانال رادیویی پشتیبان</label>
                <input
                  type="text"
                  value={blind.backupRadioChannel}
                  onChange={(e) => setBlind({ ...blind, backupRadioChannel: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1">توصیف نقاط کور و موانع دید اپراتور</label>
              <input
                type="text"
                value={blind.blindZonesDescription}
                onChange={(e) => setBlind({ ...blind, blindZonesDescription: e.target.value })}
                placeholder="مثال: پشت دیوار بتنی تصفیه‌خانه و ارتفاع بالاتر از ۶ متر پشت پایپ‌رک"
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">پروتکل توقف اضطراری (در صورت قطع ارتباط رادیویی) *</label>
              <textarea
                rows={2}
                value={blind.emergencyStopProcedure}
                onChange={(e) => setBlind({ ...blind, emergencyStopProcedure: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
              />
            </div>

            <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={blind.handSignalsAgreed}
                onChange={(e) => setBlind({ ...blind, handSignalsAgreed: e.target.checked })}
              />
              <Radio className="w-3.5 h-3.5 text-sky-600" />
              <span>علائم استاندارد دستی و رادیویی (ASME B30.5) بین اپراتور و سیگنال‌دهنده هماهنگ شده است</span>
            </label>

            {blind.enabled && !blindReady && (
              <div className="p-2.5 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>بدون تعیین سیگنال‌دهنده، کانال رادیویی و پروتکل توقف اضطراری، دروازه HSE این طرح مسدود می‌ماند.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live 3D Visualization of Special Operations */}
      <Lifting3DViewport
        plan={{
          ...plan,
          tandemConfig: tandem,
          blindConfig: blind,
        }}
        crane={primaryCrane}
        heightClass="h-[420px]"
      />
    </div>
  );
}
