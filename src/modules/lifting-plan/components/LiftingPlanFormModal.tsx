import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Anchor,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Layers,
  Package,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';
import CentralPersonnelSelector from '../../../components/CentralPersonnelSelector';
import PersianDatePicker from '../../../components/common/PersianDatePicker';
import LiftingFormModalShell from './LiftingFormModalShell';
import { LIFT_CATEGORY_LABELS } from '../constants';
import { liftingApi } from '../services/liftingApi';
import type {
  LiftingCrane,
  LiftingIntegrationContext,
  LiftingPlanRecord,
  RiggingEquipmentItem,
} from '../types';

interface Props {
  isOpen: boolean;
  editingPlan: LiftingPlanRecord | null;
  cranes: LiftingCrane[];
  rigging: RiggingEquipmentItem[];
  integration: LiftingIntegrationContext | null;
  onClose: () => void;
  onSaved: (savedPlan: LiftingPlanRecord, isEdit: boolean, revisionBumped?: boolean) => Promise<void> | void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type FormStep = 1 | 2 | 3;

const emptyDraft = (): Partial<LiftingPlanRecord> => ({
  title: '',
  liftCategory: 'STANDARD',
  unitName: 'تولید الفین / واحد عملیاتی',
  areaLocation: '',
  plannedDate: new Date().toISOString().slice(0, 10),
  contractorName: '',
  loadName: '',
  loadShape: 'VESSEL_HORIZONTAL',
  netLoadWeightTon: 12,
  riggingAccessoryWeightTon: 0.4,
  hookBlockWeightTon: 0.6,
  dynamicFactor: 1.1,
  loadDimensions: { lengthM: 6, widthM: 2.2, heightM: 2.2, diameterM: 2.2 },
  cogOffset: { x: 0, y: 0, z: 0 },
  craneSetup: {
    outriggerConfig: '100_OUTRIGGERS',
    boomLengthM: 24,
    radiusM: 12,
    windSpeedMs: 7,
    groundBearingMaxKpa: 250,
    maxUtilizationPct: 85,
  },
  riggingSetup: {
    hitchType: '4_LEG_BRIDLE',
    legCount: 4,
    hookHeightM: 4.5,
    hitchFactor: 1.0,
    slingIds: [],
    shackleIds: [],
  },
  personnelAssignment: {},
  notes: '',
});

const LOAD_PRESETS = [
  {
    id: 'vessel',
    titleFa: 'مبدل / مخزن افقی',
    shape: 'VESSEL_HORIZONTAL',
    lengthM: 6.5,
    widthM: 2.2,
    heightM: 2.2,
    legCount: 4,
  },
  {
    id: 'column',
    titleFa: 'ستون / مخزن عمودی',
    shape: 'CYLINDER_VERTICAL',
    lengthM: 2.4,
    widthM: 2.4,
    heightM: 8.5,
    legCount: 2,
  },
  {
    id: 'skid',
    titleFa: 'پکیج / اسکید تجهیز',
    shape: 'BOX',
    lengthM: 4.5,
    widthM: 2.6,
    heightM: 2.4,
    legCount: 4,
  },
];

export default function LiftingPlanFormModal({
  isOpen,
  editingPlan,
  cranes,
  rigging,
  integration,
  onClose,
  onSaved,
  onToast,
}: Props) {
  const [step, setStep] = useState<FormStep>(1);
  const [showAllSections, setShowAllSections] = useState(false);
  const [draft, setDraft] = useState<Partial<LiftingPlanRecord>>(emptyDraft());
  const [changeReason, setChangeReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setChangeReason('');
    if (editingPlan) {
      setDraft({
        ...editingPlan,
        loadDimensions: { ...(editingPlan.loadDimensions || {}) },
        cogOffset: { ...(editingPlan.cogOffset || { x: 0, y: 0, z: 0 }) },
        craneSetup: { ...(editingPlan.craneSetup || {}) },
        riggingSetup: { ...(editingPlan.riggingSetup || {}) },
        personnelAssignment: { ...(editingPlan.personnelAssignment || {}) },
      });
    } else {
      const base = emptyDraft();
      const defaultUnit = integration?.units?.[0];
      if (defaultUnit) {
        base.unitName = defaultUnit.name;
        base.unitId = defaultUnit.id;
      }
      setDraft(base);
    }
  }, [isOpen, editingPlan, integration?.units]);

  const slings = useMemo(() => rigging.filter((r) => /SLING|CHAIN/i.test(r.category)), [rigging]);
  const shackles = useMemo(
    () => rigging.filter((r) => /SHACKLE|HOOK|MASTER_LINK|SPREADER/i.test(r.category)),
    [rigging]
  );

  const selectedCrane = useMemo(
    () => cranes.find((c) => c.id === Number(draft.craneSetup?.primaryCraneId)) || null,
    [cranes, draft.craneSetup?.primaryCraneId]
  );

  const liveMetrics = useMemo(() => {
    const net = Number(draft.netLoadWeightTon || 0);
    const rig = Number(draft.riggingAccessoryWeightTon || 0);
    const hook = Number(draft.hookBlockWeightTon || 0);
    const daf = Math.max(1, Number(draft.dynamicFactor || 1.1));
    const totalStatic = net + rig + hook;
    const factoredGross = Number((totalStatic * daf).toFixed(2));
    const pctOfMaxCrane =
      selectedCrane && selectedCrane.maxRatedCapacityTon > 0
        ? Math.round((factoredGross / selectedCrane.maxRatedCapacityTon) * 100)
        : null;
    return {
      totalStatic: Number(totalStatic.toFixed(2)),
      factoredGross,
      pctOfMaxCrane,
    };
  }, [
    draft.netLoadWeightTon,
    draft.riggingAccessoryWeightTon,
    draft.hookBlockWeightTon,
    draft.dynamicFactor,
    selectedCrane,
  ]);

  const step1Valid = Boolean(draft.title?.trim() && draft.areaLocation?.trim());
  const step2Valid = Boolean(draft.loadName?.trim() && Number(draft.netLoadWeightTon || 0) > 0);
  const step3Valid = Boolean(
    draft.personnelAssignment?.operatorName || draft.personnelAssignment?.riggerName || draft.riggingSetup?.legCount
  );

  if (!isOpen) return null;

  const isEdit = Boolean(editingPlan);

  const applyPreset = (presetId: string) => {
    const p = LOAD_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    setDraft((prev) => ({
      ...prev,
      loadShape: p.shape,
      loadDimensions: {
        ...(prev.loadDimensions || {}),
        lengthM: p.lengthM,
        widthM: p.widthM,
        heightM: p.heightM,
        diameterM: p.widthM,
      },
      riggingSetup: {
        ...(prev.riggingSetup || {}),
        legCount: p.legCount,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title?.trim() || !draft.areaLocation?.trim()) {
      setStep(1);
      onToast('عنوان عملیات باربرداری و محل دقیق عملیات الزامی هستند.', 'error');
      return;
    }
    if (!draft.loadName?.trim() || Number(draft.netLoadWeightTon || 0) <= 0) {
      setStep(2);
      onToast('نام بار و وزن خالص معتبر (بزرگ‌تر از صفر) الزامی هستند.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingPlan) {
        const res = await liftingApi.updatePlan(editingPlan.id, {
          ...draft,
          changeReason: changeReason.trim() || undefined,
        });
        await onSaved(res.plan, true, res.revisionBumped);
      } else {
        const created = await liftingApi.createPlan(draft);
        await onSaved(created, false, false);
      }
      onClose();
    } catch (err: any) {
      onToast(err?.message || 'خطا در ذخیره‌سازی طرح باربرداری', 'error');
    } finally {
      setSaving(false);
    }
  };

  const stepButtons: Array<{ id: FormStep; title: string; icon: React.ComponentType<any>; ready: boolean }> = [
    { id: 1, title: '۱. مشخصات پایه و موقعیت', icon: Building2, ready: step1Valid },
    { id: 2, title: '۲. هندسه بار و جرثقیل', icon: Package, ready: step2Valid },
    { id: 3, title: '۳. Rigging و تیم اجرایی', icon: Users, ready: step3Valid },
  ];

  const showS1 = showAllSections || step === 1;
  const showS2 = showAllSections || step === 2;
  const showS3 = showAllSections || step === 3;

  const subHeader = (
    <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
      {!showAllSections ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {stepButtons.map((s) => {
            const Icon = s.icon;
            const active = step === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{s.title}</span>
                {s.ready && !active && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      ) : (
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          نمای کامل ورود اطلاعات (۳ بخش در یک صفحه)
        </span>
      )}

      {/* Live Engineering Telemetry Readout */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 tabular-nums">
        <div>
          <span className="text-slate-500 dark:text-slate-400">وزن کل (با DAF): </span>
          <strong className="font-mono font-black text-slate-900 dark:text-white">
            {liveMetrics.factoredGross} t
          </strong>
        </div>
        <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700" />
        <div>
          <span className="text-slate-500 dark:text-slate-400">نسبت به ظرفیت اسمی: </span>
          <strong
            className={`font-mono font-black ${
              liveMetrics.pctOfMaxCrane === null
                ? 'text-slate-500'
                : liveMetrics.pctOfMaxCrane > 85
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {liveMetrics.pctOfMaxCrane !== null ? `${liveMetrics.pctOfMaxCrane}%` : 'انتخاب نشده'}
          </strong>
        </div>
        <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700" />
        <div>
          <span className="text-slate-500 dark:text-slate-400">آرایش اسلینگ: </span>
          <strong className="font-mono font-black text-sky-700 dark:text-sky-400">
            {draft.riggingSetup?.legCount || 4} شاخه
          </strong>
        </div>
      </div>
    </div>
  );

  const footerNavigation = (
    <>
      {!showAllSections && step > 1 && (
        <button
          type="button"
          onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
          <span>مرحله قبل</span>
        </button>
      )}
      {!showAllSections && step < 3 && (
        <button
          type="button"
          onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
        >
          <span>مرحله بعد</span>
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
    </>
  );

  return (
    <LiftingFormModalShell
      isOpen={isOpen}
      title={
        isEdit
          ? `ویرایش طرح باربرداری — ${draft.planCode} (R${draft.revisionNumber})`
          : 'ثبت طرح جدید عملیات باربرداری (Lifting Plan)'
      }
      subtitle={
        isEdit
          ? 'ویرایش پارامترهای فنی در طرح‌های تأییدشده نسخه جدید ایجاد و بازتأیید را فعال می‌کند.'
          : 'ثبت سریع مشخصات مهندسی و عملیاتی — محاسبات سرور به‌صورت خودکار پس از ثبت اجرا می‌شوند.'
      }
      icon={Layers}
      maxWidthClass="max-w-5xl"
      submitting={saving}
      submitLabel={isEdit ? 'ذخیره تغییرات و بازمحاسبه' : 'ثبت طرح و اجرای محاسبات'}
      submittingLabel="در حال ثبت و اجرای محاسبات..."
      headerActions={
        <button
          type="button"
          onClick={() => setShowAllSections((v) => !v)}
          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer whitespace-nowrap"
        >
          {showAllSections ? 'نمای گام‌به‌گام' : 'نمایش یکجای همه بخش‌ها'}
        </button>
      }
      subHeader={subHeader}
      footerExtra={footerNavigation}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
          {/* Revision Warning Banner when editing active/under-review plans */}
          {isEdit && ['APPROVED', 'ACTIVE_EXECUTION', 'UNDER_REVIEW'].includes(String(draft.status)) && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div className="flex-1 space-y-2">
                <p className="font-bold">
                  هشدار کنترل نسخه: تغییر وزن، جرثقیل یا متعلقات Rigging نسخه این طرح را ارتقا داده و آن را به وضعیت «نیازمند بازتأیید» منتقل می‌کند.
                </p>
                <input
                  type="text"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="دلیل بازنگری فنی (مثلاً: اصلاح شعاع کار به ۱۶ متر یا جایگزینی اسلینگ)..."
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* STEP / SECTION 1: Basic Identity, Category, Unit & Location */}
          {showS1 && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-sky-600" />
                  <span>بخش ۱: هویت عملیات، دسته‌بندی ASME و موقعیت</span>
                </h4>
                {!isEdit && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                    <span className="text-slate-500">پیش‌تنظیم سریع هندسه:</span>
                    {LOAD_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPreset(p.id)}
                        className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-sky-400 text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                      >
                        {p.titleFa}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">
                    عنوان عملیات باربرداری <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={draft.title || ''}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="مثال: نصب مبدل حرارتی E-104 در پایپ‌رک غربی"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">
                    دسته‌بندی عملیات (ASME P30.1)
                  </label>
                  <select
                    value={draft.liftCategory || 'STANDARD'}
                    onChange={(e) => {
                      const cat = e.target.value;
                      const meta = LIFT_CATEGORY_LABELS[cat];
                      setDraft({
                        ...draft,
                        liftCategory: cat,
                        dynamicFactor: meta ? meta.defaultDaf : draft.dynamicFactor,
                      });
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    {Object.entries(LIFT_CATEGORY_LABELS).map(([k, m]) => (
                      <option key={k} value={k}>
                        {m.labelFa}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">
                    تاریخ برنامه‌ریزی
                  </label>
                  <PersianDatePicker
                    value={draft.plannedDate || ''}
                    onChange={(jalaliStr, gregorianStr) =>
                      setDraft({ ...draft, plannedDate: gregorianStr || jalaliStr })
                    }
                    isFa
                    showGregorianPreview={false}
                    inputClassName="py-2 text-xs"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">
                    واحد سازمانی (مرکزی)
                  </label>
                  <select
                    value={draft.unitName || ''}
                    onChange={(e) => {
                      const u = integration?.units.find((x) => x.name === e.target.value);
                      setDraft({ ...draft, unitName: e.target.value, unitId: u?.id || null });
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="عمومی مجتمع">عمومی مجتمع</option>
                    {(integration?.units || []).map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-4">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">
                    محل دقیق عملیات <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={draft.areaLocation || ''}
                    onChange={(e) => setDraft({ ...draft, areaLocation: e.target.value })}
                    placeholder="مثال: سکو ۴ - مجاور تاور T-201"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">
                    پیمانکار اجرایی
                  </label>
                  <input
                    list="lifting-modal-contractors"
                    type="text"
                    value={draft.contractorName || ''}
                    onChange={(e) => setDraft({ ...draft, contractorName: e.target.value })}
                    placeholder="سازمانی / پیمانکار"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                  <datalist id="lifting-modal-contractors">
                    {(integration?.contractors || []).map((c, idx) => (
                      <option key={`${c.name}-${idx}`} value={c.name} />
                    ))}
                  </datalist>
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">
                    کد طرح (خودکار)
                  </label>
                  <input
                    type="text"
                    disabled={isEdit}
                    value={draft.planCode || ''}
                    onChange={(e) => setDraft({ ...draft, planCode: e.target.value })}
                    placeholder="LP-1405-XXXX"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>
            </section>
          )}

          {/* STEP / SECTION 2: Load Weights, Dimensions & Crane Parameters */}
          {showS2 && (
            <section className="space-y-4">
              <div className="pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-600" />
                  <span>بخش ۲: مشخصات بار، وزن‌ها، ابعاد و تنظیمات جرثقیل</span>
                </h4>
                <span className="text-[11px] text-slate-500">محاسبه دقیق Load Chart و مرکز ثقل در گام بعد انجام می‌شود.</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">
                    نام / تگ بار (Load Name) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={draft.loadName || ''}
                    onChange={(e) => setDraft({ ...draft, loadName: e.target.value })}
                    placeholder="مثال: مبدل E-104B"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">هندسه بار</label>
                  <select
                    value={draft.loadShape || 'VESSEL_HORIZONTAL'}
                    onChange={(e) => setDraft({ ...draft, loadShape: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="VESSEL_HORIZONTAL">مخزن افقی / مبدل</option>
                    <option value="CYLINDER_VERTICAL">مخزن عمودی / ستون</option>
                    <option value="BOX">مکعبی / اسکید</option>
                    <option value="EXCHANGER">مبدل حرارتی</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">
                    وزن خالص بار (تن) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={draft.netLoadWeightTon ?? ''}
                    onChange={(e) => setDraft({ ...draft, netLoadWeightTon: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">وزن متعلقات (تن)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={draft.riggingAccessoryWeightTon ?? 0.4}
                    onChange={(e) => setDraft({ ...draft, riggingAccessoryWeightTon: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">ضریب دینامیکی (DAF)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="1"
                    max="2"
                    value={draft.dynamicFactor ?? 1.1}
                    onChange={(e) => setDraft({ ...draft, dynamicFactor: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
                  />
                </div>

                {/* Dimensions Quick Row */}
                <div className="md:col-span-3">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">طول بار (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.2"
                    value={draft.loadDimensions?.lengthM ?? 6}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        loadDimensions: { ...(draft.loadDimensions || {}), lengthM: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">عرض / قطر (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.2"
                    value={draft.loadDimensions?.widthM ?? 2.2}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDraft({
                        ...draft,
                        loadDimensions: { ...(draft.loadDimensions || {}), widthM: val, diameterM: val },
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">ارتفاع بار (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.2"
                    value={draft.loadDimensions?.heightM ?? 2.2}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        loadDimensions: { ...(draft.loadDimensions || {}), heightM: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">وزن قلاب جرثقیل (تن)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={draft.hookBlockWeightTon ?? 0.6}
                    onChange={(e) => setDraft({ ...draft, hookBlockWeightTon: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
                  />
                </div>

                {/* Crane Selection & Geometry */}
                <div className="md:col-span-5">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">انتخاب جرثقیل اصلی</label>
                  <select
                    value={draft.craneSetup?.primaryCraneId || ''}
                    onChange={(e) => {
                      const cid = Number(e.target.value) || undefined;
                      const cr = cranes.find((c) => c.id === cid);
                      setDraft({
                        ...draft,
                        hookBlockWeightTon: cr ? cr.hookBlockWeightTon : draft.hookBlockWeightTon,
                        craneSetup: {
                          ...(draft.craneSetup || {}),
                          primaryCraneId: cid,
                          counterweightTon: cr ? cr.counterweightTon : draft.craneSetup?.counterweightTon,
                          outriggerSpreadM: cr ? cr.outriggerSpreadM : draft.craneSetup?.outriggerSpreadM,
                        },
                      });
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="">-- انتخاب از بانک جرثقیل‌ها --</option>
                    {cranes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.model} · {c.maxRatedCapacityTon}t · {c.loadChartRows.length} ردیف چارت)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">طول بوم (m)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={draft.craneSetup?.boomLengthM ?? 24}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        craneSetup: { ...(draft.craneSetup || {}), boomLengthM: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">شعاع کار (m)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={draft.craneSetup?.radiusM ?? 12}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        craneSetup: { ...(draft.craneSetup || {}), radiusM: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">آرایش جک (Outrigger)</label>
                  <select
                    value={draft.craneSetup?.outriggerConfig || '100_OUTRIGGERS'}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        craneSetup: { ...(draft.craneSetup || {}), outriggerConfig: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="100_OUTRIGGERS">۱۰۰٪ جک‌ها باز</option>
                    <option value="75_OUTRIGGERS">۷۵٪ جک‌ها باز</option>
                    <option value="ON_TIRES">روی لاستیک (On Tires)</option>
                    <option value="CRAWLER_360">شنی ۳۶۰ درجه</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* STEP / SECTION 3: Rigging Setup, Personnel Assignment & Notes */}
          {showS3 && (
            <section className="space-y-5">
              <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
                <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Anchor className="w-4 h-4 text-indigo-600" />
                  <span>بخش ۳: انتخاب ادوات Rigging و انتساب تیم مجاز عملیات</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">تعداد شاخه اسلینگ</label>
                  <select
                    value={draft.riggingSetup?.legCount || 4}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        riggingSetup: { ...(draft.riggingSetup || {}), legCount: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value={1}>۱ شاخه (تک‌پل)</option>
                    <option value={2}>۲ شاخه</option>
                    <option value={3}>۳ شاخه</option>
                    <option value={4}>۴ شاخه (کنترل ۳ شاخه مؤثر ASME)</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">ارتفاع قلاب تا بار (m)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.5"
                    value={draft.riggingSetup?.hookHeightM ?? 4.5}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        riggingSetup: { ...(draft.riggingSetup || {}), hookHeightM: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">اسلینگ اصلی (بانک تجهیزات)</label>
                  <select
                    value={draft.riggingSetup?.slingIds?.[0] || ''}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const item = slings.find((s) => s.id === id);
                      setDraft({
                        ...draft,
                        riggingSetup: {
                          ...(draft.riggingSetup || {}),
                          slingIds: id ? [id] : [],
                          slingWllTon: item ? item.wllTon : draft.riggingSetup?.slingWllTon,
                        },
                      });
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="">-- انتخاب اسلینگ (اختیاری) --</option>
                    {slings.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.assetCode} - {s.name} (WLL: {s.wllTon}t)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">شگل / قلاب (بانک تجهیزات)</label>
                  <select
                    value={draft.riggingSetup?.shackleIds?.[0] || ''}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const item = shackles.find((s) => s.id === id);
                      setDraft({
                        ...draft,
                        riggingSetup: {
                          ...(draft.riggingSetup || {}),
                          shackleIds: id ? [id] : [],
                          shackleWllTon: item ? item.wllTon : draft.riggingSetup?.shackleWllTon,
                        },
                      });
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="">-- انتخاب شگل (اختیاری) --</option>
                    {shackles.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.assetCode} - {s.name} (WLL: {s.wllTon}t)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <CentralPersonnelSelector
                  label="اپراتور جرثقیل (Crane Operator)"
                  compact
                  selectedPersonnelCode={draft.personnelAssignment?.operatorCode || ''}
                  value={draft.personnelAssignment?.operatorName || ''}
                  onSelectPersonnel={(p) =>
                    setDraft({
                      ...draft,
                      personnelAssignment: {
                        ...(draft.personnelAssignment || {}),
                        operatorName: p?.fullName || '',
                        operatorCode: p?.personnelCode || '',
                      },
                    })
                  }
                />
                <CentralPersonnelSelector
                  label="ریگر / قلاب‌انداز مجاز (Rigger)"
                  compact
                  selectedPersonnelCode={draft.personnelAssignment?.riggerCode || ''}
                  value={draft.personnelAssignment?.riggerName || ''}
                  onSelectPersonnel={(p) =>
                    setDraft({
                      ...draft,
                      personnelAssignment: {
                        ...(draft.personnelAssignment || {}),
                        riggerName: p?.fullName || '',
                        riggerCode: p?.personnelCode || '',
                      },
                    })
                  }
                />
                <CentralPersonnelSelector
                  label="ناظر ایمنی عملیات (Safety Supervisor)"
                  compact
                  selectedPersonnelCode={draft.personnelAssignment?.safetySupervisorCode || ''}
                  value={draft.personnelAssignment?.safetySupervisorName || ''}
                  onSelectPersonnel={(p) =>
                    setDraft({
                      ...draft,
                      personnelAssignment: {
                        ...(draft.personnelAssignment || {}),
                        safetySupervisorName: p?.fullName || '',
                        safetySupervisorCode: p?.personnelCode || '',
                      },
                    })
                  }
                />
              </div>

              <div>
                <label className="block font-bold mb-1.5 text-slate-700 dark:text-slate-200">
                  توضیحات فنی و الزامات خاص مسیر / نشست زمین
                </label>
                <textarea
                  rows={2}
                  value={draft.notes || ''}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="نکات تکمیلی عملیات، موانع احتمالی یا محدودیت‌های زیست‌محیطی..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </section>
          )}
    </LiftingFormModalShell>
  );
}
